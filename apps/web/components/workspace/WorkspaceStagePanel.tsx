'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  HandCoins,
  ListTodo,
  Package,
  PenLine,
  Radar,
  Sprout,
  Sunrise,
  Target,
  Video,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkspaceRailId } from '@/lib/workspace-rails';
import { sysTheme, type SystemAccent } from '@/lib/system-shell';

export type OverviewPayload = {
  meta?: { freshAt: string };
  company?: { name: string; shortName: string; currency: string };
  access: { systems: string[] };
  tools?: { work?: boolean; meet?: boolean; studio?: boolean };
  blocks: {
    ATLAS: {
      balance: number;
      currency: string;
      incomeTotal: number;
      expenseTotal: number;
      tasksOpen: Array<{
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        projectId: string | null;
        project: { id: string; name: string } | null;
      }>;
      invoicesOverdue: number;
      purchaseOrdersInFlight: number;
      productsLowStock: number;
      links: { dashboard: string; invoices: string; inventory: string; suppliers: string };
    } | null;
    SIEP: {
      projects: Array<{ id: string; name: string; status: string; progress: number; href: string }>;
      projectTasks?: Array<{ id: string; title: string; status: string; projectId: string }>;
      siepDeadlines?: Array<{ id: string; name: string; endDate: string; href: string; overdue: boolean }>;
      link: string;
    } | null;
    FUNDHUB: {
      proposals: Array<{ id: string; title: string; status: string; editorHref: string }>;
      link: string;
      proposalsList: string;
      discovery: {
        id: string;
        status: string;
        startedAt: string;
        finishedAt: string | null;
        scanned: number;
        created: number;
        updated: number;
        errorCount: number;
        link: string;
      } | null;
    } | null;
    NEXUS: {
      networkCount: number;
      pendingRoadmap: number;
      link: string;
      networksLink: string;
      roadmapLink: string;
      AURORA?: {
        engagements: Array<{ id: string; status: string; name: string; href: string }>;
        link: string;
      };
      POLARIS?: {
        hasBaseline: boolean;
        updatedAt: string | null;
        link: string;
        diagnosisLink: string;
      };
      RADAR?: {
        modules: Array<{ id: string; label: string; href: string }> | null;
        link: string;
      };
    } | null;
    FORGE: {
      courses?: Array<{ id: string; title: string; status: string; href: string }>;
      link: string;
    } | null;
    PRISM: { link: string; note?: string } | null;
    WORK?: {
      tasks: Array<{ id: string; title: string; status: string; dueDate: string | null; mine: boolean }>;
      link: string;
    } | null;
    MEET?: {
      sessions: Array<{
        id: string;
        title: string;
        status: string;
        scheduledAt: string | null;
        href: string;
        isPermanent: boolean;
      }>;
      link: string;
    } | null;
    STUDIO?: {
      documents: Array<{ id: string; title: string; status: string; format: string; href: string }>;
      link: string;
    } | null;
  };
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    link?: string | null;
    type?: string;
  }>;
  advisor?: {
    alerts: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      message: string;
      read: boolean;
      link: string | null;
      createdAt: string;
    }>;
  };
};

const PANEL =
  'rounded-xl border border-[color:var(--sys-line,rgba(255,255,255,0.1))] bg-[color:var(--sys-panel,rgba(255,255,255,0.04))]';
const ROW =
  'flex items-start justify-between gap-2 rounded-lg border border-[color:var(--sys-line,rgba(255,255,255,0.08))] bg-white/[0.03] px-2.5 py-2';
const MUTED = 'text-[color:var(--sys-muted,rgba(255,255,255,0.55))]';
const INK = 'text-[color:var(--sys-ink,#E8EEF2)]';

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

function StageShell({
  title,
  icon,
  accent,
  openHref,
  openLabel,
  children,
}: {
  title: string;
  icon: ReactNode;
  accent: SystemAccent;
  openHref: string;
  openLabel: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(PANEL, 'flex h-full min-h-[280px] flex-col overflow-hidden')}>
      <div
        className="flex items-center justify-between gap-3 border-b border-[color:var(--sys-line,rgba(255,255,255,0.1))] px-4 py-3"
        style={{ boxShadow: `inset 3px 0 0 0 var(--rail-accent, rgb(45 212 191))` }}
        data-accent={accent}
      >
        <h2 className={cn('flex items-center gap-2 font-[family-name:var(--font-etholys-display)] text-sm font-semibold tracking-wide', INK)}>
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', sysTheme.icon[accent])}>
            {icon}
          </span>
          {title}
        </h2>
        <Link
          href={openHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-300/90 hover:text-teal-200"
        >
          {openLabel}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">{children}</div>
    </section>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className={cn('text-sm', MUTED)}>{children}</p>;
}

type StageProps = {
  overview: OverviewPayload;
  locale: string;
  saving: string | null;
  onMarkTaskDone: (id: string) => void;
  t: (pt: string, es: string, en: string) => string;
};

export function WorkspaceStagePanel({
  railId,
  overview,
  locale,
  saving,
  onMarkTaskDone,
  t,
}: StageProps & { railId: WorkspaceRailId }) {
  const open = (name: string) =>
    locale === 'pt' ? `Abrir ${name}` : locale === 'es' ? `Abrir ${name}` : `Open ${name}`;

  if (railId === 'ATLAS') {
    const b = overview.blocks.ATLAS;
    if (!b) return null;
    return (
      <StageShell title="ATLAS" icon={<BarChart3 className="h-3.5 w-3.5" />} accent="teal" openHref={b.links.dashboard} openLabel={open('ATLAS')}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={ROW + ' flex-col items-center'}>
            <span className={cn('text-[10px] uppercase', MUTED)}>{t('Saldo', 'Saldo', 'Balance')}</span>
            <span className={cn('text-sm font-semibold', INK)}>{money(b.balance, b.currency)}</span>
          </div>
          <div className={ROW + ' flex-col items-center'}>
            <span className={cn('text-[10px] uppercase', MUTED)}>{t('Receitas', 'Ingresos', 'Income')}</span>
            <span className={cn('text-sm font-semibold text-teal-300', INK)}>{money(b.incomeTotal, b.currency)}</span>
          </div>
          <div className={ROW + ' flex-col items-center'}>
            <span className={cn('text-[10px] uppercase', MUTED)}>{t('Despesas', 'Gastos', 'Expenses')}</span>
            <span className={cn('text-sm font-semibold', INK)}>{money(b.expenseTotal, b.currency)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {b.invoicesOverdue > 0 && (
            <Link href={b.links.invoices} className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-amber-200">
              <AlertTriangle className="h-3 w-3" />
              {b.invoicesOverdue} {t('faturas em atraso', 'facturas vencidas', 'overdue invoices')}
            </Link>
          )}
          {b.productsLowStock > 0 && (
            <Link href={b.links.inventory} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/70">
              <Package className="h-3 w-3" />
              {b.productsLowStock} {t('stock baixo', 'stock bajo', 'low stock')}
            </Link>
          )}
        </div>
        <div>
          <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', MUTED)}>
            {t('Tarefas abertas', 'Tareas abiertas', 'Open tasks')}
          </p>
          {b.tasksOpen.length === 0 ? (
            <EmptyHint>{t('Sem tarefas abertas.', 'Sin tareas abiertas.', 'No open tasks.')}</EmptyHint>
          ) : (
            <ul className="space-y-1.5">
              {b.tasksOpen.slice(0, 5).map((task) => (
                <li key={task.id} className={ROW}>
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm', INK)}>{task.title}</p>
                    {task.project ? (
                      <p className={cn('truncate text-[11px]', MUTED)}>{task.project.name}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={saving === task.id}
                    onClick={() => onMarkTaskDone(task.id)}
                    className="shrink-0 rounded-md p-1 text-teal-300/80 hover:bg-teal-500/15 hover:text-teal-200 disabled:opacity-50"
                    title={t('Concluir', 'Completar', 'Complete')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </StageShell>
    );
  }

  if (railId === 'SIEP') {
    const b = overview.blocks.SIEP;
    if (!b) return null;
    return (
      <StageShell title="SIEP" icon={<Sprout className="h-3.5 w-3.5" />} accent="indigo" openHref={b.link} openLabel={open('SIEP')}>
        {b.projects.length === 0 ? (
          <EmptyHint>
            {t('Ainda não há projectos.', 'Aún no hay proyectos.', 'No projects yet.')}{' '}
            <Link href={b.link} className="text-teal-300 hover:underline">
              {t('Criar no SIEP', 'Crear en SIEP', 'Create in SIEP')}
            </Link>
          </EmptyHint>
        ) : (
          <ul className="space-y-2">
            {b.projects.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link href={p.href} className={cn(ROW, 'transition hover:bg-white/[0.06]')}>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-medium', INK)}>{p.name}</p>
                    <p className={cn('text-[11px]', MUTED)}>
                      {p.status} · {Math.round(p.progress)}%
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-indigo-400/80" style={{ width: `${Math.min(100, p.progress)}%` }} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {b.projectTasks && b.projectTasks.length > 0 ? (
          <div>
            <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', MUTED)}>
              {t('Tarefas de projecto', 'Tareas de proyecto', 'Project tasks')}
            </p>
            <ul className="space-y-1.5">
              {b.projectTasks.slice(0, 3).map((task) => (
                <li key={task.id} className={ROW}>
                  <span className={cn('truncate text-sm', INK)}>{task.title}</span>
                  <button
                    type="button"
                    disabled={saving === task.id}
                    onClick={() => onMarkTaskDone(task.id)}
                    className="shrink-0 rounded-md p-1 text-teal-300/80 hover:bg-teal-500/15"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {b.siepDeadlines && b.siepDeadlines.length > 0 ? (
          <div>
            <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', MUTED)}>
              {t('Prazos', 'Plazos', 'Deadlines')}
            </p>
            <ul className="space-y-1">
              {b.siepDeadlines.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <Link href={d.href} className={cn('text-sm', d.overdue ? 'text-amber-300' : INK)}>
                    {d.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </StageShell>
    );
  }

  if (railId === 'FUNDHUB') {
    const b = overview.blocks.FUNDHUB;
    if (!b) return null;
    return (
      <StageShell title="FundHub" icon={<HandCoins className="h-3.5 w-3.5" />} accent="amber" openHref={b.link} openLabel={open('FundHub')}>
        {b.proposals.length === 0 ? (
          <EmptyHint>
            {t('Sem propostas recentes.', 'Sin propuestas recientes.', 'No recent proposals.')}{' '}
            <Link href={b.proposalsList} className="text-teal-300 hover:underline">
              {t('Ver pipeline', 'Ver pipeline', 'View pipeline')}
            </Link>
          </EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {b.proposals.map((p) => (
              <li key={p.id}>
                <Link href={p.editorHref} className={cn(ROW, 'transition hover:bg-white/[0.06]')}>
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-medium', INK)}>{p.title}</p>
                    <p className={cn('text-[11px]', MUTED)}>{p.status}</p>
                  </div>
                  <span className="shrink-0 text-xs text-amber-300">
                    {t('Continuar', 'Continuar', 'Continue')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {b.discovery ? (
          <Link href={b.discovery.link} className={cn(ROW, 'text-sm', MUTED)}>
            {t('Última descoberta', 'Último descubrimiento', 'Latest discovery')}: {b.discovery.status} ·{' '}
            {b.discovery.scanned} {t('varridos', 'escaneados', 'scanned')}
          </Link>
        ) : null}
      </StageShell>
    );
  }

  if (railId === 'AURORA') {
    const b = overview.blocks.NEXUS?.AURORA;
    if (!b) return null;
    return (
      <StageShell title="AURORA" icon={<Sunrise className="h-3.5 w-3.5" />} accent="amber" openHref={b.link} openLabel={open('AURORA')}>
        {b.engagements.length === 0 ? (
          <EmptyHint>
            {t('Sem negócios atendidos activos.', 'Sin negocios atendidos activos.', 'No active attended businesses.')}{' '}
            <Link href={b.link} className="text-teal-300 hover:underline">
              {t('Abrir carteira', 'Abrir cartera', 'Open portfolio')}
            </Link>
          </EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {b.engagements.map((e) => (
              <li key={e.id}>
                <Link href={e.href} className={cn(ROW, 'transition hover:bg-white/[0.06]')}>
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-medium', INK)}>{e.name}</p>
                    <p className={cn('text-[11px]', MUTED)}>{e.status}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StageShell>
    );
  }

  if (railId === 'POLARIS') {
    const b = overview.blocks.NEXUS?.POLARIS;
    if (!b) return null;
    return (
      <StageShell title="POLARIS" icon={<Compass className="h-3.5 w-3.5" />} accent="amber" openHref={b.link} openLabel={open('POLARIS')}>
        {b.hasBaseline ? (
          <div className={ROW}>
            <div>
              <p className={cn('text-sm font-medium', INK)}>
                {t('Linha base disponível', 'Línea base disponible', 'Baseline available')}
              </p>
              {b.updatedAt ? (
                <p className={cn('text-[11px]', MUTED)}>{new Date(b.updatedAt).toLocaleDateString()}</p>
              ) : null}
            </div>
            <Link href={b.diagnosisLink} className="text-xs text-teal-300 hover:underline">
              {t('Ver avanço', 'Ver avance', 'View progress')}
            </Link>
          </div>
        ) : (
          <EmptyHint>
            {t('Ainda sem linha base.', 'Aún sin línea base.', 'No baseline yet.')}{' '}
            <Link href={b.diagnosisLink} className="text-teal-300 hover:underline">
              {t('Iniciar no POLARIS', 'Iniciar en POLARIS', 'Start in POLARIS')}
            </Link>
          </EmptyHint>
        )}
      </StageShell>
    );
  }

  if (railId === 'RADAR') {
    const b = overview.blocks.NEXUS?.RADAR;
    if (!b) return null;
    return (
      <StageShell title="RADAR" icon={<Radar className="h-3.5 w-3.5" />} accent="amber" openHref={b.link} openLabel={open('RADAR')}>
        <p className={cn('text-sm', MUTED)}>
          {t('Módulos de digitalização produtiva', 'Módulos de digitalización productiva', 'Productive digitization modules')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(b.modules ?? []).map((m) => (
            <Link key={m.id} href={m.href} className={cn(ROW, 'justify-center text-sm font-medium', INK)}>
              {m.label}
            </Link>
          ))}
        </div>
      </StageShell>
    );
  }

  if (railId === 'FORGE') {
    const b = overview.blocks.FORGE;
    if (!b) return null;
    return (
      <StageShell title="FORGE" icon={<GraduationCap className="h-3.5 w-3.5" />} accent="violet" openHref={b.link} openLabel={open('FORGE')}>
        {!b.courses || b.courses.length === 0 ? (
          <EmptyHint>
            {t('Ainda não há cursos.', 'Aún no hay cursos.', 'No courses yet.')}{' '}
            <Link href={b.link} className="text-teal-300 hover:underline">
              {t('Criar no FORGE', 'Crear en FORGE', 'Create in FORGE')}
            </Link>
          </EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {b.courses.map((c) => (
              <li key={c.id}>
                <Link href={c.href} className={cn(ROW, 'transition hover:bg-white/[0.06]')}>
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-medium', INK)}>{c.title}</p>
                    <p className={cn('text-[11px]', MUTED)}>{c.status}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StageShell>
    );
  }

  if (railId === 'PRISM') {
    const b = overview.blocks.PRISM;
    if (!b) return null;
    return (
      <StageShell title="PRISM" icon={<Target className="h-3.5 w-3.5" />} accent="teal" openHref={b.link} openLabel={open('PRISM')}>
        <EmptyHint>
          {t(
            'Snapshot de impacto ainda não disponível neste cockpit — abra o PRISM para indicadores.',
            'El snapshot de impacto aún no está en este cockpit — abra PRISM para indicadores.',
            'Impact snapshot is not yet in this cockpit — open PRISM for indicators.',
          )}
        </EmptyHint>
        <Link href={b.link} className="inline-flex items-center gap-1 text-sm text-teal-300 hover:underline">
          {open('PRISM')}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </StageShell>
    );
  }

  if (railId === 'WORK') {
    const b = overview.blocks.WORK;
    if (!b) return null;
    return (
      <StageShell title="Work" icon={<ListTodo className="h-3.5 w-3.5" />} accent="teal" openHref={b.link} openLabel={open('Work')}>
        {b.tasks.length === 0 ? (
          <EmptyHint>
            {t('Sem tarefas operacionais.', 'Sin tareas operativas.', 'No operational tasks.')}{' '}
            <Link href={b.link} className="text-teal-300 hover:underline">
              {t('Criar no Work', 'Crear en Work', 'Create in Work')}
            </Link>
          </EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {b.tasks.map((task) => (
              <li key={task.id} className={ROW}>
                <div className="min-w-0">
                  <p className={cn('truncate text-sm', INK)}>{task.title}</p>
                  <p className={cn('text-[11px]', MUTED)}>
                    {task.mine ? t('Minha', 'Mía', 'Mine') : t('Equipa', 'Equipo', 'Team')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving === task.id}
                  onClick={() => onMarkTaskDone(task.id)}
                  className="shrink-0 rounded-md p-1 text-teal-300/80 hover:bg-teal-500/15"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </StageShell>
    );
  }

  if (railId === 'MEET') {
    const b = overview.blocks.MEET;
    if (!b) return null;
    return (
      <StageShell title="Chorus" icon={<Video className="h-3.5 w-3.5" />} accent="indigo" openHref={b.link} openLabel={open('Chorus')}>
        {b.sessions.length === 0 ? (
          <EmptyHint>
            {t('Sem reuniões próximas.', 'Sin reuniones próximas.', 'No upcoming meetings.')}{' '}
            <Link href={b.link} className="text-teal-300 hover:underline">
              {t('Abrir Chorus', 'Abrir Chorus', 'Open Chorus')}
            </Link>
          </EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {b.sessions.map((s) => (
              <li key={s.id}>
                <Link href={s.href} className={cn(ROW, 'transition hover:bg-white/[0.06]')}>
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-medium', INK)}>{s.title}</p>
                    <p className={cn('text-[11px]', MUTED)}>
                      {s.status === 'live'
                        ? t('Ao vivo', 'En vivo', 'Live')
                        : s.scheduledAt
                          ? new Date(s.scheduledAt).toLocaleString()
                          : s.isPermanent
                            ? t('Sala permanente', 'Sala permanente', 'Permanent room')
                            : s.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-indigo-300">{t('Entrar', 'Entrar', 'Join')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StageShell>
    );
  }

  if (railId === 'STUDIO') {
    const b = overview.blocks.STUDIO;
    if (!b) return null;
    return (
      <StageShell title="Studio" icon={<PenLine className="h-3.5 w-3.5" />} accent="violet" openHref={b.link} openLabel={open('Studio')}>
        {b.documents.length === 0 ? (
          <EmptyHint>
            {t('Sem documentos recentes.', 'Sin documentos recientes.', 'No recent documents.')}{' '}
            <Link href={b.link} className="text-teal-300 hover:underline">
              {t('Abrir Studio', 'Abrir Studio', 'Open Studio')}
            </Link>
          </EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {b.documents.map((d) => (
              <li key={d.id}>
                <Link href={d.href} className={cn(ROW, 'transition hover:bg-white/[0.06]')}>
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-medium', INK)}>{d.title}</p>
                    <p className={cn('text-[11px]', MUTED)}>
                      {d.format} · {d.status}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StageShell>
    );
  }

  return null;
}
