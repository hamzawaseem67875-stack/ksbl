/**
 * POST /api/scraper/national-foods
 *
 * Scrapes National Foods product listings (official site + optional
 * e-commerce fallback sources) into the `Product` table, so the RAG-style
 * vector search in lib/vectorSearch.ts has something to match against.
 * Triggered weekly by vercel.json's cron config; can also be triggered
 * manually (see README "National Foods Scraper & Vector Search").
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` — Vercel attaches
 * this header automatically on cron-triggered invocations when CRON_SECRET
 * is set as an env var; the same header works for manual curl triggers.
 * Vercel Cron Jobs trigger via GET, so both GET and POST are wired to the
 * same handler (GET for cron, POST for convenient manual curl -X POST).
 *
 * Sources and CSS selectors are entirely config-driven (see
 * src/config/scrapeSources.national-foods.json, optionally overridden by the
 * SCRAPER_SOURCES_JSON env var) — no site-specific code branches here.
 *
 * Per-item failures are caught and logged, never abort the run. A ScrapeRun
 * row is written at the start and finalized at the end for auditability.
 */

import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";
import crypto from "node:crypto";
import { uploadImage } from "@/lib/blob";
import { isScrapingAllowed } from "@/lib/robots";
import { getImageEmbedding } from "@/lib/embeddings";
import { setProductEmbedding } from "@/lib/vectorSearch";
import defaultConfig from "@/config/scrapeSources.national-foods.json";

export const runtime = "nodejs";
export const maxDuration = 300; // scraping + image upload + embedding across 9 sources can take a few minutes

// ─── Config types ───────────────────────────────────────────────────────────

interface ImageSelector {
  selector: string;
  attr: string;
}

interface SourceSelectors {
  item: string;
  name: string;
  pack_size?: string | null;
  image: ImageSelector;
  price?: string | null;
}

interface SourceConfig {
  id: string;
  url: string;
  enabled: boolean;
  notes?: string;
  selectors: SourceSelectors;
}

interface ScrapeConfig {
  brand_name: string;
  source_tag: string;
  user_agent: string;
  request_delay_ms: number;
  sources: SourceConfig[];
}

function loadConfig(): ScrapeConfig {
  const override = process.env.SCRAPER_SOURCES_JSON;
  if (override) {
    try {
      return JSON.parse(override) as ScrapeConfig;
    } catch (err) {
      console.warn("[Scraper] Failed to parse SCRAPER_SOURCES_JSON, falling back to bundled config:", err);
    }
  }
  return defaultConfig as ScrapeConfig;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deterministic pseudo-SKU for scraped products that have no real barcode.
 * Re-running the scraper against the same product yields the same SKU, so
 * a retry after a partial failure won't create a duplicate row.
 */
function pseudoSku(brand: string, name: string): string {
  const hash = crypto.createHash("sha1").update(`${brand}:${name}`).digest("hex").slice(0, 8).toUpperCase();
  const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-+|-+$)/g, "").slice(0, 24);
  return `NF-SCRAPE-${slug}-${hash}`;
}

interface ScrapedItem {
  name: string;
  pack_size: string | null;
  image_url: string;
  price: number | null;
}

function parseSource(html: string, selectors: SourceSelectors, baseUrl: string): ScrapedItem[] {
  const $ = load(html);
  const items: ScrapedItem[] = [];

  $(selectors.item).each((_, el) => {
    const $el = $(el);
    const name = $el.find(selectors.name).first().text().trim();
    if (!name) return;

    const rawImage = $el.find(selectors.image.selector).first().attr(selectors.image.attr);
    if (!rawImage) return;

    let image_url: string;
    try {
      image_url = new URL(rawImage, baseUrl).toString();
    } catch {
      return;
    }

    const pack_size = selectors.pack_size
      ? $el.find(selectors.pack_size).first().text().trim() || null
      : null;

    let price: number | null = null;
    if (selectors.price) {
      const priceText = $el.find(selectors.price).first().text().trim();
      const match = priceText.match(/[\d,]+(\.\d+)?/);
      if (match) price = Number(match[0].replace(/,/g, ""));
    }

    items.push({ name, pack_size, image_url, price });
  });

  return items;
}

type ErrorLogEntry = { source: string; item?: string; error: string };

async function createScrapeRun(supabaseUrl: string, serviceKey: string, source: string): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/ScrapeRun`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ source, status: "running" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.id ?? null;
  } catch (err) {
    console.error("[Scraper] Failed to create ScrapeRun row:", err);
    return null;
  }
}

async function finishScrapeRun(
  supabaseUrl: string,
  serviceKey: string,
  runId: string | null,
  patch: Record<string, unknown>
): Promise<void> {
  if (!runId) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/ScrapeRun?id=eq.${runId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...patch, finished_at: new Date().toISOString() }),
    });
  } catch (err) {
    console.error("[Scraper] Failed to finalize ScrapeRun row:", err);
  }
}

async function findExistingProduct(
  supabaseUrl: string,
  serviceKey: string,
  brand: string,
  name: string
): Promise<{ id: string } | null> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/Product?brand_name=eq.${encodeURIComponent(brand)}&product_name=eq.${encodeURIComponent(name)}&select=id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] ?? null;
  } catch (err) {
    console.error("[Scraper] findExistingProduct failed:", err);
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return handleScrape(req);
}

export async function POST(req: NextRequest) {
  return handleScrape(req);
}

async function handleScrape(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase service-role configuration missing" }, { status: 500 });
  }

  const config = loadConfig();
  const runId = await createScrapeRun(supabaseUrl, serviceKey, config.source_tag);

  let found = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errorLog: ErrorLogEntry[] = [];

  const enabledSources = config.sources.filter((s) => s.enabled);
  skipped = config.sources.length - enabledSources.length;

  for (const source of enabledSources) {
    try {
      const allowed = await isScrapingAllowed(source.url, config.user_agent);
      if (!allowed) {
        errorLog.push({ source: source.id, error: "Disallowed by robots.txt" });
        continue;
      }

      await sleep(config.request_delay_ms);

      const res = await fetch(source.url, { headers: { "User-Agent": config.user_agent } });
      if (!res.ok) {
        errorLog.push({ source: source.id, error: `Listing page fetch failed with status ${res.status}` });
        continue;
      }

      const html = await res.text();
      const items = parseSource(html, source.selectors, source.url);
      found += items.length;

      for (const item of items) {
        try {
          const existing = await findExistingProduct(supabaseUrl, serviceKey, config.brand_name, item.name);

          const imageRes = await fetch(item.image_url);
          if (!imageRes.ok) throw new Error(`Image fetch failed with status ${imageRes.status}`);
          const imageBlob = await imageRes.blob();
          const sku = pseudoSku(config.brand_name, item.name);
          const filename = `national-foods/${sku}.jpg`;
          const uploadedUrl = await uploadImage(filename, imageBlob);

          const sharedFields = {
            brand_name: config.brand_name,
            product_name: item.name,
            pack_size: item.pack_size,
            reference_image_url: uploadedUrl,
            avg_unit_price_pkr: item.price ?? 0,
            source: config.source_tag,
            last_scraped_at: new Date().toISOString(),
          };

          let productId: string | undefined;

          if (existing) {
            await fetch(`${supabaseUrl}/rest/v1/Product?id=eq.${existing.id}`, {
              method: "PATCH",
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(sharedFields),
            });
            productId = existing.id;
            updated++;
          } else {
            const createRes = await fetch(`${supabaseUrl}/rest/v1/Product`, {
              method: "POST",
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({
                sku,
                // The site provides no real batch-code data; verifyProduct.ts's
                // computeVerdict() skips batch-pattern matching entirely for
                // products identified via vector image match, so this fallback
                // pattern is never actually evaluated for scraped rows.
                reference_batch_pattern: "^XP-[0-9]{3}-KHI",
                status: "active",
                ...sharedFields,
              }),
            });
            if (!createRes.ok) {
              throw new Error(`Product insert failed (${createRes.status}): ${await createRes.text()}`);
            }
            const createdData = await createRes.json();
            productId = createdData?.[0]?.id;
            created++;
          }

          if (productId) {
            const embedding = await getImageEmbedding(uploadedUrl);
            if (embedding) {
              await setProductEmbedding(productId, embedding);
            }
          }
        } catch (itemErr) {
          failed++;
          errorLog.push({ source: source.id, item: item.name, error: String(itemErr) });
          console.error(`[Scraper] Failed to process item "${item.name}" from ${source.id}:`, itemErr);
        }
      }
    } catch (sourceErr) {
      errorLog.push({ source: source.id, error: String(sourceErr) });
      console.error(`[Scraper] Failed to process source ${source.id}:`, sourceErr);
    }
  }

  const status = failed === 0 ? "success" : created + updated > 0 ? "partial_failure" : "failed";

  await finishScrapeRun(supabaseUrl, serviceKey, runId, {
    status,
    products_found: found,
    products_created: created,
    products_updated: updated,
    products_failed: failed,
    error_log: errorLog,
  });

  return NextResponse.json({
    run_id: runId,
    status,
    sources_enabled: enabledSources.length,
    sources_skipped: skipped,
    products_found: found,
    products_created: created,
    products_updated: updated,
    products_failed: failed,
    errors: errorLog,
  });
}
