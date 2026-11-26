'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Invoice } from '@/types';
import { api } from '@/lib/api';
import styles from './Payments.module.css';

type ViewMode = 'monthly' | 'yearly';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_BADGE: Record<string, string> = { Paid: 'bg', Partial: 'ba', Overdue: 'br', Pending: 'bb' };

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}
function nowMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTHS[Number(mo) - 1]} ${y}`;
}

export default function Payments() {
  const [view, setView]         = useState<ViewMode>('monthly');
  const [month, setMonth]       = useState(nowMonth);
  const [year, setYear]         = useState(() => new Date().getFullYear());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    api.getInvoices().then(d => { setInvoices(d as Invoice[]); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  // ── Monthly ───────────────────────────────────────────────────────────────

  const monthInvoices = useMemo(
    () => invoices.filter(i => (i.date || '').startsWith(month)).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [invoices, month],
  );
  const mTotal     = monthInvoices.reduce((s, i) => s + i.total, 0);
  const mCollected = monthInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
  const mPending   = monthInvoices.filter(i => ['Pending', 'Partial'].includes(i.status)).reduce((s, i) => s + i.total, 0);
  const mOverdue   = monthInvoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.total, 0);

  // ── Yearly ────────────────────────────────────────────────────────────────

  const yearRows = useMemo(() => {
    const ys = String(year);
    return MONTHS.map((label, idx) => {
      const ms   = `${ys}-${String(idx + 1).padStart(2, '0')}`;
      const list = invoices.filter(i => (i.date || '').startsWith(ms));
      const total     = list.reduce((s, i) => s + i.total, 0);
      const collected = list.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
      const pending   = list.filter(i => ['Pending', 'Partial'].includes(i.status)).reduce((s, i) => s + i.total, 0);
      const overdue   = list.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.total, 0);
      return { label, ms, count: list.length, total, collected, pending, overdue };
    });
  }, [invoices, year]);

  const yTotal     = yearRows.reduce((s, r) => s + r.total, 0);
  const yCollected = yearRows.reduce((s, r) => s + r.collected, 0);
  const yPending   = yearRows.reduce((s, r) => s + r.pending, 0);
  const yOverdue   = yearRows.reduce((s, r) => s + r.overdue, 0);
  const yCount     = yearRows.reduce((s, r) => s + r.count, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Payment Tracking</div>
        <div className="topbar-right">
          <div className={styles.viewToggle}>
            <button className={view === 'monthly' ? styles.toggleActive : styles.toggleBtn} onClick={() => setView('monthly')}>
              <i className="ti ti-calendar-month" /> Monthly
            </button>
            <button className={view === 'yearly' ? styles.toggleActive : styles.toggleBtn} onClick={() => setView('yearly')}>
              <i className="ti ti-calendar" /> Yearly
            </button>
          </div>
        </div>
      </div>

      <div className="content">

        {/* ── Monthly ── */}
        {view === 'monthly' && (<>
          <div className={styles.monthNav}>
            <button className={`btn ${styles.navBtn}`} onClick={() => setMonth(m => shiftMonth(m, -1))}><i className="ti ti-chevron-left" /></button>
            <span className={styles.navLabel}>{fmtMonth(month)}</span>
            <button className={`btn ${styles.navBtn}`} onClick={() => setMonth(m => shiftMonth(m, 1))}><i className="ti ti-chevron-right" /></button>
          </div>

          <div className={`grid4 ${styles.gridMb}`}>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-indigo)', '--kpi-tint-border': 'var(--kpi-indigo-border)' } as React.CSSProperties}>
              <div className="kpi-label">Total Invoiced</div>
              <div className="kpi-value">{mTotal > 0 ? fmt(mTotal) : '—'}</div>
              <div className={`kpi-change ${styles.sub}`}>{monthInvoices.length} invoice{monthInvoices.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-emerald)', '--kpi-tint-border': 'var(--kpi-emerald-border)' } as React.CSSProperties}>
              <div className="kpi-label">Collected</div>
              <div className={`kpi-value ${styles.valGreen}`}>{mCollected > 0 ? fmt(mCollected) : '—'}</div>
              <div className={`kpi-change ${styles.sub}`}>
                {mTotal > 0 ? Math.round((mCollected / mTotal) * 100) : 0}% of total
              </div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-amber)', '--kpi-tint-border': 'var(--kpi-amber-border)' } as React.CSSProperties}>
              <div className="kpi-label">Pending</div>
              <div className={`kpi-value ${styles.valAmber}`}>{mPending > 0 ? fmt(mPending) : '—'}</div>
              <div className={`kpi-change ${styles.sub}`}>{monthInvoices.filter(i => ['Pending','Partial'].includes(i.status)).length} invoices</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-red)', '--kpi-tint-border': 'var(--kpi-red-border)' } as React.CSSProperties}>
              <div className="kpi-label">Overdue</div>
              <div className={`kpi-value ${styles.valRed}`}>{mOverdue > 0 ? fmt(mOverdue) : '—'}</div>
              <div className="kpi-change down">{monthInvoices.filter(i => i.status === 'Overdue').length} invoices</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              Invoices — {fmtMonth(month)}
              <span className="card-sub">{monthInvoices.length} total</span>
            </div>
            {!loaded ? (
              <div className={styles.empty}>Loading…</div>
            ) : monthInvoices.length === 0 ? (
              <div className={styles.empty}>No invoices in {fmtMonth(month)}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Invoice #</th><th>Client</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>GST</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Status</th><th>Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {monthInvoices.map(inv => (
                    <tr key={inv._id}>
                      <td className={styles.dateCell}>{inv.date || '—'}</td>
                      <td className={styles.invNum}>{inv.invoiceNumber}</td>
                      <td className={styles.clientCell}>{inv.client}</td>
                      <td style={{ textAlign: 'right' }}>₹{inv.amount.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>₹{inv.gst.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{inv.total.toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${STATUS_BADGE[inv.status] || 'bb'}`}>{inv.status}</span></td>
                      <td className={styles.paidDate}>{inv.paidDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.footerRow}>
                    <td colSpan={5} style={{ fontWeight: 700 }}>Total — {fmtMonth(month)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '15px' }}>₹{mTotal.toLocaleString('en-IN')}</td>
                    <td colSpan={2} style={{ textAlign: 'right' }}>
                      <span className={styles.valGreen} style={{ fontWeight: 700 }}>Collected: {fmt(mCollected)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>)}

        {/* ── Yearly ── */}
        {view === 'yearly' && (<>
          <div className={styles.monthNav}>
            <button className={`btn ${styles.navBtn}`} onClick={() => setYear(y => y - 1)}><i className="ti ti-chevron-left" /></button>
            <span className={styles.navLabel}>{year}</span>
            <button className={`btn ${styles.navBtn}`} onClick={() => setYear(y => y + 1)}><i className="ti ti-chevron-right" /></button>
          </div>

          <div className={`grid4 ${styles.gridMb}`}>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-indigo)', '--kpi-tint-border': 'var(--kpi-indigo-border)' } as React.CSSProperties}>
              <div className="kpi-label">Total Invoiced</div>
              <div className="kpi-value">{yTotal > 0 ? fmt(yTotal) : '—'}</div>
              <div className={`kpi-change ${styles.sub}`}>{yCount} invoices · FY {year}</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-emerald)', '--kpi-tint-border': 'var(--kpi-emerald-border)' } as React.CSSProperties}>
              <div className="kpi-label">Collected</div>
              <div className={`kpi-value ${styles.valGreen}`}>{yCollected > 0 ? fmt(yCollected) : '—'}</div>
              <div className={`kpi-change ${styles.sub}`}>
                {yTotal > 0 ? Math.round((yCollected / yTotal) * 100) : 0}% collected
              </div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-amber)', '--kpi-tint-border': 'var(--kpi-amber-border)' } as React.CSSProperties}>
              <div className="kpi-label">Pending</div>
              <div className={`kpi-value ${styles.valAmber}`}>{yPending > 0 ? fmt(yPending) : '—'}</div>
              <div className={`kpi-change ${styles.sub}`}>FY {year}</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-red)', '--kpi-tint-border': 'var(--kpi-red-border)' } as React.CSSProperties}>
              <div className="kpi-label">Overdue</div>
              <div className={`kpi-value ${styles.valRed}`}>{yOverdue > 0 ? fmt(yOverdue) : '—'}</div>
              <div className="kpi-change down">FY {year}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              Monthly Breakdown — {year}
              <span className="card-sub">Click a row to drill in</span>
            </div>
            {!loaded ? (
              <div className={styles.empty}>Loading…</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}># Invoices</th>
                    <th style={{ textAlign: 'right' }}>Total Invoiced</th>
                    <th style={{ textAlign: 'right' }}>Collected</th>
                    <th style={{ textAlign: 'right' }}>Pending</th>
                    <th style={{ textAlign: 'right' }}>Overdue</th>
                    <th>Collection %</th>
                  </tr>
                </thead>
                <tbody>
                  {yearRows.map(row => {
                    const pct = row.total > 0 ? Math.round((row.collected / row.total) * 100) : 0;
                    const hasData = row.count > 0;
                    return (
                      <tr key={row.ms} className={hasData ? styles.yearRow : ''} onClick={() => { if (hasData) { setMonth(row.ms); setView('monthly'); } }}>
                        <td className={styles.monthCell}>{row.label} {year}</td>
                        <td style={{ textAlign: 'right' }}>{row.count > 0 ? row.count : <span className={styles.dim}>—</span>}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.total > 0 ? fmt(row.total) : <span className={styles.dim}>—</span>}</td>
                        <td style={{ textAlign: 'right' }}><span className={row.collected > 0 ? styles.valGreen : styles.dim}>{row.collected > 0 ? fmt(row.collected) : '—'}</span></td>
                        <td style={{ textAlign: 'right' }}><span className={row.pending > 0 ? styles.valAmber : styles.dim}>{row.pending > 0 ? fmt(row.pending) : '—'}</span></td>
                        <td style={{ textAlign: 'right' }}><span className={row.overdue > 0 ? styles.valRed : styles.dim}>{row.overdue > 0 ? fmt(row.overdue) : '—'}</span></td>
                        <td>
                          {hasData && (
                            <div className={styles.pctWrap}>
                              <div className={styles.pctBar} style={{ width: `${pct}%`, background: pct === 100 ? 'var(--emerald)' : pct >= 50 ? 'var(--amber)' : 'var(--red)' }} />
                              <span className={styles.pctLabel}>{pct}%</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={styles.footerRow}>
                    <td style={{ fontWeight: 700 }}>Total {year}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{yCount}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '15px' }}>{fmt(yTotal)}</td>
                    <td style={{ textAlign: 'right' }}><span className={styles.valGreen} style={{ fontWeight: 800 }}>{fmt(yCollected)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className={styles.valAmber} style={{ fontWeight: 700 }}>{fmt(yPending)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className={styles.valRed} style={{ fontWeight: 700 }}>{fmt(yOverdue)}</span></td>
                    <td>
                      <div className={styles.pctWrap}>
                        <div className={styles.pctBar} style={{ width: `${yTotal > 0 ? Math.round((yCollected / yTotal) * 100) : 0}%`, background: 'var(--emerald)' }} />
                        <span className={styles.pctLabel}>{yTotal > 0 ? Math.round((yCollected / yTotal) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>)}

      </div>
    </div>
  );
}
