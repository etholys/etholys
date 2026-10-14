export type SiepProjectSignal = {
  name: string;
  country?: string | null;
  status?: string | null;
};

export type SiepAtlasInput = {
  projects: SiepProjectSignal[];
  activity?: string | null;
  sector?: string | null;
  entityType?: string | null;
  country?: string | null;
};

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Resumo curto do que SIEP e ATLAS já têm — a análise não pede para reescrever a lista. */
export function formatSiepAtlasSummary(input: SiepAtlasInput): string {
  const projects = input.projects
    .map((p) => ({
      name: clean(p.name),
      country: clean(p.country),
    }))
    .filter((p) => p.name)
    .slice(0, 8);

  const siep = projects.length
    ? `SIEP — ${projects.length} projeto(s) activo(s): ${projects
        .map((p) => (p.country ? `${p.name} (${p.country})` : p.name))
        .join('; ')}.`
    : '';

  const activity = clean(input.activity);
  const sector = clean(input.sector);
  const entityType = clean(input.entityType);
  const country = clean(input.country);
  const atlasBits = [
    activity ? `actividade: ${activity}` : '',
    sector && sector !== activity ? `sector: ${sector}` : '',
    entityType ? `tipo: ${entityType}` : '',
    country ? `país: ${country}` : '',
  ].filter(Boolean);
  const atlas = atlasBits.length ? `ATLAS — ${atlasBits.join('; ')}.` : '';

  return [siep, atlas].filter(Boolean).join('\n');
}
