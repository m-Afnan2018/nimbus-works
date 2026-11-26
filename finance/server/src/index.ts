import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Establish shared DB connection before bridge models are registered
import './config/connections';
// Shared bridge models — must be registered before routes use populate()
import './models/shared/WorkspaceUser';
import './models/shared/WorkspaceProject';
import './models/shared/WorkspaceDepartment';
import './models/shared/WorkspaceTask';
import './models/shared/WorkspaceAttendance';
import './models/shared/WorkspaceSOP';

import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import invoiceRoutes from './routes/invoices';
import expenseRoutes from './routes/expenses';
import employeeRoutes from './routes/employees';
import salaryRecordRoutes from './routes/salaryRecords';
import dashboardRoutes from './routes/dashboard';
import slipTemplateRoutes from './routes/slipTemplate';
import clientRecordRoutes from './routes/clientRecords';
import gstFilingsRoutes, { runGSTReminderCron } from './routes/gstFilings';
import tdsFilingsRoutes, { runTDSReminderCron } from './routes/tdsFilings';
import serviceRoutes from './routes/services';
import sopRoutes from './routes/sops';
import invoiceBrandRoutes from './routes/invoiceBrand';
import leaveRoutes from './routes/leave';
import organizationRoutes from './routes/organizations';
import { requireAuth } from './middleware/authMiddleware';
import { demoGuard, isDemoMode } from './middleware/demo';
import { rateLimit, trustProxyHops } from './middleware/rateLimit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/demo_cfo';

// Behind the host nginx + gateway: trust that many proxies so req.ip is the visitor's IP.
if (trustProxyHops()) app.set('trust proxy', trustProxyHops());

// The finance UI is served from the same origin as /api (gateway in production,
// Next rewrites in development), so cross-origin access is off unless listed.
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Public-demo guard (no-op unless DEMO_MODE=true)
app.use(demoGuard);

// Per-IP limits: slow down password guessing and form spam. Reads are not limited.
app.use('/api/auth/login', rateLimit({ limit: 10, windowMs: 60_000, methods: ['POST'] }));
app.use('/api', rateLimit({ limit: 120, windowMs: 60_000, methods: ['POST', 'PUT', 'PATCH', 'DELETE'] }));

// Auth routes are public — registered before requireAuth
app.use('/api/auth', authRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', demo: isDemoMode() }));

// All other /api/* routes require a valid session
app.use('/api', requireAuth);

app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/salary-records', salaryRecordRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/slip-template', slipTemplateRoutes);
app.use('/api/client-records', clientRecordRoutes);
app.use('/api/gst-filings', gstFilingsRoutes);
app.use('/api/tds-filings', tdsFilingsRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sops', sopRoutes);
app.use('/api/invoice-brand', invoiceBrandRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/organizations', organizationRoutes);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    // Daily GST reminder check — 09:00 IST every day
    if (!isDemoMode()) cron.schedule('0 9 * * *', () => { void runGSTReminderCron(); void runTDSReminderCron(); }, { timezone: 'Asia/Kolkata' });
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
