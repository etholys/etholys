export type FeriaExportRow = {
  roomCode: string;
  sessionTitle: string | null;
  teamNumber: number;
  teamName: string;
  name: string;
  email: string;
  accessCode: string;
  ageRange: string | null;
  gender: string | null;
  locale: string;
  registeredAt: string;
};

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildFeriaSessionCsv(rows: FeriaExportRow[]): string {
  const header = [
    'room_code',
    'session_title',
    'team_number',
    'team_name',
    'name',
    'email',
    'access_code',
    'age_range',
    'gender',
    'locale',
    'registered_at',
  ];
  const lines = rows.map((r) =>
    [
      r.roomCode,
      r.sessionTitle,
      r.teamNumber,
      r.teamName,
      r.name,
      r.email,
      r.accessCode,
      r.ageRange,
      r.gender,
      r.locale,
      r.registeredAt,
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
