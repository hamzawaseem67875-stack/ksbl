-- ─────────────────────────────────────────────────────────────────────────────
-- Manual schema patch — RUN THIS FIRST, before prisma/sql/pgvector_setup.sql
--
-- Normally these changes come from `npx prisma db push` (schema.prisma is the
-- source of truth). This file exists as a fallback for running the same
-- changes directly in the Supabase SQL Editor, for cases where the CLI can't
-- reach the database (pooler/DDL connectivity issues) but the SQL Editor can.
--
-- If you later get `prisma db push` working against this database, running it
-- is idempotent against this file's changes (IF NOT EXISTS everywhere) — no
-- conflict either way.
--
-- IMPORTANT: writes in this app go through the Supabase REST API (PostgREST),
-- not Prisma Client — so Prisma's `@default(cuid())` on the "id" column NEVER
-- actually fires at the database level (cuid() is a Prisma Client-side
-- behavior, not a Postgres default). The new "ScrapeRun" table below is given
-- an explicit `DEFAULT gen_random_uuid()::text` so REST inserts that omit
-- "id" (as src/app/api/scraper/national-foods/route.ts does) still work.
-- gen_random_uuid() is built into Postgres 13+ (Supabase's Postgres qualifies
-- — no extra extension needed).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Product: new columns ────────────────────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pack_size" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "last_scraped_at" timestamp(3);
-- "embedding" (vector(512)) is added by pgvector_setup.sql, which also creates
-- the "vector" extension this column type depends on — run that file next.

CREATE INDEX IF NOT EXISTS "Product_source_idx" ON "Product"("source");

-- ── ScrapeRun: new table + enum ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ScrapeRunStatus" AS ENUM ('running', 'success', 'partial_failure', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ScrapeRun" (
  "id"               text NOT NULL DEFAULT gen_random_uuid()::text,
  "source"           text NOT NULL,
  "status"           "ScrapeRunStatus" NOT NULL DEFAULT 'running',
  "products_found"   integer NOT NULL DEFAULT 0,
  "products_created" integer NOT NULL DEFAULT 0,
  "products_updated" integer NOT NULL DEFAULT 0,
  "products_failed"  integer NOT NULL DEFAULT 0,
  "error_log"        jsonb,
  "started_at"       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at"      timestamp(3),
  CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScrapeRun_source_idx" ON "ScrapeRun"("source");
CREATE INDEX IF NOT EXISTS "ScrapeRun_status_idx" ON "ScrapeRun"("status");

-- ── Sanity check: confirm whether Product/Scan/Report already have a DB-level
-- id default (they should, for existing REST-insert routes like
-- /api/products, /api/scan to have ever worked) — if this returns no rows /
-- null, those routes have been relying on Postgres allowing a NULL then
-- erroring, which would mean they're currently broken too. Worth a look:
--
-- select table_name, column_name, column_default
-- from information_schema.columns
-- where table_name in ('Product', 'Scan', 'Report') and column_name = 'id';
