'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSOPs } from '@/hooks/useSOPs';
import { useDepartments } from '@/hooks/useDepartments';
import { useThemeStore } from '@/store/themeStore';
import type { SOP, SOPStep, Department } from '@/types';
import { ArrowLeft, Plus, Save, CheckCircle2, Pencil, X, MousePointerClick, Trash2, Loader2, Check } from 'lucide-react';
import Button from '@/components/ui/Button/Button';
import Spinner from '@/components/ui/Spinner/Spinner';
import SOPStepNode, { type SOPFlowNode, type SOPNodeData } from './SOPStepNode';
import styles from './SOPBuilder.module.css';

const nodeTypes = { sopStep: SOPStepNode };

function computeDepths(steps: SOPStep[]): Map<number, number> {
  const byOrder = new Map(steps.map((s) => [s.order, s]));
  const depths = new Map<number, number>();
  function depth(order: number, visiting: Set<number>): number {
    if (depths.has(order)) return depths.get(order)!;
    if (visiting.has(order)) return 0;
    visiting.add(order);
    const step = byOrder.get(order);
    if (!step || step.dependsOn.length === 0) { depths.set(order, 0); return 0; }
    const d = 1 + Math.max(...step.dependsOn.map((o) => depth(o, visiting)));
    depths.set(order, d);
    return d;
  }
  for (const s of steps) depth(s.order, new Set());
  return depths;
}

function autoLayout(steps: SOPStep[]): Map<number, { x: number; y: number }> {
  const depths = computeDepths(steps);
  const rows = new Map<number, number[]>();
  for (const s of steps) {
    const d = depths.get(s.order) ?? 0;
    if (!rows.has(d)) rows.set(d, []);
    rows.get(d)!.push(s.order);
  }
  const positions = new Map<number, { x: number; y: number }>();
  Array.from(rows.entries()).forEach(([depth, orders]) => {
    orders.forEach((order, i) => positions.set(order, { x: i * 260, y: depth * 160 }));
  });
  return positions;
}

function stepsToFlow(steps: SOPStep[], departments: Department[]): { nodes: SOPFlowNode[]; edges: Edge[] } {
  const layout = autoLayout(steps);
  const nodes: SOPFlowNode[] = steps.map((s) => {
    const dept = typeof s.department === 'object' && s.department ? s.department : null;
    const hasPos = s.positionX != null && s.positionY != null;
    const fallback = layout.get(s.order) || { x: 0, y: 0 };
    const deptId = dept?._id || (typeof s.department === 'string' ? s.department : '');
    const fullDept = departments.find((d) => d._id === deptId);
    const template = s.taskTemplateId ? fullDept?.taskTemplates?.find((t) => t._id === s.taskTemplateId) : undefined;
    const svcType = s.typeId ? template?.types?.find((ty) => ty._id === s.typeId) : undefined;
    return {
      id: String(s.order),
      type: 'sopStep',
      // Steps are only removable via the "Delete Step" button (which bridges
      // the chain around them) — not the canvas's keyboard delete shortcut,
      // which would just orphan the following steps.
      deletable: false,
      position: hasPos ? { x: s.positionX as number, y: s.positionY as number } : fallback,
      data: {
        order: s.order,
        title: s.title,
        description: s.description || '',
        departmentId: deptId,
        departmentName: dept?.name || '',
        departmentColor: dept?.color || '',
        taskTemplateId: s.taskTemplateId || '',
        taskTemplateName: template?.title || '',
        typeId: s.typeId || '',
        typeName: svcType?.title || '',
        estimatedHours: s.estimatedHours,
      },
    };
  });

  const edges: Edge[] = [];
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      edges.push({
        id: `${dep}-${s.order}`,
        source: String(dep),
        target: String(s.order),
      });
    }
  }
  return { nodes, edges };
}

function canReach(edges: Edge[], from: string, to: string): boolean {
  const visited = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (cur === to) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const e of edges) if (e.source === cur) stack.push(e.target);
  }
  return false;
}

interface Props { sopId: string; }

export default function SOPBuilder({ sopId }: Props) {
  const router = useRouter();
  const isNew = sopId === 'new';
  const { fetchSOP, createSOP, updateSOP } = useSOPs(false);
  const { departments, loading: departmentsLoading } = useDepartments();
  const theme = useThemeStore((s) => s.theme);

  const [title, setTitle] = useState('New SOP');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loaded, setLoaded] = useState(isNew);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState('');
  const [connectError, setConnectError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawSteps, setRawSteps] = useState<SOPStep[] | null>(null);
  const [nodesInitialized, setNodesInitialized] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<SOPFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nextOrderRef = useRef(1);

  useEffect(() => () => { if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current); }, []);

  useEffect(() => {
    if (isNew) return;
    fetchSOP(sopId).then((sop: SOP | null) => {
      if (!sop) { setLoaded(true); return; }
      setTitle(sop.title);
      setDescription(sop.description || '');
      setStatus(sop.status);
      setRawSteps(sop.steps);
      nextOrderRef.current = sop.steps.length > 0 ? Math.max(...sop.steps.map((s) => s.order)) + 1 : 1;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopId, isNew]);

  // Build the canvas once both the SOP's steps and the (nested) departments
  // list are ready — steps need departments loaded to resolve template/type names.
  useEffect(() => {
    if (nodesInitialized || isNew) return;
    if (rawSteps === null || departmentsLoading) return;
    const { nodes: n, edges: e } = stepsToFlow(rawSteps, departments);
    setNodes(n);
    setEdges(e);
    setLoaded(true);
    setNodesInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawSteps, departments, departmentsLoading, isNew, nodesInitialized]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);
  const selectedDeps = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter((e) => e.target === selectedNode.id)
      .map((e) => ({ edgeId: e.id, from: nodes.find((n) => n.id === e.source) }));
  }, [edges, nodes, selectedNode]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    if (canReach(edges, connection.target, connection.source)) {
      setConnectError('That would create a circular dependency.');
      setTimeout(() => setConnectError(''), 2500);
      return;
    }
    const exists = edges.some((e) => e.source === connection.source && e.target === connection.target);
    if (exists) return;
    setEdges((eds) => addEdge(connection, eds));
  }, [edges, setEdges]);

  function updateSelected(patch: Partial<SOPNodeData>) {
    if (!selectedId) return;
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }

  // New steps chain automatically: off the selected step if one is active
  // (so picking an earlier step and hitting "Add Step" branches from it),
  // otherwise off the most recently added step, so a plain sequence of
  // clicks builds a straight line with zero manual dragging required.
  function addStep() {
    const order = nextOrderRef.current++;
    const defaultDept = departments[0];
    const chainFrom = selectedNode ?? nodes.reduce<SOPFlowNode | null>(
      (latest, n) => (!latest || n.data.order > latest.data.order ? n : latest),
      null,
    );
    const siblingCount = chainFrom ? edges.filter((e) => e.source === chainFrom.id).length : 0;
    const position = chainFrom
      ? { x: chainFrom.position.x + siblingCount * 260, y: chainFrom.position.y + 160 }
      : { x: 0, y: 0 };

    const newNode: SOPFlowNode = {
      id: String(order),
      type: 'sopStep',
      deletable: false,
      position,
      data: {
        order,
        title: 'New step',
        description: '',
        departmentId: defaultDept?._id || '',
        departmentName: defaultDept?.name || '',
        departmentColor: defaultDept?.color || '',
        taskTemplateId: '',
        taskTemplateName: '',
        typeId: '',
        typeName: '',
        estimatedHours: undefined,
      },
    };
    setNodes((ns) => [...ns, newNode]);
    if (chainFrom) {
      setEdges((es) => [...es, { id: `${chainFrom.id}-${order}`, source: chainFrom.id, target: String(order) }]);
    }
    setSelectedId(newNode.id);
  }

  // Deleting a step also bridges its predecessors directly to its successors,
  // so removing a step in the middle of a chain keeps the rest connected
  // instead of leaving the following steps orphaned.
  function deleteStep(nodeId: string) {
    setEdges((es) => {
      const incoming = es.filter((e) => e.target === nodeId).map((e) => e.source);
      const outgoing = es.filter((e) => e.source === nodeId).map((e) => e.target);
      const remaining = es.filter((e) => e.source !== nodeId && e.target !== nodeId);
      for (const from of incoming) {
        for (const to of outgoing) {
          if (from === to) continue;
          if (!remaining.some((e) => e.source === from && e.target === to)) {
            remaining.push({ id: `${from}-${to}`, source: from, target: to });
          }
        }
      }
      return remaining;
    });
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    if (selectedId === nodeId) setSelectedId(null);
  }

  function removeDependency(edgeId: string) {
    setEdges((es) => es.filter((e) => e.id !== edgeId));
  }

  async function save() {
    if (!title.trim()) { setError('Title is required'); return; }
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    setSaveStatus('saving');
    setError('');
    const steps = nodes.map((n) => ({
      order: n.data.order,
      title: n.data.title,
      description: n.data.description || '',
      department: n.data.departmentId,
      taskTemplateId: n.data.taskTemplateId || undefined,
      typeId: n.data.typeId || undefined,
      estimatedHours: n.data.estimatedHours,
      dependsOn: edges.filter((e) => e.target === n.id).map((e) => Number(e.source)),
      positionX: n.position.x,
      positionY: n.position.y,
    }));

    let ok = false;
    if (isNew) {
      const created = await createSOP({ title: title.trim(), description, steps, status });
      if (created) { router.replace(`/sops/${created._id}`); ok = true; }
      else setError('Save failed');
    } else {
      const updated = await updateSOP(sopId, { title: title.trim(), description, steps, status });
      ok = Boolean(updated);
      if (!ok) setError('Save failed');
    }

    if (ok) {
      setSaveStatus('saved');
      savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('idle');
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.bar}>
        <div className={styles.barLeft}>
          <button className={styles.backBtn} onClick={() => router.push('/sops')}>
            <ArrowLeft size={17} />
          </button>
          <input
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="SOP title…"
          />
          <button
            type="button"
            className={`${styles.statusPill} ${status === 'published' ? styles.statusPublished : styles.statusDraft}`}
            onClick={() => setStatus((s) => (s === 'published' ? 'draft' : 'published'))}
            title="Click to toggle draft / published"
          >
            {status === 'published' ? <CheckCircle2 size={12} /> : <Pencil size={12} />}
            {status}
          </button>
        </div>
        <div className={styles.barRight}>
          {error && <span className={styles.barError}>{error}</span>}
          <Button
            variant="secondary"
            size="sm"
            onClick={addStep}
            title={selectedNode ? `Branch a new step off Step ${selectedNode.data.order}` : 'Add the next step in sequence'}
          >
            <Plus size={16} /> Add Step
          </Button>
          <button
            type="button"
            className={`${styles.saveBtn} ${saveStatus === 'saved' ? styles.saveBtnSaved : ''}`}
            onClick={save}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? (
              <><Loader2 size={16} className={styles.saveSpinner} /> Saving…</>
            ) : saveStatus === 'saved' ? (
              <><Check size={16} /> Saved</>
            ) : (
              <><Save size={16} /> Save</>
            )}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.canvasWrap}>
          {!loaded && (
            <div className={styles.emptyCanvas}><Spinner size="lg" /></div>
          )}
          {loaded && nodes.length === 0 && (
            <div className={styles.emptyCanvas}>
              <div className={styles.emptyCanvasTitle}>No steps yet</div>
              <div className={styles.emptyCanvasSub}>
                Click &ldquo;Add Step&rdquo; to add your first step. Every new step connects to the one
                before it automatically — select an earlier step first to branch off it instead, or
                drag between the dots to rewire connections by hand.
              </div>
            </div>
          )}
          {connectError && <div className={styles.connectError}>{connectError}</div>}

          <ReactFlowProvider>
            <ReactFlow
              className={styles.canvas}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_e, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
              proOptions={{ hideAttribution: true }}
              colorMode={theme}
              defaultEdgeOptions={{
                type: 'smoothstep',
                style: { stroke: 'var(--text-secondary)', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-secondary)', width: 18, height: 18 },
              }}
            >
              <Background gap={20} size={1.5} color="var(--border-strong)" />
              <Controls showInteractive={false} className={styles.controls} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        <div className={styles.sidePanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              {selectedNode ? `Step ${selectedNode.data.order}` : 'SOP Overview'}
            </span>
            {selectedNode && (
              <button className={styles.panelClose} onClick={() => setSelectedId(null)}>
                <X size={16} />
              </button>
            )}
          </div>

          {!selectedNode ? (
            <div className={styles.panelBody}>
              <div className={styles.panelSection}>
                <span className={styles.panelSectionTitle}>Description</span>
                <textarea
                  className={styles.input}
                  rows={4}
                  placeholder="What is this SOP for? e.g. the full pipeline for delivering a client's Social Media Post, from brief to scheduling."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className={styles.hint}>
                <MousePointerClick size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.25rem' }} />
                Select a step on the canvas to edit its details, or click &ldquo;Add Step&rdquo; to add one.
              </div>
            </div>
          ) : (
            <>
              <div className={styles.panelBody}>
                <div className={styles.panelSection}>
                  <span className={styles.panelSectionTitle}>Basics</span>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Title</label>
                    <input
                      className={styles.input}
                      value={selectedNode.data.title}
                      onChange={(e) => updateSelected({ title: e.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Description</label>
                    <textarea
                      className={styles.input}
                      rows={3}
                      value={selectedNode.data.description}
                      onChange={(e) => updateSelected({ description: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.panelSection}>
                  <span className={styles.panelSectionTitle}>Assignment</span>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Department</label>
                    <select
                      className={styles.input}
                      value={selectedNode.data.departmentId}
                      onChange={(e) => {
                        const dept = departments.find((d) => d._id === e.target.value);
                        updateSelected({
                          departmentId: dept?._id || '',
                          departmentName: dept?.name || '',
                          departmentColor: dept?.color || '',
                          taskTemplateId: '',
                          taskTemplateName: '',
                          typeId: '',
                          typeName: '',
                        });
                      }}
                    >
                      <option value="">Select department…</option>
                      {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Task Template <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional — the micro-task)</span></label>
                    <select
                      className={styles.input}
                      value={selectedNode.data.taskTemplateId}
                      disabled={!selectedNode.data.departmentId}
                      onChange={(e) => {
                        const dept = departments.find((d) => d._id === selectedNode.data.departmentId);
                        const tmpl = dept?.taskTemplates?.find((t) => t._id === e.target.value);
                        updateSelected({
                          taskTemplateId: tmpl?._id || '',
                          taskTemplateName: tmpl?.title || '',
                          typeId: '',
                          typeName: '',
                          title: tmpl ? tmpl.title : selectedNode.data.title,
                          estimatedHours: tmpl?.estimatedHours ?? selectedNode.data.estimatedHours,
                        });
                      }}
                    >
                      <option value="">None — freeform step</option>
                      {(departments.find((d) => d._id === selectedNode.data.departmentId)?.taskTemplates ?? []).map((t) => (
                        <option key={t._id} value={t._id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                  {selectedNode.data.taskTemplateId && (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Type <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional)</span></label>
                      <select
                        className={styles.input}
                        value={selectedNode.data.typeId}
                        onChange={(e) => {
                          const dept = departments.find((d) => d._id === selectedNode.data.departmentId);
                          const tmpl = dept?.taskTemplates?.find((t) => t._id === selectedNode.data.taskTemplateId);
                          const ty = tmpl?.types?.find((x) => x._id === e.target.value);
                          updateSelected({
                            typeId: ty?._id || '',
                            typeName: ty?.title || '',
                            title: ty ? ty.title : selectedNode.data.title,
                            estimatedHours: ty?.estimatedHours ?? selectedNode.data.estimatedHours,
                          });
                        }}
                      >
                        <option value="">None</option>
                        {(departments.find((d) => d._id === selectedNode.data.departmentId)?.taskTemplates?.find((t) => t._id === selectedNode.data.taskTemplateId)?.types ?? []).map((ty) => (
                          <option key={ty._id} value={ty._id}>{ty.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Estimated Hours</label>
                    <input
                      type="number"
                      className={styles.input}
                      min={0}
                      step={0.5}
                      value={selectedNode.data.estimatedHours ?? ''}
                      onChange={(e) => updateSelected({ estimatedHours: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className={styles.panelSection}>
                  <span className={styles.panelSectionTitle}>Dependencies</span>
                  <div className={styles.field}>
                    {selectedDeps.length === 0 ? (
                      <div className={styles.hint}>No dependencies — this step starts immediately.</div>
                    ) : (
                      <div className={styles.depChips}>
                        {selectedDeps.map((d) => (
                          <span key={d.edgeId} className={styles.depChip}>
                            {d.from?.data.title || `Step ${d.from?.data.order}`}
                            <button className={styles.depChipRemove} onClick={() => removeDependency(d.edgeId)}>
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.panelFooter}>
                <Button variant="danger" size="sm" fullWidth onClick={() => deleteStep(selectedNode.id)}>
                  <Trash2 size={15} /> Delete Step
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
