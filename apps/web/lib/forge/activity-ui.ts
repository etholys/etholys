/** Labels e estilos por tipo de atividade — e-learning, jogo ou híbrido na mesma trilha. */
export type ForgeActivityUiKind = 'lesson' | 'media' | 'quiz' | 'game' | 'live' | 'assignment' | 'forum' | string;

export function forgeActivityLabel(type: ForgeActivityUiKind, locale: 'pt' | 'es' | 'en' = 'es'): string {
  const map: Record<string, Record<string, string>> = {
    lesson: { pt: 'Aula', es: 'Aula', en: 'Lesson' },
    media: { pt: 'Vídeo', es: 'Vídeo', en: 'Media' },
    quiz: { pt: 'Quiz', es: 'Quiz', en: 'Quiz' },
    game: { pt: 'Jogo', es: 'Juego', en: 'Game' },
    live: { pt: 'Ao vivo', es: 'En vivo', en: 'Live' },
    assignment: { pt: 'Entrega', es: 'Entrega', en: 'Assignment' },
    forum: { pt: 'Fórum', es: 'Foro', en: 'Forum' },
  };
  return map[type]?.[locale] ?? type;
}

export function forgeActivityBadgeClass(type: ForgeActivityUiKind): string {
  switch (type) {
    case 'game':
      return 'bg-amber-100 text-amber-900 ring-amber-200';
    case 'quiz':
      return 'bg-sky-100 text-sky-900 ring-sky-200';
    case 'media':
      return 'bg-indigo-100 text-indigo-900 ring-indigo-200';
    case 'lesson':
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

/** Modo dominante do curso (para layout). */
export function inferCourseMode(activityTypes: string[]): 'elearning' | 'game' | 'hybrid' {
  const hasGame = activityTypes.includes('game');
  const hasLearn = activityTypes.some((t) => t === 'lesson' || t === 'media' || t === 'quiz');
  if (hasGame && hasLearn) return 'hybrid';
  if (hasGame) return 'game';
  return 'elearning';
}
