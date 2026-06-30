// A deterministic demo sales CSV, crafted so several detectors fire: an upward revenue
// trend over time, a dominant region (North ~50%), units strongly correlated with
// revenue, and a planted revenue outlier. No randomness — reproducible for tests/demos.
export function buildSeedCsv(): string {
  const regions = ['North', 'North', 'North', 'East', 'West', 'South']; // North weighted
  const categories = ['Electronics', 'Apparel', 'Home', 'Grocery'];
  const lines: string[] = ['date,region,category,units,revenue'];
  const start = Date.UTC(2026, 0, 1);
  const week = 7 * 86400000;
  for (let i = 0; i < 48; i++) {
    const date = new Date(start + i * week).toISOString().slice(0, 10);
    const region = regions[i % regions.length];
    const category = categories[i % categories.length];
    const units = 10 + (i % 12) * 2;
    let revenue = units * 25 + i * 30; // upward trend, correlated with units
    if (i === 23) revenue = 9999; // planted outlier
    lines.push(`${date},${region},${category},${units},${revenue}`);
  }
  return lines.join('\n');
}
