'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useTableInstances } from '@/hooks/useTableInstances';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import type { TableInstance, TableColumn, ColumnType } from '@/types';
import styles from './TableGrid.module.css';
import {
  Type, AlignLeft, Hash, Calendar, Clock, Link as LinkIcon, Palette, CheckSquare,
  Plus, ExternalLink, Trash2, Pencil, Maximize2, ChevronUp, ChevronDown, Loader2, Check, Save, Download,
} from 'lucide-react';

interface TableGridProps {
  instance: TableInstance;
  onChange: (instance: TableInstance) => void;
}

const TYPE_META: Record<ColumnType, { label: string; icon: React.ReactNode }> = {
  text: { label: 'Text', icon: <Type size={13} /> },
  content: { label: 'Content', icon: <AlignLeft size={13} /> },
  number: { label: 'Number', icon: <Hash size={13} /> },
  date: { label: 'Date', icon: <Calendar size={13} /> },
  time: { label: 'Time', icon: <Clock size={13} /> },
  link: { label: 'Link', icon: <LinkIcon size={13} /> },
  color: { label: 'Color', icon: <Palette size={13} /> },
  checkbox: { label: 'Checkbox', icon: <CheckSquare size={13} /> },
};

const DEFAULT_COL_WIDTH = 170;
const ROW_NUM_WIDTH = 44;
const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 800;

type SortDir = 'asc' | 'desc';

function compareCells(a: unknown, b: unknown, type: ColumnType, dir: SortDir): number {
  const aEmpty = a === undefined || a === null || a === '';
  const bEmpty = b === undefined || b === null || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let cmp: number;
  if (type === 'number') cmp = Number(a) - Number(b);
  else if (type === 'checkbox') cmp = (a ? 1 : 0) - (b ? 1 : 0);
  else cmp = String(a).localeCompare(String(b));

  return dir === 'asc' ? cmp : -cmp;
}

export default function TableGrid({ instance, onChange }: TableGridProps) {
  const { addRow, updateRow, deleteRow, updateColumnWidth } = useTableInstances();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks whether a cell input is mid-edit (focused), so the Save button only
  // becomes actionable when there's actually something un-committed to force-save.
  const [hasFocusedInput, setHasFocusedInput] = useState(false);

  const handleFocusCapture = () => setHasFocusedInput(true);
  const handleBlurCapture = () => {
    setTimeout(() => {
      const active = document.activeElement;
      setHasFocusedInput(!!(active && wrapRef.current?.contains(active) && active !== wrapRef.current));
    }, 0);
  };

  const withSaveStatus = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    setSaveStatus('saving');
    const result = await fn();
    setSaveStatus('saved');
    savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    return result;
  }, []);

  useEffect(() => () => { if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current); }, []);

  // Reset view-only state (sort, in-flight resize) when switching to a different table.
  useEffect(() => {
    setSortKey(null);
    setSortDir('asc');
    setLiveWidths({});
    setSaveStatus('idle');
  }, [instance._id]);

  const columns = useMemo(() => [...instance.columns].sort((a, b) => a.order - b.order), [instance.columns]);

  const rows = useMemo(() => {
    const base = [...instance.rows].sort((a, b) => a.order - b.order);
    if (!sortKey) return base;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return base;
    return [...base].sort((a, b) => compareCells(a.cells?.[sortKey], b.cells?.[sortKey], col.type, sortDir));
  }, [instance.rows, sortKey, sortDir, columns]);

  const widthOf = useCallback(
    (col: TableColumn) => liveWidths[col._id] ?? col.width ?? DEFAULT_COL_WIDTH,
    [liveWidths]
  );

  const handleSort = (col: TableColumn) => {
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const startResize = (e: React.MouseEvent, col: TableColumn) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ columnId: col._id, startX: e.clientX, startWidth: widthOf(col) });
  };

  useEffect(() => {
    if (!resizing) return;

    const onMove = (e: MouseEvent) => {
      const next = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, resizing.startWidth + (e.clientX - resizing.startX)));
      setLiveWidths((w) => ({ ...w, [resizing.columnId]: next }));
    };

    const onUp = async (e: MouseEvent) => {
      const next = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, resizing.startWidth + (e.clientX - resizing.startX)));
      const columnId = resizing.columnId;
      setResizing(null);
      const updated = await withSaveStatus(() => updateColumnWidth(instance._id, columnId, next));
      // Once the server confirms (or rejects) the new width, drop the optimistic
      // override so widthOf() falls back to the authoritative instance.columns value.
      setLiveWidths((w) => {
        const { [columnId]: _dropped, ...rest } = w;
        return rest;
      });
      if (updated) onChange(updated);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizing, instance._id]);

  const handleAddRow = async () => {
    setAddingRow(true);
    const updated = await withSaveStatus(() => addRow(instance._id, {}));
    if (updated) onChange(updated);
    setAddingRow(false);
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('Delete this row?')) return;
    const updated = await withSaveStatus(() => deleteRow(instance._id, rowId));
    if (updated) onChange(updated);
  };

  const saveCell = async (rowId: string, key: string, value: unknown) => {
    const updated = await withSaveStatus(() => updateRow(instance._id, rowId, { [key]: value }));
    if (updated) onChange(updated);
  };

  // Manual "Save" button: blurs whatever cell is mid-edit so its pending onBlur-save
  // fires immediately, for users who don't trust autosave alone.
  const handleManualSave = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && wrapRef.current?.contains(active) && active !== wrapRef.current) {
      active.blur();
    }
  };

  const handleExport = () => {
    const header = columns.map((col) => col.label);
    const body = rows.map((row) =>
      columns.map((col) => {
        const v = row.cells?.[col.key];
        if (col.type === 'checkbox') return v ? 'Yes' : 'No';
        return v ?? '';
      })
    );

    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    const workbook = XLSX.utils.book_new();
    const safeSheetName = (instance.name || 'Table').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Table';
    XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName);

    const safeFileName = (instance.name || 'table').replace(/[^a-z0-9-_ ]/gi, '_');
    XLSX.writeFile(workbook, `${safeFileName}.xlsx`);
  };

  const creatorName = typeof instance.createdBy === 'object' ? instance.createdBy?.name : undefined;
  const canManualSave = saveStatus === 'idle' && hasFocusedInput;

  return (
    <div className={styles.wrap} ref={wrapRef} onFocusCapture={handleFocusCapture} onBlurCapture={handleBlurCapture}>
      <div className={styles.metaRow}>
        <div className={styles.meta}>
          {creatorName && (
            <>Created by <strong>{creatorName}</strong> on {new Date(instance.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</>
          )}
        </div>
        <div className={styles.saveArea}>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={columns.length === 0}
            title="Download this table as an Excel file"
          >
            <Download size={12} /> Excel
          </button>
          <button
            type="button"
            className={`${styles.saveBtn} ${!canManualSave && saveStatus !== 'saving' ? styles.saveBtnSaved : ''}`}
            onClick={handleManualSave}
            disabled={!canManualSave}
            title={canManualSave ? 'Save the in-progress edit now' : undefined}
          >
            {saveStatus === 'saving' ? (
              <><Loader2 size={12} className={styles.saveSpinner} /> Saving…</>
            ) : canManualSave ? (
              <><Save size={12} /> Save</>
            ) : (
              <><Check size={12} /> Saved</>
            )}
          </button>
        </div>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.grid}>
          <colgroup>
            <col style={{ width: ROW_NUM_WIDTH }} />
            {columns.map((col) => (
              <col key={col._id} style={{ width: widthOf(col) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={styles.rowNumHeader} />
              {columns.map((col) => (
                <th key={col._id} className={styles.colHeader}>
                  <button type="button" className={styles.colHeaderInner} onClick={() => handleSort(col)}>
                    <span className={styles.colTypeIcon} title={TYPE_META[col.type].label}>
                      {TYPE_META[col.type].icon}
                    </span>
                    <span className={styles.colLabel}>{col.label}</span>
                    {sortKey === col.key && (
                      <span className={styles.sortIcon}>
                        {sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    )}
                  </button>
                  <div className={styles.resizeHandle} onMouseDown={(e) => startResize(e, col)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className={styles.emptyState}>
                  {columns.length === 0 ? 'This table has no columns yet.' : 'No rows yet. Add one below.'}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row._id} className={styles.dataRow}>
                  <td className={styles.rowNumCell}>
                    <span className={styles.rowNum}>{i + 1}</span>
                    <button
                      type="button"
                      className={styles.rowDeleteBtn}
                      onClick={() => handleDeleteRow(row._id)}
                      title="Delete row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                  {columns.map((col) => (
                    <td key={col._id} className={styles.dataCell}>
                      <Cell column={col} value={row.cells?.[col.key]} onSave={(v) => saveCell(row._id, col.key, v)} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button type="button" className={styles.addRowBtn} onClick={handleAddRow} disabled={addingRow || columns.length === 0}>
        <Plus size={14} /> Add row
      </button>
    </div>
  );
}

function Cell({ column, value, onSave }: { column: TableColumn; value: unknown; onSave: (v: unknown) => void }) {
  const [local, setLocal] = useState<unknown>(value ?? '');
  const [linkEditing, setLinkEditing] = useState(false);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [contentDraft, setContentDraft] = useState('');

  useEffect(() => { setLocal(value ?? ''); }, [value]);

  switch (column.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={Boolean(local)}
          onChange={(e) => { setLocal(e.target.checked); onSave(e.target.checked); }}
        />
      );

    case 'color':
      return (
        <div className={styles.colorCell}>
          <input
            type="color"
            className={styles.colorInput}
            value={typeof local === 'string' && local ? local : '#94a3b8'}
            onChange={(e) => { setLocal(e.target.value); onSave(e.target.value); }}
          />
          <span className={styles.colorValue}>{(local as string) || '—'}</span>
        </div>
      );

    case 'date':
      return (
        <input
          type="date"
          className={styles.cellInput}
          value={typeof local === 'string' ? local : ''}
          onChange={(e) => { setLocal(e.target.value); onSave(e.target.value); }}
        />
      );

    case 'time':
      return (
        <input
          type="time"
          className={styles.cellInput}
          value={typeof local === 'string' ? local : ''}
          onChange={(e) => { setLocal(e.target.value); onSave(e.target.value); }}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          className={styles.cellInput}
          value={local as number | string}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local === '' ? null : Number(local))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      );

    case 'link': {
      const url = typeof local === 'string' ? local : '';
      if (!linkEditing) {
        return (
          <div className={styles.linkDisplayCell}>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className={styles.linkDisplayText} title={url}>
                <ExternalLink size={12} />
                <span>{url.replace(/^https?:\/\//, '')}</span>
              </a>
            ) : (
              <span className={styles.linkPlaceholder} onClick={() => setLinkEditing(true)}>Add link…</span>
            )}
            <button type="button" className={styles.linkEditBtn} onClick={() => setLinkEditing(true)} title="Edit link">
              <Pencil size={11} />
            </button>
          </div>
        );
      }
      return (
        <input
          type="url"
          className={styles.cellInput}
          placeholder="https://…"
          value={url}
          autoFocus
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { onSave(local); setLinkEditing(false); }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      );
    }

    case 'content': {
      const text = typeof local === 'string' ? local : '';
      return (
        <>
          <button
            type="button"
            className={styles.contentCellBtn}
            onClick={() => { setContentDraft(text); setContentModalOpen(true); }}
          >
            <span className={styles.contentPreview}>{text || <em>Click to add content…</em>}</span>
            <Maximize2 size={12} className={styles.contentExpandIcon} />
          </button>
          <Modal isOpen={contentModalOpen} onClose={() => setContentModalOpen(false)} title={column.label} size="md">
            <div className={styles.contentModalBody}>
              <textarea
                className={styles.contentModalTextarea}
                rows={10}
                autoFocus
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                placeholder="Paste or write content here…"
              />
              <div className={styles.contentModalActions}>
                <Button variant="ghost" onClick={() => setContentModalOpen(false)}>Cancel</Button>
                <Button onClick={() => { setLocal(contentDraft); onSave(contentDraft); setContentModalOpen(false); }}>
                  Save
                </Button>
              </div>
            </div>
          </Modal>
        </>
      );
    }

    case 'text':
      if (column.options.length > 0) {
        return (
          <select
            className={styles.cellSelect}
            value={local as string}
            onChange={(e) => { setLocal(e.target.value); onSave(e.target.value); }}
          >
            <option value="">—</option>
            {column.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          type="text"
          className={styles.cellInput}
          value={local as string}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      );

    default:
      return (
        <input
          type="text"
          className={styles.cellInput}
          value={local as string}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      );
  }
}
