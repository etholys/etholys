'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';

function MeetRoomResolveContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const companyId = searchParams.get('companyId')?.trim() || activeCompanyId || '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
        const r = await fetch(`/api/meet/rooms/${encodeURIComponent(slug)}${qs}`);
        const d = (await r.json()) as { joinPath?: string; error?: string };
        if (!r.ok || !d.joinPath) throw new Error(d.error || 'Sala não encontrada');
        if (!cancelled) router.replace(d.joinPath);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao abrir a sala');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, companyId, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#202124] px-6 text-center text-white">
        <p className="text-sm text-white/80">{error}</p>
        <a href="/hub/meet" className="text-sm font-medium text-teal-300 hover:underline">
          Voltar ao CHORUS
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#202124]">
      <Loader2 className="h-8 w-8 animate-spin text-white/70" />
    </div>
  );
}

export default function MeetRoomResolvePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#202124]">
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        </div>
      }
    >
      <MeetRoomResolveContent />
    </Suspense>
  );
}
