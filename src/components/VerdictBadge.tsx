import React from 'react';
import styles from './VerdictBadge.module.css';

type Verdict = 'genuine' | 'suspicious' | 'counterfeit' | 'unverified' | 'processing';

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: 'sm' | 'md' | 'lg';
}

const verdictConfig = {
  genuine: {
    icon: 'verified',
    label: 'Genuine / اصل',
    className: 'genuine',
  },
  suspicious: {
    icon: 'warning',
    label: 'Suspicious / مشکوک',
    className: 'suspicious',
  },
  counterfeit: {
    icon: 'cancel',
    label: 'Counterfeit / جعلی',
    className: 'counterfeit',
  },
  unverified: {
    icon: 'help_outline',
    label: 'Unverified / غیر تصدیق شدہ',
    className: 'unverified',
  },
  processing: {
    icon: 'radar',
    label: 'Processing...',
    className: 'processing',
  },
};

export default function VerdictBadge({ verdict, size = 'md' }: VerdictBadgeProps) {
  const config = verdictConfig[verdict];
  return (
    <div className={`${styles.badge} ${styles[config.className]} ${styles[size]}`}>
      <span className={`material-symbols-outlined ${styles.icon}`}>{config.icon}</span>
      <span className={styles.label}>{config.label}</span>
    </div>
  );
}
