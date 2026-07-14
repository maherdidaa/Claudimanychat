import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AutomationLogStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { ActionsPerformed } from './comment-automation.types';

@Injectable()
export class CommentAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateAutomationDto) {
    await this.assertPageBelongsToWorkspace(workspaceId, dto.facebookPageId);

    return this.prisma.commentAutomation.create({
      data: {
        workspaceId,
        facebookPageId: dto.facebookPageId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        replyMode: dto.replyMode,
        matchKeywords: dto.matchKeywords ?? [],
        ignoreKeywords: dto.ignoreKeywords ?? [],
        replyOncePerUser: dto.replyOncePerUser ?? true,
        delaySeconds: dto.delaySeconds ?? 0,
        likeComment: dto.likeComment ?? false,
        hideComment: dto.hideComment ?? false,
        deleteComment: dto.deleteComment ?? false,
        publicReplyEnabled: dto.publicReplyEnabled ?? true,
        publicReplyText: dto.publicReplyText,
        sendMessengerMessage: dto.sendMessengerMessage ?? false,
        messengerMessageText: dto.messengerMessageText,
        assignTagIds: dto.assignTagIds ?? [],
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
        notes: dto.notes,
        scheduleStartAt: dto.scheduleStartAt ? new Date(dto.scheduleStartAt) : undefined,
        scheduleEndAt: dto.scheduleEndAt ? new Date(dto.scheduleEndAt) : undefined,
        activeDaysOfWeek: dto.activeDaysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
        activeHourStart: dto.activeHourStart,
        activeHourEnd: dto.activeHourEnd,
      },
    });
  }

  findAll(workspaceId: string, facebookPageId?: string) {
    return this.prisma.commentAutomation.findMany({
      where: { workspaceId, ...(facebookPageId ? { facebookPageId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const automation = await this.prisma.commentAutomation.findFirst({
      where: { id, workspaceId },
    });
    if (!automation) {
      throw new NotFoundException('Comment automation not found');
    }
    return automation;
  }

  async update(workspaceId: string, id: string, dto: UpdateAutomationDto) {
    await this.findOne(workspaceId, id); // ownership check + 404

    return this.prisma.commentAutomation.update({
      where: { id },
      data: {
        ...dto,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
        scheduleStartAt: dto.scheduleStartAt ? new Date(dto.scheduleStartAt) : undefined,
        scheduleEndAt: dto.scheduleEndAt ? new Date(dto.scheduleEndAt) : undefined,
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    await this.prisma.commentAutomation.delete({ where: { id } });
    return { success: true };
  }

  async getExecutionLogs(workspaceId: string, id: string, take = 50) {
    await this.findOne(workspaceId, id);
    return this.prisma.automationExecutionLog.findMany({
      where: { automationId: id },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  // ---------------------------------------------------------------
  // Used internally by the queue processor, not exposed over HTTP.
  // ---------------------------------------------------------------

  /** All active automations configured on a page, oldest-first so earlier
   *  rules get first chance to act (comment automations execute in creation
   *  order, mirroring how most automation platforms resolve rule priority). */
  findActiveAutomationsForFacebookPageId(internalFacebookPageId: string) {
    return this.prisma.commentAutomation.findMany({
      where: { facebookPageId: internalFacebookPageId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async hasAlreadyRepliedToUser(automationId: string, facebookUserId: string): Promise<boolean> {
    const existing = await this.prisma.automationExecutionLog.findUnique({
      where: { automationId_facebookUserId: { automationId, facebookUserId } },
    });
    return existing !== null && existing.status === AutomationLogStatus.SUCCESS;
  }

  async recordExecution(params: {
    automationId: string;
    facebookPageId: string;
    facebookCommentId: string;
    facebookUserId: string;
    subscriberId?: string;
    actionsPerformed: ActionsPerformed;
    status: AutomationLogStatus;
    errorMessage?: string;
  }) {
    return this.prisma.automationExecutionLog.upsert({
      where: {
        automationId_facebookUserId: {
          automationId: params.automationId,
          facebookUserId: params.facebookUserId,
        },
      },
      create: {
        automationId: params.automationId,
        facebookPageId: params.facebookPageId,
        facebookCommentId: params.facebookCommentId,
        facebookUserId: params.facebookUserId,
        subscriberId: params.subscriberId,
        actionsPerformed: params.actionsPerformed as unknown as Prisma.InputJsonValue,
        status: params.status,
        errorMessage: params.errorMessage,
      },
      update: {
        facebookCommentId: params.facebookCommentId,
        actionsPerformed: params.actionsPerformed as unknown as Prisma.InputJsonValue,
        status: params.status,
        errorMessage: params.errorMessage,
      },
    });
  }

  async incrementStats(automationId: string, actions: ActionsPerformed, failed: boolean) {
    await this.prisma.commentAutomation.update({
      where: { id: automationId },
      data: {
        totalTriggered: { increment: 1 },
        totalReplied: { increment: actions.publicReplied ? 1 : 0 },
        totalMessengerSent: { increment: actions.messengerSent ? 1 : 0 },
        totalLiked: { increment: actions.liked ? 1 : 0 },
        totalHidden: { increment: actions.hidden ? 1 : 0 },
        totalDeleted: { increment: actions.deleted ? 1 : 0 },
        totalFailed: { increment: failed ? 1 : 0 },
      },
    });
  }

  private async assertPageBelongsToWorkspace(workspaceId: string, facebookPageId: string) {
    const page = await this.prisma.facebookPage.findFirst({
      where: { id: facebookPageId, workspaceId },
    });
    if (!page) {
      throw new ForbiddenException('Facebook page does not belong to this workspace');
    }
    return page;
  }
}
