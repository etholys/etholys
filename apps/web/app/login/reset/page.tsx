'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useApp } from '@/app/providers';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { locale } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = (es: string, pt: string, en: string) =>
    locale === 'pt' ? pt : locale === 'en' ? en : es;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError(t('Las contraseñas no coinciden', 'As senhas não coincidem', 'Passwords do not match'));
      return;
    }
    if (password.length < 8) {
      setError(t('Mínimo 8 caracteres', 'Mínimo 8 caracteres', 'Minimum 8 characters'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('Error', 'Erro', 'Error'));
        return;
      }
      router.replace('/login?reset=1');
    } catch {
      setError(t('Error de conexión', 'Erro de conexão', 'Connection error'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{t('Enlace inválido', 'Link inválido', 'Invalid link')}</p>
          <Link href="/login/forgot" className="text-teal-600 font-medium hover:underline">
            {t('Solicitar nuevo enlace', 'Pedir novo link', 'Request new link')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border shadow-sm p-8">
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-teal-600 hover:underline mb-6">
          <ArrowLeft className="h-4 w-4" />
          {t('Volver al login', 'Voltar ao login', 'Back to login')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {t('Nueva contraseña', 'Nova senha', 'New password')}
        </h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Nueva contraseña', 'Nova senha', 'New password')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Confirmar contraseña', 'Confirmar senha', 'Confirm password')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                {t('Guardar contraseña', 'Guardar senha', 'Save password')}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
