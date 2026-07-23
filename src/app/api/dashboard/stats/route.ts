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
import { db } from "@/lib/db";

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

  // Verify brand exists
  const brand = await db.brand.findUnique({ where: { id: brand_id } });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Get all report scan_ids for this brand in the date range
  const reports = await db.report.findMany({
    where: {
      brand_id,
      created_at: { gte: from, lte: to },
    },
    select: { scan_id: true },
  });

  const scanIds = reports.map((r) => r.scan_id);

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

  // Aggregate scans tied to this brand's reports
  const scans = await db.scan.findMany({
    where: { id: { in: scanIds } },
    select: { verdict: true, product_id: true },
  });

  const total_scans = scans.length;
  const genuine_count = scans.filter((s) => s.verdict === "genuine").length;
  const suspicious_count = scans.filter((s) => s.verdict === "suspicious").length;
  const unverified_count = scans.filter((s) => s.verdict === "unverified").length;
  const suspicious_rate =
    total_scans > 0 ? suspicious_count / total_scans : 0;

  // Estimated losses: suspicious_count * avg unit price of the brand's products
  const productIds = [
    ...new Set(scans.map((s) => s.product_id).filter(Boolean) as string[]),
  ];

  let avg_price = FALLBACK_UNIT_PRICE_PKR;
  if (productIds.length > 0) {
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { avg_unit_price_pkr: true },
    });
    const prices = products.map((p) => p.avg_unit_price_pkr).filter((p) => p > 0);
    if (prices.length > 0) {
      avg_price = prices.reduce((a, b) => a + b, 0) / prices.length;
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
}
