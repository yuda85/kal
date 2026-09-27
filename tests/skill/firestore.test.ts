import { describe, expect, it } from 'vitest';
import { createFirestoreReader, decodeFields } from '../../.claude/skills/kal/scripts/lib/firestore.ts';

type Call = { url: string; init?: RequestInit };

function fakeFetch(routes: [string, unknown][], calls: Call[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    const route = routes.find(([k]) => u.includes(k));
    if (!route) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(route[1]), { status: 200 });
  }) as typeof fetch;
}

const src = { projectId: 'kal-test', uid: 'u1' };
const root = 'projects/kal-test/databases/(default)/documents/users/u1';

describe('decodeFields', () => {
  it('decodes Firestore REST typed values', () => {
    expect(
      decodeFields({
        name: { stringValue: 'x' },
        kg: { doubleValue: 85.2 },
        steps: { integerValue: '9200' },
        protein: { nullValue: null },
        active: { booleanValue: true },
        workouts: { arrayValue: { values: [{ mapValue: { fields: { type: { stringValue: 'run' } } } }] } },
        empty: { arrayValue: {} },
      }),
    ).toEqual({ name: 'x', kg: 85.2, steps: 9200, protein: null, active: true, workouts: [{ type: 'run' }], empty: [] });
  });
});

describe('createFirestoreReader', () => {
  it('reads the user document and returns null when missing', async () => {
    const reader = createFirestoreReader(src, fakeFetch([[`${root}`, { name: `${root}`, fields: { heightCm: { integerValue: '178' } } }]]));
    expect(await reader.user()).toEqual({ heightCm: 178 });
    const empty = createFirestoreReader(src, fakeFetch([]));
    expect(await empty.user()).toBeNull();
  });

  it('lists a collection across pages', async () => {
    const calls: Call[] = [];
    const reader = createFirestoreReader(
      src,
      fakeFetch(
        [
          ['pageToken=t2', { documents: [{ name: `${root}/weights/2026-09-28`, fields: { kg: { doubleValue: 84.9 } } }] }],
          ['/weights?', { documents: [{ name: `${root}/weights/2026-09-27`, fields: { kg: { integerValue: '85' } } }], nextPageToken: 't2' }],
        ],
        calls,
      ),
    );
    const docs = await reader.list('weights');
    expect(docs).toEqual([
      { id: '2026-09-27', data: { kg: 85 } },
      { id: '2026-09-28', data: { kg: 84.9 } },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`https://firestore.googleapis.com/v1/${root}/weights?pageSize=300`);
  });

  it('queries entries by date range with runQuery', async () => {
    const calls: Call[] = [];
    const reader = createFirestoreReader(
      src,
      fakeFetch([[':runQuery', [{ document: { name: `${root}/entries/e1`, fields: { kcal: { integerValue: '320' } } } }, { readTime: 'x' }]]], calls),
    );
    expect(await reader.entriesBetween('2026-09-27', '2026-09-27')).toEqual([{ id: 'e1', data: { kcal: 320 } }]);
    const body = JSON.parse(String(calls[0].init?.body));
    expect(calls[0].init?.method).toBe('POST');
    expect(body.structuredQuery.from).toEqual([{ collectionId: 'entries' }]);
    expect(body.structuredQuery.where.compositeFilter.filters).toHaveLength(2);
  });

  it('uses the emulator host when given', async () => {
    const calls: Call[] = [];
    const reader = createFirestoreReader({ ...src, emulatorHost: '127.0.0.1:8080' }, fakeFetch([], calls));
    await reader.user();
    expect(calls[0].url).toBe(`http://127.0.0.1:8080/v1/${root}`);
  });

  it('throws on server errors', async () => {
    const failing = (async () => new Response('boom', { status: 500 })) as typeof fetch;
    await expect(createFirestoreReader(src, failing).user()).rejects.toThrow('Firestore 500');
  });
});
