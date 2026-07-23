/**
 * lib/translate.ts
 *
 * Fixed-glossary verdict phrasing in Urdu and English.
 *
 * Strategy: the verdict enum (genuine | suspicious | unverified) maps
 * to a pre-approved bilingual phrase pair. Claude is optionally called
 * to generate a one-sentence contextual reason — but the verdict text
 * itself is NEVER free-translated; it comes from the lookup table only.
 * This prevents hallucinated or offensive Urdu output.
 *
 * Required env vars (optional — fallback works without any):
 *   ANTHROPIC_API_KEY — Claude API key for reason generation
 *
 * Swap this file to use Gemini or another provider by updating
 * callClaude() below without touching route logic.
 */

import Anthropic from "@anthropic-ai/sdk";

// ─── Fixed glossary ───────────────────────────────────────────────────────────

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

// ─── Claude reason generation ────────────────────────────────────────────────

async function callClaude(
  verdict: VerdictKey,
  context: {
    batch?: string | null;
    anomaly_score?: number | null;
    brand_name?: string | null;
  }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return getDefaultReason(verdict, context);

  try {
    const client = new Anthropic({ apiKey });

    const prompt = `You are a product authenticity assistant for ShelfWatch, an anti-counterfeit system for Pakistan's FMCG market.

A product scan returned verdict: "${verdict}"
Batch number detected: ${context.batch ?? "N/A"}
Packaging anomaly score (0=genuine, 1=suspicious): ${context.anomaly_score?.toFixed(2) ?? "N/A"}
Brand: ${context.brand_name ?? "Unknown"}

Write ONE concise sentence (max 20 words) in English explaining the reason for this verdict. Be factual, not alarming. No Urdu.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type === "text") return content.text.trim();
    return getDefaultReason(verdict, context);
  } catch (err) {
    console.error("[Translate] Claude call failed:", err);
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
  const reason = await callClaude(verdict, context);

  return {
    urdu_text: phrase.urdu,
    english_text: phrase.english,
    reason,
  };
}

/**
 * Synchronous fallback — returns glossary text without Claude.
 * Use when you need an instant response and can't await.
 */
export function getVerdictTextSync(verdict: VerdictKey): Omit<VerdictText, "reason"> {
  return {
    urdu_text: GLOSSARY[verdict].urdu,
    english_text: GLOSSARY[verdict].english,
  };
}
