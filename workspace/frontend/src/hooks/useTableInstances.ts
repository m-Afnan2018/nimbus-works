import { useCallback } from 'react';
import api from '@/lib/api';
import type { TableInstance } from '@/types';

export function useTableInstances() {
  const fetchInstance = useCallback(async (id: string): Promise<TableInstance | null> => {
    try {
      const { data } = await api.get(`/table-instances/${id}`);
      return data;
    } catch {
      return null;
    }
  }, []);

  const addRow = useCallback(async (id: string, cells: Record<string, unknown> = {}): Promise<TableInstance | null> => {
    try {
      const { data } = await api.post(`/table-instances/${id}/rows`, { cells });
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateRow = useCallback(async (id: string, rowId: string, cells: Record<string, unknown>): Promise<TableInstance | null> => {
    try {
      const { data } = await api.put(`/table-instances/${id}/rows/${rowId}`, { cells });
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteRow = useCallback(async (id: string, rowId: string): Promise<TableInstance | null> => {
    try {
      const { data } = await api.delete(`/table-instances/${id}/rows/${rowId}`);
      return data;
    } catch {
      return null;
    }
  }, []);

  const renameInstance = useCallback(async (
    id: string,
    period: { periodMonth: number; periodYear: number },
  ): Promise<TableInstance | null> => {
    try {
      const { data } = await api.put(`/table-instances/${id}`, period);
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteInstance = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/table-instances/${id}`);
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateColumnWidth = useCallback(async (id: string, columnId: string, width: number): Promise<TableInstance | null> => {
    try {
      const { data } = await api.put(`/table-instances/${id}/columns/${columnId}`, { width });
      return data;
    } catch {
      return null;
    }
  }, []);

  return { fetchInstance, addRow, updateRow, deleteRow, renameInstance, deleteInstance, updateColumnWidth };
}
