import { parseCsv } from '../engine/parseCsv';

describe('parseCsv', () => {
  it('parses a simple CSV into header-keyed rows', () => {
    const { headers, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    const { rows } = parseCsv('name,city\n"Doe, John",London');
    expect(rows[0]).toEqual({ name: 'Doe, John', city: 'London' });
  });

  it('handles quoted fields with embedded newlines', () => {
    const { rows } = parseCsv('name,addr\n"Ada","line1\nline2"');
    expect(rows[0].addr).toBe('line1\nline2');
  });

  it('handles escaped double-quotes', () => {
    const { rows } = parseCsv('q\n"she said ""hi"""');
    expect(rows[0].q).toBe('she said "hi"');
  });

  it('handles CRLF line endings', () => {
    const { rows } = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ a: '3', b: '4' });
  });

  it('tolerates ragged rows (missing trailing cells become empty)', () => {
    const { rows } = parseCsv('a,b,c\n1,2');
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });

  it('ignores a trailing newline (no phantom empty row)', () => {
    const { rows } = parseCsv('a,b\n1,2\n');
    expect(rows).toHaveLength(1);
  });

  it('returns empty for blank input', () => {
    expect(parseCsv('   ')).toEqual({ headers: [], rows: [] });
  });
});
