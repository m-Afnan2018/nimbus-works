'use client';

import { useState, useMemo } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Spinner from '@/components/ui/Spinner/Spinner';
import Avatar from '@/components/ui/Avatar/Avatar';
import { useCredentials, CredentialPayload } from '@/hooks/useCredentials';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuthStore } from '@/store/authStore';
import type { Credential } from '@/types';
import { Plus, Eye, EyeOff, Copy, Pencil, Trash2, ExternalLink, KeyRound, Check } from 'lucide-react';
import styles from './CredentialsTab.module.css';

const CATEGORY_LABEL: Record<Credential['category'], string> = {
  domain: 'Domain', hosting: 'Hosting', ssl: 'SSL', social: 'Social', ads: 'Ads', email: 'Email', other: 'Other',
};

function expiryTone(expiryDate?: string): 'ok' | 'soon' | 'urgent' | null {
  if (!expiryDate) return null;
  const days = differenceInCalendarDays(new Date(expiryDate), new Date());
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'ok';
}

function idOf(x: { _id: string } | string): string {
  return typeof x === 'string' ? x : x._id;
}

const EMPTY_FORM: CredentialPayload = {
  title: '', project: '', department: '', category: 'other',
  username: '', secret: '', url: '', expiryDate: '', notes: '',
  visibility: 'department', allowedUsers: [],
};

export default function CredentialsTab({ projectId }: { projectId: string }) {
  const user = useAuthStore((s) => s.user);
  const { credentials, loading, createCredential, updateCredential, deleteCredential, revealCredential } =
    useCredentials({ project: projectId });
  const { departments } = useDepartments();

  const manageableDeptIds = useMemo(() => {
    if (!user) return new Set<string>();
    if (user.role === 'admin') return new Set(departments.map((d) => d._id));
    return new Set(
      departments.filter((d) => d.heads.some((h) => h.id === user.id)).map((d) => d._id),
    );
  }, [departments, user]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [form, setForm] = useState<CredentialPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, project: projectId });
    setFormOpen(true);
  }

  function openEdit(cred: Credential) {
    setEditing(cred);
    setForm({
      title: cred.title,
      project: projectId,
      department: idOf(cred.department),
      category: cred.category,
      username: cred.username,
      secret: '',
      url: cred.url,
      expiryDate: cred.expiryDate ? cred.expiryDate.slice(0, 10) : '',
      notes: cred.notes,
      visibility: cred.visibility,
      allowedUsers: cred.allowedUsers,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.department || (!editing && !form.secret)) return;
    setSaving(true);
    if (editing) {
      const payload = { ...form };
      if (!payload.secret) delete (payload as Partial<CredentialPayload>).secret;
      await updateCredential(editing._id, payload);
    } else {
      await createCredential(form);
    }
    setSaving(false);
    setFormOpen(false);
  }

  async function handleReveal(cred: Credential) {
    if (revealed[cred._id]) {
      setRevealed((prev) => { const next = { ...prev }; delete next[cred._id]; return next; });
      return;
    }
    setRevealing(cred._id);
    const secret = await revealCredential(cred._id);
    setRevealing(null);
    if (secret !== null) {
      setRevealed((prev) => ({ ...prev, [cred._id]: secret }));
      setTimeout(() => setRevealed((prev) => { const next = { ...prev }; delete next[cred._id]; return next; }), 20000);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteCredential(deleteTarget._id);
    setDeleteTarget(null);
  }

  function toggleAllowedUser(id: string) {
    setForm((prev) => ({
      ...prev,
      allowedUsers: prev.allowedUsers?.includes(id)
        ? prev.allowedUsers.filter((u) => u !== id)
        : [...(prev.allowedUsers ?? []), id],
    }));
  }

  const deptOptions = departments.filter((d) => manageableDeptIds.has(d._id));

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Credentials & Assets</span>
        {deptOptions.length > 0 && (
          <Button size="sm" onClick={openCreate}><Plus size={14} /> Add</Button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}><Spinner /></div>
      ) : credentials.length === 0 ? (
        <div className={styles.empty}>
          <KeyRound size={22} strokeWidth={1.5} />
          <span>No credentials stored for this project yet.</span>
        </div>
      ) : (
        <div className={styles.list}>
          {credentials.map((cred) => {
            const deptId = idOf(cred.department);
            const deptName = typeof cred.department === 'object' ? cred.department.name : '';
            const canManage = manageableDeptIds.has(deptId);
            const tone = expiryTone(cred.expiryDate);
            const isRevealed = !!revealed[cred._id];

            return (
              <div key={cred._id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardTitleRow}>
                    <span className={styles.cardTitle}>{cred.title}</span>
                    <span className={styles.categoryChip}>{CATEGORY_LABEL[cred.category]}</span>
                    {deptName && <span className={styles.deptChip}>{deptName}</span>}
                    {cred.visibility === 'restricted' && (
                      <span className={styles.restrictedChip}>Restricted</span>
                    )}
                  </div>
                  {canManage && (
                    <div className={styles.cardActions}>
                      <button className={styles.iconBtn} title="Edit" onClick={() => openEdit(cred)}>
                        <Pencil size={13} />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Delete" onClick={() => setDeleteTarget(cred)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.cardBody}>
                  {cred.username && (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Username</span>
                      <span className={styles.fieldValue}>{cred.username}</span>
                    </div>
                  )}
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Secret</span>
                    <span className={styles.secretValue}>
                      {isRevealed ? revealed[cred._id] : '••••••••••••'}
                    </span>
                    <button
                      className={styles.iconBtn}
                      title={isRevealed ? 'Hide' : 'Reveal'}
                      onClick={() => handleReveal(cred)}
                      disabled={revealing === cred._id}
                    >
                      {revealing === cred._id ? <Spinner size="sm" /> : isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    {isRevealed && (
                      <button
                        className={styles.iconBtn}
                        title="Copy"
                        onClick={() => navigator.clipboard.writeText(revealed[cred._id])}
                      >
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                  {cred.url && (
                    <a className={styles.urlLink} href={cred.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} /> {cred.url}
                    </a>
                  )}
                  {cred.expiryDate && (
                    <span className={`${styles.expiryBadge} ${tone ? styles[`expiry_${tone}`] : ''}`}>
                      Expires {format(new Date(cred.expiryDate), 'd MMM yyyy')}
                    </span>
                  )}
                  {cred.notes && <div className={styles.notes}>{cred.notes}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <Modal isOpen onClose={() => setFormOpen(false)} title={editing ? 'Edit Credential' : 'Add Credential'} size="md">
          <div className={styles.form}>
            <label className={styles.label}>
              Title
              <input className={styles.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="GoDaddy — clientbrand.com" />
            </label>

            <label className={styles.label}>
              Department
              <select className={styles.input} value={form.department} disabled={!!editing} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">— select —</option>
                {(editing ? departments : deptOptions).map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </label>

            <label className={styles.label}>
              Category
              <select className={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Credential['category'] })}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>

            <label className={styles.label}>
              Username
              <input className={styles.input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </label>

            <label className={styles.label}>
              {editing ? 'New Secret (leave blank to keep current)' : 'Secret'}
              <input className={styles.input} type="password" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
            </label>

            <label className={styles.label}>
              URL
              <input className={styles.input} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" />
            </label>

            <label className={styles.label}>
              Expiry date
              <input className={styles.input} type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </label>

            <label className={styles.label}>
              Notes
              <textarea className={styles.textarea} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>

            <label className={styles.label}>
              Visibility
              <select className={styles.input} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Credential['visibility'] })}>
                <option value="department">Whole department</option>
                <option value="restricted">Restricted — only selected people</option>
              </select>
            </label>

            {form.visibility === 'restricted' && form.department && (
              <label className={styles.label}>
                Allowed people
                <div className={styles.pickerGrid}>
                  {(departments.find((d) => d._id === form.department)?.members ?? []).map((m) => {
                    const selected = !!form.allowedUsers?.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`${styles.pickerChip} ${selected ? styles.pickerChipActive : ''}`}
                        onClick={() => toggleAllowedUser(m.id)}
                      >
                        <Avatar name={m.name || '?'} src={m.avatar} size="sm" />
                        <span className={styles.pickerChipName}>{m.name}</span>
                        {selected && <Check size={11} strokeWidth={3} />}
                      </button>
                    );
                  })}
                  {(departments.find((d) => d._id === form.department)?.members ?? []).length === 0 && (
                    <span className={styles.pickerEmpty}>This department has no members yet.</span>
                  )}
                </div>
              </label>
            )}

            <div className={styles.formActions}>
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.department || (!editing && !form.secret)}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add credential'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal isOpen onClose={() => setDeleteTarget(null)} title="Delete credential" size="sm">
          <p className={styles.confirmText}>Delete &ldquo;{deleteTarget.title}&rdquo;? This cannot be undone.</p>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
