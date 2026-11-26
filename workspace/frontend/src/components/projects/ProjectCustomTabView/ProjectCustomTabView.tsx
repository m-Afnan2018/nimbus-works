'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectTabs } from '@/hooks/useProjectTabs';
import { useTableInstances } from '@/hooks/useTableInstances';
import { useTables } from '@/hooks/useTables';
import TableGrid from '@/components/tables/TableGrid/TableGrid';
import Spinner from '@/components/ui/Spinner/Spinner';
import type { ProjectTab, TableInstance, CustomTable } from '@/types';
import styles from './ProjectCustomTabView.module.css';
import { Plus, Pencil, Trash2, TableProperties, X, Wand2 } from 'lucide-react';

interface ProjectCustomTabViewProps {
  tab: ProjectTab;
  canManage: boolean;
  onTabRenamed: (tabId: string, name: string) => void;
  onTabDeleted: (tabId: string) => void;
  onTemplateChanged: (tabId: string, templateId: string | null) => void;
}

function templateIdOf(t: ProjectTab['defaultTemplate']): string {
  if (!t) return '';
  return typeof t === 'string' ? t : t._id;
}

function templateNameOf(t: ProjectTab['defaultTemplate']): string {
  if (!t || typeof t === 'string') return '';
  return t.name;
}

function creatorNameOf(inst: TableInstance): string {
  return typeof inst.createdBy === 'object' && inst.createdBy ? inst.createdBy.name : '—';
}

function periodLabelOf(inst: TableInstance): string {
  if (inst.periodMonth && inst.periodYear) {
    return `${MONTH_NAMES[inst.periodMonth - 1]} ${inst.periodYear}`;
  }
  return inst.name;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function yearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 3; y <= current + 3; y++) years.push(y);
  return years;
}

export default function ProjectCustomTabView({ tab, canManage, onTabRenamed, onTabDeleted, onTemplateChanged }: ProjectCustomTabViewProps) {
  const { deleteProjectTab, fetchTabInstances, attachTableToTab } = useProjectTabs();
  const { fetchInstance, renameInstance, deleteInstance } = useTableInstances();
  const { fetchTables } = useTables(false);

  const [instances, setInstances] = useState<TableInstance[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TableInstance | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);

  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState(tab.name);

  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editMonth, setEditMonth] = useState(() => new Date().getMonth() + 1);
  const [editYear, setEditYear] = useState(() => new Date().getFullYear());

  const [showAdd, setShowAdd] = useState(false);
  const [availableTables, setAvailableTables] = useState<CustomTable[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [addTemplateId, setAddTemplateId] = useState('');
  const [addMonth, setAddMonth] = useState(() => new Date().getMonth() + 1);
  const [addYear, setAddYear] = useState(() => new Date().getFullYear());
  const [adding, setAdding] = useState(false);

  const [editingDefaultTemplate, setEditingDefaultTemplate] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  const loadInstances = useCallback(async () => {
    setLoadingList(true);
    const list = await fetchTabInstances(tab._id);
    setInstances(list);
    setLoadingList(false);
    return list;
  }, [tab._id, fetchTabInstances]);

  useEffect(() => {
    setHeaderName(tab.name);
    setSelectedId(null);
    setSelected(null);
    loadInstances();
  }, [tab._id, tab.name, loadInstances]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    setLoadingSelected(true);
    fetchInstance(selectedId).then((t) => {
      setSelected(t);
      setLoadingSelected(false);
    });
  }, [selectedId, fetchInstance]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowAdd(false);
        setEditingDefaultTemplate(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const loadAvailableTables = async () => {
    setLoadingAvailable(true);
    const all = await fetchTables(true);
    setAvailableTables(all);
    setLoadingAvailable(false);
    return all;
  };

  const commitHeaderName = async () => {
    const name = headerName.trim();
    setEditingHeader(false);
    if (!name || name === tab.name) { setHeaderName(tab.name); return; }
    onTabRenamed(tab._id, name);
  };

  const handleDeleteTab = async () => {
    if (!confirm(`Delete the "${tab.name}" tab and all ${instances.length} table(s) inside it? This cannot be undone.`)) return;
    const ok = await deleteProjectTab(tab._id);
    if (ok) onTabDeleted(tab._id);
  };

  const openAdd = async () => {
    setShowAdd(true);
    setAddTemplateId(templateIdOf(tab.defaultTemplate));
    await loadAvailableTables();
  };

  const openDefaultTemplateEditor = async () => {
    setEditingDefaultTemplate(true);
    if (availableTables.length === 0) await loadAvailableTables();
  };

  const changeDefaultTemplate = (templateId: string) => {
    setEditingDefaultTemplate(false);
    onTemplateChanged(tab._id, templateId || null);
  };

  const handleAddTable = async () => {
    if (!addTemplateId) return;
    setAdding(true);
    const created = await attachTableToTab(tab._id, addTemplateId, { periodMonth: addMonth, periodYear: addYear });
    setAdding(false);
    if (created) {
      setShowAdd(false);
      setAddTemplateId('');
      await loadInstances();
      setSelectedId(created._id);
    }
  };

  const startEditPeriod = (inst: TableInstance) => {
    setEditingInstanceId(inst._id);
    setEditMonth(inst.periodMonth || new Date().getMonth() + 1);
    setEditYear(inst.periodYear || new Date().getFullYear());
  };

  const commitPeriod = async (instanceId: string, periodMonth: number, periodYear: number) => {
    setEditingInstanceId(null);
    const updated = await renameInstance(instanceId, { periodMonth, periodYear });
    if (updated) {
      setInstances((prev) => prev.map((i) => (i._id === instanceId ? { ...i, name: updated.name, periodMonth: updated.periodMonth, periodYear: updated.periodYear } : i)));
      if (selected?._id === instanceId) setSelected((s) => (s ? { ...s, name: updated.name, periodMonth: updated.periodMonth, periodYear: updated.periodYear } : s));
    }
  };

  const handleDeleteInstance = async (instanceId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const ok = await deleteInstance(instanceId);
    if (ok) {
      setInstances((prev) => prev.filter((i) => i._id !== instanceId));
      if (selectedId === instanceId) { setSelectedId(null); setSelected(null); }
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {editingHeader ? (
          <input
            className={styles.headerInput}
            value={headerName}
            autoFocus
            onChange={(e) => setHeaderName(e.target.value)}
            onBlur={commitHeaderName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHeaderName();
              if (e.key === 'Escape') { setHeaderName(tab.name); setEditingHeader(false); }
            }}
          />
        ) : (
          <h2 className={styles.headerTitle} onClick={() => canManage && setEditingHeader(true)}>
            {tab.name}
            {canManage && <Pencil size={13} className={styles.headerEditIcon} />}
          </h2>
        )}
        {canManage && (
          <button type="button" className={styles.deleteTabBtn} onClick={handleDeleteTab} title="Delete this tab">
            <Trash2 size={13} /> Delete tab
          </button>
        )}
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.tableListWrap}>
            {loadingList ? (
              <div className={styles.sidebarLoading}><Spinner size="sm" /></div>
            ) : instances.length === 0 ? (
              <p className={styles.sidebarEmpty}>No tables yet.</p>
            ) : (
              <table className={styles.instanceTable}>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>By</th>
                    <th>On</th>
                    {canManage && <th aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {instances.map((inst) => (
                    <tr
                      key={inst._id}
                      className={`${styles.instanceRow} ${selectedId === inst._id ? styles.instanceRowActive : ''}`}
                      onClick={() => editingInstanceId !== inst._id && setSelectedId(inst._id)}
                    >
                      <td>
                        {editingInstanceId === inst._id ? (
                          <div className={styles.periodEditRow} onClick={(e) => e.stopPropagation()}>
                            <select
                              className={styles.periodSelect}
                              value={editMonth}
                              autoFocus
                              onChange={(e) => commitPeriod(inst._id, Number(e.target.value), editYear)}
                            >
                              {MONTH_NAMES.map((m, i) => (
                                <option key={m} value={i + 1}>{m.slice(0, 3)}</option>
                              ))}
                            </select>
                            <select
                              className={styles.periodSelect}
                              value={editYear}
                              onChange={(e) => commitPeriod(inst._id, editMonth, Number(e.target.value))}
                            >
                              {yearOptions().map((y) => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className={styles.nameCell} title={periodLabelOf(inst)}>
                            <span className={styles.nameDot} style={{ background: inst.color }} />
                            {periodLabelOf(inst)}
                          </span>
                        )}
                      </td>
                      <td className={styles.metaCell} title={creatorNameOf(inst)}>{creatorNameOf(inst).split(' ')[0]}</td>
                      <td className={styles.metaCell}>{formatDate(inst.createdAt)}</td>
                      {canManage && (
                        <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => startEditPeriod(inst)}
                            title="Change month/year"
                          >
                            <Pencil size={11} />
                          </button>
                          <button type="button" onClick={() => handleDeleteInstance(inst._id, periodLabelOf(inst))} title="Delete">
                            <Trash2 size={11} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {canManage && (
            <div className={styles.defaultTemplateRow}>
              {editingDefaultTemplate ? (
                <select
                  className={styles.defaultTemplateSelect}
                  autoFocus
                  value={templateIdOf(tab.defaultTemplate)}
                  onChange={(e) => changeDefaultTemplate(e.target.value)}
                  onBlur={() => setEditingDefaultTemplate(false)}
                >
                  <option value="">No default</option>
                  {availableTables.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <button type="button" className={styles.defaultTemplateBtn} onClick={openDefaultTemplateEditor}>
                  <Wand2 size={12} />
                  {templateNameOf(tab.defaultTemplate) || 'Set default template'}
                </button>
              )}
              {!editingDefaultTemplate && tab.defaultTemplate && (
                <button
                  type="button"
                  className={styles.defaultTemplateClear}
                  onClick={() => onTemplateChanged(tab._id, null)}
                  title="Clear default template"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}

          {canManage && (
            <div className={styles.addWrap}>
              <button type="button" className={styles.addBtn} onClick={openAdd}>
                <Plus size={14} /> New table
              </button>
              {showAdd && (
                <div className={styles.addPopover} ref={popoverRef}>
                  {loadingAvailable ? (
                    <div className={styles.sidebarLoading}><Spinner size="sm" /></div>
                  ) : availableTables.length === 0 ? (
                    <p className={styles.addEmptyHint}>No table templates available. Create one under <strong>Tables</strong> in the sidebar first.</p>
                  ) : (
                    <>
                      <label className={styles.addLabel}>Template</label>
                      <select
                        className={styles.addSelect}
                        value={addTemplateId}
                        onChange={(e) => setAddTemplateId(e.target.value)}
                      >
                        <option value="">Choose a template…</option>
                        {availableTables.map((t) => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                      <label className={styles.addLabel}>Period</label>
                      <div className={styles.addPeriodRow}>
                        <select
                          className={styles.addSelect}
                          value={addMonth}
                          onChange={(e) => setAddMonth(Number(e.target.value))}
                        >
                          {MONTH_NAMES.map((m, i) => (
                            <option key={m} value={i + 1}>{m}</option>
                          ))}
                        </select>
                        <select
                          className={styles.addSelect}
                          value={addYear}
                          onChange={(e) => setAddYear(Number(e.target.value))}
                        >
                          {yearOptions().map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.addActions}>
                        <button type="button" className={styles.addCancel} onClick={() => setShowAdd(false)}>Cancel</button>
                        <button type="button" className={styles.addSubmit} onClick={handleAddTable} disabled={!addTemplateId || adding}>
                          {adding ? 'Adding…' : 'Create'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        <main className={styles.main}>
          {!selectedId ? (
            <div className={styles.placeholder}>
              <TableProperties size={36} strokeWidth={1.25} />
              <p>{instances.length === 0 ? 'Add your first table above.' : 'Select a table from the list.'}</p>
            </div>
          ) : loadingSelected || !selected ? (
            <div className={styles.mainLoading}><Spinner /></div>
          ) : (
            <TableGrid instance={selected} onChange={setSelected} />
          )}
        </main>
      </div>
    </div>
  );
}
