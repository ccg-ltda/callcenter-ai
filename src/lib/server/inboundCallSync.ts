import 'server-only';

import { normalizePhoneNumber } from '@/lib/phoneNumbers';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { syncCallTranscript } from '@/lib/server/transcriptSync';
import { telnyxService } from '@/lib/telnyxService';

const SETTLED_AFTER_MS = 60_000;
const RECONCILIATION_INTERVAL_MS = 30_000;

let lastReconciliationAt = 0;
let activeReconciliation: Promise<void> | null = null;

export async function reconcileRecentInboundCalls() {
  const now = Date.now();
  if (activeReconciliation) return activeReconciliation;
  if (now - lastReconciliationAt < RECONCILIATION_INTERVAL_MS) return;

  activeReconciliation = reconcile()
    .catch((error) => {
      console.error('[Inbound reconciliation]', error);
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

  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('telnyx_phone_number, inbound_agent_id')
    .eq('id', 'default')
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.telnyx_phone_number || !settings.inbound_agent_id) return;

  const configuredNumber = normalizePhoneNumber(settings.telnyx_phone_number);
  const conversations = (await telnyxService.listRecentConversations(20)).filter((conversation) => {
    const metadata = conversation.metadata;
    return metadata?.telnyx_conversation_channel === 'phone_call'
      && normalizePhoneNumber(metadata.to || '') === configuredNumber
      && Boolean(metadata.call_control_id);
  });
  if (!conversations.length) return;

  const callIds = conversations.map((conversation) => conversation.metadata!.call_control_id!);
  const { data: existingCalls, error: callsError } = await supabase
    .from('calls')
    .select('id, status')
    .in('id', callIds);
  if (callsError) throw callsError;
  const existing = new Map((existingCalls || []).map((call) => [call.id, call.status]));

  for (const conversation of conversations) {
    const callId = conversation.metadata!.call_control_id!;
    const startedAt = conversation.created_at ? new Date(conversation.created_at) : new Date();
    const lastMessageAt = conversation.last_message_at ? new Date(conversation.last_message_at) : null;
    const settled = Boolean(lastMessageAt && Date.now() - lastMessageAt.getTime() >= SETTLED_AFTER_MS);
    const durationSeconds = lastMessageAt
      ? Math.max(0, Math.round((lastMessageAt.getTime() - startedAt.getTime()) / 1000))
      : 0;

    if (!existing.has(callId)) {
      const { error } = await supabase.from('calls').insert({
        id: callId,
        telnyx_call_id: callId,
        agent_id: settings.inbound_agent_id,
        direction: 'inbound',
        from_number: conversation.metadata?.from || null,
        to_number: conversation.metadata?.to || settings.telnyx_phone_number,
        status: settled ? 'completed' : 'in_progress',
        started_at: startedAt.toISOString(),
        created_at: startedAt.toISOString(),
        ...(settled ? {
          ended_at: lastMessageAt!.toISOString(),
          duration_seconds: durationSeconds,
          outcome: 'completed',
        } : {}),
      });
      if (error) throw error;
    } else if (existing.get(callId) !== 'completed' && settled) {
      const { error } = await supabase.from('calls').update({
        status: 'completed',
        ended_at: lastMessageAt!.toISOString(),
        duration_seconds: durationSeconds,
        outcome: 'completed',
      }).eq('id', callId);
      if (error) throw error;
    }

    if (settled) {
      try {
        await syncCallTranscript(callId, { conversationId: conversation.id, telnyxCallId: callId });
      } catch (error) {
        console.error(`[Inbound reconciliation] Transcript ${callId}:`, error);
      }
    }
  }
}
