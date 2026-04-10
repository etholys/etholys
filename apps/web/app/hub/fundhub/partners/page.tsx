'use client';

import Link from 'next/link';
import { ArrowLeft, Globe, Handshake, MapPin } from 'lucide-react';

const partners = [
  { name: 'ONG Verde', country: 'Brasil', role: 'Parceira para editais sociais' },
  { name: 'Rede AgroTech', country: 'Colômbia', role: 'Parceira local para inovação' },
  { name: 'Fundação Cidadã', country: 'Portugal', role: 'Apoio para fundos europeus' },
];

export default function FundHubPartnersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link href="/hub/fundhub" className="text-sm text-gray-600 hover:text-gray-900">← Voltar ao FundHub</Link>
            <h1 className="text-3xl font-semibold text-gray-900">Parceiros locais e jurídicos</h1>
            <p className="max-w-2xl text-sm leading-6 text-gray-600">Explore organizações que podem ajudar a tornar seu projeto elegível a fundos específicos ou a entrar em novos países.</p>
          </div>
          <div className="rounded-3xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200">
            <div className="inline-flex items-center gap-2 text-sm text-gray-700">
              <Handshake className="h-4 w-4 text-emerald-600" />
              <span>Conexões estratégicas</span>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-amber-600">Rede</p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">Parceiros orientados por perfil de edital</h2>
            </div>
            <div className="inline-flex items-center rounded-3xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
              <MapPin className="h-4 w-4 text-violet-600" />
              Acesso rápido a contatos locais
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {partners.map((partner) => (
              <div key={partner.name} className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-gray-500">{partner.country}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-gray-900">{partner.name}</h3>
                    <p className="mt-2 text-sm text-gray-600">{partner.role}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                    <Globe className="h-4 w-4" />
                    Ver perfil
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
