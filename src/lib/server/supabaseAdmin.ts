import 'server-only';

import { createClient } from '@supabase/supabase-js';

export const useMockServices =
  process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true' ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (useMockServices) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
