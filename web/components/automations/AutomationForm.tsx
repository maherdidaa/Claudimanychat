'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AutomationFormValues, automationFormSchema } from '@/lib/schemas/automation.schema';
import { commentAutomationApi, CreateAutomationInput } from '@/lib/api-client';
import { KeywordInput } from './KeywordInput';

const defaultValues: AutomationFormValues = {
  facebookPageId: '',
  name: '',
  isActive: true,
  replyMode: 'ALL',
  matchKeywords: [],
  ignoreKeywords: [],
  replyOncePerUser: true,
  delaySeconds: 0,
  likeComment: false,
  hideComment: false,
  deleteComment: false,
  publicReplyEnabled: true,
  publicReplyText: '',
  sendMessengerMessage: false,
  messengerMessageText: '',
  assignTagIds: [],
};

export function AutomationForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AutomationFormValues>({
    resolver: zodResolver(automationFormSchema),
    defaultValues,
  });

  const replyMode = watch('replyMode');
  const publicReplyEnabled = watch('publicReplyEnabled');
  const sendMessengerMessage = watch('sendMessengerMessage');

  const createMutation = useMutation({
    mutationFn: (values: AutomationFormValues) =>
      commentAutomationApi.create(values as CreateAutomationInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comment-automations'] });
      router.push('/automations');
    },
  });

  const onSubmit = (values: AutomationFormValues) => createMutation.mutate(values);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-8 pb-24">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Basics</h2>

        <div>
          <label className="mb-1 block text-sm font-medium">Automation name</label>
          <input
            {...register('name')}
            placeholder="e.g. Reply to pricing questions"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Facebook Page ID</label>
          <input
            {...register('facebookPageId')}
            placeholder="UUID of a connected page"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <p className="mt-1 text-xs text-slate-400">
            Populated by the Page Connection feature once a Facebook Page is linked; pasted here directly
            for this standalone slice.
          </p>
          {errors.facebookPageId && (
            <p className="mt-1 text-xs text-red-500">{errors.facebookPageId.message}</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isActive')} className="h-4 w-4 rounded" />
          Active
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Matching rules</h2>

        <div>
          <label className="mb-1 block text-sm font-medium">Reply mode</label>
          <select
            {...register('replyMode')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="ALL">Reply to all comments</option>
            <option value="SPECIFIC_KEYWORDS">Reply only to specific keywords</option>
          </select>
        </div>

        {replyMode === 'SPECIFIC_KEYWORDS' && (
          <Controller
            control={control}
            name="matchKeywords"
            render={({ field }) => (
              <KeywordInput
                label="Match keywords"
                values={field.value}
                onChange={field.onChange}
                placeholder="Type a keyword and press Enter"
                error={errors.matchKeywords?.message as string | undefined}
              />
            )}
          />
        )}

        <Controller
          control={control}
          name="ignoreKeywords"
          render={({ field }) => (
            <KeywordInput
              label="Ignore keywords (skip if present)"
              values={field.value}
              onChange={field.onChange}
              placeholder="e.g. spam, refund"
            />
          )}
        />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('replyOncePerUser')} className="h-4 w-4 rounded" />
          Reply only once per commenter
        </label>

        <div>
          <label className="mb-1 block text-sm font-medium">Delay before acting (seconds)</label>
          <input
            type="number"
            min={0}
            max={86400}
            {...register('delaySeconds', { valueAsNumber: true })}
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Comment actions</h2>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('likeComment')} className="h-4 w-4 rounded" />
            Like comment
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('hideComment')} className="h-4 w-4 rounded" />
            Hide comment
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('deleteComment')} className="h-4 w-4 rounded" />
            Delete comment
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('publicReplyEnabled')} className="h-4 w-4 rounded" />
          Post a public reply
        </label>
        {publicReplyEnabled && (
          <div>
            <textarea
              {...register('publicReplyText')}
              rows={3}
              placeholder="Thanks for your comment! We'll get back to you shortly."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            {errors.publicReplyText && (
              <p className="mt-1 text-xs text-red-500">{errors.publicReplyText.message}</p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Messenger follow-up</h2>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('sendMessengerMessage')} className="h-4 w-4 rounded" />
          Send a private Messenger reply
        </label>
        {sendMessengerMessage && (
          <div>
            <textarea
              {...register('messengerMessageText')}
              rows={3}
              placeholder="Hey! Thanks for commenting — here's more info..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            {errors.messengerMessageText && (
              <p className="mt-1 text-xs text-red-500">{errors.messengerMessageText.message}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Sent via Facebook&apos;s private reply endpoint, which Meta permits in response to a public
              comment independent of the standard 24-hour messaging window.
            </p>
          </div>
        )}
      </section>

      {createMutation.isError && (
        <p className="text-sm text-red-500">
          Failed to save automation. Please check the fields above and try again.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/automations')}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || createMutation.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Saving…' : 'Save automation'}
        </button>
      </div>
    </form>
  );
}
