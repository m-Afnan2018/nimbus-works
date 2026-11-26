import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { CustomTable, ColumnType, AutoFill } from '@/types';

export function useTables(autoFetch = true) {
  const [tables, setTables] = useState<CustomTable[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = useCallback(async (activeOnly = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/tables', { params: activeOnly ? { active: 'true' } : {} });
      setTables(data);
      return data as CustomTable[];
    } catch {
      setError('Failed to load tables.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTable = useCallback(async (id: string): Promise<CustomTable | null> => {
    try {
      const { data } = await api.get(`/tables/${id}`);
      return data;
    } catch {
      return null;
    }
  }, []);

  const createTable = useCallback(async (payload: { name: string; description?: string; color?: string }): Promise<CustomTable | null> => {
    try {
      const { data } = await api.post('/tables', payload);
      setTables((prev) => [data, ...prev]);
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateTable = useCallback(async (id: string, payload: { name?: string; description?: string; color?: string }): Promise<CustomTable | null> => {
    try {
      const { data } = await api.put(`/tables/${id}`, payload);
      setTables((prev) => prev.map((t) => (t._id === id ? { ...t, ...data } : t)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const toggleTableActive = useCallback(async (id: string): Promise<CustomTable | null> => {
    try {
      const { data } = await api.post(`/tables/${id}/toggle-active`);
      setTables((prev) => prev.map((t) => (t._id === id ? { ...t, isActive: data.isActive } : t)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteTable = useCallback(async (id: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      await api.delete(`/tables/${id}`);
      setTables((prev) => prev.filter((t) => t._id !== id));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err?.response?.data?.message || 'Failed to delete table.' };
    }
  }, []);

  const addColumn = useCallback(async (id: string, payload: { label: string; type: ColumnType; autoFill?: AutoFill; options?: string[] }): Promise<CustomTable | null> => {
    try {
      const { data } = await api.post(`/tables/${id}/columns`, payload);
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateColumn = useCallback(async (id: string, columnId: string, payload: { label?: string; type?: ColumnType; autoFill?: AutoFill; options?: string[] }): Promise<CustomTable | null> => {
    try {
      const { data } = await api.put(`/tables/${id}/columns/${columnId}`, payload);
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteColumn = useCallback(async (id: string, columnId: string): Promise<CustomTable | null> => {
    try {
      const { data } = await api.delete(`/tables/${id}/columns/${columnId}`);
      return data;
    } catch {
      return null;
    }
  }, []);

  const reorderColumns = useCallback(async (id: string, columnIds: string[]): Promise<CustomTable | null> => {
    try {
      const { data } = await api.put(`/tables/${id}/columns/reorder`, { columnIds });
      return data;
    } catch {
      return null;
    }
  }, []);

  return {
    tables, loading, error,
    fetchTables, fetchTable,
    createTable, updateTable, toggleTableActive, deleteTable,
    addColumn, updateColumn, deleteColumn, reorderColumns,
  };
}
