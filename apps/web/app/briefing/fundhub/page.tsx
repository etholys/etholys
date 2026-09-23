import type { Metadata } from 'next';
import { FundHubBriefing } from '@/components/briefing/FundHubBriefing';

export const metadata: Metadata = {
  title: 'FundHub — briefing Etholys',
  robots: { index: false, follow: false },
};

export default function FundHubBriefingPage() {
  return <FundHubBriefing />;
}
