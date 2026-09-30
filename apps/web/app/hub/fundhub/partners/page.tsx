import { redirect } from 'next/navigation';

/** Legado: parceiros vivem em Rede → Aliados. */
export default function FundHubPartnersRedirectPage() {
  redirect('/hub/fundhub/crm/aliados');
}
