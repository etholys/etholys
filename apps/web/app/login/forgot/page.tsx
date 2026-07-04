'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { useApp } from '@/app/providers';

export default function ForgotPasswordPage() {
  const { locale } = useApp();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const t = (es: string, pt: string, en: string) =>
    locale === 'pt' ? pt : locale === 'en' ? en : es;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setResetUrl(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('Error', 'Erro', 'Error'));
        return;
      }
      setMessage(
        t(
          'Si el email existe en nuestra base, recibirás un enlace para restablecer la contraseña.',
          'Se o email existir na nossa base, receberá um link para redefinir a senha.',
          'If the email exists in our system, you will receive a reset link.'
        )
      );
      if (data.resetUrl) setResetUrl(data.resetUrl);
    } catch {
      setError(t('Error de conexión', 'Erro de conexão', 'Connection error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border shadow-sm p-8">
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-teal-600 hover:underline mb-6">
          <ArrowLeft className="h-4 w-4" />
          {t('Volver al login', 'Voltar ao login', 'Back to login')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {t('Recuperar contraseña', 'Recuperar senha', 'Forgot password')}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {t(
            'Te enviaremos un enlace para definir una nueva contraseña.',
            'Enviaremos um link para definir uma nova senha.',
            'We will send you a link to set a new password.'
          )}
        </p>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        {message && <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{message}</div>}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('Correo electrónico', 'Email', 'Email')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                <Mail className="w-4 h-4" />
                {t('Enviar enlace', 'Enviar link', 'Send link')}
              </>
            )}
          </button>
        </form>
        {resetUrl && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <p className="font-bold mb-1">
              {t('Modo soporte (email no configurado)', 'Modo suporte (email não configurado)', 'Support mode (email not configured)')}
            </p>
            <a href={resetUrl} className="break-all underline">
              {resetUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
