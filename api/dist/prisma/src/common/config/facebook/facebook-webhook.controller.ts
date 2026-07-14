import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { COMMENT_AUTOMATION_QUEUE } from '../queue/queue.module';

interface FacebookFeedChange {
  field: string;
  value: {
    item: string; // 'comment' | 'post' | 'like' | ...
    verb: string; // 'add' | 'edited' | 'remove'
    comment_id?: string;
    post_id?: string;
    parent_id?: string;
    sender_id?: string;
    sender_name?: string;
    message?: string;
    created_time?: number;
  };
}

interface FacebookWebhookEntry {
  id: string; // page id
  time: number;
  changes?: FacebookFeedChange[];
  messaging?: unknown[];
}

interface FacebookWebhookBody {
  object: string;
  entry: FacebookWebhookEntry[];
}

@Controller('webhooks/facebook')
export class FacebookWebhookController {
  private readonly logger = new Logger(FacebookWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue(COMMENT_AUTOMATION_QUEUE) private readonly commentQueue: Queue,
  ) {}

  /** Meta's one-time webhook verification handshake. */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.config.get<string>('facebook.webhookVerifyToken');
    if (mode === 'subscribe' && verifyToken === expectedToken) {
      return challenge;
    }
    throw new BadRequestException('Webhook verification failed');
  }

  @Post()
  @HttpCode(200)
  async receiveEvent(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: FacebookWebhookBody,
  ) {
    this.verifySignature(req.rawBody, signature);

    if (body.object !== 'page') {
      // We only handle Page subscriptions in this feature slice.
      return { status: 'ignored' };
    }

    for (const entry of body.entry) {
      const feedChanges = (entry.changes ?? []).filter((c) => c.field === 'feed');

      for (const change of feedChanges) {
        await this.prisma.webhookLog.create({
          data: {
            source: 'facebook',
            eventType: `${change.field}.${change.value.item}.${change.value.verb}`,
            pageId: entry.id,
            payload: change as unknown as object,
          },
        });

        // Only new top-level or reply comments trigger comment automations.
        if (change.value.item === 'comment' && change.value.verb === 'add' && change.value.comment_id) {
          await this.commentQueue.add(
            'process-comment',
            {
              pageId: entry.id,
              commentId: change.value.comment_id,
              postId: change.value.post_id,
              parentId: change.value.parent_id,
              senderId: change.value.sender_id,
              senderName: change.value.sender_name,
              message: change.value.message ?? '',
              createdTime: change.value.created_time,
            },
            { jobId: `comment-${change.value.comment_id}` }, // idempotency: dedupes retried deliveries
          );
        }
      }
    }

    return { status: 'ok' };
  }

  /**
   * Every request must be verified against X-Hub-Signature-256, computed by
   * Meta as HMAC-SHA256 of the raw request body using the app secret.
   * Rejecting unsigned/invalid requests prevents forged webhook events.
   */
  private verifySignature(rawBody: Buffer | undefined, signatureHeader: string | undefined) {
    const appSecret = this.config.get<string>('facebook.appSecret');

    if (!rawBody || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
      throw new BadRequestException('Missing webhook signature');
    }

    const expectedSignature = crypto
      .createHmac('sha256', appSecret ?? '')
      .update(rawBody)
      .digest('hex');

    const providedSignature = signatureHeader.replace('sha256=', '');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(providedSignature, 'hex');

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      this.logger.warn('Rejected webhook with invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
