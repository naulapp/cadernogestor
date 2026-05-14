/** Cliente mínimo Firestore REST v1 (service account). */

function unwrapValue(v) {
  if (v == null) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue) return v.timestampValue;
  if (v.mapValue?.fields) {
    const o = {};
    for (const [k, val] of Object.entries(v.mapValue.fields)) o[k] = unwrapValue(val);
    return o;
  }
  if (v.arrayValue?.values) return v.arrayValue.values.map(unwrapValue);
  return v;
}

export function documentToObject(doc) {
  if (!doc?.fields) return {};
  const o = {};
  for (const [k, v] of Object.entries(doc.fields)) o[k] = unwrapValue(v);
  return o;
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number' && Number.isInteger(val)) return { integerValue: String(val) };
  if (typeof val === 'number') return { doubleValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) {
    const s = val.toISOString();
    return { timestampValue: s.endsWith('Z') ? s : `${s}Z` };
  }
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function objectToFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return { fields };
}

export async function firestoreRunQuery(projectId, accessToken, structuredQuery, parentDocumentPath = null) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const body = { structuredQuery };
  if (parentDocumentPath) {
    body.parent = `projects/${projectId}/databases/(default)/documents/${parentDocumentPath}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`firestore_runQuery ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

export async function firestoreGetDoc(projectId, accessToken, docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`firestore_get ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

export async function firestoreListChildren(projectId, accessToken, collectionPath, pageSize = 300) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`firestore_list ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

export async function firestoreCreateDoc(projectId, accessToken, collectionPath, documentId, fieldsObj) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?documentId=${encodeURIComponent(documentId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(objectToFields(fieldsObj))
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`firestore_create ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}
