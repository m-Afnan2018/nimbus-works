import { ClientOnly } from '@/lib/routeParams';
import TaskDetailPage from './TaskDetailPage';

// Static export: one placeholder page ("_") is prerendered and nginx serves it
// for every real id; the client component reads the id from the URL.
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: '_', taskId: '_' }];
}

export default function Page() {
  return (
    <ClientOnly>
      <TaskDetailPage />
    </ClientOnly>
  );
}
