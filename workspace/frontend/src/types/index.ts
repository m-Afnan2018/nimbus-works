export type ColumnType = 'text' | 'content' | 'number' | 'date' | 'time' | 'link' | 'color' | 'checkbox';

export type AutoFill = 'none' | 'serial' | 'today' | 'now';

export interface TableColumn {
  _id: string;
  key: string;
  label: string;
  type: ColumnType;
  order: number;
  autoFill: AutoFill;
  options: string[];
  width?: number;
}

export interface TableRow {
  _id: string;
  cells: Record<string, unknown>;
  order: number;
}

export interface CustomTable {
  _id: string;
  name: string;
  description?: string;
  color: string;
  columns: TableColumn[];
  isActive: boolean;
  createdBy?: { _id: string; name: string } | string;
  columnCount?: number;
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TableInstance {
  _id: string;
  project?: string;
  tab?: string;
  sourceTable?: string;
  name: string;
  periodMonth?: number;
  periodYear?: number;
  color: string;
  columns: TableColumn[];
  rows: TableRow[];
  createdBy?: { _id: string; name: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTab {
  _id: string;
  project: string;
  name: string;
  order: number;
  defaultTemplate?: { _id: string; name: string; color: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskType {
  _id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
  checklist?: string[];
}

export interface TaskTemplate {
  _id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
  checklist?: string[];
  types?: TaskType[];
}

export interface Department {
  _id: string;
  name: string;
  description?: string;
  color: string;
  heads: User[];
  members: User[];
  collaborators: User[];
  canSocialMedia: boolean;
  taskTemplates: TaskTemplate[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  avatar?: string;
  isActive?: boolean;
  lateThreshold?: string;
  createdAt?: string;
}

export interface ProjectMember {
  user: User;
  role: 'lead' | 'member' | 'viewer';
}

export interface ProjectLink {
  title: string;
  url: string;
}

export interface Project {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate: string;
  endDate: string;
  owner: User;
  members: ProjectMember[];
  tags: string[];
  progress: number;
  thumbnail?: string;
  links?: ProjectLink[];
  tableInstances?: TableInstance[];
  tabs?: ProjectTab[];
  taskCounts?: Record<string, number>;
  totalTasks?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  name: string;
  url: string;
  type: 'file' | 'image' | 'link';
  uploadedAt: string;
}

export interface ITimerEvent {
  action: 'start' | 'pause' | 'resume' | 'hold' | 'finish';
  timestamp: string;
}

export interface Delegation {
  _id: string;
  delegatedBy: User;
  delegatedTo: User;
  note?: string;
  delegatedAt: string;
}

export interface Contribution {
  _id: string;
  user: User;
  content: string;
  attachments: Attachment[];
  links: string[];
  submittedAt: string;
  updatedAt: string;
  timerStatus: 'idle' | 'running' | 'paused' | 'finished';
  timerEvents: { action: string; timestamp: string }[];
  totalElapsedSeconds: number;
  isDone: boolean;
}

export interface DeptRequest {
  _id: string;
  toDepartment: { _id: string; name: string; color: string };
  description: string;
  checklist?: string[];
  status: 'pending' | 'fulfilled';
  createdBy: { name: string };
  createdTask?: { _id: string; title: string; status: Task['status'] };
  createdAt: string;
  fulfilledAt?: string;
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

export interface CredentialAccessLogEntry {
  user: { _id: string; name: string; avatar?: string } | string;
  action: 'created' | 'updated' | 'revealed';
  at: string;
}

export interface Credential {
  _id: string;
  title: string;
  project: { _id: string; title: string } | string;
  department: { _id: string; name: string; color: string } | string;
  category: 'domain' | 'hosting' | 'ssl' | 'social' | 'ads' | 'email' | 'other';
  username: string;
  url: string;
  expiryDate?: string;
  reminderDaysBefore: number[];
  notes: string;
  visibility: 'department' | 'restricted';
  allowedUsers: string[];
  createdBy?: { _id: string; name: string; avatar?: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  remark?: string;
  project?: string | Project;
  isPersonal: boolean;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignees: User[];
  reporter: User;
  dueDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  tags: string[];
  sopRunId?: string;
  sopRunTitle?: string;
  dependencies: Task[];
  attachments: Attachment[];
  links: string[];
  thumbnail?: string;
  notes?: string;
  order: number;
  comments?: Comment[];
  timerStatus: 'idle' | 'running' | 'paused' | 'on_hold' | 'finished';
  timerEvents: ITimerEvent[];
  totalElapsedSeconds: number;
  delegations: Delegation[];
  isGroupTask?: boolean;
  contributions?: Contribution[];
  requests?: DeptRequest[];
  unassignedNotices?: { user: User; reason: 'user_deactivated'; at: string }[];
  checklist?: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  _id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  _id: string;
  content: string;
  author: User;
  task?: string;
  project?: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceNote {
  content: string;
  documents: string[];
  links: string[];
  createdAt: string;
}

export interface Attendance {
  _id: string;
  user: string | User;
  date: string;
  checkIn?: string;
  checkOut?: string;
  lunchStart?: string;
  lunchStop?: string;
  lunchDuration: number;
  status: 'present' | 'absent' | 'half_day' | 'remote' | 'leave' | 'late';
  workMode: 'office' | 'remote' | 'hybrid';
  notes: AttendanceNote[];
  hoursWorked: number;
  isLate: boolean;
  approvedBy?: string;
  createdAt: string;
}

export interface AttendanceStats {
  totalDays: number;
  present: number;
  absent: number;
  halfDay: number;
  remote: number;
  leave: number;
  late: number;
  totalHours: number;
  avgHours: number;
}

export interface Notification {
  _id: string;
  recipient: string;
  sender: User;
  type: 'task_assigned' | 'comment_mention' | 'deadline_reminder' | 'status_change' | 'project_invite';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface TeamMember extends User {
  activeTasks: number;
}

export interface BurndownData {
  totalTasks: number;
  data: Array<{ date: string; remaining: number; ideal: number }>;
}

export interface VelocityData {
  week: string;
  startDate: string;
  endDate: string;
  completed: number;
}

export interface AttendanceSummary {
  summary: Record<string, { count: number; avgHours: number }>;
  daily: Array<{ date: string; present: number; absent: number; leave: number }>;
}

export interface Resource {
  _id: string;
  name: string;
  description?: string;
  category: string;
  assignedTo: User;
  assignedBy: User;
  serialNumber?: string;
  condition: 'new' | 'good' | 'fair' | 'damaged';
  assignedAt: string;
  returnedAt?: string;
  isActive: boolean;
}

export interface Note {
  _id: string;
  title: string;
  content: string;
  owner: string;
  color: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  type: 'meeting' | 'reminder' | 'event' | 'deadline';
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  color: string;
  links: string[];
  owner: User;
  createdBy: User;
  invitees: User[];
  location?: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  createdAt: string;
  updatedAt: string;
}

export interface VoiceRoomParticipant {
  user: {
    _id: string;
    name: string;
    avatar?: string;
    role?: string;
  };
  joinedAt: string;
}

export interface VoiceRoom {
  _id: string;
  name: string;
  createdBy: { _id: string; name: string; avatar?: string } | string;
  participants: VoiceRoomParticipant[];
  maxParticipants: number;
  createdAt: string;
  updatedAt: string;
}
