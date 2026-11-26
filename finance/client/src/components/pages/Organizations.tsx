'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import PageHeader from '@/components/ui/PageHeader';
import { useToast, Toaster } from '@/components/ui/Toast';
import type { Organization, ColorKey } from '@/types';
import { api } from '@/lib/api';
import styles from './Organizations.module.css';

const colorMap: Record<string, { bg: string; fg: string }> = {
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

const colorKeys: ColorKey[] = ['emerald', 'indigo', 'blue', 'amber', 'red'];
const colorLabels: Record<ColorKey, string> = { emerald: 'Green', indigo: 'Indigo', blue: 'Blue', amber: 'Amber', red: 'Red' };
const statusBadge: Record<string, string> = { Active: 'bg', Inactive: 'br' };

const emptyForm = {
  name: '', gstin: '', state: '', address: '', status: 'Active' as Organization['status'],
  colorKey: 'emerald' as ColorKey, notes: '',
};

function fmt(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

export default function Organizations() {
  const router = useRouter();
  const { toasts, dismiss, toast } = useToast();

  const [orgs, setOrgs]         = useState<Organization[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [isOpen, setIsOpen]     = useState(false);
  const [editing, setEditing]   = useState<Organization | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    api.getOrganizations()
      .then(d => { setOrgs(d as Organization[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    const nextColor = colorKeys[orgs.length % colorKeys.length];
    setEditing(null);
    setForm({ ...emptyForm, colorKey: nextColor });
    setIsOpen(true);
  }

  function openEdit(o: Organization) {
    setEditing(o);
    setForm({
      name: o.name, gstin: o.gstin || '', state: o.state || '', address: o.address || '',
      status: o.status, colorKey: o.colorKey, notes: o.notes || '',
    });
    setIsOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Organization name is required.'); return; }
    setSaving(true);
    try {
      const initials = form.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const payload = { ...form, initials };
      if (editing) {
        await api.updateOrganization(editing._id, payload);
        toast.success('Organization updated.');
      } else {
        await api.createOrganization(payload);
        toast.success('Organization added.');
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
      await api.deleteOrganization(deleteId);
      setOrgs(prev => prev.filter(o => o._id !== deleteId));
      toast.success('Organization deleted.');
    } catch (e: unknown) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : 'Something went wrong.'}`);
    }
    setDeleting(false);
    setDeleteId(null);
  }

  const totalNetProfit = orgs.reduce((s, o) => s + o.netProfit, 0);
  const totalNetGST    = orgs.reduce((s, o) => s + o.netGST, 0);
  const activeCount    = orgs.filter(o => o.status === 'Active').length;

  return (
    <div>
      <PageHeader title="My Companies">
        <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add Organization</button>
      </PageHeader>

      <div className="content">
        <div className="grid4">
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-indigo)', '--kpi-tint-border': 'var(--kpi-indigo-border)' } as React.CSSProperties}>
            <div className="kpi-label">Organizations</div>
            <div className="kpi-value">{orgs.length}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>{activeCount} active</div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-emerald)', '--kpi-tint-border': 'var(--kpi-emerald-border)' } as React.CSSProperties}>
            <div className="kpi-label">Combined Net Profit</div>
            <div className="kpi-value" style={{ color: totalNetProfit >= 0 ? 'var(--emerald)' : 'var(--red)' }}>{fmt(totalNetProfit)}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>Across all companies</div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-blue)', '--kpi-tint-border': 'var(--kpi-blue-border)' } as React.CSSProperties}>
            <div className="kpi-label">Net GST Payable</div>
            <div className="kpi-value">{fmt(totalNetGST)}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>Collected − Paid</div>
          </div>
          <div className="kpi" style={{ '--kpi-tint': 'var(--kpi-amber)', '--kpi-tint-border': 'var(--kpi-amber-border)' } as React.CSSProperties}>
            <div className="kpi-label">Ledger Entries</div>
            <div className="kpi-value">{orgs.reduce((s, o) => s + o.transactionCount, 0)}</div>
            <div className={`kpi-change ${styles.kpiSub}`}>Total billing rows</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">All Organizations<span className="card-sub">{orgs.length} shown</span></div>
          {!loaded ? (
            <div className={styles.loadingText}>Loading…</div>
          ) : orgs.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyMsg}>No organizations yet</div>
              <button className="btn btn-p" onClick={openAdd}><i className="ti ti-plus" />Add your first company</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Company</th><th>GSTIN</th><th>Revenue</th><th>Expense</th><th>Net Profit</th><th>Net GST</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {orgs.map(o => {
                  const col = colorMap[o.colorKey] || colorMap.emerald;
                  return (
                    <tr key={o._id}>
                      <td>
                        <div className={styles.rowGap9} onClick={() => router.push(`/organizations/${o._id}`)} style={{ cursor: 'pointer' }}>
                          <div className="avatar" style={{ background: col.bg, color: col.fg }}>{o.initials}</div>
                          <div>
                            <div className={styles.orgName}>{o.name}</div>
                            <div className={styles.orgSub}>{o.state || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.gstinCell}>{o.gstin || '—'}</td>
                      <td>{o.revenue > 0 ? fmt(o.revenue) : '—'}</td>
                      <td>{o.expense > 0 ? fmt(o.expense) : '—'}</td>
                      <td style={{ color: o.netProfit >= 0 ? 'var(--emerald)' : 'var(--red)', fontWeight: 700 }}>{fmt(o.netProfit)}</td>
                      <td>{fmt(o.netGST)}</td>
                      <td><span className={`badge ${statusBadge[o.status]}`}>{o.status}</span></td>
                      <td>
                        <div className={styles.rowEnd}>
                          <button className={`btn ${styles.btnSm}`} title="View Ledger" onClick={() => router.push(`/organizations/${o._id}`)}>
                            <i className={`ti ti-eye ${styles.btnSmIcon}`} />
                          </button>
                          <button className={`btn ${styles.btnSm}`} title="Edit" onClick={() => openEdit(o)}>
                            <i className={`ti ti-pencil ${styles.btnSmIcon}`} />
                          </button>
                          <button className={`btn ${styles.btnSmDanger}`} title="Delete" onClick={() => setDeleteId(o._id)}>
                            <i className={`ti ti-trash ${styles.btnSmIcon}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal title={editing ? 'Edit Organization' : 'Add Organization'} isOpen={isOpen} onClose={() => setIsOpen(false)} onSave={save}>
        <div className="form-row">
          <div><label className="form-label">Company Name</label><input placeholder="Acme Pvt Ltd" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="form-label">GSTIN</label><input placeholder="27AABCU1234A1Z5" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
        </div>
        <div className="form-row">
          <div><label className="form-label">State</label><input placeholder="Maharashtra" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
          <div><label className="form-label">Address</label><input placeholder="Registered address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Organization['status'] })}>
              <option>Active</option><option>Inactive</option>
            </select>
          </div>
          <div>
            <label className="form-label">Accent Color</label>
            <select value={form.colorKey} onChange={e => setForm({ ...form, colorKey: e.target.value as ColorKey })}>
              {colorKeys.map(k => <option key={k} value={k}>{colorLabels[k]}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className={styles.notesField}>
            <label className="form-label">Notes <span className={styles.optionalLabel}>(optional)</span></label>
            <input placeholder="Anything worth remembering about this company" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>

      {deleteId && (
        <DeleteConfirm
          title="Delete Organization"
          message="This will permanently delete this organization and all of its billing entries. This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}

      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
