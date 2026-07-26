/**
 * services/barcodeScanner.ts
 *
 * Extracts/reads a barcode from a captured image using Gemini Vision API.
 */

/**
 * Validates the EAN-13/UPC-A check digit (standard GS1 algorithm). A vision
 * model "reading" printed digits (rather than decoding the actual barcode
 * bar pattern) will occasionally misread a single digit — that produces a
 * number that looks plausible but fails checksum, which then wastes external
 * API lookups searching for a barcode that was never real. Formats other
 * than 12/13 digits (EAN-8, Code 128, etc.) aren't checked here and pass
 * through as-is.
 */
function isValidEanChecksum(digits: string): boolean {
  if (digits.length !== 12 && digits.length !== 13) return true;
  const padded = digits.length === 12 ? `0${digits}` : digits;
  const checkDigit = Number(padded[12]);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(padded[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}

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
    if (cleanDigits.length < 8) return null;

    if (!isValidEanChecksum(cleanDigits)) {
      console.warn(
        `[BarcodeScanner] Gemini read "${cleanDigits}" but it fails EAN/UPC checksum validation — ` +
        `likely a misread digit from the photo. Discarding rather than searching for a barcode that isn't real.`
      );
      return null;
    }

    return cleanDigits;
  } catch (err) {
    console.error("[BarcodeScanner] Failed to scan barcode from image:", err);
    return null;
  }
}
