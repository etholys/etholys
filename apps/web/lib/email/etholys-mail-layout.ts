/**
 * Layout HTML partilhado para emails Etholys (convites, marketing).
 * Tipografia: Syne (títulos) + Figtree (corpo) — mesmas fontes do app.
 * Cor: slate-900 / teal-600 (#0d9488) / emerald, como o painel do login.
 */

export type EtholysMailLocale = 'es' | 'pt' | 'en';

export type EtholysMailContent = {
  locale?: EtholysMailLocale;
  preheader?: string;
  headline: string;
  eyebrow?: string;
  paragraphs: string[];
  bullets?: string[];
  /** Secções com título (ex.: Sistemas / Herramientas) */
  sections?: { title: string; items: string[] }[];
  cta?: { label: string; href: string };
  codeBlock?: { label: string; value: string };
  note?: string;
  productLine?: string;
};

export const ETHOLYS_MAIL = {
  teal: '#0d9488',
  tealBright: '#2dd4bf',
  emerald: '#10b981',
  slate950: '#020617',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
} as const;

/** Nomes comerciais no Hub (não chaves de licença). */
export const RIKOLTO_ACCESS_COPY = {
  systems: [
    { key: 'ATLAS', label: 'ATLAS', blurbEs: 'Gestión empresarial (finanzas, RRHH, proveedores, clientes)' },
    { key: 'SIEP', label: 'SIEP', blurbEs: 'Gestión de proyectos, evidencias y seguimiento' },
    { key: 'FUNDHUB', label: 'FundHub', blurbEs: 'Captación de fondos y propuestas' },
    { key: 'AURORA', label: 'AURORA', blurbEs: 'Incubadora virtual y acompañamiento técnico' },
    { key: 'POLARIS', label: 'POLARIS', blurbEs: 'Línea base y guía de autodesarrollo' },
    { key: 'RADAR', label: 'RADAR', blurbEs: 'Digitalización productiva (datos, alertas, automatización)' },
  ],
  tools: [
    { key: 'studio', label: 'Studio', blurbEs: 'Documentos, diagramación y diseño con IA' },
    { key: 'work', label: 'Work', blurbEs: 'Gestor de tareas del equipo' },
    { key: 'chorus', label: 'Chorus', blurbEs: 'Reuniones, videollamadas, transcripción y grabación' },
  ],
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

function markCell(): string {
  return `
    <td width="44" valign="middle" style="padding:0;">
      <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#2dd4bf 0%,#10b981 100%);text-align:center;line-height:44px;color:#ffffff;font-family:Syne,Arial,Helvetica,sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.02em;">E</div>
    </td>`;
}

export function renderEtholysMailLayout(content: EtholysMailContent): string {
  const locale: EtholysMailLocale =
    content.locale === 'pt' || content.locale === 'en' ? content.locale : 'es';
  const preheader = escapeHtml(content.preheader || content.headline);
  const product = escapeHtml(content.productLine || 'Etholys');
  const factory = factoryLine(locale);
  const base = appBaseUrl();
  const fontSans = "Figtree,Arial,Helvetica,sans-serif";
  const fontDisplay = "Syne,Arial,Helvetica,sans-serif";

  const paragraphsHtml = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${fontSans};font-size:15px;line-height:1.6;color:${ETHOLYS_MAIL.slate600};">${escapeHtml(p)}</p>`,
    )
    .join('');

  const bulletsHtml =
    content.bullets && content.bullets.length > 0
      ? `<ul style="margin:0 0 20px;padding:0 0 0 18px;font-family:${fontSans};font-size:14px;line-height:1.65;color:${ETHOLYS_MAIL.slate600};">${content.bullets
          .map((b) => `<li style="margin:0 0 8px;">${escapeHtml(b)}</li>`)
          .join('')}</ul>`
      : '';

  const sectionsHtml = (content.sections || [])
    .map((sec) => {
      const items = sec.items
        .map(
          (item) =>
            `<tr><td style="padding:6px 0;font-family:${fontSans};font-size:14px;line-height:1.45;color:${ETHOLYS_MAIL.slate600};border-bottom:1px solid ${ETHOLYS_MAIL.border};">${escapeHtml(item)}</td></tr>`,
        )
        .join('');
      return `<p style="margin:20px 0 8px;font-family:${fontDisplay};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${ETHOLYS_MAIL.teal};">${escapeHtml(sec.title)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">${items}</table>`;
    })
    .join('');

  const ctaHtml = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 24px;">
        <tr>
          <td style="border-radius:10px;background:${ETHOLYS_MAIL.teal};">
            <a href="${escapeHtml(content.cta.href)}" style="display:inline-block;padding:14px 28px;font-family:${fontSans};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(content.cta.label)}</a>
          </td>
        </tr>
      </table>`
    : '';

  const codeHtml = content.codeBlock
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${ETHOLYS_MAIL.slate50};border-radius:12px;border:1px solid ${ETHOLYS_MAIL.border};">
        <tr>
          <td style="padding:18px 20px;text-align:center;">
            <p style="margin:0 0 8px;font-family:${fontSans};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${ETHOLYS_MAIL.slate500};">${escapeHtml(content.codeBlock.label)}</p>
            <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;letter-spacing:0.14em;color:${ETHOLYS_MAIL.teal};">${escapeHtml(content.codeBlock.value)}</p>
          </td>
        </tr>
      </table>`
    : '';

  const noteHtml = content.note
    ? `<p style="margin:0;font-family:${fontSans};font-size:12px;line-height:1.5;color:${ETHOLYS_MAIL.slate400};">${escapeHtml(content.note)}</p>`
    : '';

  const eyebrowHtml = content.eyebrow
    ? `<p style="margin:0 0 10px;font-family:${fontSans};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${ETHOLYS_MAIL.tealBright};">${escapeHtml(content.eyebrow)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.headline)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Syne:wght@600;700&display=swap" rel="stylesheet" />
  <!--[if mso]><style>*{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${ETHOLYS_MAIL.slate100};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ETHOLYS_MAIL.slate100};">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Header institucional (login Etholys) -->
          <tr>
            <td style="background:linear-gradient(135deg,${ETHOLYS_MAIL.slate900} 0%,${ETHOLYS_MAIL.slate800} 100%);border-radius:16px 16px 0 0;padding:28px 28px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  ${markCell()}
                  <td valign="middle" style="padding:0 0 0 14px;">
                    <p style="margin:0;font-family:${fontDisplay};font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#ffffff;">ETHOLYS</p>
                    <p style="margin:4px 0 0;font-family:${fontSans};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${ETHOLYS_MAIL.tealBright};">${factory}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Cartão -->
          <tr>
            <td style="background:${ETHOLYS_MAIL.white};border-left:1px solid ${ETHOLYS_MAIL.border};border-right:1px solid ${ETHOLYS_MAIL.border};padding:32px 28px 28px;">
              ${eyebrowHtml}
              <h1 style="margin:0 0 18px;font-family:${fontDisplay};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.03em;color:${ETHOLYS_MAIL.slate900};">${escapeHtml(content.headline)}</h1>
              ${paragraphsHtml}
              ${sectionsHtml}
              ${bulletsHtml}
              ${codeHtml}
              ${ctaHtml}
              ${noteHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:${ETHOLYS_MAIL.slate50};border:1px solid ${ETHOLYS_MAIL.border};border-top:0;border-radius:0 0 16px 16px;padding:20px 28px;text-align:center;">
              <p style="margin:0 0 4px;font-family:${fontSans};font-size:12px;color:${ETHOLYS_MAIL.slate500};">${product}</p>
              <p style="margin:0;font-family:${fontSans};font-size:11px;color:${ETHOLYS_MAIL.slate400};">
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
  inviteKind: 'employee' | 'temporary' | 'ally' | string;
  jobTitle?: string | null;
  projectName?: string | null;
  code: string;
  loginUrl: string;
  expiresDays?: number;
  /** Se true, lista sistemas/tools do pacote Rikolto (sem FORGE/PRISM/Advisor). */
  includeRikoltoCatalog?: boolean;
};

export function buildInvitationEmail(opts: InviteMailInput): { subject: string; html: string } {
  const locale: EtholysMailLocale =
    opts.locale === 'pt' || opts.locale === 'en' ? opts.locale : 'es';
  const days = opts.expiresDays ?? 7;
  const kind = opts.inviteKind || 'employee';

  const subject =
    locale === 'pt'
      ? `Convite para Etholys — ${opts.companyName}`
      : locale === 'en'
        ? `You're invited to Etholys — ${opts.companyName}`
        : `Te invitaron a Etholys — ${opts.companyName}`;

  const headline =
    locale === 'pt'
      ? 'Bem-vindo(a) ao Etholys'
      : locale === 'en'
        ? 'Welcome to Etholys'
        : 'Bienvenido/a a Etholys';

  const who = opts.inviterName?.trim() || (locale === 'en' ? 'Your team' : 'Tu equipo');

  let lead: string;
  if (locale === 'pt') {
    if (kind === 'ally') {
      lead = `${who} convidou-o(a) a colaborar em ${opts.companyName}${opts.projectName ? ` (projecto ${opts.projectName})` : ''}.`;
    } else if (kind === 'temporary') {
      lead = `${who} concedeu-lhe acesso temporário a Etholys na organização ${opts.companyName}.`;
    } else {
      lead = `${who} convidou-o(a) a entrar em Etholys com a organização ${opts.companyName}.`;
    }
  } else if (locale === 'en') {
    if (kind === 'ally') {
      lead = `${who} invited you to collaborate with ${opts.companyName}${opts.projectName ? ` on ${opts.projectName}` : ''}.`;
    } else if (kind === 'temporary') {
      lead = `${who} granted you temporary access to Etholys for ${opts.companyName}.`;
    } else {
      lead = `${who} invited you to join Etholys with ${opts.companyName}.`;
    }
  } else {
    if (kind === 'ally') {
      lead = `${who} te invitó a colaborar con ${opts.companyName}${opts.projectName ? ` en el proyecto ${opts.projectName}` : ''}.`;
    } else if (kind === 'temporary') {
      lead = `${who} te dio acceso temporal a Etholys en ${opts.companyName}.`;
    } else {
      lead = `${who} te invitó a unirte a Etholys con ${opts.companyName}.`;
    }
  }

  const paragraphs = [lead];
  if (opts.jobTitle?.trim()) {
    paragraphs.push(
      locale === 'pt'
        ? `O teu cargo: ${opts.jobTitle.trim()}.`
        : locale === 'en'
          ? `Your role: ${opts.jobTitle.trim()}.`
          : `Tu cargo: ${opts.jobTitle.trim()}.`,
    );
  }

  paragraphs.push(
    locale === 'pt'
      ? 'Activa a conta com o código abaixo. Se já tens conta Etholys, entra e usa o mesmo código.'
      : locale === 'en'
        ? 'Activate with the code below. If you already have an Etholys account, sign in and use the same code.'
        : 'Activa tu cuenta con el código de abajo. Si ya tienes cuenta Etholys, inicia sesión y usa el mismo código.',
  );

  const sections =
    opts.includeRikoltoCatalog || opts.companyName.toLowerCase().includes('rikolto')
      ? [
          {
            title: locale === 'pt' ? 'Sistemas' : locale === 'en' ? 'Systems' : 'Sistemas',
            items: RIKOLTO_ACCESS_COPY.systems.map((s) =>
              locale === 'en'
                ? `${s.label}`
                : locale === 'pt'
                  ? `${s.label}`
                  : `${s.label} — ${s.blurbEs}`,
            ),
          },
          {
            title: locale === 'pt' ? 'Ferramentas' : locale === 'en' ? 'Tools' : 'Herramientas',
            items: RIKOLTO_ACCESS_COPY.tools.map((t) =>
              locale === 'en' ? t.label : locale === 'pt' ? t.label : `${t.label} — ${t.blurbEs}`,
            ),
          },
        ]
      : undefined;

  const html = renderEtholysMailLayout({
    locale,
    preheader:
      locale === 'pt'
        ? `${who} convidou-te para ${opts.companyName} no Etholys`
        : locale === 'en'
          ? `${who} invited you to ${opts.companyName} on Etholys`
          : `${who} te invitó a ${opts.companyName} en Etholys`,
    eyebrow: opts.companyName,
    headline,
    paragraphs,
    sections,
    codeBlock: {
      label: locale === 'pt' ? 'O teu código' : locale === 'en' ? 'Your code' : 'Tu código',
      value: opts.code,
    },
    cta: {
      label: locale === 'pt' ? 'Activar acesso' : locale === 'en' ? 'Activate access' : 'Activar acceso',
      href: opts.loginUrl,
    },
    note:
      locale === 'pt'
        ? `Este convite é válido por ${days} dias.`
        : locale === 'en'
          ? `This invitation is valid for ${days} days.`
          : `Esta invitación es válida durante ${days} días.`,
    productLine: 'Etholys · Fábrica de Soluciones',
  });

  return { subject, html };
}

/** Email institucional de boas-vindas (grupo) — sem “piloto/espacio”. */
export function buildPilotWelcomeEmail(opts: {
  locale?: EtholysMailLocale;
  organizationName: string;
  contactName?: string | null;
  loginUrl: string;
}): { subject: string; html: string } {
  const locale: EtholysMailLocale =
    opts.locale === 'pt' || opts.locale === 'en' ? opts.locale : 'es';
  const org = opts.organizationName;
  const who = opts.contactName?.trim();

  const subject =
    locale === 'pt'
      ? `${org} × Etholys — o vosso acesso está pronto`
      : locale === 'en'
        ? `${org} × Etholys — your access is ready`
        : `${org} × Etholys — su acceso está listo`;

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
      ? `A ${org} já pode usar o Etholys: gestão da organização, projectos, captação de fundos e acompanhamento no terreno — num único login.`
      : locale === 'en'
        ? `${org} can now use Etholys: organization management, projects, fundraising, and field accompaniment — in one login.`
        : `${org} ya puede usar Etholys: gestión de la organización, proyectos, captación de fondos y acompañamiento en el terreno — en un solo inicio de sesión.`;

  const p2 =
    locale === 'pt'
      ? 'A equipa Etholys acompanha-vos na entrada. Cada pessoa activa a conta com o seu código individual.'
      : locale === 'en'
        ? 'The Etholys team will support onboarding. Each person activates with their own access code.'
        : 'El equipo Etholys les acompaña en la entrada. Cada persona activa su cuenta con su propio código.';

  const systemItems = RIKOLTO_ACCESS_COPY.systems.map((s) => `${s.label} — ${s.blurbEs}`);
  const toolItems = RIKOLTO_ACCESS_COPY.tools.map((t) => `${t.label} — ${t.blurbEs}`);

  const html = renderEtholysMailLayout({
    locale,
    preheader:
      locale === 'pt'
        ? `${org}: acesso Etholys pronto`
        : locale === 'en'
          ? `${org}: Etholys access ready`
          : `${org}: acceso Etholys listo`,
    eyebrow: org,
    headline:
      locale === 'pt'
        ? 'Bem-vindos ao Etholys'
        : locale === 'en'
          ? 'Welcome to Etholys'
          : 'Bienvenidos a Etholys',
    paragraphs: [greet, p1, p2],
    sections: [
      {
        title: locale === 'pt' ? 'Sistemas' : locale === 'en' ? 'Systems' : 'Sistemas',
        items: systemItems,
      },
      {
        title: locale === 'pt' ? 'Ferramentas' : locale === 'en' ? 'Tools' : 'Herramientas',
        items: toolItems,
      },
    ],
    cta: {
      label: locale === 'pt' ? 'Entrar no Etholys' : locale === 'en' ? 'Open Etholys' : 'Entrar a Etholys',
      href: opts.loginUrl,
    },
    note:
      locale === 'pt'
        ? 'Cada pessoa recebe um código individual por email. Se não chegou, peçam ao administrador ou à equipa Etholys.'
        : locale === 'en'
          ? 'Each person receives an individual access code by email. If it did not arrive, ask your admin or the Etholys team.'
          : 'Cada persona recibe un código individual por correo. Si no llegó, pídanlo al administrador o al equipo Etholys.',
    productLine: 'Etholys · Fábrica de Soluciones',
  });

  return { subject, html };
}
