'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { Globe, Eye, EyeOff, LogIn, UserPlus, Layers, Sparkles, Shield, Zap } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-400" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tr, locale, setLocale } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', inviteCode: '' });
  const [success, setSuccess] = useState('');

  // Handle NextAuth error redirects (e.g. from Google SSO failures)
  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setSuccess(
        locale === 'es'
          ? 'Contraseña actualizada. Ya puedes iniciar sesión.'
          : locale === 'pt'
            ? 'Senha atualizada. Já pode entrar.'
            : 'Password updated. You can sign in now.'
      );
      return;
    }
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, Record<string, string>> = {
        OAuthSignin: { es: 'Error al iniciar sesión con el proveedor externo.', pt: 'Erro ao fazer login com o provedor externo.', en: 'Error signing in with external provider.' },
        OAuthCallback: { es: 'Error en la respuesta del proveedor externo.', pt: 'Erro na resposta do provedor externo.', en: 'Error in external provider response.' },
        OAuthCreateAccount: { es: 'Error al crear la cuenta con proveedor externo.', pt: 'Erro ao criar a conta com provedor externo.', en: 'Error creating account with external provider.' },
        Callback: { es: 'Error en el proceso de autenticación.', pt: 'Erro no processo de autenticação.', en: 'Error in authentication process.' },
        CredentialsSignin: { es: 'Credenciales inválidas.', pt: 'Credenciais inválidas.', en: 'Invalid credentials.' },
        Default: { es: 'Error de autenticación. Intenta de nuevo.', pt: 'Erro de autenticação. Tente novamente.', en: 'Authentication error. Try again.' },
      };
      const msg = errorMessages[errorParam] || errorMessages.Default;
      setError(msg[locale] || msg.es);
      setGoogleLoading(false);
    }
  }, [searchParams, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const res = await signIn('credentials', { redirect: false, email: form.email, password: form.password });
        if (res?.error) { setError(locale === 'es' ? 'Credenciales inv\u00e1lidas' : locale === 'pt' ? 'Credenciais inv\u00e1lidas' : 'Invalid credentials'); }
        else {
          const entry = await fetch('/api/workspace/entry-route', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : { href: '/hub' }))
            .catch(() => ({ href: '/hub' }));
          router.replace(typeof entry?.href === 'string' ? entry.href : '/hub');
        }
      } else {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error || 'Error al registrar');
        } else {
          const signInRes = await signIn('credentials', { redirect: false, email: form.email, password: form.password });
          if (!signInRes?.error) {
            const entry = await fetch('/api/workspace/entry-route', { cache: 'no-store' })
              .then((r) => (r.ok ? r.json() : { href: '/hub' }))
              .catch(() => ({ href: '/hub' }));
            router.replace(typeof entry?.href === 'string' ? entry.href : '/hub');
          }
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    signIn('google', { redirect: true, callbackUrl: '/hub' });
  };

  const features = locale === 'es'
    ? [
        { icon: Layers, text: 'Ecosistema integrado de soluciones' },
        { icon: Shield, text: 'Acceso unificado a todos los sistemas' },
        { icon: Sparkles, text: 'Inteligencia artificial transversal' },
        { icon: Zap, text: 'Herramientas modulares y escalables' },
      ]
    : locale === 'pt' ? [
        { icon: Layers, text: 'Ecossistema integrado de solu\u00e7\u00f5es' },
        { icon: Shield, text: 'Acesso unificado a todos os sistemas' },
        { icon: Sparkles, text: 'Intelig\u00eancia artificial transversal' },
        { icon: Zap, text: 'Ferramentas modulares e escal\u00e1veis' },
      ] : [
        { icon: Layers, text: 'Integrated solutions ecosystem' },
        { icon: Shield, text: 'Unified access to all systems' },
        { icon: Sparkles, text: 'Cross-cutting artificial intelligence' },
        { icon: Zap, text: 'Modular and scalable tools' },
      ];

  return (
    <div className="min-h-screen flex">
      {/* Left panel - ETHOLYS branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-teal-400/5 border border-teal-400/10" style={{ width: `${100 + i * 80}px`, height: `${100 + i * 80}px`, top: `${10 + i * 12}%`, left: `${5 + i * 10}%` }} />
          ))}
        </div>
        <div className="relative z-10 text-white max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">ETHOLYS</h1>
                <p className="text-xs text-teal-400 font-medium tracking-widest uppercase">Solutions Factory</p>
              </div>
            </div>
          </div>
          <p className="text-lg text-slate-300 mb-8 leading-relaxed">
            {locale === 'es'
              ? 'Laboratorio de I+D e Innovaci\u00f3n. Un ecosistema de soluciones inteligentes para transformar la gesti\u00f3n de tu organizaci\u00f3n.'
              : locale === 'pt' ? 'Laborat\u00f3rio de P&D e Inova\u00e7\u00e3o. Um ecossistema de solu\u00e7\u00f5es inteligentes para transformar a gest\u00e3o da sua organiza\u00e7\u00e3o.'
              : 'R&D and Innovation Lab. An ecosystem of intelligent solutions to transform your organization\'s management.'}
          </p>
          <div className="space-y-4">
            {features.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-teal-400" />
                </div>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 pt-6 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">{locale === 'es' ? 'Sistemas del ecosistema' : locale === 'pt' ? 'Sistemas do ecossistema' : 'Ecosystem systems'}</p>
            <div className="flex flex-wrap gap-2">
              {['ATLAS', 'SIEP', 'FUNDHUB', 'NEXUS', 'FORGE', 'PRISM'].map(name => (
                <span key={name} className={`px-2.5 py-1 rounded-md text-xs font-medium ${name === 'ATLAS' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'}`}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="flex justify-between items-center mb-8">
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800">ETHOLYS</span>
            </div>
            <button onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-white shadow-sm hover:shadow-md transition-shadow">
              <Globe className="w-4 h-4" />
              {locale === 'es' ? 'PT' : locale === 'pt' ? 'EN' : 'ES'}
            </button>
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {isLogin ? tr('auth.welcome') : tr('auth.signup')}
          </h3>
          <p className="text-gray-500 mb-6">
            {locale === 'es' ? 'Accede al ecosistema ETHOLYS' : locale === 'pt' ? 'Acesse o ecossistema ETHOLYS' : 'Access the ETHOLYS ecosystem'}
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">{success}</div>}

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-2.5 mb-4 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg font-medium flex items-center justify-center gap-3 transition disabled:opacity-50 text-gray-700"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {isLogin
                  ? (locale === 'es' ? 'Iniciar sesi\u00f3n con Google' : locale === 'pt' ? 'Entrar com Google' : 'Sign in with Google')
                  : (locale === 'es' ? 'Registrarse con Google' : locale === 'pt' ? 'Registrar com Google' : 'Sign up with Google')}
              </>
            )}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{locale === 'es' ? 'o con email' : locale === 'pt' ? 'ou com email' : 'or with email'}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tr('auth.name')}</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'es' ? 'C\u00f3digo de invitaci\u00f3n (opcional)' : locale === 'pt' ? 'C\u00f3digo de convite (opcional)' : 'Invitation code (optional)'}</label>
                  <input type="text" value={form.inviteCode} onChange={e => setForm({ ...form, inviteCode: e.target.value })} placeholder={locale === 'es' ? 'Si tienes un c\u00f3digo, ingr\u00e9salo aqu\u00ed' : locale === 'pt' ? 'Se tiver um c\u00f3digo, insira aqui' : 'If you have a code, enter it here'} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition font-mono" />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tr('auth.email')}</label>
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tr('auth.password')}</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isLogin && (
                <Link
                  href="/login/forgot"
                  className="mt-2 inline-block text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                >
                  {locale === 'es' ? '¿Olvidaste tu contraseña?' : locale === 'pt' ? 'Esqueceu a senha?' : 'Forgot password?'}
                </Link>
              )}
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition disabled:opacity-50">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                <><LogIn className="w-4 h-4" /> {tr('auth.login')}</>
              ) : (
                <><UserPlus className="w-4 h-4" /> {tr('auth.signup')}</>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            {isLogin ? tr('auth.noAccount') : tr('auth.hasAccount')}{' '}
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-teal-600 font-medium hover:underline">
              {isLogin ? tr('auth.signup') : tr('auth.login')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
