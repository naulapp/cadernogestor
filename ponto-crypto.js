// Utilitários para PIN do ponto (hash no cliente; Worker validará com a mesma função)

function pontoNormalizarCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '').slice(0, 11);
}

function pontoGerarPin6() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, '0');
}

function pontoGerarSaltHex(bytes = 16) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function pontoGerarLinkToken() {
  return pontoGerarSaltHex(24);
}

function pontoGerarCodigoEmpresa(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (let i = 0; i < len; i++) s += chars[a[i] % chars.length];
  return s;
}

async function pontoHashPin(orgId, cpfDigits, pin, salt) {
  const enc = new TextEncoder();
  const msg = [String(orgId || ''), String(cpfDigits || ''), String(pin || ''), String(salt || '')].join('|');
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(msg));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
