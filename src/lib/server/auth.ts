import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-callcenter_session' : 'callcenter_session';
export const AUTH_SESSION_MAX_AGE = 60 * 60 * 8;

function getCredentials() {
  return {
    username: process.env.AUTH_USERNAME?.trim() || '',
    password: process.env.AUTH_PASSWORD || '',
    secret: process.env.AUTH_SECRET || '',
  };
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function isAuthConfigured() {
  return getAuthConfigurationIssue() === null;
}

export function getAuthConfigurationIssue() {
  const { username, password, secret } = getCredentials();
  const missing = [
    !username ? 'AUTH_USERNAME' : '',
    !password ? 'AUTH_PASSWORD' : '',
    !secret ? 'AUTH_SECRET' : '',
  ].filter(Boolean);

  if (missing.length) {
    return `Falta configurar ${missing.join(', ')} en el entorno de este deployment.`;
  }

  if (secret.length < 32) {
    return `AUTH_SECRET tiene ${secret.length} caracteres y debe tener al menos 32.`;
  }

  if (password.length < 12) {
    return 'AUTH_PASSWORD debe tener al menos 12 caracteres.';
  }

  return null;
}

export function verifyCredentials(username: string, password: string) {
  const credentials = getCredentials();
  if (!isAuthConfigured()) return false;

  return safeEqual(username.trim(), credentials.username) && safeEqual(password, credentials.password);
}

export function createSessionToken() {
  const { secret } = getCredentials();
  if (!isAuthConfigured()) throw new Error('La autenticación no está configurada.');

  const expiresAt = Math.floor(Date.now() / 1000) + AUTH_SESSION_MAX_AGE;
  const payload = `${expiresAt}.${randomBytes(18).toString('base64url')}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token?: string) {
  if (!token || !isAuthConfigured()) return false;

  const [expiresAtRaw, nonce, signature, ...extra] = token.split('.');
  if (!expiresAtRaw || !nonce || !signature || extra.length) return false;

  const expiresAt = Number(expiresAtRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + AUTH_SESSION_MAX_AGE) {
    return false;
  }

  const expectedSignature = sign(`${expiresAtRaw}.${nonce}`, getCredentials().secret);
  return safeEqual(signature, expectedSignature);
}
