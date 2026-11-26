'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import type { Invoice } from '@/types';
import { api } from '@/lib/api';
import styles from './Invoices.module.css';

interface Brand {
  companyName: string; tagline: string; address: string;
  gst: string; email: string; phone: string;
  accentColor: string; logoLetter: string; footerNote: string;
}
const DEFAULT_BRAND: Brand = {
  companyName: 'Nimbus Works Pvt Ltd', tagline: 'Digital Marketing Agency',
  address: '221B Demo Street, Bengaluru — 560001', gst: '29AAAAA0000A1Z5',
  email: 'accounts@nimbusworks.example', phone: '+91 90000 00000',
  accentColor: '#6366f1', logoLetter: 'N', footerNote: '',
};
const ACCENT_COLORS = [
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#8b5cf6', label: 'Violet' },
  { hex: '#0ea5e9', label: 'Sky' },
  { hex: '#334155', label: 'Slate' },
];

const statusBadge: Record<string, string> = { Paid: 'bg', Partial: 'ba', Overdue: 'br', Pending: 'bb' };

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(m) - 1]} ${y}`;
}

export default function Invoices() {
  const router = useRouter();
  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [loaded, setLoaded]             = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [gstFilter, setGstFilter]       = useState('All');
  const [monthFilter, setMonthFilter]   = useState('');
  const [searchQ, setSearchQ]           = useState('');
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [markingPaid, setMarkingPaid]   = useState<string | null>(null);
  const [payInvoice, setPayInvoice]     = useState<Invoice | null>(null);
  const [paidDate, setPaidDate]         = useState('');
  const [showTemplate, setShowTemplate]   = useState(false);
  const [brand, setBrand]               = useState<Brand>(DEFAULT_BRAND);
  const [savingBrand, setSavingBrand]   = useState(false);
  const [brandSaved, setBrandSaved]     = useState(false);

  function load() {
    api.getInvoices()
      .then(d => { setInvoices(d as Invoice[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  function openTemplate() {
    setShowTemplate(true);
    setBrandSaved(false);
    api.getInvoiceBrand()
      .then(d => setBrand(d as Brand))
      .catch(() => {});
  }

  async function saveBrand() {
    setSavingBrand(true);
    try {
      await api.saveInvoiceBrand(brand);
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2000);
    } catch {}
    setSavingBrand(false);
  }

  useEffect(() => { load(); }, []);

  const months = Array.from(new Set(
    invoices.map(i => i.date?.slice(0, 7)).filter(Boolean) as string[]
  )).sort((a, b) => b.localeCompare(a));

  const displayed = invoices
    .filter(i => statusFilter === 'All' || i.status === statusFilter)
    .filter(i => gstFilter === 'All' || (gstFilter === 'GST' ? i.gstApplicable !== false : i.gstApplicable === false))
    .filter(i => !monthFilter || i.date?.startsWith(monthFilter))
    .filter(i => !searchQ ||
      i.client.toLowerCase().includes(searchQ.toLowerCase()) ||
      i.invoiceNumber.toLowerCase().includes(searchQ.toLowerCase())
    );

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const collected     = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
  const overdue       = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.total, 0);
  const pending       = invoices.filter(i => ['Pending', 'Partial'].includes(i.status)).reduce((s, i) => s + i.total, 0);

  function openPayModal(inv: Invoice) {
    const today = new Date();
    setPaidDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
    setPayInvoice(inv);
  }

  async function confirmMarkPaid() {
    if (!payInvoice) return;
    setMarkingPaid(payInvoice._id);
    setPayInvoice(null);
    try {
      const updated = await api.updateInvoice(payInvoice._id, { status: 'Paid', paidDate });
      setInvoices(prev => prev.map(i => i._id === payInvoice._id ? updated as Invoice : i));
    } catch {}
    setMarkingPaid(null);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteInvoice(deleteId);
      setInvoices(prev => prev.filter(i => i._id !== deleteId));
    } catch {}
    setDeleting(false);
    setDeleteId(null);
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Invoice Management</div>
        <div className="topbar-right">
          <input
            type="text"
            placeholder="Search client / invoice…"
            className={styles.searchInput}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          {months.length > 0 && (
            <div className="fp">
              <i className={`ti ti-calendar ${styles.fpIcon}`} />
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                <option value="">All Months</option>
                {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
              </select>
            </div>
          )}
          <div className="fp">
            <i className={`ti ti-filter ${styles.fpIcon}`} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option>Paid</option>
              <option>Pending</option>
              <option>Overdue</option>
              <option>Partial</option>
            </select>
          </div>
          <div className="fp">
            <i className={`ti ti-receipt-tax ${styles.fpIcon}`} />
            <select value={gstFilter} onChange={e => setGstFilter(e.target.value)}>
              <option value="All">GST &amp; Non-GST</option>
              <option value="GST">GST Only</option>
              <option value="Non-GST">Non-GST Only</option>
            </select>
          </div>
          <button className="btn" onClick={openTemplate}>
            <i className="ti ti-palette" />Customize Template
          </button>
          <button className="btn btn-p" onClick={() => router.push('/invoices/new')}>
            <i className="ti ti-plus" />New Invoice
          </button>
        </div>
      </div>

      <div className="content">
        <div className={`grid4 ${styles.grid4mb}`}>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-indigo)', '--kpi-tint-border': 'var(--kpi-indigo-border)' } as React.CSSProperties}>
            <div className="kpi-label">Total Invoiced</div>
            <div className="kpi-value">{fmt(totalInvoiced)}</div>
            <div className={`kpi-change ${styles.kpiChangeSub}`}>{invoices.length} invoices</div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-emerald)', '--kpi-tint-border': 'var(--kpi-emerald-border)' } as React.CSSProperties}>
            <div className="kpi-label">Collected</div>
            <div className={`kpi-value ${styles.valGreen}`}>{fmt(collected)}</div>
            <div className="kpi-change up">
              {totalInvoiced > 0 ? Math.round((collected / totalInvoiced) * 100) : 0}% collected
            </div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-red)', '--kpi-tint-border': 'var(--kpi-red-border)' } as React.CSSProperties}>
            <div className="kpi-label">Overdue</div>
            <div className={`kpi-value ${styles.valRed}`}>{fmt(overdue)}</div>
            <div className="kpi-change down">{invoices.filter(i => i.status === 'Overdue').length} invoices</div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-amber)', '--kpi-tint-border': 'var(--kpi-amber-border)' } as React.CSSProperties}>
            <div className="kpi-label">Pending</div>
            <div className={`kpi-value ${styles.valAmber}`}>{fmt(pending)}</div>
            <div className={`kpi-change ${styles.kpiChangeSub}`}>
              {invoices.filter(i => ['Pending', 'Partial'].includes(i.status)).length} invoices
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            All Invoices
            <span className="card-sub">{displayed.length} shown</span>
          </div>

          {!loaded ? (
            <div className={styles.loadingMsg}>Loading…</div>
          ) : displayed.length === 0 ? (
            <div className={styles.emptyCenter}>
              <div className={styles.emptyCenterMsg}>
                {statusFilter === 'All' && !searchQ && !monthFilter
                  ? 'No invoices yet'
                  : 'No invoices match your filters'}
              </div>
              {statusFilter === 'All' && !searchQ && !monthFilter && (
                <button className="btn btn-p" onClick={() => router.push('/invoices/new')}>
                  <i className="ti ti-plus" />Create your first invoice
                </button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th><th>Client</th><th>Date</th><th>Due Date</th>
                  <th>Amount</th><th>GST</th><th>Total</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {displayed.map(inv => (
                  <tr key={inv._id}>
                    <td className={styles.invoiceNum}>{inv.invoiceNumber}</td>
                    <td className={styles.clientName}>{inv.client}</td>
                    <td>{inv.date || '—'}</td>
                    <td>{inv.dueDate || '—'}</td>
                    <td>₹{inv.amount.toLocaleString('en-IN')}</td>
                    <td>
                      {inv.gstApplicable === false
                        ? <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>Non-GST</span>
                        : `₹${inv.gst.toLocaleString('en-IN')}`}
                    </td>
                    <td className={styles.totalCell}>₹{inv.total.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${statusBadge[inv.status]}`}>{inv.status}</span></td>
                    <td>
                      <div className={styles.actionRow}>
                        {inv.status !== 'Paid' && (
                          <button
                            className={`btn ${styles.btnSmGreen}`}
                            title="Mark as Paid"
                            onClick={() => openPayModal(inv)}
                            disabled={markingPaid === inv._id}
                          >
                            <i className={`ti ${markingPaid === inv._id ? 'ti-loader-2' : 'ti-circle-check'} ${styles.iconMd}`} />
                          </button>
                        )}
                        <button className={`btn ${styles.btnSm}`}
                          title="Edit" onClick={() => router.push(`/invoices/${inv._id}/edit`)}>
                          <i className={`ti ti-pencil ${styles.iconSm}`} />
                        </button>
                        <button className={`btn ${styles.btnSmRed}`}
                          title="Delete" onClick={() => setDeleteId(inv._id)}>
                          <i className={`ti ti-trash ${styles.iconSm}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {deleteId && (
        <DeleteConfirm
          title="Delete Invoice"
          message="This will permanently delete the invoice. This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}

      {/* Invoice Template modal */}
      {showTemplate && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTemplate(false); }}>
          <div className="modal" style={{ maxWidth: 560, width: '100%' }}>
            <div className="modal-header">
              <span className="modal-title">Invoice Template Settings</span>
              <button className="modal-close" onClick={() => setShowTemplate(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Company Name</label>
                  <input className="form-input" value={brand.companyName}
                    onChange={e => setBrand(p => ({ ...p, companyName: e.target.value }))} />
                </div>
                <div className="form-field" style={{ width: 72, marginBottom: 0 }}>
                  <label className="form-label">Logo Letter</label>
                  <input className="form-input" maxLength={2} value={brand.logoLetter}
                    style={{ textTransform: 'uppercase', textAlign: 'center' }}
                    onChange={e => setBrand(p => ({ ...p, logoLetter: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Tagline</label>
                <input className="form-input" value={brand.tagline}
                  onChange={e => setBrand(p => ({ ...p, tagline: e.target.value }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Address</label>
                <input className="form-input" value={brand.address}
                  onChange={e => setBrand(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">GST Number</label>
                  <input className="form-input" value={brand.gst}
                    onChange={e => setBrand(p => ({ ...p, gst: e.target.value }))} />
                </div>
                <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={brand.email}
                    onChange={e => setBrand(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Phone</label>
                <input className="form-input" value={brand.phone}
                  onChange={e => setBrand(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Accent Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                  {ACCENT_COLORS.map(c => (
                    <button key={c.hex} type="button" title={c.label}
                      onClick={() => setBrand(p => ({ ...p, accentColor: c.hex }))}
                      style={{
                        width: 30, height: 30, borderRadius: '50%', background: c.hex,
                        border: 'none', cursor: 'pointer',
                        outline: brand.accentColor === c.hex ? `3px solid ${c.hex}` : '3px solid transparent',
                        outlineOffset: 3,
                      }} />
                  ))}
                  <input type="color" value={brand.accentColor} title="Custom color"
                    onChange={e => setBrand(p => ({ ...p, accentColor: e.target.value }))}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text2)', marginLeft: 4 }}>{brand.accentColor}</span>
                </div>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Footer Note <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional — replaces default footer)</span></label>
                <input className="form-input" placeholder="e.g. MSME registered · UPI: pay@nimbusworks"
                  value={brand.footerNote}
                  onChange={e => setBrand(p => ({ ...p, footerNote: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowTemplate(false)}>Cancel</button>
              <button className="btn btn-p" disabled={savingBrand} onClick={saveBrand}>
                <i className={savingBrand ? 'ti ti-loader' : brandSaved ? 'ti ti-check' : 'ti ti-device-floppy'} />
                {savingBrand ? 'Saving…' : brandSaved ? 'Saved!' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Paid popup */}
      {payInvoice && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPayInvoice(null); }}>
          <div className={`modal ${styles.payModal}`}>
            <div className="modal-header">
              <span className="modal-title">Mark as Paid</span>
              <button className="modal-close" onClick={() => setPayInvoice(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className={styles.payDetails}>
                <div className={styles.payRow}>
                  <span className={styles.payLabel}>Invoice</span>
                  <span className={styles.payValue}>{payInvoice.invoiceNumber}</span>
                </div>
                <div className={styles.payRow}>
                  <span className={styles.payLabel}>Client</span>
                  <span className={styles.payValue}>{payInvoice.client}</span>
                </div>
                <div className={styles.payRow}>
                  <span className={styles.payLabel}>Amount</span>
                  <span className={`${styles.payValue} ${styles.payAmount}`}>₹{payInvoice.total.toLocaleString('en-IN')}</span>
                </div>
                <div className={styles.payRow}>
                  <span className={styles.payLabel}>Due Date</span>
                  <span className={styles.payValue}>{payInvoice.dueDate}</span>
                </div>
              </div>
              <div className={styles.payDateRow}>
                <label className="form-label">Payment Date</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={e => setPaidDate(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setPayInvoice(null)}>Cancel</button>
              <button className={`btn ${styles.btnSmGreen}`} style={{ padding: '8px 20px' }} onClick={confirmMarkPaid}>
                <i className="ti ti-circle-check" /> Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
