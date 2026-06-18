import { encodeBase62, decodeBase62, BASE62_ALPHABET } from './base62';
import { generateCode, DEFAULT_CODE_LENGTH } from './codeGenerator';

describe('base62', () => {
  it('encodes 0 to the first alphabet char', () => {
    expect(encodeBase62(0)).toBe(BASE62_ALPHABET[0]);
  });

  it('round-trips integers', () => {
    for (const n of [1, 61, 62, 63, 12345, 3_521_614_606_207]) {
      expect(decodeBase62(encodeBase62(n))).toBe(n);
    }
  });

  it('rejects negative numbers', () => {
    expect(() => encodeBase62(-1)).toThrow();
  });

  it('rejects invalid characters on decode', () => {
    expect(() => decodeBase62('!!')).toThrow();
  });
});

describe('generateCode', () => {
  it('produces codes of the default length from the base62 alphabet', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode();
      expect(code).toHaveLength(DEFAULT_CODE_LENGTH);
      expect([...code].every((c) => BASE62_ALPHABET.includes(c))).toBe(true);
    }
  });

  it('honours a custom length', () => {
    expect(generateCode(10)).toHaveLength(10);
  });

  it('does not collide across many generations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateCode());
    expect(seen.size).toBe(5000);
  });
});
