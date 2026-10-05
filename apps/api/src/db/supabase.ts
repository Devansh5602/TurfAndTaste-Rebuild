import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { ApiEnv } from '../config/env';

export function createSupabaseAdmin(env: ApiEnv): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase server credentials are not configured.');
  }

  const options: SupabaseClientOptions<'public'> = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };

  if (env.NODE_ENV === 'test') {
    // Disable realtime in test environment to avoid WebSocket dependency
    (options as SupabaseClientOptions<'public'> & { realtime?: false }).realtime = false;
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
}

export function createSupabaseClient(env: ApiEnv, accessToken: string): SupabaseClient {
  if (!env.SUPABASE_URL) {
    throw new Error('Supabase URL is not configured.');
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}