'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import styles from './home.module.css';

export default function HomePage() {
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    const target = 24891;
    const duration = 2000;
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      setScanCount(Math.floor(progress * target));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.page}>
      {/* Animated background */}
      <div className={styles.bgGradient}></div>
      <div className={styles.bgOrb1}></div>
      <div className={styles.bgOrb2}></div>
      <div className={styles.bgOrb3}></div>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className="material-symbols-outlined">shield</span>
          ShelfWatch
        </div>
        <nav className={styles.nav}>
          <Link href="/login" className={styles.loginBtn}>Agent Login</Link>
        </nav>
      </header>

      {/* Hero */}
      <main className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_awesome</span>
          AI-Powered Brand Protection
        </div>
        <h1 className={styles.heroTitle}>
          Protecting Pakistan's<br />
          <span className={styles.heroAccent}>Market Integrity</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Instant barcode scanning to verify product authenticity. Built for field agents and consumers alike — in English and Urdu.
        </p>
        <p className={styles.heroUrdu}>پاکستانی مارکیٹ میں مصنوعات کی صداقت فوری طور پر تصدیق کریں</p>

        <div className={styles.heroCta}>
          <Link href="/scan" className={styles.primaryBtn}>
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Start Scanning
          </Link>
          <Link href="/login" className={styles.secondaryBtn}>
            <span className="material-symbols-outlined">security</span>
            Agent Portal
          </Link>
        </div>

        {/* Stats Row */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{scanCount.toLocaleString()}</span>
            <span className={styles.statLabel}>Scans Today</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue} style={{ color: 'var(--color-error)' }}>1,247</span>
            <span className={styles.statLabel}>Fakes Caught</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>98.6%</span>
            <span className={styles.statLabel}>Accuracy</span>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className={styles.features}>
        {[
          { icon: 'qr_code_scanner', title: 'Barcode & QR Scan', desc: 'Scan any product barcode in seconds with your phone camera.', color: 'var(--color-primary)' },
          { icon: 'analytics', title: 'AI Verification', desc: 'Machine learning trained on millions of genuine products.', color: 'var(--color-secondary)' },
          { icon: 'shield', title: 'Real-time Alerts', desc: 'Instant counterfeit detection with audit trail logging.', color: 'var(--color-error)' },
          { icon: 'translate', title: 'Bilingual UI', desc: 'Full English and Urdu support for all users.', color: 'var(--color-primary)' },
        ].map((f, i) => (
          <div key={i} className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ color: f.color, background: f.color + '15' }}>
              <span className="material-symbols-outlined">{f.icon}</span>
            </div>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureDesc}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* CTA Banner */}
      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaTitle}>Ready to verify a product?</h2>
        <p className={styles.ctaDesc}>Point your camera at any product barcode to get an instant authenticity report.</p>
        <Link href="/scan" className={styles.primaryBtn} style={{ display: 'inline-flex' }}>
          <span className="material-symbols-outlined">qr_code_scanner</span>
          Scan Now — It's Free
        </Link>
      </section>

      <footer className={styles.footer}>
        <p>© 2026 ShelfWatch AI · Protecting Pakistan's Markets</p>
      </footer>
    </div>
  );
}
