import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourceUrl = 'https://sky.cs.berkeley.edu/people/';
const seedPath = fileURLToPath(new URL('../seed/sky-roster.json', import.meta.url));
const roles = new Set([
  'Core Faculty',
  'Faculty',
  'GSR',
  'Postdoc',
  'Staff',
  'Visiting Student Researcher',
  'Affiliate Researcher',
  'Visiting Scholar',
]);

try {
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': 'erso-reimbursement-helper/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  let role = '';
  const entries: Array<{ name: string; role: string }> = [];
  $('h3, h4, h5').each((_index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (roles.has(text)) role = text;
    else if (element.tagName.toLocaleLowerCase() === 'h5' && role && text) entries.push({ name: text, role });
  });
  const deduplicated = [...new Map(entries.map((entry) => [entry.name.toLocaleLowerCase(), entry])).values()];
  if (deduplicated.length < 10) throw new Error('page structure did not match');
  await writeFile(seedPath, `${JSON.stringify(deduplicated, null, 2)}\n`);
  console.log(`Updated ${deduplicated.length} Sky roster entries.`);
} catch (error) {
  // A roster outage must not block a Pages deployment; retain the last snapshot.
  await readFile(seedPath);
  console.warn(`Sky roster refresh skipped: ${(error as Error).message}`);
}
