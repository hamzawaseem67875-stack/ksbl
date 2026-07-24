/**
 * services/barcodeLookup.ts
 *
 * Calls Barcode Lookup API to retrieve product reference data.
 */

import { UnifiedProduct } from "./cacheService";

export async function lookupBarcodeLookup(barcode: string): Promise<UnifiedProduct | null> {
  const apiKey = process.env.BARCODELOOKUP_API_KEY;
  if (!apiKey) {
    console.warn("[BarcodeLookup] BARCODELOOKUP_API_KEY is not configured. Skipping lookup.");
    return null;
  }

  const url = `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&key=${apiKey}`;

  try {
    console.log(`[BarcodeLookup] Looking up barcode: ${barcode}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[BarcodeLookup] API responded with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.products && data.products.length > 0) {
      const p = data.products[0];
      return {
        name: p.title || "",
        brand: p.brand || "",
        manufacturer: p.manufacturer || p.brand || "",
        category: p.category || "",
        barcode: p.barcode_number || barcode,
        size: p.size || "",
        referenceImage: p.images?.[0] || "",
      };
    }

    console.log(`[BarcodeLookup] No products found for barcode: ${barcode}`);
    return null;
  } catch (err) {
    console.error("[BarcodeLookup] Request failed:", err);
    return null;
  }
}
