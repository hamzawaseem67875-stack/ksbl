/**
 * GET /api/dashboard/heatmap?brand_id=...&from=...&to=...
 *
 * Returns geo-clustered report data grouped by area_name.
 * Used by the client-side map to render counterfeit hotspots.
 *
 * No individual scan coordinates are returned — only cluster centroids
 * (average lat/long per area) and counts. Consumer privacy is preserved.
 *
 * Query params:
 *   brand_id   string   — required
 *   from       ISO date — optional (default: 30 days ago)
 *   to         ISO date — optional (default: now)
 *
 * Response 200:
 *   Array<{ area_name, latitude, longitude, report_count, suspicious_rate }>
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const QuerySchema = z.object({
  brand_id: z.string().min(1, "brand_id is required"),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const parsed = QuerySchema.safeParse({
    brand_id: searchParams.get("brand_id"),
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { brand_id } = parsed.data;
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Supabase configuration is missing on server" },
      { status: 500 }
    );
  }

  try {
    // 1. Verify brand exists
    const brandRes = await fetch(`${supabaseUrl}/rest/v1/Brand?id=eq.${brand_id}`, {
      method: "GET",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });

    if (!brandRes.ok) {
      return NextResponse.json({ error: "Failed to verify brand" }, { status: 500 });
    }

    const brandData = await brandRes.json();
    if (!brandData || brandData.length === 0) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // 2. Get all report scan_ids for this brand in the date range
    const reportsRes = await fetch(
      `${supabaseUrl}/rest/v1/Report?brand_id=eq.${brand_id}&created_at=gte.${from.toISOString()}&created_at=lte.${to.toISOString()}&select=scan_id`,
      {
        method: "GET",
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`
        }
      }
    );

    if (!reportsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    const reports = await reportsRes.json();
    const scanIds = reports.map((r: any) => r.scan_id).filter(Boolean);

    if (scanIds.length === 0) {
      return NextResponse.json([]);
    }

    // 3. Pull scans with location data
    const chunkSize = 50;
    const scans: any[] = [];
    for (let i = 0; i < scanIds.length; i += chunkSize) {
      const chunk = scanIds.slice(i, i + chunkSize);
      const chunkRes = await fetch(
        `${supabaseUrl}/rest/v1/Scan?id=in.(${chunk.join(',')})&latitude=not.is.null&longitude=not.is.null&select=latitude,longitude,area_name,verdict`,
        {
          method: "GET",
          headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`
          }
        }
      );
      if (chunkRes.ok) {
        const chunkData = await chunkRes.json();
        scans.push(...chunkData);
      }
    }

    // Group by area_name, compute centroid + counts
    const areaMap = new Map<
      string,
      { lats: number[]; lngs: number[]; total: number; suspicious: number }
    >();

    for (const scan of scans) {
      const key = scan.area_name ?? "Unknown Area";
      if (!areaMap.has(key)) {
        areaMap.set(key, { lats: [], lngs: [], total: 0, suspicious: 0 });
      }
      const entry = areaMap.get(key)!;
      if (scan.latitude != null) entry.lats.push(Number(scan.latitude));
      if (scan.longitude != null) entry.lngs.push(Number(scan.longitude));
      entry.total++;
      if (scan.verdict === "suspicious") entry.suspicious++;
    }

    const clusters = Array.from(areaMap.entries()).map(([area_name, data]) => ({
      area_name,
      latitude:
        data.lats.length > 0
          ? data.lats.reduce((a, b) => a + b, 0) / data.lats.length
          : null,
      longitude:
        data.lngs.length > 0
          ? data.lngs.reduce((a, b) => a + b, 0) / data.lngs.length
          : null,
      report_count: data.total,
      suspicious_count: data.suspicious,
      suspicious_rate:
        data.total > 0
          ? Math.round((data.suspicious / data.total) * 10000) / 100
          : 0,
    }));

    // Sort by report_count descending for the client
    clusters.sort((a, b) => b.report_count - a.report_count);

    return NextResponse.json(clusters);
  } catch (err) {
    console.error("[GET /api/dashboard/heatmap] Failed to fetch heatmap:", err);
    return NextResponse.json(
      { error: "Failed to load heatmap statistics" },
      { status: 500 }
    );
  }
}
