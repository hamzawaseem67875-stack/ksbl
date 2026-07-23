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
    url: process.env.DATABASE_URL || fallbackUrl,
  },
});
