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
import { api } from '@/lib/api';
import type { SOP, SOPStep, Service } from '@/types';
import SOPStepNode, { type SOPFlowNode, type SOPNodeData } from './SOPStepNode';
import styles from './SOPBuilder.module.css';

const nodeTypes = { sopStep: SOPStepNode };

function computeDepths(steps: SOPStep[]): Map<number, number> {
  const byOrder = new Map(steps.map(s => [s.order, s]));
  const depths = new Map<number, number>();
  function depth(order: number, visiting: Set<number>): number {
    if (depths.has(order)) return depths.get(order)!;
    if (visiting.has(order)) return 0;
    visiting.add(order);
    const step = byOrder.get(order);
    if (!step || step.dependsOn.length === 0) { depths.set(order, 0); return 0; }
    const d = 1 + Math.max(...step.dependsOn.map(o => depth(o, visiting)));
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

function stepsToFlow(steps: SOPStep[], services: Service[]): { nodes: SOPFlowNode[]; edges: Edge[] } {
  const layout = autoLayout(steps);
  const nodes: SOPFlowNode[] = steps.map(s => {
    const dept = typeof s.department === 'object' && s.department ? s.department : null;
    const hasPos = s.positionX != null && s.positionY != null;
    const fallback = layout.get(s.order) || { x: 0, y: 0 };
    const template = s.taskTemplateId ? services.find(sv => sv._id === s.taskTemplateId) : undefined;
    const svcType = s.typeId ? services.find(sv => sv._id === s.typeId) : undefined;
    return {
      id: String(s.order),
      type: 'sopStep',
      position: hasPos ? { x: s.positionX as number, y: s.positionY as number } : fallback,
      data: {
        order: s.order,
        title: s.title,
        description: s.description || '',
        departmentId: dept?._id || (typeof s.department === 'string' ? s.department : ''),
        departmentName: dept?.name || '',
        departmentColor: dept?.color || 'indigo',
        taskTemplateId: s.taskTemplateId || '',
        taskTemplateName: template?.name || '',
        typeId: s.typeId || '',
        typeName: svcType?.name || '',
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
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
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

  const [title, setTitle] = useState('New SOP');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [services, setServices] = useState<Service[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connectError, setConnectError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<SOPFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nextOrderRef = useRef(1);

  const departments = useMemo(() => services.filter(s => s.level === 0), [services]);

  useEffect(() => {
    Promise.all([
      api.getServices() as Promise<Service[]>,
      isNew ? Promise.resolve(null) : (api.getSOP(sopId) as Promise<SOP>),
    ]).then(([svcs, sop]) => {
      setServices(svcs);
      if (sop) {
        setTitle(sop.title);
        setDescription(sop.description || '');
        setStatus(sop.status);
        const { nodes: n, edges: e } = stepsToFlow(sop.steps, svcs);
        setNodes(n);
        setEdges(e);
        nextOrderRef.current = sop.steps.length > 0 ? Math.max(...sop.steps.map(s => s.order)) + 1 : 1;
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopId, isNew]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId) || null, [nodes, selectedId]);
  const selectedDeps = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter(e => e.target === selectedNode.id)
      .map(e => ({ edgeId: e.id, from: nodes.find(n => n.id === e.source) }));
  }, [edges, nodes, selectedNode]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    if (canReach(edges, connection.target, connection.source)) {
      setConnectError('That would create a circular dependency.');
      setTimeout(() => setConnectError(''), 2500);
      return;
    }
    const exists = edges.some(e => e.source === connection.source && e.target === connection.target);
    if (exists) return;
    setEdges(eds => addEdge({ ...connection, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, [edges, setEdges]);

  function updateSelected(patch: Partial<SOPNodeData>) {
    if (!selectedId) return;
    setNodes(ns => ns.map(n => n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n));
  }

  function addStep() {
    const order = nextOrderRef.current++;
    const defaultDept = departments[0];
    const rootCount = nodes.filter(n => n.position.y === 0).length;
    const newNode: SOPFlowNode = {
      id: String(order),
      type: 'sopStep',
      position: { x: rootCount * 260, y: 0 },
      data: {
        order,
        title: 'New step',
        description: '',
        departmentId: defaultDept?._id || '',
        departmentName: defaultDept?.name || '',
        departmentColor: defaultDept?.color || 'indigo',
        taskTemplateId: '',
        taskTemplateName: '',
        typeId: '',
        typeName: '',
        estimatedHours: undefined,
      },
    };
    setNodes(ns => [...ns, newNode]);
    setSelectedId(newNode.id);
  }

  function deleteStep(nodeId: string) {
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedId === nodeId) setSelectedId(null);
  }

  function removeDependency(edgeId: string) {
    setEdges(es => es.filter(e => e.id !== edgeId));
  }

  async function save() {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    const steps = nodes.map(n => ({
      order: n.data.order,
      title: n.data.title,
      description: n.data.description || '',
      department: n.data.departmentId,
      taskTemplateId: n.data.taskTemplateId || undefined,
      typeId: n.data.typeId || undefined,
      estimatedHours: n.data.estimatedHours,
      dependsOn: edges.filter(e => e.target === n.id).map(e => Number(e.source)),
      positionX: n.position.x,
      positionY: n.position.y,
    }));
    try {
      if (isNew) {
        const created = await api.createSOP({ title: title.trim(), description, steps, status }) as SOP;
        router.replace(`/sops/${created._id}`);
      } else {
        await api.updateSOP(sopId, { title: title.trim(), description, steps, status });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="designer-overlay">
      <div className="designer-bar">
        <div className="designer-bar-left">
          <button className={`btn ${styles.barBtnBack}`} onClick={() => router.push('/sops')}>
            <i className="ti ti-arrow-left" />
          </button>
          <input
            className={styles.titleInput}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="SOP title…"
          />
          <button
            type="button"
            className={`${styles.statusPill} ${status === 'published' ? styles.statusPublished : styles.statusDraft}`}
            onClick={() => setStatus(s => (s === 'published' ? 'draft' : 'published'))}
            title="Click to toggle draft / published"
          >
            <i className={`ti ${status === 'published' ? 'ti-circle-check' : 'ti-pencil'}`} />
            {status}
          </button>
        </div>
        <div className="designer-bar-right">
          {error && <span className={styles.barError}>{error}</span>}
          <button className="btn" onClick={addStep}>
            <i className="ti ti-plus" /> Add Step
          </button>
          <button className="btn btn-p" onClick={save} disabled={saving}>
            <i className={saving ? 'ti ti-loader' : 'ti ti-device-floppy'} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="designer-body">
        <div className={styles.canvasWrap}>
          {!loaded && (
            <div className={styles.emptyCanvas}><i className="ti ti-loader-2" /></div>
          )}
          {loaded && nodes.length === 0 && (
            <div className={styles.emptyCanvas}>
              <i className="ti ti-sitemap" />
              <div className={styles.emptyCanvasTitle}>No steps yet</div>
              <div className={styles.emptyCanvasSub}>
                Click &ldquo;Add Step&rdquo; to place your first step, then drag from the bottom of
                one step to the top of another to set up a dependency between them.
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
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
            >
              <Background gap={20} color="var(--border2)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        <div className={styles.sidePanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              {selectedNode ? `Step ${selectedNode.data.order}` : 'SOP Overview'}
            </span>
            {selectedNode && (
              <button className="modal-close" onClick={() => setSelectedId(null)}>
                <i className="ti ti-x" />
              </button>
            )}
          </div>

          {!selectedNode ? (
            <div className={styles.panelBody}>
              <div className="form-field">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="What is this SOP for? e.g. the full pipeline for delivering a client's Social Media Post, from brief to scheduling."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className={styles.noDeps}>
                <i className="ti ti-click" /> Select a step on the canvas to edit its details, or click &ldquo;Add Step&rdquo; to add one.
              </div>
            </div>
          ) : (
            <>
              <div className={styles.panelBody}>
                <div className="form-field">
                  <label className="form-label">Title</label>
                  <input
                    className="form-input"
                    value={selectedNode.data.title}
                    onChange={e => updateSelected({ title: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={selectedNode.data.description}
                    onChange={e => updateSelected({ description: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Department</label>
                  <select
                    className="form-input"
                    value={selectedNode.data.departmentId}
                    onChange={e => {
                      const dept = departments.find(d => d._id === e.target.value);
                      updateSelected({
                        departmentId: dept?._id || '',
                        departmentName: dept?.name || '',
                        departmentColor: dept?.color || 'indigo',
                        taskTemplateId: '',
                        taskTemplateName: '',
                        typeId: '',
                        typeName: '',
                      });
                    }}
                  >
                    <option value="">Select department…</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Task Template <span style={{ opacity: 0.6, textTransform: 'none' }}>(optional — the micro-task this step is)</span></label>
                  <select
                    className="form-input"
                    value={selectedNode.data.taskTemplateId}
                    disabled={!selectedNode.data.departmentId}
                    onChange={e => {
                      const tmpl = services.find(s => s._id === e.target.value && s.level === 1);
                      updateSelected({
                        taskTemplateId: tmpl?._id || '',
                        taskTemplateName: tmpl?.name || '',
                        typeId: '',
                        typeName: '',
                        title: tmpl ? tmpl.name : selectedNode.data.title,
                        estimatedHours: tmpl?.estimatedHours ?? selectedNode.data.estimatedHours,
                      });
                    }}
                  >
                    <option value="">None — freeform step</option>
                    {services.filter(s => s.level === 1 && s.parentId === selectedNode.data.departmentId).map(t => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                {selectedNode.data.taskTemplateId && (
                  <div className="form-field">
                    <label className="form-label">Type <span style={{ opacity: 0.6, textTransform: 'none' }}>(optional)</span></label>
                    <select
                      className="form-input"
                      value={selectedNode.data.typeId}
                      onChange={e => {
                        const ty = services.find(s => s._id === e.target.value && s.level === 2);
                        updateSelected({
                          typeId: ty?._id || '',
                          typeName: ty?.name || '',
                          title: ty ? ty.name : selectedNode.data.title,
                          estimatedHours: ty?.estimatedHours ?? selectedNode.data.estimatedHours,
                        });
                      }}
                    >
                      <option value="">None</option>
                      {services.filter(s => s.level === 2 && s.parentId === selectedNode.data.taskTemplateId).map(ty => (
                        <option key={ty._id} value={ty._id}>{ty.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-field">
                  <label className="form-label">Estimated Hours</label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    step={0.5}
                    value={selectedNode.data.estimatedHours ?? ''}
                    onChange={e => updateSelected({ estimatedHours: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Depends On</label>
                  {selectedDeps.length === 0 ? (
                    <div className={styles.noDeps}>No dependencies — this step starts immediately.</div>
                  ) : (
                    <div className={styles.depChips}>
                      {selectedDeps.map(d => (
                        <span key={d.edgeId} className={styles.depChip}>
                          {d.from?.data.title || `Step ${d.from?.data.order}`}
                          <button className={styles.depChipRemove} onClick={() => removeDependency(d.edgeId)}>
                            <i className="ti ti-x" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.panelFooter}>
                <button className={`btn ${styles.deleteStepBtn}`} onClick={() => deleteStep(selectedNode.id)}>
                  <i className="ti ti-trash" /> Delete Step
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
