import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { SOP } from '@/types';

export function useSOPs(autoFetch = true) {
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSOPs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/sops');
      setSops(data);
    } catch {
      setError('Failed to load SOPs.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSOP = useCallback(async (id: string): Promise<SOP | null> => {
    try {
      const { data } = await api.get(`/sops/${id}`);
      return data;
    } catch {
      return null;
    }
  }, []);

  const createSOP = useCallback(async (payload: {
    title: string; description?: string; steps?: unknown[]; status?: string;
  }): Promise<SOP | null> => {
    try {
      const { data } = await api.post('/sops', payload);
      setSops((prev) => [data, ...prev]);
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateSOP = useCallback(async (id: string, payload: {
    title?: string; description?: string; steps?: unknown[]; status?: string;
  }): Promise<SOP | null> => {
    try {
      const { data } = await api.put(`/sops/${id}`, payload);
      setSops((prev) => prev.map((s) => (s._id === id ? data : s)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteSOP = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/sops/${id}`);
      setSops((prev) => prev.filter((s) => s._id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  const generateFromSOP = useCallback(async (
    sopId: string,
    projectId: string,
    title: string,
    assignments?: Record<number, string[]>,
  ): Promise<{ runId: string } | null> => {
    try {
      const { data } = await api.post(`/sops/${sopId}/generate`, { projectId, title, assignments });
      return { runId: data.runId };
    } catch {
      return null;
    }
  }, []);

  const deleteSOPRun = useCallback(async (projectId: string, runId: string): Promise<boolean> => {
    try {
      await api.delete(`/sops/runs/${runId}`, { params: { projectId } });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetchSOPs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sops, loading, error, fetchSOPs, fetchSOP, createSOP, updateSOP, deleteSOP, generateFromSOP, deleteSOPRun };
}
