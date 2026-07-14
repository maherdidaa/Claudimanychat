import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';

export interface FacebookApiErrorShape {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Thin, typed wrapper around the subset of the Graph API this feature needs:
 * Comments API (reply / like / hide / delete) and the Send API (private
 * replies to a commenter via the messaging_type: "MESSAGE_TAG" flow, which is
 * the only Meta-compliant way to message a user's inbox in response to a
 * public comment more than 24h ago -- see README "Meta Platform Constraints").
 */
@Injectable()
export class FacebookGraphService {
  private readonly logger = new Logger(FacebookGraphService.name);
  private readonly http: AxiosInstance;
  private readonly apiVersion: string;

  constructor(private readonly config: ConfigService) {
    this.apiVersion = this.config.get<string>('facebook.graphApiVersion') ?? 'v19.0';
    this.http = axios.create({
      baseURL: `${this.config.get<string>('facebook.graphApiBaseUrl')}/${this.apiVersion}`,
      timeout: 10_000,
    });
  }

  /** Public reply posted underneath the original comment. */
  async replyToComment(commentId: string, pageAccessToken: string, message: string) {
    return this.request('post', `/${commentId}/comments`, pageAccessToken, { message });
  }

  async likeComment(commentId: string, pageAccessToken: string) {
    return this.request('post', `/${commentId}/likes`, pageAccessToken, {});
  }

  /** Hides the comment from public view without deleting it. */
  async hideComment(commentId: string, pageAccessToken: string) {
    return this.request('post', `/${commentId}`, pageAccessToken, { is_hidden: true });
  }

  async deleteComment(commentId: string, pageAccessToken: string) {
    return this.request('delete', `/${commentId}`, pageAccessToken);
  }

  /**
   * Sends a private Messenger reply to the commenter. Uses the
   * `respond to comment` message tag which Meta allows outside the standard
   * 24-hour window specifically for this use case.
   */
  async sendPrivateReplyToComment(commentId: string, pageAccessToken: string, message: string) {
    return this.request('post', `/${commentId}/private_replies`, pageAccessToken, {
      message,
    });
  }

  /** Standard Send API call, restricted to the 24-hour session window / tags. */
  async sendMessengerMessage(
    recipientPsid: string,
    pageAccessToken: string,
    message: string,
    messagingType: 'RESPONSE' | 'MESSAGE_TAG' = 'RESPONSE',
    tag?: string,
  ) {
    const body: Record<string, unknown> = {
      recipient: { id: recipientPsid },
      message: { text: message },
      messaging_type: messagingType,
    };
    if (messagingType === 'MESSAGE_TAG' && tag) {
      body.tag = tag;
    }
    return this.request('post', '/me/messages', pageAccessToken, body);
  }

  async getCommentDetails(commentId: string, pageAccessToken: string) {
    return this.request(
      'get',
      `/${commentId}`,
      pageAccessToken,
      undefined,
      { fields: 'id,message,from,created_time,parent,attachment' },
    );
  }

  /** Exchanges a short-lived user token for a long-lived page access token. */
  async exchangeForLongLivedToken(shortLivedUserToken: string) {
    const appId = this.config.get<string>('facebook.appId');
    const appSecret = this.config.get<string>('facebook.appSecret');
    const response = await this.http.get('/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedUserToken,
      },
    });
    return response.data as { access_token: string; token_type: string; expires_in?: number };
  }

  async subscribePageToWebhooks(pageId: string, pageAccessToken: string) {
    return this.request('post', `/${pageId}/subscribed_apps`, pageAccessToken, {
      subscribed_fields: 'feed,messages,messaging_postbacks,message_deliveries',
    });
  }

  private async request(
    method: 'get' | 'post' | 'delete',
    path: string,
    pageAccessToken: string,
    data?: Record<string, unknown>,
    extraParams?: Record<string, unknown>,
  ) {
    try {
      const response = await this.http.request({
        method,
        url: path,
        params: { access_token: pageAccessToken, ...extraParams },
        data: method === 'get' || method === 'delete' ? undefined : data,
      });
      return response.data;
    } catch (err) {
      if (isAxiosError<FacebookApiErrorShape>(err)) {
        const fbError = err.response?.data?.error;
        this.logger.error(
          `Graph API ${method.toUpperCase()} ${path} failed: ${fbError?.message ?? err.message}`,
        );
        throw new HttpException(
          {
            message: fbError?.message ?? 'Facebook Graph API request failed',
            fbCode: fbError?.code,
            fbSubcode: fbError?.error_subcode,
          },
          err.response?.status ?? 502,
        );
      }
      throw err;
    }
  }
}
