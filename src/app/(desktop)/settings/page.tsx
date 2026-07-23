'use client';

import { useState } from 'react';
import styles from './settings.module.css';

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    threshold: true,
  });
  const [language, setLanguage] = useState('en');
  const [region, setRegion] = useState('PK');
  const [apiRevealed, setApiRevealed] = useState(false);
  const [apiKey] = useState('sw_live_xK9mN2pQ7vR4tY1jL8wF3aE6dU5cO0bH');
  const [apiRegenerated, setApiRegenerated] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleNotif(key: keyof typeof notifications) {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleRegen() {
    setApiRegenerated(true);
    setApiRevealed(false);
    setTimeout(() => setApiRegenerated(false), 3000);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const maskedKey = apiKey.slice(0, 8) + '•'.repeat(20) + apiKey.slice(-4);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account, preferences, and integrations</p>
      </div>

      <div className={styles.sections}>
        {/* Account Settings */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <span className="material-symbols-outlined">manage_accounts</span>
            </div>
            <div>
              <h2 className={styles.cardTitle}>Account Settings</h2>
              <p className={styles.cardSubtitle}>Your profile and authentication details</p>
            </div>
          </div>
          <div className={styles.fields}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Full Name</label>
              <div className={styles.inputWrap}>
                <input className={`${styles.input} ${styles.inputDisabled}`} value="Hamza Waseem" disabled />
                <span className={styles.inputLock}><span className="material-symbols-outlined">lock</span></span>
              </div>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Email Address</label>
              <div className={styles.inputWrap}>
                <input className={`${styles.input} ${styles.inputDisabled}`} value="hamza@shelfwatch.ai" disabled />
                <span className={styles.inputLock}><span className="material-symbols-outlined">lock</span></span>
              </div>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Role</label>
              <div className={styles.inputWrap}>
                <input className={`${styles.input} ${styles.inputDisabled}`} value="Senior Verification Agent" disabled />
                <span className={styles.inputLock}><span className="material-symbols-outlined">lock</span></span>
              </div>
            </div>
          </div>
          <div className={styles.cardActions}>
            <button className={styles.btnPrimary} onClick={() => setPasswordModal(true)}>
              <span className="material-symbols-outlined">password</span>
              Change Password
            </button>
          </div>
        </section>

        {/* Notification Preferences */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon} style={{ background: 'rgba(255,185,95,0.12)', color: 'var(--color-secondary)' }}>
              <span className="material-symbols-outlined">notifications</span>
            </div>
            <div>
              <h2 className={styles.cardTitle}>Notification Preferences</h2>
              <p className={styles.cardSubtitle}>Choose how you receive incident alerts</p>
            </div>
          </div>
          <div className={styles.toggleList}>
            {[
              { key: 'email' as const, label: 'Email Alerts', desc: 'Receive incident reports via email' },
              { key: 'sms' as const, label: 'SMS Alerts', desc: 'Get real-time SMS for critical counterfeit detections' },
              { key: 'threshold' as const, label: 'Counterfeit Threshold Alerts', desc: 'Alert when confidence exceeds 90%' },
            ].map(item => (
              <div key={item.key} className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>{item.label}</span>
                  <span className={styles.toggleDesc}>{item.desc}</span>
                </div>
                <label className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={notifications[item.key]}
                    onChange={() => toggleNotif(item.key)}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Language & Region */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon} style={{ background: 'rgba(70,241,197,0.12)', color: 'var(--color-primary)' }}>
              <span className="material-symbols-outlined">language</span>
            </div>
            <div>
              <h2 className={styles.cardTitle}>Language &amp; Region</h2>
              <p className={styles.cardSubtitle}>Localization and display settings</p>
            </div>
          </div>
          <div className={styles.fields}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Interface Language</label>
              <select
                className={styles.select}
                value={language}
                onChange={e => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="ur">اردو</option>
                <option value="ar">عربي</option>
              </select>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Region</label>
              <select
                className={styles.select}
                value={region}
                onChange={e => setRegion(e.target.value)}
              >
                <option value="PK">Pakistan (PKR)</option>
                <option value="AE">UAE (AED)</option>
                <option value="SA">Saudi Arabia (SAR)</option>
                <option value="GB">United Kingdom (GBP)</option>
              </select>
            </div>
          </div>
          <div className={styles.cardActions}>
            <button className={`${styles.btnPrimary} ${saved ? styles.btnSaved : ''}`} onClick={handleSave}>
              <span className="material-symbols-outlined">{saved ? 'check_circle' : 'save'}</span>
              {saved ? 'Saved!' : 'Save Preferences'}
            </button>
          </div>
        </section>

        {/* API Keys */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon} style={{ background: 'rgba(255,180,171,0.12)', color: 'var(--color-error)' }}>
              <span className="material-symbols-outlined">key</span>
            </div>
            <div>
              <h2 className={styles.cardTitle}>API Keys</h2>
              <p className={styles.cardSubtitle}>Manage your API access credentials</p>
            </div>
          </div>
          <div className={styles.apiKeySection}>
            <div className={styles.apiKeyRow}>
              <div className={styles.apiKeyLabel}>
                <span className={styles.fieldLabel}>Live API Key</span>
                <span className={`${styles.apiStatus} ${apiRegenerated ? styles.apiStatusRegen : styles.apiStatusActive}`}>
                  {apiRegenerated ? '⚠ Regenerated — copy now' : '● Active'}
                </span>
              </div>
              <div className={styles.apiKeyInput}>
                <code className={styles.apiKeyCode}>
                  {apiRevealed ? apiKey : maskedKey}
                </code>
                <div className={styles.apiKeyActions}>
                  <button
                    className={styles.apiBtn}
                    onClick={() => setApiRevealed(r => !r)}
                    title={apiRevealed ? 'Hide key' : 'Reveal key'}
                  >
                    <span className="material-symbols-outlined">{apiRevealed ? 'visibility_off' : 'visibility'}</span>
                  </button>
                  {apiRevealed && (
                    <button
                      className={styles.apiBtn}
                      onClick={() => navigator.clipboard.writeText(apiKey)}
                      title="Copy to clipboard"
                    >
                      <span className="material-symbols-outlined">content_copy</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.cardActions}>
            <button className={styles.btnDanger} onClick={handleRegen}>
              <span className="material-symbols-outlined">refresh</span>
              Regenerate Key
            </button>
          </div>
          <p className={styles.apiWarning}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
            Regenerating revokes the existing key immediately. All integrations using this key will stop working.
          </p>
        </section>
      </div>

      {/* Password Modal */}
      {passwordModal && (
        <div className={styles.modalOverlay} onClick={() => setPasswordModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Change Password</h2>
              <button className={styles.modalClose} onClick={() => setPasswordModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              {['Current Password', 'New Password', 'Confirm New Password'].map(f => (
                <div key={f} className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>{f}</label>
                  <input type="password" className={styles.input} placeholder="••••••••" />
                </div>
              ))}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutlined} onClick={() => setPasswordModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={() => setPasswordModal(false)}>Update Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
