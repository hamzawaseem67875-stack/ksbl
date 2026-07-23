'use client';

import { useState } from 'react';
import styles from './reports.module.css';

type ReportFormat = 'PDF' | 'CSV' | 'XLSX';

interface Report {
  id: number;
  name: string;
  description: string;
  date: string;
  format: ReportFormat;
  size: string;
  icon: string;
  color: string;
}

const REPORTS: Report[] = [
  {
    id: 1,
    name: 'Monthly Counterfeit Summary — June 2026',
    description: 'Detailed breakdown of all counterfeit incidents detected in June 2026',
    date: 'Jul 1, 2026',
    format: 'PDF',
    size: '2.4 MB',
    icon: 'summarize',
    color: 'var(--color-error)',
  },
  {
    id: 2,
    name: 'Field Agent Audit Trail',
    description: 'Complete audit log of field agent scan activities and submissions',
    date: 'Jun 28, 2026',
    format: 'CSV',
    size: '814 KB',
    icon: 'person_search',
    color: 'var(--color-secondary)',
  },
  {
    id: 3,
    name: 'Regional Hotspot Analysis — Q2 2026',
    description: 'Geographic heat-map report of counterfeit activity by region',
    date: 'Jun 30, 2026',
    format: 'PDF',
    size: '5.1 MB',
    icon: 'location_on',
    color: 'var(--color-primary)',
  },
  {
    id: 4,
    name: 'Brand Integrity Score Report',
    description: 'Per-brand scoring for product authenticity and supply chain trust',
    date: 'Jun 25, 2026',
    format: 'XLSX',
    size: '1.2 MB',
    icon: 'shield',
    color: 'var(--color-primary)',
  },
  {
    id: 5,
    name: 'AI Model Performance Metrics',
    description: 'Accuracy, precision and recall statistics for the verification AI models',
    date: 'Jun 20, 2026',
    format: 'PDF',
    size: '980 KB',
    icon: 'analytics',
    color: 'var(--color-secondary)',
  },
  {
    id: 6,
    name: 'Recalled Products Master List',
    description: 'Full inventory export of products with active recall status',
    date: 'Jun 15, 2026',
    format: 'CSV',
    size: '430 KB',
    icon: 'inventory_2',
    color: 'var(--color-error)',
  },
];

const formatColors: Record<ReportFormat, string> = {
  PDF: '#ff6b6b',
  CSV: '#46f1c5',
  XLSX: '#4ecdc4',
};

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState<Set<number>>(new Set());

  function handleDownload(id: number) {
    setDownloading(id);
    setTimeout(() => {
      setDownloading(null);
      setDownloaded(prev => new Set(prev).add(id));
    }, 1800);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports</h1>
          <p className={styles.subtitle}>Download generated intelligence reports and audit exports</p>
        </div>
        <button className={styles.generateBtn}>
          <span className="material-symbols-outlined">add_chart</span>
          Generate Report
        </button>
      </div>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        {[
          { label: 'Total Reports', value: '24', icon: 'description' },
          { label: 'This Month', value: '6', icon: 'calendar_month' },
          { label: 'PDF Reports', value: '14', icon: 'picture_as_pdf' },
          { label: 'Data Exports', value: '10', icon: 'table_chart' },
        ].map((s, i) => (
          <div key={i} className={styles.statCard}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>{s.icon}</span>
            <span className={styles.statValue}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Report List */}
      <div className={styles.list}>
        {REPORTS.map(report => (
          <div key={report.id} className={styles.row}>
            <div className={styles.rowIcon} style={{ background: report.color + '18', color: report.color }}>
              <span className="material-symbols-outlined">{report.icon}</span>
            </div>
            <div className={styles.rowContent}>
              <h3 className={styles.rowName}>{report.name}</h3>
              <p className={styles.rowDesc}>{report.description}</p>
              <div className={styles.rowMeta}>
                <span className={styles.metaItem}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                  {report.date}
                </span>
                <span className={styles.metaItem}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>folder_zip</span>
                  {report.size}
                </span>
              </div>
            </div>
            <div className={styles.rowRight}>
              <span
                className={styles.formatBadge}
                style={{ color: formatColors[report.format], borderColor: formatColors[report.format] + '40', background: formatColors[report.format] + '12' }}
              >
                {report.format}
              </span>
              <button
                className={`${styles.downloadBtn} ${downloaded.has(report.id) ? styles.downloadDone : ''}`}
                onClick={() => !downloaded.has(report.id) && handleDownload(report.id)}
                disabled={downloading === report.id}
              >
                {downloading === report.id ? (
                  <span className={`material-symbols-outlined ${styles.spin}`}>sync</span>
                ) : downloaded.has(report.id) ? (
                  <span className="material-symbols-outlined">check_circle</span>
                ) : (
                  <span className="material-symbols-outlined">download</span>
                )}
                {downloading === report.id ? 'Downloading…' : downloaded.has(report.id) ? 'Downloaded' : 'Download'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
