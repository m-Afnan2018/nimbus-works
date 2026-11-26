import { showDemoToast } from './demo';

const API = '/api';

async function apiError(res: Response): Promise<never> {
  const data = await res.json().catch(() => ({})) as { error?: string; demo?: boolean };
  if (res.status === 403 && data.demo) showDemoToast(data.error);
  // Session expired (or the nightly demo reset): back to the login page.
  if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
  throw new Error(data.error || `API error: ${res.status}`);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) return apiError(res);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return apiError(res);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return apiError(res);
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return apiError(res);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!res.ok) return apiError(res);
  return res.json();
}

export const api = {
  getClients: () => get('/clients'),
  getClient: (id: string) => get(`/clients/${id}`),
  createClient: (data: unknown) => post('/clients', data),
  updateClient: (id: string, data: unknown) => put(`/clients/${id}`, data),
  deleteClient: (id: string) => del(`/clients/${id}`),
  markClientServicesBilled: (id: string, serviceNames: string[], period: string) => patch(`/clients/${id}/mark-billed`, { serviceNames, period }),
  getInvoices: (status?: string) => get(`/invoices${status ? `?status=${status}` : ''}`),
  getInvoice: (id: string) => get(`/invoices/${id}`),
  getNextInvoiceNumber: () => get('/invoices/next-number'),
  createInvoice: (data: unknown) => post('/invoices', data),
  updateInvoice: (id: string, data: unknown) => put(`/invoices/${id}`, data),
  deleteInvoice: (id: string) => del(`/invoices/${id}`),
  getExpenses: (params?: { category?: string; month?: string }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.month)    q.set('month', params.month);
    const qs = q.toString();
    return get(`/expenses${qs ? `?${qs}` : ''}`);
  },
  createExpense: (data: unknown) => post('/expenses', data),
  updateExpense: (id: string, data: unknown) => put(`/expenses/${id}`, data),
  deleteExpense: (id: string) => del(`/expenses/${id}`),
  applyRecurringExpenses: (month: string) => post('/expenses/apply-recurring', { month }),
  getEmployees: () => get('/employees'),
  createEmployee: (data: unknown) => post('/employees', data),
  updateEmployee: (id: string, data: unknown) => put(`/employees/${id}`, data),
  deleteEmployee: (id: string) => del(`/employees/${id}`),
  getSalaryPeriods: () => get('/salary-records/periods'),
  getSalaryRecords: (period: string) => get(`/salary-records?period=${encodeURIComponent(period)}`),
  runPayroll: (period: string) => post('/salary-records/run', { period }),
  processPeriod: (period: string) => put(`/salary-records/period/${encodeURIComponent(period)}/process`, {}),
  updateSalaryRecord: (id: string, data: unknown) => put(`/salary-records/${id}`, data),
  deleteSalaryPeriod: (period: string) => del(`/salary-records/period/${encodeURIComponent(period)}`),
  getSalaryAnalytics: () => get('/salary-records/analytics'),
  getClientBillingPeriods: () => get('/client-records/periods'),
  getClientYearlySummary: () => get('/client-records/yearly'),
  getClientRecords: (period: string) => get(`/client-records?period=${encodeURIComponent(period)}`),
  runClientBilling: (period: string, clients?: unknown[], force?: boolean) => post('/client-records/run', { period, ...(clients ? { clients } : {}), ...(force ? { force: true } : {}) }),
  addClientToBilling: (period: string, data: unknown) => post('/client-records/add-client', { period, ...(data as object) }),
  processClientPeriod: (period: string) => put(`/client-records/period/${encodeURIComponent(period)}/process`, {}),
  updateClientRecord: (id: string, data: unknown) => put(`/client-records/${id}`, data),
  deleteClientBillingPeriod: (period: string) => del(`/client-records/period/${encodeURIComponent(period)}`),
  getDashboardKPIs: () => get('/dashboard/kpis'),
  getSlipTemplate: () => get('/slip-template'),
  saveSlipTemplate: (data: unknown) => put('/slip-template', data),
  getInvoiceBrand: () => get('/invoice-brand'),
  saveInvoiceBrand: (data: unknown) => put('/invoice-brand', data),
  getGSTFilings: () => get('/gst-filings'),
  upsertGSTFiling: (data: unknown) => post('/gst-filings/upsert', data),
  markGSTFiled: (id: string, filedAt?: string) => post(`/gst-filings/${id}/mark-filed`, { filedAt }),
  markGSTDue: (id: string) => post(`/gst-filings/${id}/mark-due`, {}),
  sendGSTReminder: (id: string) => post(`/gst-filings/${id}/send-reminder`, {}),
  getSMTPConfig: () => get('/gst-filings/smtp'),
  saveSMTPConfig: (data: unknown) => put('/gst-filings/smtp', data),
  getTDSFilings: () => get('/tds-filings'),
  upsertTDSFiling: (data: unknown) => post('/tds-filings/upsert', data),
  markTDSReceived: (id: string, receivedAt?: string) => post(`/tds-filings/${id}/mark-received`, { receivedAt }),
  markTDSPending: (id: string) => post(`/tds-filings/${id}/mark-pending`, {}),
  sendTDSReminder: (id: string) => post(`/tds-filings/${id}/send-reminder`, {}),
  getServices: () => get('/services'),
  createService: (data: unknown) => post('/services', data),
  updateService: (id: string, data: unknown) => put(`/services/${id}`, data),
  deleteService: (id: string) => del(`/services/${id}`),
  createServiceType: (subServiceId: string, data: unknown) => post(`/services/${subServiceId}/types`, data),
  updateServiceType: (subServiceId: string, typeId: string, data: unknown) => put(`/services/${subServiceId}/types/${typeId}`, data),
  deleteServiceType: (subServiceId: string, typeId: string) => del(`/services/${subServiceId}/types/${typeId}`),
  getSOPs: () => get('/sops'),
  getSOP: (id: string) => get(`/sops/${id}`),
  createSOP: (data: unknown) => post('/sops', data),
  updateSOP: (id: string, data: unknown) => put(`/sops/${id}`, data),
  deleteSOP: (id: string) => del(`/sops/${id}`),
  generateSOPTasks: (id: string, projectId: string) => post(`/sops/${id}/generate`, { projectId }),
  getOrganizations: () => get('/organizations'),
  getOrganization: (id: string) => get(`/organizations/${id}`),
  createOrganization: (data: unknown) => post('/organizations', data),
  updateOrganization: (id: string, data: unknown) => put(`/organizations/${id}`, data),
  deleteOrganization: (id: string) => del(`/organizations/${id}`),
  createOrgTransaction: (orgId: string, data: unknown) => post(`/organizations/${orgId}/transactions`, data),
  updateOrgTransaction: (txId: string, data: unknown) => put(`/organizations/transactions/${txId}`, data),
  deleteOrgTransaction: (txId: string) => del(`/organizations/transactions/${txId}`),
};
