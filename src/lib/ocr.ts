/**
 * lib/ocr.ts
 *
 * Thin wrapper around the Google Cloud Vision API for OCR.
 * Extracts batch number, manufacturing date, and MRP from a
 * product packaging image URL.
 *
 * Swap this file to use OCR.space or another provider without
 * touching any route logic.
 *
 * Required env vars:
 *   GOOGLE_VISION_API_KEY — Cloud Vision API key with Vision API enabled
 *
 * Fallback: returns nulls with raw = {} if the call fails or times out.
 */

export interface OcrResult {
  batch: string | null;
  mfg_date: string | null;
  mrp: string | null;
  raw: Record<string, unknown>;
}

// ─── Regex patterns for Pakistan FMCG packaging ─────────────────────────────

// Batch: letters-digits-letters or digits/letters combos like XP-992-KHI, HP-221-A
const BATCH_RE =
  /\b([A-Z]{1,4}[-/]?\d{2,6}[-/]?[A-Z]{0,5})\b/;

// Manufacturing date: MFG / Mfd / Date followed by date patterns
const MFG_DATE_RE =
  /(?:mfg\.?|mfd\.?|manufactured|date)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{2,4}[/-]\d{1,2}[/-]\d{1,2}|[A-Z][a-z]{2,8}\.?\s*\d{4})/i;

// MRP: Rs., PKR, MRP followed by digits
const MRP_RE =
  /(?:mrp|rs\.?|pkr)[:\s]*(\d{1,6}(?:\.\d{1,2})?)/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractFields(text: string): Omit<OcrResult, "raw"> {
  const batch = BATCH_RE.exec(text)?.[1] ?? null;
  const mfg_date = MFG_DATE_RE.exec(text)?.[1] ?? null;
  const mrp = MRP_RE.exec(text)?.[1] ?? null;
  return { batch, mfg_date, mrp };
}

// ─── Google Cloud Vision ──────────────────────────────────────────────────────

async function callGoogleVision(imageUrl: string): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    console.warn("[OCR] GOOGLE_VISION_API_KEY not set — returning null OCR result");
    return { batch: null, mfg_date: null, mrp: null, raw: {} };
  }

  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const body = {
    requests: [
      {
        image: { source: { imageUri: imageUrl } },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Vision API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    responses: Array<{
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  const response = data.responses[0];
  if (response?.error) {
    throw new Error(`Google Vision response error: ${response.error.message}`);
  }

  const fullText = response?.fullTextAnnotation?.text ?? "";
  const extracted = extractFields(fullText);

  return {
    ...extracted,
    raw: { fullText, annotationsCount: fullText.split("\n").length },
  };
}

// ─── OCR.space fallback ───────────────────────────────────────────────────────

async function callOcrSpace(imageUrl: string): Promise<OcrResult> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return { batch: null, mfg_date: null, mrp: null, raw: {} };
  }

  const formData = new FormData();
  formData.append("url", imageUrl);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");

  const res = await fetch("https://api.ocr.space/parse/imageurl", {
    method: "POST",
    headers: { apikey: apiKey },
    body: formData,
  });

  if (!res.ok) throw new Error(`OCR.space error ${res.status}`);

  const data = (await res.json()) as {
    ParsedResults?: Array<{ ParsedText: string }>;
  };

  const fullText = data.ParsedResults?.[0]?.ParsedText ?? "";
  const extracted = extractFields(fullText);

  return { ...extracted, raw: { fullText } };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run OCR on a publicly accessible image URL.
 * Tries Google Cloud Vision first; falls back to OCR.space if env key present.
 * Never throws — returns nulls on failure.
 */
export async function runOcr(imageUrl: string): Promise<OcrResult> {
  try {
    // Primary: Google Cloud Vision
    if (process.env.GOOGLE_VISION_API_KEY) {
      return await callGoogleVision(imageUrl);
    }
    // Fallback: OCR.space
    if (process.env.OCR_SPACE_API_KEY) {
      return await callOcrSpace(imageUrl);
    }
    console.warn("[OCR] No OCR API keys configured — returning null result");
    return { batch: null, mfg_date: null, mrp: null, raw: {} };
  } catch (err) {
    console.error("[OCR] Failed:", err);
    return { batch: null, mfg_date: null, mrp: null, raw: { error: String(err) } };
  }
}
