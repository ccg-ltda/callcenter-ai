import 'server-only';

import { createHmac } from 'node:crypto';

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

type MemoryEntry = {
  attempts: number;
  windowStartedAt: number;
};

const memoryLimits = new Map<string, MemoryEntry>();

function protectedKey(namespace: string, identifier: string) {
  const secret = process.env.AUTH_SECRET || 'local-rate-limit-fallback';
  const digest = createHmac('sha256', secret)
    .update(`${namespace}:${identifier}`)
    .digest('base64url');
  return `${namespace}:${digest}`;
}

function memoryRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const existing = memoryLimits.get(key);
  if (!existing || now - existing.windowStartedAt >= windowSeconds * 1000) {
    memoryLimits.set(key, { attempts: 1, windowStartedAt: now });
    return { allowed: true, retryAfter: 0 };
  }

  existing.attempts += 1;
  const retryAfter = Math.max(
    1,
    Math.ceil((existing.windowStartedAt + windowSeconds * 1000 - now) / 1000),
  );
  return { allowed: existing.attempts <= limit, retryAfter };
}

export async function checkRateLimit(
  namespace: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = protectedKey(namespace, identifier);
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (!error && result) {
      return {
        allowed: Boolean(result.allowed),
        retryAfter: Number(result.retry_after || 0),
      };
    }
    console.error('[Rate limit] Distributed limiter unavailable:', error?.message);
  }

  return memoryRateLimit(key, limit, windowSeconds);
}

export async function resetRateLimit(namespace: string, identifier: string) {
  const key = protectedKey(namespace, identifier);
  memoryLimits.delete(key);

  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.rpc('reset_rate_limit', { p_key: key });
  if (error) console.error('[Rate limit] Could not reset limiter:', error.message);
}

export function requestClientAddress(request: Request) {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}
