'use client';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
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

const COLOR_VARS: Record<string, { bg: string; fg: string }> = {
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

export default function SOPStepNode({ data, selected }: NodeProps<SOPFlowNode>) {
  const c = COLOR_VARS[data.departmentColor] || COLOR_VARS.indigo;
  return (
    <div className={`${styles.node} ${selected ? styles.nodeSelected : ''}`} style={{ borderLeftColor: c.fg }}>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.nodeTop}>
        <span className={styles.nodeOrder}>{data.order}</span>
        <span className={styles.nodeTitle}>{data.title || 'Untitled step'}</span>
      </div>
      <div className={styles.nodeDept} style={{ background: c.bg, color: c.fg }}>
        {data.departmentName || 'No department'}
      </div>
      {(data.taskTemplateName || data.typeName) && (
        <div className={styles.nodeMicroTask}>
          {data.taskTemplateName}{data.typeName ? ` › ${data.typeName}` : ''}
        </div>
      )}
      {data.estimatedHours != null && (
        <div className={styles.nodeMeta}><i className="ti ti-clock" /> {data.estimatedHours}h</div>
      )}
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
