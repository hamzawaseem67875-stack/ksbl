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
import { db } from "@/lib/db";

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

  // Verify brand exists
  const brand = await db.brand.findUnique({ where: { id: brand_id } });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Get scan_ids linked to this brand's reports
  const reports = await db.report.findMany({
    where: {
      brand_id,
      created_at: { gte: from, lte: to },
    },
    select: { scan_id: true },
  });

  const scanIds = reports.map((r) => r.scan_id);

  if (scanIds.length === 0) {
    return NextResponse.json([]);
  }

  // Pull scans with location data
  const scans = await db.scan.findMany({
    where: {
      id: { in: scanIds },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      latitude: true,
      longitude: true,
      area_name: true,
      verdict: true,
    },
  });

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
    if (scan.latitude != null) entry.lats.push(scan.latitude);
    if (scan.longitude != null) entry.lngs.push(scan.longitude);
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
}
