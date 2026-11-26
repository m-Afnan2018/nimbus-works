import { ClientOnly } from '@/lib/routeParams';
import ProjectDetailPage from './ProjectDetailPage';

// Static export: one placeholder page ("_") is prerendered and nginx serves it
// for every real id; the client component reads the id from the URL.
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return (
    <ClientOnly>
      <ProjectDetailPage />
    </ClientOnly>
  );
}
