/**
 * services/openFoodFacts.ts
 *
 * Calls Open Food Facts API to retrieve product reference data.
 */

import { UnifiedProduct } from "./cacheService";

export async function lookupOpenFoodFacts(barcode: string): Promise<UnifiedProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

  try {
    console.log(`[OpenFoodFacts] Looking up barcode: ${barcode}`);
    console.log(`[OpenFoodFacts] Fetching URL: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        // Standard user-agent policy requested by Open Food Facts to prevent throttling
        "User-Agent": "ShelfWatch - Hackathon Authenticity Checker - Version 1.0",
      },
    });

    // Clone response to read raw response text without consuming the main stream
    const responseClone = response.clone();
    const rawResponseText = await responseClone.text();
    console.log(`[OpenFoodFacts] Raw response from server: ${rawResponseText}`);

    if (!response.ok) {
      console.warn(`[OpenFoodFacts] API responded with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      return {
        name: p.product_name || p.product_name_en || "",
        brand: p.brands || "",
        manufacturer: p.manufacturers || p.brands || "",
        category: p.categories || "",
        barcode: p.code || barcode,
        size: p.quantity || "",
        referenceImage: p.image_front_url || p.image_url || "",
      };
    }

    console.log(`[OpenFoodFacts] No products found for barcode: ${barcode}`);
    return null;
  } catch (err) {
    console.error("[OpenFoodFacts] Request failed:", err);
    return null;
  }
}
