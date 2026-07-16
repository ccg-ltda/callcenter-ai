import 'server-only';

import type { TranscriptTurn } from '@/lib/mockData';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CallSummary = {
  summary: string;
  interested: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  nextSteps: string;
  proposedDateTime: string | null;
};

function fallbackSummary(transcript: TranscriptTurn[]): CallSummary {
  const text = transcript.map((turn) => turn.text).join(' ').toLowerCase();
  const interested = /\b(sí|si|claro|interesad[oa]|reunión|agenda|demo)\b/.test(text);
  const negative = /\b(no me interesa|no llamar|sin presupuesto|no gracias)\b/.test(text);

  return {
    summary: transcript.length
      ? `La llamada tuvo ${transcript.length} intervenciones. El contacto ${interested && !negative ? 'mostró interés y aceptó continuar la conversación' : 'no confirmó interés comercial'}.`
      : 'La llamada terminó sin una transcripción utilizable.',
    interested: interested && !negative,
    sentiment: negative ? 'negative' : interested ? 'positive' : 'neutral',
    nextSteps: interested && !negative ? 'Confirmar disponibilidad y enviar la invitación de calendario.' : 'Registrar el resultado y evaluar un seguimiento posterior.',
    proposedDateTime: null,
  };
}

export async function summarizeCall(transcript: TranscriptTurn[], timezone: string): Promise<CallSummary> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true') return fallbackSummary(transcript);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL || 'gpt-5-mini',
      store: false,
      input: [
        { role: 'system', content: `Analiza llamadas comerciales en español. Extrae solo información explícita. Zona horaria: ${timezone}. Si no se acordó fecha y hora exactas, proposedDateTime debe ser null.` },
        { role: 'user', content: JSON.stringify(transcript) },
      ],
      text: {
        format: {
          type: 'json_schema', name: 'call_summary', strict: true,
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              interested: { type: 'boolean' },
              sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
              nextSteps: { type: 'string' },
              proposedDateTime: { type: ['string', 'null'], description: 'ISO 8601 con offset o null' },
            },
            required: ['summary', 'interested', 'sentiment', 'nextSteps', 'proposedDateTime'],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    console.error('[AI Summary] OpenAI error', response.status, await response.text());
    return fallbackSummary(transcript);
  }

  const data = await response.json();
  const outputText = data.output_text ?? data.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === 'output_text')?.text;
  if (!outputText) return fallbackSummary(transcript);

  try {
    return JSON.parse(outputText) as CallSummary;
  } catch {
    return fallbackSummary(transcript);
  }
}
