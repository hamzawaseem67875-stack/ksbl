/**
 * services/barcodeScanner.ts
 *
 * Extracts/reads a barcode from a captured image using Gemini Vision API.
 */

export async function scanBarcodeFromImage(
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[BarcodeScanner] GEMINI_API_KEY is not configured. Skipping scanning.");
    return null;
  }

  try {
    const prompt = `You are a professional barcode reader. Extract the numerical barcode (EAN-13, UPC-A, Code 128, etc.) visible in this product packaging image.
Return the digits of the barcode ONLY (e.g. 8901030873874).
If no barcode is visible, legible, or present, return 'null' only.
Do not output any other words, markdown, or text.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[BarcodeScanner] Gemini returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    console.log(`[BarcodeScanner] Gemini raw output: "${resultText}"`);

    if (!resultText || resultText.toLowerCase() === "null") {
      return null;
    }

    // Clean up any extra whitespace/characters
    const cleanDigits = resultText.replace(/\D/g, "");
    return cleanDigits.length >= 8 ? cleanDigits : null;
  } catch (err) {
    console.error("[BarcodeScanner] Failed to scan barcode from image:", err);
    return null;
  }
}
