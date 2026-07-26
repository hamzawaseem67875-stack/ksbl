/**
 * src/lib/customer.ts
 *
 * Helpers shared by the scan endpoints (/api/verify, /api/scan) for reading
 * the logged-in customer's id off the request cookie and updating their
 * scorecard. Follows the app's existing pattern of talking to Postgres via
 * direct Supabase REST calls rather than Prisma Client at runtime.
 */

import type { NextRequest } from "next/server";
import { verifySession, CUSTOMER_SESSION_COOKIE, type CustomerSessionPayload } from "./auth";

export async function getCustomerIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession<CustomerSessionPayload>(token);
  if (!session || session.role !== "customer") return null;
  return session.sub;
}

/**
 * Read-then-write increment — not atomic under concurrent scans from the same
 * customer, which is an acceptable tradeoff here since PostgREST has no
 * built-in atomic increment without a custom RPC function.
 */
export async function incrementCustomerScore(customerId: string, amount: number): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return;

  try {
    const getRes = await fetch(
      `${supabaseUrl}/rest/v1/User?id=eq.${encodeURIComponent(customerId)}&select=score_points`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    );
    if (!getRes.ok) return;
    const rows = await getRes.json();
    const current = rows?.[0]?.score_points ?? 0;

    await fetch(`${supabaseUrl}/rest/v1/User?id=eq.${encodeURIComponent(customerId)}`, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ score_points: current + amount }),
    });
  } catch (err) {
    console.error("[incrementCustomerScore] Failed to update score_points:", err);
  }
}
