/**
 * src/proxy.ts
 *
 * Route gating (Next.js 16 renamed "middleware" to "proxy" — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Runs on the Node.js runtime by default, same as our jose-based sessions.
 *
 * - /scan/**                                                  → requires customer_session
 * - /dashboard, /analytics, /leaderboard, /inventory, /reports → requires admin_session
 *
 * /settings is intentionally NOT gated here: it hosts the admin login form
 * itself (see src/app/(desktop)/settings/page.tsx), so gating it here would
 * make the login screen unreachable once logged out.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  verifySession,
  CUSTOMER_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  type CustomerSessionPayload,
  type AdminSessionPayload,
} from "@/lib/auth";

const ADMIN_PROTECTED_PREFIXES = ["/dashboard", "/analytics", "/leaderboard", "/inventory", "/reports"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/scan")) {
    const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
    const session = token ? await verifySession<CustomerSessionPayload>(token) : null;
    if (!session || session.role !== "customer") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (ADMIN_PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = token ? await verifySession<AdminSessionPayload>(token) : null;
    if (!session || session.role !== "admin") {
      const settingsUrl = new URL("/settings", request.url);
      settingsUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(settingsUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/scan",
    "/scan/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/analytics",
    "/analytics/:path*",
    "/leaderboard",
    "/leaderboard/:path*",
    "/inventory",
    "/inventory/:path*",
    "/reports",
    "/reports/:path*",
  ],
};
