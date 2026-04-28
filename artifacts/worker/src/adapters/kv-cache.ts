import type { CacheStore } from "@workspace/recipe-core";

export class KVCacheStore implements CacheStore {
  constructor(private kv: KVNamespace) {}

  async get(key: string): Promise<string | null> {
    return this.kv.get(key);
  }

  async put(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.kv.put(key, value, { expirationTtl: ttlSeconds });
  }
}
