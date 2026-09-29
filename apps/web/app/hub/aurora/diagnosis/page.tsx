import { redirect } from 'next/navigation';

/** Entrada escalável: diagnóstico dinâmico, não o dossiê 1:1 nem o wizard 360. */
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
  redirect(`/hub/aurora/diagnostico?${q}`);
}
