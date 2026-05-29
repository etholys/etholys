import { getForgeDb } from '@/lib/forge/db';
import { getWebAppRoot } from '@/lib/prisma-app-root';
import { ForgeDiagnosticoPanel } from '@/components/forge/ForgeDiagnosticoPanel';

export const dynamic = 'force-dynamic';

export default async function ForgeDiagnosticoPage() {
  const webRoot = getWebAppRoot();
  const inDocker = webRoot === '/app' || process.cwd() === '/app';

  let ok = false;
  let forgeCourseCount = 0;
  let forgeDelegates: string[] = [];
  let error: string | null = null;

  try {
    const db = getForgeDb();
    forgeDelegates = Object.keys(db).filter((k) => k.startsWith('forge'));
    if (typeof db.forgeCourse?.findMany === 'function') {
      forgeCourseCount = await db.forgeCourse.count();
      ok = true;
    } else {
      error = 'Prisma sem delegate forgeCourse — corra prisma generate no contentor.';
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erro desconhecido';
  }

  return (
    <ForgeDiagnosticoPanel
      ok={ok}
      inDocker={inDocker}
      webRoot={webRoot}
      cwd={process.cwd()}
      forgeCourseCount={forgeCourseCount}
      forgeDelegates={forgeDelegates}
      error={error}
    />
  );
}
