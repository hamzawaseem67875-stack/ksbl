/**
 * services/upcItemDb.ts
 *
 * Calls UPCItemDB API to retrieve product reference data.
 */

import { UnifiedProduct } from "./cacheService";

export async function lookupUPCItemDB(barcode: string): Promise<UnifiedProduct | null> {
  const apiKey = process.env.UPCITEMDB_API_KEY;
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;

  try {
    console.log(`[UPCItemDB] Looking up barcode: ${barcode}`);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    if (apiKey) {
      headers["user_key"] = apiKey;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      console.warn(`[UPCItemDB] API responded with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.code === "OK" && data.total > 0 && data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        name: item.title || "",
        brand: item.brand || "",
        manufacturer: item.publisher || item.brand || "", // upcitemdb doesn't have direct manufacturer, fall back to brand/publisher
        category: item.category || "",
        barcode: item.ean || item.upc || barcode,
        size: item.size || "",
        referenceImage: item.images?.[0] || "",
      };
    }

    console.log(`[UPCItemDB] No products found for barcode: ${barcode}`);
    return null;
  } catch (err) {
    console.error("[UPCItemDB] Request failed:", err);
    return null;
  }
}
