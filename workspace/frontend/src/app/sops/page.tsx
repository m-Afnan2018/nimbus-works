'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell/AppShell';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useSOPs } from '@/hooks/useSOPs';
import { useAuthStore } from '@/store/authStore';
import type { SOP } from '@/types';
import { Plus, Workflow, GitBranch, Pencil, Trash2 } from 'lucide-react';
import styles from './sops.module.css';

function ConfirmDeleteModal({
  isOpen, onClose, onConfirm, title, loading,
}: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; loading: boolean }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete SOP" size="sm">
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
        Delete &ldquo;{title}&rdquo;? Services linked to it will keep working, but new clients won&apos;t
        get its tasks auto-generated anymore. This cannot be undone.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </Modal>
  );
}

function stepDepartments(sop: SOP): { _id: string; name: string; color: string }[] {
  const seen = new Map<string, { _id: string; name: string; color: string }>();
  for (const step of sop.steps) {
    if (typeof step.department === 'object' && step.department) {
      seen.set(step.department._id, step.department);
    }
  }
  return Array.from(seen.values());
}

export default function SOPsPage() {
  const router = useRouter();
  const { sops, loading, deleteSOP } = useSOPs();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [deleteTarget, setDeleteTarget] = useState<SOP | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteSOP(deleteTarget._id);
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <AppShell title="SOPs">
      <div className={styles.header}>
        <span className={styles.headerTitle}>Standard Operating Procedures</span>
        {canManage && (
          <Button onClick={() => router.push('/sops/new')}>
            <Plus size={16} /> New SOP
          </Button>
        )}
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}><Spinner /></div>
        ) : sops.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><Workflow size={28} strokeWidth={1.5} /></div>
            <div className={styles.emptyTitle}>No SOPs yet</div>
            <div className={styles.emptyDesc}>
              Build a step-by-step workflow — e.g. &ldquo;Social Media Post&rdquo; — that fans work
              out across departments, then link it to a service so it fires automatically for every client.
            </div>
            {canManage && (
              <Button onClick={() => router.push('/sops/new')}>
                <Plus size={16} /> Create First SOP
              </Button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {sops.map((sop) => {
              const depts = stepDepartments(sop);
              return (
                <div key={sop._id} className={styles.card} onClick={() => router.push(`/sops/${sop._id}`)}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{sop.title}</span>
                    <span className={`${styles.statusBadge} ${sop.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
                      {sop.status}
                    </span>
                  </div>

                  {sop.description && <div className={styles.cardDesc}>{sop.description}</div>}

                  {depts.length > 0 && (
                    <div className={styles.deptRow}>
                      {depts.map((d) => (
                        <span key={d._id} className={styles.deptChip}>
                          <span className={styles.deptDot} style={{ background: d.color }} />
                          {d.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    <span className={styles.stepCount}>
                      <GitBranch size={13} /> {sop.steps.length} step{sop.steps.length !== 1 ? 's' : ''}
                    </span>
                    {canManage && (
                      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.iconBtn} title="Edit" onClick={() => router.push(`/sops/${sop._id}`)}>
                          <Pencil size={13} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Delete" onClick={() => setDeleteTarget(sop)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title={deleteTarget.title}
          loading={deleting}
        />
      )}
    </AppShell>
  );
}
