import { redirect } from 'next/navigation';

/** Assessor transversal Etholys — redireciona para o cockpit em /hub/workspace. */
export default function HubAdvisorPage() {
  redirect('/hub/workspace');
}
