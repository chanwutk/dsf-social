import { describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { fetchRoster } from '../scripts/roster-fetch';
import { parseRoster, parseEpicRoster } from '../scripts/roster-parser';

const html = '<h3>Faculty</h3>' + Array.from({ length: 10 }, (_, i) => `<h4>Person ${i}</h4>`).join('');
const source = { id: 'slice', url: 'https://slice.eecs.berkeley.edu/people/', parse: (text: string) => parseRoster(text, 'h4') };
const archive = { archived_snapshots: { closest: { available: true, status: '200', timestamp: '20260831181255', url: 'http://web.archive.org/web/20260831181255/https://slice.eecs.berkeley.edu/people/' } } };

describe('archive fallback', () => {
  it('uses live data without contacting the archive', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(html));
    expect((await fetchRoster(source, request)).kind).toBe('live');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['http', 'empty', 'network'])('falls back after a %s failure, including gzip archived HTML', async (failure) => {
    const request = vi.fn<typeof fetch>();
    if (failure === 'network') request.mockRejectedValueOnce(new Error('timeout'));
    else request.mockResolvedValueOnce(new Response('', { status: failure === 'http' ? 503 : 200 }));
    request.mockResolvedValueOnce(Response.json(archive));
    request.mockResolvedValueOnce(new Response(gzipSync(html)));
    const result = await fetchRoster(source, request);
    expect(result.kind).toBe('archive');
    expect(result.entries).toHaveLength(10);
    expect(result.archivedAt).toBe('20260831181255');
    expect(result.url).toBe('https://web.archive.org/web/20260831181255id_/https://slice.eecs.berkeley.edu/people/');
  });

  it('reports both failures when no archive exists', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ archived_snapshots: {} }));
    await expect(fetchRoster(source, request)).rejects.toThrow('live: Error: offline; archive: Error: no available Wayback snapshot');
  });

  it('rejects an archived error page', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('')).mockResolvedValueOnce(Response.json(archive)).mockResolvedValueOnce(new Response('<h1>Unavailable</h1>'));
    await expect(fetchRoster(source, request)).rejects.toThrow('page structure');
  });

  it('parses EPIC cards, excluding director labels and sponsor cards', () => {
    const cards = Array.from({ length: 10 }, (_, i) => `<a><div><p class="font-bold">Person ${i}</p><div><p class="font-serif">Faculty</p><span><p class="font-serif">Co-Director</p></span></div></div></a>`).join('');
    const entries = parseEpicRoster(`<h3 id="faculty">Faculty</h3>${cards}<h2>Sponsors</h2><a><p class="font-bold">Sponsor</p></a>`);
    expect(entries).toHaveLength(10);
    expect(entries.every((entry) => entry.role === 'Faculty')).toBe(true);
    expect(() => parseEpicRoster('')).toThrow('EPIC page structure');
  });
});
