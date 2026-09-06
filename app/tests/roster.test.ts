import { describe, expect, it } from 'vitest';
import { parseRoster } from '../scripts/roster-parser';
import { officialRoster } from '../src/roster';

describe('lab rosters', () => {
  it.each(['h4', 'h5'] as const)('reads %s names without importing advisers or alumni', (heading) => {
    const people = Array.from({ length: 10 }, (_, i) => `<${heading}>Person ${i}</${heading}><p>Adviser</p><a>Professor Other</a>`).join('');
    const entries = parseRoster(`<h3>GSR</h3>${people}<${heading}>Person 0</${heading}><h3>Alumni</h3><${heading}>Former Member</${heading}>`, heading);
    expect(entries).toHaveLength(10);
    expect(entries.every((entry) => entry.role === 'GSR')).toBe(true);
    expect(entries.map((entry) => entry.name)).not.toContain('Former Member');
  });

  it('rejects empty pages and unexpected markup instead of replacing the snapshot', () => {
    expect(() => parseRoster('', 'h4')).toThrow('page structure');
    expect(() => parseRoster('<h3>Faculty</h3><p>Temporarily unavailable</p>', 'h4')).toThrow('page structure');
  });

  it('combines lab snapshots and preserves Sky IDs for overlapping people', () => {
    const entries = officialRoster();
    expect(entries.filter((entry) => entry.name === 'Alvin Cheung')).toEqual([
      expect.objectContaining({ id: 'sky:alvin-cheung' }),
    ]);
    expect(entries).toContainEqual(expect.objectContaining({ name: 'Krste Asanović', id: 'slice:krste-asanovic' }));
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });
});
