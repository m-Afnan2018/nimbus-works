'use client';

import { useState, useRef, useEffect } from 'react';
import { useTables } from '@/hooks/useTables';
import type { CustomTable, ColumnType, AutoFill } from '@/types';
import styles from './TableColumnEditor.module.css';
import {
  Type, AlignLeft, Hash, Calendar, Clock, Link as LinkIcon, Palette, CheckSquare,
  Plus, X, GripVertical, Wand2, List,
} from 'lucide-react';

/** Which auto-fill option (if any) a given column type supports, and how to describe it. */
const AUTO_FILL_BY_TYPE: Partial<Record<ColumnType, { value: AutoFill; label: string; hint: string }>> = {
  number: { value: 'serial', label: 'Serial #', hint: 'Auto-fill the next serial number (1, 2, 3…) when a row is added.' },
  date: { value: 'today', label: "Today's date", hint: "Auto-fill today's date when a row is added." },
  time: { value: 'now', label: 'Current time', hint: 'Auto-fill the current time when a row is added.' },
};

interface TableColumnEditorProps {
  table: CustomTable;
  onChange: (table: CustomTable) => void;
}

const TYPE_META: Record<ColumnType, { label: string; icon: React.ReactNode }> = {
  text: { label: 'Text', icon: <Type size={14} /> },
  content: { label: 'Content', icon: <AlignLeft size={14} /> },
  number: { label: 'Number', icon: <Hash size={14} /> },
  date: { label: 'Date', icon: <Calendar size={14} /> },
  time: { label: 'Time', icon: <Clock size={14} /> },
  link: { label: 'Link', icon: <LinkIcon size={14} /> },
  color: { label: 'Color', icon: <Palette size={14} /> },
  checkbox: { label: 'Checkbox', icon: <CheckSquare size={14} /> },
};

const TYPE_ORDER: ColumnType[] = ['text', 'content', 'number', 'date', 'time', 'link', 'color', 'checkbox'];

export default function TableColumnEditor({ table, onChange }: TableColumnEditorProps) {
  const { addColumn, updateColumn, deleteColumn, reorderColumns } = useTables(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [typeMenuId, setTypeMenuId] = useState<string | null>(null);
  const [optionsEditorId, setOptionsEditorId] = useState<string | null>(null);
  const [optionInput, setOptionInput] = useState('');

  const [addingField, setAddingField] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<ColumnType>('text');
  const [newAutoFill, setNewAutoFill] = useState<AutoFill>('none');
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  const columns = [...table.columns].sort((a, b) => a.order - b.order);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setTypeMenuId(null);
        setOptionsEditorId(null);
        setAddingField(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const commitLabel = async (columnId: string) => {
    const label = editLabel.trim();
    setEditingId(null);
    if (!label) return;
    const updated = await updateColumn(table._id, columnId, { label });
    if (updated) onChange(updated);
  };

  const changeType = async (columnId: string, type: ColumnType) => {
    setTypeMenuId(null);
    // Server also resets autoFill if it's no longer compatible with the new type,
    // but we pass 'none' explicitly so the UI doesn't show a stale option mid-flight.
    const updated = await updateColumn(table._id, columnId, { type, autoFill: 'none' });
    if (updated) onChange(updated);
  };

  const toggleAutoFill = async (columnId: string, type: ColumnType, current: AutoFill) => {
    const option = AUTO_FILL_BY_TYPE[type];
    if (!option) return;
    const next: AutoFill = current === option.value ? 'none' : option.value;
    const updated = await updateColumn(table._id, columnId, { autoFill: next });
    if (updated) onChange(updated);
  };

  const addOption = async (columnId: string, current: string[]) => {
    const v = optionInput.trim();
    if (!v || current.includes(v)) return;
    setOptionInput('');
    const updated = await updateColumn(table._id, columnId, { options: [...current, v] });
    if (updated) onChange(updated);
  };

  const removeOption = async (columnId: string, current: string[], value: string) => {
    const updated = await updateColumn(table._id, columnId, { options: current.filter((o) => o !== value) });
    if (updated) onChange(updated);
  };

  const handleDelete = async (columnId: string) => {
    if (!confirm('Delete this field? This cannot be undone.')) return;
    const updated = await deleteColumn(table._id, columnId);
    if (updated) onChange(updated);
  };

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const ids = columns.map((c) => c._id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setDragId(null);
    setDragOverId(null);
    const updated = await reorderColumns(table._id, ids);
    if (updated) onChange(updated);
  };

  const addNewOption = () => {
    const v = newOptionInput.trim();
    if (!v || newOptions.includes(v)) return;
    setNewOptions((prev) => [...prev, v]);
    setNewOptionInput('');
  };

  const handleAddField = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    const updated = await addColumn(table._id, { label: newLabel.trim(), type: newType, autoFill: newAutoFill, options: newOptions });
    if (updated) onChange(updated);
    setSaving(false);
    setNewLabel('');
    setNewType('text');
    setNewAutoFill('none');
    setNewOptions([]);
    setNewOptionInput('');
    setAddingField(false);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.listHeader}>
        <span className={styles.colFieldName}>Field Name</span>
        <span className={styles.colFieldType}>Type</span>
        <span className={styles.colFieldType}>Auto-fill</span>
        <span className={styles.colFieldActions} />
      </div>

      {columns.length === 0 ? (
        <p className={styles.emptyHint}>No fields yet. Add your first one below.</p>
      ) : (
        <div className={styles.list}>
          {columns.map((col) => (
            <div
              key={col._id}
              className={`${styles.row} ${dragOverId === col._id ? styles.rowDragOver : ''}`}
              draggable
              onDragStart={() => setDragId(col._id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(col._id); }}
              onDragLeave={() => setDragOverId((c) => (c === col._id ? null : c))}
              onDrop={() => handleDrop(col._id)}
            >
              <GripVertical size={14} className={styles.gripIcon} />

              {editingId === col._id ? (
                <input
                  className={styles.nameInput}
                  value={editLabel}
                  autoFocus
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={() => commitLabel(col._id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitLabel(col._id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <span
                  className={styles.nameLabel}
                  onClick={() => { setEditingId(col._id); setEditLabel(col.label); }}
                >
                  {col.label}
                </span>
              )}

              <div className={styles.typeWrap}>
                <button
                  type="button"
                  className={styles.typeBtn}
                  onClick={() => setTypeMenuId((id) => (id === col._id ? null : col._id))}
                >
                  {TYPE_META[col.type].icon}
                  <span>{TYPE_META[col.type].label}</span>
                </button>

                {typeMenuId === col._id && (
                  <div className={styles.typeMenu} ref={popoverRef}>
                    {TYPE_ORDER.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`${styles.typeMenuItem} ${t === col.type ? styles.typeMenuItemActive : ''}`}
                        onClick={() => changeType(col._id, t)}
                      >
                        {TYPE_META[t].icon}
                        <span>{TYPE_META[t].label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {AUTO_FILL_BY_TYPE[col.type] ? (
                <button
                  type="button"
                  className={`${styles.autoFillChip} ${col.autoFill === AUTO_FILL_BY_TYPE[col.type]!.value ? styles.autoFillChipActive : ''}`}
                  onClick={() => toggleAutoFill(col._id, col.type, col.autoFill)}
                  title={AUTO_FILL_BY_TYPE[col.type]!.hint}
                >
                  <Wand2 size={12} />
                  {AUTO_FILL_BY_TYPE[col.type]!.label}
                </button>
              ) : col.type === 'text' ? (
                <div className={styles.typeWrap}>
                  <button
                    type="button"
                    className={`${styles.autoFillChip} ${col.options.length > 0 ? styles.autoFillChipActive : ''}`}
                    onClick={() => { setOptionsEditorId((id) => (id === col._id ? null : col._id)); setOptionInput(''); }}
                    title="Turn this into a dropdown with preset choices"
                  >
                    <List size={12} />
                    {col.options.length > 0 ? `${col.options.length} option${col.options.length !== 1 ? 's' : ''}` : 'Dropdown'}
                  </button>

                  {optionsEditorId === col._id && (
                    <div className={styles.optionsMenu} ref={popoverRef}>
                      {col.options.length === 0 ? (
                        <p className={styles.optionsEmptyHint}>No choices yet — add some below, or leave empty for free text.</p>
                      ) : (
                        <div className={styles.optionsList}>
                          {col.options.map((opt) => (
                            <div key={opt} className={styles.optionChip}>
                              <span>{opt}</span>
                              <button type="button" onClick={() => removeOption(col._id, col.options, opt)}>
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className={styles.optionsAddRow}>
                        <input
                          className={styles.optionsInput}
                          placeholder="Add a choice…"
                          value={optionInput}
                          autoFocus
                          onChange={(e) => setOptionInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addOption(col._id, col.options)}
                        />
                        <button type="button" className={styles.optionsAddBtn} onClick={() => addOption(col._id, col.options)}>
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <span />
              )}

              <button type="button" className={styles.deleteBtn} onClick={() => handleDelete(col._id)} title="Delete field">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.addFieldWrap}>
        {!addingField ? (
          <button type="button" className={styles.addFieldBtn} onClick={() => setAddingField(true)}>
            <Plus size={14} /> Add Field
          </button>
        ) : (
          <div className={styles.addFieldForm} ref={popoverRef}>
            <input
              className={styles.nameInput}
              placeholder="Field name"
              value={newLabel}
              autoFocus
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
            />
            <div className={styles.addFieldTypeGrid}>
              {TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.addFieldTypeBtn} ${newType === t ? styles.addFieldTypeBtnActive : ''}`}
                  onClick={() => { setNewType(t); setNewAutoFill('none'); setNewOptions([]); setNewOptionInput(''); }}
                >
                  {TYPE_META[t].icon}
                  <span>{TYPE_META[t].label}</span>
                </button>
              ))}
            </div>

            {AUTO_FILL_BY_TYPE[newType] && (
              <label className={styles.autoFillCheckboxRow}>
                <input
                  type="checkbox"
                  checked={newAutoFill === AUTO_FILL_BY_TYPE[newType]!.value}
                  onChange={(e) => setNewAutoFill(e.target.checked ? AUTO_FILL_BY_TYPE[newType]!.value : 'none')}
                />
                <span>{AUTO_FILL_BY_TYPE[newType]!.hint}</span>
              </label>
            )}

            {newType === 'text' && (
              <div className={styles.newOptionsBlock}>
                <span className={styles.newOptionsLabel}>Dropdown choices (optional — leave empty for free text)</span>
                {newOptions.length > 0 && (
                  <div className={styles.optionsList}>
                    {newOptions.map((opt) => (
                      <div key={opt} className={styles.optionChip}>
                        <span>{opt}</span>
                        <button type="button" onClick={() => setNewOptions((prev) => prev.filter((o) => o !== opt))}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.optionsAddRow}>
                  <input
                    className={styles.optionsInput}
                    placeholder="Add a choice…"
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewOption(); } }}
                  />
                  <button type="button" className={styles.optionsAddBtn} onClick={addNewOption}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            )}

            <div className={styles.addFieldActions}>
              <button type="button" className={styles.addFieldCancel} onClick={() => setAddingField(false)}>Cancel</button>
              <button type="button" className={styles.addFieldSubmit} onClick={handleAddField} disabled={!newLabel.trim() || saving}>
                {saving ? 'Adding…' : 'Add Field'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
