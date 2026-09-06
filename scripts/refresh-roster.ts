import { readFile, writeFile } from 'node:fs/promises';
import { parseEpicRoster, parseRoster } from './roster-parser';
import { fetchRoster, type Source } from './roster-fetch';

const sources: Source[] = [
  { id: 'sky', url: 'https://sky.cs.berkeley.edu/people/', parse: (html) => parseRoster(html, 'h5') },
  { id: 'slice', url: 'https://slice.eecs.berkeley.edu/people/', parse: (html) => parseRoster(html, 'h4') },
  { id: 'epic', url: 'https://epic.berkeley.edu/', parse: parseEpicRoster },
];

for (const source of sources) {
  const seedPath = new URL(`../seed/${source.id}-roster.json`, import.meta.url);
  try {
    const result = await fetchRoster(source);
    await writeFile(seedPath, `${JSON.stringify(result.entries, null, 2)}\n`);
    await writeFile(new URL(`../seed/${source.id}-roster-meta.json`, import.meta.url), `${JSON.stringify({
      source: source.url, retrievedFrom: result.url, kind: result.kind,
      archivedAt: result.archivedAt ?? null, refreshedAt: new Date().toISOString(),
    }, null, 2)}\n`);
    console.log(`Updated ${result.entries.length} ${source.id} entries from ${result.kind}: ${result.url}`);
  } catch (error) {
    // A lab or archive outage must not block other sources or deployment.
    await readFile(seedPath);
    console.warn(`${source.id}: keeping bundled snapshot; ${(error as Error).message}`);
  }
}
