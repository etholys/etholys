'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import Link from 'next/link';
import { Layers, FlaskConical, LogOut, Globe, ChevronLeft, ShieldAlert } from 'lucide-react';

export default function LabLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const { locale, setLocale } = useApp();
  const [accessState, setAccessState] = useState<'loading' | 'granted' | 'denied' | 'invite'>('loading');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // Fast path: ADMIN always has access
    const role = (session?.user as any)?.role;
    if (role === 'ADMIN') {
      setAccessState('granted');
      return;
    }
    // For non-admins, verify via API (checks invite status)
    fetch('/api/lab/access')
      .then(r => r.json())
      .then(d => {
        setAccessState(d.hasAccess ? 'granted' : 'invite');
      })
      .catch(() => setAccessState('denied'));
  }, [status, session]);

  if (status === 'loading' || accessState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Invite code entry screen
  if (accessState === 'invite') {
    return <LabInviteGate locale={locale} onSuccess={() => setAccessState('granted')} />;
  }

  if (accessState === 'denied') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {locale === 'es' ? 'Acceso Denegado' : locale === 'pt' ? 'Acesso Negado' : 'Access Denied'}
        </h2>
        <p className="text-slate-400 max-w-md mb-6">
          {locale === 'es'
            ? 'No tienes permisos para acceder al Laboratorio ETHOLYS.'
            : locale === 'pt' ? 'Voc\u00ea n\u00e3o tem permiss\u00e3o para acessar o Laborat\u00f3rio ETHOLYS.'
            : 'You do not have permission to access the ETHOLYS Laboratory.'}
        </p>
        <Link href="/hub" className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm">
          {locale === 'es' ? 'Volver al Hub' : locale === 'pt' ? 'Voltar ao Hub' : 'Back to Hub'}
        </Link>
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')?.[0] || '';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Lab Header */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hub" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition text-sm">
              <ChevronLeft className="w-4 h-4" />
              Hub
            </Link>
            <div className="w-px h-5 bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-sm">ETHOLYS</span>
                <span className="text-[10px] text-violet-400 ml-1.5">Lab</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg hover:bg-slate-800 transition text-slate-400">
              <Globe className="w-3.5 h-3.5" />{locale?.toUpperCase()}
            </button>
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-700">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-[10px] font-bold">
                {firstName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline">{firstName}</span>
              <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-slate-500 hover:text-red-400 transition" title={locale === 'es' ? 'Cerrar sesi\u00f3n' : locale === 'pt' ? 'Sair' : 'Sign out'}>
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

/* ---- Invite Gate Component ---- */
function LabInviteGate({ locale, onSuccess }: { locale: string; onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lab/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || (locale === 'es' ? 'C\u00f3digo inv\u00e1lido' : locale === 'pt' ? 'C\u00f3digo inv\u00e1lido' : 'Invalid code'));
      }
    } catch {
      setError(locale === 'es' ? 'Error de conexi\u00f3n' : locale === 'pt' ? 'Erro de conex\u00e3o' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">ETHOLYS Lab</h2>
          <p className="text-slate-400 text-sm">
            {locale === 'es'
              ? 'Ingresa tu c\u00f3digo de invitaci\u00f3n para acceder al laboratorio.'
              : locale === 'pt' ? 'Insira seu c\u00f3digo de convite para acessar o laborat\u00f3rio.'
              : 'Enter your invitation code to access the laboratory.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder={locale === 'es' ? 'C\u00f3digo de invitaci\u00f3n' : locale === 'pt' ? 'C\u00f3digo de convite' : 'Invitation code'}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-center text-lg font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 tracking-widest"
            maxLength={8}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-indigo-700 transition disabled:opacity-50"
          >
            {loading
              ? (locale === 'es' ? 'Verificando...' : locale === 'pt' ? 'Verificando...' : 'Verifying...')
              : (locale === 'es' ? 'Acceder' : locale === 'pt' ? 'Acessar' : 'Access')}
          </button>
        </form>
        <div className="text-center mt-6">
          <Link href="/hub" className="text-sm text-slate-500 hover:text-slate-300 transition">
            {locale === 'es' ? '\u2190 Volver al Hub' : locale === 'pt' ? '\u2190 Voltar ao Hub' : '\u2190 Back to Hub'}
          </Link>
        </div>
      </div>
    </div>
  );
}
