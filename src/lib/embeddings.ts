/**
 * lib/embeddings.ts
 *
 * Generates CLIP image embeddings for RAG-style vector similarity search.
 *
 * This is deliberately separate from lib/cv.ts: cv.ts calls HF's
 * zero-shot-image-classification pipeline (returns label scores), while this
 * calls the feature-extraction pipeline on the same family of CLIP models
 * (returns a raw embedding vector). Different HF pipeline, different output
 * shape, same provider/auth.
 *
 * Required env vars:
 *   HUGGINGFACE_API_KEY — shared with lib/cv.ts
 *   EMBED_MODEL_ID       — (optional) override model, default: openai/clip-vit-base-patch32
 *   EMBEDDING_DIM         — (optional) must match the model's output dimension
 *                            AND the "vector(N)" column size in prisma/sql/pgvector_setup.sql
 *
 * Fallback: returns null on error, missing key, or timeout. Never throws.
 * Callers must treat null as "no embedding available" and fall back gracefully.
 */

const DEFAULT_EMBED_MODEL = "openai/clip-vit-base-patch32";
const DEFAULT_EMBEDDING_DIM = 512;
const EMBED_TIMEOUT_MS = 6000;

export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM) || DEFAULT_EMBEDDING_DIM;

/**
 * HF feature-extraction can return a flat vector (number[]) or a nested
 * per-token/per-patch matrix (number[][]) depending on the model. Mean-pool
 * the nested case down to a single vector.
 */
function normalizeEmbedding(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  if (typeof raw[0] === "number") {
    return raw as number[];
  }

  if (Array.isArray(raw[0])) {
    const rows = raw as number[][];
    const dim = rows[0].length;
    const pooled = new Array(dim).fill(0);
    for (const row of rows) {
      for (let i = 0; i < dim; i++) pooled[i] += row[i] ?? 0;
    }
    return pooled.map((v) => v / rows.length);
  }

  return null;
}

/**
 * Generate a CLIP image embedding for a (publicly reachable) image URL.
 * Returns null on any failure — never throws.
 */
export async function getImageEmbedding(imageUrl: string): Promise<number[] | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    console.warn("[Embeddings] HUGGINGFACE_API_KEY not set — skipping embedding generation");
    return null;
  }

  const modelId = process.env.EMBED_MODEL_ID ?? DEFAULT_EMBED_MODEL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

    const res = await fetch(
      `https://api-inference.huggingface.co/models/${modelId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: imageUrl }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Embeddings] HuggingFace feature-extraction returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const embedding = normalizeEmbedding(data);

    if (!embedding) {
      console.warn("[Embeddings] Unexpected feature-extraction response shape");
      return null;
    }

    return embedding;
  } catch (err) {
    console.error("[Embeddings] getImageEmbedding failed:", err);
    return null;
  }
}
