'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './scan.module.css';
import { postScan, getGeolocation, storeScanResult, getScanHistory, ScanHistoryItem, verdictColor } from '@/lib/api';

export default function ScanPage() {
  const router = useRouter();
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch recent scans on mount
  useEffect(() => {
    async function loadHistory() {
      const res = await getScanHistory(3);
      if (res.data) {
        setHistory(res.data);
      }
    }
    loadHistory();
  }, []);

  // Convert captured file to base64 and save to sessionStorage, then navigate to /scan/processing
  const submitScan = async (imageFile: File | null, barcodeVal: string) => {
    setScanning(true);
    setError(null);

    try {
      if (imageFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const base64Data = reader.result as string;
            sessionStorage.setItem('shelfwatch_captured_image', base64Data);
            sessionStorage.setItem('shelfwatch_captured_barcode', barcodeVal || '');
            router.push('/scan/processing');
          } catch (storageErr) {
            console.error('Failed to store base64 image in sessionStorage:', storageErr);
            setError('Image is too large. Please capture/upload a smaller photo.');
            setScanning(false);
          }
        };
        reader.onerror = () => {
          setError('Failed to read image file.');
          setScanning(false);
        };
        reader.readAsDataURL(imageFile);
      } else {
        // Barcode only lookup
        sessionStorage.removeItem('shelfwatch_captured_image');
        sessionStorage.setItem('shelfwatch_captured_barcode', barcodeVal || '');
        router.push('/scan/processing');
      }
    } catch (err) {
      console.error('[ScanPage] Prep failed:', err);
      setError('Something went wrong. Please try again.');
      setScanning(false);
    }
  };

  const handleBarcodeScan = () => {
    if (!barcode.trim()) {
      setError('Please enter a barcode or upload an image.');
      return;
    }
    submitScan(null, barcode.trim());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    submitScan(file, barcode.trim());
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.page}>
      <header className={styles.appBar}>
        <Link href="/" className={styles.backBtn}>
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className={styles.appBarTitle}>Scan Product</h1>
        <button className={styles.helpBtn}>
          <span className="material-symbols-outlined">help_outline</span>
        </button>
      </header>

      <main className={styles.main}>
        {/* Viewfinder — triggers file/camera upload */}
        <div className={styles.viewfinderContainer} onClick={handleCameraClick} style={{ cursor: 'pointer' }}>
          <div className={styles.viewfinder}>
            <div className={styles.cornerTL}></div>
            <div className={styles.cornerTR}></div>
            <div className={styles.cornerBL}></div>
            <div className={styles.cornerBR}></div>
            {!scanning && <div className={styles.scanLine}></div>}
            <div className={styles.viewfinderLabel}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {scanning ? 'progress_activity' : 'photo_camera'}
              </span>
              {scanning ? 'Verifying with AI (may take up to 8s)...' : 'Tap to upload product photo'}
            </div>
          </div>
        </div>

        {/* Hidden file input for camera/gallery */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* Error display */}
        {error && (
          <div style={{
            background: 'rgba(255,80,80,0.12)',
            border: '1px solid rgba(255,80,80,0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            margin: '0 16px',
            color: 'var(--color-error)',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            {error}
          </div>
        )}

        {/* Manual Input */}
        <div className={styles.manualSection}>
          <p className={styles.orDivider}>— or enter barcode manually —</p>
          <div className={styles.inputWrapper}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', fontSize: '20px' }}>barcode</span>
            <input
              className={styles.input}
              placeholder="e.g. 8901030873874"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBarcodeScan()}
              disabled={scanning}
            />
          </div>
          <button
            className={styles.scanBtn}
            onClick={handleBarcodeScan}
            disabled={scanning}
          >
            <span className="material-symbols-outlined">{scanning ? 'progress_activity' : 'search'}</span>
            {scanning ? 'Verifying with AI...' : 'Verify Product'}
          </button>
        </div>

        {/* Recent Scans */}
        <div className={styles.recentSection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Recent Scans</h3>
            <Link href="/scan/history" className={styles.viewAllBtn}>View all</Link>
          </div>
          <div className={styles.recentList}>
            {history.map((s, i) => (
              <div key={i} className={styles.recentItem}>
                <div className={styles.recentDot} style={{ background: verdictColor(s.verdict) }}></div>
                <div className={styles.recentInfo}>
                  <p className={styles.recentName}>{s.product_name || 'Unknown Product'}</p>
                  <p className={styles.recentBatch}>
                    {s.extracted_batch || 'No batch'} · {s.brand_name || 'Unknown Brand'}
                  </p>
                </div>
                <span className={styles.recentStatus} style={{ color: verdictColor(s.verdict) }}>
                  {s.verdict}
                </span>
              </div>
            ))}
            {history.length === 0 && (
              <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', opacity: 0.6, padding: '8px 0' }}>
                No scans recorded yet.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className={styles.bottomNav}>
        <Link href="/" className={styles.navItem}>
          <span className="material-symbols-outlined">home</span>
          <span>Home</span>
        </Link>
        <button className={`${styles.navItem} ${styles.navItemActive}`}>
          <span className="material-symbols-outlined">qr_code_scanner</span>
          <span>Scan</span>
        </button>
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
