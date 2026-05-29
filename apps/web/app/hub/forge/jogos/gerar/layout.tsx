import { Suspense } from 'react';

export default function ForgeGerarLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">A carregar...</p>}>{children}</Suspense>
  );
}
