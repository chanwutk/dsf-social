import { gunzipSync } from 'node:zlib';

export type Entry = { name: string; role: string };
export type Source = { id: string; url: string; parse: (html: string) => Entry[] };

// Exported separately so network failures and archive responses can be tested offline.
export async function fetchRoster(source: Source, request: typeof fetch = fetch) {
  async function get(url: string) {
    const response = await request(url, {
      headers: { 'user-agent': 'erso-reimbursement-helper/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }
  async function parsePage(url: string) {
    const response = await get(url);
    let bytes = Buffer.from(await response.arrayBuffer());
    // Some raw Wayback captures retain gzip bytes without Content-Encoding.
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = Buffer.from(gunzipSync(bytes));
    return source.parse(bytes.toString('utf8'));
  }
  let liveError: unknown;
  try {
    return { entries: await parsePage(source.url), url: source.url, kind: 'live' as const };
  } catch (error) {
    liveError = error;
  }
  try {
    const response = await get(`https://archive.org/wayback/available?url=${encodeURIComponent(source.url)}`);
    const data = await response.json();
    const snapshot = data.archived_snapshots?.closest;
    if (!snapshot?.available || String(snapshot.status) !== '200' || !/^\d{14}$/.test(snapshot.timestamp)) {
      throw new Error('no available Wayback snapshot');
    }
    const archived = new URL(snapshot.url);
    if (archived.hostname !== 'web.archive.org' || !['http:', 'https:'].includes(archived.protocol)) {
      throw new Error('invalid Wayback snapshot URL');
    }
    archived.protocol = 'https:';
    archived.pathname = archived.pathname.replace(/^\/web\/\d{14}\//, `/web/${snapshot.timestamp}id_/`);
    return {
      entries: await parsePage(archived.href), url: archived.href,
      kind: 'archive' as const, archivedAt: snapshot.timestamp as string,
    };
  } catch (error) {
    throw new Error(`live: ${String(liveError)}; archive: ${String(error)}`);
  }
}
