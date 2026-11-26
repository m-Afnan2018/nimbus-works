'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Invoice, Expense, DashboardKPIs } from '@/types';
import { api } from '@/lib/api';
import styles from './CashFlow.module.css';

type ViewMode = 'monthly' | 'yearly';

interface TxEntry {
  date: string;
  type: 'credit' | 'debit';
  label: string;
  ref: string;
  category: string;
  amount: number;
}

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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
function esc(s: string) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function creditDate(inv: Invoice) { return inv.paidDate || inv.date || ''; }

export default function CashFlow() {
  const [view, setView]         = useState<ViewMode>('monthly');
  const [month, setMonth]       = useState(nowMonth);
  const [year, setYear]         = useState(() => new Date().getFullYear());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [kpis, setKpis]         = useState<DashboardKPIs | null>(null);
  const [loaded, setLoaded]     = useState(false);
  const [brand, setBrand]       = useState<Brand>(DEFAULT_BRAND);

  useEffect(() => {
    Promise.all([
      api.getInvoices()     as Promise<Invoice[]>,
      api.getExpenses()     as Promise<Expense[]>,
      api.getInvoiceBrand() as Promise<Brand>,
      api.getDashboardKPIs() as Promise<DashboardKPIs>,
    ]).then(([inv, exp, br, kpiData]) => {
      setInvoices(inv); setExpenses(exp); setBrand(br); setKpis(kpiData); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // ── Monthly ───────────────────────────────────────────────────────────────

  const monthCredits = useMemo(
    () => invoices.filter(i => i.status === 'Paid' && creditDate(i).startsWith(month)),
    [invoices, month],
  );
  const monthDebits = useMemo(
    () => expenses.filter(e => (e.date || '').startsWith(month)),
    [expenses, month],
  );
  const transactions = useMemo<TxEntry[]>(() => {
    const credits: TxEntry[] = monthCredits.map(i => ({
      date: creditDate(i), type: 'credit',
      label: i.client, ref: i.invoiceNumber,
      category: 'Invoice', amount: i.total,
    }));
    const debits: TxEntry[] = monthDebits.map(e => ({
      date: e.date, type: 'debit',
      label: e.vendor || e.category, ref: e.description || e.category,
      category: e.category, amount: e.amount,
    }));
    return [...credits, ...debits].sort((a, b) => b.date.localeCompare(a.date));
  }, [monthCredits, monthDebits]);

  const totalIn    = monthCredits.reduce((s, i) => s + i.total, 0);
  const totalOut   = monthDebits.reduce((s, e) => s + e.amount, 0);
  const netFlow    = totalIn - totalOut;
  const outstanding = invoices.filter(i => ['Pending','Overdue','Partial'].includes(i.status)).reduce((s, i) => s + i.total, 0);

  // ── Yearly ────────────────────────────────────────────────────────────────

  const yearRows = useMemo(() => {
    const ys = String(year);
    const maxVal = Math.max(1, ...MONTHS.map((_, idx) => {
      const ms = `${ys}-${String(idx + 1).padStart(2, '0')}`;
      const c = invoices.filter(i => i.status === 'Paid' && creditDate(i).startsWith(ms)).reduce((s, i) => s + i.total, 0);
      const d = expenses.filter(e => (e.date || '').startsWith(ms)).reduce((s, e) => s + e.amount, 0);
      return Math.max(c, d);
    }));
    return MONTHS.map((label, idx) => {
      const ms      = `${ys}-${String(idx + 1).padStart(2, '0')}`;
      const credits = invoices.filter(i => i.status === 'Paid' && creditDate(i).startsWith(ms)).reduce((s, i) => s + i.total, 0);
      const debits  = expenses.filter(e => (e.date || '').startsWith(ms)).reduce((s, e) => s + e.amount, 0);
      return { label, ms, credits, debits, net: credits - debits, maxVal };
    });
  }, [invoices, expenses, year]);

  const yearTotalIn  = yearRows.reduce((s, r) => s + r.credits, 0);
  const yearTotalOut = yearRows.reduce((s, r) => s + r.debits, 0);
  const yearNet      = yearTotalIn - yearTotalOut;
  const yearPending  = invoices
    .filter(i => ['Pending','Overdue','Partial'].includes(i.status) && (i.date||'').startsWith(String(year)))
    .reduce((s, i) => s + i.total, 0);

  // ── All-time summary (for top section) ───────────────────────────────────

  const allInflow  = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
  const allOutflow = expenses.reduce((s, e) => s + e.amount, 0);
  const allNet     = allInflow - allOutflow;
  const pendingReceivables = invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.total, 0);
  const bankBalance = kpis?.cashInBank ?? 0;
  const monthlyBurn = kpis?.monthlyBurn ?? 0;
  const runway      = monthlyBurn > 0 ? (bankBalance / monthlyBurn).toFixed(1) : '—';

  // ── Print ────────────────────────────────────────────────────────────────

  function printReport() {
    const accent = brand.accentColor;
    const footer = esc(brand.footerNote || `${brand.companyName} · ${brand.email} · ${brand.phone}`);
    const now    = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const nc = (n: number) => n >= 0 ? '#059669' : '#dc2626';
    const ns = (n: number) => n >= 0 ? '+' : '−';

    const css = `
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#0f172a;background:#fff;padding:40px;max-width:960px;margin:0 auto}
      .hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
      .logo{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#10b981,${accent});display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex-shrink:0}
      .co-name{font-size:17px;font-weight:800}.co-sub{font-size:11px;color:#64748b;margin-top:2px}
      .rt{font-size:26px;font-weight:900;color:${accent};text-align:right;letter-spacing:-0.5px}
      .rs{font-size:13px;font-weight:600;text-align:right;margin-top:4px}
      .rm{font-size:11px;color:#64748b;text-align:right;margin-top:6px;line-height:1.7}
      hr{border:none;border-top:2px solid #e2e8f0;margin:20px 0}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
      .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
      .kl{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
      .kv{font-size:20px;font-weight:800}.ks{font-size:11px;color:#64748b;margin-top:4px}
      .g{color:#059669}.r{color:#dc2626}.a{color:#d97706}
      table{width:100%;border-collapse:collapse}
      th{padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0;background:#f8fafc}
      td{padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155}
      .bc{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;background:#d1fae5;color:#065f46}
      .bd{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;background:#fee2e2;color:#991b1b}
      .tar{text-align:right}.tac{text-align:center}
      .ac{color:#059669;font-weight:600}.ad{color:#dc2626;font-weight:600}
      .fr td{background:#f8fafc;border-top:2px solid #0f172a !important;font-weight:700;font-size:14px;padding:12px}
      .bw{display:flex;flex-direction:column;gap:2px;width:90px}
      .bc2{height:5px;border-radius:3px;background:#059669;min-width:2px}
      .bd2{height:5px;border-radius:3px;background:#dc2626;min-width:2px}
      .ft{margin-top:36px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}
      @media print{body{padding:20px}}
    `;

    let body = '';
    if (view === 'monthly') {
      const rows = transactions.map(tx => `<tr>
        <td style="font-size:12px;color:#64748b;white-space:nowrap">${esc(tx.date||'—')}</td>
        <td><span class="${tx.type==='credit'?'bc':'bd'}">${tx.type==='credit'?'↙ Credit':'↗ Debit'}</span></td>
        <td style="font-weight:600">${esc(tx.label||'—')}</td>
        <td style="font-size:12px;color:#64748b;font-family:monospace">${esc(tx.ref||'—')}</td>
        <td><span style="font-size:11px;background:#f1f5f9;padding:2px 8px;border-radius:12px">${esc(tx.category)}</span></td>
        <td class="tar"><span class="${tx.type==='credit'?'ac':'ad'}">${tx.type==='credit'?'+':'−'}₹${tx.amount.toLocaleString('en-IN')}</span></td>
      </tr>`).join('');
      body = `
        <div class="kpis">
          <div class="kpi"><div class="kl">Credits In</div><div class="kv g">₹${totalIn.toLocaleString('en-IN')}</div><div class="ks">${monthCredits.length} paid</div></div>
          <div class="kpi"><div class="kl">Debits Out</div><div class="kv r">₹${totalOut.toLocaleString('en-IN')}</div><div class="ks">${monthDebits.length} expenses</div></div>
          <div class="kpi"><div class="kl">Net Flow</div><div class="kv" style="color:${nc(netFlow)}">${ns(netFlow)}₹${Math.abs(netFlow).toLocaleString('en-IN')}</div><div class="ks">${esc(fmtMonth(month))}</div></div>
          <div class="kpi"><div class="kl">Outstanding</div><div class="kv a">₹${outstanding.toLocaleString('en-IN')}</div><div class="ks">${invoices.filter(i=>['Pending','Overdue','Partial'].includes(i.status)).length} unpaid</div></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Client / Vendor</th><th>Reference</th><th>Category</th><th class="tar">Amount</th></tr></thead>
          <tbody>${rows||'<tr><td colspan="6" class="tac" style="padding:20px;color:#94a3b8;font-style:italic">No transactions</td></tr>'}</tbody>
          <tfoot><tr class="fr"><td colspan="5">Net Flow — ${esc(fmtMonth(month))}</td><td class="tar" style="color:${nc(netFlow)}">${ns(netFlow)}₹${Math.abs(netFlow).toLocaleString('en-IN')}</td></tr></tfoot>
        </table>`;
    } else {
      const rows = yearRows.map(r => {
        const h = r.credits > 0 || r.debits > 0;
        const cp = Math.round((r.credits / r.maxVal) * 100);
        const dp = Math.round((r.debits  / r.maxVal) * 100);
        return `<tr>
          <td style="font-weight:600">${esc(r.label)} ${year}</td>
          <td class="tar"><span class="${r.credits>0?'ac':''}" style="${r.credits===0?'color:#94a3b8':''}">${r.credits>0?`+₹${r.credits.toLocaleString('en-IN')}`:'—'}</span></td>
          <td class="tar"><span class="${r.debits>0?'ad':''}" style="${r.debits===0?'color:#94a3b8':''}">${r.debits>0?`−₹${r.debits.toLocaleString('en-IN')}`:'—'}</span></td>
          <td class="tar" style="color:${nc(r.net)};font-weight:700">${h?`${ns(r.net)}₹${Math.abs(r.net).toLocaleString('en-IN')}`:'—'}</td>
          <td>${h?`<div class="bw"><div class="bc2" style="width:${cp}%"></div><div class="bd2" style="width:${dp}%"></div></div>`:''}</td>
        </tr>`;
      }).join('');
      body = `
        <div class="kpis">
          <div class="kpi"><div class="kl">Total Credits</div><div class="kv g">₹${yearTotalIn.toLocaleString('en-IN')}</div><div class="ks">FY ${year}</div></div>
          <div class="kpi"><div class="kl">Total Debits</div><div class="kv r">₹${yearTotalOut.toLocaleString('en-IN')}</div><div class="ks">FY ${year}</div></div>
          <div class="kpi"><div class="kl">Net Profit</div><div class="kv" style="color:${nc(yearNet)}">${ns(yearNet)}₹${Math.abs(yearNet).toLocaleString('en-IN')}</div><div class="ks">FY ${year}</div></div>
          <div class="kpi"><div class="kl">Outstanding</div><div class="kv a">₹${yearPending.toLocaleString('en-IN')}</div><div class="ks">FY ${year}</div></div>
        </div>
        <table>
          <thead><tr><th>Month</th><th class="tar">Credits In</th><th class="tar">Debits Out</th><th class="tar">Net Flow</th><th>Trend</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr class="fr"><td>Total ${year}</td><td class="tar ac">+₹${yearTotalIn.toLocaleString('en-IN')}</td><td class="tar ad">−₹${yearTotalOut.toLocaleString('en-IN')}</td><td class="tar" style="color:${nc(yearNet)}">${ns(yearNet)}₹${Math.abs(yearNet).toLocaleString('en-IN')}</td><td></td></tr></tfoot>
        </table>`;
    }

    const title = view === 'monthly' ? `Cash Flow — ${fmtMonth(month)}` : `Cash Flow — FY ${year}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>
<div class="hd">
  <div style="display:flex;align-items:center;gap:12px">
    <div class="logo">${esc(brand.logoLetter)}</div>
    <div><div class="co-name">${esc(brand.companyName)}</div><div class="co-sub">${esc(brand.tagline)}</div><div class="co-sub">${esc(brand.address)}</div><div class="co-sub">GST: ${esc(brand.gst)}</div></div>
  </div>
  <div><div class="rt">CASH FLOW REPORT</div><div class="rs">${esc(view==='monthly'?fmtMonth(month):`FY ${year}`)}</div><div class="rm">Generated: ${now}<br>${esc(brand.email)} · ${esc(brand.phone)}</div></div>
</div>
<hr>${body}
<div class="ft">${footer}</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=760');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Cash Flow</div>
        <div className="topbar-right">
          <div className={styles.viewToggle}>
            <button className={view === 'monthly' ? styles.toggleActive : styles.toggleBtn} onClick={() => setView('monthly')}>
              <i className="ti ti-calendar-month" /> Monthly
            </button>
            <button className={view === 'yearly' ? styles.toggleActive : styles.toggleBtn} onClick={() => setView('yearly')}>
              <i className="ti ti-calendar" /> Yearly
            </button>
          </div>
          <button className="btn" onClick={printReport} disabled={!loaded}>
            <i className="ti ti-printer" /> Print / PDF
          </button>
        </div>
      </div>

      <div className="content">

        {/* ── All-time summary ── */}
        <div className="cf-sum">
          <div className="cf-item">
            <div className="cf-label">Cash Inflow</div>
            <div className={`cf-val ${styles.valGreen}`}>{fmt(allInflow)}</div>
          </div>
          <div className="cf-item">
            <div className="cf-label">Cash Outflow</div>
            <div className={`cf-val ${styles.valRed}`}>{fmt(allOutflow)}</div>
          </div>
          <div className="cf-item">
            <div className="cf-label">Net Cash Flow</div>
            <div className={`cf-val ${allNet >= 0 ? styles.valGreen : styles.valRed}`}>{fmt(allNet)}</div>
          </div>
        </div>

        <div className="grid2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-title">Cash Flow Chart<span className="card-sub">No data yet</span></div>
            <div className={styles.placeholder}>Add invoices and expenses to see monthly cash flow</div>
          </div>
          <div className="card">
            <div className="card-title">Runway &amp; Forecast</div>
            {[
              { k: 'Current Bank Balance',              v: fmt(bankBalance),                         c: 'var(--emerald)' },
              { k: 'Monthly Burn Rate',                 v: fmt(monthlyBurn),                         c: 'var(--red)' },
              { k: 'Cash Runway',                       v: runway === '—' ? '—' : `${runway} months`, c: 'var(--amber)' },
              { k: 'Pending Receivables',               v: fmt(pendingReceivables),                  c: '' },
              { k: 'Total Recorded Expenses',           v: fmt(allOutflow),                          c: '' },
              { k: 'Net Position (Receivables − Exp.)', v: fmt(pendingReceivables - allOutflow),     c: pendingReceivables - allOutflow >= 0 ? 'var(--emerald)' : 'var(--red)' },
            ].map(row => (
              <div key={row.k} className="stat-row">
                <span className="sk">{row.k}</span>
                <span className="sv" style={row.c ? { color: row.c } : {}}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.sectionDivider}>
          <span className={styles.sectionLabel}>Transaction Ledger</span>
        </div>

        {/* ── Monthly ── */}
        {view === 'monthly' && (<>
          <div className={styles.monthNav}>
            <button className={`btn ${styles.navBtn}`} onClick={() => setMonth(m => shiftMonth(m, -1))}><i className="ti ti-chevron-left" /></button>
            <span className={styles.navLabel}>{fmtMonth(month)}</span>
            <button className={`btn ${styles.navBtn}`} onClick={() => setMonth(m => shiftMonth(m, 1))}><i className="ti ti-chevron-right" /></button>
          </div>

          <div className={`grid4 ${styles.gridMb}`}>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-emerald)', '--kpi-tint-border': 'var(--kpi-emerald-border)' } as React.CSSProperties}>
              <div className="kpi-label">Credits In</div>
              <div className={`kpi-value ${styles.valGreen}`}>{fmt(totalIn)}</div>
              <div className={`kpi-change ${styles.sub}`}>{monthCredits.length} invoice{monthCredits.length !== 1 ? 's' : ''} paid</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-red)', '--kpi-tint-border': 'var(--kpi-red-border)' } as React.CSSProperties}>
              <div className="kpi-label">Debits Out</div>
              <div className={`kpi-value ${styles.valRed}`}>{fmt(totalOut)}</div>
              <div className={`kpi-change ${styles.sub}`}>{monthDebits.length} expense{monthDebits.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': netFlow >= 0 ? 'var(--kpi-emerald)' : 'var(--kpi-red)', '--kpi-tint-border': netFlow >= 0 ? 'var(--kpi-emerald-border)' : 'var(--kpi-red-border)' } as React.CSSProperties}>
              <div className="kpi-label">Net Flow</div>
              <div className={`kpi-value ${netFlow >= 0 ? styles.valGreen : styles.valRed}`}>
                {netFlow >= 0 ? '+' : ''}{fmt(netFlow)}
              </div>
              <div className={`kpi-change ${styles.sub}`}>{fmtMonth(month)}</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-amber)', '--kpi-tint-border': 'var(--kpi-amber-border)' } as React.CSSProperties}>
              <div className="kpi-label">Outstanding</div>
              <div className={`kpi-value ${styles.valAmber}`}>{fmt(outstanding)}</div>
              <div className={`kpi-change ${styles.sub}`}>
                {invoices.filter(i => ['Pending','Overdue','Partial'].includes(i.status)).length} unpaid
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              Ledger — {fmtMonth(month)}
              <span className="card-sub">{transactions.length} entries</span>
            </div>
            {!loaded ? (
              <div className={styles.empty}>Loading…</div>
            ) : transactions.length === 0 ? (
              <div className={styles.empty}>No transactions in {fmtMonth(month)}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Type</th><th>Client / Vendor</th>
                    <th>Reference</th><th>Category</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr key={i}>
                      <td className={styles.dateCell}>{tx.date || '—'}</td>
                      <td>
                        <span className={tx.type === 'credit' ? styles.badgeCredit : styles.badgeDebit}>
                          {tx.type === 'credit'
                            ? <><i className="ti ti-arrow-down-left" /> Credit</>
                            : <><i className="ti ti-arrow-up-right" /> Debit</>}
                        </span>
                      </td>
                      <td className={styles.labelCell}>{tx.label || '—'}</td>
                      <td className={styles.refCell}>{tx.ref || '—'}</td>
                      <td><span className="badge bb">{tx.category}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={tx.type === 'credit' ? styles.amtCredit : styles.amtDebit}>
                          {tx.type === 'credit' ? '+' : '−'}₹{tx.amount.toLocaleString('en-IN')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.footerRow}>
                    <td colSpan={5} style={{ fontWeight: 700 }}>Net Flow — {fmtMonth(month)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={netFlow >= 0 ? styles.amtCredit : styles.amtDebit} style={{ fontWeight: 800, fontSize: '15px' }}>
                        {netFlow >= 0 ? '+' : '−'}₹{Math.abs(netFlow).toLocaleString('en-IN')}
                      </span>
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
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-emerald)', '--kpi-tint-border': 'var(--kpi-emerald-border)' } as React.CSSProperties}>
              <div className="kpi-label">Total Credits</div>
              <div className={`kpi-value ${styles.valGreen}`}>{fmt(yearTotalIn)}</div>
              <div className={`kpi-change ${styles.sub}`}>FY {year}</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-red)', '--kpi-tint-border': 'var(--kpi-red-border)' } as React.CSSProperties}>
              <div className="kpi-label">Total Debits</div>
              <div className={`kpi-value ${styles.valRed}`}>{fmt(yearTotalOut)}</div>
              <div className={`kpi-change ${styles.sub}`}>FY {year}</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': yearNet >= 0 ? 'var(--kpi-emerald)' : 'var(--kpi-red)', '--kpi-tint-border': yearNet >= 0 ? 'var(--kpi-emerald-border)' : 'var(--kpi-red-border)' } as React.CSSProperties}>
              <div className="kpi-label">Net Profit</div>
              <div className={`kpi-value ${yearNet >= 0 ? styles.valGreen : styles.valRed}`}>
                {yearNet >= 0 ? '+' : ''}{fmt(yearNet)}
              </div>
              <div className={`kpi-change ${styles.sub}`}>FY {year}</div>
            </div>
            <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-amber)', '--kpi-tint-border': 'var(--kpi-amber-border)' } as React.CSSProperties}>
              <div className="kpi-label">Outstanding</div>
              <div className={`kpi-value ${styles.valAmber}`}>{fmt(yearPending)}</div>
              <div className={`kpi-change ${styles.sub}`}>
                {invoices.filter(i => ['Pending','Overdue','Partial'].includes(i.status) && (i.date||'').startsWith(String(year))).length} unpaid
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              Month Breakdown — {year}
              <span className="card-sub">Click a row to drill in</span>
            </div>
            {!loaded ? (
              <div className={styles.empty}>Loading…</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}>Credits In</th>
                    <th style={{ textAlign: 'right' }}>Debits Out</th>
                    <th style={{ textAlign: 'right' }}>Net Flow</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {yearRows.map(row => {
                    const hasData = row.credits > 0 || row.debits > 0;
                    const cp = (row.credits / row.maxVal) * 100;
                    const dp = (row.debits  / row.maxVal) * 100;
                    return (
                      <tr key={row.ms} className={styles.yearRow} onClick={() => { setMonth(row.ms); setView('monthly'); }}>
                        <td className={styles.monthCell}>{row.label} {year}</td>
                        <td style={{ textAlign: 'right' }}><span className={row.credits > 0 ? styles.amtCredit : styles.dim}>{row.credits > 0 ? `+${fmt(row.credits)}` : '—'}</span></td>
                        <td style={{ textAlign: 'right' }}><span className={row.debits > 0 ? styles.amtDebit : styles.dim}>{row.debits > 0 ? `−${fmt(row.debits)}` : '—'}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {hasData
                            ? <span className={row.net >= 0 ? styles.amtCredit : styles.amtDebit} style={{ fontWeight: 700 }}>{row.net >= 0 ? '+' : '−'}{fmt(Math.abs(row.net))}</span>
                            : <span className={styles.dim}>—</span>}
                        </td>
                        <td>
                          {hasData && (
                            <div className={styles.miniBarWrap}>
                              <div className={styles.miniBarCredit} style={{ width: `${cp}%` }} />
                              <div className={styles.miniBarDebit}  style={{ width: `${dp}%` }} />
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
                    <td style={{ textAlign: 'right' }}><span className={styles.amtCredit} style={{ fontWeight: 800 }}>+{fmt(yearTotalIn)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className={styles.amtDebit} style={{ fontWeight: 800 }}>−{fmt(yearTotalOut)}</span></td>
                    <td style={{ textAlign: 'right' }}><span className={yearNet >= 0 ? styles.amtCredit : styles.amtDebit} style={{ fontWeight: 800, fontSize: '15px' }}>{yearNet >= 0 ? '+' : '−'}{fmt(Math.abs(yearNet))}</span></td>
                    <td />
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
