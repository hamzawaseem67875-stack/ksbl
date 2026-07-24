/**
 * POST /api/report
 *
 * Consumer-initiated one-tap suspicious report.
 * Ties a new Report record to an existing Scan.
 * Must be called after a scan has already been created via /api/scan.
 *
 * Request (JSON):
 *   { scan_id: string, notes?: string }
 *
 * Response 201:
 *   { report_id, scan_id, status }
 *
 * Response 409:
 *   Already reported — returns existing report
 *
 * Response 404:
 *   Scan not found
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  scan_id: z.string().min(1, "scan_id is required"),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { scan_id, notes } = parsed.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Supabase configuration is missing on server" },
      { status: 500 }
    );
  }

  try {
    // 1. Verify scan exists
    const scanRes = await fetch(`${supabaseUrl}/rest/v1/Scan?id=eq.${scan_id}`, {
      method: "GET",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });

    if (!scanRes.ok) {
      return NextResponse.json({ error: "Failed to verify scan existence" }, { status: 500 });
    }

    const scanData = await scanRes.json();
    if (!scanData || scanData.length === 0) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const scan = scanData[0];

    // 2. Check for duplicate report
    const existingRes = await fetch(`${supabaseUrl}/rest/v1/Report?scan_id=eq.${scan_id}`, {
      method: "GET",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });

    if (existingRes.ok) {
      const existingData = await existingRes.json();
      if (existingData && existingData.length > 0) {
        const existing = existingData[0];
        return NextResponse.json(
          { report_id: existing.id, scan_id, status: existing.status, already_reported: true },
          { status: 409 }
        );
      }
    }

    // 3. Find associated product (if any) to fetch brand name
    let brand_name: string | null = null;
    if (scan.product_id) {
      const prodRes = await fetch(`${supabaseUrl}/rest/v1/Product?id=eq.${scan.product_id}`, {
        method: "GET",
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`
        }
      });
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        if (prodData && prodData.length > 0) {
          brand_name = prodData[0].brand_name;
        }
      }
    }

    // 4. Find brand ID
    let brand_id: string | null = null;
    if (brand_name) {
      const brandRes = await fetch(`${supabaseUrl}/rest/v1/Brand?name=eq.${encodeURIComponent(brand_name)}`, {
        method: "GET",
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`
        }
      });
      if (brandRes.ok) {
        const brandData = await brandRes.json();
        if (brandData && brandData.length > 0) {
          brand_id = brandData[0].id;
        }
      }
    }

    // Fallback brand
    if (!brand_id) {
      const fallbackRes = await fetch(`${supabaseUrl}/rest/v1/Brand?limit=1`, {
        method: "GET",
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`
        }
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (fallbackData && fallbackData.length > 0) {
          brand_id = fallbackData[0].id;
        }
      }
    }

    if (!brand_id) {
      return NextResponse.json(
        { error: "No brand found to associate this report — seed brand data first" },
        { status: 422 }
      );
    }

    // 5. Create Report
    const createRes = await fetch(`${supabaseUrl}/rest/v1/Report`, {
      method: "POST",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        scan_id,
        brand_id,
        status: "pending",
        notes: notes ?? null,
      }),
    });

    if (!createRes.ok) {
      const createErr = await createRes.text();
      console.error("[ReportAPI] Create Report failed:", createRes.status, createErr);
      return NextResponse.json({ error: "Failed to create report record" }, { status: 500 });
    }

    const reportData = await createRes.json();
    const report = reportData[0];

    return NextResponse.json(
      { report_id: report.id, scan_id, status: report.status },
      { status: 201 }
    );
  } catch (err) {
    console.error("[ReportAPI] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error during report processing" },
      { status: 500 }
    );
  }
}
