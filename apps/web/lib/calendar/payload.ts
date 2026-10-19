export type CalendarWrite = {
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
};

type ParseOk = { ok: true; companyId: string | null; data: CalendarWrite };
type ParseErr = { ok: false; error: string; status: number };

export function parseCalendarWrite(body: unknown, opts?: { companyRequired?: boolean }): ParseOk | ParseErr {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : '';
  if (opts?.companyRequired && !companyId) {
    return { ok: false, error: 'companyId inválido', status: 400 };
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return { ok: false, error: 'title requerido', status: 400 };
  const startsAt = new Date(typeof raw.startsAt === 'string' ? raw.startsAt : '');
  if (!Number.isFinite(startsAt.getTime())) return { ok: false, error: 'startsAt inválido', status: 400 };
  const endsRaw = raw.endsAt;
  const endsAt = typeof endsRaw === 'string' && endsRaw ? new Date(endsRaw) : null;
  if (endsAt && !Number.isFinite(endsAt.getTime())) return { ok: false, error: 'endsAt inválido', status: 400 };
  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false, error: 'endsAt anterior a startsAt', status: 400 };
  }
  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 2000) : '';
  return {
    ok: true,
    companyId: companyId || null,
    data: {
      title: title.slice(0, 200),
      description: description || null,
      startsAt,
      endsAt,
      allDay: Boolean(raw.allDay),
    },
  };
}
