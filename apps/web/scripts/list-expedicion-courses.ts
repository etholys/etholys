import { getForgeDb } from '../lib/forge/db';
import { resolveMeetingUrl } from '../lib/forge/delivery';
import { parseLiveConfig } from '../lib/forge/delivery';

async function main() {
  const db = getForgeDb();
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  const courses = await db.forgeCourse.findMany({
    where: { title: 'La Expedición Sostenible' },
    select: { id: true, status: true, cohortMode: true, liveConfig: true, company: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  for (const c of courses) {
    const live = parseLiveConfig(c.liveConfig);
    const jitsiLearner = resolveMeetingUrl(live, c.id, 'learner');
    const jitsiFac = resolveMeetingUrl(live, c.id, 'facilitator');
    console.log(`\n${c.company.name}`);
    console.log(`  status: ${c.status} | cohort: ${c.cohortMode}`);
    console.log(`  curso: ${base}/hub/forge/cursos/${c.id}`);
    console.log(`  salón: ${base}/hub/forge/cursos/${c.id}/salon`);
    console.log(`  Jitsi alunos: ${jitsiLearner}`);
    console.log(`  Jitsi facilitador: ${jitsiFac}`);
  }
}

main()
  .catch(console.error)
  .finally(() => getForgeDb().$disconnect());
