import { useCallback } from 'react';
import api from '@/lib/api';
import type { Project, ProjectTab, TableInstance } from '@/types';

export function useProjectTabs() {
  const createProjectTab = useCallback(async (projectId: string, name: string, templateId?: string): Promise<Project | null> => {
    try {
      const { data } = await api.post(`/projects/${projectId}/project-tabs`, { name, templateId });
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateProjectTab = useCallback(async (tabId: string, payload: { name?: string; templateId?: string | null }): Promise<ProjectTab | null> => {
    try {
      const { data } = await api.put(`/project-tabs/${tabId}`, payload);
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteProjectTab = useCallback(async (tabId: string): Promise<boolean> => {
    try {
      await api.delete(`/project-tabs/${tabId}`);
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchTabInstances = useCallback(async (tabId: string): Promise<TableInstance[]> => {
    try {
      const { data } = await api.get(`/project-tabs/${tabId}/instances`);
      return data;
    } catch {
      return [];
    }
  }, []);

  const attachTableToTab = useCallback(async (
    tabId: string,
    tableId: string,
    period: { periodMonth: number; periodYear: number },
  ): Promise<TableInstance | null> => {
    try {
      const { data } = await api.post(`/project-tabs/${tabId}/tables`, { tableId, ...period });
      return data;
    } catch {
      return null;
    }
  }, []);

  return { createProjectTab, updateProjectTab, deleteProjectTab, fetchTabInstances, attachTableToTab };
}
