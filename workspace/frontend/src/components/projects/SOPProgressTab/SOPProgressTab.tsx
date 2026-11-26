'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSOPs } from '@/hooks/useSOPs';
import { useAuthStore } from '@/store/authStore';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import type { Task, Project, User } from '@/types';
import { Workflow, ExternalLink, ChevronDown, Trash2 } from 'lucide-react';
import styles from './SOPProgressTab.module.css';

const STATUS_LABEL: Record<Task['status'], string> = {
  backlog: 'Blocked',
  todo: 'Ready',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

const STATUS_CLASS: Record<Task['status'], string> = {
  backlog: styles.statusBacklog,
  todo: styles.statusTodo,
  in_progress: styles.statusInProgress,
  in_review: styles.statusInReview,
  done: styles.statusDone,
};

function userId(u: User | string | undefined | null): string {
  if (!u) return '';
  return typeof u === 'string' ? u : ((u as any).id ?? (u as any)._id ?? '');
}

interface SOPGroup {
  groupKey: string;
  sopId: string;
  runId?: string;
  runTitle?: string;
  projectId?: string;
  steps: Task[];
  projectTitle?: string;
}

interface SOPProgressTabProps {
  tasks: Task[];
  showProject?: boolean;
  onTaskClick?: (task: Task) => void;
  onRunDeleted?: (deletedTaskIds: string[]) => void;
}

export default function SOPProgressTab({ tasks, showProject, onTaskClick, onRunDeleted }: SOPProgressTabProps) {
  const { fetchSOP, deleteSOPRun } = useSOPs(false);
  const user = useAuthStore((s) => s.user);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const groups: SOPGroup[] = useMemo(() => {
    const byGroup = new Map<string, Task[]>();
    for (const t of tasks) {
      const tag = (t.tags || []).find((tg) => tg.startsWith('sop:'));
      if (!tag) continue;
      // Runs created before per-run tracking existed don't have a sopRunId — fall
      // back to grouping by the shared SOP tag so old data still renders sanely.
      const groupKey = t.sopRunId || tag;
      if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
      byGroup.get(groupKey)!.push(t);
    }
    return Array.from(byGroup.entries()).map(([groupKey, steps]) => {
      const sorted = steps.slice().sort((a, b) => a.order - b.order);
      const first = sorted[0];
      const tag = (first.tags || []).find((tg) => tg.startsWith('sop:'))!;
      const project = sorted.find((s) => typeof s.project === 'object')?.project as Project | undefined;
      return {
        groupKey,
        sopId: tag.slice(4),
        runId: first.sopRunId,
        runTitle: first.sopRunTitle,
        projectId: project?._id || (typeof first.project === 'string' ? first.project : undefined),
        steps: sorted,
        projectTitle: project?.title,
      };
    });
  }, [tasks]);

  useEffect(() => {
    const missing = groups.filter((g) => !g.runTitle).map((g) => g.sopId).filter((id) => !(id in titles));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(missing.map(async (id) => {
        const sop = await fetchSOP(id);
        return [id, sop?.title || 'SOP'] as const;
      }));
      if (!cancelled) setTitles((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // Default to the first SOP expanded once the list loads, instead of an empty accordion.
  useEffect(() => {
    if (expandedId === null && groups.length > 0) setExpandedId(groups[0].groupKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  async function handleDeleteRun(g: SOPGroup) {
    if (!g.runId || !g.projectId) return;
    if (!confirm(`Delete "${g.runTitle || 'this run'}"? All ${g.steps.length} task(s) it generated will be permanently deleted. This cannot be undone.`)) return;
    setDeletingKey(g.groupKey);
    const ok = await deleteSOPRun(g.projectId, g.runId);
    setDeletingKey(null);
    if (ok) onRunDeleted?.(g.steps.map((s) => s._id));
  }

  if (groups.length === 0) {
    return (
      <div className={styles.empty}>
        <Workflow size={28} strokeWidth={1.5} />
        <div className={styles.emptyTitle}>No SOPs running yet</div>
        <div className={styles.emptySub}>Use &ldquo;Start SOP&rdquo; on a project to kick one off.</div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {groups.map((g) => {
        const done = g.steps.filter((s) => s.status === 'done').length;
        const pct = g.steps.length > 0 ? Math.round((done / g.steps.length) * 100) : 0;
        const isOpen = expandedId === g.groupKey;
        const canDelete = Boolean(g.runId) && (
          user?.role === 'admin' || user?.role === 'manager' ||
          g.steps.every((s) => userId(s.reporter) === user?.id)
        );
        return (
          <div key={g.groupKey} className={styles.group}>
            <button
              type="button"
              className={styles.groupHeader}
              onClick={() => setExpandedId(isOpen ? null : g.groupKey)}
              aria-expanded={isOpen}
            >
              <ChevronDown size={15} className={`${styles.groupChevron} ${isOpen ? styles.groupChevronOpen : ''}`} />
              <span className={styles.groupTitleWrap}>
                <span className={styles.groupTitle}>{g.runTitle || titles[g.sopId] || 'Loading…'}</span>
                {showProject && g.projectTitle && (
                  <span className={styles.groupProject}>{g.projectTitle}</span>
                )}
              </span>
              <span className={styles.groupCount}>{done} / {g.steps.length} steps done</span>
              <span className={styles.groupProgress}><ProgressBar value={pct} size="sm" /></span>
            </button>
            {isOpen && (
              <div className={styles.groupBody}>
                <div className={styles.groupBodyBar}>
                  <Link href={`/sops/${g.sopId}`} className={styles.groupLink}>
                    Open SOP in builder <ExternalLink size={12} />
                  </Link>
                  {canDelete && (
                    <button
                      type="button"
                      className={styles.deleteRunBtn}
                      onClick={() => handleDeleteRun(g)}
                      disabled={deletingKey === g.groupKey}
                      title="Delete this run and all its tasks"
                    >
                      <Trash2 size={12} /> {deletingKey === g.groupKey ? 'Deleting…' : 'Delete run'}
                    </button>
                  )}
                </div>
                <div className={styles.steps}>
                  {g.steps.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      className={styles.step}
                      onClick={() => onTaskClick?.(s)}
                      disabled={!onTaskClick}
                    >
                      <span className={styles.stepOrder}>{s.order}</span>
                      <span className={styles.stepTitle}>{s.title}</span>
                      <span className={`${styles.stepStatus} ${STATUS_CLASS[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
