/** Mesmo algoritmo que `ponto-crypto.js` no admin/PWA. */
export async function pontoHashPin(orgId, cpfDigits, pin, salt) {
  const enc = new TextEncoder();
  const msg = [String(orgId || ''), String(cpfDigits || ''), String(pin || ''), String(salt || '')].join('|');
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(msg));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizarCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '').slice(0, 11);
}
