import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { FacebookModule } from '../facebook/facebook.module';
import { CommentAutomationController } from './comment-automation.controller';
import { CommentAutomationService } from './comment-automation.service';
import { CommentAutomationProcessor } from './processors/comment-automation.processor';

@Module({
  imports: [QueueModule, FacebookModule],
  controllers: [CommentAutomationController],
  providers: [CommentAutomationService, CommentAutomationProcessor],
  exports: [CommentAutomationService],
})
export class CommentAutomationModule {}
