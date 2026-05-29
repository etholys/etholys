import { Suspense } from 'react';

export default function ForgeCursoLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="text-sm text-slate-500">A carregar curso...</p>}>{children}</Suspense>;
}
