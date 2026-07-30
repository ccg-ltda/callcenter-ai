import 'server-only';

import { normalizePhoneNumber, validatePhoneNumber } from '@/lib/phoneNumbers';
import { secureTelnyxCallbackUrl } from '@/lib/server/telnyxWebhook';

const apiKey = process.env.TELNYX_API_KEY || '';
const isMock = process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true' || !apiKey;
const connectionId = process.env.TELNYX_CONNECTION_ID || '';
const texmlApplicationName = 'Contact Center IA - Voice Agents';
const assistantModel = process.env.TELNYX_ASSISTANT_MODEL || 'anthropic/claude-haiku-4-5';

const conversationControlInstructions = `

REGLAS DE CONVERSACIÓN TELEFÓNICA:
- Escucha hasta que la persona termine su idea y responde de forma breve y natural.
- Si la persona interrumpe, deja de hablar y atiende lo que está diciendo.
- Si la persona indica claramente que quiere terminar la llamada, por ejemplo: "chao", "hasta luego", "adiós", "gracias, eso es todo", "no deseo continuar", "no estoy interesado" o una despedida equivalente, responde con una despedida amable de una sola frase y usa inmediatamente la herramienta para finalizar la llamada.
- Después de una despedida no hagas más preguntas, no reinicies la conversación y no continúes hablando.
`.trim();

function buildAssistantInstructions(script: string) {
  return `${script.trim()}\n\n${conversationControlInstructions}`;
}

function isRealAssistantId(value: string | null | undefined) {
  return Boolean(value && !value.startsWith('telnyx_asst_') && !value.startsWith('mock_'));
}

function normalizeVoice(voice: string) {
  const legacyVoices: Record<string, string> = {
    telnyx_voice_es_female_1: 'Azure.es-MX-DaliaNeural',
    telnyx_voice_es_male_1: 'Azure.es-MX-JorgeNeural',
    telnyx_voice_en_female_1: 'Azure.en-US-AvaMultilingualNeural',
    telnyx_voice_en_male_1: 'Azure.en-US-BrianMultilingualNeural',
  };
  return legacyVoices[voice] || voice;
}

export interface AgentConfig {
  name: string;
  voice: string;
  script: string;
  goal?: string;
}

export interface ContactCallData {
  phone: string;
  fullName: string;
}

export type TelnyxConversationMessage = {
  role?: string;
  text?: string;
  content?: string;
  created_at?: string;
  sent_at?: string;
};

export type TelnyxConversation = {
  id: string;
  created_at?: string;
  last_message_at?: string | null;
  metadata?: {
    to?: string;
    from?: string;
    call_control_id?: string;
    telnyx_conversation_channel?: string;
  };
};

type TelnyxErrorBody = {
  errors?: Array<{ detail?: string; title?: string; code?: string }> | {
    detail?: string;
  };
  error?: string;
  message?: string;
  detail?: string;
};

type TelnyxAvailableNumber = {
  phone_number?: string;
  number_type?: string;
  cost_information?: {
    monthly_cost?: string;
    upfront_cost?: string;
  };
};

export const telnyxService = {
  isRealAssistantId,
  async listRecentConversations(limit = 20) {
    if (!apiKey) return [] as TelnyxConversation[];

    const params = new URLSearchParams({
      order: 'created_at.desc',
      'page[size]': String(limit),
    });
    const response = await fetch(`https://api.telnyx.com/v2/ai/conversations?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(await telnyxService.readErrorDetails(response));

    const body = await response.json();
    return Array.isArray(body.data) ? body.data as TelnyxConversation[] : [];
  },
  async findConversationIdByCallId(callId: string) {
    if (!apiKey || !callId) return null;

    const params = new URLSearchParams({
      'metadata->call_control_id': `eq.${callId}`,
      order: 'created_at.desc',
      limit: '1',
    });
    const response = await fetch(`https://api.telnyx.com/v2/ai/conversations?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(await telnyxService.readErrorDetails(response));

    const body = await response.json();
    return typeof body.data?.[0]?.id === 'string' ? body.data[0].id as string : null;
  },
  async getConversationMessagesForCall(callId: string) {
    const conversationId = await telnyxService.findConversationIdByCallId(callId);
    if (!conversationId) return { conversationId: null, messages: [] as TelnyxConversationMessage[] };

    return {
      conversationId,
      messages: await telnyxService.getConversationMessages(conversationId),
    };
  },
  async getConversationMessages(conversationId: string) {
    if (!apiKey || !conversationId) return [] as TelnyxConversationMessage[];

    const response = await fetch(
      `https://api.telnyx.com/v2/ai/conversations/${encodeURIComponent(conversationId)}/messages?page[size]=100&page[number]=1`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    );
    if (!response.ok) throw new Error(await telnyxService.readErrorDetails(response));

    const body = await response.json();
    return Array.isArray(body.data) ? body.data as TelnyxConversationMessage[] : [];
  },
  async readErrorDetails(response: Response) {
    const fallback = response.statusText || `HTTP ${response.status}`;
    try {
      const data = await response.json() as TelnyxErrorBody;
      const details = Array.isArray(data?.errors)
        ? data.errors.map((err) => err?.detail || err?.title || err?.code).filter(Boolean).join(' | ')
        : data?.errors?.detail || data?.error || data?.message || data?.detail;
      return details ? `${fallback}: ${details}` : fallback;
    } catch {
      return fallback;
    }
  },
  /**
   * Search for available phone numbers
   */
  async searchNumbers(countryCode: string = 'US', city: string = '', administrativeArea: string = '') {
    const normalizedCountry = countryCode.trim().toUpperCase();
    console.log(`[Telnyx Service] Searching numbers in Country: ${normalizedCountry}, Administrative area: ${administrativeArea}, City: ${city} (Mock: ${isMock})`);
    
    if (isMock) {
      // Simulate API lag
      await new Promise(resolve => setTimeout(resolve, 500));
      return [
        { phoneNumber: `+13055550112`, type: 'local', priceMonthly: '2.00', provider: 'Telnyx', isPurchasable: true },
        { phoneNumber: `+13055550185`, type: 'local', priceMonthly: '2.00', provider: 'Telnyx', isPurchasable: true },
        { phoneNumber: `+13055550293`, type: 'toll-free', priceMonthly: '5.00', provider: 'Telnyx', isPurchasable: true },
        { phoneNumber: `+13055550341`, type: 'local', priceMonthly: '2.00', provider: 'Telnyx', isPurchasable: true },
      ];
    }

    try {
      // Real Telnyx API Call using fetch (more robust than SDK sometimes)
      const params = new URLSearchParams({
        'filter[country_code]': normalizedCountry,
        'filter[limit]': '10',
      });
      if (city.trim()) params.set('filter[locality]', city.trim());
      if (administrativeArea.trim() && ['US', 'CA'].includes(normalizedCountry)) {
        params.set('filter[administrative_area]', administrativeArea.trim().toUpperCase());
      }

      // Telnyx only supports best-effort searches for US and Canada. Without
      // this flag it returns a 400 when a locality has no exact inventory,
      // even though nearby numbers may be available.
      if (['US', 'CA'].includes(normalizedCountry)) {
        params.set('filter[best_effort]', 'true');
      }

      const url = `https://api.telnyx.com/v2/available_phone_numbers?${params}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const details = await telnyxService.readErrorDetails(response);

        // An empty inventory is a valid search result, not an application
        // failure. Return an empty list so the UI can explain it clearly.
        if (/no numbers found/i.test(details)) return [];

        throw new Error(details);
      }
      
      const data = await response.json() as { data?: TelnyxAvailableNumber[] };
      return (data.data || []).map((num) => ({
        phoneNumber: num.phone_number,
        type: num.number_type || 'local',
        priceMonthly: num.cost_information?.monthly_cost || num.cost_information?.upfront_cost || 'Consultar',
        provider: 'Telnyx',
        // Restricted Telnyx accounts receive masked values such as
        // +15619------. Those are previews and cannot be ordered via API.
        isPurchasable: /^\+[1-9]\d{7,14}$/.test(num.phone_number || ''),
      }));
    } catch (error) {
      console.error('Error searching Telnyx numbers:', error);
      throw error;
    }
  },

  /**
   * Purchase a phone number
   */
  async buyNumber(phoneNumber: string) {
    console.log(`[Telnyx Service] Purchasing phone number ${phoneNumber} (Mock: ${isMock})`);
    
    if (isMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        success: true,
        phoneNumber,
        status: 'active',
        id: 'order_' + Math.floor(Math.random() * 10000)
      };
    }

    try {
      const response = await fetch('https://api.telnyx.com/v2/number_orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_numbers: [{ phone_number: phoneNumber }],
          ...(connectionId ? { connection_id: connectionId } : {})
        })
      });

      if (!response.ok) {
        throw new Error(await telnyxService.readErrorDetails(response));
      }

      const data = await response.json();
      return {
        success: true,
        phoneNumber,
        status: data.data.status,
        id: data.data.id
      };
    } catch (error) {
      console.error('Error buying Telnyx number:', error);
      throw error;
    }
  },

  /**
   * Create an AI Assistant
   */
  async createAssistant(agentConfig: AgentConfig, existingAssistantId?: string | null) {
    console.log(`[Telnyx Service] Creating AI Assistant for: ${agentConfig.name} (Mock: ${isMock})`);
    
    if (isMock) {
      return {
        id: 'mock_assistant_' + Math.floor(Math.random() * 100000),
        name: agentConfig.name,
        voice: agentConfig.voice,
        script: agentConfig.script,
      };
    }

    try {
      const assistantId = isRealAssistantId(existingAssistantId) ? existingAssistantId : null;
      const response = await fetch(`https://api.telnyx.com/v2/ai/assistants${assistantId ? `/${assistantId}` : ''}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: agentConfig.name,
          model: assistantModel,
          instructions: buildAssistantInstructions(agentConfig.script),
          greeting: 'Hola, soy tu asistente virtual. ¿En qué puedo ayudarte?',
          enabled_features: ['telephony'],
          tools: [
            {
              type: 'hangup',
              hangup: {
                description: 'Finaliza la llamada cuando la persona se despida, solicite terminar, diga que no desea continuar o cuando el objetivo de la conversación ya haya concluido. Antes de usarla, di una despedida amable de una sola frase.',
              },
            },
          ],
          transcription: {
            model: 'azure/fast',
            language: 'es-CO',
            region: 'latency',
          },
          interruption_settings: {
            enable: true,
            disable_greeting_interruption: false,
            start_speaking_plan: {
              wait_seconds: 0.3,
              transcription_endpointing_plan: {
                on_punctuation_seconds: 0.1,
                on_no_punctuation_seconds: 0.8,
                on_number_seconds: 0.5,
              },
            },
          },
          voice_settings: {
            voice: normalizeVoice(agentConfig.voice),
          },
        })
      });

      if (!response.ok) {
        throw new Error(await telnyxService.readErrorDetails(response));
      }

      const data = await response.json();
      return {
        id: data.id,
        name: data.name,
        voice: data.voice_settings?.voice || normalizeVoice(agentConfig.voice),
        script: data.instructions,
      };
    } catch (error) {
      console.error('Error creating Telnyx Assistant:', error);
      throw error;
    }
  },

  async ensureTexmlApplication() {
    if (connectionId) return connectionId;

    const voiceBaseUrl = process.env.TELNYX_TEXML_VOICE_URL || 'https://callcenter-ai-tau.vercel.app/api/telnyx/texml';
    const webhookBaseUrl = process.env.TELNYX_WEBHOOK_URL || new URL('/api/telnyx/webhook', voiceBaseUrl).toString();
    const voiceUrl = secureTelnyxCallbackUrl(voiceBaseUrl);
    const webhookUrl = secureTelnyxCallbackUrl(webhookBaseUrl);

    const listParams = new URLSearchParams({
      'filter[friendly_name]': texmlApplicationName,
      'page[size]': '1',
    });
    const listResponse = await fetch(`https://api.telnyx.com/v2/texml_applications?${listParams}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!listResponse.ok) throw new Error(await telnyxService.readErrorDetails(listResponse));
    const applications = await listResponse.json();
    const existingApplication = applications.data?.find((application: {
      friendly_name?: string;
      id?: string;
      status_callback?: string;
      voice_url?: string;
    }) =>
      application.friendly_name === texmlApplicationName && application.id
    );
    if (existingApplication?.id) {
      if (existingApplication.voice_url === voiceUrl && existingApplication.status_callback === webhookUrl) {
        return existingApplication.id as string;
      }
      const updateResponse = await fetch(`https://api.telnyx.com/v2/texml_applications/${existingApplication.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voice_url: voiceUrl,
          status_callback: webhookUrl,
          status_callback_method: 'post',
        }),
      });
      if (!updateResponse.ok) throw new Error(await telnyxService.readErrorDetails(updateResponse));
      return existingApplication.id as string;
    }

    const profilesResponse = await fetch('https://api.telnyx.com/v2/outbound_voice_profiles?page[size]=1', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!profilesResponse.ok) throw new Error(await telnyxService.readErrorDetails(profilesResponse));
    const profiles = await profilesResponse.json();
    let outboundVoiceProfileId = profiles.data?.[0]?.id || '';

    if (!outboundVoiceProfileId) {
      const createProfileResponse = await fetch('https://api.telnyx.com/v2/outbound_voice_profiles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Contact Center IA' }),
      });
      if (!createProfileResponse.ok) throw new Error(await telnyxService.readErrorDetails(createProfileResponse));
      const profile = await createProfileResponse.json();
      outboundVoiceProfileId = profile.data?.id || '';
    }

    const createApplicationResponse = await fetch('https://api.telnyx.com/v2/texml_applications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        friendly_name: texmlApplicationName,
        voice_url: voiceUrl,
        status_callback: webhookUrl,
        status_callback_method: 'post',
        active: true,
        ...(outboundVoiceProfileId ? { outbound: { outbound_voice_profile_id: outboundVoiceProfileId } } : {}),
      }),
    });
    if (!createApplicationResponse.ok) {
      throw new Error(await telnyxService.readErrorDetails(createApplicationResponse));
    }
    const application = await createApplicationResponse.json();
    if (!application.data?.id) throw new Error('Telnyx no devolvió el ID de la aplicación de voz.');
    return application.data.id as string;
  },

  async assignNumberToAssistant(phoneNumber: string, assistantId: string, statusCallbackUrl: string) {
    if (isMock) return { success: true };

    const normalized = normalizePhoneNumber(phoneNumber);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new Error('El número configurado no es válido para recibir llamadas.');
    }

    const ownershipResponse = await fetch('https://api.telnyx.com/v2/phone_numbers/actions/verify_ownership', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone_numbers: [normalized] }),
    });
    if (!ownershipResponse.ok) {
      throw new Error(await telnyxService.readErrorDetails(ownershipResponse));
    }

    const ownership = await ownershipResponse.json();
    const phoneNumberId = ownership.data?.found?.[0]?.id;
    if (!phoneNumberId) {
      throw new Error('El número no pertenece a la cuenta de Telnyx configurada.');
    }

    if (!isRealAssistantId(assistantId)) {
      throw new Error('El agente no tiene un asistente real de Telnyx.');
    }

    const assistantTexmlUrl = `https://api.telnyx.com/v2/ai/assistants/${encodeURIComponent(assistantId)}/texml`;
    const applicationsResponse = await fetch('https://api.telnyx.com/v2/texml_applications?page[size]=250', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!applicationsResponse.ok) {
      throw new Error(await telnyxService.readErrorDetails(applicationsResponse));
    }
    const applications = await applicationsResponse.json();
    const assistantApplication = applications.data?.find((application: { id?: string; voice_url?: string }) =>
      application.id && application.voice_url === assistantTexmlUrl
    );
    if (!assistantApplication?.id) {
      throw new Error('Telnyx todavía no creó la aplicación de voz del asistente. Guarda nuevamente el agente e intenta otra vez.');
    }

    const texmlApplicationId = assistantApplication.id as string;
    const applicationUpdateResponse = await fetch(
      `https://api.telnyx.com/v2/texml_applications/${encodeURIComponent(texmlApplicationId)}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status_callback: statusCallbackUrl,
          status_callback_method: 'post',
        }),
      },
    );
    if (!applicationUpdateResponse.ok) {
      throw new Error(await telnyxService.readErrorDetails(applicationUpdateResponse));
    }
    const updatedApplication = await applicationUpdateResponse.json();
    if (updatedApplication.data?.status_callback !== statusCallbackUrl) {
      throw new Error('Telnyx no guardó la URL de eventos de llamadas. Intenta activar nuevamente el agente.');
    }

    const updateResponse = await fetch(`https://api.telnyx.com/v2/phone_numbers/${encodeURIComponent(phoneNumberId)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ connection_id: texmlApplicationId }),
    });
    if (!updateResponse.ok) {
      throw new Error(await telnyxService.readErrorDetails(updateResponse));
    }

    return { success: true, connectionId: texmlApplicationId, assistantId };
  },

  /**
   * Trigger an outbound call connected to the assistant
   */
  async startCall(contact: ContactCallData, assistantId: string, fromNumber: string) {
    console.log(`[Telnyx Service] Triggering outbound call to: ${contact.phone} connected to assistant: ${assistantId} (Mock: ${isMock})`);
    
    if (isMock) {
      const callId = 'mock_call_' + Math.floor(Math.random() * 1000000);
      return {
        success: true,
        callId,
        status: 'queued'
      };
    }

    try {
      const destination = validatePhoneNumber(contact.phone);
      const toNumber = destination.normalized;
      const fromPhoneNumber = normalizePhoneNumber(fromNumber);
      if (!destination.valid) {
        throw new Error(destination.error || 'El número de destino no es válido.');
      }
      if (!/^\+[1-9]\d{7,14}$/.test(fromPhoneNumber)) {
        throw new Error('No hay un número Telnyx válido configurado como línea saliente.');
      }
      if (!isRealAssistantId(assistantId)) {
        throw new Error('El agente todavía no está conectado con un asistente real de Telnyx. Vuelve a guardarlo e intenta de nuevo.');
      }

      const texmlApplicationId = await telnyxService.ensureTexmlApplication();
      const response = await fetch(`https://api.telnyx.com/v2/texml/ai_calls/${texmlApplicationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          To: toNumber,
          From: fromPhoneNumber,
          AIAssistantId: assistantId,
          AIAssistantDynamicVariables: {
            full_name: contact.fullName,
          },
        })
      });

      if (!response.ok) {
        throw new Error(await telnyxService.readErrorDetails(response));
      }

      const data = await response.json();
      return {
        success: true,
        callId: data.call_sid,
        status: data.status || 'queued'
      };
    } catch (error) {
      console.error('Error triggering outbound call:', error);
      throw error;
    }
  }
};
