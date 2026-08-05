import 'server-only';

import { telnyxService } from '@/lib/telnyxService';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

interface ClaimedContact {
  contact_id: string;
  full_name: string;
  phone: string;
  custom_fields: Record<string, unknown> | null;
}

interface DispatchOptions {
  refreshAssistant?: boolean;
}

export interface DispatchResult {
  callsQueued: number;
  failedCalls: Array<{ contactId: string; name: string; error: string }>;
}

export async function dispatchCampaignCalls(
  campaignId: string,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { callsQueued: 0, failedCalls: [] };

  const [{ data: campaign, error: campaignError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle(),
    supabase.from('settings').select('telnyx_phone_number, telnyx_assistant_id').eq('id', 'default').maybeSingle(),
  ]);
  if (campaignError) throw campaignError;
  if (settingsError) throw settingsError;
  if (!campaign || campaign.status !== 'active') return { callsQueued: 0, failedCalls: [] };

  const outboundPhoneNumber = campaign.outbound_phone_number || settings?.telnyx_phone_number;
  if (!outboundPhoneNumber) throw new Error('Configura primero el número Telnyx.');

  const { data: agent, error: agentError } = campaign.agent_id
    ? await supabase
        .from('agents')
        .select('name, voice, script, goal, telnyx_assistant_id')
        .eq('id', campaign.agent_id)
        .maybeSingle()
    : { data: null, error: null };
  if (agentError) throw agentError;

  let assistantId = agent?.telnyx_assistant_id || settings?.telnyx_assistant_id;
  if (!assistantId) throw new Error('La campaña no tiene un asistente Telnyx configurado.');

  if (options.refreshAssistant && agent) {
    const assistant = await telnyxService.createAssistant({
      name: agent.name,
      voice: agent.voice,
      script: agent.script,
      goal: agent.goal,
    }, assistantId);
    assistantId = assistant.id;
    const { error } = await supabase
      .from('agents')
      .update({ telnyx_assistant_id: assistantId })
      .eq('id', campaign.agent_id);
    if (error) throw error;
  }

  let callsQueued = 0;
  const failedCalls: DispatchResult['failedCalls'] = [];

  while (true) {
    const claimedContacts: ClaimedContact[] = [];
    while (true) {
      const { data, error: claimError } = await supabase.rpc('claim_next_campaign_contact', {
        p_campaign_id: campaignId,
      });
      if (claimError) {
        if (['42883', 'PGRST202'].includes(claimError.code || '')) {
          throw new Error('Aplica la migración 0004 para habilitar las llamadas simultáneas.');
        }
        throw claimError;
      }

      const contact = (Array.isArray(data) ? data[0] : data) as ClaimedContact | undefined;
      if (!contact) break;
      claimedContacts.push(contact);
    }
    if (!claimedContacts.length) break;

    // All reserved slots are dialed together, so a limit of five produces five
    // concurrent outbound requests instead of spacing them out serially.
    await Promise.all(claimedContacts.map(async (contact) => {
      try {
        const result = await telnyxService.startCall(
          { phone: contact.phone, fullName: contact.full_name },
          assistantId,
          outboundPhoneNumber,
        );
        if (!result.success) throw new Error('Telnyx no pudo iniciar la llamada.');

        const callId = result.callId || `call_${crypto.randomUUID()}`;
        const { error: insertError } = await supabase.from('calls').insert({
          id: callId,
          contact_id: contact.contact_id,
          campaign_id: campaignId,
          agent_id: campaign.agent_id,
          telnyx_call_id: callId,
          direction: 'outbound',
          from_number: outboundPhoneNumber,
          to_number: contact.phone,
          status: result.status || 'queued',
        });
        if (insertError) throw insertError;
        callsQueued++;
      } catch (error) {
        console.error(`[Campaign] Contact ${contact.contact_id} failed`, error);
        const message = error instanceof Error ? error.message : 'Telnyx rechazó la llamada.';
        const customFields = contact.custom_fields && typeof contact.custom_fields === 'object'
          ? { ...contact.custom_fields, callError: message }
          : { callError: message };
        await supabase
          .from('contacts')
          .update({ status: 'failed', custom_fields: customFields })
          .eq('id', contact.contact_id);
        failedCalls.push({ contactId: contact.contact_id, name: contact.full_name, error: message });
      }
    }));
  }

  return { callsQueued, failedCalls };
}
