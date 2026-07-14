'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, MessageCircle, ThumbsUp, EyeOff, Ban } from 'lucide-react';
import { CommentAutomation, commentAutomationApi } from '@/lib/api-client';

export function AutomationCard({ automation }: { automation: CommentAutomation }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => commentAutomationApi.remove(automation.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comment-automations'] }),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/automations/${automation.id}`} className="font-semibold hover:underline">
            {automation.name}
          </Link>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span
              className={`h-2 w-2 rounded-full ${automation.isActive ? 'bg-green-500' : 'bg-slate-400'}`}
            />
            {automation.isActive ? 'Active' : 'Paused'} ·{' '}
            {automation.replyMode === 'ALL' ? 'All comments' : `${automation.matchKeywords.length} keywords`}
          </div>
        </div>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="text-slate-400 hover:text-red-500"
          aria-label="Delete automation"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-center text-xs">
        <Stat icon={<MessageCircle size={14} />} label="Triggered" value={automation.totalTriggered} />
        <Stat icon={<ThumbsUp size={14} />} label="Liked" value={automation.totalLiked} />
        <Stat icon={<EyeOff size={14} />} label="Hidden" value={automation.totalHidden} />
        <Stat icon={<Ban size={14} />} label="Failed" value={automation.totalFailed} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800">
      <div className="flex items-center justify-center gap-1 text-slate-400">{icon}</div>
      <div className="mt-1 font-semibold">{value}</div>
      <div className="text-slate-400">{label}</div>
    </div>
  );
}
