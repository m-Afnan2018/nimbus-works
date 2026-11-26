'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import styles from './RequestsWidget.module.css';

interface ReqEntry {
  taskId: string;
  taskTitle: string;
  requests: {
    _id: string;
    toDepartment: { _id: string; name: string; color: string };
    description: string;
    status: string;
    createdBy?: { name: string };
    createdAt: string;
  }[];
}

export default function RequestsWidget() {
  const [outgoing, setOutgoing] = useState<ReqEntry[]>([]);
  const [incoming, setIncoming] = useState<ReqEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [outRes, inRes] = await Promise.all([
          api.get('/tasks/requests/outgoing'),
          api.get('/tasks/requests/incoming'),
        ]);
        setOutgoing(outRes.data);
        setIncoming(inRes.data);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const totalOutgoing = outgoing.reduce((s, t) => s + t.requests.length, 0);
  const totalIncoming = incoming.reduce((s, t) => s + t.requests.length, 0);

  if (loading) return null;
  if (totalOutgoing === 0 && totalIncoming === 0) return null;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Department Requests</span>
        <span className={styles.cardMeta}>
          {totalOutgoing > 0 && <span className={styles.outBadge}>{totalOutgoing} waiting</span>}
          {totalIncoming > 0 && <span className={styles.inBadge}>{totalIncoming} for you</span>}
        </span>
      </div>

      {totalOutgoing > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>⏳ Waiting on others</p>
          {outgoing.map((entry) =>
            entry.requests.map((r) => (
              <Link key={r._id} href={`/tasks?open=${entry.taskId}`} className={styles.row}>
                <span className={styles.deptDot} style={{ background: r.toDepartment.color }} />
                <div className={styles.rowInfo}>
                  <span className={styles.rowTask}>{entry.taskTitle}</span>
                  <span className={styles.rowDesc}>{r.description}</span>
                  <span className={styles.rowMeta}>→ {r.toDepartment.name}</span>
                </div>
                <span className={styles.pendingTag}>Pending</span>
              </Link>
            ))
          )}
        </div>
      )}

      {totalOutgoing > 0 && totalIncoming > 0 && <div className={styles.divider} />}

      {totalIncoming > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>📥 Requested from your department</p>
          {incoming.map((entry) =>
            entry.requests.map((r) => (
              <Link key={r._id} href={`/tasks?open=${entry.taskId}`} className={styles.row}>
                <span className={styles.deptDot} style={{ background: r.toDepartment.color }} />
                <div className={styles.rowInfo}>
                  <span className={styles.rowTask}>{entry.taskTitle}</span>
                  <span className={styles.rowDesc}>{r.description}</span>
                  {(r.createdBy as any)?.name && (
                    <span className={styles.rowMeta}>from {(r.createdBy as any).name}</span>
                  )}
                </div>
                <span className={styles.actionHint}>Open task →</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
