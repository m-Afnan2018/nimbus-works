'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useSOPs } from '@/hooks/useSOPs';
import { useDepartments } from '@/hooks/useDepartments';
import type { User } from '@/types';
import { Check, GitBranch, Workflow } from 'lucide-react';
import styles from './StartSOPModal.module.css';

function uid(u: User | string | undefined | null): string {
  if (!u) return '';
  return typeof u === 'string' ? u : ((u as any).id ?? (u as any)._id ?? '');
}

interface StartSOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fixed project to start the SOP on. Omit to let the user pick one (e.g. from the Tasks page). */
  projectId?: string;
  /** Required when `projectId` is omitted — the list of projects to choose from. */
  projects?: { _id: string; title: string }[];
  onStarted: () => void;
}

export default function StartSOPModal({ isOpen, onClose, projectId, projects, onStarted }: StartSOPModalProps) {
  const { sops, loading: sopsLoading, generateFromSOP } = useSOPs();
  const { departments } = useDepartments();

  const needsProjectPicker = !projectId;
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const effectiveProjectId = projectId || selectedProjectId;

  const [selectedSopId, setSelectedSopId] = useState<string>('');
  const [runTitle, setRunTitle] = useState('');
  const [assignments, setAssignments] = useState<Record<number, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishedSops = useMemo(() => sops.filter((s) => s.status === 'published'), [sops]);
  const selectedSop = useMemo(
    () => publishedSops.find((s) => s._id === selectedSopId) ?? null,
    [publishedSops, selectedSopId],
  );

  function membersForDepartment(deptId: string): User[] {
    const dept = departments.find((d) => d._id === deptId);
    if (!dept) return [];
    const seen = new Set<string>();
    const result: User[] = [];
    for (const m of [...dept.members, ...dept.heads]) {
      const id = uid(m);
      if (id && !seen.has(id)) { seen.add(id); result.push(m); }
    }
    return result;
  }

  function pickSop(id: string) {
    setSelectedSopId(id);
    setAssignments({});
    setError(null);
    setRunTitle(id ? publishedSops.find((s) => s._id === id)?.title || '' : '');
  }

  function toggleAssignee(stepOrder: number, userId: string) {
    setAssignments((prev) => {
      const current = prev[stepOrder] ?? [];
      const next = current.includes(userId) ? [] : [userId];
      return { ...prev, [stepOrder]: next };
    });
  }

  function reset() {
    setSelectedSopId('');
    setRunTitle('');
    setAssignments({});
    setError(null);
    setSubmitting(false);
    setSelectedProjectId(projectId || '');
  }

  async function handleStart() {
    if (!selectedSop) return;
    if (!effectiveProjectId) { setError('Select a project first.'); return; }
    if (!runTitle.trim()) { setError('Give this run a title.'); return; }
    setSubmitting(true);
    setError(null);
    const result = await generateFromSOP(selectedSop._id, effectiveProjectId, runTitle.trim(), assignments);
    setSubmitting(false);
    if (result) {
      reset();
      onStarted();
    } else {
      setError('Failed to start SOP.');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title="Start SOP"
      size="lg"
    >
      <div className={styles.form}>
        {needsProjectPicker && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Project</label>
            <select
              className={styles.select}
              value={selectedProjectId}
              onChange={(e) => { setSelectedProjectId(e.target.value); setError(null); }}
            >
              <option value="">Select a project…</option>
              {(projects ?? []).map((p) => (
                <option key={p._id} value={p._id}>{p.title}</option>
              ))}
            </select>
          </div>
        )}
        {sopsLoading ? (
          <div className={styles.loading}><Spinner /></div>
        ) : !selectedSop ? (
          <>
            <p className={styles.hint}>Pick a workflow to run on this project.</p>
            {publishedSops.length === 0 ? (
              <div className={styles.empty}>
                <Workflow size={22} strokeWidth={1.5} />
                <span>No published SOPs yet.</span>
              </div>
            ) : (
              <div className={styles.sopList}>
                {publishedSops.map((sop) => (
                  <button
                    key={sop._id}
                    type="button"
                    className={styles.sopCard}
                    onClick={() => pickSop(sop._id)}
                  >
                    <span className={styles.sopCardTitle}>{sop.title}</span>
                    {sop.description && <span className={styles.sopCardDesc}>{sop.description}</span>}
                    <span className={styles.sopCardMeta}>
                      <GitBranch size={12} /> {sop.steps.length} step{sop.steps.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.selectedHeader}>
              <div>
                <span className={styles.selectedTitle}>{selectedSop.title}</span>
                {selectedSop.description && <p className={styles.selectedDesc}>{selectedSop.description}</p>}
              </div>
              <button type="button" className={styles.changeBtn} onClick={() => pickSop('')}>
                Change
              </button>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Title for this run</label>
              <input
                className={styles.select}
                value={runTitle}
                onChange={(e) => { setRunTitle(e.target.value); setError(null); }}
                placeholder="e.g. Diwali Sale Post"
              />
              <p className={styles.hint} style={{ marginTop: '0.25rem' }}>
                You can start this SOP more than once on the same project — give each run its own title so they&rsquo;re easy to tell apart later.
              </p>
            </div>

            <p className={styles.hint}>Assign each step now, or leave it unassigned and assign later.</p>

            <div className={styles.stepList}>
              {[...selectedSop.steps].sort((a, b) => a.order - b.order).map((step) => {
                const dept = typeof step.department === 'object' ? step.department : null;
                const deptId = typeof step.department === 'string' ? step.department : step.department._id;
                const deptMembers = membersForDepartment(deptId);
                const stepAssignees = assignments[step.order] ?? [];
                return (
                  <div key={step._id} className={styles.step}>
                    <div className={styles.stepHeader}>
                      <span className={styles.stepTitle}>{step.title}</span>
                      {dept && (
                        <span className={styles.deptChip}>
                          <span className={styles.deptDot} style={{ background: dept.color }} />
                          {dept.name}
                        </span>
                      )}
                    </div>
                    <div className={styles.assigneeGrid}>
                      {deptMembers.map((m) => {
                        const mid = uid(m);
                        const checked = stepAssignees.includes(mid);
                        return (
                          <button
                            key={mid}
                            type="button"
                            className={`${styles.assigneeChip} ${checked ? styles.assigneeChipActive : ''}`}
                            onClick={() => toggleAssignee(step.order, mid)}
                          >
                            <span className={styles.assigneeInitial}>{m.name.charAt(0).toUpperCase()}</span>
                            <span className={styles.assigneeName}>{m.name}</span>
                            {checked && <Check size={12} strokeWidth={3} />}
                          </button>
                        );
                      })}
                      {deptMembers.length === 0 && (
                        <span className={styles.noMembers}>No members in this department yet.</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
              <Button onClick={handleStart} loading={submitting} disabled={!effectiveProjectId || !runTitle.trim()}>Start SOP</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
