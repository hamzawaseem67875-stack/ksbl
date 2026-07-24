/**
 * GET /api/dashboard/stats?brand_id=...&from=...&to=...
 *
 * Returns aggregate scan/report statistics for a brand.
 *
 * Consumer data is anonymized: individual lat/long and scanned_by_role
 * are NOT returned — only aggregated counts and rates.
 *
 * Query params:
 *   brand_id   string   — required
 *   from       ISO date — optional (default: 30 days ago)
 *   to         ISO date — optional (default: now)
 *
 * Response 200:
 *   {
 *     total_scans, genuine_count, suspicious_count, unverified_count,
 *     suspicious_rate, estimated_losses_pkr, date_range: { from, to }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const QuerySchema = z.object({
  brand_id: z.string().min(1, "brand_id is required"),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

// Average unit price used when product avg_unit_price_pkr = 0
const FALLBACK_UNIT_PRICE_PKR = 150;

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

    // 2. Get all reports for this brand in the date range
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
      return NextResponse.json({
        total_scans: 0,
        genuine_count: 0,
        suspicious_count: 0,
        unverified_count: 0,
        suspicious_rate: 0,
        estimated_losses_pkr: 0,
        date_range: { from: from.toISOString(), to: to.toISOString() },
      });
    }

    // 3. Fetch scans linked to these reports
    // Split into chunks of 50 to prevent huge URL strings if there are many scans
    const chunkSize = 50;
    const scans: any[] = [];
    for (let i = 0; i < scanIds.length; i += chunkSize) {
      const chunk = scanIds.slice(i, i + chunkSize);
      const chunkRes = await fetch(
        `${supabaseUrl}/rest/v1/Scan?id=in.(${chunk.join(',')})&select=verdict,product_id`,
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

    const total_scans = scans.length;
    const genuine_count = scans.filter((s: any) => s.verdict === "genuine").length;
    const suspicious_count = scans.filter((s: any) => s.verdict === "suspicious").length;
    const unverified_count = scans.filter((s: any) => s.verdict === "unverified").length;
    const suspicious_rate = total_scans > 0 ? suspicious_count / total_scans : 0;

    // 4. Calculate estimated losses
    const productIds = [
      ...new Set(scans.map((s: any) => s.product_id).filter(Boolean) as string[]),
    ];

    let avg_price = FALLBACK_UNIT_PRICE_PKR;
    if (productIds.length > 0) {
      const prodRes = await fetch(
        `${supabaseUrl}/rest/v1/Product?id=in.(${productIds.join(',')})&select=avg_unit_price_pkr`,
        {
          method: "GET",
          headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`
          }
        }
      );
      if (prodRes.ok) {
        const products = await prodRes.json();
        const prices = products.map((p: any) => p.avg_unit_price_pkr).filter((p: number) => p > 0);
        if (prices.length > 0) {
          avg_price = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
        }
      }
    }

    const estimated_losses_pkr = suspicious_count * avg_price;

    return NextResponse.json({
      total_scans,
      genuine_count,
      suspicious_count,
      unverified_count,
      suspicious_rate: Math.round(suspicious_rate * 10000) / 100, // percentage, 2dp
      estimated_losses_pkr: Math.round(estimated_losses_pkr),
      date_range: { from: from.toISOString(), to: to.toISOString() },
    });
  } catch (err) {
    console.error("[GET /api/dashboard/stats] Failed to fetch stats:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard statistics" },
      { status: 500 }
    );
  }
}
