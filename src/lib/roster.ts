import skyRoster from '../../data/sky-roster.json';
import sliceRoster from '../../data/slice-roster.json';
import epicRoster from '../../data/epic-roster.json';
import type { RosterEntry } from './schema';

export const SKY_PEOPLE_URL = 'https://sky.cs.berkeley.edu/people/';

export function roleToAffiliation(role: string) {
  if (role === 'Undergraduate') return 'UC Berkeley Undergraduate Student';
  if (role === 'GSR' || role === 'PhD Student') return 'EECS PhD Student';
  if (role === 'Core Faculty' || role === 'Faculty') return 'UC Berkeley Faculty';
  if (role === 'Postdoc') return 'UC Berkeley Postdoctoral Researcher';
  if (role === 'Staff') return 'UC Berkeley Staff';
  return role;
}

function slug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function officialRoster(): RosterEntry[] {
  const snapshots: Array<{ id: string; entries: Array<{ name: string; role: string }> }> = [
    { id: 'sky', entries: skyRoster },
    { id: 'slice', entries: sliceRoster },
    { id: 'epic', entries: epicRoster },
  ];
  const seen = new Set<string>();
  return snapshots.flatMap(({ id, entries }) => entries.filter(({ name }) => {
    const key = name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ name, role }) => ({
    id: `${id}:${slug(name)}`,
    name,
    role,
    affiliation: roleToAffiliation(role),
    source: 'official' as const,
  })));
}

export function localContact(name: string, affiliation: string): RosterEntry {
  return {
    id: `local:${slug(name)}:${crypto.randomUUID()}`,
    name: name.trim(),
    role: 'Local contact',
    affiliation: affiliation.trim(),
    source: 'local',
    lastUsedAt: new Date().toISOString(),
  };
}
