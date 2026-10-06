import { permanentRedirect } from 'next/navigation';
import { adminHref } from '@/lib/admin-control';

/** Equipa / grants vivem na Administração — bookmarks antigos não morrem. */
export default function WorkspaceTeamRedirectPage() {
  permanentRedirect(adminHref('access'));
}
