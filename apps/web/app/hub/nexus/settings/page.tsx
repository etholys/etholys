'use client';

import { Settings } from 'lucide-react';
import { useApp } from '@/app/providers';

export default function NexusSettingsPage() {
  const { locale } = useApp();

  const title = locale === 'es' ? 'Ajustes Nexus' : locale === 'pt' ? 'Definições Nexus' : 'Nexus settings';
  const body =
    locale === 'es'
      ? 'Preferencias del módulo (notificaciones de red, recordatorios de ruta, integración con SIEP) se configurarán aquí.'
      : locale === 'pt'
        ? 'Preferências do módulo (notificações de rede, lembretes da rota, integração SIEP) serão configuradas aqui.'
        : 'Module preferences (network alerts, roadmap reminders, SIEP integration) will be configured here.';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2 text-gray-900">
        <Settings className="h-7 w-7 text-violet-600" />
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>
      <p className="max-w-2xl text-sm text-gray-600">{body}</p>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
        {locale === 'pt'
          ? 'A empresa activa e o idioma gerem-se na barra lateral (mesmo padrão que ATLAS e FundHub).'
          : locale === 'es'
            ? 'La empresa activa y el idioma se gestionan en la barra lateral (mismo patrón que ATLAS y FundHub).'
            : 'Active company and language are managed in the sidebar (same pattern as ATLAS and FundHub).'}
      </div>
    </div>
  );
}
