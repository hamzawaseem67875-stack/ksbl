/**
 * POST /api/scan
 *
 * Main product verification endpoint.
 * Accepts multipart/form-data with an image + optional metadata.
 * Delegates all heavy work to lib/verifyProduct.ts.
 *
 * Rate limiting: For MVP, add a simple IP-based check here.
 * TODO (post-hackathon): integrate Upstash Redis rate limiter via
 *   @upstash/ratelimit for production-grade throttling.
 *
 * Request (multipart/form-data):
 *   image          File     — Product/packaging photo (required)
 *   barcode        string?  — Scanned barcode/SKU (optional)
 *   latitude       number?  — GPS latitude (optional)
 *   longitude      number?  — GPS longitude (optional)
 *   area_name      string?  — Human-readable area label (optional)
 *   scanned_by_role string? — "shopkeeper" | "consumer" (default: "consumer")
 *
 * Response 200:
 *   { verdict, confidence, reason, urdu_text, english_text, scan_id,
 *     product_name, brand_name, extracted_batch, extracted_mfg_date, extracted_mrp }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyProduct } from "@/lib/verifyProduct";
import { getCustomerIdFromRequest } from "@/lib/customer";

// ─── Input validation ─────────────────────────────────────────────────────────

const ScanBodySchema = z.object({
  barcode: z.string().max(64).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  area_name: z.string().max(128).optional().nullable(),
  scanned_by_role: z.enum(["shopkeeper", "consumer"]).optional().default("consumer"),
});

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate limit note ────────────────────────────────────────────────────────
  // TODO: Implement IP-based rate limiting (e.g. max 20 scans/minute per IP)
  // using Upstash Redis: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview

  // ── Parse multipart form ───────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request — expected multipart/form-data" },
      { status: 400 }
    );
  }

  const imageFile = formData.get("image");
  if (!imageFile || typeof imageFile === "string") {
    return NextResponse.json(
      { error: "Missing required field: image (File)" },
      { status: 400 }
    );
  }

  // ── Validate additional fields ─────────────────────────────────────────────
  const rawFields = {
    barcode: formData.get("barcode"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    area_name: formData.get("area_name"),
    scanned_by_role: formData.get("scanned_by_role"),
  };

  const parsed = ScanBodySchema.safeParse(rawFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { barcode, latitude, longitude, area_name, scanned_by_role } = parsed.data;

  // Read the logged-in customer's id from the session cookie — never trust a
  // client-supplied customer id in the request body.
  const customerId = await getCustomerIdFromRequest(req);

  // ── Run verification pipeline ──────────────────────────────────────────────
  try {
    const result = await verifyProduct({
      imageFile: imageFile as File,
      barcode: barcode ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      area_name: area_name ?? null,
      scanned_by_role,
      customer_id: customerId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[POST /api/scan] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error during scan processing" },
      { status: 500 }
    );
  }
}
