import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { TelnyxWebhook } from 'telnyx/lib/webhooks.js';

const MAX_WEBHOOK_BYTES = 512_000;

function legacyCallbackToken() {
  const secret = process.env.TELNYX_WEBHOOK_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return '';
  return createHmac('sha256', secret)
    .update('callcenter-ia:telnyx-callback:v1')
    .digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function secureTelnyxCallbackUrl(value: string) {
  const token = legacyCallbackToken();
  if (!token) throw new Error('Falta configurar TELNYX_WEBHOOK_SECRET o AUTH_SECRET.');
  const url = new URL(value);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function readTelnyxBody(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_WEBHOOK_BYTES) {
    throw new Error('El webhook excede el tamaño permitido.');
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) {
    throw new Error('El webhook excede el tamaño permitido.');
  }
  return rawBody;
}

export async function verifyTelnyxRequest(request: Request, rawBody: string) {
  const signature = request.headers.get('telnyx-signature-ed25519');
  const timestamp = request.headers.get('telnyx-timestamp');
  if (signature || timestamp) {
    const configuredKey = process.env.TELNYX_PUBLIC_KEY?.trim();
    if (!configuredKey) {
      throw new Error('TELNYX_PUBLIC_KEY no está configurada.');
    }

    const verifier = new TelnyxWebhook(configuredKey);
    await verifier.verify(rawBody, Object.fromEntries(request.headers.entries()));
    return;
  }

  const receivedToken = new URL(request.url).searchParams.get('token') || '';
  const expectedToken = legacyCallbackToken();
  if (!receivedToken || !expectedToken || !safeEqual(receivedToken, expectedToken)) {
    throw new Error('La autenticidad del callback de Telnyx no pudo verificarse.');
  }
}
