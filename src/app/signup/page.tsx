'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../login/login.module.css';
import { postSignup } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    const res = await postSignup({ name, email, password });
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    router.push('/scan');
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
          <h2 className={styles.cardTitle}>Create Your Account</h2>
          <p className={styles.cardSubtitle}>Sign up to start verifying products and earn points for flagging counterfeits</p>

          {error && (
            <div className={styles.errorBanner}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="name" className={styles.label}>Full Name</label>
              <div className={styles.inputWrapper}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>person</span>
                <input
                  id="name"
                  type="text"
                  className={styles.input}
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>Email Address</label>
              <div className={styles.inputWrapper}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>mail</span>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <>
                  <span className={`material-symbols-outlined ${styles.spinIcon}`}>progress_activity</span>
                  Creating account...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">person_add</span>
                  Sign Up
                </>
              )}
            </button>
          </form>

          <div className={styles.divider}><span>or</span></div>

          <button className={styles.consumerBtn} onClick={() => router.push('/login')}>
            <span className="material-symbols-outlined">login</span>
            Already have an account? Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
