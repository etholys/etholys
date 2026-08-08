'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import InstitutionalHome from '@/components/site/InstitutionalHome';

/**
 * Site institucional público (vitrine).
 * Sessões autenticadas entram no Hub / função / FORGE conforme o âmbito.
 */
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const u = session?.user as {
      workspaceAccessMode?: string;
      workspaceHomePath?: string;
      platformAdmin?: boolean;
      forgeAccessMode?: string;
      forgeHomePath?: string;
      studioAccessMode?: string;
      studioHomePath?: string;
    };
    if (u?.forgeAccessMode === 'course_only' && u.forgeHomePath) {
      router.replace(u.forgeHomePath);
      return;
    }
    if (u?.studioAccessMode === 'share_only' && u.studioHomePath) {
      router.replace(u.studioHomePath);
      return;
    }
    if (u?.platformAdmin || u?.workspaceAccessMode === 'full') {
      router.replace('/hub');
      return;
    }
    if (u?.workspaceAccessMode === 'function_only' && u.workspaceHomePath) {
      router.replace(u.workspaceHomePath);
      return;
    }
    if (u?.workspaceAccessMode === 'none') {
      router.replace('/acesso');
    }
  }, [status, session, router]);

  if (status === 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400" />
      </div>
    );
  }

  return <InstitutionalHome />;
}
