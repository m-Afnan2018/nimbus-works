'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Service, SOP } from '@/types';
import DeleteConfirm from '@/components/ui/DeleteConfirm';
import styles from './ServicesPage.module.css';

const COLORS = ['indigo', 'emerald', 'blue', 'amber', 'red'] as const;
const COLOR_LABELS: Record<string, string> = {
  indigo: 'Indigo', emerald: 'Green', blue: 'Blue', amber: 'Amber', red: 'Red',
};
const COLOR_VARS: Record<string, { bg: string; fg: string }> = {
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

interface ServiceFormProps {
  placeholder: string;
  initialName?: string;
  initialColor?: string;
  submitLabel?: string;
  showPricing?: boolean;
  showTypeFields?: boolean;
  showSOP?: boolean;
  sops?: SOP[];
  initialClientPrice?: number;
  initialEmployeePrice?: number;
  initialPriority?: string;
  initialEstimatedHours?: number;
  initialSopId?: string | null;
  onSubmit: (name: string, color: string, clientPrice?: number, employeePrice?: number, priority?: string, estimatedHours?: number, sopId?: string | null) => Promise<void>;
  onCancel: () => void;
}

function ServiceForm({
  placeholder, initialName = '', initialColor = 'indigo', submitLabel = 'Add',
  showPricing = false, showTypeFields = false, showSOP = false, sops = [],
  initialClientPrice, initialEmployeePrice, initialPriority = 'medium', initialEstimatedHours, initialSopId,
  onSubmit, onCancel,
}: ServiceFormProps) {
  const [name, setName]               = useState(initialName);
  const [color, setColor]             = useState(initialColor);
  const [clientPrice, setClientPrice] = useState(initialClientPrice !== undefined ? String(initialClientPrice) : '');
  const [empPrice, setEmpPrice]       = useState(initialEmployeePrice !== undefined ? String(initialEmployeePrice) : '');
  const [priority, setPriority]       = useState(initialPriority);
  const [estHours, setEstHours]       = useState(initialEstimatedHours !== undefined ? String(initialEstimatedHours) : '');
  const [sopId, setSopId]             = useState(initialSopId || '');
  const [saving, setSaving]           = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const cp = clientPrice !== '' ? parseFloat(clientPrice) : undefined;
    const ep = empPrice !== '' ? parseFloat(empPrice) : undefined;
    const eh = estHours !== '' ? parseFloat(estHours) : undefined;
    await onSubmit(name.trim(), color, cp, ep, priority, eh, sopId || null);
    setSaving(false);
  }

  return (
    <div className={styles.addForm}>
      <input
        ref={ref}
        className={styles.addInput}
        placeholder={placeholder}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
      />
      <div className={styles.colorPicker}>
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            className={`${styles.colorDot}${color === c ? ` ${styles.colorDotActive}` : ''}`}
            style={{ background: COLOR_VARS[c].fg }}
            title={COLOR_LABELS[c]}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      {showPricing && (
        <div className={styles.priceInputs}>
          <div className={styles.priceRow}>
            <label className={styles.priceLabel}>Client Price (₹/mo)</label>
            <input type="number" className={styles.addInput} placeholder="e.g. 15000" value={clientPrice} onChange={e => setClientPrice(e.target.value)} min={0} />
          </div>
          <div className={styles.priceRow}>
            <label className={styles.priceLabel}>Employee Cost (₹/mo)</label>
            <input type="number" className={styles.addInput} placeholder="e.g. 8000" value={empPrice} onChange={e => setEmpPrice(e.target.value)} min={0} />
          </div>
        </div>
      )}
      {showSOP && (
        <div className={styles.priceInputs}>
          <div className={styles.priceRow}>
            <label className={styles.priceLabel}>Linked SOP</label>
            <select className={styles.addInput} value={sopId} onChange={e => setSopId(e.target.value)}>
              <option value="">None</option>
              {sops.map(s => (
                <option key={s._id} value={s._id}>{s.title}{s.status === 'draft' ? ' (draft)' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {showTypeFields && (
        <div className={styles.priceInputs}>
          <div className={styles.priceRow}>
            <label className={styles.priceLabel}>Priority</label>
            <select className={styles.addInput} value={priority} onChange={e => setPriority(e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div className={styles.priceRow}>
            <label className={styles.priceLabel}>Est. Hours</label>
            <input type="number" className={styles.addInput} placeholder="e.g. 4" value={estHours} onChange={e => setEstHours(e.target.value)} min={0} step={0.5} />
          </div>
        </div>
      )}
      <div className={styles.addActions}>
        <button className={styles.addBtn} onClick={submit} disabled={!name.trim() || saving}>
          {saving ? <i className="ti ti-loader-2" /> : submitLabel}
        </button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

interface DeleteTarget { id: string; name: string; hasChildren: boolean; subServiceId?: string; }

export default function ServicesPage() {
  const [services, setServices]         = useState<Service[]>([]);
  const [sops, setSops]                 = useState<SOP[]>([]);
  const [loaded, setLoaded]             = useState(false);
  const [addingRoot, setAddingRoot]     = useState(false);
  const [addingChild, setAddingChild]   = useState<string | null>(null);
  const [addingType, setAddingType]     = useState<string | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());
  const [expandedSub, setExpandedSub]   = useState<Set<string>>(new Set());

  function load() {
    api.getServices()
      .then(d => {
        const svcs = d as Service[];
        setServices(svcs);
        const l1parents = svcs.filter(s => s.level === 1).map(s => s.parentId as string);
        setExpanded(prev => new Set([...Array.from(prev), ...l1parents]));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    api.getSOPs().then(d => setSops(d as SOP[])).catch(() => {});
  }
  useEffect(load, []);

  const roots    = services.filter(s => s.level === 0);
  const subSvcOf = (id: string) => services.filter(s => s.level === 1 && s.parentId === id);
  const typesOf  = (id: string) => services.filter(s => s.level === 2 && s.parentId === id);

  async function addService(name: string, color: string, parentId?: string, clientPrice?: number, employeePrice?: number, sopId?: string | null) {
    await api.createService({ name, color, parentId: parentId || null, clientPrice, employeePrice, sopId });
    if (parentId) setExpanded(prev => new Set(Array.from(prev).concat(parentId)));
    load();
  }

  async function addType(subServiceId: string, name: string, _c: string, clientPrice?: number, employeePrice?: number, priority?: string, estimatedHours?: number) {
    await api.createServiceType(subServiceId, { name, priority, estimatedHours, clientPrice, employeePrice });
    setExpandedSub(prev => new Set(Array.from(prev).concat(subServiceId)));
    load();
  }

  async function saveEdit(id: string, name: string, color: string, clientPrice?: number, employeePrice?: number, sopId?: string | null) {
    await api.updateService(id, { name, color, clientPrice, employeePrice, sopId });
    setEditingId(null);
    load();
  }

  async function saveTypeEdit(subServiceId: string, typeId: string, name: string, _c: string, clientPrice?: number, employeePrice?: number, priority?: string, estimatedHours?: number) {
    await api.updateServiceType(subServiceId, typeId, { name, priority, estimatedHours, clientPrice, employeePrice });
    setEditingTypeId(null);
    load();
  }

  function startDelete(svc: Service, hasChildren: boolean) {
    setDeleteTarget({ id: svc._id, name: svc.name, hasChildren });
  }

  function startDeleteType(typ: Service) {
    setDeleteTarget({ id: typ._id, name: typ.name, hasChildren: false, subServiceId: typ.parentId as string });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    if (deleteTarget.subServiceId) {
      await api.deleteServiceType(deleteTarget.subServiceId, deleteTarget.id);
    } else {
      await api.deleteService(deleteTarget.id);
    }
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(Array.from(prev)); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleExpandSub(id: string) {
    setExpandedSub(prev => { const n = new Set(Array.from(prev)); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Services</div>
        <div className="topbar-right">
          <button className="btn btn-p" onClick={() => { setAddingRoot(true); setAddingChild(null); setAddingType(null); setEditingId(null); }}>
            <i className="ti ti-plus" /> Add Service
          </button>
        </div>
      </div>

      <div className="content">
        {addingRoot && (
          <div className={`card ${styles.newCard}`}>
            <div className={styles.formTitle}>New Service</div>
            <ServiceForm
              placeholder="e.g. Ads, SEO, Web Development…"
              submitLabel="Add"
              showSOP
              sops={sops}
              onSubmit={async (name, color, _cp, _ep, _pr, _eh, sopId) => { await addService(name, color, undefined, undefined, undefined, sopId); setAddingRoot(false); }}
              onCancel={() => setAddingRoot(false)}
            />
          </div>
        )}

        {!loaded && <div className={styles.loading}><i className="ti ti-loader-2" /> Loading…</div>}

        {loaded && roots.length === 0 && !addingRoot && (
          <div className={styles.empty}>
            <i className="ti ti-briefcase" />
            <div className={styles.emptyTitle}>No services yet</div>
            <div className={styles.emptySub}>
              Create services like &ldquo;Development&rdquo; → sub-services like &ldquo;Shopify&rdquo; → types like &ldquo;Installing theme&rdquo;.
            </div>
            <button className="btn btn-p" onClick={() => setAddingRoot(true)}>
              <i className="ti ti-plus" /> Add First Service
            </button>
          </div>
        )}

        <div className={styles.grid}>
          {roots.map(svc => {
            const children   = subSvcOf(svc._id);
            const isExpanded = expanded.has(svc._id);
            const c          = COLOR_VARS[svc.color] || COLOR_VARS.indigo;
            const isEditing  = editingId === svc._id;

            return (
              <div key={svc._id} className={styles.svcCard}>
                {isEditing ? (
                  <div className={styles.svcEditWrap}>
                    <div className={styles.formTitle}>Edit Service</div>
                    <ServiceForm
                      placeholder="Service name"
                      initialName={svc.name}
                      initialColor={svc.color}
                      submitLabel="Save"
                      showSOP
                      sops={sops}
                      initialSopId={svc.sopId}
                      onSubmit={(name, color, _cp, _ep, _pr, _eh, sopId) => saveEdit(svc._id, name, color, undefined, undefined, sopId)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <div className={styles.svcHeader}>
                    <div className={styles.svcLeft}>
                      <div className={styles.svcIcon} style={{ background: c.bg, color: c.fg }}>
                        <i className="ti ti-briefcase" />
                      </div>
                      <div>
                        <div className={styles.svcName}>{svc.name}</div>
                        <div className={styles.svcMeta}>
                          {children.length} sub-service{children.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className={styles.svcActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => {
                          setAddingChild(addingChild === svc._id ? null : svc._id);
                          setExpanded(prev => new Set(Array.from(prev).concat(svc._id)));
                          setEditingId(null);
                        }}
                      >
                        <i className="ti ti-plus" /> Sub-service
                      </button>
                      {children.length > 0 && (
                        <button className={styles.iconBtn} onClick={() => toggleExpand(svc._id)}>
                          <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} />
                        </button>
                      )}
                      <button className={styles.iconBtn} title="Edit" onClick={() => { setEditingId(svc._id); setAddingChild(null); }}>
                        <i className="ti ti-pencil" />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Delete" onClick={() => startDelete(svc, children.length > 0)}>
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  </div>
                )}

                {!isEditing && (isExpanded || addingChild === svc._id) && (
                  <div className={styles.children}>
                    {children.map(child => {
                      const cc            = COLOR_VARS[child.color] || COLOR_VARS.indigo;
                      const isEditingChild = editingId === child._id;
                      const childTypes    = typesOf(child._id);
                      const isSubExpanded = expandedSub.has(child._id);

                      return (
                        <div key={child._id} className={styles.child}>
                          {isEditingChild ? (
                            <div className={styles.childEditWrap}>
                              <ServiceForm
                                placeholder="Sub-service name"
                                initialName={child.name}
                                initialColor={child.color}
                                submitLabel="Save"
                                showPricing
                                showSOP
                                sops={sops}
                                initialClientPrice={child.clientPrice}
                                initialEmployeePrice={child.employeePrice}
                                initialSopId={child.sopId}
                                onSubmit={(name, color, cp, ep, _pr, _eh, sopId) => saveEdit(child._id, name, color, cp, ep, sopId)}
                                onCancel={() => setEditingId(null)}
                              />
                            </div>
                          ) : (
                            <div className={styles.childRow}>
                              <div className={styles.childLeft}>
                                <span className={styles.childDot} style={{ background: cc.fg }} />
                                <div className={styles.childInfo}>
                                  <div className={styles.childNameRow}>
                                    <span className={styles.childName}>{child.name}</span>
                                    <span className={styles.childBadge} style={{ background: cc.bg, color: cc.fg }}>
                                      {COLOR_LABELS[child.color] || child.color}
                                    </span>
                                  </div>
                                  {(child.clientPrice !== undefined || child.employeePrice !== undefined || child.sopId) && (
                                    <div className={styles.childPrices}>
                                      {child.clientPrice !== undefined && (
                                        <span className={styles.priceChip}>Client ₹{child.clientPrice.toLocaleString('en-IN')}</span>
                                      )}
                                      {child.employeePrice !== undefined && (
                                        <span className={`${styles.priceChip} ${styles.priceChipEmp}`}>Emp ₹{child.employeePrice.toLocaleString('en-IN')}</span>
                                      )}
                                      {child.sopId && (
                                        <span className={styles.sopChip}>
                                          <i className="ti ti-sitemap" /> {sops.find(s => s._id === child.sopId)?.title || 'SOP linked'}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className={styles.typeCount}>
                                    {childTypes.length} type{childTypes.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>
                              <div className={styles.childActions}>
                                <button
                                  className={styles.actionBtn}
                                  onClick={() => {
                                    setAddingType(addingType === child._id ? null : child._id);
                                    setExpandedSub(prev => new Set(Array.from(prev).concat(child._id)));
                                    setEditingId(null);
                                    setEditingTypeId(null);
                                  }}
                                >
                                  <i className="ti ti-plus" /> Type
                                </button>
                                {childTypes.length > 0 && (
                                  <button className={styles.iconBtn} onClick={() => toggleExpandSub(child._id)}>
                                    <i className={`ti ti-chevron-${isSubExpanded ? 'up' : 'down'}`} />
                                  </button>
                                )}
                                <button className={styles.iconBtn} title="Edit" onClick={() => setEditingId(child._id)}>
                                  <i className="ti ti-pencil" />
                                </button>
                                <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Delete" onClick={() => startDelete(child, childTypes.length > 0)}>
                                  <i className="ti ti-trash" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Types (level 2) */}
                          {!isEditingChild && (isSubExpanded || addingType === child._id) && (
                            <div className={styles.types}>
                              {childTypes.map(typ => {
                                const isEditingType = editingTypeId === typ._id;
                                return (
                                  <div key={typ._id} className={styles.typeItem}>
                                    {isEditingType ? (
                                      <div className={styles.typeEditWrap}>
                                        <ServiceForm
                                          placeholder="Type name"
                                          initialName={typ.name}
                                          initialColor={child.color}
                                          initialPriority={typ.priority || 'medium'}
                                          initialEstimatedHours={typ.estimatedHours}
                                          initialClientPrice={typ.clientPrice}
                                          initialEmployeePrice={typ.employeePrice}
                                          submitLabel="Save"
                                          showPricing
                                          showTypeFields
                                          onSubmit={(_n, _c, cp, ep, priority, estimatedHours) =>
                                            saveTypeEdit(child._id, typ._id, _n, _c, cp, ep, priority, estimatedHours)
                                          }
                                          onCancel={() => setEditingTypeId(null)}
                                        />
                                      </div>
                                    ) : (
                                      <>
                                        <div className={styles.typeLeft}>
                                          <span className={styles.typeDot} style={{ background: cc.fg }} />
                                          <div className={styles.typeInfo}>
                                            <span className={styles.typeName}>{typ.name}</span>
                                            <div className={styles.typeMeta}>
                                              {typ.priority && <span className={`${styles.typePriority} ${styles[`priority_${typ.priority}`]}`}>{typ.priority}</span>}
                                              {typ.estimatedHours != null && <span className={styles.typeHours}>{typ.estimatedHours}h est.</span>}
                                            </div>
                                            {(typ.clientPrice !== undefined || typ.employeePrice !== undefined) && (
                                              <div className={styles.childPrices}>
                                                {typ.clientPrice !== undefined && (
                                                  <span className={styles.priceChip}>Client ₹{typ.clientPrice.toLocaleString('en-IN')}</span>
                                                )}
                                                {typ.employeePrice !== undefined && (
                                                  <span className={`${styles.priceChip} ${styles.priceChipEmp}`}>Emp ₹{typ.employeePrice.toLocaleString('en-IN')}</span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className={styles.typeActions}>
                                          <button className={styles.iconBtn} title="Edit" onClick={() => setEditingTypeId(typ._id)}>
                                            <i className="ti ti-pencil" />
                                          </button>
                                          <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Delete" onClick={() => startDeleteType(typ)}>
                                            <i className="ti ti-trash" />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}

                              {addingType === child._id && (
                                <div className={styles.typeForm}>
                                  <div className={styles.childFormLabel}>
                                    Type under <strong>{child.name}</strong>
                                  </div>
                                  <ServiceForm
                                    placeholder="e.g. Installing theme, Change content…"
                                    submitLabel="Add"
                                    showPricing
                                    showTypeFields
                                    onSubmit={async (name, color, cp, ep, priority, estimatedHours) => {
                                      await addType(child._id, name, color, cp, ep, priority, estimatedHours);
                                      setAddingType(null);
                                    }}
                                    onCancel={() => setAddingType(null)}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {addingChild === svc._id && (
                      <div className={styles.childForm}>
                        <div className={styles.childFormLabel}>
                          Sub-service under <strong>{svc.name}</strong>
                        </div>
                        <ServiceForm
                          placeholder="e.g. Meta Ads, Google Ads…"
                          submitLabel="Add"
                          showPricing
                          showSOP
                          sops={sops}
                          onSubmit={async (name, color, cp, ep, _pr, _eh, sopId) => { await addService(name, color, svc._id, cp, ep, sopId); setAddingChild(null); }}
                          onCancel={() => setAddingChild(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirm
          title={deleteTarget.subServiceId ? 'Delete Type' : deleteTarget.hasChildren ? 'Delete Service + Children' : 'Delete Service'}
          message={
            deleteTarget.subServiceId
              ? `Delete type "${deleteTarget.name}"? This cannot be undone.`
              : deleteTarget.hasChildren
                ? `"${deleteTarget.name}" has children. Deleting it will also delete all sub-services and their types. This cannot be undone.`
                : `Delete "${deleteTarget.name}"? This cannot be undone.`
          }
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
