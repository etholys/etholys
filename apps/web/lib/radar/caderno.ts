/**
 * RADAR Caderno — production notebook helpers.
 * Same NexusFieldEntry model; labels differ by property moduleId.
 */
import {
  fieldEntryKindLabel,
  getSectorModule,
  type FieldEntryKind,
  type ModuleLocale,
} from '@/lib/nexus-sector-modules';
import { isFieldEntryKind } from '@/lib/nexus-ops-token';
import { radarT, type RadarLoc } from '@/lib/radar/i18n';

export type CadernoModuleId = 'agriculture' | 'agroindustry' | 'livestock' | 'carbon' | string | null;

export function cadernoKindsForModule(moduleId: CadernoModuleId): FieldEntryKind[] {
  const mod = getSectorModule(moduleId || 'agriculture');
  const kinds = mod.entryKinds.filter((k) => isFieldEntryKind(k));
  return kinds.length > 0 ? kinds : ['observation', 'note'];
}

export function cadernoKindLabel(kind: string, locale: ModuleLocale): string {
  if (isFieldEntryKind(kind)) return fieldEntryKindLabel(kind, locale);
  return kind;
}

/** Page title + subtitle by module (campo vs SOP/protocolo). */
export function cadernoCopy(moduleId: CadernoModuleId, loc: RadarLoc) {
  const id = String(moduleId || 'agriculture');
  if (id === 'agroindustry') {
    return {
      nav: radarT(loc, 'Caderno', 'Cuaderno', 'Notebook'),
      title: radarT(loc, 'Caderno de planta', 'Cuaderno de planta', 'Plant notebook'),
      subtitle: radarT(
        loc,
        'Protocolos e registos de execução — o que correu nesta linha.',
        'Protocolos y registros de ejecución — qué pasó en esta línea.',
        'SOPs and execution records — what ran on this line.',
      ),
      whatLabel: radarT(loc, 'O que fizeste', 'Qué hiciste', 'What you did'),
      protocolLabel: radarT(loc, 'Protocolo / SOP', 'Protocolo / SOP', 'Protocol / SOP'),
      protocolPlaceholder: radarT(
        loc,
        'ex.: Higiene diária, QC lote…',
        'ej.: Higiene diaria, QC lote…',
        'e.g. Daily hygiene, lot QC…',
      ),
      notesPlaceholder: radarT(
        loc,
        'Notas da corrida ou desvio…',
        'Notas de la corrida o desvío…',
        'Run notes or deviation…',
      ),
      empty: radarT(
        loc,
        'Ainda sem registos. Guarda a primeira execução em menos de 30 segundos.',
        'Aún sin registros. Guardá la primera ejecución en menos de 30 segundos.',
        'No records yet. Log the first run in under 30 seconds.',
      ),
      registerCta: radarT(loc, 'Registar no caderno', 'Registrar en el cuaderno', 'Log in notebook'),
    };
  }
  if (id === 'livestock') {
    return {
      nav: radarT(loc, 'Caderno', 'Cuaderno', 'Notebook'),
      title: radarT(loc, 'Caderno zootécnico', 'Cuaderno zootécnico', 'Herd notebook'),
      subtitle: radarT(
        loc,
        'Sanidade, alimentação e o que aconteceu no rebanho.',
        'Sanidad, alimentación y lo que pasó en el rebaño.',
        'Health, feed and what happened with the herd.',
      ),
      whatLabel: radarT(loc, 'O que fizeste', 'Qué hiciste', 'What you did'),
      protocolLabel: radarT(loc, 'Tratamento / protocolo', 'Tratamiento / protocolo', 'Treatment / protocol'),
      protocolPlaceholder: radarT(
        loc,
        'ex.: Vacina, desparasitação…',
        'ej.: Vacuna, desparasitación…',
        'e.g. Vaccine, deworming…',
      ),
      notesPlaceholder: radarT(
        loc,
        'Notas do curral ou lote…',
        'Notas del corral o lote…',
        'Pen or lot notes…',
      ),
      empty: radarT(
        loc,
        'Ainda sem linhas. Regista a primeira visita ao rebanho.',
        'Aún sin líneas. Registrá la primera visita al rebaño.',
        'No lines yet. Log the first herd visit.',
      ),
      registerCta: radarT(loc, 'Registar no caderno', 'Registrar en el cuaderno', 'Log in notebook'),
    };
  }
  // agriculture + carbon (carbon reads practices; still a simple notebook)
  return {
    nav: radarT(loc, 'Caderno', 'Cuaderno', 'Notebook'),
    title: radarT(loc, 'Caderno de campo', 'Cuaderno de campo', 'Field notebook'),
    subtitle: radarT(
      loc,
      'O que aconteceu na parcela — data, espaço, quem e notas.',
      'Qué pasó en la parcela — fecha, espacio, quién y notas.',
      'What happened on the plot — date, space, who and notes.',
    ),
    whatLabel: radarT(loc, 'O que fizeste', 'Qué hiciste', 'What you did'),
    protocolLabel: radarT(loc, 'Produto / dose', 'Producto / dosis', 'Product / dose'),
    protocolPlaceholder: radarT(loc, 'ex.: Ureia 50 kg', 'ej.: Urea 50 kg', 'e.g. Urea 50 kg'),
    notesPlaceholder: radarT(
      loc,
      'Notas do que viste ou fizeste…',
      'Notas de lo que viste o hiciste…',
      'Notes on what you saw or did…',
    ),
    empty: radarT(
      loc,
      'Ainda sem linhas. Regista a primeira ação em menos de 30 segundos.',
      'Aún sin líneas. Registrá la primera acción en menos de 30 segundos.',
      'No lines yet. Log the first action in under 30 seconds.',
    ),
    registerCta: radarT(loc, 'Registar no caderno', 'Registrar en el cuaderno', 'Log in notebook'),
  };
}

export function noteFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const row = payload as {
    note?: unknown;
    text?: unknown;
    product?: unknown;
    protocol?: unknown;
    dose?: unknown;
    mm?: unknown;
  };
  const note = String(row.note || row.text || '').trim();
  if (note) return note;
  const bits = [
    row.protocol ? String(row.protocol) : '',
    row.product ? String(row.product) : '',
    row.dose ? String(row.dose) : '',
    row.mm != null ? `${row.mm} mm` : '',
  ].filter(Boolean);
  return bits.join(' · ');
}
