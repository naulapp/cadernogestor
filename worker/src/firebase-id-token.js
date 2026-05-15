/** Valida idToken do Firebase (Web) via Identity Toolkit — mesma API key pública do app. */
export async function verifyFirebaseIdToken(webApiKey, idToken) {
  const key = String(webApiKey || '').trim();
  const tok = String(idToken || '').trim();
  if (!key || !tok) return null;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: tok })
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const u = data.users?.[0];
  if (!u?.localId) return null;
  return { uid: u.localId, email: u.email || '' };
}
