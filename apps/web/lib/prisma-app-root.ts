import fs from 'node:fs';
import path from 'node:path';

const MARKER = 'etholys-web';

/**
 * Diretório apps/web — usado para resolver @prisma/client em runtime no Next.
 * next.config.js define ETHOLYS_WEB_ROOT=__dirname; fallback procura package.json com name etholys-web.
 */
export function getWebAppRoot(): string {
  const fromEnv = process.env.ETHOLYS_WEB_ROOT?.trim();
  if (fromEnv && fs.existsSync(path.join(fromEnv, 'package.json'))) {
    return fromEnv;
  }

  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (pkg.name === MARKER) return dir;
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
}
