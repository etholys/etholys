import { getForgeDb } from '../lib/forge/db';

async function main() {
  const db = getForgeDb();
  const count = await db.forgeCourse.count();
  console.log('forgeCourse.count:', count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => getForgeDb().$disconnect());
