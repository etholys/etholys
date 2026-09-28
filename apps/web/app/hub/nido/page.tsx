import { redirect } from 'next/navigation';

function queryString(searchParams: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (typeof value === 'string') q.set(key, value);
    else if (Array.isArray(value)) for (const item of value) q.append(key, item);
  }
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

/** Nomes antigos: NIDO → AURORA */
export default function NidoRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  redirect(`/hub/aurora${queryString(searchParams)}`);
}
