'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Plus, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '@/app/providers';

export default function OnboardingPage() {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const { locale } = useApp();
  type ML = { es: string; pt: string; en: string };
  const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
  const L = (m: ML) => m[locale] || m.en;
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [companyForm, setCompanyForm] = useState({ name: '', shortName: '', description: '', currency: 'USD', color: '#0D9488' });
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || L(ml('Error creating company','Error al crear empresa','Erro ao criar empresa')));
      setSuccess(L(ml('Company created successfully!','¡Empresa creada exitosamente!','Empresa criada com sucesso!')));
      setTimeout(() => router.replace('/dashboard'), 1000);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || L(ml('Invalid code','Código inválido','Código inválido')));
      setSuccess(data.message || L(ml('You have joined successfully!','¡Te has unido exitosamente!','Você entrou com sucesso!')));
      setTimeout(() => router.replace('/dashboard'), 1000);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{L(ml('Welcome to RC 360°!','¡Bienvenido a RC 360°!','Bem-vindo ao RC 360°!'))}</h1>
          <p className="text-gray-500 mt-1">{L(ml('Hello','Hola','Olá'))} {session?.user?.name ?? ''}, {L(ml('set up your workspace','configura tu espacio de trabajo','configure seu espaço de trabalho'))}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button onClick={() => { setTab('create'); setError(''); setSuccess(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${tab === 'create' ? 'bg-white shadow text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <Plus className="w-4 h-4" />{L(ml('Create Organization','Crear Organización','Criar Organização'))}
            </button>
            <button onClick={() => { setTab('join'); setError(''); setSuccess(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${tab === 'join' ? 'bg-white shadow text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <Mail className="w-4 h-4" />{L(ml('Join with Code','Unirse con Código','Entrar com Código'))}
            </button>
          </div>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-600 text-sm">{success}</div>}

          {tab === 'create' && (
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('Organization name','Nombre de la organización','Nome da organização'))}</label>
                <input required value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm" placeholder={L(ml("My Company Inc.","Mi Empresa S.A.","Minha Empresa S.A."))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('Abbreviation','Abreviación','Abreviação'))}</label>
                  <input required value={companyForm.shortName} onChange={e => setCompanyForm({ ...companyForm, shortName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm" placeholder="MES" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('Currency','Moneda','Moeda'))}</label>
                  <select value={companyForm.currency} onChange={e => setCompanyForm({ ...companyForm, currency: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-sm">
                    <option value="USD">USD</option><option value="BRL">BRL</option><option value="EUR">EUR</option><option value="UYU">UYU</option><option value="ARS">ARS</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('Description (optional)','Descripción (opcional)','Descrição (opcional)'))}</label>
                <input value={companyForm.description} onChange={e => setCompanyForm({ ...companyForm, description: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm" placeholder={L(ml("Brief description","Descripción breve","Descrição breve"))} />
              </div>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-medium hover:from-teal-600 hover:to-emerald-700 transition disabled:opacity-50">
                <Building2 className="w-4 h-4" />{loading ? L(ml('Creating...','Creando...','Criando...')) : L(ml('Create Organization','Crear Organización','Criar Organização'))}
              </button>
            </form>
          )}

          {tab === 'join' && (
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('Invitation code','Código de invitación','Código de convite'))}</label>
                <input required value={inviteCode} onChange={e => setInviteCode(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm font-mono tracking-wider" placeholder={L(ml("Enter your code here","Ingresa tu código aquí","Digite seu código aqui"))} />
              </div>
              <p className="text-xs text-gray-400">{L(ml('Request the invitation code from the organization administrator.','Solicita el código de invitación al administrador de la organización.','Solicite o código de convite ao administrador da organização.'))}</p>
              <button type="submit" disabled={loading || !inviteCode.trim()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-medium hover:from-teal-600 hover:to-emerald-700 transition disabled:opacity-50">
                <ArrowRight className="w-4 h-4" />{loading ? L(ml('Verifying...','Verificando...','Verificando...')) : L(ml('Join','Unirse','Entrar'))}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          {L(ml('RC 360° — Integrated Rural Project Management','RC 360° — Gestión Integral de Proyectos Rurales','RC 360° — Gestão Integral de Projetos Rurais'))}
        </p>
      </div>
    </div>
  );
}
