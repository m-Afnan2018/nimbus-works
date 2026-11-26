'use client';
import { useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps, type Node } from '@xyflow/react';
import { Clock } from 'lucide-react';
import styles from './SOPBuilder.module.css';

export interface SOPNodeData extends Record<string, unknown> {
  order: number;
  title: string;
  description: string;
  departmentId: string;
  departmentName: string;
  departmentColor: string;
  taskTemplateId: string;
  taskTemplateName: string;
  typeId: string;
  typeName: string;
  estimatedHours?: number;
}

export type SOPFlowNode = Node<SOPNodeData, 'sopStep'>;

export default function SOPStepNode({ id, data, selected }: NodeProps<SOPFlowNode>) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title);
  const color = data.departmentColor || 'var(--primary)';
  const tint = color.startsWith('#') ? `${color}22` : 'var(--primary-light)';

  function startEditing() {
    setDraft(data.title);
    setEditing(true);
  }

  function commit() {
    updateNodeData(id, { title: draft.trim() || 'Untitled step' });
    setEditing(false);
  }

  return (
    <div
      className={`${styles.node} ${selected ? styles.nodeSelected : ''}`}
      style={{ borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.nodeTop}>
        <span className={styles.nodeOrder}>{data.order}</span>
        {editing ? (
          <input
            autoFocus
            className={`${styles.nodeTitleInput} nodrag nopan`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { setDraft(data.title); setEditing(false); }
            }}
          />
        ) : (
          <span
            className={styles.nodeTitle}
            title="Double-click to rename"
            onDoubleClick={(e) => { e.stopPropagation(); startEditing(); }}
          >
            {data.title || 'Untitled step'}
          </span>
        )}
      </div>
      <div
        className={styles.nodeDept}
        style={{ background: tint, color }}
      >
        {data.departmentName || 'No department'}
      </div>
      {(data.taskTemplateName || data.typeName) && (
        <div className={styles.nodeMicroTask}>
          {data.taskTemplateName}{data.typeName ? ` › ${data.typeName}` : ''}
        </div>
      )}
      {data.estimatedHours != null && (
        <div className={styles.nodeMeta}><Clock size={11} /> {data.estimatedHours}h</div>
      )}
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
