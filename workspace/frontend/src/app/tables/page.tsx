'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Badge from '@/components/ui/Badge/Badge';
import Spinner from '@/components/ui/Spinner/Spinner';
import TableColumnEditor from '@/components/tables/TableColumnEditor/TableColumnEditor';
import { useTables } from '@/hooks/useTables';
import { useAuthStore } from '@/store/authStore';
import type { CustomTable } from '@/types';
import styles from './tables.module.css';
import { Plus, TableProperties, Pencil, Lock, Unlock, Trash2 } from 'lucide-react';

const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

export default function TablesPage() {
  const user = useAuthStore((s) => s.user);
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';

  const { tables, loading, fetchTables, createTable, updateTable, toggleTableActive, deleteTable, fetchTable } = useTables(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<CustomTable | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [creating, setCreating] = useState(false);

  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaColor, setMetaColor] = useState(PALETTE[0]);
  const [savingMeta, setSavingMeta] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => { if (isManagerOrAdmin) fetchTables(); }, [isManagerOrAdmin, fetchTables]);

  useEffect(() => {
    if (!selectedId) { setSelectedTable(null); return; }
    setDetailLoading(true);
    fetchTable(selectedId).then((t) => {
      setSelectedTable(t);
      setDetailLoading(false);
    });
  }, [selectedId, fetchTable]);

  const selectedMeta = tables.find((t) => t._id === selectedId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const created = await createTable({ name: newName.trim(), description: newDesc.trim(), color: newColor });
    setCreating(false);
    if (created) {
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewColor(PALETTE[0]);
      setSelectedId(created._id);
    }
  };

  const openEditMeta = () => {
    if (!selectedTable) return;
    setMetaName(selectedTable.name);
    setMetaDesc(selectedTable.description || '');
    setMetaColor(selectedTable.color);
    setEditingMeta(true);
  };

  const saveMeta = async () => {
    if (!selectedTable || !metaName.trim()) return;
    setSavingMeta(true);
    const updated = await updateTable(selectedTable._id, { name: metaName.trim(), description: metaDesc.trim(), color: metaColor });
    if (updated) setSelectedTable((t) => (t ? { ...t, ...updated } : t));
    await fetchTables();
    setSavingMeta(false);
    setEditingMeta(false);
  };

  const handleToggleActive = async () => {
    if (!selectedTable) return;
    const updated = await toggleTableActive(selectedTable._id);
    if (updated) setSelectedTable((t) => (t ? { ...t, isActive: updated.isActive } : t));
  };

  const handleDelete = async () => {
    if (!selectedTable) return;
    if (!confirm(`Delete "${selectedTable.name}" permanently? This cannot be undone.`)) return;
    const result = await deleteTable(selectedTable._id);
    if (result.ok) {
      setSelectedId(null);
      setSelectedTable(null);
    } else {
      setError(result.message || 'Failed to delete table.');
    }
  };

  if (!isManagerOrAdmin) {
    return <AppShell title="Tables"><div className={styles.denied}>Access denied. Admin or Manager only.</div></AppShell>;
  }

  const attachedCount = selectedMeta?.projectCount ?? 0;

  return (
    <AppShell title="Tables">
      <div className={styles.page}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>Custom Tables</h2>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New
            </Button>
          </div>

          {loading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : tables.length === 0 ? (
            <p className={styles.emptyHint}>No tables yet. Create your first one.</p>
          ) : (
            <div className={styles.list}>
              {tables.map((t) => (
                <button
                  key={t._id}
                  className={`${styles.listItem} ${selectedId === t._id ? styles.listItemActive : ''}`}
                  onClick={() => setSelectedId(t._id)}
                >
                  <span className={styles.listDot} style={{ background: t.color }} />
                  <span className={styles.listName}>{t.name}</span>
                  {!t.isActive && <Badge variant="default" size="sm">Inactive</Badge>}
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className={styles.main}>
          {!selectedTable ? (
            <div className={styles.placeholder}>
              <TableProperties size={40} strokeWidth={1.25} />
              <p>{detailLoading ? 'Loading…' : 'Select a table, or create a new one.'}</p>
            </div>
          ) : (
            <>
              {error && <div className={styles.errorBanner} onClick={() => setError('')}>{error}</div>}

              <div className={styles.detailHeader}>
                <div className={styles.detailHeaderLeft}>
                  <span className={styles.detailDot} style={{ background: selectedTable.color }} />
                  <div>
                    <div className={styles.detailNameRow}>
                      <h1 className={styles.detailName}>{selectedTable.name}</h1>
                      <button className={styles.iconBtn} onClick={openEditMeta} title="Edit table">
                        <Pencil size={14} />
                      </button>
                    </div>
                    {selectedTable.description && <p className={styles.detailDesc}>{selectedTable.description}</p>}
                    <span className={styles.detailMeta}>
                      {attachedCount > 0 ? `Attached to ${attachedCount} project${attachedCount !== 1 ? 's' : ''}` : 'Not attached to any project'}
                    </span>
                  </div>
                </div>

                <div className={styles.detailActions}>
                  <Badge variant={selectedTable.isActive ? 'success' : 'default'}>
                    {selectedTable.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={handleToggleActive}>
                    {selectedTable.isActive ? <><Lock size={13} /> Deactivate</> : <><Unlock size={13} /> Activate</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleDelete}
                    disabled={attachedCount > 0}
                    title={attachedCount > 0 ? 'Remove this table from all projects first, or deactivate it.' : 'Delete table'}
                  >
                    <Trash2 size={13} /> Delete
                  </Button>
                </div>
              </div>

              <TableColumnEditor table={selectedTable} onChange={setSelectedTable} />
            </>
          )}
        </main>
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Table" size="sm">
        <div className={styles.formBody}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Name <span className={styles.req}>*</span></label>
            <input className={styles.formInput} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Vendor Contacts" autoFocus />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Description</label>
            <textarea className={styles.formTextarea} rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is this table for?" />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Color</label>
            <div className={styles.palette}>
              {PALETTE.map((c) => (
                <button key={c} type="button" className={`${styles.colorSwatch} ${newColor === c ? styles.colorSwatchActive : ''}`} style={{ background: c }} onClick={() => setNewColor(c)} />
              ))}
            </div>
          </div>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>{creating ? 'Creating…' : 'Create Table'}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit meta modal */}
      <Modal isOpen={editingMeta} onClose={() => setEditingMeta(false)} title="Edit Table" size="sm">
        <div className={styles.formBody}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Name <span className={styles.req}>*</span></label>
            <input className={styles.formInput} value={metaName} onChange={(e) => setMetaName(e.target.value)} autoFocus />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Description</label>
            <textarea className={styles.formTextarea} rows={2} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Color</label>
            <div className={styles.palette}>
              {PALETTE.map((c) => (
                <button key={c} type="button" className={`${styles.colorSwatch} ${metaColor === c ? styles.colorSwatchActive : ''}`} style={{ background: c }} onClick={() => setMetaColor(c)} />
              ))}
            </div>
          </div>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setEditingMeta(false)} disabled={savingMeta}>Cancel</Button>
            <Button onClick={saveMeta} disabled={!metaName.trim() || savingMeta}>{savingMeta ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
