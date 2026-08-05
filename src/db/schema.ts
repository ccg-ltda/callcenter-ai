import { pgTable, text, boolean, integer, real, jsonb, timestamp } from 'drizzle-orm/pg-core';

// Configuración de la cuenta del usuario
export const settings = pgTable('settings', {
  id: text('id').primaryKey().default('default'),
  telnyxApiKey: text('telnyx_api_key'),
  telnyxPhoneNumber: text('telnyx_phone_number'),
  telnyxAssistantId: text('telnyx_assistant_id'),
  inboundAgentId: text('inbound_agent_id'),
  googleCalendarConnected: boolean('google_calendar_connected').default(false),
  googleRefreshToken: text('google_refresh_token'),
  callWindowStart: text('call_window_start').default('10:00'),
  callWindowEnd: text('call_window_end').default('18:00'),
  timezone: text('timezone').default('America/Argentina/Buenos_Aires'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Agente de IA configurado
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  voice: text('voice').notNull(),
  script: text('script').notNull(),
  goal: text('goal').default('agendar_reunion'),
  meetingDurationMin: integer('meeting_duration_min').default(15),
  telnyxAssistantId: text('telnyx_assistant_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Campañas
// Inventario de líneas Telnyx. Cada número puede tener su propio agente entrante.
export const phoneNumbers = pgTable('phone_numbers', {
  phoneNumber: text('phone_number').primaryKey(),
  telnyxId: text('telnyx_id'),
  status: text('status').default('active'),
  inboundAgentId: text('inbound_agent_id').references(() => agents.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  agentId: text('agent_id').references(() => agents.id),
  outboundPhoneNumber: text('outbound_phone_number'),
  maxConcurrentCalls: integer('max_concurrent_calls').default(1).notNull(),
  status: text('status').default('draft'), // draft, active, paused, finished
  totalContacts: integer('total_contacts').default(0),
  callsMade: integer('calls_made').default(0),
  meetingsBooked: integer('meetings_booked').default(0),
  totalCostUsd: real('total_cost_usd').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  launchedAt: timestamp('launched_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

// Contactos
export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').references(() => campaigns.id),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  company: text('company'),
  customFields: jsonb('custom_fields'),
  status: text('status').default('pending'), // pending, calling, answered, no_answer, failed, scheduled
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Llamadas
export const calls = pgTable('calls', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').references(() => contacts.id),
  campaignId: text('campaign_id').references(() => campaigns.id),
  agentId: text('agent_id').references(() => agents.id),
  telnyxCallId: text('telnyx_call_id'),
  direction: text('direction').default('outbound'), // inbound, outbound
  fromNumber: text('from_number'),
  toNumber: text('to_number'),
  status: text('status').default('queued'), // queued, ringing, in_progress, completed, failed
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds').default(0),
  costUsd: real('cost_usd').default(0),
  recordingUrl: text('recording_url'),
  outcome: text('outcome'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Transcripciones y resúmenes
export const transcripts = pgTable('transcripts', {
  id: text('id').primaryKey(),
  callId: text('call_id').references(() => calls.id),
  fullTranscript: jsonb('full_transcript'), // List format: [{ role: 'agent'|'user', text: string, timestamp: string }]
  aiSummary: text('ai_summary'),
  interested: boolean('interested'),
  sentiment: text('sentiment'),
  nextSteps: text('next_steps'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Reuniones agendadas
export const meetings = pgTable('meetings', {
  id: text('id').primaryKey(),
  callId: text('call_id').references(() => calls.id),
  contactId: text('contact_id').references(() => contacts.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').default(15),
  googleEventId: text('google_event_id'),
  status: text('status').default('scheduled'), // scheduled, cancelled
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Métricas diarias agregadas
export const dailyMetrics = pgTable('daily_metrics', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  campaignId: text('campaign_id').references(() => campaigns.id),
  callsMade: integer('calls_made').default(0),
  callsAnswered: integer('calls_answered').default(0),
  meetingsBooked: integer('meetings_booked').default(0),
  minutesTalked: real('minutes_talked').default(0),
  costUsd: real('cost_usd').default(0),
});

// Controles operativos de seguridad. No deben exponerse a anon/authenticated.
export const processedWebhookEvents = pgTable('processed_webhook_events', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const securityRateLimits = pgTable('security_rate_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').default(0).notNull(),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).defaultNow().notNull(),
});
