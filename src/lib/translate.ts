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
