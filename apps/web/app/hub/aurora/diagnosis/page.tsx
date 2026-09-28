import { redirect } from 'next/navigation';

/** O AURORA não usa o wizard 360 — o trabalho do técnico é o dossiê. */
export default function AuroraDiagnosisRedirect({
  searchParams,
}: {
  searchParams: { company?: string; engagement?: string };
}) {
  const company = String(searchParams.company || '').trim();
  if (!company) redirect('/hub/aurora');
  const q = new URLSearchParams({ company });
  const engagement = String(searchParams.engagement || '').trim();
  if (engagement) q.set('engagement', engagement);
  redirect(`/hub/aurora/dossie?${q}`);
}
