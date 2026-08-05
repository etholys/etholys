import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const MAX_PATH_LEN = 512;
const MAX_TEXT_BYTES = 1_500_000; // ~1.5MB texto por ficheiro no DB
const FORBIDDEN_PREFIXES = [
  'apps/web/',
  'apps/',
  'node_modules/',
  '.git/',
  '.env',
  'prisma/',
];

/** Normaliza path relativo do sandbox; rejeita traversal e monorepo. */
export function normalizeSandboxPath(raw: string): string {
  const trimmed = String(raw || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
  if (!trimmed) throw new Error('Path vazio');
  if (trimmed.length > MAX_PATH_LEN) throw new Error('Path demasiado longo');
  if (trimmed.includes('\0')) throw new Error('Path inválido');

  const parts = trimmed.split('/').filter(Boolean);
  if (parts.some((p) => p === '..' || p === '.')) {
    throw new Error('Path com traversal não permitido');
  }

  const path = parts.join('/');
  const lower = path.toLowerCase();
  for (const bad of FORBIDDEN_PREFIXES) {
    if (lower === bad.replace(/\/$/, '') || lower.startsWith(bad.toLowerCase())) {
      throw new Error(`Path bloqueado no sandbox: ${path}`);
    }
  }
  return path;
}

export function sha256Text(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    ts: 'text/plain; charset=utf-8',
    tsx: 'text/plain; charset=utf-8',
    jsx: 'text/plain; charset=utf-8',
    svg: 'image/svg+xml',
    xml: 'application/xml',
  };
  return map[ext] || 'text/plain; charset=utf-8';
}

export async function assertSandboxWorkspace(projectId: string) {
  const project = await prisma.labAnvilProject.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceKind: true, visibility: true, status: true },
  });
  if (!project || project.status === 'archived') {
    throw new Error('Projeto não encontrado');
  }
  if (project.workspaceKind !== 'sandbox') {
    throw new Error(
      `Sandbox de ficheiros só para workspaceKind=sandbox (actual: ${project.workspaceKind}). Monorepo = F4.`,
    );
  }
  return project;
}

export async function listProjectFiles(projectId: string) {
  return prisma.labAnvilFile.findMany({
    where: { projectId },
    select: {
      id: true,
      path: true,
      size: true,
      sha256: true,
      mimeType: true,
      updatedAt: true,
      updatedById: true,
    },
    orderBy: { path: 'asc' },
  });
}

export async function readProjectFile(projectId: string, rawPath: string) {
  const path = normalizeSandboxPath(rawPath);
  const file = await prisma.labAnvilFile.findUnique({
    where: { projectId_path: { projectId, path } },
  });
  if (!file) return null;
  return file;
}

export async function writeProjectFile(opts: {
  projectId: string;
  path: string;
  content: string;
  updatedById?: string;
}) {
  await assertSandboxWorkspace(opts.projectId);
  const path = normalizeSandboxPath(opts.path);
  const content = opts.content ?? '';
  const byteLen = Buffer.byteLength(content, 'utf8');
  if (byteLen > MAX_TEXT_BYTES) {
    throw new Error(`Ficheiro demasiado grande (>${MAX_TEXT_BYTES} bytes): ${path}`);
  }

  const sha256 = sha256Text(content);
  const mimeType = guessMime(path);

  return prisma.labAnvilFile.upsert({
    where: { projectId_path: { projectId: opts.projectId, path } },
    create: {
      projectId: opts.projectId,
      path,
      contentText: content,
      size: byteLen,
      sha256,
      mimeType,
      updatedById: opts.updatedById || null,
    },
    update: {
      contentText: content,
      size: byteLen,
      sha256,
      mimeType,
      updatedById: opts.updatedById || null,
      storageKey: null,
    },
  });
}

export async function deleteProjectFile(projectId: string, rawPath: string) {
  await assertSandboxWorkspace(projectId);
  const path = normalizeSandboxPath(rawPath);
  await prisma.labAnvilFile.deleteMany({ where: { projectId, path } });
  return { path };
}
