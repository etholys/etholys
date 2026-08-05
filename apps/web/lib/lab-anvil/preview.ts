import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { assertSandboxWorkspace, listProjectFiles, readProjectFile } from './sandbox-fs';

export type PreviewConfig = {
  token: string;
  builtAt?: string;
  fileCount?: number;
  entry?: string;
};

function parseConfig(raw: unknown): PreviewConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.token !== 'string' || !o.token) return null;
  return {
    token: o.token,
    builtAt: typeof o.builtAt === 'string' ? o.builtAt : undefined,
    fileCount: typeof o.fileCount === 'number' ? o.fileCount : undefined,
    entry: typeof o.entry === 'string' ? o.entry : undefined,
  };
}

export function previewPublicPath(token: string, filePath = ''): string {
  const base = `/api/lab/anvil/preview/${token}`;
  if (!filePath || filePath === 'index.html') return base;
  return `${base}/${filePath.split('/').map(encodeURIComponent).join('/')}`;
}

/** Publica / actualiza preview: gera token no target preview e marca live. */
export async function buildSandboxPreview(opts: {
  projectId: string;
  baseUrl?: string;
}) {
  await assertSandboxWorkspace(opts.projectId);

  const files = await listProjectFiles(opts.projectId);
  if (files.length === 0) {
    throw new Error('Sandbox vazio — escreve ficheiros antes do preview');
  }

  let target = await prisma.labAnvilDeployTarget.findFirst({
    where: { projectId: opts.projectId, kind: 'preview' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  if (!target) {
    target = await prisma.labAnvilDeployTarget.create({
      data: {
        projectId: opts.projectId,
        kind: 'preview',
        label: 'Preview',
        isDefault: true,
        status: 'deploying',
      },
    });
  }

  const existing = parseConfig(target.configJson);
  const token = existing?.token || randomBytes(18).toString('hex');
  const entry = files.some((f) => f.path === 'index.html')
    ? 'index.html'
    : files[0]?.path || 'index.html';

  const config: PreviewConfig = {
    token,
    builtAt: new Date().toISOString(),
    fileCount: files.length,
    entry,
  };

  const updated = await prisma.labAnvilDeployTarget.update({
    where: { id: target.id },
    data: {
      status: 'live',
      configJson: config,
    },
  });

  const path = previewPublicPath(token, entry === 'index.html' ? '' : entry);
  const absoluteUrl = opts.baseUrl ? `${opts.baseUrl.replace(/\/$/, '')}${path}` : path;

  return {
    target: updated,
    token,
    url: absoluteUrl,
    path,
    entry,
    fileCount: files.length,
  };
}

export async function resolvePreviewByToken(token: string) {
  if (!token || token.length < 16) return null;

  const targets = await prisma.labAnvilDeployTarget.findMany({
    where: { kind: 'preview', status: { in: ['live', 'ready', 'deploying'] } },
    include: {
      project: { select: { id: true, workspaceKind: true, status: true } },
    },
    take: 200,
  });

  for (const t of targets) {
    const cfg = parseConfig(t.configJson);
    if (cfg?.token === token && t.project.status !== 'archived') {
      return { target: t, config: cfg, projectId: t.projectId };
    }
  }
  return null;
}

export async function servePreviewFile(projectId: string, rawPath: string) {
  const path =
    !rawPath || rawPath === '/' || rawPath === ''
      ? 'index.html'
      : rawPath.replace(/^\/+/, '');

  let file = await readProjectFile(projectId, path);
  if (!file && path === 'index.html') {
    const listing = await listProjectFiles(projectId);
    const fallback = listing[0];
    if (fallback) file = await readProjectFile(projectId, fallback.path);
  }
  return file;
}

export function etagForContent(content: string): string {
  return `"${createHash('sha1').update(content, 'utf8').digest('hex')}"`;
}
