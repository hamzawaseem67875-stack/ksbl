/**
 * lib/translate.ts
 *
 * Fixed-glossary verdict phrasing in Urdu and English.
 *
 * Strategy: the verdict enum (genuine | suspicious | unverified) maps
 * to a pre-approved bilingual phrase pair. Gemini is optionally called
 * to generate a one-sentence contextual reason — but the verdict text
 * itself is NEVER free-translated; it comes from the lookup table only.
 * This prevents hallucinated or offensive Urdu output.
 *
 * Required env vars (optional — fallback works without any):
 *   GEMINI_API_KEY — Google Gemini API key for reason generation
 *
 * Direct REST API fetch call is used to call Gemini (model: gemini-2.5-flash)
 * to keep the bundle lean and serverless-native.
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

export type VerdictKey = "genuine" | "suspicious" | "unverified";

export interface VerdictText {
  urdu_text: string;
  english_text: string;
  reason: string;
}

const GLOSSARY: Record<VerdictKey, { urdu: string; english: string }> = {
  genuine: {
    urdu: "✅ اصل مصنوع — یہ مصنوع معتبر ہے",
    english: "✅ Genuine Product — This product has been verified as authentic",
  },
  suspicious: {
    urdu: "⚠️ مشکوک — یہ مصنوع جعلی ہو سکتی ہے، فروخت یا خریداری سے گریز کریں",
    english:
      "⚠️ Suspicious — This product may be counterfeit. Avoid selling or purchasing.",
  },
  unverified: {
    urdu: "❓ غیر تصدیق شدہ — یہ مصنوع ہمارے ڈیٹا بیس میں موجود نہیں",
    english:
      "❓ Unverified — This product was not found in our manufacturer database",
  },
};

// ─── Gemini reason generation ────────────────────────────────────────────────

async function callGemini(
  verdict: VerdictKey,
  context: {
    batch?: string | null;
    anomaly_score?: number | null;
    brand_name?: string | null;
  }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return getDefaultReason(verdict, context);

  try {
    const prompt = `You are a product authenticity assistant for ShelfWatch, an anti-counterfeit system for Pakistan's FMCG market.

A product scan returned verdict: "${verdict}"
Batch number detected: ${context.batch ?? "N/A"}
Packaging anomaly score (0=genuine, 1=suspicious): ${context.anomaly_score?.toFixed(2) ?? "N/A"}
Brand: ${context.brand_name ?? "Unknown"}

Write ONE concise sentence (max 20 words) in English explaining the reason for this verdict. Be factual, not alarming. No Urdu.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    // 4-second timeout controller for API fetch call
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Translate] Gemini returned status ${response.status}`);
      return getDefaultReason(verdict, context);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      return text.trim();
    }
    
    return getDefaultReason(verdict, context);
  } catch (err) {
    console.error("[Translate] Gemini call failed or timed out:", err);
    return getDefaultReason(verdict, context);
  }
}

function getDefaultReason(
  verdict: VerdictKey,
  context: {
    batch?: string | null;
    anomaly_score?: number | null;
    brand_name?: string | null;
  }
): string {
  switch (verdict) {
    case "genuine":
      return `Batch ${context.batch ?? "pattern"} matches manufacturer records and packaging appears authentic.`;
    case "suspicious":
      return `Packaging anomaly score ${((context.anomaly_score ?? 0.5) * 100).toFixed(0)}% — batch or visual indicators suggest potential counterfeit.`;
    case "unverified":
      return "No matching product record found; manual verification recommended.";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get bilingual verdict text and an optional AI-generated reason.
 * The verdict pair is always from the fixed glossary — never hallucinated.
 */
export async function getVerdictText(
  verdict: VerdictKey,
  context: {
    batch?: string | null;
    anomaly_score?: number | null;
    brand_name?: string | null;
  } = {}
): Promise<VerdictText> {
  const phrase = GLOSSARY[verdict];
  const reason = await callGemini(verdict, context);

  return {
    urdu_text: phrase.urdu,
    english_text: phrase.english,
    reason,
  };
}

/**
 * Synchronous fallback — returns glossary text without Gemini.
 * Use when you need an instant response and can't await.
 */
export function getVerdictTextSync(verdict: VerdictKey): Omit<VerdictText, "reason"> {
  return {
    urdu_text: GLOSSARY[verdict].urdu,
    english_text: GLOSSARY[verdict].english,
  };
}

// ─── Reference-image comparison (RAG vector-match follow-up) ──────────────────

const COMPARE_TIMEOUT_MS = 6000;
const DEFAULT_COMPARISON_REASON =
  "Reference image comparison unavailable — verdict based on standard pipeline.";

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { mimeType, data: buffer.toString("base64") };
  } catch (err) {
    console.warn(`[Translate] Failed to fetch image for comparison (${url}):`, err);
    return null;
  }
}

/**
 * Ask Gemini to compare a scanned product photo against the matched reference
 * image (found via vector similarity search — see lib/vectorSearch.ts) and
 * describe any visual discrepancies in one concise sentence: logo, font,
 * color, print quality, batch code format. Same "one sentence, factual, not
 * alarming" style as getDefaultReason().
 *
 * Requires both images to be fetched and base64-encoded as inline_data parts —
 * Gemini's file_data.file_uri only accepts URIs from its own Files API, not
 * arbitrary public URLs like Vercel Blob links.
 *
 * Never throws — falls back to a generic "comparison unavailable" string.
 */
export async function compareProductImages(
  scanImageUrl: string,
  referenceImageUrl: string,
  context: { product_name?: string | null; brand_name?: string | null } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return DEFAULT_COMPARISON_REASON;

  const [scanImage, referenceImage] = await Promise.all([
    fetchImageAsBase64(scanImageUrl),
    fetchImageAsBase64(referenceImageUrl),
  ]);

  if (!scanImage || !referenceImage) return DEFAULT_COMPARISON_REASON;

  try {
    const prompt = `You are a product authenticity assistant for ShelfWatch, an anti-counterfeit system for Pakistan's FMCG market.

The FIRST image is a photo just scanned by a user. The SECOND image is the verified reference/genuine product image for "${context.product_name ?? "this product"}" (brand: ${context.brand_name ?? "unknown"}), matched via image similarity search.

Compare the two images and write ONE concise sentence (max 20 words) in English noting any visual discrepancies — logo, font, color, print quality, or batch code format. If they appear consistent, say so factually. Be factual, not alarming. No Urdu.`;

    const model = process.env.GEMINI_VISION_MODEL ?? "gemini-3.1-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), COMPARE_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: scanImage.mimeType, data: scanImage.data } },
              { inline_data: { mime_type: referenceImage.mimeType, data: referenceImage.data } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Translate] Gemini vision comparison returned status ${response.status}`);
      return DEFAULT_COMPARISON_REASON;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return text ? text.trim() : DEFAULT_COMPARISON_REASON;
  } catch (err) {
    console.error("[Translate] compareProductImages failed or timed out:", err);
    return DEFAULT_COMPARISON_REASON;
  }
}
