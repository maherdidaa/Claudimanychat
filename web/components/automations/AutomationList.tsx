'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { commentAutomationApi } from '@/lib/api-client';
import { AutomationCard } from './AutomationCard';

export function AutomationList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['comment-automations'],
    queryFn: () => commentAutomationApi.list(),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Comment Automations</h1>
        <Link
          href="/automations/new"
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> New automation
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-500">Couldn&apos;t load automations. Check the API connection.</p>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
          No comment automations yet. Create one to start auto-replying to Facebook comments.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((automation) => (
            <AutomationCard key={automation.id} automation={automation} />
          ))}
        </div>
      )}
    </div>
  );
}
