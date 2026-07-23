import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import styles from './desktoplayout.module.css';

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <TopNav />
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
