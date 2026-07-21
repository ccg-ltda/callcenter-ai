import 'server-only';

import type { TranscriptTurn } from '@/lib/mockData';
import { summarizeCall } from '@/lib/server/aiSummaryService';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { telnyxService, type TelnyxConversationMessage } from '@/lib/telnyxService';

type RawTranscriptTurn = TelnyxConversationMessage & {
  from?: string;
  timestamp?: string;
  transcript?: string;
};

export function normalizeTranscript(raw: unknown): TranscriptTurn[] {
  if (!Array.isArray(raw)) return [];

  return (raw as RawTranscriptTurn[])
    .filter((turn) => !turn.role || ['assistant', 'agent', 'user'].includes(turn.role))
    .map((turn) => ({
      role: (turn.role === 'assistant' || turn.role === 'agent' || turn.from === 'ai' ? 'agent' : 'user') as 'agent' | 'user',
      text: turn.text || turn.content || turn.transcript || '',
      timestamp: turn.timestamp || turn.sent_at || turn.created_at || new Date().toISOString(),
    }))
    .filter((turn) => turn.text.trim().length > 0)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export async function syncCallTranscript(
  callId: string,
  options: { conversationId?: string | null; rawTranscript?: unknown; telnyxCallId?: string | null } = {},
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  let rawTranscript = options.rawTranscript;
  if (!Array.isArray(rawTranscript) || rawTranscript.length === 0) {
    if (options.conversationId) {
      rawTranscript = await telnyxService.getConversationMessages(options.conversationId);
    } else {
      const result = await telnyxService.getConversationMessagesForCall(options.telnyxCallId || callId);
      rawTranscript = result.messages;
    }
  }

  const fullTranscript = normalizeTranscript(rawTranscript);
  // The end event may arrive before Telnyx makes its messages queryable.
  // Leave the row absent so a later reconciliation can retry.
  if (!fullTranscript.length) return null;

  const { data: settings } = await supabase
    .from('settings')
    .select('timezone')
    .eq('id', 'default')
    .maybeSingle();
  const summary = await summarizeCall(fullTranscript, settings?.timezone || 'America/Bogota');
  const transcript = {
    id: `tr_${callId}`,
    call_id: callId,
    full_transcript: fullTranscript,
    ai_summary: summary.summary,
    interested: summary.interested,
    sentiment: summary.sentiment,
    next_steps: summary.nextSteps,
  };
  const { error } = await supabase.from('transcripts').upsert(transcript);
  if (error) throw error;

  return { transcript, summary };
}
