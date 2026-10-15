import { redirect } from 'next/navigation';

export default function CrmPerfilRedirect() {
  redirect('/hub/fundhub/settings?s=eligibility');
}
