import { prisma } from '@/lib/prisma';
import { SOURCE_COLORS, type CalendarFeedEvent, type CalendarLayer } from '@/lib/calendar/types';

const MAX_RANGE_MS = 120 * 24 * 60 * 60 * 1000;

function iso(d: Date) {
  return d.toISOString();
}

function inWindow(from: Date, to: Date, start: Date | null | undefined, end?: Date | null) {
  if (!start) return false;
  const finish = end && end.getTime() >= start.getTime() ? end : start;
  return start.getTime() < to.getTime() && finish.getTime() >= from.getTime();
}

export async function loadCalendarFeed(companyId: string, from: Date, to: Date) {
  if (!(from.getTime() < to.getTime()) || to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new Error('Janela de datas inválida');
  }

  const [projects, tasks, milestones, sessions, live, funds, visits, native] = await Promise.all([
    prisma.project.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, color: true, startDate: true, endDate: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.task.findMany({
      where: {
        companyId,
        isActive: true,
        parentId: null,
        OR: [
          { dueDate: { gte: from, lt: to } },
          { startDate: { gte: from, lt: to } },
          { AND: [{ startDate: { lt: to } }, { dueDate: { gte: from } }] },
        ],
      },
      select: { id: true, title: true, startDate: true, dueDate: true, projectId: true, status: true },
      take: 500,
    }),
    prisma.milestone.findMany({
      where: { project: { companyId, isActive: true }, dueDate: { gte: from, lt: to } },
      select: { id: true, name: true, dueDate: true, projectId: true, project: { select: { color: true } } },
      take: 300,
    }),
    prisma.meetSession.findMany({
      where: {
        companyId,
        status: { not: 'cancelled' },
        scheduledAt: { lt: to },
        OR: [{ endsAt: { gte: from } }, { endsAt: null, scheduledAt: { gte: from } }],
      },
      select: { id: true, title: true, scheduledAt: true, endsAt: true, projectId: true },
      take: 400,
    }),
    prisma.forgeLiveSession.findMany({
      where: {
        course: { companyId },
        startsAt: { lt: to },
        OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }],
      },
      select: { id: true, title: true, startsAt: true, endsAt: true, courseId: true, course: { select: { title: true } } },
      take: 300,
    }),
    prisma.fund.findMany({
      where: { companyId, isActive: true, deadline: { gte: from, lt: to } },
      select: { id: true, name: true, deadline: true },
      take: 200,
    }),
    prisma.auroraFieldVisit.findMany({
      where: { operatorCompanyId: companyId, occurredAt: { gte: from, lt: to } },
      select: { id: true, activityLabel: true, occurredAt: true, siepProjectId: true },
      take: 300,
    }),
    prisma.calendarEvent.findMany({
      where: {
        companyId,
        startsAt: { lt: to },
        OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }],
      },
      select: { id: true, title: true, description: true, startsAt: true, endsAt: true, allDay: true },
      take: 400,
    }),
  ]);

  const events: CalendarFeedEvent[] = [];

  for (const ev of native) {
    events.push({
      id: `personal:${ev.id}`,
      title: ev.title,
      startsAt: iso(ev.startsAt),
      endsAt: ev.endsAt ? iso(ev.endsAt) : null,
      allDay: ev.allDay,
      calendarId: 'personal',
      source: 'personal',
      color: SOURCE_COLORS.personal,
      href: null,
      projectId: null,
      editable: true,
      description: ev.description,
    });
  }

  for (const task of tasks) {
    const start = task.startDate ?? task.dueDate;
    const end = task.dueDate ?? task.startDate;
    if (!inWindow(from, to, start, end)) continue;
    events.push({
      id: `task:${task.id}`,
      title: task.title,
      startsAt: iso(start!),
      endsAt: end ? iso(end) : null,
      allDay: true,
      calendarId: 'etask',
      source: 'etask',
      color: SOURCE_COLORS.etask,
      href: task.projectId ? `/projects/${task.projectId}` : '/hub/work',
      projectId: task.projectId,
      editable: false,
    });
  }

  for (const project of projects) {
    if (project.startDate && inWindow(from, to, project.startDate, project.startDate)) {
      events.push({
        id: `project-start:${project.id}`,
        title: project.name,
        startsAt: iso(project.startDate),
        endsAt: null,
        allDay: true,
        calendarId: `project:${project.id}`,
        source: 'project',
        color: project.color || '#64748b',
        href: `/projects/${project.id}`,
        projectId: project.id,
        editable: false,
      });
    }
    if (
      project.endDate &&
      inWindow(from, to, project.endDate, project.endDate) &&
      project.endDate.getTime() !== project.startDate?.getTime()
    ) {
      events.push({
        id: `project-end:${project.id}`,
        title: project.name,
        startsAt: iso(project.endDate),
        endsAt: null,
        allDay: true,
        calendarId: `project:${project.id}`,
        source: 'project',
        color: project.color || '#64748b',
        href: `/projects/${project.id}`,
        projectId: project.id,
        editable: false,
      });
    }
  }

  for (const m of milestones) {
    if (!m.dueDate) continue;
    events.push({
      id: `milestone:${m.id}`,
      title: m.name,
      startsAt: iso(m.dueDate),
      endsAt: null,
      allDay: true,
      calendarId: `project:${m.projectId}`,
      source: 'project',
      color: m.project.color || '#64748b',
      href: `/projects/${m.projectId}`,
      projectId: m.projectId,
      editable: false,
    });
  }

  for (const session of sessions) {
    if (!session.scheduledAt) continue;
    events.push({
      id: `meet:${session.id}`,
      title: session.title,
      startsAt: iso(session.scheduledAt),
      endsAt: session.endsAt ? iso(session.endsAt) : null,
      allDay: false,
      calendarId: 'chorus',
      source: 'chorus',
      color: SOURCE_COLORS.chorus,
      href: '/hub/meet',
      projectId: session.projectId,
      editable: false,
    });
  }

  for (const liveSession of live) {
    events.push({
      id: `forge:${liveSession.id}`,
      title: liveSession.title || liveSession.course.title,
      startsAt: iso(liveSession.startsAt),
      endsAt: liveSession.endsAt ? iso(liveSession.endsAt) : null,
      allDay: false,
      calendarId: 'forge',
      source: 'forge',
      color: SOURCE_COLORS.forge,
      href: `/hub/forge/cursos/${liveSession.courseId}`,
      projectId: null,
      editable: false,
    });
  }

  for (const fund of funds) {
    if (!fund.deadline) continue;
    events.push({
      id: `fund:${fund.id}`,
      title: fund.name,
      startsAt: iso(fund.deadline),
      endsAt: null,
      allDay: true,
      calendarId: 'fundhub',
      source: 'fundhub',
      color: SOURCE_COLORS.fundhub,
      href: '/hub/fundhub',
      projectId: null,
      editable: false,
    });
  }

  for (const visit of visits) {
    events.push({
      id: `aurora:${visit.id}`,
      title: visit.activityLabel,
      startsAt: iso(visit.occurredAt),
      endsAt: null,
      allDay: false,
      calendarId: 'aurora',
      source: 'aurora',
      color: SOURCE_COLORS.aurora,
      href: '/hub/aurora',
      projectId: visit.siepProjectId,
      editable: false,
    });
  }

  const layers: CalendarLayer[] = [
    { id: 'personal', label: 'eCalendar', color: SOURCE_COLORS.personal, group: 'mine' },
    { id: 'etask', label: 'eTask', color: SOURCE_COLORS.etask, group: 'systems' },
    { id: 'chorus', label: 'Chorus', color: SOURCE_COLORS.chorus, group: 'systems' },
    { id: 'forge', label: 'FORGE', color: SOURCE_COLORS.forge, group: 'systems' },
    { id: 'fundhub', label: 'FundHub', color: SOURCE_COLORS.fundhub, group: 'systems' },
    { id: 'aurora', label: 'AURORA', color: SOURCE_COLORS.aurora, group: 'systems' },
    ...projects.map((p) => ({
      id: `project:${p.id}`,
      label: p.name,
      color: p.color || '#64748b',
      group: 'projects' as const,
    })),
  ];

  return { events, layers };
}
