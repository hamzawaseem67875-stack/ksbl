'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './processing.module.css';

const steps = [
  { label: 'Barcode Decoded', sublabel: 'Code 128 format', state: 'done' },
  { label: 'Cross-referencing Database', sublabel: '24M+ products indexed', state: 'active' },
  { label: 'Generating Report', sublabel: 'AI confidence scoring', state: 'pending' },
];

export default function ScanProcessingPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/scan/result');
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className={styles.page}>
      <header className={styles.appBar}>
        <h1 className={styles.appBarTitle}>Analyzing...</h1>
      </header>

      <main className={styles.main}>
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
                <div className={step.state === 'done' ? styles.stepDotDone : step.state === 'active' ? styles.stepDotActive : styles.stepDotPending}>
                  {step.state === 'done' && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                  {step.state === 'active' && <div className={styles.innerPulse}></div>}
                </div>
                {i < steps.length - 1 && <div className={step.state === 'done' ? styles.stepLineDone : styles.stepLine}></div>}
              </div>
              <div className={styles.stepContent}>
                <p className={step.state === 'done' ? styles.stepLabelDone : step.state === 'active' ? styles.stepLabelActive : styles.stepLabelPending}>
                  {step.label}
                </p>
                <p className={styles.stepSub}>{step.sublabel}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
