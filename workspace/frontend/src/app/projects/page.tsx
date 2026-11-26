'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell/AppShell';
import ProjectCard from '@/components/projects/ProjectCard/ProjectCard';
import CreateProjectModal from '@/components/projects/CreateProjectModal/CreateProjectModal';
import Button from '@/components/ui/Button/Button';
import Spinner from '@/components/ui/Spinner/Spinner';
import Badge from '@/components/ui/Badge/Badge';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import Avatar from '@/components/ui/Avatar/Avatar';
import { useProjects } from '@/hooks/useProjects';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatStatus } from '@/lib/utils';
import styles from './projects.module.css';
import { LayoutGrid, List as ListIcon } from 'lucide-react';

type ProjectViewMode = 'card' | 'list';
const PROJECT_VIEW_KEY = 'workspace_projects_view';

const priorityVariant = {
  critical: 'danger' as const,
  high: 'warning' as const,
  medium: 'primary' as const,
  low: 'success' as const,
};

const statusVariant = {
  active: 'success' as const,
  planning: 'primary' as const,
  on_hold: 'warning' as const,
  completed: 'success' as const,
  archived: 'default' as const,
};

export default function ProjectsPage() {
  const { projects, loading, createProject } = useProjects();
  const { members } = useTeam();
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [viewMode, setViewMode] = useState<ProjectViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(PROJECT_VIEW_KEY) as ProjectViewMode) || 'card';
    }
    return 'card';
  });

  useEffect(() => { localStorage.setItem(PROJECT_VIEW_KEY, viewMode); }, [viewMode]);

  const canCreate = user?.role === 'admin' || user?.role === 'manager';

  const handleCreate = async (data: Record<string, unknown>) => {
    const project = await createProject(data as Parameters<typeof createProject>[0]);
    return project as { _id: string } | undefined;
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !p.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (priorityFilter && p.priority !== priorityFilter) return false;
      return true;
    });
  }, [projects, searchQuery, statusFilter, priorityFilter]);

  const hasFilters = searchQuery || statusFilter || priorityFilter;

  return (
    <AppShell title="Projects">
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.filters}>
            <input
              className={styles.search}
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.select}
            >
              <option value="">All Status</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={styles.select}
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter(''); setPriorityFilter(''); }}>
                Clear
              </Button>
            )}
          </div>
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === 'card' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setViewMode('card')}
              title="Card view"
              aria-label="Card view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
            >
              <ListIcon size={16} />
            </button>
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)}>
              + New Project
            </Button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}>
            <Spinner size="lg" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <p className={styles.empty}>
            {hasFilters ? 'No projects match your filters.' : 'No projects found. Create your first project to get started.'}
          </p>
        ) : viewMode === 'card' ? (
          <div className={styles.grid}>
            {filteredProjects.map((project) => (
              <ProjectCard key={project._id} project={project} />
            ))}
          </div>
        ) : (
          <div className={styles.list}>
            {filteredProjects.map((project) => (
              <Link key={project._id} href={`/projects/${project._id}`} className={styles.listRow}>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>{project.title}</span>
                  <span className={styles.listDesc}>{project.description}</span>
                </div>
                <div className={styles.listBadges}>
                  <Badge variant={statusVariant[project.status]}>{formatStatus(project.status)}</Badge>
                  <Badge variant={priorityVariant[project.priority]}>{project.priority}</Badge>
                </div>
                <div className={styles.listProgress}>
                  <ProgressBar value={project.progress} showLabel size="sm" />
                </div>
                <div className={styles.listAvatars}>
                  {project.members.slice(0, 3).map((m) => (
                    <Avatar key={m.user?.id || m.user?.email} name={m.user?.name || 'U'} src={m.user?.avatar} size="sm" />
                  ))}
                  {project.members.length > 3 && (
                    <span className={styles.more}>+{project.members.length - 3}</span>
                  )}
                </div>
                <span className={styles.listDate}>
                  {project.endDate ? `Due ${formatDate(project.endDate)}` : ''}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        members={members}
      />
    </AppShell>
  );
}
