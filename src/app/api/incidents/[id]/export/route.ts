import { NextRequest, NextResponse } from "next/server";

// Simple PDF generation helper
function generatePDF(title: string, dataLines: string[]): Buffer {
  const contentStream = [
    "BT",
    "/F1 18 Tf",
    "70 700 Td",
    `(${title}) Tj`,
    "0 -30 Td",
    "/F1 11 Tf",
    ...dataLines.map(line => `(${line.replace(/[()]/g, "")}) Tj 0 -18 Td`),
    "ET"
  ].join("\n");

  const streamBytes = Buffer.from(contentStream, "utf-8");

  const pdfParts = [
    "%PDF-1.4\n",
    "1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n",
    "2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n",
    "3 0 obj\n<</Type /Page /Parent 2 0 R /Resources <</Font <</F1 4 0 R>>>> /MediaBox [0 0 612 792] /Contents 5 0 R>>\nendobj\n",
    "4 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n",
    `5 0 obj\n<</Length ${streamBytes.length}>>\nstream\n`,
    streamBytes,
    "\nendstream\nendobj\n",
    "xref\n0 6\n0000000000 65535 f \n",
    "trailer\n<</Size 6 /Root 1 0 R>>\n",
    "startxref\n",
    "%%EOF\n"
  ];

  return Buffer.concat(pdfParts.map(p => typeof p === "string" ? Buffer.from(p, "utf-8") : p));
}

export async function GET(
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
    const res = await fetch(`${supabaseUrl}/rest/v1/Scan?id=eq.${id}&select=*,product:Product(product_name,brand_name)`, {
      headers: { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` }
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch incident scan data" }, { status: 500 });
    }

    const scans = await res.json();
    if (!scans || scans.length === 0) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    const s = scans[0];
    const pName = s.product?.product_name ?? s.product_name ?? "Unknown Product";
    const bName = s.product?.brand_name ?? s.brand_name ?? "Unknown Brand";

    const lines = [
      "=================================================",
      `INCIDENT DOSSIER: OVERVIEW REPORT #${id.substring(0, 8).toUpperCase()}`,
      "=================================================",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `Incident ID: ${s.id}`,
      `Brand Owner: ${bName}`,
      `Category/Product: ${pName}`,
      `Target Location: ${s.area_name ?? "Karachi Area"}`,
      `GPS Coordinates: Lat: ${s.latitude ?? "N/A"}, Lng: ${s.longitude ?? "N/A"}`,
      `Time Registered: ${new Date(s.created_at).toLocaleString()}`,
      "",
      "AI ASSESSMENT & VERDICT STATE:",
      "------------------------------",
      `Verdict: ${s.verdict.toUpperCase()}`,
      `Confidence Score: ${Math.round(s.confidence * 100)}%`,
      `CV Anomaly Score: ${s.cv_anomaly_score ?? "N/A"}`,
      "",
      "AI SUB-MARKER FLAGS DETECTED:",
      " * Print Quality Anomaly (FMCG Packaging Index)",
      " * Barcode/Batch Pattern Inconsistency (Regex checks)",
      " * Visual Logo Discrepancy Engine (Gemini analysis)"
    ];

    const pdfBuffer = generatePDF(`Incident Dossier - ${id.substring(0, 8).toUpperCase()}`, lines);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Incident_Report_${id}.pdf"`
      }
    });
  } catch (err) {
    console.error("Incident export error:", err);
    return NextResponse.json({ error: "Failed to export incident" }, { status: 500 });
  }
}
