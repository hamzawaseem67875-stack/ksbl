/**
 * POST /api/report
 *
 * Consumer-initiated one-tap suspicious report.
 * Ties a new Report record to an existing Scan.
 * Must be called after a scan has already been created via /api/scan.
 *
 * Request (JSON):
 *   { scan_id: string, notes?: string }
 *
 * Response 201:
 *   { report_id, scan_id, status }
 *
 * Response 409:
 *   Already reported — returns existing report
 *
 * Response 404:
 *   Scan not found
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  scan_id: z.string().min(1, "scan_id is required"),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { scan_id, notes } = parsed.data;

  // Verify scan exists and fetch product info for brand lookup
  const scan = await db.scan.findUnique({
    where: { id: scan_id },
    include: { product: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // Check for duplicate report
  const existing = await db.report.findFirst({ where: { scan_id } });
  if (existing) {
    return NextResponse.json(
      { report_id: existing.id, scan_id, status: existing.status, already_reported: true },
      { status: 409 }
    );
  }

  // Find brand by brand_name from the product (if available)
  let brand_id: string | null = null;
  if (scan.product?.brand_name) {
    const brand = await db.brand.findFirst({
      where: { name: scan.product.brand_name },
    });
    brand_id = brand?.id ?? null;
  }

  if (!brand_id) {
    // If no matching brand, use the first brand as a fallback (demo mode)
    const fallbackBrand = await db.brand.findFirst();
    brand_id = fallbackBrand?.id ?? null;
  }

  if (!brand_id) {
    return NextResponse.json(
      { error: "No brand found to associate this report — seed brand data first" },
      { status: 422 }
    );
  }

  const report = await db.report.create({
    data: {
      scan_id,
      brand_id,
      status: "pending",
      notes: notes ?? null,
    },
  });

  return NextResponse.json(
    { report_id: report.id, scan_id, status: report.status },
    { status: 201 }
  );
}
