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

/** Nomes comerciais no Hub (não chaves de licença). Pacote piloto: sem FORGE / PRISM / Advisor. */
export const RIKOLTO_ACCESS_COPY = {
  systems: [
    {
      key: 'ATLAS',
      label: 'ATLAS',
      blurbEs:
        'gestión empresarial integral (planificación, finanzas, contabilidad, recursos humanos, proveedores, clientes e inventario)',
      blurbPt:
        'gestão empresarial integral (planejamento, finanças, contabilidade, recursos humanos, fornecedores, clientes e inventário)',
      blurbEn:
        'integrated business management (planning, finance, accounting, HR, suppliers, customers, and inventory)',
    },
    {
      key: 'SIEP',
      label: 'SIEP',
      blurbEs: 'gestión de proyectos (portafolio, ejecución, evidencias y seguimiento)',
      blurbPt: 'gestão de projetos (portfólio, execução, evidências e acompanhamento)',
      blurbEn: 'project management (portfolio, delivery, evidence, and follow-up)',
    },
    {
      key: 'FUNDHUB',
      label: 'FundHub',
      blurbEs: 'captación de fondos, seguimiento de convocatorias y elaboración de propuestas',
      blurbPt: 'captação de fundos, acompanhamento de editais e elaboração de propostas',
      blurbEn: 'fundraising, call tracking, and proposal drafting',
    },
    {
      key: 'AURORA',
      label: 'AURORA',
      blurbEs: 'incubadora virtual para el acompañamiento técnico al desarrollo de negocios',
      blurbPt: 'incubadora virtual para o acompanhamento técnico ao desenvolvimento de negócios',
      blurbEn: 'virtual incubator for technical support to business development',
    },
    {
      key: 'POLARIS',
      label: 'POLARIS',
      blurbEs: 'línea base de madurez organizacional y guía de autodesarrollo',
      blurbPt: 'linha de base de maturidade organizacional e guia de autodesenvolvimento',
      blurbEn: 'organizational maturity baseline and self-development guide',
    },
    {
      key: 'RADAR',
      label: 'RADAR',
      blurbEs: 'digitalización productiva con datos, alertas y automatización',
      blurbPt: 'digitalização produtiva com dados, alertas e automação',
      blurbEn: 'productive digitalization with data, alerts, and automation',
    },
  ],
  tools: [
    {
      key: 'studio',
      label: 'Studio',
      blurbEs: 'redacción y diagramación de documentos con apoyo de inteligencia artificial',
      blurbPt: 'redação e diagramação de documentos com apoio de inteligência artificial',
      blurbEn: 'document writing and layout with AI support',
    },
    {
      key: 'work',
      label: 'eTask',
      blurbEs: 'gestión de tareas y seguimiento del trabajo del equipo',
      blurbPt: 'gestão de tarefas e acompanhamento do trabalho da equipe',
      blurbEn: 'task management and team work tracking',
    },
    {
      key: 'chorus',
      label: 'Chorus',
      blurbEs: 'reuniones y videollamadas, con transcripción y grabación',
      blurbPt: 'reuniões e videochamadas, com transcrição e gravação',
      blurbEn: 'meetings and video calls, with transcription and recording',
    },
  ],
} as const;

function accessBlurb(
  item: { blurbEs: string; blurbPt: string; blurbEn: string },
  locale: EtholysMailLocale,
): string {
  if (locale === 'pt') return item.blurbPt;
  if (locale === 'en') return item.blurbEn;
  return item.blurbEs;
}

function pilotCatalogSections(locale: EtholysMailLocale): { title: string; items: string[] }[] {
  const systemsTitle = locale === 'pt' ? 'Sistemas' : locale === 'en' ? 'Systems' : 'Sistemas';
  const toolsTitle = locale === 'pt' ? 'Ferramentas' : locale === 'en' ? 'Tools' : 'Herramientas';
  return [
    {
      title: systemsTitle,
      items: RIKOLTO_ACCESS_COPY.systems.map((s) => `${s.label} — ${accessBlurb(s, locale)}`),
    },
    {
      title: toolsTitle,
      items: RIKOLTO_ACCESS_COPY.tools.map((t) => `${t.label} — ${accessBlurb(t, locale)}`),
    },
  ];
}

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
  /** Validez del código de invitación (días). */
  expiresDays?: number;
  /** Duración del acceso de la organización (meses). */
  accessMonths?: number;
  /** Si true, lista sistemas/herramientas del paquete institucional (sin FORGE/PRISM/Advisor). */
  includeRikoltoCatalog?: boolean;
  /** Alias preferido do catálogo piloto (mesmo pacote que Rikolto). */
  includePilotCatalog?: boolean;
};

export function buildInvitationEmail(opts: InviteMailInput): { subject: string; html: string } {
  const locale: EtholysMailLocale =
    opts.locale === 'pt' || opts.locale === 'en' ? opts.locale : 'es';
  const inviteDays = opts.expiresDays ?? 14;
  const accessMonths = opts.accessMonths ?? 6;
  const company = opts.companyName.trim();
  const showCatalog =
    opts.includePilotCatalog === true ||
    opts.includeRikoltoCatalog === true ||
    company.toLowerCase().includes('rikolto');

  const catalogSections = showCatalog ? pilotCatalogSections(locale) : undefined;

  if (locale === 'es') {
    const paragraphs: string[] = [
      'Etholys es un ecosistema digital que integra, en un único entorno de trabajo, la gestión empresarial, la ejecución de proyectos, la captación de fondos y el acompañamiento en el terreno.',
      `Con el fin de que usted pueda conocer mejor nuestro ecosistema digital, hemos habilitado para ${company} los productos que se detallan a continuación.`,
    ];
    if (opts.projectName?.trim() && opts.inviteKind === 'ally') {
      paragraphs.push(`Proyecto de colaboración: ${opts.projectName.trim()}.`);
    }
    paragraphs.push(
      'Para utilizarlos, pulse «Activar acceso». Si aún no tiene cuenta, la pantalla le pedirá crear una contraseña — no hay una contraseña previa. Si ya tiene cuenta Etholys, inicie sesión con la misma y el acceso se aplicará.',
    );
    paragraphs.push(
      `El acceso de ${company} permanecerá activo durante ${accessMonths} meses, con acompañamiento del equipo Etholys durante la puesta en marcha.`,
    );

    return {
      subject: `Bienvenido/a a Etholys — ${company}`,
      html: renderEtholysMailLayout({
        locale: 'es',
        preheader: `Bienvenido/a a Etholys — acceso habilitado para ${company}`,
        eyebrow: company,
        headline: 'Bienvenido/a a Etholys',
        paragraphs,
        sections: catalogSections,
        codeBlock: { label: 'Código de activación', value: opts.code },
        cta: { label: 'Activar acceso', href: opts.loginUrl },
        note: `Esta invitación personal es válida durante ${inviteDays} días. Si el correo no le corresponde, puede ignorarlo con seguridad.`,
        productLine: 'Etholys · Fábrica de Soluciones',
      }),
    };
  }

  const paragraphs =
    locale === 'pt'
      ? [
          'O Etholys é um ecossistema digital que integra, em um único ambiente de trabalho, a gestão empresarial, a execução de projetos, a captação de fundos e o acompanhamento em campo.',
          `Para que você possa conhecer melhor o nosso ecossistema digital, habilitamos para ${company} os produtos detalhados a seguir.`,
          ...(opts.projectName?.trim() && opts.inviteKind === 'ally'
            ? [`Projeto de colaboração: ${opts.projectName.trim()}.`]
            : []),
          'Para utilizá-los, use o botão «Ativar acesso». Se ainda não tem conta, o ecrã pede para criar uma senha — não há senha pré-definida. Se já tiver conta Etholys, entre com ela e o acesso será aplicado.',
          `O acesso de ${company} permanecerá ativo durante ${accessMonths} meses, com acompanhamento da equipe Etholys durante a entrada em operação.`,
        ]
      : [
          'Etholys is a digital ecosystem that brings together, in a single workspace, business management, project delivery, fundraising, and field accompaniment.',
          `So that you can explore our digital ecosystem, we have enabled the following products for ${company}.`,
          'To get started, use the “Activate access” button. If you do not have an account yet, the screen asks you to create a password — there is no preset password. If you already have an Etholys account, sign in and access will be applied.',
          `${company}'s access will remain active for ${accessMonths} months, with Etholys team support during onboarding.`,
        ];

  return {
    subject:
      locale === 'pt' ? `Bem-vindo(a) ao Etholys — ${company}` : `Welcome to Etholys — ${company}`,
    html: renderEtholysMailLayout({
      locale,
      preheader:
        locale === 'pt'
          ? `Bem-vindo(a) ao Etholys — acesso habilitado para ${company}`
          : `Welcome to Etholys — access for ${company}`,
      eyebrow: company,
      headline: locale === 'pt' ? 'Bem-vindo(a) ao Etholys' : 'Welcome to Etholys',
      paragraphs,
      sections: catalogSections,
      codeBlock: {
        label: locale === 'pt' ? 'Código de ativação' : 'Activation code',
        value: opts.code,
      },
      cta: {
        label: locale === 'pt' ? 'Ativar acesso' : 'Activate access',
        href: opts.loginUrl,
      },
      note:
        locale === 'pt'
          ? `Este convite pessoal é válido durante ${inviteDays} dias. Se este e-mail não for destinado a você, pode ignorá-lo com segurança.`
          : `This personal invitation is valid for ${inviteDays} days.`,
      productLine:
        locale === 'pt' ? 'Etholys · Fábrica de Soluções' : 'Etholys · Solutions Factory',
    }),
  };
}

/** Email institucional de boas-vindas (grupo). */
export function buildPilotWelcomeEmail(opts: {
  locale?: EtholysMailLocale;
  organizationName: string;
  contactName?: string | null;
  loginUrl: string;
  accessMonths?: number;
}): { subject: string; html: string } {
  const locale: EtholysMailLocale =
    opts.locale === 'pt' || opts.locale === 'en' ? opts.locale : 'es';
  const org = opts.organizationName;
  const months = opts.accessMonths ?? 6;
  const who = opts.contactName?.trim();

  if (locale === 'es') {
    const paragraphs = [
      who ? `Estimado/a ${who}:` : 'Estimado/a equipo:',
      'Etholys es un ecosistema digital que integra, en un único entorno de trabajo, la gestión empresarial, la ejecución de proyectos, la captación de fondos y el acompañamiento en el terreno.',
      `Con el fin de que ${org} pueda conocer mejor nuestro ecosistema digital, hemos habilitado los productos que se detallan a continuación.`,
      'Cada persona del equipo recibirá una invitación individual con su código de activación. Para comenzar, acceda a la plataforma e introduzca dicho código.',
      `El acceso de ${org} permanecerá activo durante ${months} meses, con acompañamiento del equipo Etholys durante la puesta en marcha.`,
    ];
    return {
      subject: `Bienvenidos a Etholys — ${org}`,
      html: renderEtholysMailLayout({
        locale: 'es',
        preheader: `Bienvenidos a Etholys — acceso habilitado para ${org}`,
        eyebrow: org,
        headline: 'Bienvenidos a Etholys',
        paragraphs,
        sections: pilotCatalogSections('es'),
        cta: { label: 'Entrar a Etholys', href: opts.loginUrl },
        note: 'Si no ha recibido su código individual, solicítelo al administrador de su organización o al equipo Etholys.',
        productLine: 'Etholys · Fábrica de Soluciones',
      }),
    };
  }

  const paragraphs =
    locale === 'pt'
      ? [
          who ? `Prezado(a) ${who},` : 'Prezada equipe,',
          'O Etholys é um ecossistema digital que integra, em um único ambiente de trabalho, a gestão empresarial, a execução de projetos, a captação de fundos e o acompanhamento em campo.',
          `Para que a ${org} possa conhecer melhor o nosso ecossistema digital, habilitamos os produtos detalhados a seguir.`,
          'Cada pessoa da equipe receberá um convite individual com o respectivo código de ativação. Para começar, acesse a plataforma e introduza esse código.',
          `O acesso de ${org} permanecerá ativo durante ${months} meses, com acompanhamento da equipe Etholys durante a entrada em operação.`,
        ]
      : [
          who ? `Dear ${who},` : 'Dear team,',
          'Etholys is a digital ecosystem for business management, projects, fundraising, and field accompaniment.',
          `We have enabled the following products for ${org}.`,
          `Each person receives an individual activation code. Access remains active for ${months} months.`,
        ];

  return {
    subject: locale === 'pt' ? `Bem-vindos ao Etholys — ${org}` : `Welcome to Etholys — ${org}`,
    html: renderEtholysMailLayout({
      locale,
      preheader:
        locale === 'pt'
          ? `Bem-vindos ao Etholys — acesso habilitado para ${org}`
          : `Welcome to Etholys — access for ${org}`,
      eyebrow: org,
      headline: locale === 'pt' ? 'Bem-vindos ao Etholys' : 'Welcome to Etholys',
      paragraphs,
      sections: pilotCatalogSections(locale),
      cta: {
        label: locale === 'pt' ? 'Entrar no Etholys' : 'Open Etholys',
        href: opts.loginUrl,
      },
      note:
        locale === 'pt'
          ? 'Se não recebeu o código individual, peça ao administrador da organização ou à equipe Etholys.'
          : 'If you did not receive your code, ask your admin or the Etholys team.',
      productLine:
        locale === 'pt' ? 'Etholys · Fábrica de Soluções' : 'Etholys · Solutions Factory',
    }),
  };
}
