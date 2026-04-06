'use client';

import { useApp } from '@/app/providers';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, FlaskConical, Users, Plus, X, Copy, Check, Trash2, Mail } from 'lucide-react';

const tools = [
  {
    id: 'muse',
    name: 'MUSE',
    tagline: { es: 'Motor Universal de Sugerencias Estrat&eacute;gicas', pt: 'Motor Universal de Sugest&otilde;es Estrat&eacute;gicas', en: 'Universal Strategic Suggestions Engine' },
    description: {
      es: 'Director de innovaci&oacute;n IA que observa el ecosistema, identifica patrones y propone nuevos sistemas, mejoras y optimizaciones.',
      pt: 'Diretor de inova&ccedil;&atilde;o IA que observa o ecossistema, identifica padr&otilde;es e prop&otilde;e novos sistemas, melhorias e otimiza&ccedil;&otilde;es.',
      en: 'AI innovation director that observes the ecosystem, identifies patterns, and proposes new systems, improvements, and optimizations.',
    },
    icon: Sparkles,
    color: 'from-violet-500 to-purple-600',
    href: '/lab/muse',
    active: true,
  },
];

export default function LabPage() {
  const { locale } = useApp();
  const { data: session } = useSession() || {};
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === 'ADMIN';
  const [showInvites, setShowInvites] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchInvites = () => {
    fetch('/api/lab/invite').then(r => r.json()).then(d => setInvites(d.invites || []));
  };

  useEffect(() => {
    if (isAdmin) fetchInvites();
  }, [isAdmin]);

  const createInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await fetch('/api/lab/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      setInviteEmail('');
      fetchInvites();
    } finally {
      setInviteLoading(false);
    }
  };

  const revokeInvite = async (id: string) => {
    await fetch('/api/lab/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchInvites();
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Laboratorio ETHOLYS</h1>
            </div>
          </div>
          <p className="text-slate-400 text-sm ml-[52px]">
            {locale === 'es'
              ? 'Herramientas internas de la f&aacute;brica de soluciones.'
              : locale === 'pt' ? 'Ferramentas internas da f&aacute;brica de solu&ccedil;&otilde;es.'
              : 'Internal tools from the solutions factory.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvites(!showInvites)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition ${
              showInvites ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            {locale === 'es' ? 'Invitaciones' : locale === 'pt' ? 'Convites' : 'Invitations'}
          </button>
        )}
      </div>

      {/* Invitations Panel (Admin only) */}
      {isAdmin && showInvites && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-violet-400" />
            {locale === 'es' ? 'Gestionar Invitaciones' : locale === 'pt' ? 'Gerenciar Convites' : 'Manage Invitations'}
          </h3>

          {/* Create invite */}
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder={locale === 'es' ? 'correo@ejemplo.com' : locale === 'pt' ? 'email@exemplo.com' : 'email@example.com'}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              onKeyDown={e => e.key === 'Enter' && createInvite()}
            />
            <button
              onClick={createInvite}
              disabled={inviteLoading || !inviteEmail.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm font-medium disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />{locale === 'es' ? 'Invitar' : locale === 'pt' ? 'Convidar' : 'Invite'}
            </button>
          </div>

          {/* Invite list */}
          {invites.length === 0 ? (
            <p className="text-sm text-slate-500">{locale === 'es' ? 'Sin invitaciones a&uacute;n.' : locale === 'pt' ? 'Sem convites ainda.' : 'No invitations yet.'}</p>
          ) : (
            <div className="space-y-2">
              {invites.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-200 truncate">{inv.email}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        inv.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400' :
                        inv.status === 'ACCEPTED' ? 'bg-green-500/15 text-green-400' :
                        'bg-slate-500/15 text-slate-400'
                      }`}>
                        {inv.status === 'PENDING' ? (locale === 'es' ? 'Pendiente' : locale === 'pt' ? 'Pendente' : 'Pending') :
                         inv.status === 'ACCEPTED' ? (locale === 'es' ? 'Aceptada' : locale === 'pt' ? 'Aceito' : 'Accepted') :
                         (locale === 'es' ? 'Revocada' : locale === 'pt' ? 'Revogado' : 'Revoked')}
                      </span>
                    </div>
                    {inv.status === 'PENDING' && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs font-mono text-violet-400">{inv.code}</span>
                        <button onClick={() => copyCode(inv.code, inv.id)} className="text-slate-500 hover:text-violet-400 transition">
                          {copiedId === inv.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                  {inv.status === 'PENDING' && (
                    <button onClick={() => revokeInvite(inv.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.id}
              href={tool.href}
              className="group bg-slate-900 rounded-2xl border border-slate-800 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5 p-6 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {tool.active && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    {locale === 'es' ? 'Activo' : locale === 'pt' ? 'Ativo' : 'Active'}
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{tool.name}</h3>
              <p className="text-sm font-medium text-violet-300 mb-3" dangerouslySetInnerHTML={{ __html: tool.tagline[locale] || tool.tagline.es }} />
              <p className="text-sm text-slate-400 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: tool.description[locale] || tool.description.es }} />
              <div className="flex items-center gap-1 text-violet-400 text-sm font-medium group-hover:gap-2 transition-all">
                {locale === 'es' ? 'Acceder' : locale === 'pt' ? 'Acessar' : 'Access'}
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
