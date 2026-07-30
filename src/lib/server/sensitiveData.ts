import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

export function isSensitiveValueEncrypted(value: string) {
  return value.startsWith(ENCRYPTED_PREFIX);
}

function encryptionKey(context: string) {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Falta TOKEN_ENCRYPTION_KEY o un AUTH_SECRET seguro para cifrar credenciales.');
  }
  return createHash('sha256')
    .update(`callcenter-ia:${context}:${secret}`)
    .digest();
}

export function encryptSensitiveValue(value: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(context), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptSensitiveValue(value: string, context: string) {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const [ivRaw, tagRaw, ciphertextRaw, ...extra] = value
    .slice(ENCRYPTED_PREFIX.length)
    .split(':');
  if (!ivRaw || !tagRaw || !ciphertextRaw || extra.length) {
    throw new Error('La credencial cifrada tiene un formato inválido.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(context),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
