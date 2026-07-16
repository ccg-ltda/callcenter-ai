import Telnyx from 'telnyx';

const apiKey = process.env.TELNYX_API_KEY || '';
const isMock = process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true' || !apiKey;
const connectionId = process.env.TELNYX_CONNECTION_ID || '';

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
  async searchNumbers(countryCode: string = 'US', city: string = '') {
    console.log(`[Telnyx Service] Searching numbers in Country: ${countryCode}, City: ${city} (Mock: ${isMock})`);
    
    if (isMock) {
      // Simulate API lag
      await new Promise(resolve => setTimeout(resolve, 500));
      return [
        { phoneNumber: `+13055550112`, type: 'local', priceMonthly: '2.00', provider: 'Telnyx' },
        { phoneNumber: `+13055550185`, type: 'local', priceMonthly: '2.00', provider: 'Telnyx' },
        { phoneNumber: `+13055550293`, type: 'toll-free', priceMonthly: '5.00', provider: 'Telnyx' },
        { phoneNumber: `+13055550341`, type: 'local', priceMonthly: '2.00', provider: 'Telnyx' },
      ];
    }

    try {
      // Real Telnyx API Call using fetch (more robust than SDK sometimes)
      const params = new URLSearchParams({
        'filter[country_code]': countryCode,
        'filter[limit]': '10',
      });
      if (city.trim()) params.set('filter[locality]', city.trim());
      const url = `https://api.telnyx.com/v2/available_phone_numbers?${params}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(await telnyxService.readErrorDetails(response));
      }
      
      const data = await response.json();
      return (data.data || []).map((num: any) => ({
        phoneNumber: num.phone_number,
        type: num.number_type || 'local',
        priceMonthly: num.cost_information?.monthly_cost || num.cost_information?.upfront_cost || 'Consultar',
        provider: 'Telnyx'
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
  async createAssistant(agentConfig: AgentConfig) {
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
      const response = await fetch('https://api.telnyx.com/v2/ai_assistants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: agentConfig.name,
          voice: agentConfig.voice,
          instructions: agentConfig.script,
          // Telnyx Voice configuration properties
        })
      });

      if (!response.ok) {
        throw new Error(await telnyxService.readErrorDetails(response));
      }

      const data = await response.json();
      return {
        id: data.data.id,
        name: data.data.name,
        voice: data.data.voice,
        script: data.data.instructions,
      };
    } catch (error) {
      console.error('Error creating Telnyx Assistant:', error);
      throw error;
    }
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
      // Trigger outbound call with Telnyx Voice API
      // Note: In Telnyx, to connect a call to an AI assistant, we invoke the call and then apply the assistant, 
      // or we use a Call Control flow with webhook instructions.
      const response = await fetch('https://api.telnyx.com/v2/calls', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: contact.phone,
          from: fromNumber,
          // Connect to the assistant ID on answer
          assistant_id: assistantId,
          connection_id: process.env.TELNYX_CONNECTION_ID || '', // Telnyx Call Control App Connection ID
        })
      });

      if (!response.ok) {
        throw new Error(await telnyxService.readErrorDetails(response));
      }

      const data = await response.json();
      return {
        success: true,
        callId: data.data.call_control_id,
        status: 'queued'
      };
    } catch (error) {
      console.error('Error triggering outbound call:', error);
      throw error;
    }
  }
};
