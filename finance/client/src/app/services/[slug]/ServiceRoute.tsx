'use client';
import ServicePage from '@/components/pages/ServicePage';
import { useRouteParams } from '@/lib/routeParams';

export default function ServiceRoute() {
  const { slug } = useRouteParams('/services/:slug');
  return <ServicePage slug={slug} />;
}
