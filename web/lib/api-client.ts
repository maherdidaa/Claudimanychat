import axios from 'axios';

export const apiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api`,
});

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type CommentReplyMode = 'ALL' | 'SPECIFIC_KEYWORDS';

export interface CommentAutomation {
  id: string;
  facebookPageId: string;
  name: string;
  isActive: boolean;
  replyMode: CommentReplyMode;
  matchKeywords: string[];
  ignoreKeywords: string[];
  replyOncePerUser: boolean;
  delaySeconds: number;
  likeComment: boolean;
  hideComment: boolean;
  deleteComment: boolean;
  publicReplyEnabled: boolean;
  publicReplyText?: string;
  sendMessengerMessage: boolean;
  messengerMessageText?: string;
  assignTagIds: string[];
  totalTriggered: number;
  totalReplied: number;
  totalMessengerSent: number;
  totalLiked: number;
  totalHidden: number;
  totalDeleted: number;
  totalFailed: number;
  createdAt: string;
}

export type CreateAutomationInput = Omit<
  CommentAutomation,
  | 'id'
  | 'createdAt'
  | 'totalTriggered'
  | 'totalReplied'
  | 'totalMessengerSent'
  | 'totalLiked'
  | 'totalHidden'
  | 'totalDeleted'
  | 'totalFailed'
>;

export const commentAutomationApi = {
  list: async (facebookPageId?: string) => {
    const { data } = await apiClient.get<CommentAutomation[]>('/comment-automations', {
      params: facebookPageId ? { facebookPageId } : undefined,
    });
    return data;
  },
  get: async (id: string) => {
    const { data } = await apiClient.get<CommentAutomation>(`/comment-automations/${id}`);
    return data;
  },
  create: async (input: CreateAutomationInput) => {
    const { data } = await apiClient.post<CommentAutomation>('/comment-automations', input);
    return data;
  },
  update: async (id: string, input: Partial<CreateAutomationInput>) => {
    const { data } = await apiClient.patch<CommentAutomation>(`/comment-automations/${id}`, input);
    return data;
  },
  remove: async (id: string) => {
    await apiClient.delete(`/comment-automations/${id}`);
  },
};
