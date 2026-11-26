'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { SOP } from '@/types';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import styles from './SOPListPage.module.css';

const COLOR_VARS: Record<string, { bg: string; fg: string }> = {
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

function stepDepartments(sop: SOP): { _id: string; name: string; color: string }[] {
  const seen = new Map<string, { _id: string; name: string; color: string }>();
  for (const step of sop.steps) {
    if (typeof step.department === 'object' && step.department) {
      seen.set(step.department._id, step.department);
    }
  }
  return Array.from(seen.values());
}

export default function SOPListPage() {
  const router = useRouter();
  const [sops, setSops]           = useState<SOP[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SOP | null>(null);
  const [deleting, setDeleting]   = useState(false);

  function load() {
    api.getSOPs()
      .then(d => { setSops(d as SOP[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }
  useEffect(load, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await api.deleteSOP(deleteTarget._id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">SOPs</div>
        <div className="topbar-right">
          <button className="btn btn-p" onClick={() => router.push('/sops/new')}>
            <i className="ti ti-plus" /> New SOP
          </button>
        </div>
      </div>

      <div className="content">
        {!loaded && <div className={styles.loading}><i className="ti ti-loader-2" /> Loading…</div>}

        {loaded && sops.length === 0 && (
          <div className={styles.empty}>
            <i className="ti ti-sitemap" />
            <div className={styles.emptyTitle}>No SOPs yet</div>
            <div className={styles.emptySub}>
              Build a step-by-step workflow — e.g. &ldquo;Social Media Post&rdquo; — that fans work out
              across departments, then link it to a service so it fires automatically for every client.
            </div>
            <button className="btn btn-p" onClick={() => router.push('/sops/new')}>
              <i className="ti ti-plus" /> Create First SOP
            </button>
          </div>
        )}

        {loaded && sops.length > 0 && (
          <div className={styles.grid}>
            {sops.map(sop => {
              const depts = stepDepartments(sop);
              return (
                <div key={sop._id} className={styles.sopCard} onClick={() => router.push(`/sops/${sop._id}`)}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>{sop.title}</div>
                    <span className={`${styles.statusBadge} ${sop.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
                      {sop.status}
                    </span>
                  </div>

                  {sop.description && <div className={styles.cardDesc}>{sop.description}</div>}

                  {depts.length > 0 && (
                    <div className={styles.deptRow}>
                      {depts.map(d => {
                        const c = COLOR_VARS[d.color] || COLOR_VARS.indigo;
                        return (
                          <span key={d._id} className={styles.deptChip}>
                            <span className={styles.deptDot} style={{ background: c.fg }} />
                            {d.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    <span className={styles.stepCount}>
                      <i className="ti ti-git-branch" /> {sop.steps.length} step{sop.steps.length !== 1 ? 's' : ''}
                    </span>
                    <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                      <button className={styles.iconBtn} title="Edit" onClick={() => router.push(`/sops/${sop._id}`)}>
                        <i className="ti ti-pencil" />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Delete" onClick={() => setDeleteTarget(sop)}>
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirm
          title="Delete SOP"
          message={`Delete "${deleteTarget.title}"? Services linked to it will keep working, but new clients won't get its tasks auto-generated anymore. This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
