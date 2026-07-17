export function normalizePhoneNumber(value: string) {
  return value.trim().replace(/[\s().-]/g, '');
}

export function validatePhoneNumber(value: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizePhoneNumber(value);
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'El número debe incluir el código de país y tener entre 8 y 15 dígitos.',
    };
  }
  if (normalized.startsWith('+57') && !/^\+573\d{9}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Un celular colombiano debe tener el formato +57 seguido de 10 dígitos, por ejemplo +573001234567.',
    };
  }
  return { valid: true, normalized };
}
