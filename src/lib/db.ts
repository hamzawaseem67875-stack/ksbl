/**
 * lib/db.ts
 *
 * Singleton Prisma client for serverless environments.
 * Reuses the client across hot-reloads in dev, and across
 * invocations within the same Lambda container in production.
 *
 * Prisma 7 requires an explicit driver adapter (like `@prisma/adapter-pg`)
 * to connect to PostgreSQL databases.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Fallback mock connection string to prevent constructor validation failure at build/compile time
const fallbackDbUrl = "postgresql://postgres:postgres@localhost:5432/shelfwatch";
const connectionUrl = process.env.DATABASE_URL || fallbackDbUrl;

// Create pg connection pool
const pool = new Pool({
  connectionString: connectionUrl,
  // Add a connection timeout to fail fast
  connectionTimeoutMillis: 5000,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
