/**
 * services/scoreEngine.ts
 *
 * Calculates the final authenticity score based on weighted comparisons.
 */

import { VerificationPayload } from "./comparisonEngine";

export interface ScoreOutput {
  score: number; // 0 - 100
  barcodeScore: number;
  brandScore: number;
  packagingScore: number;
  confidenceScore: number;
}

export function calculateAuthenticityScore(payload: VerificationPayload): ScoreOutput {
  // 1. Barcode Match (40% weight)
  // If barcode matched exactly, EAN/UPC verification passes (100).
  // Otherwise, if no barcode is detected or they do not match, it is 0.
  const barcodeScore = payload.barcodeMatched ? 100 : 0;

  // 2. Brand Match (20% weight)
  // Extract normalized value from Gemini evaluation (0 - 100)
  const brandScore = Math.max(0, Math.min(100, payload.geminiAnalysis.brandMatch || 0));

  // 3. Packaging Match (20% weight)
  // Extract normalized value from Gemini evaluation (0 - 100)
  const packagingScore = Math.max(0, Math.min(100, payload.geminiAnalysis.packagingMatch || 0));

  // 4. Gemini Confidence (20% weight)
  // Extract normalized value from Gemini evaluation (0 - 100)
  const confidenceScore = Math.max(0, Math.min(100, payload.geminiAnalysis.confidence || 0));

  // Formula:
  // score = (barcodeMatch * 0.40) + (brandMatch * 0.20) + (packagingMatch * 0.20) + (geminiConfidence * 0.20)
  const finalScore =
    barcodeScore * 0.40 +
    brandScore * 0.20 +
    packagingScore * 0.20 +
    confidenceScore * 0.20;

  return {
    score: Math.round(finalScore),
    barcodeScore,
    brandScore,
    packagingScore,
    confidenceScore,
  };
}
