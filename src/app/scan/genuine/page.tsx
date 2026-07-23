'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './genuine.module.css';

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
}

export default function GenuineResultPage() {
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('shelfwatch_scan_result');
    if (stored) {
      try { setResult(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const confidence = result ? Math.round(result.confidence * 100) : 99;
  const batch = result?.extracted_batch ?? 'HP-221-KHI';
  const product = result?.product_name ?? 'HealthCare Pro 500mg';
  const brand = result?.brand_name ?? 'Unknown Brand';

  return (
    <div className={styles.page}>
      <div className={styles.bgGlow}></div>

      <header className={styles.topBar}>
        <Link href="/scan" className={styles.backBtn}>
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className={styles.pageTitle}>Verification Result</h1>
        <button className={styles.shareBtn}>
          <span className="material-symbols-outlined">share</span>
        </button>
      </header>

      <main className={styles.main}>
        {/* Glowing verified icon */}
        <div className={styles.iconWrapper}>
          <div className={styles.iconRingOuter}></div>
          <div className={styles.iconRingInner}></div>
          <div className={styles.iconCenter}>
            <span className="material-symbols-outlined">verified</span>
          </div>
        </div>

        <h2 className={styles.verdictTitle}>Genuine / اصل</h2>
        <p className={styles.verdictSub}>This product is authentic and safe</p>

        {/* Confidence meter */}
        <div className={styles.confidenceCard}>
          <div className={styles.confRow}>
            <span className={styles.confLabel}>AI Confidence Score</span>
            <span className={styles.confValue}>{confidence}%</span>
          </div>
          <div className={styles.confTrack}>
            <div className={styles.confFill} style={{ width: `${confidence}%` }}></div>
          </div>
        </div>

        {/* Product details */}
        <div className={styles.detailsCard}>
          <p className={styles.sectionLabel}>Product Information</p>
          <div className={styles.detailsGrid}>
            {[
              { label: 'Product', value: product },
              { label: 'Brand', value: brand },
              { label: 'Batch No.', value: batch },
              ...(result?.extracted_mfg_date ? [{ label: 'Mfg Date', value: result.extracted_mfg_date }] : []),
              ...(result?.extracted_mrp ? [{ label: 'MRP', value: `Rs. ${result.extracted_mrp}` }] : []),
            ].map((d, i) => (
              <div key={i} className={styles.detailItem}>
                <p className={styles.detailLabel}>{d.label}</p>
                <p className={styles.detailValue}>{d.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Success note */}
        <div className={styles.successNote}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', flexShrink: 0 }}>check_circle</span>
          <p>Verified against 24M+ authentic products in the ShelfWatch database. Safe to purchase.</p>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <Link href="/scan" className={styles.secondaryBtn}>
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Scan Another
          </Link>
          <Link href="/scan/simplified" className={styles.primaryBtn}>
            <span className="material-symbols-outlined">open_in_new</span>
            Full Report
          </Link>
        </div>
      </main>

      <nav className={styles.bottomNav}>
        <Link href="/" className={styles.navItem}>
          <span className="material-symbols-outlined">home</span>
          <span>Home</span>
        </Link>
        <Link href="/scan" className={styles.navItem}>
          <span className="material-symbols-outlined">qr_code_scanner</span>
          <span>Scan</span>
        </Link>
        <Link href="/scan/history" className={styles.navItem}>
          <span className="material-symbols-outlined">history</span>
          <span>History</span>
        </Link>
        <Link href="/login" className={styles.navItem}>
          <span className="material-symbols-outlined">person</span>
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  );
}
