/**
 * Finance demo seed — fills the finance DB with believable fake data that is
 * linked to the Workspace demo data (projects = clients, users = employees).
 *
 * Run the Workspace seed FIRST (the root `npm run seed` does both in order).
 * Deterministic via faker.seed(); dates are relative to today.
 */
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
import 'dotenv/config';

import mongoose, { Types } from 'mongoose';
import { fakerEN_IN as faker } from '@faker-js/faker';

import { sharedConn } from './config/connections';
import WorkspaceProject from './models/shared/WorkspaceProject';
import WorkspaceUser from './models/shared/WorkspaceUser';
import WorkspaceDepartment from './models/shared/WorkspaceDepartment';
import WorkspaceSOP from './models/shared/WorkspaceSOP';
import AppSettings from './models/AppSettings';
import Client from './models/Client';
import ClientMeta from './models/ClientMeta';
import ClientRecord from './models/ClientRecord';
import Employee from './models/Employee';
import EmployeeMeta from './models/EmployeeMeta';
import Expense from './models/Expense';
import GSTFiling from './models/GSTFiling';
import Invoice from './models/Invoice';
import InvoiceBrand from './models/InvoiceBrand';
import Organization from './models/Organization';
import OrgTransaction from './models/OrgTransaction';
import SalaryRecord from './models/SalaryRecord';
import Service from './models/Service';
import SlipTemplate from './models/SlipTemplate';
import TDSFiling from './models/TDSFiling';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/demo_cfo';

faker.seed(20260102);

const COLORS = ['emerald', 'indigo', 'blue', 'amber', 'red'] as const;
const pick = <T>(arr: readonly T[]): T => faker.helpers.arrayElement(arr as T[]);
const round = (n: number, step = 500) => Math.round(n / step) * step;
const initials = (s: string) => s.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ym = (d: Date) => iso(d).slice(0, 7);
const ddmmyyyy = (d: Date) => iso(d).split('-').reverse().join('/');
const monthsAgo = (n: number, day = 1) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(1); d.setMonth(d.getMonth() - n); d.setDate(day); return d; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();

const SERVICE_PRICES: Record<string, [number, number]> = {
  Design: [25000, 60000], Development: [60000, 180000], Marketing: [30000, 90000],
  SEO: [20000, 55000], Content: [15000, 40000], Operations: [10000, 20000],
};

export async function seedFinance() {
  await mongoose.connect(MONGO_URI);
  await sharedConn.asPromise();
  console.log('Connected — clearing finance data…');

  const financeModels: mongoose.Model<any>[] = [
    AppSettings, Client, ClientMeta, ClientRecord, Employee, EmployeeMeta, Expense, GSTFiling, Invoice,
    InvoiceBrand, Organization, OrgTransaction, SalaryRecord, Service, SlipTemplate, TDSFiling,
  ];
  await Promise.all(financeModels.map((m) => m.deleteMany({})));

  const [projects, users, departments, sops] = await Promise.all([
    WorkspaceProject.find().sort({ createdAt: 1 }),
    WorkspaceUser.find({ isActive: true }).sort({ createdAt: 1 }),
    WorkspaceDepartment.find(),
    WorkspaceSOP.find(),
  ]);
  if (!projects.length || !users.length) {
    throw new Error('No Workspace data found — run the workspace seed first (root: `npm run seed`).');
  }

  // ── Branding (neutral demo brand) ────────────────────────────────────────
  await InvoiceBrand.create({
    companyName: 'Nimbus Works Pvt Ltd', tagline: 'Digital Agency (Demo)', address: '221B Demo Street, Bengaluru — 560001',
    gst: '29AAAAA0000A1Z5', email: 'accounts@nimbusworks.example', phone: '+91 90000 00000',
    accentColor: '#4f46e5', logoLetter: 'N', footerNote: 'This is a demo invoice generated from fake data.',
  });
  await SlipTemplate.create({
    companyName: 'Nimbus Works Pvt Ltd', companyAddress: '221B Demo Street, Bengaluru — 560001',
    companyEmail: 'hr@nimbusworks.example', companyPhone: '+91 90000 00000', website: 'nimbusworks.example', panNumber: 'AAAAA0000A',
  });
  await AppSettings.create({ smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' });

  // ── Services pricing (metadata over Workspace departments/templates) ─────
  let serviceCount = 0;
  for (const [di, dept] of departments.entries()) {
    const [lo, hi] = SERVICE_PRICES[dept.name] ?? [10000, 50000];
    const parent = await Service.create({
      workspaceId: dept._id, name: dept.name, slug: dept.name.toLowerCase(), color: COLORS[di % COLORS.length], order: di,
    });
    serviceCount++;
    for (const [ti, t] of (dept.taskTemplates ?? []).entries()) {
      const price = round(faker.number.int({ min: lo, max: hi }), 1000);
      const sop = sops.find((s) => s.steps.some((st) => String(st.department) === String(dept._id)));
      const sub = await Service.create({
        workspaceId: t._id, name: t.title, parentId: parent._id, order: ti,
        clientPrice: price, employeePrice: round(price * 0.45, 500), sopId: ti === 0 ? sop?._id ?? null : null,
      });
      serviceCount++;
      const types = ((t as unknown as { types?: { _id: Types.ObjectId; title: string }[] }).types) ?? [];
      for (const [yi, ty] of types.entries()) {
        const p = round(price * (yi === 0 ? 0.8 : 1.5), 1000);
        await Service.create({ workspaceId: ty._id, name: ty.title, parentId: sub._id, order: yi, clientPrice: p, employeePrice: round(p * 0.45, 500) });
        serviceCount++;
      }
    }
  }
  console.log(`  services:        ${serviceCount}`);

  // ── Clients: one ClientMeta per Workspace project (+ legacy Client docs for KPIs)
  const templates = departments.flatMap((d) => (d.taskTemplates ?? []).map((t) => ({ name: t.title, dept: d.name })));
  const clientInfos = [];
  for (const [i, p] of projects.entries()) {
    const company = p.title.split(' — ')[0];
    const services = faker.helpers.arrayElements(templates, { min: 1, max: 3 }).map((t) => {
      const [lo, hi] = SERVICE_PRICES[t.dept] ?? [10000, 50000];
      return { name: t.name, amount: round(faker.number.int({ min: lo, max: hi }) / 2, 1000), type: pick(['Monthly', 'Monthly', 'One Time'] as const) };
    });
    const monthly = services.filter((s) => s.type === 'Monthly').reduce((s, x) => s + x.amount, 0) || services[0].amount;
    const email = `accounts@${company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example.com`;
    const colorKey = COLORS[i % COLORS.length];
    await ClientMeta.create({ projectId: p._id, email, monthlyBilling: monthly, serviceBreakdown: services, initials: initials(company), colorKey });
    const status = p.status === 'on_hold' ? 'Paused' : p.status === 'completed' || p.status === 'archived' ? 'Inactive' : 'Active';
    await Client.create({
      name: company, email, service: services.map((s) => s.name).join(' + '), monthlyBilling: monthly,
      serviceBreakdown: services, manager: pick(users).name, status, initials: initials(company), colorKey,
      renewal: p.endDate ? p.endDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '',
    });
    clientInfos.push({ company, email, monthly, services, colorKey, status,
      address: `${faker.location.streetAddress()}, ${faker.location.city()}` });
  }
  console.log(`  clients:         ${clientInfos.length}`);

  // ── Invoices + monthly client records (last 6 months) ────────────────────
  let invNo = 1001;
  let invoiceCount = 0;
  let recordCount = 0;
  for (let m = 5; m >= 0; m--) {
    const issued = monthsAgo(m, 3);
    const monthLabel = issued.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    for (const c of clientInfos) {
      if (c.status === 'Paused' && m < 2) continue;
      if (c.status === 'Inactive' && m < 1) continue;
      const due = addDays(issued, 15);
      const status = due >= today ? 'Pending'
        : faker.helpers.weightedArrayElement([
          { value: 'Paid' as const, weight: m >= 2 ? 92 : 70 },
          { value: 'Partial' as const, weight: 10 },
          { value: 'Overdue' as const, weight: m >= 2 ? 3 : 20 },
        ]);
      const lineItems = c.services.map((s) => ({ description: `${s.name} — ${monthLabel}`, qty: 1, unitPrice: s.amount, amount: s.amount }));
      const amount = lineItems.reduce((s, l) => s + l.amount, 0);
      const gst = Math.round(amount * 0.18);
      const tdsRate = amount > 30000 ? 10 : 0;
      const inv = await Invoice.create({
        invoiceNumber: `INV-${invNo++}`, client: c.company, clientEmail: c.email, clientAddress: c.address,
        date: iso(issued), dueDate: iso(due), lineItems, amount, gstApplicable: true, gst, gstRate: 18, total: amount + gst,
        notes: 'Thank you for your business!', status,
        paidDate: status === 'Paid' ? iso(addDays(issued, faker.number.int({ min: 3, max: 14 }))) : undefined,
        taxType: c.colorKey === 'blue' || c.colorKey === 'red' ? 'Interstate' : 'Intrastate',
        tdsSection: tdsRate ? '194J' : 'None', tdsRate, tdsAmount: Math.round((amount * tdsRate) / 100),
      });
      invoiceCount++;
      const paid = status === 'Paid' ? inv.total : status === 'Partial' ? round(inv.total * 0.5, 100) : 0;
      await ClientRecord.create({
        name: c.company, service: c.services.map((s) => s.name).join(' + '), monthlyBilling: c.monthly,
        manager: pick(users).name, billingPeriod: ym(issued), initials: initials(c.company), colorKey: c.colorKey,
        invoiceId: inv._id, status: status === 'Paid' ? 'Paid' : status === 'Partial' ? 'Partial' : 'Pending',
        payments: paid ? [{
          amount: paid, method: pick(['Online', 'Online', 'Offline'] as const), mode: pick(['UPI', 'NEFT', 'Cheque', 'IMPS']),
          receivedFrom: c.company, date: ddmmyyyy(addDays(issued, 7)),
        }] : [],
      });
      recordCount++;
    }
  }
  console.log(`  invoices:        ${invoiceCount}   client records: ${recordCount}`);

  // ── Employees (EmployeeMeta per Workspace user + legacy Employee docs) ───
  const deptOf = (uid: Types.ObjectId) =>
    departments.find((d) => (d.members as Types.ObjectId[]).some((m) => String(m) === String(uid)))?.name ?? 'Management';
  const payroll = [];
  for (const [i, u] of users.entries()) {
    const base = u.role === 'admin' ? 150000
      : u.role === 'manager' ? round(faker.number.int({ min: 85000, max: 120000 }))
      : round(faker.number.int({ min: 35000, max: 75000 }));
    const hra = round(base * 0.4);
    const specialAllowance = round(base * 0.1);
    const incentives = round(faker.number.int({ min: 0, max: Math.round(base * 0.12) }));
    const providentFund = Math.round(base * 0.12);
    const esi = base + hra < 21000 ? Math.round((base + hra) * 0.0075) : 0;
    const professionalTax = 200;
    const tds = base > 80000 ? round(base * 0.08, 100) : 0;
    const deductions = providentFund + esi + professionalTax + tds;
    const row = {
      department: deptOf(u._id as Types.ObjectId), baseSalary: base, hra, specialAllowance, incentives, providentFund,
      esi, professionalTax, tds, deductions, finalSalary: base + hra + specialAllowance + incentives - deductions,
      colorKey: COLORS[i % COLORS.length],
    };
    await EmployeeMeta.create({ userId: u._id, ...row });
    await Employee.create({ name: u.name, ...row, status: 'Paid', initials: initials(u.name) });
    payroll.push({ name: u.name, ...row });
  }
  console.log(`  employees:       ${payroll.length}`);

  // ── Salary records (last 3 months paid, current month pending) ───────────
  const salaryDocs = [];
  for (let m = 3; m >= 0; m--) {
    const payPeriod = ym(monthsAgo(m));
    for (const p of payroll) {
      const leaveDays = faker.helpers.weightedArrayElement([{ value: 0, weight: 7 }, { value: 1, weight: 2 }, { value: 2, weight: 1 }]);
      const leaveDeduction = Math.round((p.baseSalary / 30) * leaveDays);
      const bonus = m === 1 && faker.number.int({ max: 4 }) === 0 ? 5000 : 0;
      salaryDocs.push({
        ...p, leaveDays, leaveDeduction, bonus, finalSalary: p.finalSalary - leaveDeduction + bonus,
        status: m === 0 ? 'Pending' : 'Paid', payPeriod, initials: initials(p.name),
      });
    }
  }
  await SalaryRecord.insertMany(salaryDocs);
  console.log(`  salary records:  ${salaryDocs.length}`);

  // ── Expenses (last 6 months) ─────────────────────────────────────────────
  const payrollTotal = payroll.reduce((s, p) => s + p.finalSalary, 0);
  const FIXED = [
    { category: 'Rent', vendor: 'Demo Realty LLP', description: 'Office rent', amount: 95000 },
    { category: 'Software', vendor: 'Design Suite Inc.', description: 'Design tools — team licences', amount: 18500 },
    { category: 'Software', vendor: 'CloudHost Co.', description: 'Cloud hosting & servers', amount: 22000 },
    { category: 'Utilities', vendor: 'City Power Ltd', description: 'Electricity & internet', amount: 14000 },
  ];
  const VARIABLE = [
    { category: 'Freelancers', vendors: ['PixelCraft Studio', 'WordSmith Collective', 'FrameShift Films'], range: [15000, 85000] },
    { category: 'Marketing', vendors: ['AdNetwork Pvt Ltd', 'Social Boost'], range: [10000, 60000] },
    { category: 'Travel', vendors: ['QuickCabs', 'SkyHigh Airlines'], range: [3000, 25000] },
    { category: 'Office Supplies', vendors: ['OfficeMart', 'PaperTrail Stationers'], range: [1500, 9000] },
    { category: 'Team Events', vendors: ['Café Bistro', 'FunZone Events'], range: [5000, 30000] },
  ] as const;
  const expenses = [];
  for (let m = 5; m >= 0; m--) {
    const first = monthsAgo(m, 1);
    const monthLabel = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    expenses.push({
      date: iso(first), category: 'Salaries', vendor: '—', description: `Salary disbursement — ${monthLabel}`,
      amount: payrollTotal, type: 'Fixed', recurring: true, payMethod: 'Bank Transfer', dueDate: iso(first),
      paid: m > 0, paidDate: m > 0 ? iso(first) : undefined,
    });
    for (const f of FIXED) {
      const d = monthsAgo(m, 5);
      const due = addDays(d, 5);
      const paid = due < today;
      expenses.push({
        date: iso(d), ...f, description: `${f.description} — ${monthLabel}`, type: 'Fixed', recurring: true,
        payMethod: pick(['Bank Transfer', 'Credit Card']), dueDate: iso(due), paid, paidDate: paid ? iso(addDays(d, 4)) : undefined,
      });
    }
    for (let k = 0; k < faker.number.int({ min: 4, max: 7 }); k++) {
      const v = pick(VARIABLE);
      const d = monthsAgo(m, faker.number.int({ min: 2, max: 27 }));
      if (d > today) continue;
      expenses.push({
        date: iso(d), category: v.category, vendor: pick(v.vendors), description: faker.commerce.productName(),
        amount: round(faker.number.int({ min: v.range[0], max: v.range[1] }), 100), type: 'Variable', recurring: false,
        payMethod: pick(['UPI', 'Credit Card', 'Bank Transfer']), paid: true, paidDate: iso(d),
      });
    }
  }
  await Expense.insertMany(expenses);
  console.log(`  expenses:        ${expenses.length}`);

  // ── GST filings (monthly) & TDS filings (quarterly) ──────────────────────
  const gst = [];
  for (let m = 6; m >= 1; m--) {
    const nextMonth = monthsAgo(m - 1, 1);
    gst.push({
      period: ym(monthsAgo(m)), dueDate: iso(addDays(nextMonth, 19)), // 20th of the following month
      status: m > 1 ? 'Filed' : 'Due', filedAt: m > 1 ? iso(addDays(nextMonth, 16)) : undefined,
      reminderDays: 3, reminderEmail: 'accounts@nimbusworks.example',
    });
  }
  await GSTFiling.insertMany(gst);

  const fyOf = (d: Date) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
  const quarterOf = (d: Date) => { const mm = d.getMonth() + 1; return mm <= 3 ? 4 : mm <= 6 ? 1 : mm <= 9 ? 2 : 3; };
  const currentQ = `FY${fyOf(today)}-Q${quarterOf(today)}`;
  const tds = new Map<string, object>();
  for (let m = 9; m >= 0; m--) {
    const d = monthsAgo(m);
    const quarter = `FY${fyOf(d)}-Q${quarterOf(d)}`;
    if (tds.has(quarter)) continue;
    const isCurrent = quarter === currentQ;
    const dueDate = iso(addDays(monthsAgo(Math.max(m - 3, 0), 1), 30));
    tds.set(quarter, {
      quarter, dueDate, status: isCurrent ? 'Pending' : 'Received', receivedAt: isCurrent ? undefined : dueDate,
      reminderDays: 3, reminderEmail: 'accounts@nimbusworks.example',
    });
  }
  await TDSFiling.insertMany([...tds.values()]);
  console.log(`  gst filings:     ${gst.length}   tds filings: ${tds.size}`);

  // ── Organisations (sister entities) + transactions ───────────────────────
  const orgDefs = [
    { name: 'Nimbus Labs LLP', state: 'Karnataka', gstin: '29BBBBB0000B1Z5' },
    { name: 'Nimbus Studio Pvt Ltd', state: 'Maharashtra', gstin: '27CCCCC0000C1Z5' },
  ];
  let txCount = 0;
  for (const [i, o] of orgDefs.entries()) {
    const org = await Organization.create({
      ...o, address: `${faker.location.streetAddress()}, ${faker.location.city()}`, status: 'Active',
      initials: initials(o.name), colorKey: COLORS[(i + 1) % COLORS.length], notes: 'Demo sister entity',
    });
    const txs = [];
    for (let m = 5; m >= 0; m--) {
      for (let k = 0; k < 3; k++) {
        const type = k === 0 ? 'Expense' : 'Revenue';
        const amount = round(faker.number.int({ min: type === 'Revenue' ? 40000 : 15000, max: type === 'Revenue' ? 150000 : 60000 }), 500);
        const d = monthsAgo(m, faker.number.int({ min: 2, max: 26 }));
        if (d > today) continue;
        txs.push({
          organization: org._id, date: iso(d), type,
          category: type === 'Revenue' ? pick(['Consulting', 'Retainer', 'Project fee']) : pick(['Rent', 'Software', 'Contractors']),
          description: faker.company.buzzPhrase(), amount, gstRate: 18, gstAmount: Math.round(amount * 0.18),
        });
      }
    }
    await OrgTransaction.insertMany(txs);
    txCount += txs.length;
  }
  console.log(`  organisations:   ${orgDefs.length}   transactions: ${txCount}`);
  console.log('\nFinance demo data ready.');
}

if (require.main === module) {
  seedFinance()
    .then(async () => { await mongoose.disconnect(); await sharedConn.close(); process.exit(0); })
    .catch((err) => { console.error('Seed failed:', err); process.exit(1); });
}
