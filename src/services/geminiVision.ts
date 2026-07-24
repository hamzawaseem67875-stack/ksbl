/**
 * services/geminiVision.ts
 *
 * Compares user captured image and database reference data/image using Gemini 2.5 Flash.
 */

import { UnifiedProduct } from "./cacheService";

export interface GeminiComparisonResult {
  logoMatch: number;
  packagingMatch: number;
  barcodeMatch: number;
  brandMatch: number;
  designMatch: number;
  tampering: boolean;
  confidence: number;
  reason: string;
}

const DEFAULT_FALLBACK_RESULT: GeminiComparisonResult = {
  logoMatch: 50,
  packagingMatch: 50,
  barcodeMatch: 50,
  brandMatch: 50,
  designMatch: 50,
  tampering: false,
  confidence: 40,
  reason: "Failed to verify packaging visual details securely. Falling back to safe default analysis.",
};

// Helper to download an image from a URL and convert it to a base64 string
async function fetchImageBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  if (!url || !url.startsWith("http")) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return {
      data: buffer.toString("base64"),
      mimeType,
    };
  } catch (err) {
    console.warn(`[GeminiVision] Failed to fetch reference image base64 from ${url}:`, err);
    return null;
  }
}

export async function compareImagesWithGemini(
  capturedImageBase64: string,
  productInfo: UnifiedProduct | null,
  capturedMimeType = "image/jpeg"
): Promise<GeminiComparisonResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[GeminiVision] GEMINI_API_KEY is not configured. Returning fallback.");
    return DEFAULT_FALLBACK_RESULT;
  }

  try {
    console.log("[GeminiVision] Starting Gemini visual comparison...");

    // Gather reference info
    const productName = productInfo?.name || "Unknown Product";
    const productBrand = productInfo?.brand || "Unknown Brand";
    const productManufacturer = productInfo?.manufacturer || "Unknown Manufacturer";
    const productCategory = productInfo?.category || "Unknown Category";
    const productBarcode = productInfo?.barcode || "Unknown Barcode";
    const productSize = productInfo?.size || "Unknown Size";
    const referenceImageURL = productInfo?.referenceImage || "";

    // Download the reference image if it exists to pass it to Gemini side-by-side
    const referenceImage = await fetchImageBase64(referenceImageURL);

    // Build the query prompt
    const prompt = `You are a product authenticity inspection expert. Your job is to compare a user's captured product photo with official product reference details.

Official Reference Details:
- Name: ${productName}
- Brand: ${productBrand}
- Manufacturer: ${productManufacturer}
- Category: ${productCategory}
- Barcode: ${productBarcode}
- Size/Weight: ${productSize}

Inspect the captured image and evaluate the following:
1. Logo Match: Check if the logo matches the official brand design (shapes, colors, details).
2. Packaging Match: Check if the packaging colors, warnings, fonts, and materials match.
3. Barcode Match: Check if the barcode on the packaging matches the reference barcode (${productBarcode}).
4. Brand Match: Check if the brand name and trademarks are spelled correctly and placed accurately.
5. Design Match: Check if print alignments, labels, seals, and overall packaging design elements are correct.
6. Tampering: Look for signs of tampering, broken seals, cuts, or fake glue.
7. Expiry & Print Quality: Assess whether the print quality is sharp/legible or blurry/low-quality (a common sign of counterfeit).

Respond with a raw JSON object ONLY. Do not wrap the JSON in markdown code blocks (like \`\`\`json ... \`\`\`), do not output any extra comments or text.

Required JSON Structure:
{
  "logoMatch": 95,
  "packagingMatch": 91,
  "barcodeMatch": 100,
  "brandMatch": 100,
  "designMatch": 89,
  "tampering": false,
  "confidence": 94,
  "reason": "Write a concise explanation of the verdict, highlighting any typography or printing anomalies."
}

Note: If no official reference data/image is available (unregistered product), compare the captured product photo against generic industry standards for authentic packaging for that brand and calculate matches accordingly, but reduce your confidence score (set confidence below 70).

Normalise all numeric scores to a scale of 0 to 100.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    // Prepare content parts
    const parts: any[] = [];

    // Add captured image
    parts.push({
      inlineData: {
        mimeType: capturedMimeType,
        data: capturedImageBase64,
      },
    });

    // Add reference image side-by-side if successfully downloaded
    if (referenceImage) {
      console.log("[GeminiVision] Reference image downloaded successfully. Passing side-by-side.");
      parts.push({
        inlineData: {
          mimeType: referenceImage.mimeType,
          data: referenceImage.data,
        },
      });
    }

    // Add prompt text
    parts.push({
      text: prompt,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
        // Force JSON response if possible
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[GeminiVision] API returned status ${response.status}`);
      return DEFAULT_FALLBACK_RESULT;
    }

    const responseData = await response.json();
    const responseText = responseData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    console.log("[GeminiVision] Raw analysis response received.");

    // Parse the JSON securely
    let cleanJsonStr = responseText;
    // Strip markdown code block wrappers if Gemini ignored the prompt instruction
    if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    try {
      const parsed = JSON.parse(cleanJsonStr);
      // Validate structure and map fields
      return {
        logoMatch: Number(parsed.logoMatch) ?? 50,
        packagingMatch: Number(parsed.packagingMatch) ?? 50,
        barcodeMatch: Number(parsed.barcodeMatch) ?? 50,
        brandMatch: Number(parsed.brandMatch) ?? 50,
        designMatch: Number(parsed.designMatch) ?? 50,
        tampering: Boolean(parsed.tampering) ?? false,
        confidence: Number(parsed.confidence) ?? 50,
        reason: parsed.reason || "Verification completed.",
      };
    } catch (parseErr) {
      console.error("[GeminiVision] Failed to parse response text as JSON:", cleanJsonStr, parseErr);
      return DEFAULT_FALLBACK_RESULT;
    }
  } catch (err) {
    console.error("[GeminiVision] Failed to execute visual comparison:", err);
    return DEFAULT_FALLBACK_RESULT;
  }
}
