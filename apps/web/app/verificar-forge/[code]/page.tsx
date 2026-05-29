import { Metadata } from 'next';
import type { Locale } from '@/lib/i18n';
import { parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { forgeT, forgeTFormat } from '@/lib/forge/i18n';

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
};

async function fetchCert(code: string) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/forge/certificates/verify/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { code } = await params;
  const { lang } = await searchParams;
  const locale = parseForgeEmailLocale(lang);
  return {
    title: forgeTFormat('forge.verify.title', locale, { code: code.trim().toUpperCase() }),
  };
}

function dateLocale(loc: Locale) {
  return loc === 'pt' ? 'pt-PT' : loc === 'en' ? 'en-GB' : 'es-ES';
}

export default async function VerificarForgePage({ params, searchParams }: Props) {
  const { code: raw } = await params;
  const { lang } = await searchParams;
  const locale = parseForgeEmailLocale(lang);
  const code = raw.trim().toUpperCase();
  const data = await fetchCert(code);
  const verifyUrl = `${process.env.NEXTAUTH_URL || ''}/verificar-forge/${code}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}`;

  if (!data?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="rounded-2xl bg-white p-8 shadow-lg text-center max-w-md">
          <p className="text-red-600 font-bold">{forgeT('forge.verify.notFound', locale)}</p>
          <p className="mt-2 font-mono text-sm text-slate-500">{code}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50 p-6">
      <div className="rounded-2xl border-4 border-emerald-600 bg-white p-8 shadow-xl max-w-lg w-full text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
          {forgeT('forge.verify.validBadge', locale)}
        </p>
        <h1 className="mt-4 text-2xl font-black text-slate-900">{data.learnerName}</h1>
        <p className="mt-2 text-lg text-slate-700">{data.courseTitle}</p>
        <p className="mt-1 text-sm text-slate-500">{data.institution}</p>
        <p className="mt-4 text-sm text-slate-600">
          {forgeT('forge.verify.issued', locale)}:{' '}
          {new Date(data.issuedAt).toLocaleDateString(dateLocale(locale))}
        </p>
        <p className="mt-4 font-mono text-violet-700">{data.verifyCode}</p>
        <img
          src={qr}
          alt={forgeT('forge.verify.qrAlt', locale)}
          className="mx-auto mt-6 rounded-lg border"
          width={180}
          height={180}
        />
      </div>
    </div>
  );
}
