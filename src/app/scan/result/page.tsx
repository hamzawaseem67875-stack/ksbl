'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './result.module.css';

interface ScanResult {
  scan_id: string;
  verdict: string;
  confidence: number;
  reason: string;
  urdu_text: string;
  english_text: string;
  extracted_batch: string | null;
  extracted_mfg_date: string | null;
  extracted_mrp: string | null;
  brand_name: string | null;
  product_name: string | null;
  cv_anomaly_score: number | null;
}

export default function SuspiciousResultPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('shelfwatch_scan_result');
    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch {
        // ignore parse errors — fall through to demo data
      }
    }
  }, []);

  const handleReport = async () => {
    if (!result?.scan_id || reported) return;
    setReporting(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_id: result.scan_id, notes: 'Reported by consumer via ShelfWatch app' }),
      });
      if (res.ok || res.status === 409) {
        setReported(true);
      }
    } catch {
      // silent — UI still shows reported=false so they can retry
    } finally {
      setReporting(false);
    }
  };

  // Demo fallback when no live result is available
  const confidence = result ? Math.round(result.confidence * 100) : 73;
  const batch = result?.extracted_batch ?? 'XP-992-BLR';
  const brand = result?.brand_name ?? 'Unknown Brand';
  const reason = result?.reason ?? 'Analysis indicates several irregularities compared to official brand assets.';
  const urduText = result?.urdu_text ?? '⚠️ مشکوک — یہ مصنوع جعلی ہو سکتی ہے';

  return (
    <>
      <header className={styles.appBar}>
        <h1 className={styles.logo}>ShelfWatch</h1>
        <div className={styles.appBarActions}>
          <button className={`material-symbols-outlined ${styles.iconButton}`}>language</button>
          <button className={`material-symbols-outlined ${styles.iconButton}`}>account_circle</button>
        </div>
      </header>

      <main className={styles.container}>
        <div className={styles.ambientGlowContainer}>
          <div className={styles.pulseAmberBig}></div>
          <div className={styles.pulseAmberCenter}></div>
        </div>

        {/* Verdict Header Card */}
        <div className={`${styles.glassCard} ${styles.amberGlow} ${styles.headerCard}`}>
          <div className={styles.warningIconWrapper}>
            <span className={`material-symbols-outlined ${styles.warningIcon}`}>warning</span>
          </div>
          <div>
            <h2 className={styles.verdictTitle}>Suspicious / مشکوک</h2>
            <p className={styles.verdictSubtitle}>{urduText}</p>
          </div>
        </div>

        {/* Confidence Section */}
        <div className={`${styles.glassCard} ${styles.confidenceSection}`}>
          <div className={styles.flexBetween}>
            <span className={styles.labelCaps}>Confidence Score</span>
            <span className={styles.confidenceValue}>{confidence}%</span>
          </div>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} style={{ width: `${confidence}%` }}></div>
          </div>
          <p className={styles.analysisNote}>{reason}</p>
        </div>

        {/* Product Details Snapshot */}
        <div className={`${styles.glassCard} ${styles.productSnapshot}`}>
          <div className={styles.snapshotDetails} style={{ width: '100%' }}>
            <div>
              <p className={styles.labelCaps}>Brand</p>
              <p className={styles.detailValue}>{brand}</p>
            </div>
            {result?.product_name && (
              <div>
                <p className={styles.labelCaps}>Product</p>
                <p className={styles.detailValue}>{result.product_name}</p>
              </div>
            )}
            <div>
              <p className={styles.labelCaps}>Batch ID</p>
              <p className={styles.detailValue}>{batch}</p>
            </div>
            {result?.extracted_mfg_date && (
              <div>
                <p className={styles.labelCaps}>Mfg Date</p>
                <p className={styles.detailValue}>{result.extracted_mfg_date}</p>
              </div>
            )}
            {result?.extracted_mrp && (
              <div>
                <p className={styles.labelCaps}>MRP</p>
                <p className={styles.detailValue}>Rs. {result.extracted_mrp}</p>
              </div>
            )}
          </div>
        </div>

        {/* Urgent Warning */}
        <div className={styles.urgentWarning}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-error)', marginTop: '2px', fontVariationSettings: "'FILL' 1" }}>gpp_maybe</span>
          <div>
            <p className={styles.warningTitle}>Critical Action Required</p>
            <p className={styles.warningBody}>Do not sell this product. Keep it isolated and immediately report the incident to the brand protection department.</p>
          </div>
        </div>

        {/* Scan ID reference */}
        {result?.scan_id && (
          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>
            Scan ID: {result.scan_id}
          </p>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <Link href="/scan" className={styles.scanAgainBtn}>
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Scan Another
          </Link>
          <button
            className={styles.reportBtn}
            onClick={handleReport}
            disabled={reporting || reported}
            style={{ opacity: reported ? 0.6 : 1 }}
          >
            <span className="material-symbols-outlined">{reported ? 'check_circle' : 'report'}</span>
            {reported ? 'Reported!' : reporting ? 'Reporting...' : 'Report Incident'}
          </button>
        </div>
      </main>
    </>
  );
}
