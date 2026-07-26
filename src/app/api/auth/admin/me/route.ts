import { NextRequest, NextResponse } from "next/server";
import { verifySession, ADMIN_SESSION_COOKIE, type AdminSessionPayload } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifySession<AdminSessionPayload>(token) : null;

  if (!session || session.role !== "admin") {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  return NextResponse.json({ authenticated: true, email: session.email }, { status: 200 });
}
