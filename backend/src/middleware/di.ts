import { MiddlewareHandler } from 'hono';
import { DispatchService } from '../services/dispatch';
import { SupabaseRepository } from '../infrastructure/supabase';
import { UpstashRedisRepository } from '../infrastructure/upstash';
import { GoogleMapsRepository } from '../infrastructure/google-maps';
import { Bindings } from '../schemas/env';

export type Variables = {
  getDispatchService: () => DispatchService;
  getDb: () => SupabaseRepository;
};

export const diMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  let dispatchService: DispatchService | undefined;
  let dbRepo: SupabaseRepository | undefined;

  c.set('getDispatchService', () => {
    if (!dispatchService) {
      const cacheRepo = new UpstashRedisRepository(
        c.env.UPSTASH_REDIS_REST_URL,
        c.env.UPSTASH_REDIS_REST_TOKEN
      );
      const mapsRepo = new GoogleMapsRepository(c.env.GOOGLE_MAPS_API_KEY);
      dispatchService = new DispatchService(cacheRepo, mapsRepo);
    }
    return dispatchService;
  });

  c.set('getDb', () => {
    if (!dbRepo) {
      dbRepo = new SupabaseRepository(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SECRET_KEY
      );
    }
    return dbRepo;
  });

  await next();
};
