'use client';
import SOPBuilder from '@/components/sops/SOPBuilder/SOPBuilder';
import { useRouteParams } from '@/lib/routeParams';

export default function SopRoute() {
  const { id } = useRouteParams('/sops/:id');
  return <SOPBuilder sopId={id} />;
}
