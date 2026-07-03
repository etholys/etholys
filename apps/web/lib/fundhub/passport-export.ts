export type PassportExportData = {
  company: {
    name: string;
    shortName?: string | null;
    description?: string | null;
    country?: string | null;
    currency?: string | null;
    sector?: string | null;
    website?: string | null;
  };
  captureProfile: {
    themes: string[];
    countries: string[];
    crossEtholysOptIn: boolean;
  } | null;
  stats: {
    readinessScore: number;
    activeProjects: number;
    savedFunds: number;
    partners: number;
    complianceChecklists: number;
    proposals: Record<string, number>;
  };
  recentProposals: Array<{
    title: string;
    status: string;
    fund: { name: string; institution: string };
  }>;
  coalition?: Array<{ orgName: string; country?: string; role: string }>;
  generatedAt?: string;
};

export function passportToMarkdown(data: PassportExportData, locale: 'pt' | 'es' | 'en' = 'pt'): string {
  const h = locale === 'es' ? 'Perfil institucional' : locale === 'en' ? 'Institutional profile' : 'Perfil institucional';
  const lines: string[] = [
    `# ${h} — ${data.company.name}`,
    '',
    `**${locale === 'es' ? 'Preparación' : locale === 'en' ? 'Readiness' : 'Prontidão'}:** ${data.stats.readinessScore}%`,
    '',
    `## ${locale === 'es' ? 'Organización' : locale === 'en' ? 'Organization' : 'Organização'}`,
  ];

  if (data.company.sector) lines.push(`- Sector: ${data.company.sector}`);
  if (data.company.country) lines.push(`- ${locale === 'en' ? 'Country' : 'País'}: ${data.company.country}`);
  if (data.company.currency) lines.push(`- ${locale === 'en' ? 'Currency' : 'Moeda'}: ${data.company.currency}`);
  if (data.company.website) lines.push(`- Web: ${data.company.website}`);
  if (data.company.description) {
    lines.push('', data.company.description);
  }

  lines.push('', `## ${locale === 'es' ? 'Capacidad' : locale === 'en' ? 'Capacity' : 'Capacidade'}`);
  lines.push(`- SIEP: ${data.stats.activeProjects} ${locale === 'en' ? 'active projects' : 'projetos activos'}`);
  lines.push(`- ${locale === 'en' ? 'Partners' : 'Parceiros'}: ${data.stats.partners}`);
  lines.push(`- ${locale === 'en' ? 'Saved funds' : 'Fundos guardados'}: ${data.stats.savedFunds}`);
  lines.push(`- Compliance: ${data.stats.complianceChecklists}`);

  const draft = data.stats.proposals.draft ?? 0;
  const submitted = data.stats.proposals.submitted ?? 0;
  lines.push(`- ${locale === 'en' ? 'Proposals' : 'Propostas'}: ${draft} draft / ${submitted} submitted`);

  if (data.coalition && data.coalition.length > 0) {
    lines.push('', `## ${locale === 'es' ? 'Coalición' : locale === 'en' ? 'Coalition' : 'Coalizão'}`);
    for (const m of data.coalition) {
      lines.push(`- **${m.orgName}** (${m.country || '—'}) — ${m.role}`);
    }
  }

  if (data.recentProposals.length > 0) {
    lines.push('', `## Pipeline`);
    for (const p of data.recentProposals) {
      lines.push(`- ${p.title} · ${p.fund.institution} · ${p.status}`);
    }
  }

  if (data.generatedAt) {
    lines.push('', `---`, `_Generated ${new Date(data.generatedAt).toLocaleString()}_`);
  }

  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
