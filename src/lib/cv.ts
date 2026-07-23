/**
 * lib/cv.ts
 *
 * Thin wrapper around the Hugging Face Inference API for image
 * anomaly/authenticity scoring.
 *
 * Uses zero-shot image classification: the model scores how well the
 * image matches the labels "genuine packaging" vs "counterfeit packaging".
 * Returns an anomaly_score from 0.0 (genuine) to 1.0 (suspicious).
 *
 * Swap this file to use Replicate or another provider without
 * touching any route logic.
 *
 * Required env vars:
 *   HUGGINGFACE_API_KEY — HF Inference API token
 *   HF_MODEL_ID         — (optional) override model, default: openai/clip-vit-large-patch14
 *
 * Fallback: returns 0.5 (neutral) on error or missing key.
 */

export interface CvResult {
  anomaly_score: number; // 0.0 → genuine, 1.0 → suspicious
  raw: Record<string, unknown>;
}

const DEFAULT_MODEL = "openai/clip-vit-large-patch14";
const LABELS = ["genuine packaging", "counterfeit packaging"];

// ─── Hugging Face ─────────────────────────────────────────────────────────────

async function callHuggingFace(imageUrl: string): Promise<CvResult> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    console.warn("[CV] HUGGINGFACE_API_KEY not set — returning neutral score");
    return { anomaly_score: 0.5, raw: { reason: "no_api_key" } };
  }

  const modelId = process.env.HF_MODEL_ID ?? DEFAULT_MODEL;

  // HF zero-shot image classification with a URL input
  const res = await fetch(
    `https://api-inference.huggingface.co/models/${modelId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: imageUrl,
        parameters: { candidate_labels: LABELS },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace API error ${res.status}: ${err}`);
  }

  // Response shape: [{ label, score }, ...]  sorted by score desc
  const data = (await res.json()) as Array<{ label: string; score: number }>;

  // Find the score for "counterfeit packaging" label → that IS the anomaly_score
  const counterfeitEntry = data.find(
    (d) => d.label.toLowerCase().includes("counterfeit")
  );
  const anomaly_score = counterfeitEntry?.score ?? 0.5;

  return { anomaly_score, raw: { predictions: data } };
}

// ─── Replicate fallback ───────────────────────────────────────────────────────

async function callReplicate(imageUrl: string): Promise<CvResult> {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) {
    return { anomaly_score: 0.5, raw: { reason: "no_replicate_key" } };
  }

  // Using CLIP via Replicate
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version:
        "8fa600c6cde0d1a9065ba7de2c0a4e3f3e8ef62d6c2a95ff2ad4e1e4a7d9f7d9",
      input: {
        image: imageUrl,
        texts: LABELS,
      },
    }),
  });

  if (!res.ok) throw new Error(`Replicate error ${res.status}`);

  // Replicate is async — for MVP we poll once after 3s
  const prediction = (await res.json()) as { id: string };

  await new Promise((r) => setTimeout(r, 3000));

  const pollRes = await fetch(
    `https://api.replicate.com/v1/predictions/${prediction.id}`,
    { headers: { Authorization: `Token ${apiKey}` } }
  );
  const result = (await pollRes.json()) as {
    output?: number[];
    status: string;
  };

  if (result.status !== "succeeded" || !result.output) {
    return { anomaly_score: 0.5, raw: { replicate: result } };
  }

  // output[1] = score for "counterfeit packaging"
  const anomaly_score = result.output[1] ?? 0.5;
  return { anomaly_score, raw: { replicate: result } };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Score a product packaging image for anomalies.
 * Returns anomaly_score 0.0–1.0.
 * Never throws — returns 0.5 (neutral) on any failure.
 */
export async function scorePackaging(imageUrl: string): Promise<CvResult> {
  try {
    if (process.env.HUGGINGFACE_API_KEY) {
      return await callHuggingFace(imageUrl);
    }
    if (process.env.REPLICATE_API_KEY) {
      return await callReplicate(imageUrl);
    }
    console.warn("[CV] No CV API keys configured — returning neutral score 0.5");
    return { anomaly_score: 0.5, raw: { reason: "no_keys_configured" } };
  } catch (err) {
    console.error("[CV] Failed:", err);
    return { anomaly_score: 0.5, raw: { error: String(err) } };
  }
}
