const enc = new TextEncoder();

function b64urlFromBytes(bytes) {
  let bin = '';
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < u.byteLength; i++) bin += String.fromCharCode(u[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(s) {
  let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getHmacKey(secret) {
  const raw = enc.encode(secret);
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signJwtHs256(payloadObj, secret, ttlSec = 43200) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...payloadObj, iat: now, exp: now + ttlSec };
  const header = { alg: 'HS256', typ: 'JWT' };
  const head = b64urlFromBytes(enc.encode(JSON.stringify(header)));
  const body = b64urlFromBytes(enc.encode(JSON.stringify(payload)));
  const msg = `${head}.${body}`;
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return `${msg}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

export async function verifyJwtHs256(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sigB64] = parts;
  const msg = `${head}.${body}`;
  const key = await getHmacKey(secret);
  let sigActual;
  try {
    sigActual = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  const sigExpected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  if (sigExpected.length !== sigActual.length) return null;
  let diff = 0;
  for (let i = 0; i < sigExpected.length; i++) diff |= sigExpected[i] ^ sigActual[i];
  if (diff !== 0) return null;
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
  if (json.exp && Math.floor(Date.now() / 1000) > json.exp) return null;
  return json;
}
