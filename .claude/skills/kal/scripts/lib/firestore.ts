export interface Doc {
  id: string;
  data: Record<string, unknown>;
}

type RestValue = Record<string, any>;

export function decodeValue(v: RestValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  return undefined;
}

export function decodeFields(fields: Record<string, RestValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

function toDoc(d: { name: string; fields?: Record<string, RestValue> }): Doc {
  return { id: d.name.split('/').pop() ?? '', data: decodeFields(d.fields ?? {}) };
}

export interface FirestoreSource {
  projectId: string;
  uid: string;
  emulatorHost?: string;
}

export function createFirestoreReader(src: FirestoreSource, fetchFn: typeof fetch = fetch) {
  const base = src.emulatorHost ? `http://${src.emulatorHost}/v1` : 'https://firestore.googleapis.com/v1';
  const userPath = `projects/${src.projectId}/databases/(default)/documents/users/${src.uid}`;

  async function getJson(url: string, init?: RequestInit): Promise<any> {
    const res = await fetchFn(url, init);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
    return res.json();
  }

  return {
    async user(): Promise<Record<string, unknown> | null> {
      const d = await getJson(`${base}/${userPath}`);
      return d ? toDoc(d).data : null;
    },

    async list(collection: string): Promise<Doc[]> {
      const docs: Doc[] = [];
      let token = '';
      do {
        const page = token ? `&pageToken=${encodeURIComponent(token)}` : '';
        const d = await getJson(`${base}/${userPath}/${collection}?pageSize=300${page}`);
        for (const x of d?.documents ?? []) docs.push(toDoc(x));
        token = d?.nextPageToken ?? '';
      } while (token);
      return docs;
    },

    async entriesBetween(from: string, to: string): Promise<Doc[]> {
      const range = (op: string, value: string) => ({
        fieldFilter: { field: { fieldPath: 'date' }, op, value: { stringValue: value } },
      });
      const body = {
        structuredQuery: {
          from: [{ collectionId: 'entries' }],
          where: { compositeFilter: { op: 'AND', filters: [range('GREATER_THAN_OR_EQUAL', from), range('LESS_THAN_OR_EQUAL', to)] } },
        },
      };
      const rows = await getJson(`${base}/${userPath}:runQuery`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return (rows ?? []).filter((r: any) => r.document).map((r: any) => toDoc(r.document));
    },
  };
}

export type FirestoreReader = ReturnType<typeof createFirestoreReader>;
