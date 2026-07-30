import 'server-only';

import { getSupabaseAdmin, useMockServices } from './supabaseAdmin';
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  isSensitiveValueEncrypted,
} from './sensitiveData';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export type CalendarEventInput = {
  title: string;
  description: string;
  scheduledAt: string;
  durationMin: number;
  timezone: string;
};

type AppsScriptResponse = {
  ok?: boolean;
  id?: string;
  htmlLink?: string | null;
  error?: string;
};

function appsScriptConfig() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  return url && secret ? { url, secret } : null;
}

export function isGoogleAppsScriptConfigured() {
  return Boolean(appsScriptConfig());
}

async function callGoogleAppsScript(payload: Record<string, unknown>) {
  const config = appsScriptConfig();
  if (!config) throw new Error('Google Apps Script no está configurado.');

  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, secret: config.secret }),
    redirect: 'follow',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google Apps Script respondió con estado ${response.status}.`);

  const result = (await response.json()) as AppsScriptResponse;
  if (!result.ok) throw new Error(result.error || 'Google Apps Script rechazó la solicitud.');
  return result;
}

export async function testGoogleAppsScriptConnection() {
  await callGoogleAppsScript({ action: 'health' });
}

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Faltan credenciales OAuth de Google.');
  return { clientId, clientSecret, redirectUri };
}

export function getGoogleAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = googleConfig();
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: GOOGLE_SCOPE,
    access_type: 'offline', include_granted_scopes: 'true', prompt: 'consent', state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string) {
  const { clientId, clientSecret, redirectUri } = googleConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!response.ok) throw new Error(`Google OAuth rechazó el código (${response.status}).`);
  return response.json() as Promise<{ access_token: string; refresh_token?: string }>;
}

async function getGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!response.ok) throw new Error(`No se pudo renovar Google Calendar (${response.status}).`);
  return (await response.json()).access_token as string;
}

export async function createCalendarEvent(input: CalendarEventInput) {
  if (useMockServices) return { id: `google_mock_${Date.now()}`, htmlLink: null };
  if (isGoogleAppsScriptConfigured()) {
    const event = await callGoogleAppsScript({ action: 'createEvent', ...input });
    if (!event.id) throw new Error('Google Apps Script no devolvió el ID del evento.');
    return { id: event.id, htmlLink: event.htmlLink || null };
  }

  const supabase = getSupabaseAdmin();
  const { data: settings, error } = await supabase!.from('settings').select('google_refresh_token').eq('id', 'default').single();
  if (error || !settings?.google_refresh_token) throw new Error('Google Calendar no está conectado.');

  const refreshToken = decryptSensitiveValue(
    settings.google_refresh_token,
    'google-refresh-token',
  );
  if (!isSensitiveValueEncrypted(settings.google_refresh_token)) {
    const encrypted = encryptSensitiveValue(refreshToken, 'google-refresh-token');
    const { error: migrationError } = await supabase!
      .from('settings')
      .update({ google_refresh_token: encrypted, updated_at: new Date().toISOString() })
      .eq('id', 'default');
    if (migrationError) throw migrationError;
  }
  const accessToken = await getGoogleAccessToken(refreshToken);
  const start = new Date(input.scheduledAt);
  const end = new Date(start.getTime() + input.durationMin * 60_000);
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: input.title, description: input.description,
      start: { dateTime: start.toISOString(), timeZone: input.timezone },
      end: { dateTime: end.toISOString(), timeZone: input.timezone },
    }),
  });
  if (!response.ok) throw new Error(`Google Calendar no pudo crear el evento (${response.status}).`);
  return response.json() as Promise<{ id: string; htmlLink?: string }>;
}
