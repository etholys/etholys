import type { Locale } from '@/lib/i18n';
import type { ContentLocale } from '@/lib/siep/i18n';

const LANG_NAMES: Record<Locale, string> = {
  es: 'español',
  pt: 'portugués',
  en: 'inglés',
};

/** Instrução para o prompt de importação — evita mistura de idiomas no JSON extraído. */
export function buildSourceLanguageInstruction(source: ContentLocale): string {
  if (source === 'auto') {
    return `IDIOMA DEL CONTENIDO (auto):
- Detecta el idioma predominante de los documentos fuente.
- Devuelve en "contentLocale" el código detectado: "es", "pt" o "en".
- TODOS los campos de texto del JSON (title, description, name, narrative, items[], content, impact, mitigation) deben estar en UN SOLO idioma — el predominante del documento.
- NO mezcles español, portugués e inglés en la misma respuesta.
- Copia textual; NO traduzcas entre idiomas.`;
  }
  const name = LANG_NAMES[source];
  return `IDIOMA DEL CONTENIDO (declarado: ${name}):
- El usuario declaró que los documentos están principalmente en ${name}.
- Devuelve "contentLocale": "${source}".
- TODOS los campos de texto extraídos deben estar en ${name}, de forma consistente.
- Copia textual del documento; NO traduzcas a otro idioma. NO mezcles idiomas en el JSON.`;
}

export function resolveStoredContentLocale(
  declared: ContentLocale,
  detected?: string | null,
  fallback: Locale = 'es',
): Locale {
  if (declared !== 'auto') return declared;
  if (detected === 'es' || detected === 'pt' || detected === 'en') return detected;
  return fallback;
}
