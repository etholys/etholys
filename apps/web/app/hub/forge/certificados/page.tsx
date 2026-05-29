'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { Award, Search } from 'lucide-react';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

type Cert = {
  id: string;
  title: string;
  verifyCode: string;
  issuedAt: string;
  userName: string;
  courseTitle: string;
  coverEmoji: string;
};

export default function ForgeCertificadosPage() {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const { activeCompanyId } = useApp();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);

  const dateLocale = locale === 'pt' ? 'pt-PT' : locale === 'en' ? 'en-GB' : 'es-ES';

  useEffect(() => {
    const q = activeCompanyId ? `?companyId=${encodeURIComponent(activeCompanyId)}&mine=1` : '?mine=1';
    fetch(`/api/forge/certificates${q}`)
      .then((r) => r.json())
      .then((d) => setCerts(d.certificates ?? []));
  }, [activeCompanyId]);

  async function verify() {
    const code = verifyInput.trim().toUpperCase();
    if (!code) return;
    const res = await fetch(`/api/forge/certificates/verify/${encodeURIComponent(code)}`);
    const data = await res.json();
    setVerifyResult(res.ok ? data : { valid: false });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Award className="h-7 w-7 text-emerald-600" />
          {ft('forge.certs.title')}
        </h1>
        <p className="text-sm text-slate-500">{ft('forge.certs.subtitle')}</p>
      </div>

      <div className="rounded-xl border bg-white p-4 flex flex-wrap gap-2">
        <input
          value={verifyInput}
          onChange={(e) => setVerifyInput(e.target.value)}
          placeholder={ft('forge.certs.codePlaceholder')}
          className="flex-1 min-w-[200px] rounded border px-3 py-2 text-sm font-mono uppercase"
        />
        <button
          type="button"
          onClick={verify}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Search className="h-4 w-4" /> {ft('forge.certs.verify')}
        </button>
      </div>

      {verifyResult && (
        <div
          className={`rounded-lg p-4 text-sm ${
            verifyResult.valid ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'
          }`}
        >
          {verifyResult.valid ? (
            <>
              <p className="font-bold">{ft('forge.certs.valid')}</p>
              <p>
                {String(verifyResult.learnerName)} — {String(verifyResult.courseTitle)}
              </p>
              <p className="text-xs opacity-80">{String(verifyResult.institution)}</p>
            </>
          ) : (
            <p>{ft('forge.certs.notFound')}</p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {certs.map((c) => (
          <div key={c.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-2xl">{c.coverEmoji}</div>
            <p className="mt-2 font-bold text-slate-900">{c.courseTitle}</p>
            <p className="text-xs text-slate-500">
              {ft('forge.certs.issued')}: {new Date(c.issuedAt).toLocaleDateString(dateLocale)}
            </p>
            <p className="mt-2 font-mono text-xs text-violet-700">{c.verifyCode}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a
                href={`/api/forge/certificates/${encodeURIComponent(c.verifyCode)}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 hover:underline"
              >
                {ft('forge.certs.print')}
              </a>
              <a
                href={`/verificar-forge/${encodeURIComponent(c.verifyCode)}?lang=${locale}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-violet-700 hover:underline"
              >
                {ft('forge.certs.verifyQr')}
              </a>
            </div>
          </div>
        ))}
      </div>
      {certs.length === 0 && <p className="text-sm text-slate-500">{ft('forge.certs.empty')}</p>}
    </div>
  );
}
