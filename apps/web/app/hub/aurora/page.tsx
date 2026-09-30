import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuroraHomeGate } from '@/components/etholys/AuroraHomeGate';

export default function AuroraPortfolioPage({
  searchParams,
}: {
  searchParams: { company?: string; engagement?: string };
}) {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-amber-700" />}>
      <AuroraHomeGate company={searchParams.company} engagement={searchParams.engagement} />
    </Suspense>
  );
}
