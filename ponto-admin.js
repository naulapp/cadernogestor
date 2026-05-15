// =====================================================
// PONTO — admin (Sprint 2) + UI folha de gestão
// =====================================================

// URL do Worker Cloudflare compartilhado (uma só, serve todas as orgs).
// Para trocar, basta editar aqui e fazer redeploy do site.
const PONTO_WORKER_URL_PADRAO = 'https://cadernogestor.luan-eu55.workers.dev';

function getPwaPontoBaseDir() {
  let p = window.location.pathname || '/';
  if (p.endsWith('index.html')) p = p.slice(0, -10);
  else {
    const i = p.lastIndexOf('/');
    p = i >= 0 ? p.slice(0, i + 1) : '/';
  }
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/')) p += '/';
  return window.location.origin + p;
}

function getDefaultPontoConfig() {
  return {
    exigirFoto: true,
    localLat: '',
    localLng: '',
    localRaioMetros: 150,
    geofenceModo: 'registrar',
    batidasPorDia: 0,
    workerUrl: PONTO_WORKER_URL_PADRAO
  };
}

function mergePontoConfig(org) {
  const m = { ...getDefaultPontoConfig(), ...(org?.pontoConfig || {}) };
  // URL do Worker: sempre a do sistema (assinatura — clientes não veem nem alteram).
  m.workerUrl = PONTO_WORKER_URL_PADRAO;
  return m;
}

function syncPontoConfigUI() {
  if (!currentOrg) return;
  const pc = mergePontoConfig(currentOrg);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v != null ? v : ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
  set('cfgPontoCodigo', currentOrg.pontoCodigo || '');
  setChk('cfgPontoExigirFoto', pc.exigirFoto !== false);
  set('cfgPontoLat', pc.localLat === 0 || pc.localLat ? String(pc.localLat) : '');
  set('cfgPontoLng', pc.localLng === 0 || pc.localLng ? String(pc.localLng) : '');
  set('cfgPontoRaio', String(pc.localRaioMetros ?? 150));
  const gf = document.getElementById('cfgPontoGeofence');
  if (gf) gf.value = pc.geofenceModo || 'registrar';
  const bd = document.getElementById('cfgPontoBatidas');
  if (bd) bd.value = String(pc.batidasPorDia ?? 0);
  const codEl = document.getElementById('cfgPontoCodigo');
  if (codEl && !codEl.value && !currentOrg.pontoCodigo) {
    codEl.value = typeof pontoGerarCodigoEmpresa === 'function' ? pontoGerarCodigoEmpresa(6) : '';
  }
}

async function salvarPontoEmpresa() {
  if (!currentOrg) return;
  const latStr = document.getElementById('cfgPontoLat')?.value?.trim();
  const lngStr = document.getElementById('cfgPontoLng')?.value?.trim();
  const pontoConfig = {
    exigirFoto: !!document.getElementById('cfgPontoExigirFoto')?.checked,
    localLat: latStr === '' ? '' : (parseFloat(latStr.replace(',', '.')) || ''),
    localLng: lngStr === '' ? '' : (parseFloat(lngStr.replace(',', '.')) || ''),
    localRaioMetros: parseInt(document.getElementById('cfgPontoRaio')?.value, 10) || 150,
    geofenceModo: document.getElementById('cfgPontoGeofence')?.value || 'registrar',
    batidasPorDia: (function(){ const v = parseInt(document.getElementById('cfgPontoBatidas')?.value, 10); return Number.isFinite(v) && v >= 0 ? v : 0; })(),
    workerUrl: PONTO_WORKER_URL_PADRAO
  };
  const cod = (document.getElementById('cfgPontoCodigo')?.value || '').trim().toUpperCase();
  if (!cod || cod.length < 4) {
    toast('Código da empresa (ponto) deve ter pelo menos 4 caracteres.', 'error');
    return;
  }
  const update = { pontoCodigo: cod, pontoConfig };
  Object.assign(currentOrg, update);
  if (db) await db.collection('orgs').doc(currentOrg.id).update(update);
  else localDB.setOrg(currentOrg.id, currentOrg);
  toast('Configurações do ponto salvas!', 'success');
}

async function gerarNovoPontoCodigoEmpresa() {
  if (!currentOrg) return;
  if (!await confirmar('Gerar novo código?', 'Os funcionários precisarão usar o novo código no app de ponto (quem usa só o link com token pode continuar).')) return;
  document.getElementById('cfgPontoCodigo').value = pontoGerarCodigoEmpresa(6);
  await salvarPontoEmpresa();
}

function nomeFuncionarioPonto(fid) {
  const f = funcionarios.find((x) => x.id === fid);
  return f?.nome || fid || '—';
}

function renderFolhaPontoPage() {
  const wrap = document.getElementById('folhaPontoRoot');
  if (!wrap) return;
  const mes = parseInt(document.getElementById('fpontoMes')?.value, 10) || new Date().getMonth() + 1;
  const ano = parseInt(document.getElementById('fpontoAno')?.value, 10) || new Date().getFullYear();
  const funcFiltro = document.getElementById('fpontoFunc')?.value || '';

  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
  let lista = (marcacoesPonto || []).slice();
  lista = lista.filter((m) => {
    let iso = '';
    const em = m.em || m.criadoEm;
    if (typeof em === 'string') iso = em.slice(0, 7);
    else if (em && typeof em.toDate === 'function') iso = em.toDate().toISOString().slice(0, 7);
    if (!iso && m.dataDia) iso = String(m.dataDia).slice(0, 7);
    const okMes = !iso || iso.slice(0, 7) === prefix;
    const okF = !funcFiltro || m.funcionarioId === funcFiltro;
    return okMes && okF;
  });
  lista.sort((a, b) => {
    const ta = (a.em || a.criadoEm || '').toString();
    const tb = (b.em || b.criadoEm || '').toString();
    return tb.localeCompare(ta);
  });

  const rows = lista.map((m) => {
    const em = m.em || m.criadoEm;
    let emStr = '';
    if (typeof em === 'string') emStr = em;
    else if (em && typeof em.toDate === 'function') emStr = em.toDate().toLocaleString('pt-BR');
    const geo = m.geo && (m.geo.lat != null) ? `${Number(m.geo.lat).toFixed(5)}, ${Number(m.geo.lng).toFixed(5)}` : '—';
    return `<tr>
      <td>${escapeHtml(emStr ? emStr.slice(0, 20) : '—')}</td>
      <td>${escapeHtml(nomeFuncionarioPonto(m.funcionarioId))}</td>
      <td>${escapeHtml(String(m.tipoBatida ?? m.tipo ?? '—'))}</td>
      <td>${escapeHtml(geo)}</td>
      <td>${m.fotoKey ? 'Sim' : '—'}</td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="form-grid form-grid-3" style="margin-bottom:14px;max-width:720px">
      <div class="form-group">
        <label class="form-label">Mês</label>
        <select class="form-input" id="fpontoMes" onchange="renderFolhaPontoPage()">${[1,2,3,4,5,6,7,8,9,10,11,12].map((mm) =>
          `<option value="${mm}" ${mm === mes ? 'selected' : ''}>${mm}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Ano</label>
        <input type="number" class="form-input" id="fpontoAno" value="${ano}" onchange="renderFolhaPontoPage()">
      </div>
      <div class="form-group">
        <label class="form-label">Funcionário</label>
        <select class="form-input" id="fpontoFunc" onchange="renderFolhaPontoPage()">
          <option value="">Todos</option>
          ${funcionarios.map((f) => `<option value="${escapeAttr(f.id)}" ${f.id === funcFiltro ? 'selected' : ''}>${escapeHtml(f.nome)}</option>`).join('')}
        </select>
      </div>
    </div>
    <p style="color:var(--text3);font-size:0.82rem;margin-bottom:10px">
      Registros aparecem aqui quando o app de ponto estiver gravando marcações. Uso para conferência e auditoria.
    </p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Data/hora</th><th>Funcionário</th><th>Batida</th><th>Geo</th><th>Foto</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="color:var(--text3)">Nenhuma marcação neste filtro.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function syncPontoFuncionarioUI(f) {
  const at = document.getElementById('funcPontoAtivo');
  if (at) at.checked = f?.pontoAtivo !== false;
  const st = document.getElementById('funcPontoPinStatus');
  if (st) {
    st.textContent = f?.pontoPinHash ? 'PIN já definido (use Gerar novo para trocar)' : 'PIN ainda não gerado';
  }
}

async function gerarPinPontoFuncionarioAtual() {
  const id = document.getElementById('funcId')?.value;
  if (!id) { toast('Salve o funcionário antes de gerar o PIN.', 'error'); return; }
  const f = funcionarios.find((x) => x.id === id);
  if (!f) return;
  const cpf = pontoNormalizarCpf(document.getElementById('funcCpf')?.value || f.cpf);
  if (cpf.length !== 11) { toast('CPF com 11 dígitos é obrigatório para o ponto.', 'error'); return; }
  const pin = pontoGerarPin6();
  const salt = pontoGerarSaltHex(16);
  const hash = await pontoHashPin(currentOrg.id, cpf, pin, salt);
  let token = f.pontoLinkToken;
  if (!token) token = pontoGerarLinkToken();
  const payload = {
    pontoPinSalt: salt,
    pontoPinHash: hash,
    pontoPinGeradoEm: new Date().toISOString(),
    pontoLinkToken: token,
    pontoAtivo: !!document.getElementById('funcPontoAtivo')?.checked
  };
  await fsUpdate('funcionarios', id, payload);
  const idx = funcionarios.findIndex((x) => x.id === id);
  if (idx >= 0) Object.assign(funcionarios[idx], payload);
  syncPontoFuncionarioUI(funcionarios[idx]);
  try {
    await navigator.clipboard?.writeText(pin);
  } catch (e) { /* ignore */ }
  toast(`PIN gerado: ${pin} (também copiado se o navegador permitir)`, 'success');
}

async function copiarLinkPontoFuncionarioAtual() {
  const id = document.getElementById('funcId')?.value;
  if (!id) { toast('Salve o funcionário antes.', 'error'); return; }
  const f = funcionarios.find((x) => x.id === id);
  if (!f) return;
  if (!f.pontoPinHash) { toast('Gere o PIN deste funcionário antes de enviar o link.', 'error'); return; }
  const cod = (currentOrg.pontoCodigo || '').trim();
  if (cod.length < 4) { toast('Defina e salve o código da empresa em Configurações → Ponto eletrônico.', 'error'); return; }
  const url = `${getPwaPontoBaseDir()}ponto/?c=${encodeURIComponent(cod)}`;
  try {
    await navigator.clipboard?.writeText(url);
  } catch (e) { /* ignore */ }
  toast(
    `Link único do app copiado. É o mesmo para todos: cada um entra com código da empresa, últimos 4 do CPF e o PIN (envie também o PIN de ${f.nome || 'o colaborador'} por canal seguro).`,
    'success'
  );
}
