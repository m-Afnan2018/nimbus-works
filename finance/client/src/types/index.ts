export type Page =
  | 'overview'
  | 'clients'
  | 'invoices'
  | 'payments'
  | 'expenses'
  | 'payroll'
  | 'cashflow'
  | 'profit'
  | 'gst'
  | 'alerts'
  | 'reports';

export type ColorKey = 'emerald' | 'indigo' | 'blue' | 'amber' | 'red';

export interface Service {
  _id: string;
  name: string;
  slug: string;
  parentId: string | null;
  grandParentId: string | null;
  level: 0 | 1 | 2;
  icon: string;
  color: string;
  order: number;
  clientPrice?: number;
  employeePrice?: number;
  priority?: string;
  estimatedHours?: number;
  sopId?: string | null;
}

export interface SOPStep {
  _id: string;
  order: number;
  title: string;
  description?: string;
  department: { _id: string; name: string; color: string } | string;
  taskTemplateId?: string;
  typeId?: string;
  estimatedHours?: number;
  dependsOn: number[];
  positionX?: number;
  positionY?: number;
}

export interface SOP {
  _id: string;
  title: string;
  description: string;
  steps: SOPStep[];
  status: 'draft' | 'published';
  createdBy?: { _id: string; name: string; email: string } | string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceItem {
  name: string;
  amount: number;
  type?: 'Monthly' | 'One Time';
  billedPeriod?: string;
}

export interface Client {
  _id: string;
  name: string;
  email: string;
  service: string;
  monthlyBilling: number;
  serviceBreakdown?: ServiceItem[];
  manager: string;
  renewal: string;
  status: 'Active' | 'Inactive' | 'Renewal Due' | 'Paused';
  initials: string;
  colorKey: ColorKey;
}

export interface PaymentEntry {
  amount: number;
  method: 'Online' | 'Offline';
  mode?: string;
  receivedFrom?: string;
  date?: string;
}

export interface ClientRecord {
  _id: string;
  clientId: string;
  name: string;
  service: string;
  monthlyBilling: number;
  manager: string;
  status: 'Pending' | 'Paid' | 'Partial';
  billingPeriod: string;
  initials: string;
  colorKey: ColorKey;
  invoiceId?: string;
  payments?: PaymentEntry[];
}

export interface ClientBillingPeriod {
  _id: string;
  total: number;
  paid: number;
  pending: number;
  count: number;
  paidCount: number;
}

export interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  client: string;
  clientEmail?: string;
  clientAddress?: string;
  date: string;
  dueDate: string;
  lineItems?: LineItem[];
  amount: number;
  gstApplicable?: boolean;
  gst: number;
  gstRate?: number;
  total: number;
  notes?: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Partial';
  paidDate?: string;
  taxType?: 'Intrastate' | 'Interstate';
  tdsSection?: string;
  tdsRate?: number;
  tdsAmount?: number;
}

export interface GSTFiling {
  _id: string;
  period: string;
  dueDate: string;
  status: 'Due' | 'Filed';
  filedAt?: string;
  reminderDays: number;
  reminderEmail: string;
  reminderSent: boolean;
}

export interface TDSFiling {
  _id: string;
  quarter: string;
  dueDate: string;
  status: 'Pending' | 'Received';
  receivedAt?: string;
  reminderDays: number;
  reminderEmail: string;
  reminderSent: boolean;
}

export interface SMTPConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  configured: boolean;
}

export interface Expense {
  _id: string;
  date: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  type: 'Fixed' | 'Variable';
  recurring?: boolean;
  payMethod?: string;
  dueDate?: string;
  paid?: boolean;
  paidDate?: string;
}

export interface OrgTransaction {
  _id: string;
  organization: string;
  date: string;
  type: 'Revenue' | 'Expense';
  category?: string;
  description: string;
  amount: number;
  gstRate: number;
  gstAmount: number;
}

export interface Organization {
  _id: string;
  name: string;
  gstin?: string;
  state?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  initials: string;
  colorKey: ColorKey;
  notes?: string;
  revenue: number;
  expense: number;
  netProfit: number;
  gstCollected: number;
  gstPaid: number;
  netGST: number;
  transactionCount: number;
}

export interface OrganizationDetail extends Organization {
  transactions: OrgTransaction[];
}

export interface Employee {
  _id: string;
  name: string;
  department: string;
  baseSalary: number;
  hra: number;
  specialAllowance: number;
  incentives: number;
  providentFund: number;
  esi: number;
  professionalTax: number;
  tds: number;
  deductions: number;
  finalSalary: number;
  status: 'Paid' | 'Pending';
  initials: string;
  colorKey: ColorKey;
  isActive?: boolean;
}

export interface SalaryRecord {
  _id: string;
  employeeId: string;
  name: string;
  department: string;
  baseSalary: number;
  hra: number;
  specialAllowance: number;
  incentives: number;
  providentFund: number;
  esi: number;
  professionalTax: number;
  tds: number;
  deductions: number;
  leaveDays?: number;
  leaveDeduction?: number;
  bonus?: number;
  finalSalary: number;
  status: 'Paid' | 'Pending';
  payPeriod: string;
  initials: string;
  colorKey: ColorKey;
}

export interface PayPeriodSummary {
  _id: string;      // "2026-06"
  total: number;
  paid: number;
  pending: number;
  count: number;
  paidCount: number;
}

export interface PeriodEntry {
  period: string;
  finalSalary: number;
  baseSalary: number;
  incentives: number;
  deductions: number;
  status: string;
}

export interface EmployeeTrend {
  _id: string;
  name: string;
  department: string;
  initials: string;
  colorKey: ColorKey;
  periods: PeriodEntry[];
}

export interface SalaryAnalytics {
  employeeTrends: EmployeeTrend[];
}

export interface SlipTemplate {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  website: string;
  panNumber: string;
  footerNote: string;
}

export interface DashboardKPIs {
  totalRevenue: number;
  netProfit: number;
  netProfitMargin: number;
  pendingReceivables: number;
  totalExpenses: number;
  cashInBank: number;
  monthlyBurn: number;
  activeClients: number;
  totalClients: number;
  overduePayments: number;
  overdueCount: number;
  pendingCount: number;
  organizationsNetProfit: number;
}
