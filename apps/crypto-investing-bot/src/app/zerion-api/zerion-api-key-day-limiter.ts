import { RedisStore } from 'cache-manager-redis-store';
import { ApiKeyAndLimit } from '../app.config';

export type ApiKeyAndLimitWithUsage = ApiKeyAndLimit & { used: number };

export const ZERION_MANUAL_API_KEYS = 'ZERION_MANUAL_API_KEYS';
export const ZERION_UPDATING_API_KEYS = 'ZERION_UPDATING_API_KEYS';

function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTokenKey(token: string): string {
  return `token-limits:${getCurrentDate()}:${token}`;
}

export async function fillTokenUsage(
  apiKeys: ApiKeyAndLimit[],
  redisClient: ReturnType<RedisStore['getClient']>
): Promise<ApiKeyAndLimitWithUsage[]> {
  return await Promise.all(
    apiKeys.map(async ({ token, limit }) => {
      let used = 0;
      try {
        used = +((await redisClient.get(getTokenKey(token))) || 0);
      } catch (error) {
        console.error('Failed to get token usage', token, error);
      }

      return {
        token,
        limit,
        used,
      };
    })
  );
}
