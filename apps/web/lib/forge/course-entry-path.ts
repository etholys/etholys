import { parseDeliveryMode, showsLiveFeatures, type ForgeDeliveryMode } from '@/lib/forge/delivery';

/** Onde o aluno ou facilitador deve entrar no curso (sala única vs trilha). */
export function forgeCourseEntryPath(
  courseId: string,
  deliveryMode?: ForgeDeliveryMode | string | null
): string {
  const mode = parseDeliveryMode(deliveryMode);
  if (showsLiveFeatures(mode)) {
    return `/hub/forge/cursos/${courseId}/sala`;
  }
  return `/hub/forge/cursos/${courseId}`;
}

export function isForgeSalaPath(pathname: string): boolean {
  return /\/hub\/forge\/cursos\/[^/]+\/sala\/?$/.test(pathname);
}
