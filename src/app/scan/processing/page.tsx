'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getGeolocation } from '@/lib/api';
import styles from './processing.module.css';

interface Step {
  label: string;
  sublabel: string;
  state: 'done' | 'active' | 'pending';
}

const INITIAL_STEPS: Step[] = [
  { label: 'Scanning barcode...', sublabel: 'Extracting digits from image', state: 'active' },
  { label: 'Checking UPCItemDB...', sublabel: 'Querying global database', state: 'pending' },
  { label: 'Checking OpenFoodFacts...', sublabel: 'Querying global database', state: 'pending' },
  { label: 'Checking BarcodeLookup...', sublabel: 'Querying global database', state: 'pending' },
  { label: 'Running Gemini Vision...', sublabel: 'Comparing logo & packaging details', state: 'pending' },
  { label: 'Calculating score...', sublabel: 'Authenticity weight engine', state: 'pending' },
  { label: 'Finalizing...', sublabel: 'Rendering results', state: 'pending' },
];

export default function ScanProcessingPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const requestFired = useRef(false);

  // Helper to convert base64 data URL to a File object
  function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  useEffect(() => {
    if (requestFired.current) return;
    requestFired.current = true;

    const base64Image = sessionStorage.getItem('shelfwatch_captured_image');
    const barcode = sessionStorage.getItem('shelfwatch_captured_barcode') || '';

    // Step state transition timer tracker
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < INITIAL_STEPS.length - 1) {
        setSteps((prevSteps) => {
          const next = [...prevSteps];
          next[stepIndex].state = 'done';
          stepIndex++;
          next[stepIndex].state = 'active';
          return next;
        });
      }
    }, 1200);

    async function runVerification() {
      try {
        const formData = new FormData();

        const geo = await getGeolocation();
        if (geo) {
          formData.append('latitude', geo.latitude.toString());
          formData.append('longitude', geo.longitude.toString());
        }
        
        if (base64Image) {
          const file = dataURLtoFile(base64Image, 'scan.jpg');
          formData.append('capturedImage', file);
        }
        
        if (barcode) {
          formData.append('barcode', barcode);
        }

        const res = await fetch('/api/verify', {
          method: 'POST',
          body: formData,
        });

        clearInterval(interval);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with status ${res.status}`);
        }

        const verificationResult = await res.json();

        // Instantly mark all steps as complete
        setSteps((prevSteps) =>
          prevSteps.map((step) => ({ ...step, state: 'done' }))
        );

        // Store result in sessionStorage for `/scan/result` page to pick up
        sessionStorage.setItem('shelfwatch_verify_result', JSON.stringify(verificationResult));

        // Short timeout for visual completion before routing
        setTimeout(() => {
          router.push('/scan/result');
        }, 500);
      } catch (err) {
        clearInterval(interval);
        console.error('[ScanProcessingPage] Verification failed:', err);
        setError(err instanceof Error ? err.message : 'Internal error during verification');
      }
    }

    runVerification();

    return () => {
      clearInterval(interval);
    };
  }, [router]);

  return (
    <div className={styles.page}>
      <header className={styles.appBar}>
        <h1 className={styles.appBarTitle}>{error ? 'Error' : 'Analyzing...'}</h1>
      </header>

      <main className={styles.main}>
        {error ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--color-error)' }}>
              gpp_maybe
            </span>
            <h2 className={styles.title} style={{ color: 'var(--color-error)', marginTop: '16px' }}>
              Verification Failed
            </h2>
            <p className={styles.subtitle} style={{ marginBottom: '24px' }}>
              {error}
            </p>
            <Link href="/scan" className={styles.title} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 600,
            }}>
              <span className="material-symbols-outlined">arrow_back</span>
              Try Again
            </Link>
          </div>
        ) : (
          <>
            {/* Radar Animation */}
            <div className={styles.radarContainer}>
              <div className={styles.radarRing1}></div>
              <div className={styles.radarRing2}></div>
              <div className={styles.radarRing3}></div>
              <div className={styles.radarSweep}></div>
              <div className={styles.radarCenter}></div>
            </div>

            <h2 className={styles.title}>Analyzing Product</h2>
            <p className={styles.subtitle}>AI verification in progress — please wait</p>

            {/* Scan Steps */}
            <div className={styles.steps}>
              {steps.map((step, i) => (
                <div key={i} className={styles.step}>
                  <div className={styles.stepIndicator}>
                    <div className={
                      step.state === 'done'
                        ? styles.stepDotDone
                        : step.state === 'active'
                        ? styles.stepDotActive
                        : styles.stepDotPending
                    }>
                      {step.state === 'done' && (
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                          check
                        </span>
                      )}
                      {step.state === 'active' && <div className={styles.innerPulse}></div>}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={step.state === 'done' ? styles.stepLineDone : styles.stepLine}></div>
                    )}
                  </div>
                  <div className={styles.stepContent}>
                    <p className={
                      step.state === 'done'
                        ? styles.stepLabelDone
                        : step.state === 'active'
                        ? styles.stepLabelActive
                        : styles.stepLabelPending
                    }>
                      {step.label}
                    </p>
                    <p className={styles.stepSub}>{step.sublabel}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
