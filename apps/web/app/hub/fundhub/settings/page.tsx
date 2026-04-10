'use client';

import Link from 'next/link';
import { ArrowLeft, Settings2, Bell, UserCog, ShieldCheck } from 'lucide-react';

export default function FundHubSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/hub/fundhub" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao FundHub
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">Configurações do FundHub</h1>
            <p className="text-sm text-gray-600 mt-2">Personalize notificações, perfil da organização e permissões de acesso.</p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-3xl bg-white px-4 py-3 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200">
            <Settings2 className="w-5 h-5 text-amber-600" />
            Ajustes do sistema
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <UserCog className="w-6 h-6 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Perfil da organização</h2>
            </div>
            <p className="text-sm text-gray-600">Atualize nome, setor, localização e contatos para que suas propostas tenham informações corretas.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-6 h-6 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
            </div>
            <p className="text-sm text-gray-600">Configure alertas de prazos, novas oportunidades e atualizações de compliance.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">Permissões</h2>
            </div>
            <p className="text-sm text-gray-600">Defina quem do seu time pode acessar rascunhos, fundos salvos e relatórios de compliance.</p>
          </div>
        </div>

        <div className="mt-10 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Configurações rápidas</h2>
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">1. Atualizar nome e dados da organização</p>
              <p className="text-sm text-gray-600 mt-1">Mantenha seu perfil empresarial alinhado com requerimentos dos editais.</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">2. Notificações de novos editais</p>
              <p className="text-sm text-gray-600 mt-1">Ative alertas por setor e região para não perder prazos importantes.</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">3. Preferências de relatórios</p>
              <p className="text-sm text-gray-600 mt-1">Escolha o formato de relatórios e frequência de entregas.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
