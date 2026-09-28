import { redirect } from 'next/navigation';
import { AuroraPortfolioWorkspace } from '@/components/etholys/AuroraPortfolioWorkspace';

export default function AuroraPortfolioPage({
  searchParams,
}: {
  searchParams: { company?: string; engagement?: string };
}) {
  const company = String(searchParams.company || '').trim();
  if (company) {
    const q = new URLSearchParams({ company });
    const engagement = String(searchParams.engagement || '').trim();
    if (engagement) q.set('engagement', engagement);
    redirect(`/hub/aurora/dossie?${q}`);
  }
  return <AuroraPortfolioWorkspace />;
}
