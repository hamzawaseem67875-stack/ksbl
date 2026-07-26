/**
 * GET /api/leaderboard
 *
 * Admin-only. Returns every customer (User) ordered by score_points
 * descending — the DB does the sort via ?order=score_points.desc so the
 * ranking is always fresh on every request, never a stale client-side sort.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession, ADMIN_SESSION_COOKIE, type AdminSessionPayload } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifySession<AdminSessionPayload>(token) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Supabase configuration is missing on server" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/User?select=id,name,email,score_points&order=score_points.desc`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[GET /api/leaderboard] Supabase REST call failed:", res.status, errText);
      return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
    }

    const users = await res.json();
    return NextResponse.json(users, { status: 200 });
  } catch (err) {
    console.error("[GET /api/leaderboard] Failed:", err);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
