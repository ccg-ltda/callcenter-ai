import 'server-only';

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { telnyxService } from '@/lib/telnyxService';

const RECONCILIATION_INTERVAL_MS = 15_000;

let lastReconciliationAt = 0;
let activeReconciliation: Promise<void> | null = null;

export async function reconcileActiveOutboundCalls() {
  const now = Date.now();
  if (activeReconciliation) return activeReconciliation;
  if (now - lastReconciliationAt < RECONCILIATION_INTERVAL_MS) return;

  activeReconciliation = reconcile()
    .catch((error) => {
      console.error('[Outbound reconciliation]', error);
    })
    .finally(() => {
      lastReconciliationAt = Date.now();
      activeReconciliation = null;
    });

  return activeReconciliation;
}

async function reconcile() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, telnyx_call_id, contact_id, status')
    .eq('direction', 'outbound')
    .in('status', ['queued', 'ringing', 'in_progress'])
    .not('telnyx_call_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const results = await Promise.allSettled((calls || []).map(async (call) => {
    const callId = call.telnyx_call_id as string;
    const remote = await telnyxService.getCallStatus(callId);
    if (remote.is_alive !== false) return;

    const durationSeconds = Math.max(0, Math.round(Number(remote.call_duration) || 0));
    const endedAt = remote.end_time && !Number.isNaN(new Date(remote.end_time).getTime())
      ? new Date(remote.end_time).toISOString()
      : new Date().toISOString();
    const startedAt = remote.start_time && !Number.isNaN(new Date(remote.start_time).getTime())
      ? new Date(remote.start_time).toISOString()
      : undefined;

    const { error: updateError } = await supabase.from('calls').update({
      status: 'completed',
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      outcome: durationSeconds > 0 ? 'completed' : 'no_answer',
      ...(startedAt ? { started_at: startedAt } : {}),
    }).eq('id', call.id);
    if (updateError) throw updateError;

    if (call.contact_id) {
      const { error: contactError } = await supabase
        .from('contacts')
        .update({ status: durationSeconds > 0 ? 'answered' : 'no_answer' })
        .eq('id', call.contact_id);
      if (contactError) throw contactError;
    }
  }));

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[Outbound reconciliation] Call ${calls?.[index]?.id}:`, result.reason);
    }
  });
}
