import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import attendanceRoutes from './routes/attendance.routes';
import teamRoutes from './routes/team.routes';
import reportRoutes from './routes/report.routes';
import resourceRoutes from './routes/resource.routes';
import noteRoutes from './routes/note.routes';
import adminRoutes from './routes/admin.routes';
import calendarEventRoutes from './routes/calendarEvent.routes';
import departmentRoutes from './routes/department.routes';
import sopRoutes from './routes/sop.routes';
import credentialRoutes from './routes/credential.routes';
import mediaRoutes from './routes/media.routes';
import projectCalendarRoutes from './routes/projectCalendar.routes';
import socialRoutes from './routes/social.routes';
import pushRoutes from './routes/push.routes';
import chatRoutes from './routes/chat.routes';
import roomRoutes from './routes/room.routes';
import tableRoutes from './routes/table.routes';
import tableInstanceRoutes from './routes/tableInstance.routes';
import projectTabRoutes from './routes/projectTab.routes';
import { sendPushToUser } from './utils/webPush';
import { errorHandler, notFound } from './middleware/error.middleware';
import { authenticate } from './middleware/auth.middleware';
import { demoGuard, isDemoMode } from './middleware/demo.middleware';
import { upload } from './middleware/upload.middleware';
import { rateLimit, trustProxyHops } from './middleware/rateLimit';
import Notification from './models/Notification';
import User from './models/User';

const app = express();

// Behind the host nginx + gateway: trust that many proxies so req.ip is the visitor's IP.
if (trustProxyHops()) app.set('trust proxy', trustProxyHops());

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Public-demo guard (no-op unless DEMO_MODE=true)
app.use(demoGuard);

// Per-IP limits: slow down password guessing and form/chat spam. Reads are not limited.
app.use('/api/auth/login', rateLimit({ limit: 10, windowMs: 60_000, methods: ['POST'] }));
app.use('/api', rateLimit({ limit: 120, windowMs: 60_000, methods: ['POST', 'PUT', 'PATCH', 'DELETE'] }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', demo: isDemoMode(), timestamp: new Date().toISOString() });
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// File upload endpoint
app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file provided.' });
    return;
  }
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const type = imageTypes.includes(req.file.mimetype) ? 'image' : 'file';
  res.json({
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    type,
    size: req.file.size,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calendar-events', calendarEventRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/sops', sopRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/projects/:id/media', mediaRoutes);
app.use('/api/projects/:id/calendar', projectCalendarRoutes);
app.use('/api/projects/:id/social', socialRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/table-instances', tableInstanceRoutes);
app.use('/api/project-tabs', projectTabRoutes);

// Notifications routes (inline)
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user?.id })
      // Notification lives on the private connection; name the User model explicitly
      // so populate works across connections (same pattern as chat/task controllers).
      .populate({ path: 'sender', model: User, select: 'name avatar' })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (err) {
    console.error('[notifications] list failed:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ message: 'Marked as read.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/notifications/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user?.id, isRead: false }, { isRead: true });
    res.json({ message: 'All marked as read.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/notifications/:id', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user?.id });
    res.json({ message: 'Notification deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/notifications', authenticate, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user?.id });
    res.json({ message: 'All notifications cleared.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
