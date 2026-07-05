/**
 * Persist tokens outside the process by implementing the `TokenStore`
 * interface — here backed by a (pseudo) Redis client. The client then refreshes
 * and rotates tokens against your store transparently.
 */
import {
  WithingsClient,
  type TokenStore,
  type Tokens,
} from "withings-node-oauth2";

// Stand-in for your real Redis client.
declare const redis: {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

function redisTokenStore(userId: string): TokenStore {
  const key = `withings:tokens:${userId}`;
  return {
    async get(): Promise<Tokens | undefined> {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as Tokens) : undefined;
    },
    async set(tokens: Tokens): Promise<void> {
      await redis.set(key, JSON.stringify(tokens));
    },
    async clear(): Promise<void> {
      await redis.del(key);
    },
  };
}

export function clientForUser(userId: string): WithingsClient {
  return new WithingsClient({
    clientId: process.env.WITHINGS_CLIENT_ID!,
    clientSecret: process.env.WITHINGS_CLIENT_SECRET!,
    callbackURL: process.env.WITHINGS_CALLBACK_URL!,
    tokenStore: redisTokenStore(userId),
  });
}
