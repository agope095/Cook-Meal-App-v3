/**
 * crypto.ts
 * 
 * Secure cryptographic utilities for generating IDs and invite codes.
 * Replaces insecure Math.random() with Web Crypto API.
 */

/**
 * Generates a cryptographically secure random UUID (v4).
 * Ideal for unique database IDs or session identifiers.
 */
export const generateSecureId = (): string => {
  return window.crypto.randomUUID();
};

/**
 * Generates a cryptographically secure random alphanumeric code.
 * Ideal for invite codes or human-readable unique strings.
 * @param length The length of the generated code.
 */
export const generateSecureCode = (length: number = 6): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  
  let code = '';
  for (let i = 0; i < length; i++) {
    code += charset[values[i] % charset.length];
  }
  return code;
};
