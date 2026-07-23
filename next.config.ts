import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Prisma Client to work correctly inside Next.js App Router
  // serverless functions on Vercel. Prisma's native query engine binary must
  // not be bundled by Next.js — it needs to be loaded externally at runtime.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
