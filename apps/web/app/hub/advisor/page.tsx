import { redirect } from 'next/navigation';

/** Redirects Advisor Hub entry to the workspace cockpit. */
export default function HubAdvisorPage() {
  redirect('/hub/workspace');
}
