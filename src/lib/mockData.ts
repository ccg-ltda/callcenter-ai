export type TranscriptTurn = {
  role: 'agent' | 'user';
  text: string;
  timestamp: string;
};

const now = Date.now();

export const mockCalls = [
  {
    id: 'call_101', campaignId: 'camp_001', telnyxCallId: 'mock_call_101', status: 'completed',
    startedAt: new Date(now - 3_600_000).toISOString(), endedAt: new Date(now - 3_552_000).toISOString(),
    durationSeconds: 48, costUsd: 0.052, recordingUrl: null, outcome: 'meeting_booked',
    contact: { id: 'c1', fullName: 'Juan Pérez', phone: '+57 300 555 0101', company: 'Initech' },
  },
  {
    id: 'call_102', campaignId: 'camp_001', telnyxCallId: 'mock_call_102', status: 'in_progress',
    startedAt: new Date(now - 74_000).toISOString(), endedAt: null, durationSeconds: 74,
    costUsd: 0.008, recordingUrl: null, outcome: null,
    contact: { id: 'c2', fullName: 'María García', phone: '+57 310 555 0102', company: 'Globex' },
  },
  {
    id: 'call_103', campaignId: 'camp_001', telnyxCallId: 'mock_call_103', status: 'ringing',
    startedAt: new Date(now - 12_000).toISOString(), endedAt: null, durationSeconds: 12,
    costUsd: 0, recordingUrl: null, outcome: null,
    contact: { id: 'c3', fullName: 'Carlos López', phone: '+57 315 555 0103', company: 'Acme' },
  },
  {
    id: 'call_104', campaignId: 'camp_001', telnyxCallId: 'mock_call_104', status: 'queued',
    startedAt: null, endedAt: null, durationSeconds: 0, costUsd: 0,
    recordingUrl: null, outcome: null,
    contact: { id: 'c4', fullName: 'Laura Torres', phone: '+57 320 555 0104', company: 'Umbrella' },
  },
];

export const mockTranscripts = [
  {
    id: 'tr_call_101', callId: 'call_101', createdAt: new Date(now - 3_550_000).toISOString(),
    aiSummary: 'Juan mostró interés en automatizar la prospección comercial. Acordó una demostración para revisar el flujo de campañas y los costos.',
    interested: true, sentiment: 'positive', nextSteps: 'Realizar demo y enviar propuesta comercial.',
    fullTranscript: [
      { role: 'agent', text: 'Hola Juan, soy el asistente virtual de Contact Center IA. Esta llamada puede ser grabada. ¿Tienes un minuto?', timestamp: new Date(now - 3_600_000).toISOString() },
      { role: 'user', text: 'Sí, claro. Cuéntame.', timestamp: new Date(now - 3_590_000).toISOString() },
      { role: 'agent', text: 'Ayudamos a equipos comerciales a agendar reuniones con llamadas de IA. ¿Te interesaría ver una demo?', timestamp: new Date(now - 3_580_000).toISOString() },
      { role: 'user', text: 'Sí, el viernes a las diez me funciona.', timestamp: new Date(now - 3_565_000).toISOString() },
    ] as TranscriptTurn[],
    call: mockCalls[0],
  },
  {
    id: 'tr_call_099', callId: 'call_099', createdAt: new Date(now - 86_400_000).toISOString(),
    aiSummary: 'El contacto escuchó la propuesta, pero no tiene presupuesto durante este trimestre.',
    interested: false, sentiment: 'neutral', nextSteps: 'Retomar contacto en tres meses.',
    fullTranscript: [
      { role: 'agent', text: '¿Están evaluando nuevas herramientas de prospección?', timestamp: new Date(now - 86_430_000).toISOString() },
      { role: 'user', text: 'Ahora no tenemos presupuesto, quizá el próximo trimestre.', timestamp: new Date(now - 86_420_000).toISOString() },
    ] as TranscriptTurn[],
    call: { ...mockCalls[0], id: 'call_099', durationSeconds: 31, outcome: 'not_interested', contact: { id: 'c9', fullName: 'Ana Martínez', phone: '+57 301 555 0199', company: 'Stark Industries' } },
  },
];

export const mockMeetings = [
  { id: 'mtg_1', callId: 'call_101', contactId: 'c1', scheduledAt: new Date(now + 3_600_000 * 4).toISOString(), durationMin: 15, googleEventId: 'google_mock_1', status: 'scheduled', contact: mockCalls[0].contact },
  { id: 'mtg_2', callId: 'call_088', contactId: 'c8', scheduledAt: new Date(now + 86_400_000 + 3_600_000 * 2).toISOString(), durationMin: 30, googleEventId: 'google_mock_2', status: 'scheduled', contact: { id: 'c8', fullName: 'Sofía Ramírez', phone: '+57 302 555 0188', company: 'Wayne Enterprises' } },
  { id: 'mtg_3', callId: 'call_077', contactId: 'c7', scheduledAt: new Date(now + 86_400_000 * 2 + 3_600_000 * 5).toISOString(), durationMin: 15, googleEventId: null, status: 'scheduled', contact: { id: 'c7', fullName: 'Diego Castro', phone: '+57 303 555 0177', company: 'Hooli' } },
];

export const mockKpis = {
  summary: { callsMade: 148, callsAnswered: 95, conversations: 68, meetingsBooked: 25, minutesTalked: 423.5, totalCostUsd: 35.5, costPerMeeting: 1.42, contactRate: 64.2, closeRate: 26.3 },
  daily: [
    { date: '2026-07-09', callsMade: 18, callsAnswered: 11, meetingsBooked: 2, minutesTalked: 48, costUsd: 4.2, costPerMeeting: 2.1 },
    { date: '2026-07-10', callsMade: 24, callsAnswered: 16, meetingsBooked: 5, minutesTalked: 71, costUsd: 5.4, costPerMeeting: 1.08 },
    { date: '2026-07-11', callsMade: 21, callsAnswered: 13, meetingsBooked: 3, minutesTalked: 59, costUsd: 4.8, costPerMeeting: 1.6 },
    { date: '2026-07-12', callsMade: 29, callsAnswered: 20, meetingsBooked: 6, minutesTalked: 83, costUsd: 7.1, costPerMeeting: 1.18 },
    { date: '2026-07-13', callsMade: 26, callsAnswered: 17, meetingsBooked: 4, minutesTalked: 72, costUsd: 6.2, costPerMeeting: 1.55 },
    { date: '2026-07-14', callsMade: 17, callsAnswered: 10, meetingsBooked: 2, minutesTalked: 43, costUsd: 3.8, costPerMeeting: 1.9 },
    { date: '2026-07-15', callsMade: 13, callsAnswered: 8, meetingsBooked: 3, minutesTalked: 47.5, costUsd: 4, costPerMeeting: 1.33 },
  ],
  outcomes: [
    { name: 'Reunión', value: 25, color: '#3b82f6' },
    { name: 'Interesado', value: 43, color: '#8b5cf6' },
    { name: 'No interesado', value: 42, color: '#3b82f6' },
    { name: 'No contestó', value: 38, color: '#52525b' },
  ],
  heatmap: Array.from({ length: 5 }, (_, day) => Array.from({ length: 9 }, (_, hour) => ({ day, hour: hour + 9, value: ((day * 7 + hour * 3) % 9) + 1 }))).flat(),
};
