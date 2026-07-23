'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/dashboard', icon: 'dashboard', label: 'OVERVIEW' },
  { href: '/analytics', icon: 'analytics', label: 'ANALYTICS' },
  { href: '/inventory', icon: 'inventory_2', label: 'INVENTORY' },
  { href: '/scan/history', icon: 'history', label: 'SCAN HISTORY' },
  { href: '/reports', icon: 'description', label: 'REPORTS' },
  { href: '/settings', icon: 'settings', label: 'SETTINGS' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        <div className={styles.agentProfile}>
          <div className={styles.agentAvatar}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>security</span>
          </div>
          <div>
            <p className={styles.agentRole}>AGENT PORTAL</p>
            <p className={styles.agentName}>Field Intelligence</p>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? styles.sidebarLinkActive : styles.sidebarLink}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.sidebarFooter}>
        <button className={styles.exportBtn}>
          <span className="material-symbols-outlined">download</span>
          EXPORT DATA
        </button>
        <Link href="/scan" className={styles.scanBtn}>
          <span className="material-symbols-outlined">qr_code_scanner</span>
          NEW SCAN
        </Link>
      </div>
    </aside>
  );
}
