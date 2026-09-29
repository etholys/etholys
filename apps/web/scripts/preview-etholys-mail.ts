/**
 * Gera preview HTML estático do email institucional (validação visual).
 *   npx tsx scripts/preview-etholys-mail.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  buildInvitationEmail,
  buildPilotWelcomeEmail,
} from '../lib/email/etholys-mail-layout';

const outDir = join(process.cwd(), 'tmp', 'mail-previews');
mkdirSync(outDir, { recursive: true });

const invite = buildInvitationEmail({
  locale: 'es',
  inviterName: 'Equipo Etholys',
  companyName: 'Rikolto',
  inviteKindLabel: 'miembro',
  systemsLabel: 'ATLAS, SIEP, FUNDHUB, FORGE, NEXUS',
  jobTitle: 'Coordinación de proyectos',
  code: 'RIK7A2C9',
  loginUrl: 'https://app.etholys.com/login?invite=RIK7A2C9',
  expiresDays: 14,
  pilotNote:
    'Este acceso forma parte del piloto institucional Rikolto × Etholys. El equipo Etholys acompaña la puesta en marcha.',
});

const pilot = buildPilotWelcomeEmail({
  locale: 'es',
  organizationName: 'Rikolto',
  contactName: 'equipo',
  loginUrl: 'https://app.etholys.com/login',
  systems: [
    'SIEP — gestión de proyectos',
    'FUNDHUB — captación de fondos',
    'FORGE — formación y aprendizaje',
    'ATLAS — operaciones y finanzas',
    'NEXUS — asistencia a MIPYMEs',
  ],
});

writeFileSync(join(outDir, 'rikolto-invite.html'), invite.html, 'utf8');
writeFileSync(join(outDir, 'rikolto-pilot-group.html'), pilot.html, 'utf8');

console.log('Wrote:');
console.log(' ', join(outDir, 'rikolto-invite.html'));
console.log(' ', join(outDir, 'rikolto-pilot-group.html'));
console.log('Subject invite:', invite.subject);
console.log('Subject pilot:', pilot.subject);
