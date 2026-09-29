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
  systemsLabel: 'ATLAS, SIEP, FundHub, AURORA, POLARIS, RADAR',
  jobTitle: 'Coordinación de proyectos',
  code: 'RIK7A2C9',
  loginUrl: 'https://app.etholys.com/login?invite=RIK7A2C9',
  expiresDays: 14,
  pilotNote:
    'Forman parte del acceso institucional Rikolto × Etholys. El equipo Etholys acompaña la puesta en marcha.',
});

const welcome = buildPilotWelcomeEmail({
  locale: 'es',
  organizationName: 'Rikolto',
  contactName: 'equipo',
  loginUrl: 'https://app.etholys.com/login',
});

writeFileSync(join(outDir, 'rikolto-invite.html'), invite.html, 'utf8');
writeFileSync(join(outDir, 'rikolto-pilot-group.html'), welcome.html, 'utf8');

console.log('Wrote:');
console.log(' ', join(outDir, 'rikolto-invite.html'));
console.log(' ', join(outDir, 'rikolto-pilot-group.html'));
console.log('Subject invite:', invite.subject);
console.log('Subject welcome:', welcome.subject);
