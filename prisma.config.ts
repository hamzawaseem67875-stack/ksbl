/**
 * prisma.config.ts
 *
 * Prisma 7 configuration file.
 * Database connection URLs live here, NOT in schema.prisma.
 *
 * Database: Supabase (project: mrqihziuzirwtvrzzqvc, region: ap-south-1)
 *
 * Fallback to local default URL if DATABASE_URL is not set (e.g. during build-time compilation
 * on serverless providers like Vercel).
 */

import path from "path";
import { defineConfig } from "prisma/config";

const fallbackUrl = "postgresql://postgres:postgres@localhost:5432/shelfwatch";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    // DIRECT_URL (session-mode pooler, port 5432) supports DDL and is what
    // migrate/push/seed need. DATABASE_URL (PgBouncer transaction mode, port
    // 6543) does not support DDL — @prisma/config's Datasource type has no
    // separate directUrl field, so it must be selected here instead.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || fallbackUrl,
  },
});
