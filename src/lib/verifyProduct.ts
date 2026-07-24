/**
 * lib/verifyProduct.ts
 *
 * The core shared verification pipeline.
 * Called by both /api/scan and /api/whatsapp-webhook.
 * Do NOT duplicate this logic in the route handlers.
 *
 * Pipeline:
 *  1. Upload image to Vercel Blob → public URL
 *  2. Race OCR + CV calls with a 5 s timeout guard
 *  3. Lookup product by barcode/SKU or extracted batch pattern
 *  4. Rule-based verdict (genuine | suspicious | unverified)
 *  5. Write Scan row to DB
 *  6. If suspicious → write Report row
 *  7. Return full verdict payload
 */

import { uploadImage } from "./blob";
import { db } from "./db";
import { runOcr } from "./ocr";
import { scorePackaging } from "./cv";
import { getVerdictText } from "./translate";
import type { Verdict, ScannedByRole } from "@prisma/client";

// ─── Thresholds ───────────────────────────────────────────────────────────────

/**
 * If cv_anomaly_score >= SUSPICIOUS_THRESHOLD → suspicious verdict
 * (assuming product match exists; otherwise → unverified)
 */
const SUSPICIOUS_THRESHOLD = 0.55;

/** External API timeout in ms before falling back to rule-only verdict */
const API_TIMEOUT_MS = 5000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerifyInput {
  imageFile: File | Blob;   // The raw image upload
  barcode?: string | null;  // Optional barcode/SKU from client
  latitude?: number | null;
  longitude?: number | null;
  area_name?: string | null;
  scanned_by_role?: ScannedByRole;
}

export interface VerifyResult {
  scan_id: string;
  verdict: Verdict;
  confidence: number;
  reason: string;
  urdu_text: string;
  english_text: string;
  image_url: string;
  extracted_batch: string | null;
  extracted_mfg_date: string | null;
  extracted_mrp: string | null;
  cv_anomaly_score: number | null;
  product_name: string | null;
  brand_name: string | null;
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ─── Product lookup ───────────────────────────────────────────────────────────

/**
 * Open Food Facts is a community-maintained, mostly food/grocery-focused database,
 * so coverage for non-food FMCG items (soaps, detergents, cosmetics) may be limited.
 * It should be treated as a "nice to have" enrichment source, not the primary source of truth.
 */
async function fetchOpenFoodFacts(barcode: string): Promise<{ product_name: string | null; brand_name: string | null } | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5 seconds timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "ShelfWatch - FMCG Authenticity Verification Pipeline - Version 1.0",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.status === 1 && data.product) {
      return {
        product_name: data.product.product_name || data.product.product_name_en || null,
        brand_name: data.product.brands || null,
      };
    }
  } catch (err) {
    console.warn("[Open Food Facts API Lookup] Failed or timed out:", err);
  }
  return null;
}

/**
 * UPCitemdb is queried using the free trial plan, which does not require an API key
 * but has a rate limit of 100 requests/day per IP.
 */
async function fetchUPCItemDB(barcode: string): Promise<{ product_name: string | null; brand_name: string | null } | null> {
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5 seconds timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });
    clearTimeout(timeoutId);

    if (res.status === 429) {
      console.warn("[UPCitemdb API Lookup] Rate limit reached (100 requests/day/IP exceeded).");
      return null;
    }

    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.code === "OK" && data.total > 0 && data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        product_name: item.title || null,
        brand_name: item.brand || null,
      };
    }
  } catch (err) {
    console.warn("[UPCitemdb API Lookup] Failed or timed out:", err);
  }
  return null;
}

async function findProduct(barcode?: string | null, batch?: string | null) {
  // 1. Exact SKU match (barcode scan)
  if (barcode) {
    const bysku = await db.product.findUnique({ where: { sku: barcode } });
    if (bysku) return bysku;
  }

  // 2. Batch pattern match — iterate and test regex against extracted batch
  if (batch) {
    const products = await db.product.findMany({
      select: { id: true, sku: true, brand_name: true, product_name: true,
                reference_batch_pattern: true, avg_unit_price_pkr: true },
    });
    for (const p of products) {
      try {
        const re = new RegExp(p.reference_batch_pattern, "i");
        if (re.test(batch)) return p;
      } catch {
        // invalid regex in DB — skip
      }
    }
  }

  return null;
}

// ─── Verdict logic ────────────────────────────────────────────────────────────

function computeVerdict(
  product: { reference_batch_pattern: string } | null,
  batch: string | null,
  anomalyScore: number
): { verdict: Verdict; confidence: number } {
  if (!product) {
    // No product match → unverified regardless of CV score
    return { verdict: "unverified", confidence: 0.4 };
  }

  const batchMatches = batch
    ? (() => {
        try {
          return new RegExp(product.reference_batch_pattern, "i").test(batch);
        } catch {
          return false;
        }
      })()
    : false;

  if (anomalyScore < SUSPICIOUS_THRESHOLD && batchMatches) {
    // Low anomaly + batch match → genuine
    const confidence = (1 - anomalyScore) * (batchMatches ? 1 : 0.8);
    return { verdict: "genuine", confidence: Math.min(confidence, 0.99) };
  }

  // High anomaly or batch mismatch → suspicious
  const confidence = anomalyScore;
  return { verdict: "suspicious", confidence: Math.min(confidence, 0.99) };
}

// ─── Public pipeline function ────────────────────────────────────────────────

/**
 * Run the full ShelfWatch verification pipeline.
 * This is the single source of truth for scan logic.
 */
export async function verifyProduct(input: VerifyInput): Promise<VerifyResult> {
  // ── Step 1: Upload image to Vercel Blob ──────────────────────────────────
  const filename = `scan-${Date.now()}.jpg`;
  let imageUrl: string;

  try {
    imageUrl = await uploadImage(filename, input.imageFile);
  } catch (err) {
    console.error("[verifyProduct] Blob upload failed:", err);
    // Use a placeholder URL so the scan row still gets written
    imageUrl = `https://placeholder.shelfwatch.pk/scan/${filename}`;
  }

  // ── Step 2: Race OCR + CV with timeout ───────────────────────────────────
  let ocrBatch: string | null = null;
  let ocrMfgDate: string | null = null;
  let ocrMrp: string | null = null;
  let ocrRaw: Record<string, unknown> = {};
  let cvScore: number | null = null;

  const [ocrSettled, cvSettled] = await Promise.allSettled([
    withTimeout(runOcr(imageUrl), API_TIMEOUT_MS),
    withTimeout(scorePackaging(imageUrl), API_TIMEOUT_MS),
  ]);

  if (ocrSettled.status === "fulfilled") {
    ocrBatch = ocrSettled.value.batch;
    ocrMfgDate = ocrSettled.value.mfg_date;
    ocrMrp = ocrSettled.value.mrp;
    ocrRaw = ocrSettled.value.raw;
  } else {
    console.warn("[verifyProduct] OCR timed out or failed:", ocrSettled.reason);
  }

  if (cvSettled.status === "fulfilled") {
    cvScore = cvSettled.value.anomaly_score;
  } else {
    console.warn("[verifyProduct] CV timed out or failed:", cvSettled.reason);
    cvScore = 0.5; // neutral fallback
  }

  // ── Step 3: Product lookup ────────────────────────────────────────────────
  const product = await findProduct(input.barcode, ocrBatch);

  // Fallback metadata lookup from Open Food Facts / UPCitemdb if local DB has no record
  let offProduct: { product_name: string | null; brand_name: string | null } | null = null;
  if (!product && input.barcode) {
    offProduct = await fetchOpenFoodFacts(input.barcode);
    if (!offProduct) {
      offProduct = await fetchUPCItemDB(input.barcode);
    }
  }

  // ── Step 4: Verdict ───────────────────────────────────────────────────────
  const { verdict, confidence } = computeVerdict(product, ocrBatch, cvScore ?? 0.5);

  // ── Step 5: Translate verdict ─────────────────────────────────────────────
  const verdictText = await getVerdictText(verdict, {
    batch: ocrBatch,
    anomaly_score: cvScore,
    brand_name: product?.brand_name ?? offProduct?.brand_name ?? undefined,
  });

  // ── Step 6: Write Scan row ────────────────────────────────────────────────
  const scan = await db.scan.create({
    data: {
      product_id: product?.id ?? null,
      scanned_by_role: input.scanned_by_role ?? "consumer",
      image_url: imageUrl,
      extracted_batch: ocrBatch,
      extracted_mfg_date: ocrMfgDate,
      extracted_mrp: ocrMrp,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ocr_raw_json: ocrRaw as any,
      cv_anomaly_score: cvScore,
      verdict,
      confidence,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      area_name: input.area_name ?? null,
    },
  });

  // ── Step 7: Write Report row if suspicious ────────────────────────────────
  if (verdict === "suspicious" && product) {
    // Find the brand for this product to link the report
    const brand = await db.brand.findFirst({
      where: { name: product.brand_name },
    });
    if (brand) {
      await db.report.create({
        data: {
          scan_id: scan.id,
          brand_id: brand.id,
          status: "pending",
          notes: verdictText.reason,
        },
      });
    }
  }

  return {
    scan_id: scan.id,
    verdict,
    confidence,
    reason: verdictText.reason,
    urdu_text: verdictText.urdu_text,
    english_text: verdictText.english_text,
    image_url: imageUrl,
    extracted_batch: ocrBatch,
    extracted_mfg_date: ocrMfgDate,
    extracted_mrp: ocrMrp,
    cv_anomaly_score: cvScore,
    product_name: product?.product_name ?? offProduct?.product_name ?? null,
    brand_name: product?.brand_name ?? offProduct?.brand_name ?? null,
  };
}
