'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Avatar from '@/components/ui/Avatar/Avatar';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import type { Department, User, Task, TaskTemplate, TaskType } from '@/types';
import styles from './departments.module.css';
import { Plus, ChevronRight, Users, Star, Pencil, Trash2, X, ClipboardList, ListTodo, Check } from 'lucide-react';

/** Safely extract string ID from a User — handles both `id` and `_id` */
function uid(m: User | any): string {
  return (m?.id || m?._id)?.toString() ?? '';
}

const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

function colorToLight(hex: string) {
  return hex + '22';
}

// ── Confirm Dialog ────────────────────────────────────────────────
function ConfirmModal({
  isOpen, onClose, onConfirm, title, message,
}: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className={styles.confirmMsg}>{message}</p>
      <div className={styles.confirmActions}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  );
}

// ── Department Form Modal ─────────────────────────────────────────
function DeptFormModal({
  isOpen, onClose, onSave, initial,
}: {
  isOpen: boolean; onClose: () => void;
  onSave: (v: { name: string; description: string; color: string; canSocialMedia: boolean }) => Promise<void>;
  initial?: { name: string; description: string; color: string; canSocialMedia: boolean };
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);
  const [canSocialMedia, setCanSocialMedia] = useState(initial?.canSocialMedia ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description: desc.trim(), color, canSocialMedia });
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? 'Edit Department' : 'Create Department'}
      size="md"
    >
      <div className={styles.formBody}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Name <span className={styles.req}>*</span></label>
          <input
            className={styles.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Engineering"
            autoFocus
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Description</label>
          <textarea
            className={styles.formTextarea}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What does this department do?"
            rows={3}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Color</label>
          <div className={styles.palette}>
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchActive : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className={styles.formField}>
          <div className={styles.toggleRow}>
            <div>
              <label className={styles.formLabel}>Social Media Access</label>
              <p className={styles.toggleHint}>
                Allow this department's heads to see the Social Media tab inside projects.
              </p>
            </div>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={canSocialMedia}
                onChange={(e) => setCanSocialMedia(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Department'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add Member Modal ──────────────────────────────────────────────
function AddMemberModal({
  isOpen, onClose, onAdd, dept, allMembers,
}: {
  isOpen: boolean; onClose: () => void;
  onAdd: (userId: string) => Promise<void>;
  dept: Department; allMembers: User[];
}) {
  const existingIds = new Set(dept.members.map((m) => uid(m)));
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState('');

  const filtered = allMembers.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (userId: string) => {
    setAdding(userId);
    await onAdd(userId);
    setAdding('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Member" size="sm">
      <div className={styles.addMemberBody}>
        <input
          className={styles.formInput}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.addMemberList}>
          {filtered.length === 0 && (
            <p className={styles.emptyText}>No results.</p>
          )}
          {filtered.map((m) => {
            const memberId = uid(m);
            const alreadyIn = existingIds.has(memberId);
            return (
              <div key={memberId} className={styles.addMemberItem}>
                <Avatar name={m.name} src={m.avatar} size="sm" />
                <div className={styles.addMemberInfo}>
                  <span className={styles.addMemberName}>{m.name}</span>
                  <span className={styles.addMemberEmail}>{m.email}</span>
                </div>
                {alreadyIn ? (
                  <Button size="sm" variant="secondary" disabled>Added</Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleAdd(memberId)}
                    disabled={!!adding}
                  >
                    {adding === memberId ? '…' : 'Add'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ── Add Collaborator Modal (multi-select) ─────────────────────────
function AddCollaboratorModal({
  isOpen, onClose, onAdd, dept, allMembers,
}: {
  isOpen: boolean; onClose: () => void;
  onAdd: (userIds: string[]) => Promise<void>;
  dept: Department; allMembers: User[];
}) {
  const existingIds = new Set((dept.collaborators ?? []).map((c) => uid(c)));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const filtered = allMembers.filter(
    (m) => !existingIds.has(uid(m)) && (
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    )
  );

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleConfirm = async () => {
    if (!selected.size) return;
    setSaving(true);
    await onAdd(Array.from(selected));
    setSaving(false);
    setSelected(new Set());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Collaborators" size="sm">
      <div className={styles.collabModalBody}>
        <input
          className={styles.formInput}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.collabList}>
          {filtered.length === 0 ? (
            <p className={styles.emptyText}>No users available to add.</p>
          ) : (
            filtered.map((m) => {
              const id = uid(m);
              const checked = selected.has(id);
              return (
                <div
                  key={id}
                  className={`${styles.collabItem} ${checked ? styles.collabItemSelected : ''}`}
                  onClick={() => toggle(id)}
                >
                  <Avatar name={m.name} src={m.avatar} size="sm" />
                  <div className={styles.collabItemInfo}>
                    <span className={styles.collabItemName}>{m.name}</span>
                    <span className={styles.collabItemRole}>{m.role}</span>
                  </div>
                  <div className={`${styles.collabCheck} ${checked ? styles.collabCheckActive : ''}`}>
                    {checked && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className={styles.collabFooter}>
          <span className={styles.collabCount}>
            {selected.size > 0 ? `${selected.size} selected` : 'Select collaborators above'}
          </span>
          <div className={styles.collabFooterActions}>
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={selected.size === 0 || saving}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const {
    departments, loading, error,
    createDepartment, updateDepartment, deleteDepartment,
    addMember, removeMember, addHead, removeHead,
    addCollaborator, removeCollaborator,
    addTemplate, updateTemplate, deleteTemplate,
    addType, updateType, deleteType,
  } = useDepartments();
  const { members: allMembers } = useTeam();
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.role === 'admin';
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [selected, setSelected] = useState<Department | null>(null);
  const [detailTab, setDetailTab] = useState<'templates' | 'members' | 'collaborators'>('templates');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCollaborator, setShowAddCollaborator] = useState(false);
  const [actionError, setActionError] = useState('');

  // Task template state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ title: '', description: '', priority: 'medium', estimatedHours: '', checklist: [] as string[] });
  const [templateChecklistInput, setTemplateChecklistInput] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);

  // Task type state
  const [addingTypeForTemplate, setAddingTypeForTemplate] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<{ templateId: string; type: TaskType } | null>(null);
  const [typeForm, setTypeForm] = useState({ title: '', description: '', priority: 'medium', estimatedHours: '', checklist: [] as string[] });
  const [typeChecklistInput, setTypeChecklistInput] = useState('');
  const [typeSaving, setTypeSaving] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  // Member tasks viewer state
  const [memberTasksUser, setMemberTasksUser] = useState<User | null>(null);
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [memberTasksLoading, setMemberTasksLoading] = useState(false);

  // Keep selected in sync with departments updates
  const selectedDept = selected
    ? departments.find((d) => d._id === selected._id) ?? selected
    : null;

  const handleCreate = async (v: { name: string; description: string; color: string; canSocialMedia: boolean }) => {
    const dept = await createDepartment(v);
    if (dept) setSelected(dept);
  };

  const handleUpdate = async (v: { name: string; description: string; color: string; canSocialMedia: boolean }) => {
    if (!selectedDept) return;
    await updateDepartment(selectedDept._id, v);
  };

  const handleDelete = async () => {
    if (!selectedDept) return;
    await deleteDepartment(selectedDept._id);
    setSelected(null);
    setShowConfirmDelete(false);
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedDept) return;
    setActionError('');
    const updated = await addMember(selectedDept._id, userId);
    if (updated) setSelected(updated);
    else setActionError(error || 'Failed to add member. Please try again.');
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedDept) return;
    setActionError('');
    const { data: updated, error: removeError } = await removeMember(selectedDept._id, userId);
    if (updated) setSelected(updated);
    else setActionError(removeError || 'Failed to remove member. Please try again.');
  };

  const handleAddHead = async (userId: string) => {
    if (!selectedDept) return;
    await addHead(selectedDept._id, userId);
  };

  const handleAddCollaborators = async (userIds: string[]) => {
    if (!selectedDept) return;
    for (const userId of userIds) {
      await addCollaborator(selectedDept._id, userId);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!selectedDept) return;
    await removeCollaborator(selectedDept._id, userId);
  };

  const handleRemoveHead = async (userId: string) => {
    if (!selectedDept) return;
    await removeHead(selectedDept._id, userId);
  };

  const openAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ title: '', description: '', priority: 'medium', estimatedHours: '', checklist: [] });
    setTemplateChecklistInput('');
    setShowTemplateForm(true);
  };

  const openEditTemplate = (t: TaskTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({ title: t.title, description: t.description || '', priority: t.priority || 'medium', estimatedHours: t.estimatedHours != null ? String(t.estimatedHours) : '', checklist: t.checklist ? [...t.checklist] : [] });
    setTemplateChecklistInput('');
    setShowTemplateForm(true);
  };

  const addTemplateChecklistItem = () => {
    const v = templateChecklistInput.trim();
    if (!v) return;
    setTemplateForm((f) => ({ ...f, checklist: [...f.checklist, v] }));
    setTemplateChecklistInput('');
  };

  const removeTemplateChecklistItem = (idx: number) => {
    setTemplateForm((f) => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }));
  };

  const handleSaveTemplate = async () => {
    if (!selectedDept || !templateForm.title.trim()) return;
    setTemplateSaving(true);
    const payload = {
      title: templateForm.title.trim(),
      description: templateForm.description.trim(),
      priority: templateForm.priority,
      estimatedHours: templateForm.estimatedHours ? parseFloat(templateForm.estimatedHours) : undefined,
      checklist: templateForm.checklist,
    };
    let updated: Department | null = null;
    if (editingTemplate) {
      updated = await updateTemplate(selectedDept._id, editingTemplate._id, payload);
    } else {
      updated = await addTemplate(selectedDept._id, payload);
    }
    if (updated) setSelected(updated);
    setTemplateSaving(false);
    setShowTemplateForm(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!selectedDept) return;
    const updated = await deleteTemplate(selectedDept._id, templateId);
    if (updated) setSelected(updated);
  };

  const openAddType = (templateId: string) => {
    setAddingTypeForTemplate(templateId);
    setEditingType(null);
    setTypeForm({ title: '', description: '', priority: 'medium', estimatedHours: '', checklist: [] });
    setTypeChecklistInput('');
    setExpandedTemplates(prev => new Set(Array.from(prev).concat(templateId)));
  };

  const openEditType = (templateId: string, t: TaskType) => {
    setEditingType({ templateId, type: t });
    setAddingTypeForTemplate(null);
    setTypeForm({ title: t.title, description: t.description || '', priority: t.priority || 'medium', estimatedHours: t.estimatedHours != null ? String(t.estimatedHours) : '', checklist: t.checklist ? [...t.checklist] : [] });
    setTypeChecklistInput('');
  };

  const addTypeChecklistItem = () => {
    const v = typeChecklistInput.trim();
    if (!v) return;
    setTypeForm((f) => ({ ...f, checklist: [...f.checklist, v] }));
    setTypeChecklistInput('');
  };

  const removeTypeChecklistItem = (idx: number) => {
    setTypeForm((f) => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }));
  };

  const handleSaveType = async () => {
    if (!selectedDept || !typeForm.title.trim()) return;
    setTypeSaving(true);
    const payload = {
      title: typeForm.title.trim(),
      description: typeForm.description.trim(),
      priority: typeForm.priority,
      estimatedHours: typeForm.estimatedHours ? parseFloat(typeForm.estimatedHours) : undefined,
      checklist: typeForm.checklist,
    };
    let updated: Department | null = null;
    if (editingType) {
      updated = await updateType(selectedDept._id, editingType.templateId, editingType.type._id, payload);
    } else if (addingTypeForTemplate) {
      updated = await addType(selectedDept._id, addingTypeForTemplate, payload);
    }
    if (updated) setSelected(updated);
    setTypeSaving(false);
    setEditingType(null);
    setAddingTypeForTemplate(null);
  };

  const handleDeleteType = async (templateId: string, typeId: string) => {
    if (!selectedDept) return;
    const updated = await deleteType(selectedDept._id, templateId, typeId);
    if (updated) setSelected(updated);
  };

  const toggleTemplate = (id: string) => {
    setExpandedTemplates(prev => { const n = new Set(Array.from(prev)); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleViewMemberTasks = async (member: User) => {
    setMemberTasksUser(member);
    setMemberTasks([]);
    setMemberTasksLoading(true);
    try {
      const { data } = await api.get('/tasks', { params: { assignee: uid(member) } });
      setMemberTasks(data);
    } catch {
      setMemberTasks([]);
    } finally {
      setMemberTasksLoading(false);
    }
  };

  return (
    <AppShell title="Departments">
      <div className={styles.layout}>

        {/* ── Left: Department list sidebar ── */}
        <aside className={styles.listPanel}>
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>Departments</h2>
            {isAdmin && (
              <button className={styles.newBtn} onClick={() => setShowCreate(true)} title="New department">
                <Plus size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {loading ? (
            <div className={styles.listLoading}><Spinner size="sm" /></div>
          ) : departments.length === 0 ? (
            <div className={styles.listEmpty}>
              <span>No departments yet.</span>
              {isAdmin && (
                <button className={styles.linkBtn} onClick={() => setShowCreate(true)}>
                  Create your first department
                </button>
              )}
            </div>
          ) : (
            <ul className={styles.deptList}>
              {departments.map((d) => (
                <li key={d._id}>
                  <button
                    className={`${styles.deptItem} ${selectedDept?._id === d._id ? styles.deptItemActive : ''}`}
                    onClick={() => setSelected(d)}
                  >
                    <span
                      className={styles.deptDot}
                      style={{ background: d.color }}
                    />
                    <div className={styles.deptItemInfo}>
                      <span className={styles.deptItemName}>{d.name}</span>
                      <span className={styles.deptItemCount}>
                        {d.members.length} {d.members.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    {selectedDept?._id === d._id && (
                      <ChevronRight size={14} strokeWidth={2.5} className={styles.chevron} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Right: Department detail ── */}
        <div className={styles.detailPanel}>
          {!selectedDept ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Users size={48} strokeWidth={1.5} />
              </div>
              <h3 className={styles.emptyTitle}>Select a department</h3>
              <p className={styles.emptyDesc}>Choose a department from the sidebar to view its members and details.</p>
              {isAdmin && (
                <Button onClick={() => setShowCreate(true)}>Create Department</Button>
              )}
            </div>
          ) : (
            <div className={styles.detail}>

              {/* ── Detail header ── */}
              <div
                className={styles.detailHeader}
                style={{ borderColor: selectedDept.color, background: colorToLight(selectedDept.color) }}
              >
                <div className={styles.detailHeaderLeft}>
                  <div
                    className={styles.detailColorBadge}
                    style={{ background: selectedDept.color }}
                  />
                  <div>
                    <h1 className={styles.detailName}>{selectedDept.name}</h1>
                    {selectedDept.description && (
                      <p className={styles.detailDesc}>{selectedDept.description}</p>
                    )}
                    <div className={styles.detailMeta}>
                      <span className={styles.detailMetaItem}>
                        <Users size={14} />
                        {selectedDept.members.length} {selectedDept.members.length === 1 ? 'member' : 'members'}
                      </span>
                      {selectedDept.heads && selectedDept.heads.length > 0 && (
                        <span className={styles.detailMetaItem}>
                          <Star size={14} />
                          {selectedDept.heads.length === 1 ? 'Head' : 'Heads'}:{' '}
                          {selectedDept.heads.map((h) => h.name).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className={styles.detailActions}>
                    <button className={styles.iconBtn} onClick={() => setShowEdit(true)} title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => setShowConfirmDelete(true)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Tabs ── */}
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${detailTab === 'templates' ? styles.tabActive : ''}`}
                  onClick={() => setDetailTab('templates')}
                >
                  Task Templates
                  <span className={styles.tabBadge}>{(selectedDept.taskTemplates ?? []).length}</span>
                </button>
                <button
                  className={`${styles.tab} ${detailTab === 'members' ? styles.tabActive : ''}`}
                  onClick={() => setDetailTab('members')}
                >
                  Members
                  <span className={styles.tabBadge}>{selectedDept.members.length}</span>
                </button>
                <button
                  className={`${styles.tab} ${detailTab === 'collaborators' ? styles.tabActive : ''}`}
                  onClick={() => setDetailTab('collaborators')}
                >
                  Collaborators
                  <span className={styles.tabBadge}>{(selectedDept.collaborators ?? []).length}</span>
                </button>
              </div>

              {/* ── Task Templates section ── */}
              {detailTab === 'templates' && (
              <div className={styles.membersSection}>
                <div className={styles.membersSectionHeader}>
                  <h2 className={styles.membersSectionTitle}>
                    <ClipboardList size={16} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />
                    Task Templates
                    <span className={styles.memberCount} style={{ background: colorToLight(selectedDept.color), color: selectedDept.color }}>
                      {(selectedDept.taskTemplates ?? []).length}
                    </span>
                  </h2>
                  {isAdminOrManager && (
                    <Button size="sm" onClick={openAddTemplate}>+ Add Template</Button>
                  )}
                </div>

                {(selectedDept.taskTemplates ?? []).length === 0 ? (
                  <div className={styles.noMembers}>
                    <p>No task templates yet.</p>
                    {isAdminOrManager && (
                      <button className={styles.linkBtn} onClick={openAddTemplate}>Add the first template</button>
                    )}
                  </div>
                ) : (
                  <div className={styles.templateList}>
                    {(selectedDept.taskTemplates ?? []).map((t) => {
                      const isExpT = expandedTemplates.has(t._id);
                      return (
                        <div key={t._id} className={styles.templateItem}>
                          <div className={styles.templateItemRow}>
                            <div className={styles.templateItemLeft}>
                              <span className={styles.templateTitle}>{t.title}</span>
                              {t.description && <span className={styles.templateDesc}>{t.description}</span>}
                              <div className={styles.templateMeta}>
                                <span className={styles.templateBadge} data-priority={t.priority ?? 'medium'}>
                                  {(t.priority ?? 'medium').charAt(0).toUpperCase() + (t.priority ?? 'medium').slice(1)}
                                </span>
                                {t.estimatedHours != null && (
                                  <span className={styles.templateHours}>{t.estimatedHours}h est.</span>
                                )}
                                <span className={styles.templateHours}>
                                  {(t.types ?? []).length} type{(t.types ?? []).length !== 1 ? 's' : ''}
                                </span>
                                {(t.checklist ?? []).length > 0 && (
                                  <span className={styles.templateHours}>
                                    ☑ {(t.checklist ?? []).length} checklist item{(t.checklist ?? []).length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isAdminOrManager && (
                              <div className={styles.memberCardActions}>
                                <button className={styles.memberActionBtn} onClick={() => openAddType(t._id)}>
                                  <Plus size={13} /> Type
                                </button>
                                {(t.types ?? []).length > 0 && (
                                  <button className={styles.memberActionBtn} onClick={() => toggleTemplate(t._id)}>
                                    {isExpT ? '▲' : '▼'}
                                  </button>
                                )}
                                <button className={styles.memberActionBtn} onClick={() => openEditTemplate(t)}>
                                  <Pencil size={13} /> Edit
                                </button>
                                <button className={`${styles.memberActionBtn} ${styles.memberActionBtnRemove}`} onClick={() => handleDeleteTemplate(t._id)}>
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Types sub-list */}
                          {isExpT && (
                            <div className={styles.typeList}>
                              {(t.types ?? []).map((ty) => (
                                <div key={ty._id} className={styles.typeRow}>
                                  <div className={styles.typeRowLeft}>
                                    <span className={styles.typeDot} style={{ background: selectedDept.color }} />
                                    <div>
                                      <span className={styles.typeName}>{ty.title}</span>
                                      <div className={styles.typeMeta}>
                                        <span className={styles.templateBadge} data-priority={ty.priority ?? 'medium'}>{ty.priority ?? 'medium'}</span>
                                        {ty.estimatedHours != null && <span className={styles.templateHours}>{ty.estimatedHours}h</span>}
                                        {(ty.checklist ?? []).length > 0 && (
                                          <span className={styles.templateHours}>
                                            ☑ {(ty.checklist ?? []).length}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {isAdminOrManager && (
                                    <div className={styles.memberCardActions}>
                                      <button className={styles.memberActionBtn} onClick={() => openEditType(t._id, ty)}><Pencil size={13} /> Edit</button>
                                      <button className={`${styles.memberActionBtn} ${styles.memberActionBtnRemove}`} onClick={() => handleDeleteType(t._id, ty._id)}><Trash2 size={13} /> Delete</button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* ── Members section ── */}
              {detailTab === 'members' && (
              <div className={styles.membersSection}>
                {actionError && (
                  <div className={styles.actionError} onClick={() => setActionError('')}>
                    {actionError}
                  </div>
                )}
                <div className={styles.membersSectionHeader}>
                  <h2 className={styles.membersSectionTitle}>
                    Members
                    <span className={styles.memberCount} style={{ background: colorToLight(selectedDept.color), color: selectedDept.color }}>
                      {selectedDept.members.length}
                    </span>
                  </h2>
                  {isAdminOrManager && (
                    <Button size="sm" onClick={() => setShowAddMember(true)}>
                      + Add Member
                    </Button>
                  )}
                </div>

                {selectedDept.members.length === 0 ? (
                  <div className={styles.noMembers}>
                    <p>No members yet.</p>
                    {isAdminOrManager && (
                      <button className={styles.linkBtn} onClick={() => setShowAddMember(true)}>
                        Add the first member
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={styles.membersGrid}>
                    {selectedDept.members.map((m) => {
                      const memberId = uid(m);
                      const isHead = selectedDept.heads?.some((h) => uid(h) === memberId) ?? false;
                      return (
                        <div key={memberId} className={styles.memberCard}>
                          <div
                            className={styles.memberCardTop}
                            onClick={() => handleViewMemberTasks(m)}
                            style={{ cursor: 'pointer' }}
                            title={`View ${m.name}'s tasks`}
                          >
                            <div className={styles.memberAvatarWrap}>
                              <Avatar name={m.name} src={m.avatar} size="md" />
                              {isHead && (
                                <span className={styles.headBadge} title="Department Head">
                                  <Star size={10} fill="currentColor" stroke="none" />
                                </span>
                              )}
                            </div>
                            <div className={styles.memberCardInfo}>
                              <span className={styles.memberCardName}>{m.name}</span>
                              <span className={styles.memberCardRole}>{m.role}</span>
                              <span className={styles.memberCardEmail}>{m.email}</span>
                            </div>
                          </div>
                          {isAdminOrManager && (
                            <div className={styles.memberCardActions}>
                              {isAdmin && !isHead && (
                                <button
                                  className={styles.memberActionBtn}
                                  title="Set as head"
                                  onClick={() => handleAddHead(memberId)}
                                >
                                  <Star size={13} />
                                  Make Head
                                </button>
                              )}
                              {isAdmin && isHead && (
                                <button
                                  className={`${styles.memberActionBtn} ${styles.memberActionBtnHead}`}
                                  title="Remove as head"
                                  onClick={() => handleRemoveHead(memberId)}
                                >
                                  <Star size={13} />
                                  Remove as Head
                                </button>
                              )}
                              <button
                                className={`${styles.memberActionBtn} ${styles.memberActionBtnRemove}`}
                                title="Remove from department"
                                onClick={() => handleRemoveMember(memberId)}
                              >
                                <X size={13} />
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* ── Collaborators section ── */}
              {detailTab === 'collaborators' && (
              <div className={styles.membersSection}>
                <div className={styles.membersSectionHeader}>
                  <h2 className={styles.membersSectionTitle}>
                    Collaborators
                    <span className={styles.memberCount} style={{ background: colorToLight(selectedDept.color), color: selectedDept.color }}>
                      {(selectedDept.collaborators ?? []).length}
                    </span>
                  </h2>
                  {isAdminOrManager && (
                    <Button size="sm" onClick={() => setShowAddCollaborator(true)}>
                      + Add Collaborators
                    </Button>
                  )}
                </div>
                <p className={styles.collaboratorHint}>
                  Collaborators can view all tasks assigned to members of this department.
                </p>

                {(selectedDept.collaborators ?? []).length === 0 ? (
                  <div className={styles.noMembers}>
                    <p>No collaborators yet.</p>
                    {isAdminOrManager && (
                      <button className={styles.linkBtn} onClick={() => setShowAddCollaborator(true)}>
                        Add the first collaborator
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={styles.membersGrid}>
                    {(selectedDept.collaborators ?? []).map((c) => {
                      const collabId = uid(c);
                      return (
                        <div key={collabId} className={styles.memberCard}>
                          <div className={styles.memberCardTop}>
                            <Avatar name={c.name} src={c.avatar} size="md" />
                            <div className={styles.memberCardInfo}>
                              <span className={styles.memberCardName}>{c.name}</span>
                              <span className={styles.memberCardRole}>{c.role}</span>
                              <span className={styles.memberCardEmail}>{c.email}</span>
                            </div>
                          </div>
                          {isAdminOrManager && (
                            <div className={styles.memberCardActions}>
                              <button
                                className={`${styles.memberActionBtn} ${styles.memberActionBtnRemove}`}
                                onClick={() => handleRemoveCollaborator(collabId)}
                              >
                                <X size={13} />
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <DeptFormModal
          isOpen
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {showEdit && selectedDept && (
        <DeptFormModal
          isOpen
          onClose={() => setShowEdit(false)}
          onSave={handleUpdate}
          initial={{
            name: selectedDept.name,
            description: selectedDept.description || '',
            color: selectedDept.color,
            canSocialMedia: selectedDept.canSocialMedia ?? false,
          }}
        />
      )}

      {showConfirmDelete && selectedDept && (
        <ConfirmModal
          isOpen
          onClose={() => setShowConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Delete Department"
          message={`Delete "${selectedDept.name}"? This will remove all ${selectedDept.members.length} member(s) from the department. This cannot be undone.`}
        />
      )}

      {showAddMember && selectedDept && (
        <AddMemberModal
          isOpen
          onClose={() => setShowAddMember(false)}
          onAdd={handleAddMember}
          dept={selectedDept}
          allMembers={allMembers}
        />
      )}

      {showAddCollaborator && selectedDept && (
        <AddCollaboratorModal
          isOpen
          onClose={() => setShowAddCollaborator(false)}
          onAdd={handleAddCollaborators}
          dept={selectedDept}
          allMembers={allMembers}
        />
      )}

      {showTemplateForm && (
        <Modal
          isOpen
          onClose={() => setShowTemplateForm(false)}
          title={editingTemplate ? 'Edit Task Template' : 'Add Task Template'}
          size="sm"
        >
          <div className={styles.formBody}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Title <span className={styles.req}>*</span></label>
              <input
                className={styles.formInput}
                placeholder="Template title"
                value={templateForm.title}
                onChange={(e) => setTemplateForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Description</label>
              <input
                className={styles.formInput}
                placeholder="Description (optional)"
                value={templateForm.description}
                onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className={styles.templateFormInline}>
              <select
                className={styles.formInput}
                value={templateForm.priority}
                onChange={(e) => setTemplateForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical Priority</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.5"
                className={styles.formInput}
                placeholder="Est. hours"
                value={templateForm.estimatedHours}
                onChange={(e) => setTemplateForm((f) => ({ ...f, estimatedHours: e.target.value }))}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Checklist</label>
              <div className={styles.checklistAddRow}>
                <input
                  className={styles.formInput}
                  placeholder="Checklist item"
                  value={templateChecklistInput}
                  onChange={(e) => setTemplateChecklistInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTemplateChecklistItem(); } }}
                />
                <Button size="sm" variant="ghost" onClick={addTemplateChecklistItem}>Add</Button>
              </div>
              {templateForm.checklist.length === 0 ? (
                <span className={styles.checklistEmpty}>No checklist items yet.</span>
              ) : (
                <div className={styles.checklistList}>
                  {templateForm.checklist.map((item, i) => (
                    <div key={i} className={styles.checklistItemRow}>
                      <span className={styles.checklistItemText}>{item}</span>
                      <button className={styles.checklistRemoveBtn} onClick={() => removeTemplateChecklistItem(i)}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.formActions}>
              <Button variant="ghost" onClick={() => setShowTemplateForm(false)} disabled={templateSaving}>Cancel</Button>
              <Button onClick={handleSaveTemplate} disabled={!templateForm.title.trim() || templateSaving}>
                {templateSaving ? 'Saving…' : editingTemplate ? 'Save Changes' : 'Add Template'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {(addingTypeForTemplate || editingType) && (
        <Modal
          isOpen
          onClose={() => { setAddingTypeForTemplate(null); setEditingType(null); }}
          title={editingType ? 'Edit Type' : 'Add Type'}
          size="sm"
        >
          <div className={styles.formBody}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Title <span className={styles.req}>*</span></label>
              <input
                className={styles.formInput}
                placeholder="Type title"
                value={typeForm.title}
                onChange={(e) => setTypeForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className={styles.templateFormInline}>
              <select
                className={styles.formInput}
                value={typeForm.priority}
                onChange={(e) => setTypeForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {['low', 'medium', 'high', 'critical'].map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.5"
                className={styles.formInput}
                placeholder="Est. hours"
                value={typeForm.estimatedHours}
                onChange={(e) => setTypeForm((f) => ({ ...f, estimatedHours: e.target.value }))}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Checklist</label>
              <div className={styles.checklistAddRow}>
                <input
                  className={styles.formInput}
                  placeholder="Checklist item"
                  value={typeChecklistInput}
                  onChange={(e) => setTypeChecklistInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTypeChecklistItem(); } }}
                />
                <Button size="sm" variant="ghost" onClick={addTypeChecklistItem}>Add</Button>
              </div>
              {typeForm.checklist.length === 0 ? (
                <span className={styles.checklistEmpty}>No checklist items yet.</span>
              ) : (
                <div className={styles.checklistList}>
                  {typeForm.checklist.map((item, i) => (
                    <div key={i} className={styles.checklistItemRow}>
                      <span className={styles.checklistItemText}>{item}</span>
                      <button className={styles.checklistRemoveBtn} onClick={() => removeTypeChecklistItem(i)}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.formActions}>
              <Button
                variant="ghost"
                onClick={() => { setAddingTypeForTemplate(null); setEditingType(null); }}
                disabled={typeSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveType} disabled={!typeForm.title.trim() || typeSaving}>
                {typeSaving ? 'Saving…' : editingType ? 'Save Changes' : 'Add Type'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {memberTasksUser && (
        <Modal
          isOpen
          onClose={() => setMemberTasksUser(null)}
          title={`${memberTasksUser.name}'s Tasks`}
          size="lg"
        >
          <div className={styles.memberTasksModal}>
            <div className={styles.memberTasksHeader}>
              <Avatar name={memberTasksUser.name} src={memberTasksUser.avatar} size="sm" />
              <span className={styles.memberTasksName}>{memberTasksUser.name}</span>
              <span className={styles.memberTasksRole}>{memberTasksUser.role}</span>
            </div>

            {memberTasksLoading ? (
              <div className={styles.memberTasksLoading}><Spinner size="sm" /></div>
            ) : memberTasks.length === 0 ? (
              <div className={styles.memberTasksEmpty}>
                <ListTodo size={32} strokeWidth={1.5} />
                <p>No active tasks assigned to {memberTasksUser.name}.</p>
              </div>
            ) : (
              <div className={styles.memberTasksList}>
                {memberTasks.map((task) => (
                  <div key={task._id} className={styles.memberTaskItem}>
                    <div className={styles.memberTaskBadges}>
                      <span className={styles.memberTaskStatus} data-status={task.status}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className={styles.memberTaskPriority} data-priority={task.priority}>
                        {task.priority}
                      </span>
                    </div>
                    <div className={styles.memberTaskContent}>
                      <span className={styles.memberTaskTitle}>{task.title}</span>
                      {task.project && typeof task.project === 'object' && (task.project as any).title && (
                        <span className={styles.memberTaskProject}>{(task.project as any).title}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
