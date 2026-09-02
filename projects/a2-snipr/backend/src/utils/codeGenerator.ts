import { randomInt } from 'crypto';
import { BASE62_ALPHABET } from './base62';

export const DEFAULT_CODE_LENGTH = 7;

// Generate a random base62 code. With length 7 the key space is 62^7 ≈ 3.5
// trillion, so random collisions are astronomically rare — but the caller still
// guards the DB unique constraint with a bounded retry instead of trusting
// probability alone. randomInt() gives unbiased, cryptographically-strong
// indices (no modulo bias), and a random code avoids the sequential-enumeration
// weakness of base62-encoding an auto-increment id.
export function generateCode(length: number = DEFAULT_CODE_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE62_ALPHABET[randomInt(BASE62_ALPHABET.length)];
  }
  return out;
}
