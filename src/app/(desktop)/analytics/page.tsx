'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './analytics.module.css';
import { getDashboardStats, getDashboardHeatmap, getScanHistory, DashboardStats, HeatmapCluster, ScanHistoryItem, formatPKR } from '@/lib/api';

const statusColors: Record<string, string> = {
  genuine: 'var(--color-primary)',
  suspicious: 'var(--color-secondary)',
  unverified: 'var(--color-on-surface-variant)',
};

const statusBg: Record<string, string> = {
  genuine: 'rgba(70,241,197,0.1)',
  suspicious: 'rgba(255,185,95,0.1)',
  unverified: 'rgba(255,255,255,0.05)',
};

const statusIcons: Record<string, string> = {
  genuine: 'verified',
  suspicious: 'warning',
  unverified: 'help_outline',
};

// Available demo brands
const BRANDS = [
  { id: 'brand_unilever_001', name: 'Unilever Pakistan' },
  { id: 'brand_national_001', name: 'National Foods' },
];

export default function AnalyticsPage() {
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0].id);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCluster[]>([]);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Starts as null (not `new Date()`) so the server-rendered HTML and the
  // client's first render match exactly — computing it eagerly here would
  // give SSR and hydration two different Date instances (and, depending on
  // the server/browser's default locale, two different formatted strings),
  // causing a hydration mismatch. The real value is set post-mount below.
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);

    // Call stats, heatmap, and recent scans in parallel
    const [statsRes, heatmapRes, historyRes] = await Promise.all([
      getDashboardStats(selectedBrand),
      getDashboardHeatmap(selectedBrand),
      getScanHistory(6), // get latest 6 scans for the table
    ]);

    setLoading(false);
    setLastRefreshed(new Date());

    if (statsRes.error) {
      setError(statsRes.error);
    } else {
      setStats(statsRes.data);
    }

    if (heatmapRes.data) {
      setHeatmap(heatmapRes.data);
    }

    if (historyRes.data) {
      setRecentScans(historyRes.data);
    }
  }

  // Reload data on mount or brand change
  useEffect(() => {
    loadDashboardData();

    // Auto-refresh every 45s for the demo
    const timer = setInterval(() => {
      loadDashboardData();
    }, 45000);

    return () => clearInterval(timer);
  }, [selectedBrand]);

  const totalScans = stats?.total_scans ?? 0;
  const genuineCount = stats?.genuine_count ?? 0;
  const suspiciousCount = stats?.suspicious_count ?? 0;
  const unverifiedCount = stats?.unverified_count ?? 0;

  // Percentages for the breakdown
  const genuinePct = totalScans > 0 ? ((genuineCount / totalScans) * 100).toFixed(1) : '0.0';
  const suspiciousPct = totalScans > 0 ? ((suspiciousCount / totalScans) * 100).toFixed(1) : '0.0';
  const unverifiedPct = totalScans > 0 ? ((unverifiedCount / totalScans) * 100).toFixed(1) : '0.0';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Brand Intelligence Dashboard</h1>
          <p className={styles.subtitle}>
            Real-time counterfeit detection across Pakistan's market (Karachi)
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.brandSelectorWrapper} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Brand:</span>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '8px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {BRANDS.map(b => (
                <option key={b.id} value={b.id} style={{ background: '#1c1b1f', color: 'white' }}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <button className={styles.filterBtn} onClick={loadDashboardData} disabled={loading}>
            <span className="material-symbols-outlined spin-on-hover">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', opacity: 0.6, marginTop: '-12px', marginBottom: '24px' }}>
        Last refreshed: {lastRefreshed ? lastRefreshed.toLocaleTimeString('en-US', { hour12: true }) : '—'}
      </p>

      {/* Metrics container with loading state overlay */}
      <div style={{ position: 'relative', minHeight: '400px' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: '150px',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(12, 19, 34, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '20px 40px',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            color: 'var(--color-primary)'
          }}>
            <span className="material-symbols-outlined spin" style={{ fontSize: '36px' }}>sync</span>
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em', color: 'white' }}>RECALCULATING METRICS...</span>
          </div>
        )}

        <div style={{ opacity: loading ? 0.3 : 1, transition: 'opacity 0.25s ease', pointerEvents: loading ? 'none' : 'auto' }}>
          {/* KPI Cards */}
          <div className={styles.kpiGrid}>
            {[
              { label: 'Total Scans', value: totalScans.toLocaleString(), sub: 'Scans captured', icon: 'qr_code_scanner', color: 'var(--color-primary)' },
              { label: 'Suspicious Items', value: suspiciousCount.toLocaleString(), sub: `${stats?.suspicious_rate ?? 0}% rate`, icon: 'warning', color: 'var(--color-secondary)' },
              { label: 'Losses Avoided', value: stats ? formatPKR(stats.estimated_losses_pkr) : 'PKR 0', sub: 'Estimated retail value', icon: 'payments', color: 'var(--color-primary)' },
              { label: 'Unverified Products', value: unverifiedCount.toLocaleString(), sub: 'Unregistered SKU scans', icon: 'help_outline', color: 'var(--color-on-surface-variant)' },
            ].map((kpi, i) => (
              <div key={i} className={styles.kpiCard}>
                <div className={styles.kpiTop}>
                  <span className={styles.kpiLabel}>{kpi.label}</span>
                  <div className={styles.kpiIcon} style={{ color: kpi.color, background: kpi.color + '15' }}>
                    <span className="material-symbols-outlined">{kpi.icon}</span>
                  </div>
                </div>
                <div className={styles.kpiValue} style={{ color: kpi.color }}>{kpi.value}</div>
                <div className={styles.kpiDelta} style={{ color: 'var(--color-on-surface-variant)' }}>
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Chart + Map/Hotspot Areas row */}
          <div className={styles.chartRow}>
            <div className={styles.chartCard}>
              <h3 className={styles.cardTitle}>Hotspot Areas (Karachi)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
                {heatmap.map((area, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <p style={{ fontWeight: 600, color: 'white', fontSize: '14px' }}>{area.area_name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                        Lat: {area.latitude?.toFixed(4) || 'N/A'}, Lng: {area.longitude?.toFixed(4) || 'N/A'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, color: 'var(--color-secondary)', fontSize: '15px' }}>
                        {area.report_count} Scans
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--color-error)', marginTop: '2px' }}>
                        {area.suspicious_rate}% Suspicious
                      </p>
                    </div>
                  </div>
                ))}
                {heatmap.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-on-surface-variant)', fontSize: '14px' }}>
                    No regional hotspots detected yet.
                  </div>
                )}
              </div>
            </div>

            <div className={styles.donutCard}>
              <h3 className={styles.cardTitle}>Result Breakdown</h3>
              <div className={styles.donutChart}>
                <div
                  className={styles.donutRing}
                  style={{
                    background: `conic-gradient(
                      var(--color-primary) 0% ${genuinePct}%,
                      var(--color-secondary) ${genuinePct}% ${Number(genuinePct) + Number(suspiciousPct)}%,
                      var(--color-on-surface-variant) ${Number(genuinePct) + Number(suspiciousPct)}% 100%
                    )`
                  }}
                ></div>
                <div className={styles.donutCenter}>
                  <span className={styles.donutValue}>{genuinePct}%</span>
                  <span className={styles.donutSub}>Genuine</span>
                </div>
              </div>
              <div className={styles.donutLegend}>
                {[
                  { label: 'Genuine', pct: `${genuinePct}%`, color: 'var(--color-primary)' },
                  { label: 'Suspicious', pct: `${suspiciousPct}%`, color: 'var(--color-secondary)' },
                  { label: 'Unverified', pct: `${unverifiedPct}%`, color: 'var(--color-on-surface-variant)' },
                ].map((l, i) => (
                  <div key={i} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: l.color }}></span>
                    <span className={styles.legendLabel}>{l.label}</span>
                    <span className={styles.legendPct} style={{ color: l.color }}>{l.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Incident Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <h3 className={styles.cardTitle}>Recent Scans & Incidents</h3>
              <Link href="/scan/history" className={styles.viewAllLink}>
                View all <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </Link>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['Scan ID', 'Product', 'Batch No.', 'Location', 'Verdict', 'Confidence', 'Time'].map(h => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((row, i) => (
                    <tr key={i} className={styles.tr}>
                      <td className={styles.td} style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '12px' }}>
                        {row.id.substring(0, 8)}...
                      </td>
                      <td className={styles.td}>{row.product_name || 'Unregistered Product'}</td>
                      <td className={styles.td} style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                        {row.extracted_batch || 'No Batch'}
                      </td>
                      <td className={styles.td}>{row.area_name || 'Karachi'}</td>
                      <td className={styles.td}>
                        <span className={styles.statusBadge} style={{ color: statusColors[row.verdict], background: statusBg[row.verdict], border: `1px solid ${statusColors[row.verdict]}30` }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{statusIcons[row.verdict]}</span>
                          {row.verdict.charAt(0).toUpperCase() + row.verdict.slice(1)}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.confidenceCell}>
                          <div className={styles.miniBar}>
                            <div className={styles.miniBarFill} style={{ width: `${Math.round(row.confidence * 100)}%`, background: statusColors[row.verdict] }}></div>
                          </div>
                          <span style={{ color: statusColors[row.verdict], fontWeight: 600, fontSize: '13px', minWidth: '36px' }}>
                            {Math.round(row.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className={styles.td} style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>
                        {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                  {recentScans.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.td} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-on-surface-variant)' }}>
                        No scans logged yet. Use the scan portal to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
