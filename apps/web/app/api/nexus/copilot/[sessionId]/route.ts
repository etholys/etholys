/**
 * Copiloto NEXUS — mesmo handler que /api/ai/advisor/[sessionId], rota dedicada para URLs e clientes
 * que só falam com sessões `kind: NEXUS_COPILOT`.
 */
export { GET, POST, DELETE } from '@/app/api/ai/advisor/[sessionId]/route';
