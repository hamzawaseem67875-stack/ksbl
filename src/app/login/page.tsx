'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // Simulate auth delay
    await new Promise(r => setTimeout(r, 1500));
    if (email && password) {
      router.push('/dashboard');
    } else {
      setError('Please enter your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bgOrb1}></div>
      <div className={styles.bgOrb2}></div>

      <div className={styles.container}>
        <div className={styles.leftPanel}>
          <div className={styles.logoMark}>
            <span className="material-symbols-outlined">shield</span>
          </div>
          <h1 className={styles.brandName}>ShelfWatch</h1>
          <p className={styles.brandTagline}>AI Brand Protection Platform</p>
          <div className={styles.trustRow}>
            {['24,891 Scans Today', '1,247 Fakes Caught', '98.6% Accuracy'].map((s, i) => (
              <div key={i} className={styles.trustPill}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>verified</span>
                {s}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.loginCard}>
          <h2 className={styles.cardTitle}>Brand Agent Login</h2>
          <p className={styles.cardSubtitle}>Sign in to access the field intelligence portal</p>

          {error && (
            <div className={styles.errorBanner}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>Email Address</label>
              <div className={styles.inputWrapper}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>mail</span>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="agent@brand.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <a href="#" className={styles.forgotLink}>Forgot password?</a>
              </div>
              <div className={styles.inputWrapper}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <>
                  <span className={`material-symbols-outlined ${styles.spinIcon}`}>progress_activity</span>
                  Verifying...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">login</span>
                  Sign In to Portal
                </>
              )}
            </button>
          </form>

          <div className={styles.divider}><span>or</span></div>

          <button className={styles.consumerBtn} onClick={() => router.push('/scan')}>
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Continue as Consumer — Scan a Product
          </button>
        </div>
      </div>
    </div>
  );
}
