/**
 * Layout HTML partilhado para emails Etholys (convites, Meet, marketing).
 * Visual alinhado ao login/Hub: slate profundo + teal #0d9488, superfícies planas.
 * Tabelas + CSS inline — compatível com clientes de email.
 */

export type EtholysMailLocale = 'es' | 'pt' | 'en';

export type EtholysMailContent = {
  locale?: EtholysMailLocale;
  /** Pré-cabeçalho (inbox preview) */
  preheader?: string;
  /** Título principal no cartão */
  headline: string;
  /** Linha de apoio sob o título (ex.: nome da organização) */
  eyebrow?: string;
  /** Parágrafos HTML já escapados ou texto simples (escapamos nós) */
  paragraphs: string[];
  /** Lista de bullets opcional */
  bullets?: string[];
  cta?: { label: string; href: string };
  /** Bloco destaque (código de convite, etc.) */
  codeBlock?: { label: string; value: string };
  /** Nota fina no fundo do cartão */
  note?: string;
  /** Remetente / produto (rodapé) */
  productLine?: string;
};

export const ETHOLYS_MAIL = {
  teal: '#0d9488',
  tealDark: '#0f766e',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate100: '#f1f5f9',
  white: '#ffffff',
  border: '#e2e8f0',
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function factoryLine(locale: EtholysMailLocale): string {
  if (locale === 'pt') return 'Fábrica de Soluções';
  if (locale === 'en') return 'Solutions Factory';
  return 'Fábrica de Soluciones';
}

function appBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.etholys.com'
  ).replace(/\/$/, '');
}

/** Marca SVG inline (gradiente teal) — funciona em muitos clientes. */
function markCell(): string {
  return `
    <td width="40" valign="middle" style="padding:0;">
      <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#2dd4bf,#0d9488);text-align:center;line-height:40px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:18px;">E</div>
    </td>`;
}

/**
 * Envelope institucional Etholys — header escuro + cartão branco + footer.
 */
export function renderEtholysMailLayout(content: EtholysMailContent): string {
  const locale: EtholysMailLocale =
    content.locale === 'pt' || content.locale === 'en' ? content.locale : 'es';
  const preheader = escapeHtml(content.preheader || content.headline);
  const product = escapeHtml(content.productLine || 'Etholys');
  const factory = factoryLine(locale);
  const base = appBaseUrl();

  const paragraphsHtml = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${ETHOLYS_MAIL.slate600};">${escapeHtml(p)}</p>`,
    )
    .join('');

  const bulletsHtml =
    content.bullets && content.bullets.length > 0
      ? `<ul style="margin:0 0 20px;padding:0 0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${ETHOLYS_MAIL.slate600};">${content.bullets
          .map((b) => `<li style="margin:0 0 6px;">${escapeHtml(b)}</li>`)
          .join('')}</ul>`
      : '';

  const ctaHtml = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
        <tr>
          <td style="border-radius:10px;background:${ETHOLYS_MAIL.teal};">
            <a href="${escapeHtml(content.cta.href)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(content.cta.label)}</a>
          </td>
        </tr>
      </table>`
    : '';

  const codeHtml = content.codeBlock
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${ETHOLYS_MAIL.slate100};border-radius:10px;border:1px solid ${ETHOLYS_MAIL.border};">
        <tr>
          <td style="padding:16px 18px;text-align:center;">
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${ETHOLYS_MAIL.slate500};">${escapeHtml(content.codeBlock.label)}</p>
            <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;letter-spacing:0.12em;color:${ETHOLYS_MAIL.teal};">${escapeHtml(content.codeBlock.value)}</p>
          </td>
        </tr>
      </table>`
    : '';

  const noteHtml = content.note
    ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${ETHOLYS_MAIL.slate400};">${escapeHtml(content.note)}</p>`
    : '';

  const eyebrowHtml = content.eyebrow
    ? `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${ETHOLYS_MAIL.teal};">${escapeHtml(content.eyebrow)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.headline)}</title>
</head>
<body style="margin:0;padding:0;background:${ETHOLYS_MAIL.slate100};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ETHOLYS_MAIL.slate100};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Header marca -->
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  ${markCell()}
                  <td valign="middle" style="padding:0 0 0 12px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${ETHOLYS_MAIL.slate900};">ETHOLYS</p>
                    <p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${ETHOLYS_MAIL.teal};">${factory}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Cartão -->
          <tr>
            <td style="background:${ETHOLYS_MAIL.white};border:1px solid ${ETHOLYS_MAIL.border};border-radius:16px;padding:32px 28px;">
              ${eyebrowHtml}
              <h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${ETHOLYS_MAIL.slate900};">${escapeHtml(content.headline)}</h1>
              ${paragraphsHtml}
              ${bulletsHtml}
              ${codeHtml}
              ${ctaHtml}
              ${noteHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px 0;text-align:center;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${ETHOLYS_MAIL.slate500};">${product}</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${ETHOLYS_MAIL.slate400};">
                <a href="${escapeHtml(base)}" style="color:${ETHOLYS_MAIL.teal};text-decoration:none;">${escapeHtml(base.replace(/^https?:\/\//, ''))}</a>
                &nbsp;·&nbsp;${factory}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type InviteMailInput = {
  locale?: EtholysMailLocale;
  inviterName: string;
  companyName: string;
  inviteKindLabel: string;
  systemsLabel: string;
  jobTitle?: string | null;
  projectName?: string | null;
  code: string;
  loginUrl: string;
  expiresDays?: number;
  /** Mensagem institucional (piloto / onboarding) */
  pilotNote?: string | null;
};

export function buildInvitationEmail(opts: InviteMailInput): { subject: string; html: string } {
  const locale: EtholysMailLocale =
    opts.locale === 'pt' || opts.locale === 'en' ? opts.locale : 'es';
  const days = opts.expiresDays ?? 7;

  const subject =
    locale === 'pt'
      ? `Convite Etholys — ${opts.companyName}`
      : locale === 'en'
        ? `Etholys invitation — ${opts.companyName}`
        : `Invitación Etholys — ${opts.companyName}`;

  const headline =
    locale === 'pt'
      ? 'Bem-vindo ao Etholys'
      : locale === 'en'
        ? 'Welcome to Etholys'
        : 'Bienvenida a Etholys';

  const p1 =
    locale === 'pt'
      ? `${opts.inviterName} convidou-o(a) como ${opts.inviteKindLabel} a usar ${opts.systemsLabel} em ${opts.companyName}.`
      : locale === 'en'
        ? `${opts.inviterName} invited you as ${opts.inviteKindLabel} to use ${opts.systemsLabel} at ${opts.companyName}.`
        : `${opts.inviterName} te invitó como ${opts.inviteKindLabel} a usar ${opts.systemsLabel} en ${opts.companyName}.`;

  const paragraphs = [p1];
  if (opts.jobTitle) {
    paragraphs.push(
      locale === 'pt'
        ? `Cargo: ${opts.jobTitle}`
        : locale === 'en'
          ? `Role: ${opts.jobTitle}`
          : `Cargo: ${opts.jobTitle}`,
    );
  }
  if (opts.projectName) {
    paragraphs.push(
      locale === 'pt'
        ? `Projecto: ${opts.projectName}`
        : locale === 'en'
          ? `Project: ${opts.projectName}`
          : `Proyecto: ${opts.projectName}`,
    );
  }
  if (opts.pilotNote) paragraphs.push(opts.pilotNote);

  paragraphs.push(
    locale === 'pt'
      ? 'O seu acesso é limitado aos sistemas atribuídos. Use o botão abaixo ou introduza o código no login.'
      : locale === 'en'
        ? 'Your access is limited to the assigned systems. Use the button below or enter the code at login.'
        : 'Tu acceso está limitado a los sistemas asignados. Usa el botón o introduce el código en el inicio de sesión.',
  );

  const html = renderEtholysMailLayout({
    locale,
    preheader:
      locale === 'pt'
        ? `Convite para ${opts.companyName} no Etholys`
        : locale === 'en'
          ? `Invitation to ${opts.companyName} on Etholys`
          : `Invitación a ${opts.companyName} en Etholys`,
    eyebrow: opts.companyName,
    headline,
    paragraphs,
    codeBlock: {
      label: locale === 'pt' ? 'Código de acesso' : locale === 'en' ? 'Access code' : 'Código de acceso',
      value: opts.code,
    },
    cta: {
      label: locale === 'pt' ? 'Activar acesso' : locale === 'en' ? 'Activate access' : 'Activar acceso',
      href: opts.loginUrl,
    },
    note:
      locale === 'pt'
        ? `Este convite expira em ${days} dias.`
        : locale === 'en'
          ? `This invitation expires in ${days} days.`
          : `Esta invitación expira en ${days} días.`,
    productLine: 'Etholys · Ecosistema digital',
  });

  return { subject, html };
}

/** Email de piloto institucional (grupo) — texto editorial. */
export function buildPilotWelcomeEmail(opts: {
  locale?: EtholysMailLocale;
  organizationName: string;
  contactName?: string | null;
  loginUrl: string;
  systems: string[];
}): { subject: string; html: string } {
  const locale: EtholysMailLocale =
    opts.locale === 'pt' || opts.locale === 'en' ? opts.locale : 'es';
  const org = opts.organizationName;
  const who = opts.contactName?.trim();

  const subject =
    locale === 'pt'
      ? `${org} × Etholys — acesso ao piloto`
      : locale === 'en'
        ? `${org} × Etholys — pilot access`
        : `${org} × Etholys — acceso al piloto`;

  const greet =
    locale === 'pt'
      ? who
        ? `Olá ${who},`
        : 'Olá,'
      : locale === 'en'
        ? who
          ? `Hello ${who},`
          : 'Hello,'
        : who
          ? `Hola ${who},`
          : 'Hola,';

  const p1 =
    locale === 'pt'
      ? `A ${org} foi convidada a experimentar o Etholys — o ecossistema digital para gestão de projectos, captação de fundos e formação integrada.`
      : locale === 'en'
        ? `${org} has been invited to try Etholys — the digital ecosystem for project management, fundraising, and integrated learning.`
        : `${org} ha sido invitada a probar Etholys — el ecosistema digital para gestión de proyectos, captación de fondos y formación integrada.`;

  const p2 =
    locale === 'pt'
      ? 'Durante este piloto terão acesso aos módulos acordados, com suporte da equipa Etholys. Tudo num único login.'
      : locale === 'en'
        ? 'During this pilot you will have access to the agreed modules, with Etholys team support. Everything in one login.'
        : 'Durante este piloto tendrán acceso a los módulos acordados, con apoyo del equipo Etholys. Todo en un solo inicio de sesión.';

  const bullets =
    opts.systems.length > 0
      ? opts.systems.map((s) => s)
      : locale === 'es'
        ? ['SIEP — proyectos', 'FUNDHUB — captación', 'FORGE — formación']
        : locale === 'pt'
          ? ['SIEP — projectos', 'FUNDHUB — captação', 'FORGE — formação']
          : ['SIEP — projects', 'FUNDHUB — fundraising', 'FORGE — learning'];

  const html = renderEtholysMailLayout({
    locale,
    preheader:
      locale === 'pt'
        ? `Piloto Etholys para ${org}`
        : locale === 'en'
          ? `Etholys pilot for ${org}`
          : `Piloto Etholys para ${org}`,
    eyebrow: org,
    headline:
      locale === 'pt'
        ? 'O vosso espaço de piloto está pronto'
        : locale === 'en'
          ? 'Your pilot workspace is ready'
          : 'Su espacio de piloto está listo',
    paragraphs: [greet, p1, p2],
    bullets,
    cta: {
      label:
        locale === 'pt' ? 'Entrar no Etholys' : locale === 'en' ? 'Open Etholys' : 'Entrar a Etholys',
      href: opts.loginUrl,
    },
    note:
      locale === 'pt'
        ? 'Se ainda não recebeu o código individual, peça-o ao administrador da organização ou à equipa Etholys.'
        : locale === 'en'
          ? 'If you have not received your personal access code, ask your organization admin or the Etholys team.'
          : 'Si aún no recibió su código individual, pídalo al administrador de la organización o al equipo Etholys.',
    productLine: 'Etholys · Piloto institucional',
  });

  return { subject, html };
}
