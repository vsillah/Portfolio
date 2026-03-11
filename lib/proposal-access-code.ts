import crypto from 'crypto';

/**
 * Generate a 6-character uppercase alphanumeric access code.
 * Excludes I, O, 0, 1 for readability.
 */
export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
