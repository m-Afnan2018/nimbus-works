import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { Credential, CredentialAccessLogEntry } from '@/types';

export interface CredentialPayload {
  title: string;
  project: string;
  department: string;
  category: Credential['category'];
  username?: string;
  secret: string;
  url?: string;
  expiryDate?: string;
  reminderDaysBefore?: number[];
  notes?: string;
  visibility?: Credential['visibility'];
  allowedUsers?: string[];
}

export function useCredentials(filter?: { project?: string; department?: string }, autoFetch = true) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/credentials', { params: filter });
      setCredentials(data);
    } catch {
      setError('Failed to load credentials.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter?.project, filter?.department]);

  const createCredential = useCallback(async (payload: CredentialPayload): Promise<Credential | null> => {
    try {
      const { data } = await api.post('/credentials', payload);
      setCredentials((prev) => [data, ...prev]);
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateCredential = useCallback(async (
    id: string,
    payload: Partial<CredentialPayload>,
  ): Promise<Credential | null> => {
    try {
      const { data } = await api.put(`/credentials/${id}`, payload);
      setCredentials((prev) => prev.map((c) => (c._id === id ? data : c)));
      return data;
    } catch {
      return null;
    }
  }, []);

  const deleteCredential = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/credentials/${id}`);
      setCredentials((prev) => prev.filter((c) => c._id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  const revealCredential = useCallback(async (id: string): Promise<string | null> => {
    try {
      const { data } = await api.post(`/credentials/${id}/reveal`);
      return data.secret as string;
    } catch {
      return null;
    }
  }, []);

  const fetchAccessLog = useCallback(async (id: string): Promise<CredentialAccessLogEntry[]> => {
    try {
      const { data } = await api.get(`/credentials/${id}/access-log`);
      return data;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetchCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCredentials, autoFetch]);

  return {
    credentials, loading, error,
    fetchCredentials, createCredential, updateCredential, deleteCredential,
    revealCredential, fetchAccessLog,
  };
}

export function useExpiringCredentials(withinDays = 30) {
  const [items, setItems] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExpiring = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/credentials/expiring', { params: { withinDays } });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withinDays]);

  useEffect(() => { fetchExpiring(); }, [fetchExpiring]);

  return { items, loading, fetchExpiring };
}
