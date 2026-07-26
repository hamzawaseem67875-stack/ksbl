/**
 * POST /api/auth/admin/login
 *
 * Checks the submitted credentials against ADMIN_EMAIL / ADMIN_PASSWORD_HASH
 * env vars and, on success, sets the "admin_session" httpOnly cookie.
 * There is a single admin account for this app (see .env.local).
 *
 * Request (application/json): { email, password }
 * Response 200: { ok: true, email }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/auth";

const AdminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminPasswordHash) {
    return NextResponse.json(
      { error: "Admin login is not configured on the server" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AdminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 422 });
  }
  const { email, password } = parsed.data;

  const emailMatches = email.toLowerCase() === adminEmail.trim().toLowerCase();
  const passwordMatches = emailMatches && (await bcrypt.compare(password, adminPasswordHash));

  if (!emailMatches || !passwordMatches) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signAdminSession({ email: adminEmail });
  const res = NextResponse.json({ ok: true, email: adminEmail });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
