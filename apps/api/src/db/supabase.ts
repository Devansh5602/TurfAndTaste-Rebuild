import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { ApiEnv } from '../config/env';
import WebSocket from 'ws';

export function createSupabaseAdmin(env: ApiEnv): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase server credentials are not configured.');
  }

  const options: SupabaseClientOptions<'public'> = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    // Disable realtime as it's not used in current implementation and requires Node.js 22+
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtime: false as any,
    // Provide WebSocket polyfill for Node.js 20
    global: {
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };

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