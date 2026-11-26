'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import { useToast, Toaster } from '@/components/ui/Toast';
import type { OrganizationDetail as OrgDetailType, OrgTransaction } from '@/types';
import { api } from '@/lib/api';
import styles from './OrganizationDetail.module.css';

const colorMap: Record<string, { bg: string; fg: string }> = {
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

const typeBadge: Record<string, string> = { Revenue: 'bg', Expense: 'br' };

const emptyForm = {
  date: '', type: 'Revenue' as OrgTransaction['type'], category: '', description: '', amount: '', gstRate: '18',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

export default function OrganizationDetail({ id }: { id: string }) {
  const router = useRouter();
  const { toasts, dismiss, toast } = useToast();

  const [org, setOrg]           = useState<OrgDetailType | null>(null);
  const [loaded, setLoaded]     = useState(false);
  const [isOpen, setIsOpen]     = useState(false);
  const [editing, setEditing]   = useState<OrgTransaction | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    api.getOrganization(id)
      .then(d => { setOrg(d as OrgDetailType); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  useEffect(() => { load(); }, [id]);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, date: todayStr() });
    setIsOpen(true);
  }

  function openEdit(t: OrgTransaction) {
    setEditing(t);
    setForm({
      date: t.date, type: t.type, category: t.category || '',
      description: t.description || '', amount: String(t.amount), gstRate: String(t.gstRate),
    });
    setIsOpen(true);
  }

  async function save() {
    if (!form.amount) { toast.error('Amount is required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), gstRate: Number(form.gstRate) || 0 };
      if (editing) {
        await api.updateOrgTransaction(editing._id, payload);
        toast.success('Entry updated.');
      } else {
        await api.createOrgTransaction(id, payload);
        toast.success('Entry added.');
      }
      setIsOpen(false);
      load();
    } catch (e: unknown) {
      toast.error(`Failed to save: ${e instanceof Error ? e.message : 'Something went wrong.'}`);
    }
    setSaving(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteOrgTransaction(deleteId);
      toast.success('Entry deleted.');
      load();
    } catch (e: unknown) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : 'Something went wrong.'}`);
    }
    setDeleting(false);
    setDeleteId(null);
  }

  if (!loaded) {
    return <div className="content"><div className={styles.loadingText}>Loading…</div></div>;
  }

  if (!org) {
    return (
      <div className="content">
        <div className={styles.emptyState}>
          <div className={styles.emptyMsg}>Organization not found</div>
          <button className="btn btn-p" onClick={() => router.push('/organizations')}>Back to Organizations</button>
        </div>
      </div>
    );
  }

  const col = colorMap[org.colorKey] || colorMap.emerald;
  const transactions = [...org.transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="topbar">
        <div className={styles.headerLeft}>
          <button className={`btn ${styles.backBtn}`} onClick={() => router.push('/organizations')}>
            <i className="ti ti-arrow-left" />
          </button>
          <div className="avatar" style={{ background: col.bg, color: col.fg }}>{org.initials}</div>
          <div>
            <div className="topbar-title">{org.name}</div>
            <div className={styles.headerSub}>
              {org.gstin || 'No GSTIN on file'}{org.state ? ` · ${org.state}` : ''}
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add Entry</button>
        </div>
      </div>

      <div className="content">
        <div className="grid4">
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-emerald)', '--kpi-tint-border': 'var(--kpi-emerald-border)' } as React.CSSProperties}>
            <div className="kpi-label">Revenue</div>
            <div className="kpi-value">{org.revenue > 0 ? fmt(org.revenue) : '—'}</div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-red)', '--kpi-tint-border': 'var(--kpi-red-border)' } as React.CSSProperties}>
            <div className="kpi-label">Expense</div>
            <div className="kpi-value">{org.expense > 0 ? fmt(org.expense) : '—'}</div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-indigo)', '--kpi-tint-border': 'var(--kpi-indigo-border)' } as React.CSSProperties}>
            <div className="kpi-label">Net Profit</div>
            <div className="kpi-value" style={{ color: org.netProfit >= 0 ? 'var(--emerald)' : 'var(--red)' }}>{fmt(org.netProfit)}</div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-blue)', '--kpi-tint-border': 'var(--kpi-blue-border)' } as React.CSSProperties}>
            <div className="kpi-label">Net GST Payable</div>
            <div className="kpi-value">{fmt(org.netGST)}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>Collected {fmt(org.gstCollected)} · Paid {fmt(org.gstPaid)}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Billing Ledger<span className="card-sub">{transactions.length} entries</span></div>
          {transactions.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyMsg}>No billing entries yet</div>
              <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add first entry</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>GST Rate</th><th>GST Amount</th><th /></tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t._id}>
                    <td>{t.date}</td>
                    <td><span className={`badge ${typeBadge[t.type]}`}>{t.type}</span></td>
                    <td>
                      {t.category && <span className={styles.categoryTag}>{t.category}</span>}
                      {t.description || '—'}
                    </td>
                    <td className={styles.amountCell}>₹{t.amount.toLocaleString('en-IN')}</td>
                    <td>{t.gstRate}%</td>
                    <td>₹{t.gstAmount.toLocaleString('en-IN')}</td>
                    <td>
                      <div className={styles.rowEnd}>
                        <button className={`btn ${styles.btnSm}`} title="Edit" onClick={() => openEdit(t)}>
                          <i className={`ti ti-pencil ${styles.btnSmIcon}`} />
                        </button>
                        <button className={`btn ${styles.btnSmDanger}`} title="Delete" onClick={() => setDeleteId(t._id)}>
                          <i className={`ti ti-trash ${styles.btnSmIcon}`} />
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

      <Modal title={editing ? 'Edit Entry' : 'Add Billing Entry'} isOpen={isOpen} onClose={() => setIsOpen(false)} onSave={save}>
        <div className="form-row">
          <div>
            <label className="form-label">Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as OrgTransaction['type'] })}>
              <option>Revenue</option><option>Expense</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div>
            <label className="form-label">Category <span className={styles.optionalLabel}>(optional)</span></label>
            <input placeholder="e.g. Consulting, Rent" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Amount (₹)</label>
            <input type="number" placeholder="50000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className={styles.descField}>
            <label className="form-label">Description</label>
            <input placeholder="Brief description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="form-label">GST Rate (%)</label>
            <select value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })}>
              <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option>
              <option value="18">18%</option><option value="28">28%</option>
            </select>
          </div>
        </div>
        {Number(form.amount) > 0 && (
          <div className={styles.gstPreview}>
            GST Amount: ₹{Math.round((Number(form.amount) || 0) * (Number(form.gstRate) || 0) / 100).toLocaleString('en-IN')}
          </div>
        )}
      </Modal>

      {deleteId && (
        <DeleteConfirm
          title="Delete Entry"
          message="This will permanently delete this billing entry. This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}

      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
