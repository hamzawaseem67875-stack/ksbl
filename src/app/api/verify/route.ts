/**
 * POST /api/verify
 *
 * Real product authenticity verification endpoint.
 * Runs barcode scanner (Gemini fallback), queries external DB APIs (UPCItemDB, Open Food Facts, Barcode Lookup),
 * performs side-by-side Gemini visual comparison, calculates authenticity score, and returns structured data.
 */

import { NextRequest, NextResponse } from "next/server";

// Bypass self-signed SSL/TLS certificate chain checks for Postgres database globally in this context
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { scanBarcodeFromImage } from "@/services/barcodeScanner";
import { lookupUPCItemDB } from "@/services/upcItemDb";
import { lookupOpenFoodFacts } from "@/services/openFoodFacts";
import { lookupBarcodeLookup } from "@/services/barcodeLookup";
import { compareImagesWithGemini } from "@/services/geminiVision";
import { runComparisonEngine } from "@/services/comparisonEngine";
import { calculateAuthenticityScore } from "@/services/scoreEngine";
import { getCachedProduct, setCachedProduct, UnifiedProduct } from "@/services/cacheService";
import { uploadImage } from "@/lib/blob";
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ShelfWatch/1.0 (contact: support@shelfwatch.local)"
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const area = addr.neighbourhood || addr.suburb || addr.city_district || addr.road || addr.county || addr.city || "Unknown Location";
        return area;
      }
    }
  } catch (err) {
    console.error("[VerifyAPI] Reverse geocoding error:", err);
  }

  // Fallback boundary match for Karachi coordinates
  const KARACHI_AREAS = [
    { name: "Korangi Industrial Area", lat: 24.8338, lng: 67.1035 },
    { name: "Liaquatabad", lat: 24.9158, lng: 67.0431 },
    { name: "SITE Area", lat: 24.9087, lng: 66.9989 },
    { name: "Orangi Town", lat: 24.9495, lng: 67.0142 },
    { name: "Clifton", lat: 24.8138, lng: 67.0336 },
    { name: "Gulshan-e-Iqbal", lat: 24.9180, lng: 67.0970 },
    { name: "Saddar", lat: 24.8608, lng: 67.0104 }
  ];

  let bestArea = KARACHI_AREAS[0].name;
  let minDist = Infinity;
  for (const a of KARACHI_AREAS) {
    const dist = Math.hypot(a.lat - lat, a.lng - lng);
    if (dist < minDist) {
      minDist = dist;
      bestArea = a.name;
    }
  }
  return bestArea;
}

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid request format — expected multipart/form-data" },
        { status: 400 }
      );
    }

    // 1. Read input image and barcode
    const imageFile = formData.get("capturedImage") || formData.get("image");
    let barcode = formData.get("barcode") as string | null;

    if (!imageFile || typeof imageFile === "string") {
      return NextResponse.json(
        { error: "Missing required parameter: capturedImage (File)" },
        { status: 400 }
      );
    }

    // Convert file to base64 for scanning and Gemini Vision
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString("base64");
    const mimeType = imageFile.type || "image/jpeg";

    // 2. Barcode Scanning Fallback (if not passed directly)
    if (!barcode || barcode.trim() === "") {
      console.log("[VerifyAPI] No barcode provided in request. Running visual scanner...");
      barcode = await scanBarcodeFromImage(imageBase64, mimeType);
      console.log(`[VerifyAPI] Visual scanner result: ${barcode}`);
    }

    // 3. Database Lookup & Fallbacks (only if barcode exists)
    let product: UnifiedProduct | null = null;
    let apiSource: "UPCItemDB" | "OpenFoodFacts" | "BarcodeLookup" | "none" = "none";

    if (barcode) {
      const cleanBarcode = barcode.trim();

      // Check Cache Service (24 hours)
      const cached = await getCachedProduct(cleanBarcode);
      if (cached) {
        product = cached;
        apiSource = "UPCItemDB"; // Map cached to source or use generic cache indication
      } else {
        // Step 3.1: UPCItemDB
        product = await lookupUPCItemDB(cleanBarcode);
        if (product) {
          apiSource = "UPCItemDB";
        } else {
          // Step 3.2: Open Food Facts
          product = await lookupOpenFoodFacts(cleanBarcode);
          if (product) {
            apiSource = "OpenFoodFacts";
          } else {
            // Step 3.3: Barcode Lookup
            product = await lookupBarcodeLookup(cleanBarcode);
            if (product) {
              apiSource = "BarcodeLookup";
            }
          }
        }

        // Cache successful response
        if (product) {
          await setCachedProduct(cleanBarcode, product);
        }
      }
    }

    // 4. Gemini Vision Packaging Verification
    console.log("[VerifyAPI] Running Gemini Vision Comparison...");
    const gemini = await compareImagesWithGemini(imageBase64, product, mimeType);

    // 5. Comparison Engine Match Verification
    const comparison = runComparisonEngine(barcode, product, gemini);

    // 6. Calculate authenticity score
    const scoring = calculateAuthenticityScore(comparison);

    // If no barcode was detected, reduce final score to reflect missing validation
    let finalScore = scoring.score;
    if (!barcode) {
      // Missing barcode validation penalty (already partially capped by 0 barcodeMatch score in formula,
      // let's ensure it stays below 70 as per instruction rule "automatically reduce final confidence/score")
      finalScore = Math.min(finalScore, 65);
    }

    // Status Rules:
    // 90-100 -> "Likely Original"
    // 70-89 -> "Needs Manual Review"
    // Below 70 -> "Likely Counterfeit"
    let status: "Likely Original" | "Needs Manual Review" | "Likely Counterfeit";
    if (finalScore >= 90) {
      status = "Likely Original";
    } else if (finalScore >= 70) {
      status = "Needs Manual Review";
    } else {
      status = "Likely Counterfeit";
    }

    // Upload image to get public URL for database scan history
    const filename = `scan-${Date.now()}.jpg`;
    let imageUrl: string;
    try {
      imageUrl = await uploadImage(filename, imageFile);
    } catch (err) {
      console.error("[VerifyAPI] Image upload failed:", err);
      imageUrl = `https://placeholder.shelfwatch.pk/scan/${filename}`;
    }

    // Write scan record to DB so it shows up in history!
    let dbProductId: string | null = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (barcode && supabaseUrl && anonKey) {
      try {
        const prodRes = await fetch(`${supabaseUrl}/rest/v1/Product?sku=eq.${barcode.trim()}`, {
          method: "GET",
          headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`
          }
        });
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData && prodData.length > 0) {
            dbProductId = prodData[0].id;
          }
        }
      } catch (err) {
        console.error("[VerifyAPI] Failed to fetch product via REST:", err);
      }
    }

    let dbVerdict: "genuine" | "suspicious" | "unverified" = "unverified";
    if (finalScore > 70) {
      dbVerdict = "genuine";
    } else if (finalScore < 40) {
      dbVerdict = "suspicious";
    } else {
      dbVerdict = "unverified";
    }

    const KARACHI_AREAS = [
      { name: "Korangi Industrial Area", lat: 24.8338, lng: 67.1035 },
      { name: "Liaquatabad", lat: 24.9158, lng: 67.0431 },
      { name: "SITE Area", lat: 24.9087, lng: 66.9989 },
      { name: "Orangi Town", lat: 24.9495, lng: 67.0142 },
      { name: "Clifton", lat: 24.8138, lng: 67.0336 },
      { name: "Gulshan-e-Iqbal", lat: 24.9180, lng: 67.0970 },
      { name: "Saddar", lat: 24.8608, lng: 67.0104 }
    ];
    const randomArea = KARACHI_AREAS[Math.floor(Math.random() * KARACHI_AREAS.length)];
    const scanLat = formData.get("latitude") ? parseFloat(formData.get("latitude") as string) : randomArea.lat;
    const scanLng = formData.get("longitude") ? parseFloat(formData.get("longitude") as string) : randomArea.lng;
    let scanArea = formData.get("area_name") as string | null;
    if (!scanArea) {
      scanArea = await reverseGeocode(scanLat, scanLng);
    }

    let scanId = "scan-" + Date.now();
    if (supabaseUrl && anonKey) {
      try {
        const scanRes = await fetch(`${supabaseUrl}/rest/v1/Scan`, {
          method: "POST",
          headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            product_id: dbProductId,
            product_name: product?.name || null,
            brand_name: product?.brand || null,
            scanned_by_role: (formData.get("role") as any) || "consumer",
            image_url: imageUrl,
            extracted_batch: gemini.tampering ? "Tampered" : "Standard Batch",
            extracted_mfg_date: new Date().toLocaleDateString(),
            extracted_mrp: null,
            ocr_raw_json: {},
            cv_anomaly_score: (100 - gemini.packagingMatch) / 100,
            verdict: dbVerdict,
            confidence: finalScore / 100,
            latitude: scanLat,
            longitude: scanLng,
            area_name: scanArea,
          })
        });
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          if (scanData && scanData.length > 0) {
            scanId = scanData[0].id;
          }
        } else {
          const errText = await scanRes.text();
          console.error("[VerifyAPI] Scan REST creation failed:", scanRes.status, errText);
        }
      } catch (dbErr) {
        console.error("[VerifyAPI] Failed to write scan record to DB via REST:", dbErr);
      }
    }

    // Return structured payload
    const responsePayload = {
      scan_id: scanId,
      status,
      score: finalScore,
      product: product ? {
        name: product.name,
        brand: product.brand,
        manufacturer: product.manufacturer,
        category: product.category,
        barcode: product.barcode,
        size: product.size,
        referenceImage: product.referenceImage,
      } : {
        name: "Unregistered Product",
        brand: "Unknown",
        manufacturer: "Unknown",
        category: "Unknown",
        barcode: barcode || "None Detected",
        size: "Unknown",
        referenceImage: "",
      },
      gemini: {
        logoMatch: gemini.logoMatch,
        packagingMatch: gemini.packagingMatch,
        barcodeMatch: gemini.barcodeMatch,
        brandMatch: gemini.brandMatch,
        designMatch: gemini.designMatch,
        tampering: gemini.tampering,
        confidence: gemini.confidence,
        reason: gemini.reason,
      },
      apiSource,
      reason: gemini.reason,
      barcodeDetected: !!barcode,
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err) {
    console.error("[VerifyAPI] Unhandled error:", err);
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = 'c:/Users/Sonu computers/Desktop/kxbl/verify_debug.log';
      const logMsg = `[${new Date().toISOString()}] Error: ${err instanceof Error ? err.stack : String(err)}\n\n`;
      fs.appendFileSync(logPath, logMsg);
    } catch (logErr) {
      console.error("Failed to write to verify_debug.log:", logErr);
    }
    return NextResponse.json(
      { error: `Internal server error during verification processing: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
