'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BudgetRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/finance?tab=planning');
  }, [router]);
  return null;
}
