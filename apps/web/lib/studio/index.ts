export * from '@/lib/studio/types';
export * from '@/lib/studio/templates';
export {
  STUDIO_ECOSYSTEM_CATALOG,
  buildStudioSystemPrompt,
  parseStudioCopilotJson,
} from '@/lib/studio/agent';
export {
  resolveStudioCompanyId,
  studioCatalogForCompany,
  loadApprovedStudioContext,
} from '@/lib/studio/access';
export { getStudioBrandKit, saveStudioBrandKit } from '@/lib/studio/brand';
export {
  DEFAULT_STUDIO_BRAND,
  studioCanvasToHtml,
  studioCanvasToDocxBuffer,
  htmlToPdfViaAbacus,
  type StudioBrandKit,
} from '@/lib/studio/export';
export {
  canCreateStudioContent,
  canDeleteStudioDocument,
  canDeleteStudioItem,
  canEditStudioContent,
  canManageStudioShares,
  canRenameStudio,
  canReadStudio,
  createStudioShare,
  getDocumentAccess,
  getFolderAccess,
  listActiveStudioShareTargets,
  parseStudioShareRole,
  resolveStudioJwtScope,
  updateStudioShareRole,
  type AccessLevel,
  type StudioShareRole,
} from '@/lib/studio/share';
