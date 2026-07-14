import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { AutomationLogStatus, CommentAutomation, CommentReplyMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FacebookGraphService } from '../../facebook/facebook-graph.service';
import { TokenEncryption } from '../../common/token-encryption.util';
import { CommentAutomationService } from '../comment-automation.service';
import {
  ActionsPerformed,
  ApplyActionsJobData,
  JOB_APPLY_ACTIONS,
  JOB_PROCESS_COMMENT,
  ProcessCommentJobData,
} from '../comment-automation.types';
import { COMMENT_AUTOMATION_QUEUE } from '../../queue/queue.module';

@Processor(COMMENT_AUTOMATION_QUEUE, { concurrency: 10 })
export class CommentAutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(CommentAutomationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookGraph: FacebookGraphService,
    private readonly automationService: CommentAutomationService,
    @InjectQueue(COMMENT_AUTOMATION_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_PROCESS_COMMENT:
        return this.handleProcessComment(job.data as ProcessCommentJobData);
      case JOB_APPLY_ACTIONS:
        return this.handleApplyActions(job.data as ApplyActionsJobData);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts: ${err.message}`);
  }

  /** Step 1: resolve the page, find matching automations, dispatch or delay. */
  private async handleProcessComment(data: ProcessCommentJobData) {
    if (!data.senderId) {
      this.logger.warn(`Comment ${data.commentId} has no sender_id, skipping`);
      return;
    }

    const page = await this.prisma.facebookPage.findUnique({ where: { pageId: data.pageId } });
    if (!page) {
      this.logger.warn(`Received comment for unknown page ${data.pageId}`);
      return;
    }

    // Ignore comments authored by the Page itself (e.g. our own automated replies).
    if (data.senderId === data.pageId) {
      return;
    }

    const automations = await this.automationService.findActiveAutomationsForFacebookPageId(page.id);

    for (const automation of automations) {
      if (!this.matchesRules(automation, data)) {
        continue;
      }

      if (automation.replyOncePerUser) {
        const alreadyHandled = await this.automationService.hasAlreadyRepliedToUser(
          automation.id,
          data.senderId,
        );
        if (alreadyHandled) {
          continue;
        }
      }

      if (automation.delaySeconds > 0) {
        await this.queue.add(
          JOB_APPLY_ACTIONS,
          { ...data, automationId: automation.id },
          { delay: automation.delaySeconds * 1000, jobId: `apply-${automation.id}-${data.commentId}` },
        );
      } else {
        await this.applyActions(automation, data);
      }
    }
  }

  /** Step 2 (only reached for delayed automations): execute the action set. */
  private async handleApplyActions(data: ApplyActionsJobData) {
    const automation = await this.prisma.commentAutomation.findUnique({
      where: { id: data.automationId },
    });
    if (!automation || !automation.isActive) {
      return;
    }

    // Re-check "once per user" in case another job already handled this
    // commenter while this one was waiting out its delay.
    if (automation.replyOncePerUser && data.senderId) {
      const alreadyHandled = await this.automationService.hasAlreadyRepliedToUser(
        automation.id,
        data.senderId,
      );
      if (alreadyHandled) {
        return;
      }
    }

    await this.applyActions(automation, data);
  }

  private matchesRules(automation: CommentAutomation, data: ProcessCommentJobData): boolean {
    const now = new Date();

    if (automation.scheduleStartAt && now < automation.scheduleStartAt) return false;
    if (automation.scheduleEndAt && now > automation.scheduleEndAt) return false;

    if (automation.activeDaysOfWeek.length && !automation.activeDaysOfWeek.includes(now.getUTCDay())) {
      return false;
    }

    if (automation.activeHourStart != null && automation.activeHourEnd != null) {
      const hour = now.getUTCHours();
      const inRange =
        automation.activeHourStart <= automation.activeHourEnd
          ? hour >= automation.activeHourStart && hour <= automation.activeHourEnd
          : hour >= automation.activeHourStart || hour <= automation.activeHourEnd; // overnight window
      if (!inRange) return false;
    }

    const message = (data.message ?? '').toLowerCase();

    if (automation.ignoreKeywords.some((kw: string) => kw && message.includes(kw.toLowerCase()))) {
      return false;
    }

    if (automation.replyMode === CommentReplyMode.SPECIFIC_KEYWORDS) {
      return automation.matchKeywords.some((kw: string) => kw && message.includes(kw.toLowerCase()));
    }

    return true; // ALL mode with no ignore-keyword hit
  }

  private async applyActions(automation: CommentAutomation, data: ProcessCommentJobData) {
    const actions: ActionsPerformed = {
      liked: false,
      hidden: false,
      deleted: false,
      publicReplied: false,
      messengerSent: false,
      tagsAssigned: [],
    };

    const page = await this.prisma.facebookPage.findFirst({
      where: { pageId: data.pageId },
    });
    if (!page) return;

    let failed = false;
    let errorMessage: string | undefined;
    let subscriberId: string | undefined;

    try {
      const pageAccessToken = TokenEncryption.decrypt(page.pageAccessTokenEnc);

      if (data.senderId) {
        const subscriber = await this.prisma.subscriber.upsert({
          where: { facebookPageId_psid: { facebookPageId: page.id, psid: data.senderId } },
          create: {
            workspaceId: page.workspaceId,
            facebookPageId: page.id,
            psid: data.senderId,
            facebookUserId: data.senderId,
            name: data.senderName,
            lastInteractionAt: new Date(),
          },
          update: { lastInteractionAt: new Date(), name: data.senderName ?? undefined },
        });
        subscriberId = subscriber.id;

        if (automation.assignTagIds.length) {
          await this.prisma.subscriberTag.createMany({
            data: automation.assignTagIds.map((tagId: string) => ({ subscriberId: subscriber.id, tagId })),
            skipDuplicates: true,
          });
          actions.tagsAssigned = automation.assignTagIds;
        }
      }

      if (automation.likeComment) {
        await this.facebookGraph.likeComment(data.commentId, pageAccessToken);
        actions.liked = true;
      }

      if (automation.publicReplyEnabled && automation.publicReplyText) {
        await this.facebookGraph.replyToComment(
          data.commentId,
          pageAccessToken,
          automation.publicReplyText,
        );
        actions.publicReplied = true;
      }

      if (automation.sendMessengerMessage && automation.messengerMessageText) {
        // Private reply to the comment: Meta's compliant channel for a
        // Messenger follow-up triggered by a public comment, independent of
        // the standard 24-hour session window.
        await this.facebookGraph.sendPrivateReplyToComment(
          data.commentId,
          pageAccessToken,
          automation.messengerMessageText,
        );
        actions.messengerSent = true;
      }

      // Hide/delete run last so the automation still has access to a live
      // comment for the reply/like calls above.
      if (automation.deleteComment) {
        await this.facebookGraph.deleteComment(data.commentId, pageAccessToken);
        actions.deleted = true;
      } else if (automation.hideComment) {
        await this.facebookGraph.hideComment(data.commentId, pageAccessToken);
        actions.hidden = true;
      }
    } catch (err) {
      failed = true;
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Automation ${automation.id} failed on comment ${data.commentId}: ${errorMessage}`,
      );
    }

    if (data.senderId) {
      await this.automationService.recordExecution({
        automationId: automation.id,
        facebookPageId: page.id,
        facebookCommentId: data.commentId,
        facebookUserId: data.senderId,
        subscriberId,
        actionsPerformed: actions,
        status: failed ? AutomationLogStatus.FAILED : AutomationLogStatus.SUCCESS,
        errorMessage,
      });
    }

    await this.automationService.incrementStats(automation.id, actions, failed);
  }
}
