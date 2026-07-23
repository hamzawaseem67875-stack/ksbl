/**
 * GET /api/scans
 *
 * Returns a list of recent scans for the history page.
 * Includes matched product and brand information.
 *
 * Query params:
 *   limit  number  — default 20, max 100
 *
 * Response 200:
 *   Array<{ id, verdict, confidence, area_name, product_name, brand_name, extracted_batch, image_url, created_at }>
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

  try {
    const scans = await db.scan.findMany({
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        product: {
          select: {
            product_name: true,
            brand_name: true,
          },
        },
      },
    });

    const result = scans.map((s) => ({
      id: s.id,
      verdict: s.verdict,
      confidence: s.confidence,
      area_name: s.area_name,
      product_name: s.product?.product_name ?? null,
      brand_name: s.product?.brand_name ?? null,
      extracted_batch: s.extracted_batch,
      image_url: s.image_url,
      created_at: s.created_at.toISOString(),
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[GET /api/scans] Failed to fetch scan history:", err);
    return NextResponse.json(
      { error: "Failed to load scan history" },
      { status: 500 }
    );
  }
}
