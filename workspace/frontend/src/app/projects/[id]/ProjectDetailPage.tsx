'use client';
import { useRouteParams } from '@/lib/routeParams';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import KanbanBoard from '@/components/projects/KanbanBoard/KanbanBoard';
import ProjectListView from '@/components/projects/ProjectListView/ProjectListView';
import TaskModal from '@/components/projects/TaskModal/TaskModal';
import SuccessPopup from '@/components/ui/SuccessPopup/SuccessPopup';
import MediaLibrary from '@/components/projects/MediaLibrary/MediaLibrary';
import ProjectCalendar from '@/components/projects/ProjectCalendar/ProjectCalendar';
import SocialTab from '@/components/projects/SocialTab/SocialTab';
import CredentialsTab from '@/components/projects/CredentialsTab/CredentialsTab';
import StartSOPModal from '@/components/projects/StartSOPModal/StartSOPModal';
import SOPProgressTab from '@/components/projects/SOPProgressTab/SOPProgressTab';
import EditProjectModal from '@/components/projects/EditProjectModal/EditProjectModal';
import ProjectTableTab from '@/components/projects/ProjectTableTab/ProjectTableTab';
import ProjectCustomTabView from '@/components/projects/ProjectCustomTabView/ProjectCustomTabView';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Avatar from '@/components/ui/Avatar/Avatar';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useTables } from '@/hooks/useTables';
import { useProjectTabs } from '@/hooks/useProjectTabs';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatStatus } from '@/lib/utils';
import api, { uploadFile } from '@/lib/api';
import type { Project, Task, User, Attachment, CustomTable } from '@/types';
import styles from './projectDetail.module.css';
import { Pencil, X, Link, ExternalLink, Trash2, Check, Plus, TableProperties } from 'lucide-react';
import createStyles from './createTask.module.css';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const positionVariant: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  admin: 'danger',
  manager: 'warning',
  member: 'primary',
  viewer: 'default',
};

type CreateTab = 'details' | 'checklist' | 'notes' | 'links' | 'files';

type TabType = 'board' | 'list' | 'members' | 'media' | 'calendar' | 'links' | 'social' | 'credentials' | 'sopProgress' | (string & {});

export default function ProjectDetailPage() {
  const params = useRouteParams('/projects/:id');
  const projectId = params.id as string;
  const { fetchProject, updateProject } = useProjects(false);
  const { tasks, loading: tasksLoading, fetchTasks, createTask, updateTaskStatus, deleteTask, patchTimer } = useTasks();
  const { members } = useTeam();
  const { departments } = useDepartments();
  const { fetchTables: fetchAllTables } = useTables(false);
  const { createProjectTab, updateProjectTab, deleteProjectTab } = useProjectTabs();
  const user = useAuthStore((s) => s.user);
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  // Departments this user heads
  const myHeadedDepts = useMemo(
    () => departments.filter((d) =>
      d.heads?.some((h) => (h.id ?? (h as any)._id) === user?.id)
    ),
    [departments, user?.id],
  );
  const isDeptHead = !isAdminOrManager && myHeadedDepts.length > 0;

  // Social tab is visible to admins/managers OR dept heads whose department has canSocialMedia enabled
  const canSeeSocialTab = isAdminOrManager ||
    myHeadedDepts.some((d) => (d as any).canSocialMedia === true);

  // Deduplicated members from all headed departments
  const deptMembers = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof members = [];
    myHeadedDepts.forEach((d) =>
      d.members.forEach((m) => {
        const id = m.id ?? (m as any)._id;
        if (id && !seen.has(id)) { seen.add(id); result.push(m as any); }
      }),
    );
    return result;
  }, [myHeadedDepts]);

  const [project, setProject] = useState<Project | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('board');
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabTemplateId, setNewTabTemplateId] = useState('');
  const [creatingTab, setCreatingTab] = useState(false);
  const [availableTables, setAvailableTables] = useState<CustomTable[]>([]);
  const [loadingAvailableTables, setLoadingAvailableTables] = useState(false);
  const [attachingTableId, setAttachingTableId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<'all' | 'assigned_to_me' | 'assigned_by_me'>('all');
  const [showEdit, setShowEdit] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showStartSOP, setShowStartSOP] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create task modal form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskStatus, setNewTaskStatus] = useState('todo');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskEstHours, setNewTaskEstHours] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskLinks, setNewTaskLinks] = useState<string[]>([]);
  const [newTaskLinkInput, setNewTaskLinkInput] = useState('');
  const [newTaskChecklist, setNewTaskChecklist] = useState<string[]>([]);
  const [newTaskChecklistInput, setNewTaskChecklistInput] = useState('');
  const [newTaskAttachments, setNewTaskAttachments] = useState<Attachment[]>([]);
  const [createTab, setCreateTab] = useState<CreateTab>('details');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [successPopup, setSuccessPopup] = useState<{ visible: boolean; title: string; subtitle: string }>({ visible: false, title: '', subtitle: '' });

  const showSuccess = (title: string, subtitle: string) => setSuccessPopup({ visible: true, title, subtitle });
  const hideSuccess = () => setSuccessPopup((s) => ({ ...s, visible: false }));

  // Links state
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [savingLinks, setSavingLinks] = useState(false);
  const [editingLinkIdx, setEditingLinkIdx] = useState<number | null>(null);
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const p = await fetchProject(projectId);
    if (p) setProject(p);
    await fetchTasks({ projectId });
    setLoading(false);
  }, [projectId, fetchProject, fetchTasks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep local copy in sync; updated by timer actions without full reload
  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  const runningSopCount = useMemo(() => {
    const sopIds = new Set<string>();
    for (const t of localTasks) {
      const tag = (t.tags || []).find((tg) => tg.startsWith('sop:'));
      if (tag) sopIds.add(tag.slice(4));
    }
    return sopIds.size;
  }, [localTasks]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return localTasks;
    const uid = user?.id ?? '';
    return localTasks.filter((t) => {
      if (taskFilter === 'assigned_to_me') {
        return t.assignees.filter(Boolean).some(
          (a) => ((a as any)._id?.toString() || (a as any).id) === uid
        );
      }
      if (taskFilter === 'assigned_by_me') {
        const reporterId = (t.reporter as any)?._id?.toString() || (t.reporter as any)?.id;
        return reporterId === uid;
      }
      return true;
    });
  }, [localTasks, taskFilter, user?.id]);

  const handleTaskTimerUpdate = (updated: Task) => {
    setLocalTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    if (selectedTask?._id === updated._id) setSelectedTask(updated);
  };

  const handleTaskClick = async (task: Task) => {
    const { default: api } = await import('@/lib/api');
    try {
      const { data } = await api.get(`/tasks/${task._id}`);
      setSelectedTask(data);
      setShowTaskModal(true);
    } catch {
      setSelectedTask(task);
      setShowTaskModal(true);
    }
  };

  const handleStatusChange = async (taskId: string, status: string, order?: number) => {
    await updateTaskStatus(taskId, status, order);
  };

  const resetCreateForm = () => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
    setNewTaskStatus('todo');
    setNewTaskDueDate('');
    setNewTaskEstHours('');
    setNewTaskAssignees([]);
    setNewTaskNotes('');
    setNewTaskLinks([]);
    setNewTaskLinkInput('');
    setNewTaskChecklist([]);
    setNewTaskChecklistInput('');
    setNewTaskAttachments([]);
    setCreateTab('details');
    setFileUploadError('');
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setCreateSubmitting(true);
    try {
      await createTask({
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        project: projectId,
        priority: newTaskPriority as Task['priority'],
        status: newTaskStatus as Task['status'],
        dueDate: newTaskDueDate || undefined,
        estimatedHours: newTaskEstHours ? Number(newTaskEstHours) : undefined,
        assignees: newTaskAssignees as unknown as User[],
        notes: newTaskNotes.trim() || undefined,
        links: newTaskLinks.length ? newTaskLinks : undefined,
        attachments: newTaskAttachments.length ? newTaskAttachments : undefined,
        checklist: newTaskChecklist.length ? (newTaskChecklist as unknown as Task['checklist']) : undefined,
      });
      resetCreateForm();
      setShowCreateTask(false);
      showSuccess('Task Created!', 'Your new task has been added to the board.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setNewTaskAssignees((prev) => {
      return prev.includes(userId) ? [] : [userId];
    });
  };

  const addLink = () => {
    const url = newTaskLinkInput.trim();
    if (!url || newTaskLinks.includes(url)) return;
    setNewTaskLinks((prev) => [...prev, url]);
    setNewTaskLinkInput('');
  };

  const removeLink = (url: string) => {
    setNewTaskLinks((prev) => prev.filter((l) => l !== url));
  };

  const addChecklistItemToForm = () => {
    const v = newTaskChecklistInput.trim();
    if (!v) return;
    setNewTaskChecklist((prev) => [...prev, v]);
    setNewTaskChecklistInput('');
  };

  const removeChecklistItemFromForm = (idx: number) => {
    setNewTaskChecklist((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadFiles = async (files: FileList | File[]) => {
    setFileUploadError('');
    setFileUploading(true);
    try {
      for (const file of Array.from(files)) {
        const data = await uploadFile(file);
        setNewTaskAttachments((prev) => [...prev, {
          name: data.name, url: data.url, type: data.type, uploadedAt: new Date().toISOString(),
        }]);
      }
    } catch {
      setFileUploadError('Upload failed. Check file type/size (max 1 GB).');
    } finally {
      setFileUploading(false);
    }
  };

  const removeAttachment = (url: string) => {
    setNewTaskAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  const getFileIcon = (type: string) => {
    if (type === 'image') return '🖼️';
    return '📄';
  };

  const handleTaskUpdate = (updated: Task) => {
    setSelectedTask(updated);
    loadData();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the project?')) return;
    const { default: api } = await import('@/lib/api');
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
      const updated = await fetchProject(projectId);
      if (updated) setProject(updated);
    } catch {
      // ignore
    }
  };

  const openTablePicker = async () => {
    setShowTablePicker(true);
    setLoadingAvailableTables(true);
    const all = await fetchAllTables(true);
    const attachedTemplateIds = new Set((project?.tableInstances ?? []).map((t) => t.sourceTable).filter(Boolean));
    setAvailableTables(all.filter((t) => !attachedTemplateIds.has(t._id)));
    setLoadingAvailableTables(false);
  };

  const handleAttachTable = async (tableId: string) => {
    setAttachingTableId(tableId);
    try {
      const { data } = await api.post(`/projects/${projectId}/tables`, { tableId });
      setProject(data);
      setShowTablePicker(false);
      const instances = data.tableInstances ?? [];
      const newInstance = instances[instances.length - 1];
      if (newInstance) setActiveTab(`table:${newInstance._id}`);
    } catch {
      // ignore
    }
    setAttachingTableId(null);
  };

  const handleDetachTable = async (tableId: string) => {
    if (!confirm('Remove this table from the project? The table itself and its data will not be deleted.')) return;
    try {
      await api.delete(`/projects/${projectId}/tables/${tableId}`);
      const updated = await fetchProject(projectId);
      if (updated) setProject(updated);
      if (activeTab === `table:${tableId}`) setActiveTab('board');
    } catch {
      // ignore
    }
  };

  const handleCreateProjectTab = async () => {
    if (!newTabName.trim()) return;
    setCreatingTab(true);
    const updated = await createProjectTab(projectId, newTabName.trim(), newTabTemplateId || undefined);
    setCreatingTab(false);
    if (updated) {
      setProject(updated);
      setShowTablePicker(false);
      const created = updated.tabs?.[updated.tabs.length - 1];
      setNewTabName('');
      setNewTabTemplateId('');
      if (created) setActiveTab(`customtab:${created._id}`);
    }
  };

  const handleTabRenamed = async (tabId: string, name: string) => {
    const updated = await updateProjectTab(tabId, { name });
    if (updated) {
      setProject((p) => (p ? { ...p, tabs: (p.tabs ?? []).map((t) => (t._id === tabId ? { ...t, name: updated.name } : t)) } : p));
    }
  };

  const handleTabTemplateChanged = async (tabId: string, templateId: string | null) => {
    const updated = await updateProjectTab(tabId, { templateId });
    if (updated) {
      setProject((p) => (p ? { ...p, tabs: (p.tabs ?? []).map((t) => (t._id === tabId ? updated : t)) } : p));
    }
  };

  const handleTabDeleted = (tabId: string) => {
    setProject((p) => (p ? { ...p, tabs: (p.tabs ?? []).filter((t) => t._id !== tabId) } : p));
    if (activeTab === `customtab:${tabId}`) setActiveTab('board');
  };

  const saveLinks = async (links: { title: string; url: string }[]) => {
    setSavingLinks(true);
    const updated = await updateProject(projectId, { links } as any);
    if (updated) setProject(updated);
    setSavingLinks(false);
  };

  const handleAddLink = async () => {
    const t = linkTitle.trim();
    const u = linkUrl.trim();
    if (!t || !u) return;
    const existing = project?.links || [];
    await saveLinks([...existing, { title: t, url: u }]);
    setLinkTitle('');
    setLinkUrl('');
  };

  const handleDeleteLink = async (idx: number) => {
    const updated = (project?.links || []).filter((_, i) => i !== idx);
    await saveLinks(updated);
  };

  const handleEditLink = (idx: number) => {
    const link = project?.links?.[idx];
    if (!link) return;
    setEditingLinkIdx(idx);
    setEditLinkTitle(link.title);
    setEditLinkUrl(link.url);
  };

  const handleSaveEditLink = async () => {
    if (editingLinkIdx === null) return;
    const t = editLinkTitle.trim();
    const u = editLinkUrl.trim();
    if (!t || !u) return;
    const updated = (project?.links || []).map((l, i) =>
      i === editingLinkIdx ? { title: t, url: u } : l
    );
    await saveLinks(updated);
    setEditingLinkIdx(null);
  };

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  if (loading) {
    return (
      <AppShell>
        <div className={styles.loading}><Spinner size="lg" /></div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <div className={styles.loading}><p>Project not found</p></div>
      </AppShell>
    );
  }

  return (
    <AppShell title={project.title}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.badges}>
              <Badge variant="primary">{formatStatus(project.status)}</Badge>
              <Badge variant="warning">{project.priority}</Badge>
            </div>
            <p className={styles.desc}>{project.description}</p>
            <div className={styles.meta}>
              <span>{formatDate(project.startDate)}{project.endDate ? ` – ${formatDate(project.endDate)}` : ''}</span>
              <span>{project.totalTasks || 0} tasks</span>
            </div>
            <ProgressBar value={project.progress} showLabel />
          </div>
          {canManage && (
            <button className={styles.editBtn} onClick={() => setShowEdit(true)} title="Edit project">
              <Pencil size={15} strokeWidth={2.2} />
              Edit
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          <div className={styles.tabsScroll}>
          <button
            className={`${styles.tab} ${activeTab === 'board' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('board')}
          >
            Board
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'list' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('list')}
          >
            List
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'members' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members ({project.members.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'media' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('media')}
          >
            Media
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'calendar' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            Calendar
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'links' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('links')}
          >
            Links{project.links && project.links.length > 0 && <span className={styles.tabBadge}>{project.links.length}</span>}
          </button>
          {canSeeSocialTab && (
            <button
              className={`${styles.tab} ${activeTab === 'social' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('social')}
            >
              Social
            </button>
          )}
          <button
            className={`${styles.tab} ${activeTab === 'credentials' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('credentials')}
          >
            Credentials
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'sopProgress' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('sopProgress')}
          >
            SOP Progress
            {runningSopCount > 0 && <span className={styles.tabBadge}>{runningSopCount}</span>}
          </button>

          {(project.tableInstances ?? []).map((t) => (
            <div key={t._id} className={styles.tableTabWrap}>
              <button
                className={`${styles.tab} ${activeTab === `table:${t._id}` ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(`table:${t._id}`)}
              >
                <span className={styles.tableTabDot} style={{ background: t.color }} />
                {t.name}
              </button>
              {canManage && (
                <button
                  className={styles.tableTabRemove}
                  onClick={() => handleDetachTable(t._id)}
                  title="Remove table from project"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}

          {(project.tabs ?? []).map((t) => (
            <button
              key={t._id}
              className={`${styles.tab} ${activeTab === `customtab:${t._id}` ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(`customtab:${t._id}`)}
            >
              {t.name}
            </button>
          ))}

          </div>

          {canManage && (
            <div className={styles.addTableWrap}>
              <button className={styles.addTableBtn} onClick={openTablePicker} title="Add a table or tab">
                <Plus size={15} />
              </button>
              {showTablePicker && (
                <div className={styles.addTablePopover}>
                  <div className={styles.addTablePopoverHeader}>
                    <TableProperties size={14} /> Add
                  </div>

                  <div className={styles.addTabStack}>
                    <input
                      className={styles.addTabInput}
                      placeholder="New tab name (e.g. Influencers)"
                      value={newTabName}
                      onChange={(e) => setNewTabName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProjectTab()}
                    />
                    {availableTables.length > 0 && (
                      <select
                        className={styles.addTabInput}
                        value={newTabTemplateId}
                        onChange={(e) => setNewTabTemplateId(e.target.value)}
                      >
                        <option value="">Default template (optional)</option>
                        {availableTables.map((t) => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    <Button size="sm" onClick={handleCreateProjectTab} disabled={!newTabName.trim() || creatingTab} fullWidth>
                      {creatingTab ? 'Creating…' : 'Create Tab'}
                    </Button>
                  </div>

                  <div className={styles.addTablePopoverDivider}>or attach a table directly</div>

                  {loadingAvailableTables ? (
                    <div className={styles.addTableLoading}><Spinner size="sm" /></div>
                  ) : availableTables.length === 0 ? (
                    <p className={styles.addTableEmpty}>
                      No tables available. Create one under <strong>Tables</strong> in the sidebar first.
                    </p>
                  ) : (
                    <div className={styles.addTableList}>
                      {availableTables.map((t) => (
                        <button
                          key={t._id}
                          className={styles.addTableItem}
                          onClick={() => handleAttachTable(t._id)}
                          disabled={attachingTableId === t._id}
                        >
                          <span className={styles.tableTabDot} style={{ background: t.color }} />
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button className={styles.addTableClose} onClick={() => setShowTablePicker(false)}>Close</button>
                </div>
              )}
            </div>
          )}

          <div className={styles.tabActions}>
            <Button size="sm" variant="secondary" onClick={() => setShowStartSOP(true)}>
              Start SOP
            </Button>
            <Button size="sm" onClick={() => { setShowCreateTask(true); }}>
              + Add Task
            </Button>
          </div>
        </div>

        {(activeTab === 'board' || activeTab === 'list') && (
          <div className={styles.taskFilterBar}>
            {([
              { key: 'all',            label: 'All Tasks' },
              { key: 'assigned_to_me', label: 'Assigned to me' },
              { key: 'assigned_by_me', label: 'Assigned by me' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                className={`${styles.taskFilterPill} ${taskFilter === key ? styles.taskFilterPillActive : ''}`}
                onClick={() => setTaskFilter(key)}
              >
                {label}
                {key !== 'all' && (
                  <span className={styles.taskFilterCount}>
                    {key === 'assigned_to_me'
                      ? localTasks.filter((t) => t.assignees.filter(Boolean).some((a) => ((a as any)._id?.toString() || (a as any).id) === (user?.id ?? ''))).length
                      : localTasks.filter((t) => {
                          const rid = (t.reporter as any)?._id?.toString() || (t.reporter as any)?.id;
                          return rid === (user?.id ?? '');
                        }).length
                    }
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'board' && (
          tasksLoading ? (
            <div className={styles.loading}><Spinner /></div>
          ) : (
            <KanbanBoard
              tasks={filteredTasks}
              onTaskClick={handleTaskClick}
              onStatusChange={handleStatusChange}
              onTaskUpdate={handleTaskTimerUpdate}
              patchTimer={patchTimer}
            />
          )
        )}

        {activeTab === 'list' && (
          <ProjectListView
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
            onTaskUpdate={handleTaskTimerUpdate}
            patchTimer={patchTimer}
          />
        )}

        {activeTab === 'members' && (
          <div className={styles.membersList}>
            {project.members.map((m) => (
              <div key={m.user?.id || m.user?.email} className={styles.memberItem}>
                <Avatar name={m.user?.name || 'U'} src={m.user?.avatar} size="md" />
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{m.user?.name}</span>
                  <span className={styles.memberEmail}>{m.user?.email}</span>
                </div>
                {m.user?.role && (
                  <Badge variant={positionVariant[m.user.role] ?? 'default'}>{m.user.role}</Badge>
                )}
                {canManage && m.role !== 'lead' && (
                  <button
                    className={styles.removeBtn}
                    title="Remove member"
                    onClick={() => handleRemoveMember(m.user?.id || '')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'media' && (
          <MediaLibrary projectId={projectId} />
        )}

        {activeTab === 'calendar' && (
          <ProjectCalendar projectId={projectId} />
        )}

        {activeTab === 'social' && canSeeSocialTab && (
          <SocialTab projectId={projectId} />
        )}

        {activeTab === 'credentials' && (
          <CredentialsTab projectId={projectId} />
        )}

        {activeTab === 'sopProgress' && (
          <SOPProgressTab
            tasks={localTasks}
            onTaskClick={handleTaskClick}
            onRunDeleted={(ids) => setLocalTasks((prev) => prev.filter((t) => !ids.includes(t._id)))}
          />
        )}

        {activeTab.startsWith('table:') && (
          <ProjectTableTab instanceId={activeTab.slice('table:'.length)} />
        )}

        {activeTab.startsWith('customtab:') && (() => {
          const tabId = activeTab.slice('customtab:'.length);
          const tab = (project.tabs ?? []).find((t) => t._id === tabId);
          if (!tab) return null;
          return (
            <ProjectCustomTabView
              tab={tab}
              canManage={canManage}
              onTabRenamed={handleTabRenamed}
              onTabDeleted={handleTabDeleted}
              onTemplateChanged={handleTabTemplateChanged}
            />
          );
        })()}

        {activeTab === 'links' && (
          <div className={styles.linksPanel}>
            {/* Add link form — admins/managers only */}
            {canManage && (
              <div className={styles.linkAddCard}>
                <h3 className={styles.linkAddTitle}>Add Link</h3>
                <div className={styles.linkAddRow}>
                  <input
                    className={styles.linkInput}
                    placeholder="Title (e.g. Figma Design)"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  />
                  <input
                    className={styles.linkInput}
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  />
                  <button
                    className={styles.linkAddBtn}
                    onClick={handleAddLink}
                    disabled={!linkTitle.trim() || !linkUrl.trim() || savingLinks}
                  >
                    {savingLinks ? '…' : '+ Add'}
                  </button>
                </div>
              </div>
            )}

            {/* Link list */}
            {!project.links || project.links.length === 0 ? (
              <div className={styles.linksEmpty}>
                <span className={styles.linksEmptyIcon}>🔗</span>
                <p>No links added yet.</p>
                {canManage && <p className={styles.linksEmptySub}>Use the form above to add your first link.</p>}
              </div>
            ) : (
              <div className={styles.linkList}>
                {project.links.map((link, idx) => (
                  <div key={idx} className={styles.linkItem}>
                    {editingLinkIdx === idx ? (
                      /* Inline edit row */
                      <div className={styles.linkEditRow}>
                        <input
                          className={styles.linkInput}
                          value={editLinkTitle}
                          onChange={(e) => setEditLinkTitle(e.target.value)}
                          placeholder="Title"
                          autoFocus
                        />
                        <input
                          className={styles.linkInput}
                          value={editLinkUrl}
                          onChange={(e) => setEditLinkUrl(e.target.value)}
                          placeholder="https://..."
                        />
                        <button className={styles.linkSaveBtn} onClick={handleSaveEditLink} disabled={savingLinks}>Save</button>
                        <button className={styles.linkCancelBtn} onClick={() => setEditingLinkIdx(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className={styles.linkIcon}>
                          <Link size={14} />
                        </span>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkTitle}
                        >
                          {link.title}
                          <ExternalLink className={styles.linkExtIcon} size={11} strokeWidth={2.5} />
                        </a>
                        {canManage && (
                          <div className={styles.linkActions}>
                            <button className={styles.linkEditBtn} onClick={() => handleEditLink(idx)} title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button className={styles.linkDeleteBtn} onClick={() => handleDeleteLink(idx)} title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <TaskModal
        task={selectedTask}
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        onUpdate={handleTaskUpdate}
        onDelete={async (t) => { await deleteTask(t._id); setShowTaskModal(false); setSelectedTask(null); }}
        onSaved={() => { setShowTaskModal(false); setSelectedTask(null); showSuccess('Task Updated!', 'All changes have been saved.'); }}
        members={members}
        projects={project ? [{ _id: project._id, title: project.title }] : []}
        patchTimer={patchTimer}
      />

      <StartSOPModal
        isOpen={showStartSOP}
        onClose={() => setShowStartSOP(false)}
        projectId={projectId}
        onStarted={async () => {
          setShowStartSOP(false);
          await fetchTasks({ projectId });
          showSuccess('SOP Started!', 'Tasks have been generated for this project.');
        }}
      />

      <SuccessPopup
        visible={successPopup.visible}
        title={successPopup.title}
        subtitle={successPopup.subtitle}
        onDone={hideSuccess}
      />

      {/* ── Edit Project Modal ── */}
      {canManage && project && (
        <EditProjectModal
          isOpen={showEdit}
          project={project}
          members={members}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setProject(updated); setShowEdit(false); }}
        />
      )}

      {/* ── Create Task Modal ── */}
      <Modal
        isOpen={showCreateTask}
        onClose={() => { setShowCreateTask(false); resetCreateForm(); }}
        title="Create New Task"
        size="lg"
      >
        <div className={createStyles.form}>
          {/* Tab bar */}
          <div className={createStyles.tabBar}>
            {(['details', 'checklist', 'notes', 'links', 'files'] as CreateTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`${createStyles.tabBtn} ${createTab === tab ? createStyles.tabBtnActive : ''}`}
                onClick={() => setCreateTab(tab)}
              >
                {tab === 'details' && 'Details'}
                {tab === 'checklist' && (
                  <>Checklist{newTaskChecklist.length > 0 && <span className={createStyles.tabCount}>{newTaskChecklist.length}</span>}</>
                )}
                {tab === 'notes' && 'Notes'}
                {tab === 'links' && (
                  <>Links{newTaskLinks.length > 0 && <span className={createStyles.tabCount}>{newTaskLinks.length}</span>}</>
                )}
                {tab === 'files' && (
                  <>Files{newTaskAttachments.length > 0 && <span className={createStyles.tabCount}>{newTaskAttachments.length}</span>}</>
                )}
              </button>
            ))}
          </div>

          {/* Tab: Details */}
          {createTab === 'details' && (
            <div className={createStyles.tabContent}>

              {/* Template picker */}
              {departments.some((d) => (d.taskTemplates ?? []).length > 0) && (
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Use Template</label>
                  <select
                    className={createStyles.select}
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const [deptId, templateId, typeId] = e.target.value.split('::');
                      const dept = departments.find((d) => d._id === deptId);
                      const tpl = dept?.taskTemplates?.find((t) => t._id === templateId);
                      const ty  = typeId ? tpl?.types?.find((t) => t._id === typeId) : undefined;
                      if (ty) {
                        setNewTaskTitle(ty.title);
                        setNewTaskDescription(ty.description || tpl?.description || '');
                        const priority = ty.priority || tpl?.priority;
                        if (priority) setNewTaskPriority(priority);
                        if (ty.estimatedHours != null) setNewTaskEstHours(String(ty.estimatedHours));
                        setNewTaskChecklist(ty.checklist ?? tpl?.checklist ?? []);
                      } else if (tpl) {
                        setNewTaskTitle(tpl.title);
                        setNewTaskDescription(tpl.description || '');
                        if (tpl.priority) setNewTaskPriority(tpl.priority);
                        if (tpl.estimatedHours != null) setNewTaskEstHours(String(tpl.estimatedHours));
                        setNewTaskChecklist(tpl.checklist ?? []);
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">— Pick a template to pre-fill —</option>
                    {departments.filter((d) => (d.taskTemplates ?? []).length > 0).map((d) => (
                      <optgroup key={d._id} label={d.name}>
                        {d.taskTemplates.flatMap((t) => [
                          <option key={t._id} value={`${d._id}::${t._id}`}>
                            {t.title}{t.estimatedHours != null ? ` (${t.estimatedHours}h)` : ''}
                          </option>,
                          ...(t.types ?? []).map((ty) => (
                            <option key={ty._id} value={`${d._id}::${t._id}::${ty._id}`}>
                              {`— ${t.title}: ${ty.title}`}{ty.estimatedHours != null ? ` (${ty.estimatedHours}h)` : ''}
                            </option>
                          )),
                        ])}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              <div className={createStyles.field}>
                <label className={createStyles.label}>Title <span className={createStyles.req}>*</span></label>
                <input
                  className={createStyles.input}
                  placeholder="What needs to be done?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={createStyles.field}>
                <label className={createStyles.label}>Description</label>
                <textarea
                  className={createStyles.textarea}
                  placeholder="Add more details..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className={createStyles.row}>
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Status</label>
                  <select className={createStyles.select} value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)}>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="on_hold">On Hold</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Priority</label>
                  <select className={createStyles.select} value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className={createStyles.row}>
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Due Date</label>
                  <input type="date" className={createStyles.input} value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} />
                </div>
                <div className={createStyles.field}>
                  <label className={createStyles.label}>Estimated Hours</label>
                  <input type="number" min="0" step="0.5" className={createStyles.input} placeholder="e.g. 4" value={newTaskEstHours} onChange={(e) => setNewTaskEstHours(e.target.value)} />
                </div>
              </div>

              <div className={createStyles.field}>
                <label className={createStyles.label}>Assignee</label>
                {isDeptHead && (
                  <p className={createStyles.deptAssigneeHint}>
                    {myHeadedDepts.map((d) => d.name).join(', ')}
                  </p>
                )}
                <div className={createStyles.assigneeGrid}>
                  {(isAdminOrManager ? members : isDeptHead ? deptMembers : []).map((m) => {
                    const mid = m.id ?? (m as any)._id;
                    const checked = newTaskAssignees.includes(mid);
                    return (
                      <button
                        key={mid}
                        type="button"
                        className={`${createStyles.assigneeChip} ${checked ? createStyles.assigneeChipActive : ''}`}
                        onClick={() => toggleAssignee(mid)}
                      >
                        <span className={createStyles.assigneeInitial}>{m.name.charAt(0).toUpperCase()}</span>
                        <span className={createStyles.assigneeName}>{m.name}</span>
                        {checked && (
                          <Check size={12} strokeWidth={3} />
                        )}
                      </button>
                    );
                  })}
                  {!isAdminOrManager && !isDeptHead && (
                    /* Regular member — assign to self only */
                    <button
                      type="button"
                      className={`${createStyles.assigneeChip} ${newTaskAssignees.includes(user?.id ?? '') ? createStyles.assigneeChipActive : ''}`}
                      onClick={() => toggleAssignee(user?.id ?? '')}
                    >
                      <span className={createStyles.assigneeInitial}>{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
                      <span className={createStyles.assigneeName}>Assign to me</span>
                      {newTaskAssignees.includes(user?.id ?? '') && (
                        <Check size={12} strokeWidth={3} />
                      )}
                    </button>
                  )}
                  {isAdminOrManager && members.length === 0 && (
                    <span className={createStyles.noMembers}>No members in this project yet.</span>
                  )}
                  {isDeptHead && deptMembers.length === 0 && (
                    <span className={createStyles.noMembers}>No members in your department yet.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Notes */}
          {createTab === 'notes' && (
            <div className={createStyles.tabContent}>
              <div className={createStyles.field}>
                <label className={createStyles.label}>Notes</label>
                <textarea
                  className={`${createStyles.textarea} ${createStyles.notesTextarea}`}
                  placeholder="Add internal notes, context, or anything relevant to this task…"
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Tab: Links */}
          {createTab === 'checklist' && (
            <div className={createStyles.tabContent}>
              <div className={createStyles.field}>
                <label className={createStyles.label}>Add Checklist Item</label>
                <div className={createStyles.addRow}>
                  <input
                    className={createStyles.input}
                    placeholder="Checklist item"
                    value={newTaskChecklistInput}
                    onChange={(e) => setNewTaskChecklistInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItemToForm(); } }}
                    autoFocus
                  />
                  <Button size="sm" onClick={addChecklistItemToForm} disabled={!newTaskChecklistInput.trim()}>Add</Button>
                </div>
              </div>
              {newTaskChecklist.length > 0 && (
                <div className={createStyles.linkList}>
                  {newTaskChecklist.map((item, i) => (
                    <div key={i} className={createStyles.linkItem}>
                      <span className={createStyles.linkIcon}>☑</span>
                      <span className={createStyles.linkUrl}>{item}</span>
                      <button type="button" className={createStyles.removeBtn} onClick={() => removeChecklistItemFromForm(i)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {newTaskChecklist.length === 0 && (
                <p className={createStyles.emptyHint}>No checklist items yet. Add one above, or pick a template that has one.</p>
              )}
            </div>
          )}

          {createTab === 'links' && (
            <div className={createStyles.tabContent}>
              <div className={createStyles.field}>
                <label className={createStyles.label}>Add Link</label>
                <div className={createStyles.addRow}>
                  <input
                    className={createStyles.input}
                    placeholder="https://example.com"
                    value={newTaskLinkInput}
                    onChange={(e) => setNewTaskLinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                    autoFocus
                  />
                  <Button size="sm" onClick={addLink} disabled={!newTaskLinkInput.trim()}>Add</Button>
                </div>
              </div>
              {newTaskLinks.length > 0 && (
                <div className={createStyles.linkList}>
                  {newTaskLinks.map((url) => (
                    <div key={url} className={createStyles.linkItem}>
                      <span className={createStyles.linkIcon}>🔗</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className={createStyles.linkUrl}>{url}</a>
                      <button type="button" className={createStyles.removeBtn} onClick={() => removeLink(url)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {newTaskLinks.length === 0 && (
                <p className={createStyles.emptyHint}>No links added yet. Paste a URL above and click Add.</p>
              )}
            </div>
          )}

          {/* Tab: Files */}
          {createTab === 'files' && (
            <div className={createStyles.tabContent}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className={createStyles.fileInputHidden}
                onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }}
              />

              {/* Uploaded file list — shown FIRST so it's always visible */}
              {newTaskAttachments.length > 0 && (
                <div className={createStyles.attachList}>
                  {newTaskAttachments.map((a) => (
                    <div key={a.url} className={createStyles.attachItem}>
                      {a.type === 'image' ? (
                        <div className={createStyles.previewThumb}>
                          <img src={`${API_BASE}${a.url}`} alt={a.name} />
                        </div>
                      ) : (
                        <span className={createStyles.attachIcon}>{getFileIcon(a.type)}</span>
                      )}
                      <div className={createStyles.attachInfo}>
                        <a href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer" className={createStyles.attachName}>{a.name}</a>
                      </div>
                      <button type="button" className={createStyles.removeBtn} onClick={() => removeAttachment(a.url)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone — compact when files already uploaded */}
              <div
                className={`${createStyles.dropZone} ${newTaskAttachments.length > 0 ? createStyles.dropZoneCompact : ''} ${isDragging ? createStyles.dropZoneActive : ''} ${fileUploading ? createStyles.dropZoneUploading : ''}`}
                onClick={() => !fileUploading && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
                }}
              >
                <span className={createStyles.dropZoneIcon}>{fileUploading ? '⏳' : '📎'}</span>
                <span className={createStyles.dropZoneText}>
                  {fileUploading ? 'Uploading…' : <><u>Click to browse</u> or drag &amp; drop</>}
                </span>
                {!newTaskAttachments.length && <span className={createStyles.dropZoneSub}>Images, PDFs, docs — max 1 GB each</span>}
              </div>
              {fileUploadError && <p className={createStyles.uploadError}>{fileUploadError}</p>}
              {newTaskAttachments.length === 0 && !fileUploading && (
                <p className={createStyles.emptyHint}>No files attached yet.</p>
              )}
            </div>
          )}

          {/* Always-visible actions */}
          <div className={createStyles.actions}>
            <Button variant="ghost" onClick={() => { setShowCreateTask(false); resetCreateForm(); }} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim() || createSubmitting || fileUploading}>
              {createSubmitting ? 'Creating…' : 'Create Task'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
