// Base62 alphabet (0-9, A-Z, a-z). Used both for generating short codes and for
// the capacity argument in the README: with 7 characters the key space is
// 62^7 ≈ 3.5 trillion distinct codes.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length; // 62

export const BASE62_ALPHABET = ALPHABET;

export function encodeBase62(num: number): string {
  if (!Number.isInteger(num) || num < 0) {
    throw new Error('encodeBase62 expects a non-negative integer');
  }
  if (num === 0) return ALPHABET[0];
  let n = num;
  let out = '';
  while (n > 0) {
    out = ALPHABET[n % BASE] + out;
    n = Math.floor(n / BASE);
  }
  return out;
}

export function decodeBase62(str: string): number {
  let n = 0;
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base62 character: ${ch}`);
    n = n * BASE + idx;
  }
  return n;
}
