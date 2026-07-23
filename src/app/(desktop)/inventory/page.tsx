'use client';

import { useState } from 'react';
import VerdictBadge from '@/components/VerdictBadge';
import styles from './inventory.module.css';

type FilterType = 'All' | 'Active' | 'Flagged' | 'Recalled';
type Verdict = 'genuine' | 'suspicious' | 'counterfeit' | 'unverified' | 'processing';

const PRODUCTS = [
  { id: 1, name: 'HealthCare Pro 500mg', brand: 'MedShield Pharma', stock: 12400, verdict: 'genuine' as Verdict, color: '#46f1c520', accent: '#46f1c5' },
  { id: 2, name: 'VitaBoost Capsules', brand: 'NutraLabs', stock: 8320, verdict: 'genuine' as Verdict, color: '#46f1c520', accent: '#46f1c5' },
  { id: 3, name: 'GlucoTest Pro Strips', brand: 'DiagnoCare', stock: 340, verdict: 'counterfeit' as Verdict, color: '#ffb4ab20', accent: '#ffb4ab' },
  { id: 4, name: 'PharmaShield Tablets', brand: 'PharmaShield Co.', stock: 2100, verdict: 'suspicious' as Verdict, color: '#ffb95f20', accent: '#ffb95f' },
  { id: 5, name: 'SkinCare Elite Cream', brand: 'DermaElite', stock: 5560, verdict: 'genuine' as Verdict, color: '#46f1c520', accent: '#46f1c5' },
  { id: 6, name: 'OmegaMax Fish Oil', brand: 'VitaOcean', stock: 0, verdict: 'unverified' as Verdict, color: '#bacac230', accent: '#bacac2' },
  { id: 7, name: 'ImmunePlus Syrup', brand: 'BioHealth', stock: 780, verdict: 'counterfeit' as Verdict, color: '#ffb4ab20', accent: '#ffb4ab' },
  { id: 8, name: 'CalciumD3 Chewable', brand: 'BoneCare Labs', stock: 4200, verdict: 'processing' as Verdict, color: '#46f1c510', accent: '#46f1c5' },
];

const FILTERS: FilterType[] = ['All', 'Active', 'Flagged', 'Recalled'];

const PAGE_SIZE = 6;

function filterProducts(products: typeof PRODUCTS, filter: FilterType, search: string) {
  let result = products;
  if (filter === 'Active') result = result.filter(p => p.verdict === 'genuine');
  if (filter === 'Flagged') result = result.filter(p => p.verdict === 'suspicious' || p.verdict === 'counterfeit');
  if (filter === 'Recalled') result = result.filter(p => p.stock === 0);
  if (search) result = result.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand.toLowerCase().includes(search.toLowerCase())
  );
  return result;
}

export default function InventoryPage() {
  const [filter, setFilter] = useState<FilterType>('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = filterProducts(PRODUCTS, filter, search);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Inventory Management</h1>
          <p className={styles.subtitle}>{PRODUCTS.length} products tracked across all regions</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
          <span className="material-symbols-outlined">add</span>
          Add Product
        </button>
      </div>

      {/* Search + Filters */}
      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
          <input
            className={styles.searchInput}
            placeholder="Search products, brands…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
        <div className={styles.chips}>
          {FILTERS.map(f => (
            <button
              key={f}
              className={`${styles.chip} ${filter === f ? styles.chipActive : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {paginated.length === 0 ? (
        <div className={styles.empty}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3 }}>inventory_2</span>
          <p>No products found</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {paginated.map(p => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardImage} style={{ background: p.color, borderColor: p.accent + '40' }}>
                <span className="material-symbols-outlined" style={{ color: p.accent, fontSize: '36px' }}>
                  medication
                </span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <h3 className={styles.productName}>{p.name}</h3>
                  <span className={styles.brandTag}>{p.brand}</span>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.stockInfo}>
                    <span className={styles.stockLabel}>Stock</span>
                    <span className={styles.stockValue} style={{ color: p.stock === 0 ? 'var(--color-error)' : 'var(--color-on-surface)' }}>
                      {p.stock === 0 ? 'Out of Stock' : p.stock.toLocaleString()}
                    </span>
                  </div>
                  <VerdictBadge verdict={p.verdict} size="sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <span className="material-symbols-outlined">chevron_left</span>
            Prev
          </button>
          <div className={styles.pageDots}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                className={`${styles.pageDot} ${page === i + 1 ? styles.pageDotActive : ''}`}
                onClick={() => setPage(i + 1)}
              />
            ))}
          </div>
          <button
            className={styles.pageBtn}
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}

      {/* Add Product Modal */}
      {showAdd && (
        <div className={styles.modalOverlay} onClick={() => setShowAdd(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add New Product</h2>
              <button className={styles.modalClose} onClick={() => setShowAdd(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              {['Product Name', 'Brand', 'Batch Number', 'Stock Count'].map(field => (
                <div key={field} className={styles.formGroup}>
                  <label className={styles.formLabel}>{field}</label>
                  <input className={styles.formInput} placeholder={`Enter ${field.toLowerCase()}…`} />
                </div>
              ))}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutlined} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={() => setShowAdd(false)}>Save Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
