import { z } from 'zod';

export const automationFormSchema = z
  .object({
    facebookPageId: z.string().uuid('Select a Facebook Page'),
    name: z.string().min(1, 'Name is required').max(120),
    isActive: z.boolean().default(true),
    replyMode: z.enum(['ALL', 'SPECIFIC_KEYWORDS']),
    matchKeywords: z.array(z.string()).default([]),
    ignoreKeywords: z.array(z.string()).default([]),
    replyOncePerUser: z.boolean().default(true),
    delaySeconds: z.coerce.number().int().min(0).max(86400).default(0),
    likeComment: z.boolean().default(false),
    hideComment: z.boolean().default(false),
    deleteComment: z.boolean().default(false),
    publicReplyEnabled: z.boolean().default(true),
    publicReplyText: z.string().max(2000).optional(),
    sendMessengerMessage: z.boolean().default(false),
    messengerMessageText: z.string().max(2000).optional(),
    assignTagIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.replyMode === 'SPECIFIC_KEYWORDS' && data.matchKeywords.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matchKeywords'],
        message: 'Add at least one keyword to match on',
      });
    }
    if (data.publicReplyEnabled && !data.publicReplyText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicReplyText'],
        message: 'Public reply text is required when public replies are enabled',
      });
    }
    if (data.sendMessengerMessage && !data.messengerMessageText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['messengerMessageText'],
        message: 'Messenger message text is required when this action is enabled',
      });
    }
  });

export type AutomationFormValues = z.infer<typeof automationFormSchema>;
