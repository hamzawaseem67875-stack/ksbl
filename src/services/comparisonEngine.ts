/**
 * services/comparisonEngine.ts
 *
 * Merges API lookup data, Gemini Vision JSON results, and exact barcode validation.
 */

import { UnifiedProduct } from "./cacheService";
import { GeminiComparisonResult } from "./geminiVision";

export interface VerificationPayload {
  barcodeDetected: boolean;
  scannedBarcode: string | null;
  referenceBarcode: string | null;
  barcodeMatched: boolean;
  apiProductData: UnifiedProduct | null;
  geminiAnalysis: GeminiComparisonResult;
}

export function runComparisonEngine(
  scannedBarcode: string | null,
  apiProductData: UnifiedProduct | null,
  geminiAnalysis: GeminiComparisonResult
): VerificationPayload {
  const barcodeDetected = !!scannedBarcode;
  
  const referenceBarcode = apiProductData?.barcode || null;
  
  // Barcode validation: does the scanned barcode match the reference barcode exactly?
  const barcodeMatched = barcodeDetected && !!referenceBarcode && 
    scannedBarcode.trim() === referenceBarcode.trim();

  return {
    barcodeDetected,
    scannedBarcode,
    referenceBarcode,
    barcodeMatched,
    apiProductData,
    geminiAnalysis,
  };
}
