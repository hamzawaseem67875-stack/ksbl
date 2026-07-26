'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './history.module.css';
import { getMyScanHistory, getMe, postLogout, ScanHistoryItem, CustomerProfile, verdictColor, verdictIcon } from '@/lib/api';

type FilterType = 'all' | 'genuine' | 'suspicious' | 'unverified';

export default function ScanHistoryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadScans() {
      setLoading(true);
      setError(null);
      const [scansRes, meRes] = await Promise.all([getMyScanHistory(50), getMe()]);
      setLoading(false);
      if (scansRes.error) {
        setError(scansRes.error);
      } else if (scansRes.data) {
        setScans(scansRes.data);
      }
      if (meRes.data) {
        setProfile(meRes.data);
      }
    }
    loadScans();
  }, []);

  const filtered = scans.filter(s => {
    const matchesFilter = filter === 'all' || s.verdict === filter;
    const productName = s.product_name || 'Unknown Product';
    const batch = s.extracted_batch || 'No Batch';
    const matchesSearch = productName.toLowerCase().includes(search.toLowerCase()) ||
                          batch.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  function formatTime(dateStr: string) {
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.appBar}>
        <Link href="/scan" className={styles.backBtn}>
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className={styles.appBarTitle}>Scan History</h1>
        <span className={styles.countBadge}>{filtered.length}</span>
      </header>

      <main className={styles.main}>
        {profile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '0 16px 16px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(70,241,197,0.08)',
            border: '1px solid rgba(70,241,197,0.2)',
          }}>
            <span style={{ fontSize: '14px' }}>Hi, {profile.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--color-primary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>military_tech</span>
                {profile.score_points} pts
              </span>
              <button
                onClick={async () => { await postLogout(); router.push('/login'); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-on-surface-variant)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Log out
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className={styles.searchWrapper}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', fontSize: '20px' }}>search</span>
          <input
            className={styles.searchInput}
            placeholder="Search product or batch..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch('')}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className={styles.filterRow}>
          {(['all', 'genuine', 'suspicious', 'unverified'] as FilterType[]).map(f => (
            <button
              key={f}
              className={filter === f ? styles.filterChipActive : styles.filterChip}
              onClick={() => setFilter(f)}
              style={filter === f && f !== 'all' ? { borderColor: verdictColor(f), color: verdictColor(f), background: `${verdictColor(f)}15` } : {}}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined spin" style={{ fontSize: '32px' }}>sync</span>
            <p style={{ marginTop: '8px' }}>Loading history...</p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--color-error)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>error_outline</span>
            <p style={{ marginTop: '8px' }}>{error}</p>
          </div>
        )}

        {/* Scan list */}
        {!loading && !error && filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-on-surface-variant)' }}>search_off</span>
            <p>No scans found</p>
          </div>
        ) : (
          <div className={styles.scanList}>
            {filtered.map(scan => (
              <div key={scan.id} className={styles.scanCard} style={{ borderLeft: `3px solid ${verdictColor(scan.verdict)}` }}>
                <div className={styles.scanLeft}>
                  <div className={styles.statusDot} style={{ color: verdictColor(scan.verdict) }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
                      {verdictIcon(scan.verdict)}
                    </span>
                  </div>
                </div>
                <div className={styles.scanInfo}>
                  <p className={styles.productName}>{scan.product_name || 'Unknown Product'}</p>
                  <p className={styles.batchInfo}>
                    {scan.extracted_batch || 'No Batch'} · {scan.brand_name || 'Unknown Brand'}
                  </p>
                  <p className={styles.timeInfo}>{formatTime(scan.created_at)}</p>
                </div>
                <div className={styles.scanRight}>
                  <span className={styles.statusBadge} style={{ color: verdictColor(scan.verdict), background: `${verdictColor(scan.verdict)}15`, border: `1px solid ${verdictColor(scan.verdict)}30` }}>
                    {scan.verdict}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className={styles.bottomNav}>
        <Link href="/" className={styles.navItem}>
          <span className="material-symbols-outlined">home</span>
          <span>Home</span>
        </Link>
        <Link href="/scan" className={styles.navItem}>
          <span className="material-symbols-outlined">qr_code_scanner</span>
          <span>Scan</span>
        </Link>
        <Link href="/scan/history" className={`${styles.navItem} ${styles.navItemActive}`}>
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
