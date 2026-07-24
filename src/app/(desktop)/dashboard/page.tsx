'use client';

import { useEffect, useState } from 'react';
import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import styles from './dashboard.module.css';
import { getScanHistory, ScanHistoryItem, formatConfidence, postReport } from '@/lib/api';

export default function DashboardPage() {
  const [activeIncident, setActiveIncident] = useState<ScanHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [flagged, setFlagged] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    async function loadIncident() {
      const res = await getScanHistory(10);
      setLoading(false);
      if (res.data && res.data.length > 0) {
        // Find the most recent suspicious scan to highlight as the active incident
        const suspicious = res.data.find(s => s.verdict === 'suspicious') || res.data[0];
        setActiveIncident(suspicious);

        // Check if this scan has already been flagged in Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && anonKey) {
          try {
            const repRes = await fetch(`${supabaseUrl}/rest/v1/Report?scan_id=eq.${suspicious.id}`, {
              headers: { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` }
            });
            if (repRes.ok) {
              const reports = await repRes.json();
              if (reports && reports.length > 0) {
                setFlagged(reports[0].status === 'investigating');
              }
            }
          } catch (e) {
            console.error("[Dashboard] Error checking flagged report status:", e);
          }
        }
      }
    }
    loadIncident();
  }, []);

  const handleFlagIncident = async () => {
    if (!activeIncident || flagged || flagging) return;
    setFlagging(true);
    console.log(`[Dashboard] Flagging incident: ${activeIncident.id}`);

    try {
      const res = await fetch(`/api/incidents/${activeIncident.id}/flag`, {
        method: 'POST'
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      setFlagged(true);
      alert(`Incident #${activeIncident.id.substring(0, 5).toUpperCase()} has been successfully flagged for manual field investigation.`);
    } catch (err) {
      console.error("[Dashboard] Flagging failed:", err);
      alert("Failed to flag this incident. Please try again.");
    } finally {
      setFlagging(false);
    }
  };

  const handleExportIncident = async () => {
    if (!activeIncident || exporting) return;
    setExporting(true);
    console.log(`[Dashboard] Exporting dossier for incident: ${activeIncident.id}`);

    try {
      const res = await fetch(`/api/incidents/${activeIncident.id}/export`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Incident_Report_${activeIncident.id.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Dashboard] Export failed:", err);
      alert("Failed to export report dossier. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Mock flags detected based on confidence & type for the UI presentation
  const mockFlags = [
    { icon: 'print_disabled', text: 'Print Quality Anomaly' },
    { icon: 'qr_code', text: 'Barcode/Batch Pattern Inconsistency' },
    { icon: 'gpp_maybe', text: 'Visual Asset Discrepancy' }
  ];

  const confidencePct = activeIncident ? Math.round(activeIncident.confidence * 100) : 97;

  return (
    <div className={styles.page}>
      <div 
        className={styles.mapBackground}
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCnf0PhH7B4pF9QtcQQ2igj6ZJFA9soxwnpbQn9QBkPURetcd-eDmPcURIJkS4pHpz72BVOaEP9MULqpbW5EJUrKYweo0Hm7dAKZlGUS_AaMFV9bmcakEmZJoBbz4BkWDK96eD_-7b56_bWBvI1QCgSi6bjGkCDz0-6L3XIYABEaXFbCbZ5C5fExLSLMlMWcDZmNUyOG_ZzLLrWmPPSUPpNVBKflGNVL0Xo2IQMliFJKDzLNRxcGOdR0w')" }}
      ></div>

      {/* Dynamic Ping markers based on active incident location */}
      {activeIncident && (
        <>
          <div className={activeIncident.verdict === 'suspicious' ? styles.pingRed : styles.pingAmber}></div>
          <div className={activeIncident.verdict === 'suspicious' ? styles.pingRedCenter : styles.pingAmberCenter}></div>
        </>
      )}

      {/* Incident Panel */}
      <div className={styles.incidentPanel}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined spin" style={{ fontSize: '32px' }}>sync</span>
            <p style={{ marginTop: '8px' }}>Loading active incident...</p>
          </div>
        ) : activeIncident ? (
          <>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>LATEST LOGGED INCIDENT</p>
                <h2 className={styles.panelTitle}>Incident #{activeIncident.id.substring(0, 5).toUpperCase()}</h2>
                <p className={styles.panelLocation}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>
                  {activeIncident.area_name || 'Karachi, Pakistan'}
                </p>
              </div>
              <span 
                className={styles.counterfeitBadge} 
                style={{ 
                  background: activeIncident.verdict === 'suspicious' ? 'var(--color-error)' : 'var(--color-secondary)',
                  color: 'white'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>
                  {activeIncident.verdict === 'suspicious' ? 'cancel' : 'warning'}
                </span>
                {activeIncident.verdict === 'suspicious' ? 'Counterfeit' : 'Unverified'}
              </span>
            </div>

            {/* Confidence */}
            <div className={styles.confSection}>
              <div className={styles.confHeader}>
                <span className={styles.sectionLabel}>AI Confidence Score</span>
                <span className={styles.confValue} style={{ color: activeIncident.verdict === 'suspicious' ? 'var(--color-error)' : 'var(--color-secondary)' }}>
                  {confidencePct}%
                </span>
              </div>
              <div className={styles.confTrack}>
                <div 
                  className={styles.confFill} 
                  style={{ 
                    width: `${confidencePct}%`, 
                    background: activeIncident.verdict === 'suspicious' 
                      ? 'linear-gradient(to right, rgba(255,180,171,0.4), var(--color-error))' 
                      : 'linear-gradient(to right, rgba(255,224,178,0.4), var(--color-secondary))' 
                  }}
                ></div>
              </div>
            </div>

            {/* Product Details */}
            <div className={styles.detailsCard}>
              <p className={styles.sectionLabel}>PRODUCT DETAILS</p>
              <div className={styles.detailsGrid}>
                {[
                  { label: 'Batch No.', value: activeIncident.extracted_batch || 'Unknown' },
                  { label: 'Factory ID', value: 'KHI-F7' },
                  { label: 'Time Logged', value: new Date(activeIncident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                  { label: 'Verdict', value: activeIncident.verdict.toUpperCase() },
                  { label: 'Brand', value: activeIncident.brand_name || 'Unknown Brand' },
                  { label: 'Category', value: activeIncident.product_name || 'FMCG Goods' },
                ].map((d, i) => (
                  <div key={i} className={styles.detailItem}>
                    <p className={styles.detailLabel}>{d.label}</p>
                    <p className={styles.detailValue}>{d.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Flags */}
            <div className={styles.flagsCard}>
              <p className={styles.sectionLabel}>AI FLAGS DETECTED</p>
              {mockFlags.map((flag, i) => (
                <div key={i} className={styles.flagItem}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-error)', fontSize: '18px' }}>{flag.icon}</span>
                  <span className={styles.flagText}>{flag.text}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className={styles.panelActions}>
              <button 
                className={styles.flagBtn} 
                onClick={handleFlagIncident} 
                disabled={flagged || flagging}
                style={{ opacity: flagged ? 0.6 : 1 }}
              >
                <span className={`material-symbols-outlined ${flagging ? 'spin' : ''}`}>{flagging ? 'sync' : flagged ? 'done' : 'flag'}</span>
                {flagging ? 'Flagging...' : flagged ? 'Flagged for Investigation' : 'Flag for Investigation'}
              </button>
              <button 
                className={styles.exportBtnAlt}
                onClick={handleExportIncident}
                disabled={exporting}
              >
                <span className={`material-symbols-outlined ${exporting ? 'spin' : ''}`}>
                  {exporting ? 'sync' : 'download'}
                </span>
                {exporting ? 'Exporting...' : 'Export Report'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>info</span>
            <p style={{ marginTop: '8px' }}>No incidents logged in the database yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
