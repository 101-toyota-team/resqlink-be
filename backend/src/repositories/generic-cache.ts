export interface IGenericCache {
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  ttl(key: string): Promise<number>;
  lpush<T>(key: string, ...values: T[]): Promise<number>;
  rpush<T>(key: string, ...values: T[]): Promise<number>;
  lpop<T>(key: string): Promise<T | null>;
  llen(key: string): Promise<number>;
}
