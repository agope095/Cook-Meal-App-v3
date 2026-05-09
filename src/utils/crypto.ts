/**
 * Generates a secure random string of specified length using window.crypto.
 * This is suitable for invite codes where predictability must be avoided.
 */
export function generateSecureCode(length: number = 6): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous characters like 0, O, 1, I
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

/**
 * Generates a secure unique ID.
 */
export function generateId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback for environments where randomUUID might not be available
  return Math.random().toString(36).substring(2, 11);
}
