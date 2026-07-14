export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  facebook: {
    appId: string;
    appSecret: string;
    webhookVerifyToken: string;
    graphApiVersion: string;
    graphApiBaseUrl: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  facebook: {
    appId: process.env.FB_APP_ID ?? '',
    appSecret: process.env.FB_APP_SECRET ?? '',
    webhookVerifyToken: process.env.FB_WEBHOOK_VERIFY_TOKEN ?? '',
    graphApiVersion: process.env.FB_GRAPH_API_VERSION ?? 'v19.0',
    graphApiBaseUrl: process.env.FB_GRAPH_API_BASE_URL ?? 'https://graph.facebook.com',
  },
});
