import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
  }

  try {
    // 1. Fetch scan first to find product_id
    const scanRes = await fetch(`${supabaseUrl}/rest/v1/Scan?id=eq.${id}&select=*,product:Product(brand_name),brand_name`, {
      headers: { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` }
    });

    if (!scanRes.ok) {
      return NextResponse.json({ error: "Failed to fetch scan details" }, { status: 500 });
    }

    const scans = await scanRes.json();
    if (!scans || scans.length === 0) {
      return NextResponse.json({ error: "Scan/incident not found" }, { status: 404 });
    }

    const s = scans[0];

    // If there is an associated product, update its status to 'flagged' in the database
    if (s.product_id) {
      const prodPatchRes = await fetch(`${supabaseUrl}/rest/v1/Product?id=eq.${s.product_id}`, {
        method: "PATCH",
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "flagged" })
      });
      if (!prodPatchRes.ok) {
        console.error("[Flag incident] Failed to patch product status:", prodPatchRes.status);
      }
    }

    // 2. Check if a report exists for this scan/incident ID
    const findRes = await fetch(`${supabaseUrl}/rest/v1/Report?scan_id=eq.${id}`, {
      headers: { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` }
    });

    if (!findRes.ok) {
      return NextResponse.json({ error: "Failed to query incident reports" }, { status: 500 });
    }

    const reports = await findRes.json();

    if (reports && reports.length > 0) {
      // Update existing report's status to 'investigating'
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/Report?scan_id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "investigating" })
      });

      if (!updateRes.ok) {
        return NextResponse.json({ error: "Failed to update incident report status" }, { status: 500 });
      }
    } else {
      const brandName = s.product?.brand_name ?? s.brand_name;

      if (!brandName) {
        return NextResponse.json({ error: "Cannot flag: no brand associated with this scan" }, { status: 400 });
      }

      // Find brand ID
      const brandRes = await fetch(`${supabaseUrl}/rest/v1/Brand?name=eq.${encodeURIComponent(brandName)}`, {
        headers: { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` }
      });

      if (!brandRes.ok) {
        return NextResponse.json({ error: "Failed to locate brand" }, { status: 500 });
      }

      const brands = await brandRes.json();
      if (!brands || brands.length === 0) {
        return NextResponse.json({ error: "Brand owner not registered in local directory" }, { status: 400 });
      }

      // Create new report row
      const createRes = await fetch(`${supabaseUrl}/rest/v1/Report`, {
        method: "POST",
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          scan_id: id,
          brand_id: brands[0].id,
          status: "investigating",
          notes: "Flagged by operator for manual field investigation."
        })
      });

      if (!createRes.ok) {
        return NextResponse.json({ error: "Failed to create incident report row" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, status: "investigating" });
  } catch (err) {
    console.error("Flag incident error:", err);
    return NextResponse.json({ error: "Failed to flag incident" }, { status: 500 });
  }
}
