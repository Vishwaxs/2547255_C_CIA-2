// A small RFC-4180-ish CSV parser written by hand (no dependency). Handles quoted
// fields, embedded commas/newlines inside quotes, and escaped "" quotes; tolerates
// \n and \r\n line endings and ragged rows. The first record is the header.

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let sawAny = false;
  const n = text.length;
  let i = 0;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      sawAny = true;
      i++;
      continue;
    }
    if (c === ',') {
      record.push(field);
      field = '';
      sawAny = true;
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      record.push(field);
      records.push(record);
      field = '';
      record = [];
      sawAny = false;
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += c;
    sawAny = true;
    i++;
  }
  // flush a trailing field/record that wasn't terminated by a newline
  if (sawAny || field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  // drop blank records (a single empty field)
  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows };
}
