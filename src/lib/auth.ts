/**
 * src/lib/auth.ts
 *
 * Session signing/verification for the two auth roles in ShelfWatch:
 *  - "customer_session" — consumers who sign up / log in to scan products
 *  - "admin_session"    — the single admin account gated on /settings
 *
 * Sessions are stateless signed JWTs (jose, HS256) stored in httpOnly cookies.
 * Used by proxy.ts (route gating) and the API routes under src/app/api/auth/.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const CUSTOMER_SESSION_COOKIE = "customer_session";
export const ADMIN_SESSION_COOKIE = "admin_session";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.warn(
    "[auth] SESSION_SECRET is not set — using an insecure fallback. Set SESSION_SECRET in .env.local."
  );
}
const secretKey = new TextEncoder().encode(
  SESSION_SECRET || "dev-insecure-secret-change-me-shelfwatch"
);

export interface CustomerSessionPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: "customer";
}

export interface AdminSessionPayload extends JWTPayload {
  email: string;
  role: "admin";
}

export async function signCustomerSession(payload: {
  sub: string;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT({ ...payload, role: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function signAdminSession(payload: { email: string }): Promise<string> {
  return new SignJWT({ ...payload, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey);
}

export async function verifySession<T extends JWTPayload = JWTPayload>(
  token: string
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}
