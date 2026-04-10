/**
 * Remove apps/web/.next — útil quando o browser pede chunks antigos (404 em /_next/static).
 * Uso: node scripts/clean-next.cjs
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '.next');
try {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('Removed:', dir);
} catch (e) {
  if (e.code !== 'ENOENT') console.error(e);
}
