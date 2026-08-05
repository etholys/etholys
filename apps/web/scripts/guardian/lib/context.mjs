import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.sh',
  '.ps1',
  '.env',
  '.md',
  '.sql',
  '.prisma',
  '.conf',
  '.toml',
]);

const IGNORED_SEGMENTS = [
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  'coverage/',
  'old_version_temp/',
  '_docx_extract/',
  'test-results/',
  'playwright-report/',
  '.venv/',
];

function isIgnored(rel) {
  return IGNORED_SEGMENTS.some((seg) => rel.startsWith(seg) || rel.includes(`/${seg}`));
}

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** Converte apps/web/app/api/forge/courses/[id]/route.ts -> /api/forge/courses/[id] */
function routeFileToUrlPath(rel) {
  const marker = 'apps/web/app';
  const idx = rel.indexOf(marker);
  if (idx === -1) return null;
  let p = rel.slice(idx + marker.length).replace(/\/route\.ts$/, '');
  p = p.replace(/\/\([^/]+\)/g, ''); // route groups não entram na URL
  return p || '/';
}

function parseTenantModels(schema) {
  const tenantModels = new Set();
  const allModels = new Set();
  const modelBlocks = schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g);
  for (const match of modelBlocks) {
    const [, name, body] = match;
    allModels.add(name);
    if (/\bcompanyId\b/.test(body)) tenantModels.add(name);
  }
  return { tenantModels, allModels };
}

/** Prisma expõe o model User como prisma.user, ForgeCourse como prisma.forgeCourse. */
function delegateName(model) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/** Primitivas que provam, por si só, que o código valida quem está a chamar. */
const AUTH_PRIMITIVES =
  /getServerSession|getToken\s*\(|findShareByMagicToken|findEnrollmentByMagicToken|next-auth\/jwt|headers\.get\(\s*['"]authorization|WEBHOOK_SECRET|CRON_SECRET|INTERNAL_API_KEY/i;

/**
 * Nomes de funções que fazem sentido como guarda de acesso. Evita que um utilitário
 * puro exportado por um módulo que também tem auth conte como verificação.
 */
const GUARD_NAME =
  /^(?:require|assert|ensure|resolve|get|read|load|is|can|has|verify|check|with)\w*(?:Auth|Session|Tenant|Company|Access|Scope|Admin|Actor|Viewer|Member|Permission|Role|Owner|User|Token|Share|Guard|Context)\w*$/;

const EXPORTED_NAME = /export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g;

/**
 * Um módulo de lib é "auth-aware" se usar uma primitiva de autenticação ou se chamar
 * um guarda exportado por outro módulo auth-aware. Repete até estabilizar para apanhar
 * cadeias como route -> requireForgeTenant -> getUserCompanyIds -> getServerSession.
 */
function buildAuthAwareGuards(libFiles, read) {
  const exportsByFile = new Map();
  for (const rel of libFiles) {
    const content = read(rel);
    if (!content) continue;
    EXPORTED_NAME.lastIndex = 0;
    exportsByFile.set(rel, {
      content,
      exported: [...content.matchAll(EXPORTED_NAME)].map((m) => m[1]),
    });
  }

  const authAware = new Set();
  for (const [rel, { content }] of exportsByFile) {
    if (AUTH_PRIMITIVES.test(content)) authAware.add(rel);
  }

  const guards = new Set();
  const collectGuards = () => {
    for (const rel of authAware) {
      for (const name of exportsByFile.get(rel)?.exported ?? []) {
        if (GUARD_NAME.test(name)) guards.add(name);
      }
    }
  };
  collectGuards();

  for (let pass = 0; pass < 6; pass += 1) {
    let grew = false;
    for (const [rel, { content }] of exportsByFile) {
      if (authAware.has(rel)) continue;
      const usesGuard = [...guards].some((name) => new RegExp(`\\b${name}\\s*\\(`).test(content));
      if (usesGuard) {
        authAware.add(rel);
        grew = true;
      }
    }
    if (!grew) break;
    collectGuards();
  }

  return { authAware, guards };
}

export function createContext() {
  const repoRoot = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const tracked = git(repoRoot, ['ls-files', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'));

  const cache = new Map();
  const read = (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    let content = '';
    try {
      content = readFileSync(path.join(repoRoot, rel), 'utf8');
      if (content.includes('\u0000')) content = '';
    } catch {
      content = '';
    }
    cache.set(rel, content);
    return content;
  };

  /** Conteúdo tal como está no último commit (para segredos já removidos do disco). */
  const readFromGit = (rel) => {
    const key = `git:${rel}`;
    if (cache.has(key)) return cache.get(key);
    let content = '';
    try {
      content = git(repoRoot, ['show', `HEAD:${rel}`]);
    } catch {
      content = '';
    }
    cache.set(key, content);
    return content;
  };

  const scannable = tracked.filter(
    (rel) => !isIgnored(rel) && (SOURCE_EXTENSIONS.has(path.posix.extname(rel)) || rel.includes('.env')),
  );

  const apiRoutes = tracked
    .filter((rel) => /^apps\/web\/app\/api\/.+\/route\.ts$/.test(rel) && !isIgnored(rel))
    .map((rel) => ({ file: rel, urlPath: routeFileToUrlPath(rel) }));

  const schema = read('apps/web/prisma/schema.prisma');
  const { tenantModels, allModels } = parseTenantModels(schema);
  const tenantDelegates = new Map();
  for (const model of tenantModels) tenantDelegates.set(delegateName(model), model);

  const lineOf = (content, index) => content.slice(0, index).split('\n').length;

  const libFiles = tracked.filter(
    (rel) => rel.startsWith('apps/web/lib/') && /\.tsx?$/.test(rel) && !isIgnored(rel),
  );
  const { authAware: authAwareModules, guards: authGuardNames } = buildAuthAwareGuards(libFiles, read);

  return {
    repoRoot,
    tracked,
    scannable,
    apiRoutes,
    tenantModels,
    allModels,
    tenantDelegates,
    authAwareModules,
    authGuardNames,
    read,
    readFromGit,
    lineOf,
    isIgnored,
  };
}
