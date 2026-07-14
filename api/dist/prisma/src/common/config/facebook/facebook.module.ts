import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { FacebookGraphService } from './facebook-graph.service';
import { FacebookWebhookController } from './facebook-webhook.controller';

@Module({
  imports: [QueueModule],
  controllers: [FacebookWebhookController],
  providers: [FacebookGraphService],
  exports: [FacebookGraphService],
})
export class FacebookModule {}
