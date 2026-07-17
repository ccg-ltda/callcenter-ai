import Telnyx from 'telnyx';

const apiKey = process.env.TELNYX_API_KEY || '';
const isMock = process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true' || !apiKey;
const connectionId = process.env.TELNYX_CONNECTION_ID || '';
const texmlApplicationName = 'Contact Center IA - Voice Agents';

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

// Initialize Telnyx client if not in mock mode
let telnyxClient: any = null;
if (!isMock) {
  try {
    telnyxClient = new Telnyx(apiKey as any);
  } catch (error) {
    console.error('Failed to initialize Telnyx SDK:', error);
  }
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

export const telnyxService = {
  isRealAssistantId,
  async readErrorDetails(response: Response) {
    const fallback = response.statusText || `HTTP ${response.status}`;
    try {
      const data = await response.json();
      const details = Array.isArray(data?.errors)
        ? data.errors.map((err: any) => err?.detail || err?.title || err?.code).filter(Boolean).join(' | ')
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
      
      const data = await response.json();
      return (data.data || []).map((num: any) => ({
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
          instructions: agentConfig.script,
          greeting: 'Hola, soy tu asistente virtual. ¿En qué puedo ayudarte?',
          enabled_features: ['telephony'],
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

    const listParams = new URLSearchParams({
      'filter[friendly_name]': texmlApplicationName,
      'page[size]': '1',
    });
    const listResponse = await fetch(`https://api.telnyx.com/v2/texml_applications?${listParams}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!listResponse.ok) throw new Error(await telnyxService.readErrorDetails(listResponse));
    const applications = await listResponse.json();
    const existingApplication = applications.data?.find((application: { friendly_name?: string; id?: string }) =>
      application.friendly_name === texmlApplicationName && application.id
    );
    if (existingApplication?.id) return existingApplication.id as string;

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

    const voiceUrl = process.env.TELNYX_TEXML_VOICE_URL || 'https://callcenter-ai-tau.vercel.app/api/telnyx/texml';
    const createApplicationResponse = await fetch('https://api.telnyx.com/v2/texml_applications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        friendly_name: texmlApplicationName,
        voice_url: voiceUrl,
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
      if (!/^\+[1-9]\d{7,14}$/.test(contact.phone)) {
        throw new Error('El número de destino debe incluir el código de país, por ejemplo +573001234567.');
      }
      if (!/^\+[1-9]\d{7,14}$/.test(fromNumber)) {
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
          To: contact.phone,
          From: fromNumber,
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
