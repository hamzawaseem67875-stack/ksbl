'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './result.module.css';

interface ProductData {
  name: string;
  brand: string;
  manufacturer: string;
  category: string;
  barcode: string;
  size: string;
  referenceImage: string;
}

interface GeminiData {
  logoMatch: number;
  packagingMatch: number;
  barcodeMatch: number;
  brandMatch: number;
  designMatch: number;
  tampering: boolean;
  confidence: number;
  reason: string;
}

interface VerificationResult {
  scan_id: string;
  status: "Likely Original" | "Needs Manual Review" | "Likely Counterfeit";
  score: number;
  product: ProductData;
  gemini: GeminiData;
  apiSource: "LocalCatalog" | "ScraperMatch" | "UPCItemDB" | "OpenFoodFacts" | "BarcodeLookup" | "none";
  reason: string;
  barcodeDetected: boolean;
}

export default function ResultPage() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('shelfwatch_verify_result');
    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch (err) {
        console.error('Failed to parse verification result from sessionStorage:', err);
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
        body: JSON.stringify({
          scan_id: result.scan_id,
          notes: `Consumer reported verification result. Status: ${result.status}, Score: ${result.score}%, Reason: ${result.reason}`,
        }),
      });
      if (res.ok || res.status === 409) {
        setReported(true);
      }
    } catch (err) {
      console.error('Failed to file user report:', err);
    } finally {
      setReporting(false);
    }
  };

  // Fallbacks if no data is available yet
  const status = result?.status || "Needs Manual Review";
  const score = result?.score !== undefined ? result.score : 75;
  const product = result?.product || {
    name: "Loading Product...",
    brand: "Unknown",
    manufacturer: "Unknown",
    category: "Unknown",
    barcode: "Unknown",
    size: "Unknown",
    referenceImage: "",
  };
  const gemini = result?.gemini || {
    logoMatch: 50,
    packagingMatch: 50,
    barcodeMatch: 50,
    brandMatch: 50,
    designMatch: 50,
    tampering: false,
    confidence: 50,
    reason: "No visual analysis details available.",
  };
  const apiSource = result?.apiSource || "none";
  const apiSourceLabels: Record<string, string> = {
    none: "None (Identified visually by Gemini)",
    LocalCatalog: "ShelfWatch Verified Catalog",
    ScraperMatch: "ShelfWatch Catalog (Image Match)",
    UPCItemDB: "UPCItemDB",
    OpenFoodFacts: "Open Food Facts",
    BarcodeLookup: "BarcodeLookup.com",
  };
  const reason = result?.reason || "Visual inspection could not be verified securely.";

  // Theme styling configurations based on status
  let themeColor = "var(--color-secondary)"; // default amber
  let themeIcon = "warning";
  let statusUrdu = "تفتیش کی ضرورت ہے";
  let statusSub = "Visual discrepancies detected. Manual check recommended.";
  let glowClass = styles.amberGlow;

  if (status === "Likely Original") {
    themeColor = "var(--color-primary)"; // green
    themeIcon = "verified";
    statusUrdu = "✅ اصل مصنوع — تصدیق شدہ";
    statusSub = "This product matches all official manufacturer specifications.";
    glowClass = ""; // will style inline or rely on green colors
  } else if (status === "Likely Counterfeit") {
    themeColor = "var(--color-error)"; // red
    themeIcon = "gpp_maybe";
    statusUrdu = "⚠️ جعلی مصنوع — انتباہ";
    statusSub = "High packaging discrepancy indicates potential counterfeit.";
    glowClass = "";
  }

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
          <div 
            className={styles.pulseAmberBig} 
            style={{ backgroundColor: status === "Likely Original" ? "rgba(70,241,197,0.15)" : status === "Likely Counterfeit" ? "rgba(255,180,171,0.15)" : "var(--color-secondary-container)" }}
          ></div>
          <div className={styles.pulseAmberCenter}></div>
        </div>

        {/* Verdict Header Card */}
        <div 
          className={`${styles.glassCard} ${glowClass} ${styles.headerCard}`}
          style={{ 
            boxShadow: status === "Likely Original" ? "0 0 30px rgba(70,241,197,0.15)" : status === "Likely Counterfeit" ? "0 0 30px rgba(255,180,171,0.15)" : "0 0 30px rgba(238, 152, 0, 0.15)",
            border: `1px solid ${themeColor}30`
          }}
        >
          <div 
            className={styles.warningIconWrapper} 
            style={{ 
              background: `${themeColor}20`,
              borderColor: `${themeColor}40`
            }}
          >
            <span className={`material-symbols-outlined ${styles.warningIcon}`} style={{ color: themeColor }}>
              {themeIcon}
            </span>
          </div>
          <div>
            <h2 className={styles.verdictTitle} style={{ color: themeColor }}>
              {status}
            </h2>
            <p className={styles.verdictSubtitle} style={{ fontWeight: 600, color: themeColor }}>{statusUrdu}</p>
            <p className={styles.verdictSubtitle} style={{ marginTop: '4px' }}>{statusSub}</p>
          </div>
        </div>

        {/* Confidence & Score Section */}
        <div className={`${styles.glassCard} ${styles.confidenceSection}`} style={{ border: `1px solid ${themeColor}20` }}>
          <div className={styles.flexBetween}>
            <span className={styles.labelCaps}>Authenticity Score</span>
            <span className={styles.confidenceValue} style={{ color: themeColor }}>
              {score}%
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div 
              className={styles.progressBarFill} 
              style={{ 
                width: `${score}%`, 
                background: `linear-gradient(to right, ${themeColor}40, ${themeColor})`,
                boxShadow: `0 0 10px ${themeColor}50`
              }}
            ></div>
          </div>
          <p className={styles.analysisNote}>{reason}</p>
        </div>

        {/* Gemini Visual Evaluation Details */}
        <div className={styles.reasonsGrid}>
          {[
            { label: "Logo Accuracy", val: gemini.logoMatch },
            { label: "Brand Fonts", val: gemini.brandMatch },
            { label: "Design Layout", val: gemini.designMatch },
            { label: "Packaging Shell", val: gemini.packagingMatch },
          ].map((item, idx) => (
            <div 
              key={idx} 
              className={styles.reasonChip} 
              style={{ 
                borderLeft: `4px solid ${item.val >= 80 ? 'var(--color-primary)' : item.val >= 50 ? 'var(--color-secondary)' : 'var(--color-error)'}`,
                background: 'rgba(255,255,255,0.02)'
              }}
            >
              <span className={styles.labelCaps} style={{ fontSize: '10px' }}>{item.label}</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{item.val}%</span>
            </div>
          ))}
        </div>

        {/* Product Details Snapshot */}
        <div className={`${styles.glassCard} ${styles.productSnapshot}`}>
          {product.referenceImage && (
            <div 
              className={styles.snapshotImage} 
              style={{ backgroundImage: `url('${product.referenceImage}')`, height: '12rem' }}
            ></div>
          )}
          <div className={styles.snapshotDetails} style={{ width: '100%' }}>
            <div>
              <p className={styles.labelCaps}>Product</p>
              <p className={styles.detailValue}>{product.name}</p>
            </div>
            <div>
              <p className={styles.labelCaps}>Brand</p>
              <p className={styles.detailValue}>{product.brand}</p>
            </div>
            <div>
              <p className={styles.labelCaps}>Manufacturer</p>
              <p className={styles.detailValue}>{product.manufacturer}</p>
            </div>
            <div>
              <p className={styles.labelCaps}>Category</p>
              <p className={styles.detailValue}>{product.category}</p>
            </div>
            <div>
              <p className={styles.labelCaps}>Barcode No.</p>
              <p className={styles.detailValue} style={{ fontFamily: 'monospace' }}>{product.barcode}</p>
            </div>
            <div>
              <p className={styles.labelCaps}>Net Quantity</p>
              <p className={styles.detailValue}>{product.size || "Standard"}</p>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <p className={styles.labelCaps}>API Lookup Source</p>
              <p className={styles.detailValue} style={{ color: 'var(--color-primary)' }}>
                {apiSourceLabels[apiSource] || apiSource}
              </p>
            </div>
          </div>
        </div>

        {/* Action Warning Notice */}
        {status !== "Likely Original" ? (
          <div 
            className={styles.urgentWarning} 
            style={{ 
              background: status === "Likely Counterfeit" ? "rgba(147,0,10,0.2)" : "rgba(238,152,0,0.12)",
              border: status === "Likely Counterfeit" ? "1px solid rgba(255,180,171,0.3)" : "1px solid rgba(255,185,95,0.3)"
            }}
          >
            <span className="material-symbols-outlined" style={{ color: themeColor, marginTop: '2px', fontVariationSettings: "'FILL' 1" }}>
              gpp_maybe
            </span>
            <div>
              <p className={styles.warningTitle} style={{ color: themeColor }}>
                {status === "Likely Counterfeit" ? "Critical Counterfeit Warning" : "Suspicious Anomaly Alert"}
              </p>
              <p className={styles.warningBody}>
                {status === "Likely Counterfeit" 
                  ? "This product shows high discrepancy indicators. Do not consume or sell. Isolate the packaging immediately." 
                  : "Some packaging fonts and logo coordinates deviate from official specs. Manual verification is advised."}
              </p>
            </div>
          </div>
        ) : (
          <div 
            className={styles.urgentWarning} 
            style={{ 
              background: "rgba(70,241,197,0.1)",
              border: "1px solid rgba(70,241,197,0.25)"
            }}
          >
            <span className="material-symbols-outlined" style={{ color: themeColor, marginTop: '2px', fontVariationSettings: "'FILL' 1" }}>
              verified_user
            </span>
            <div>
              <p className={styles.warningTitle} style={{ color: themeColor }}>Product Authenticated</p>
              <p className={styles.warningBody}>The visual profile, packaging design, and barcode verify cleanly against manufacturer reference metrics.</p>
            </div>
          </div>
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
            {reported ? 'Reported!' : reporting ? 'Reporting...' : 'Report Discrepancy'}
          </button>
        </div>
        {result?.scan_id && (
          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-on-surface-variant)', opacity: 0.6, marginTop: '8px' }}>
            Scan ID: {result.scan_id}
          </p>
        )}
      </main>
    </>
  );
}
