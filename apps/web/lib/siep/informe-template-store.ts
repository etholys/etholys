import { prisma } from '@/lib/prisma';
import { loadFileBuffer } from '@/lib/siep/file-storage';
import {
  detectCanvasFormat,
  parseReportTemplate,
  TEMPLATE_PARSE_VERSION,
} from '@/lib/siep/report-template-parse';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import {
  domainPackageTitle,
  isCustomInformeDomain,
  type InformeDomain,
} from '@/lib/siep/informe-domains';

export type InformeTemplateRow = {
  id: string;
  fileName: string;
  mimeType: string | null;
  cloudStoragePath: string;
  canvasFormat: string | null;
  canvasState: ReportCanvasState | null;
  validated: boolean;
  updatedAt: string;
};

type TemplateValidationJson = {
  canvasState?: ReportCanvasState;
  canvasFormat?: string;
  validatedAt?: string;
};

const TEMPLATE_CADENCE = 'template';

async function resolveDomainPackageTitle(projectId: string, domain: InformeDomain): Promise<string> {
  if (isCustomInformeDomain(domain)) {
    const meta = await prisma.mEReportPackage.findFirst({
      where: { projectId, domain, cadence: 'informe_domain', isActive: true },
      select: { title: true },
    });
    return domainPackageTitle(domain, meta?.title);
  }
  return domainPackageTitle(domain);
}

export async function getOrCreateTemplatePackage(projectId: string, domain: InformeDomain) {
  let pkg = await prisma.mEReportPackage.findFirst({
    where: { projectId, domain, cadence: TEMPLATE_CADENCE, isActive: true },
  });
  if (!pkg) {
    const title = await resolveDomainPackageTitle(projectId, domain);
    pkg = await prisma.mEReportPackage.create({
      data: {
        projectId,
        title,
        cadence: TEMPLATE_CADENCE,
        domain,
        status: 'active',
        donorFormat: 'generic',
      },
    });
  }
  return pkg;
}

function parseValidation(raw: unknown): TemplateValidationJson | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as TemplateValidationJson;
}

export async function listProjectInformeTemplates(
  projectId: string,
  domain: InformeDomain,
): Promise<InformeTemplateRow[]> {
  const files = await prisma.mEReportFile.findMany({
    where: {
      projectId,
      isActive: true,
      package: { cadence: TEMPLATE_CADENCE, domain, isActive: true },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return files.map((f) => {
    const v = parseValidation(f.aiValidation);
    return {
      id: f.id,
      fileName: f.fileName,
      mimeType: f.mimeType,
      cloudStoragePath: f.cloudStoragePath,
      canvasFormat: v?.canvasFormat ?? detectCanvasFormat(f.fileName, f.mimeType),
      canvasState: v?.canvasState ?? null,
      validated: Boolean(f.userConfirmed && v?.canvasState),
      updatedAt: f.updatedAt.toISOString(),
    };
  });
}

export async function getInformeTemplateFile(templateFileId: string, projectId: string) {
  return prisma.mEReportFile.findFirst({
    where: {
      id: templateFileId,
      projectId,
      isActive: true,
      package: { cadence: TEMPLATE_CADENCE, isActive: true },
    },
  });
}

export async function parseTemplateFromStorage(
  cloudStoragePath: string,
  fileName: string,
  templateFileId: string,
  mimeType?: string | null,
): Promise<ReportCanvasState> {
  const buffer = await loadFileBuffer(cloudStoragePath);
  return parseReportTemplate(buffer, fileName, templateFileId, mimeType);
}

export async function saveProjectInformeTemplate(input: {
  projectId: string;
  domain: InformeDomain;
  fileName: string;
  cloudStoragePath: string;
  mimeType?: string | null;
  fileSizeBytes?: number;
  canvasState: ReportCanvasState;
  canvasFormat: string;
  replaceFileId?: string;
}): Promise<InformeTemplateRow> {
  const pkg = await getOrCreateTemplatePackage(input.projectId, input.domain);
  const validation = {
    canvasState: input.canvasState,
    canvasFormat: input.canvasFormat,
    validatedAt: new Date().toISOString(),
  };

  let file;
  if (input.replaceFileId) {
    file = await prisma.mEReportFile.update({
      where: { id: input.replaceFileId },
      data: {
        fileName: input.fileName,
        cloudStoragePath: input.cloudStoragePath,
        mimeType: input.mimeType || null,
        fileSizeBytes: input.fileSizeBytes || 0,
        aiValidation: validation,
        userConfirmed: true,
      },
    });
  } else {
    file = await prisma.mEReportFile.create({
      data: {
        packageId: pkg.id,
        projectId: input.projectId,
        fileName: input.fileName,
        cloudStoragePath: input.cloudStoragePath,
        mimeType: input.mimeType || null,
        fileSizeBytes: input.fileSizeBytes || 0,
        component: input.domain === 'budget' ? 'financial' : 'narrative',
        cadence: TEMPLATE_CADENCE,
        aiValidation: validation,
        userConfirmed: true,
        order: 0,
      },
    });
  }

  return {
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    cloudStoragePath: file.cloudStoragePath,
    canvasFormat: input.canvasFormat,
    canvasState: input.canvasState,
    validated: true,
    updatedAt: file.updatedAt.toISOString(),
  };
}

export async function resolveTemplateForCreate(
  templateFileId: string,
  projectId: string,
): Promise<{
  fileName: string;
  cloudStoragePath: string;
  mimeType: string | null;
  fileSizeBytes: number;
  canvasState: ReportCanvasState;
  canvasFormat: string;
} | null> {
  const file = await getInformeTemplateFile(templateFileId, projectId);
  if (!file) return null;

  const v = parseValidation(file.aiValidation);
  if (v?.canvasState && v.canvasFormat && v.canvasState.parseVersion === TEMPLATE_PARSE_VERSION) {
    return {
      fileName: file.fileName,
      cloudStoragePath: file.cloudStoragePath,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      canvasState: v.canvasState,
      canvasFormat: v.canvasFormat,
    };
  }

  const canvasFormat = detectCanvasFormat(file.fileName, file.mimeType) || 'markdown';
  const canvasState = await parseTemplateFromStorage(
    file.cloudStoragePath,
    file.fileName,
    file.id,
    file.mimeType,
  );
  return {
    fileName: file.fileName,
    cloudStoragePath: file.cloudStoragePath,
    mimeType: file.mimeType,
    fileSizeBytes: file.fileSizeBytes,
    canvasState,
    canvasFormat,
  };
}

export async function copyTemplateFileToPackage(
  templateFileId: string,
  projectId: string,
  packageId: string,
  domain: InformeDomain,
) {
  const file = await getInformeTemplateFile(templateFileId, projectId);
  if (!file) throw new Error('Modelo não encontrado');

  return prisma.mEReportFile.create({
    data: {
      packageId,
      projectId,
      fileName: file.fileName,
      cloudStoragePath: file.cloudStoragePath,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      component: domain === 'budget' ? 'financial' : 'narrative',
      order: 0,
    },
  });
}
