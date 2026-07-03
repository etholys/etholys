import { PrismaClient } from '@prisma/client';



const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };



type PrismaRuntimeDmmf = {

  _runtimeDataModel?: {

    models: Record<string, { fields?: Array<{ name: string }> }>;

    enums?: Record<string, { values?: Array<{ name: string }> }>;

  };

};



function modelHasField(

  dmmf: PrismaRuntimeDmmf['_runtimeDataModel'],

  model: string,

  field: string,

): boolean {

  const fields = dmmf?.models?.[model]?.fields;

  return Array.isArray(fields) && fields.some((f) => f.name === field);

}



function prismaRuntimeReady(client: PrismaClient): boolean {

  if (typeof client.forgeCourse?.findMany !== 'function') return false;

  if (typeof client.projectReportGuide?.create !== 'function') return false;

  try {

    const dmmf = (client as unknown as PrismaRuntimeDmmf)._runtimeDataModel;

    if (!modelHasField(dmmf, 'ForgeEnrollment', 'inviteToken')) return false;

    if (!modelHasField(dmmf, 'ProjectReportGuide', 'domain')) return false;

    if (!modelHasField(dmmf, 'MEReportPackage', 'periodStart')) return false;

    if (!modelHasField(dmmf, 'MEReport', 'canvasState')) return false;

    return true;

  } catch {

    return false;

  }

}



function createPrismaClient(): PrismaClient {

  return new PrismaClient();

}



function resolvePrisma(): PrismaClient {

  const cached = globalForPrisma.prisma;

  if (cached && prismaRuntimeReady(cached)) return cached;



  if (cached) {

    delete globalForPrisma.prisma;

    void cached.$disconnect().catch(() => undefined);

  }



  const client = createPrismaClient();

  if (!prismaRuntimeReady(client) && process.env.NODE_ENV !== 'production') {

    console.warn(

      '[prisma] Client desatualizado (FORGE, informes ou ProjectReportGuide). Execute: cd apps/web && npm run dev:clean'

    );

  }



  globalForPrisma.prisma = client;

  return client;

}



export function getPrisma(): PrismaClient {

  return resolvePrisma();

}



export const prisma = getPrisma();

