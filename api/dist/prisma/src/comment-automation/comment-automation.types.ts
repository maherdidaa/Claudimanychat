export const JOB_PROCESS_COMMENT = 'process-comment';
export const JOB_APPLY_ACTIONS = 'apply-automation-actions';

export interface ProcessCommentJobData {
  pageId: string; // Facebook Page ID (not our internal uuid)
  commentId: string;
  postId?: string;
  parentId?: string;
  senderId?: string;
  senderName?: string;
  message: string;
  createdTime?: number;
}

export interface ApplyActionsJobData extends ProcessCommentJobData {
  automationId: string;
}

export interface ActionsPerformed {
  liked: boolean;
  hidden: boolean;
  deleted: boolean;
  publicReplied: boolean;
  messengerSent: boolean;
  tagsAssigned: string[];
  skippedReason?: string;
}
