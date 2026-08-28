import seed from '../seed/sky-roster.json';
import type { RosterEntry } from '../shared/schema';

export const SKY_PEOPLE_URL = 'https://sky.cs.berkeley.edu/people/';

export function roleToAffiliation(role: string) {
  if (role === 'GSR') return 'EECS PhD Student';
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
  return seed.map(({ name, role }) => ({
    id: `sky:${slug(name)}`,
    name,
    role,
    affiliation: roleToAffiliation(role),
    source: 'official',
  }));
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
