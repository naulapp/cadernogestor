import { getGoogleAccessToken } from './google-auth.js';
import {
  documentToObject,
  firestoreCreateDoc,
  firestoreGetDoc,
  firestoreListChildren,
  firestoreRunQuery
} from './firestore.js';
import { normalizarCpf, pontoHashPin } from './ponto-pin.js';
import { signJwtHs256, verifyJwtHs256 } from './jwt-hs256.js';

let tokenCache = { token: null, exp: 0 };

async function getAccessToken(env) {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const token = await getGoogleAccessToken(sa);
  tokenCache = { token, exp: Date.now() + 50 * 60 * 1000 };
  return token;
}

function projectId(env) {
  return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT).project_id;
}

function corsHeaders(env, req) {
  const origin = req.headers.get('Origin') || '*';
  const raw = env.ALLOWED_ORIGIN != null && String(env.ALLOWED_ORIGIN).trim() !== '' ? String(env.ALLOWED_ORIGIN).trim() : '*';
  const o = raw === '*' ? '*' : origin === raw ? origin : raw;
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function json(body, env, req, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(env, req) }
  });
}

function idFromResourceName(name) {
  const parts = String(name || '').split('/');
  return parts[parts.length - 1] || '';
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function mergePontoConfig(orgData) {
  const pc = orgData?.pontoConfig || {};
  return {
    exigirFoto: pc.exigirFoto !== false,
    localLat: pc.localLat === '' || pc.localLat == null ? null : parseFloat(pc.localLat),
    localLng: pc.localLng === '' || pc.localLng == null ? null : parseFloat(pc.localLng),
    localRaioMetros: parseInt(pc.localRaioMetros, 10) || 150,
    geofenceModo: pc.geofenceModo || 'registrar',
    batidasPorDia: (function(){ const v = parseInt(pc.batidasPorDia, 10); return Number.isFinite(v) && v >= 0 ? v : 0; })(),
    workerUrl: pc.workerUrl || ''
  };
}

function hojeDataDiaSP() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

async function findOrgByPontoCodigo(env, codigo) {
  const pid = projectId(env);
  const token = await getAccessToken(env);
  const c = String(codigo || '').trim().toUpperCase();
  const rows = await firestoreRunQuery(pid, token, {
    from: [{ collectionId: 'orgs' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'pontoCodigo' },
        op: 'EQUAL',
        value: { stringValue: c }
      }
    },
    limit: 2
  });
  const row = rows.find((r) => r.document);
  if (!row?.document) return null;
  const orgId = idFromResourceName(row.document.name);
  const data = documentToObject(row.document);
  return { orgId, data };
}

async function listFuncionarios(env, orgId) {
  const pid = projectId(env);
  const token = await getAccessToken(env);
  const list = await firestoreListChildren(pid, token, `orgs/${orgId}/funcionarios`, 400);
  const docs = list.documents || [];
  return docs.map((d) => ({ id: idFromResourceName(d.name), ...documentToObject(d) }));
}

/** Candidatos a login: token no link, CPF completo ou últimos 4 dígitos do CPF. */
async function listCandidatosLogin(env, orgId, { t, cpf, cpfUltimos4 }) {
  const funcs = await listFuncionarios(env, orgId);
  const token = String(t || '').trim();
  if (token) {
    const f = funcs.find((x) => x.pontoLinkToken === token);
    return f ? [f] : [];
  }
  const cpfD = normalizarCpf(cpf);
  if (cpfD.length === 11) {
    const f = funcs.find((x) => normalizarCpf(x.cpf) === cpfD);
    return f ? [f] : [];
  }
  const u4 = String(cpfUltimos4 || '').replace(/\D/g, '');
  if (u4.length === 4) {
    return funcs.filter((x) => normalizarCpf(x.cpf).endsWith(u4));
  }
  return [];
}

async function listMarcacoesFuncionario(env, orgId, funcionarioId, limit = 200) {
  const pid = projectId(env);
  const token = await getAccessToken(env);
  const rows = await firestoreRunQuery(
    pid,
    token,
    {
      from: [{ collectionId: 'marcacoesPonto' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'funcionarioId' },
          op: 'EQUAL',
          value: { stringValue: funcionarioId }
        }
      },
      limit
    },
    `orgs/${orgId}`
  );
  const out = [];
  for (const row of rows) {
    if (!row.document) continue;
    const docId = idFromResourceName(row.document.name);
    const m = documentToObject(row.document);
    out.push({ id: docId, ...m });
  }
  const ts = (m) => {
    const d = new Date(m.em || m.criadoEm || 0);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  };
  out.sort((a, b) => ts(b) - ts(a));
  return out;
}

async function countMarcacoesHoje(env, orgId, funcionarioId, dataDia) {
  const pid = projectId(env);
  const token = await getAccessToken(env);
  const rows = await firestoreRunQuery(
    pid,
    token,
    {
      from: [{ collectionId: 'marcacoesPonto' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'funcionarioId' },
          op: 'EQUAL',
          value: { stringValue: funcionarioId }
        }
      },
      limit: 200
    },
    `orgs/${orgId}`
  );
  let n = 0;
  for (const row of rows) {
    if (!row.document) continue;
    const m = documentToObject(row.document);
    const dd = m.dataDia || '';
    if (dd === dataDia) n++;
  }
  return n;
}

export default {
  async fetch(request, env, ctx) {
    const req = request;
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env, req) });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path === '/health') {
      return json({ ok: true, service: 'cadernogestor' }, env, req);
    }

    if (!env.FIREBASE_SERVICE_ACCOUNT) {
      return json({ ok: false, error: 'FIREBASE_SERVICE_ACCOUNT não configurado (secret).' }, env, req, 500);
    }
    if (!env.SESSION_SECRET) {
      return json({ ok: false, error: 'SESSION_SECRET não configurado (secret).' }, env, req, 500);
    }

    try {
      if (path === '/api/login' && request.method === 'POST') {
        return handleLogin(request, env);
      }
      if (path === '/api/upload-foto' && request.method === 'POST') {
        return handleUpload(request, env);
      }
      if (path === '/api/registrar' && request.method === 'POST') {
        return handleRegistrar(request, env);
      }
      if (path === '/api/minhas-marcacoes' && request.method === 'GET') {
        return handleMinhasMarcacoes(request, env, url);
      }
    } catch (e) {
      return json({ ok: false, error: String(e.message || e) }, env, req, 500);
    }

    return json({ ok: false, error: 'Rota não encontrada' }, env, req, 404);
  }
};

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, env, request, 400);
  }
  const c = String(body.c || '').trim().toUpperCase();
  const pin = String(body.pin || '').replace(/\D/g, '').trim();
  const t = String(body.t || '').trim();
  const cpf = body.cpf;
  const cpfUltimos4 = body.cpfUltimos4;

  if (!c || pin.length !== 6) {
    return json({ ok: false, error: 'Informe código da empresa e PIN de 6 dígitos.' }, env, request, 400);
  }
  const u4 = String(cpfUltimos4 || '').replace(/\D/g, '');
  if (!t && normalizarCpf(cpf).length !== 11 && u4.length !== 4) {
    return json(
      {
        ok: false,
        error: 'Informe os 4 últimos dígitos do CPF (ou use link antigo com token / CPF completo).'
      },
      env,
      request,
      400
    );
  }

  const org = await findOrgByPontoCodigo(env, c);
  if (!org) return json({ ok: false, error: 'Código da empresa inválido.' }, env, request, 401);

  const candidatos = await listCandidatosLogin(env, org.orgId, { t, cpf, cpfUltimos4 });
  if (!candidatos.length) {
    return json(
      { ok: false, error: 'Colaborador não encontrado. Confira o código da empresa e os 4 últimos dígitos do CPF.' },
      env,
      request,
      401
    );
  }

  let f = null;

  if (candidatos.length === 1) {
    const only = candidatos[0];
    if (only.pontoAtivo === false) {
      return json(
        { ok: false, code: 'PONTO_DESATIVADO', error: 'Ponto desativado para este colaborador.' },
        env,
        request,
        403
      );
    }
    if (!only.pontoPinHash || !only.pontoPinSalt) {
      return json(
        {
          ok: false,
          code: 'PIN_NAO_CONFIGURADO',
          error: 'PIN ainda não foi gerado no sistema (admin). Abra o cadastro do funcionário e use «Gerar PIN».'
        },
        env,
        request,
        403
      );
    }
    const cpfDigits = normalizarCpf(only.cpf != null && only.cpf !== '' ? only.cpf : cpf);
    if (cpfDigits.length !== 11) {
      return json(
        {
          ok: false,
          code: 'CPF_INCOMPLETO',
          error:
            'CPF no cadastro precisa ter 11 dígitos (corrija no admin e gere o PIN de novo). Se o CPF começa com 0, salve como texto, não só número.'
        },
        env,
        request,
        403
      );
    }
    const hash = await pontoHashPin(org.orgId, cpfDigits, pin, only.pontoPinSalt);
    if (hash !== only.pontoPinHash) {
      return json({ ok: false, error: 'PIN incorreto.' }, env, request, 401);
    }
    f = only;
  } else {
    const pinOk = [];
    for (const cand of candidatos) {
      if (cand.pontoAtivo === false) continue;
      if (!cand.pontoPinHash || !cand.pontoPinSalt) continue;
      const cpfDigits = normalizarCpf(cand.cpf);
      if (cpfDigits.length !== 11) continue;
      const hash = await pontoHashPin(org.orgId, cpfDigits, pin, cand.pontoPinSalt);
      if (hash === cand.pontoPinHash) pinOk.push(cand);
    }
    if (pinOk.length === 1) {
      f = pinOk[0];
    } else if (pinOk.length > 1) {
      return json(
        {
          ok: false,
          code: 'LOGIN_AMBIGUO',
          error: 'Mais de um cadastro bate com estes dados. Peça ao RH para conferir os CPFs ou use o link com token.'
        },
        env,
        request,
        409
      );
    } else {
      return json(
        { ok: false, error: 'PIN incorreto ou CPF não confere com o cadastro.' },
        env,
        request,
        401
      );
    }
  }

  const cpfDigitsJwt = normalizarCpf(f.cpf);
  const pontoConfig = mergePontoConfig(org.data);
  const jwtTtlSec = 60 * 60 * 24 * 30;
  const token = await signJwtHs256(
    { orgId: org.orgId, funcionarioId: f.id, nome: f.nome || '', cpfDigits: cpfDigitsJwt },
    env.SESSION_SECRET,
    jwtTtlSec
  );

  return json(
    {
      ok: true,
      token,
      nome: f.nome || '',
      pontoConfig,
      batidasPorDia: pontoConfig.batidasPorDia
    },
    env,
    request
  );
}

function mesRefDeDataDia(dataDia) {
  const s = String(dataDia || '');
  if (s.length >= 7) return s.slice(0, 7);
  return '';
}

function marcaNoMesRef(m, mesRef) {
  const dd = String(m.dataDia || '');
  if (dd.length >= 7 && dd.slice(0, 7) === mesRef) return true;
  const iso = m.em || m.criadoEm;
  const d = new Date(iso || 0);
  if (!Number.isFinite(d.getTime())) return false;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${mo}` === mesRef;
}

async function handleMinhasMarcacoes(request, env, url) {
  const sess = await readSession(request, env);
  if (!sess?.orgId) return json({ ok: false, error: 'Não autorizado' }, env, request, 401);

  let mesRef = String(url.searchParams.get('mes') || '').trim();
  if (!/^\d{4}-\d{2}$/.test(mesRef)) {
    mesRef = hojeDataDiaSP().slice(0, 7);
  }

  const lista = await listMarcacoesFuncionario(env, sess.orgId, sess.funcionarioId);
  const noMes = lista.filter((m) => marcaNoMesRef(m, mesRef));

  const ultima = lista[0] || null;
  const ultimaMarcacao = ultima
    ? {
        em: ultima.em || ultima.criadoEm || '',
        dataDia: ultima.dataDia || '',
        tipoBatida: ultima.tipoBatida ?? ultima.tipo ?? null
      }
    : null;

  const porDiaMap = new Map();
  for (const m of noMes) {
    const dd = m.dataDia || mesRefDeDataDia(m.criadoEm) || mesRef + '-01';
    if (!porDiaMap.has(dd)) porDiaMap.set(dd, []);
    porDiaMap.get(dd).push(m);
  }
  const porDia = [...porDiaMap.entries()]
    .map(([dataDia, arr]) => {
      arr.sort((a, b) => {
        const ta = new Date(a.em || a.criadoEm || 0).getTime();
        const tb = new Date(b.em || b.criadoEm || 0).getTime();
        return ta - tb;
      });
      const horarios = arr.map((x) => {
        const d = new Date(x.em || x.criadoEm || 0);
        return Number.isFinite(d.getTime())
          ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
          : '—';
      });
      return {
        dataDia,
        qtd: arr.length,
        horarios,
        tipos: arr.map((x) => x.tipoBatida ?? x.tipo ?? null)
      };
    })
    .sort((a, b) => b.dataDia.localeCompare(a.dataDia));

  const diasComRegistro = porDia.length;

  return json(
    {
      ok: true,
      mesRef,
      ultimaMarcacao,
      resumoMes: {
        totalBatidas: noMes.length,
        diasComRegistro,
        porDia
      }
    },
    env,
    request
  );
}

async function readSession(request, env) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  return verifyJwtHs256(m[1].trim(), env.SESSION_SECRET);
}

async function handleUpload(request, env) {
  const sess = await readSession(request, env);
  if (!sess?.orgId) return json({ ok: false, error: 'Não autorizado' }, env, request, 401);

  if (!env.PONTO_BUCKET) {
    return json({ ok: false, error: 'R2 (PONTO_BUCKET) não ligado no wrangler.toml' }, env, request, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, env, request, 400);
  }
  const b64 = body.base64;
  const contentType = body.contentType || 'image/jpeg';
  if (!b64 || typeof b64 !== 'string') {
    return json({ ok: false, error: 'Campo base64 obrigatório' }, env, request, 400);
  }

  let bytes;
  try {
    const bin = atob(b64.replace(/^data:image\/\w+;base64,/, ''));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return json({ ok: false, error: 'Base64 inválido' }, env, request, 400);
  }
  if (bytes.length > 6 * 1024 * 1024) {
    return json({ ok: false, error: 'Imagem muito grande (máx. 6 MB)' }, env, request, 400);
  }

  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const fotoKey = `orgs/${sess.orgId}/ponto/${sess.funcionarioId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.PONTO_BUCKET.put(fotoKey, bytes, { httpMetadata: { contentType } });

  return json({ ok: true, fotoKey }, env, request);
}

async function handleRegistrar(request, env) {
  const sess = await readSession(request, env);
  if (!sess?.orgId) return json({ ok: false, error: 'Não autorizado' }, env, request, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, env, request, 400);
  }

  const geo = body.geo && typeof body.geo === 'object' ? body.geo : {};
  const lat = parseFloat(geo.lat);
  const lng = parseFloat(geo.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ ok: false, error: 'GPS (lat/lng) obrigatório' }, env, request, 400);
  }

  const pid = projectId(env);
  const token = await getAccessToken(env);
  const orgDoc = await firestoreGetDoc(pid, token, `orgs/${sess.orgId}`);
  if (!orgDoc) return json({ ok: false, error: 'Organização não encontrada' }, env, request, 404);
  const orgData = documentToObject(orgDoc);
  const pontoConfig = mergePontoConfig(orgData);

  if (pontoConfig.localLat != null && pontoConfig.localLng != null && Number.isFinite(pontoConfig.localLat)) {
    const dist = haversineM(lat, lng, pontoConfig.localLat, pontoConfig.localLng);
    if (dist > pontoConfig.localRaioMetros) {
      if (pontoConfig.geofenceModo === 'bloquear') {
        return json(
          { ok: false, error: `Fora do raio permitido (~${Math.round(dist)} m).` },
          env,
          request,
          403
        );
      }
    }
  }

  const fotoKey = typeof body.fotoKey === 'string' ? body.fotoKey.trim() : '';
  if (pontoConfig.exigirFoto && !fotoKey) {
    return json({ ok: false, error: 'Foto obrigatória para esta empresa.' }, env, request, 400);
  }

  const dataDia = hojeDataDiaSP();
  const limite = pontoConfig.batidasPorDia;
  let ja = 0;
  if (limite > 0) {
    ja = await countMarcacoesHoje(env, sess.orgId, sess.funcionarioId, dataDia);
    if (ja >= limite) {
      return json({ ok: false, error: `Limite de ${limite} batida(s) hoje atingido.` }, env, request, 429);
    }
  }

  const tipoBatida = parseInt(body.tipoBatida, 10) || ja + 1;
  const now = new Date();
  const marcaId = `mp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const fields = {
    funcionarioId: sess.funcionarioId,
    em: now,
    criadoEm: now.toISOString(),
    dataDia,
    tipoBatida,
    geo: { lat, lng },
    fotoKey: fotoKey || '',
    offlineId: typeof body.offlineId === 'string' ? body.offlineId : '',
    foraDoRaio:
      pontoConfig.localLat != null &&
      haversineM(lat, lng, pontoConfig.localLat, pontoConfig.localLng) > pontoConfig.localRaioMetros
  };

  await firestoreCreateDoc(pid, token, `orgs/${sess.orgId}/marcacoesPonto`, marcaId, fields);

  return json({ ok: true, id: marcaId, dataDia, tipoBatida }, env, request);
}
