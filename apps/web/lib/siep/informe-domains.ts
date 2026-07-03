import type { LucideIcon } from 'lucide-react';
import { BookOpen, BarChart3, Wallet, MapPin } from 'lucide-react';

/** Tipos built-in de informe ao financiador / internos */
export type BuiltInInformeDomain = 'narrative' | 'me' | 'budget' | 'field';

/** Built-in ou slug `custom:…` definido por projecto */
export type InformeDomain = BuiltInInformeDomain | `custom:${string}`;

export type InformeDomainConfig = {
  id: BuiltInInformeDomain;
  labelKey: string;
  introKey: string;
  icon: LucideIcon;
};

export type CustomInformeDomain = {
  id: `custom:${string}`;
  label: string;
  intro: string;
};

export const INFORME_DOMAINS: InformeDomainConfig[] = [
  {
    id: 'narrative',
    labelKey: 'siep.informe.domain.narrative',
    introKey: 'siep.informe.domain.narrativeIntro',
    icon: BookOpen,
  },
  {
    id: 'me',
    labelKey: 'siep.informe.domain.me',
    introKey: 'siep.informe.domain.meIntro',
    icon: BarChart3,
  },
  {
    id: 'budget',
    labelKey: 'siep.informe.domain.budget',
    introKey: 'siep.informe.domain.budgetIntro',
    icon: Wallet,
  },
  {
    id: 'field',
    labelKey: 'siep.informe.domain.field',
    introKey: 'siep.informe.domain.fieldIntro',
    icon: MapPin,
  },
];

export function isBuiltInInformeDomain(raw: string | null | undefined): raw is BuiltInInformeDomain {
  return INFORME_DOMAINS.some((d) => d.id === raw);
}

export function isCustomInformeDomain(raw: string | null | undefined): raw is `custom:${string}` {
  return typeof raw === 'string' && raw.startsWith('custom:');
}

export function normalizeInformeDomain(raw: string | null | undefined): InformeDomain {
  if (isCustomInformeDomain(raw)) return raw;
  if (raw === 'budget' || raw === 'financial') return 'budget';
  if (raw === 'narrative' || raw === 'narrativo') return 'narrative';
  if (raw === 'field' || raw === 'terreno') return 'field';
  return 'me';
}

export function isInformeDomain(raw: string | null | undefined): raw is InformeDomain {
  return isBuiltInInformeDomain(raw) || isCustomInformeDomain(raw);
}

export function domainPackageTitle(domain: InformeDomain, customLabel?: string): string {
  if (isCustomInformeDomain(domain)) {
    return customLabel ? `Modelos · ${customLabel}` : 'Modelos · personalizado';
  }
  const titles: Record<BuiltInInformeDomain, string> = {
    narrative: 'Modelos · narrativo',
    me: 'Modelos · M&E',
    budget: 'Modelos · financeiro',
    field: 'Modelos · terreno',
  };
  return titles[domain];
}
