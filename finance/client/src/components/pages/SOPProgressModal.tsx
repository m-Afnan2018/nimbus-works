'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import styles from './SOPProgressModal.module.css';

interface TaskLite {
  _id: string;
  title: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  order: number;
  tags: string[];
  department?: { _id: string; name: string; color: string } | string;
}

interface SOPGroup {
  sopId: string;
  sopTitle: string;
  tasks: TaskLite[];
}

const STATUS_LABEL: Record<TaskLite['status'], string> = {
  backlog: 'Blocked',
  todo: 'Ready',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

const STATUS_STYLE: Record<TaskLite['status'], React.CSSProperties> = {
  backlog: { background: 'var(--surface2)', color: 'var(--text3)' },
  todo: { background: 'var(--blue-dim)', color: 'var(--blue)' },
  in_progress: { background: 'var(--amber-dim)', color: 'var(--amber)' },
  in_review: { background: 'var(--indigo-dim)', color: 'var(--indigo)' },
  done: { background: 'var(--emerald-dim)', color: 'var(--emerald)' },
};

const ACTIVE_STATUSES: TaskLite['status'][] = ['todo', 'in_progress', 'in_review'];

interface Props {
  clientId: string;
  clientName: string;
  onClose: () => void;
}

export default function SOPProgressModal({ clientId, clientName, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<SOPGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const client = await api.getClient(clientId) as { tasks?: TaskLite[] };
        const tasks = client.tasks || [];

        const bySop = new Map<string, TaskLite[]>();
        for (const t of tasks) {
          const sopTag = (t.tags || []).find((tag) => tag.startsWith('sop:'));
          if (!sopTag) continue;
          const sopId = sopTag.slice(4);
          if (!bySop.has(sopId)) bySop.set(sopId, []);
          bySop.get(sopId)!.push(t);
        }

        const entries = Array.from(bySop.entries());
        const withTitles = await Promise.all(
          entries.map(async ([sopId, sopTasks]) => {
            const sopTitle = await api.getSOP(sopId)
              .then((s) => (s as { title?: string })?.title || 'SOP')
              .catch(() => 'SOP');
            return {
              sopId,
              sopTitle,
              tasks: sopTasks.slice().sort((a, b) => a.order - b.order),
            };
          })
        );

        if (!cancelled) setGroups(withTitles);
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{clientName} — SOP Progress</span>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className={styles.body}>
            {loading ? (
              <div className={styles.loading}><i className="ti ti-loader-2" /> Loading…</div>
            ) : groups.length === 0 ? (
              <div className={styles.empty}>
                <i className="ti ti-sitemap" />
                <div className={styles.emptyTitle}>No SOP-driven work yet</div>
                <div className={styles.emptySub}>
                  This client isn&apos;t on a service with a linked, published SOP — no tasks
                  were auto-generated for them.
                </div>
              </div>
            ) : (
              groups.map((g) => {
                const done = g.tasks.filter((t) => t.status === 'done').length;
                const pct = g.tasks.length > 0 ? Math.round((done / g.tasks.length) * 100) : 0;
                return (
                  <div key={g.sopId} className={styles.group}>
                    <div className={styles.groupHeader}>
                      <span className={styles.groupTitle}>{g.sopTitle}</span>
                      <span className={styles.groupCount}>{done} / {g.tasks.length} steps done</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.steps}>
                      {g.tasks.map((t) => {
                        const dept = typeof t.department === 'object' ? t.department : null;
                        const isActive = ACTIVE_STATUSES.includes(t.status);
                        return (
                          <div key={t._id} className={`${styles.step} ${isActive ? styles.stepActive : ''}`}>
                            <span className={styles.stepOrder}>{t.order}</span>
                            <span className={styles.stepTitle}>{t.title}</span>
                            {dept && <span className={styles.stepDept}>{dept.name}</span>}
                            <span className={styles.stepStatus} style={STATUS_STYLE[t.status]}>
                              {STATUS_LABEL[t.status]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
