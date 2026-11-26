'use client';
import OrganizationDetail from '@/components/pages/OrganizationDetail';
import { useRouteParams } from '@/lib/routeParams';

export default function OrganizationRoute() {
  const { id } = useRouteParams('/organizations/:id');
  return <OrganizationDetail id={id} />;
}
