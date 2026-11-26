'use client';

import { useState, useEffect } from 'react';
import { useTableInstances } from '@/hooks/useTableInstances';
import TableGrid from '@/components/tables/TableGrid/TableGrid';
import Spinner from '@/components/ui/Spinner/Spinner';
import type { TableInstance } from '@/types';
import styles from './ProjectTableTab.module.css';

interface ProjectTableTabProps {
  instanceId: string;
}

export default function ProjectTableTab({ instanceId }: ProjectTableTabProps) {
  const { fetchInstance } = useTableInstances();
  const [instance, setInstance] = useState<TableInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetchInstance(instanceId).then((t) => {
      if (cancelled) return;
      if (t) setInstance(t);
      else setNotFound(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [instanceId, fetchInstance]);

  if (loading) {
    return <div className={styles.loading}><Spinner /></div>;
  }

  if (notFound || !instance) {
    return <p className={styles.emptyHint}>This table could not be loaded.</p>;
  }

  return (
    <div className={styles.wrap}>
      <TableGrid instance={instance} onChange={setInstance} />
    </div>
  );
}
