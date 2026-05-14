// =====================================================
// JORNADA DA EMPRESA + POLÍTICA + FERIADOS (Sprint 1)
// =====================================================

const JORNADA_DIA_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getDefaultJornadaDias() {
  const diaPadrao = {
    ativo: true,
    entrada: '07:00',
    saidaAlmoco: '12:00',
    voltaAlmoco: '13:00',
    saida: '15:20'
  };
  const dias = [];
  for (let d = 0; d <= 6; d++) {
    dias.push({
      diaSemana: d,
      ativo: d >= 1 && d <= 6,
      entrada: diaPadrao.entrada,
      saidaAlmoco: diaPadrao.saidaAlmoco,
      voltaAlmoco: diaPadrao.voltaAlmoco,
      saida: diaPadrao.saida
    });
  }
  return dias;
}

function getDefaultPoliticaJornada() {
  return {
    modoHoras: 'pagamento_mes',
    toleranciaMinutos: 10,
    descontaDsrFaltaInjustificada: true,
    extraDiaUtilPct: 50,
    extraDomFeriadoPct: 100,
    adicionalNoturnoAtivo: false,
    adicionalNoturnoPct: 20,
    prazoCompensacaoBancoDias: 180,
    tetoBancoHorasPositivo: 40,
    observacoesPolitica: ''
  };
}

function mergeJornadaDias(saved) {
  const def = getDefaultJornadaDias();
  if (!Array.isArray(saved) || !saved.length) return def;
  const byDia = {};
  saved.forEach((x) => { if (x && typeof x.diaSemana === 'number') byDia[x.diaSemana] = x; });
  return def.map((d) => ({ ...d, ...(byDia[d.diaSemana] || {}) }));
}

function mergePolitica(saved) {
  return { ...getDefaultPoliticaJornada(), ...(saved || {}) };
}

function pascoaUtc(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function addDiasUtc(dataUtc, delta) {
  const d = new Date(dataUtc.getTime());
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

function isoUtc(dataUtc) {
  const y = dataUtc.getUTCFullYear();
  const m = String(dataUtc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dataUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function feriadosNacionaisBrasil(ano) {
  const pas = pascoaUtc(ano);
  const lista = [];
  const push = (dt, nome, tipo) => lista.push({ data: isoUtc(dt), nome, tipo });

  push(addDiasUtc(pas, -47), 'Carnaval (terça-feira)', 'nacional');
  push(addDiasUtc(pas, -2), 'Sexta-feira Santa', 'nacional');
  push(pas, 'Páscoa (domingo)', 'nacional');
  push(addDiasUtc(pas, 60), 'Corpus Christi', 'nacional');

  push(new Date(Date.UTC(ano, 0, 1)), 'Confraternização universal', 'nacional');
  push(new Date(Date.UTC(ano, 3, 21)), 'Tiradentes', 'nacional');
  push(new Date(Date.UTC(ano, 4, 1)), 'Dia do Trabalho', 'nacional');
  push(new Date(Date.UTC(ano, 8, 7)), 'Independência do Brasil', 'nacional');
  push(new Date(Date.UTC(ano, 9, 12)), 'Nossa Senhora Aparecida', 'nacional');
  push(new Date(Date.UTC(ano, 10, 2)), 'Finados', 'nacional');
  push(new Date(Date.UTC(ano, 10, 15)), 'Proclamação da República', 'nacional');
  push(new Date(Date.UTC(ano, 10, 20)), 'Dia da Consciência Negra', 'nacional');
  push(new Date(Date.UTC(ano, 11, 25)), 'Natal', 'nacional');

  return lista;
}

async function garantirJornadaSettingsDoc() {
  if (!currentOrg) return;
  if (jornadaSettings.length) return;
  const payload = {
    nome: 'Padrão da empresa',
    dias: getDefaultJornadaDias(),
    cargaSemanalAlvo: 44,
    descricao: 'Jornada padrão para o módulo de ponto (ajuste os horários conforme sua empresa).'
  };
  const novo = await fsAdd('jornadaSettings', payload);
  jornadaSettings = [novo];
}

async function garantirPoliticaJornadaDoc() {
  if (!currentOrg) return;
  if (politicaJornada.length) return;
  const novo = await fsAdd('politicaJornada', getDefaultPoliticaJornada());
  politicaJornada = [novo];
}

function getJornadaSettingsMerged() {
  const raw = jornadaSettings[0] || {};
  return {
    id: raw.id || null,
    nome: raw.nome || 'Padrão da empresa',
    dias: mergeJornadaDias(raw.dias),
    cargaSemanalAlvo: raw.cargaSemanalAlvo ?? 44,
    descricao: raw.descricao || ''
  };
}

function getPoliticaMerged() {
  const raw = politicaJornada[0] || {};
  return { id: raw.id || null, ...mergePolitica(raw) };
}

function jornadaEscapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderJornadaPoliticaPage() {
  const root = document.getElementById('jornadaPoliticaRoot');
  if (!root) return;

  const j = getJornadaSettingsMerged();
  const p = getPoliticaMerged();

  const diasRows = j.dias.map((dia) => `
    <tr data-dia="${dia.diaSemana}">
      <td style="font-weight:600">${JORNADA_DIA_LABELS[dia.diaSemana]}</td>
      <td><input type="checkbox" class="jorn-dia-ativo" ${dia.ativo ? 'checked' : ''}></td>
      <td><input type="time" class="form-input jorn-ent" value="${dia.entrada || ''}" style="min-width:7rem"></td>
      <td><input type="time" class="form-input jorn-sai-alm" value="${dia.saidaAlmoco || ''}" style="min-width:7rem"></td>
      <td><input type="time" class="form-input jorn-volta-alm" value="${dia.voltaAlmoco || ''}" style="min-width:7rem"></td>
      <td><input type="time" class="form-input jorn-sai" value="${dia.saida || ''}" style="min-width:7rem"></td>
    </tr>
  `).join('');

  const feriadosRows = (feriados || []).slice().sort((a, b) => (a.data || '').localeCompare(b.data || ''))
    .map((f) => `
      <tr data-id="${f.id}">
        <td><input type="date" class="form-input fer-data" value="${f.data || ''}"></td>
        <td><input type="text" class="form-input fer-nome" value="${jornadaEscapeAttr(f.nome || '')}" placeholder="Nome do feriado"></td>
        <td>
          <select class="form-input fer-tipo">
            <option value="nacional" ${f.tipo === 'nacional' ? 'selected' : ''}>Nacional</option>
            <option value="estadual" ${f.tipo === 'estadual' ? 'selected' : ''}>Estadual</option>
            <option value="municipal" ${f.tipo === 'municipal' ? 'selected' : ''}>Municipal</option>
            <option value="empresa" ${f.tipo === 'empresa' ? 'selected' : ''}>Empresa / facultativo</option>
          </select>
        </td>
        <td style="text-align:right;white-space:nowrap">
          <button type="button" class="btn-icon" title="Excluir" onclick="excluirFeriadoJornada('${jornadaEscapeAttr(f.id)}')">🗑️</button>
        </td>
      </tr>
    `).join('');

  root.innerHTML = `
    ${typeof jornadaLegalAvisoGeralHtml === 'function' ? jornadaLegalAvisoGeralHtml() : ''}

    <div class="jornada-tabs">
      <button type="button" class="jornada-tab active" data-tab="jornada">Jornada da empresa</button>
      <button type="button" class="jornada-tab" data-tab="politica">Política de jornada</button>
      <button type="button" class="jornada-tab" data-tab="feriados">Feriados</button>
    </div>

    <div class="jornada-panel active" id="jornada-panel-jornada">
      <p style="color:var(--text3);font-size:0.85rem;margin-bottom:12px">
        Horários previstos por dia da semana. Serão usados pelo módulo de ponto para calcular horas previstas, faltas e extras.
      </p>
      ${typeof jornadaLegalDetalhe === 'function' ? jornadaLegalDetalhe('Saiba mais: jornada e intervalos', `<p>A CLT trata duração do trabalho, intervalos e regimes especiais. Ajuste conforme a realidade da empresa e acordos coletivos.</p><p><a href="${JORNADA_LEGAL_REF.urlClt}" target="_blank" rel="noopener">CLT (Planalto)</a></p>`) : ''}

      <div class="form-grid form-grid-2" style="margin-top:12px">
        <div class="form-group">
          <label class="form-label">Nome do modelo</label>
          <input type="text" class="form-input" id="jornNome" value="${jornadaEscapeAttr(j.nome)}">
        </div>
        <div class="form-group">
          <label class="form-label">Carga semanal alvo (h) — referência</label>
          <input type="number" class="form-input" id="jornCargaSemanal" step="0.01" value="${j.cargaSemanalAlvo}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Observações internas</label>
        <textarea class="form-input" id="jornDescricao" rows="2" style="resize:vertical">${jornadaEscapeAttr(j.descricao)}</textarea>
      </div>

      <div class="table-wrap" style="margin-top:12px">
        <table class="data-table">
          <thead><tr>
            <th>Dia</th><th>Trabalha</th><th>Entrada</th><th>Saída almoço</th><th>Volta</th><th>Saída</th>
          </tr></thead>
          <tbody>${diasRows}</tbody>
        </table>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary btn-sm" onclick="salvarJornadaEmpresa()">Salvar jornada</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="aplicarTemplateJornada44h()">Modelo 7h20 seg–sáb (44h)</button>
      </div>
    </div>

    <div class="jornada-panel" id="jornada-panel-politica" style="display:none">
      ${typeof jornadaLegalPoliticaBlocos === 'function' ? jornadaLegalPoliticaBlocos() : ''}
      <div class="form-grid form-grid-2" style="margin-top:12px">
        <div class="form-group">
          <label class="form-label">Modo de tratamento das horas</label>
          <select class="form-input" id="polModoHoras">
            <option value="pagamento_mes" ${p.modoHoras === 'pagamento_mes' ? 'selected' : ''}>Pagamento no mês (extras na folha)</option>
            <option value="banco_horas" ${p.modoHoras === 'banco_horas' ? 'selected' : ''}>Banco de horas</option>
            <option value="misto" ${p.modoHoras === 'misto' ? 'selected' : ''}>Misto (teto de banco + pagamento)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tolerância (minutos)</label>
          <input type="number" class="form-input" id="polTolerancia" min="0" max="120" step="1" value="${p.toleranciaMinutos}">
        </div>
        <div class="form-group">
          <label class="form-label">Extra dia útil (%)</label>
          <input type="number" class="form-input" id="polExtra50" step="1" value="${p.extraDiaUtilPct}">
        </div>
        <div class="form-group">
          <label class="form-label">Extra domingo / feriado (%)</label>
          <input type="number" class="form-input" id="polExtra100" step="1" value="${p.extraDomFeriadoPct}">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="polDsr" ${p.descontaDsrFaltaInjustificada ? 'checked' : ''}>
            Marcar intenção de tratar DSR em falta injustificada (validar com assessor)
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">Prazo sugerido banco (dias)</label>
          <input type="number" class="form-input" id="polPrazoBanco" min="1" max="730" value="${p.prazoCompensacaoBancoDias}">
        </div>
        <div class="form-group">
          <label class="form-label">Teto horas positivas banco (h)</label>
          <input type="number" class="form-input" id="polTetoBanco" step="0.5" value="${p.tetoBancoHorasPositivo}">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="polNoturno" ${p.adicionalNoturnoAtivo ? 'checked' : ''}>
            Adicional noturno (22h–5h)
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">% noturno</label>
          <input type="number" class="form-input" id="polNoturnoPct" step="1" value="${p.adicionalNoturnoPct}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Observações da política</label>
        <textarea class="form-input" id="polObs" rows="2" style="resize:vertical">${jornadaEscapeAttr(p.observacoesPolitica || '')}</textarea>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick="salvarPoliticaJornada()">Salvar política</button>
    </div>

    <div class="jornada-panel" id="jornada-panel-feriados" style="display:none">
      <p style="color:var(--text3);font-size:0.85rem;margin-bottom:8px">
        <strong>Nacionais:</strong> use <strong>Importar feriados nacionais</strong> — informe o <em>ano inicial</em> e o <em>ano final</em> (ex.: 2027 até 2050).
        Datas que já existirem na lista são ignoradas. Limite de <strong>50 anos</strong> por importação (pode rodar de novo depois, se precisar).
      </p>
      <p style="color:var(--text3);font-size:0.85rem;margin-bottom:12px">
        <strong>Municipais / estaduais / da empresa:</strong> clique em <strong>Feriado manual</strong>, preencha a <strong>data</strong>, o <strong>nome</strong> (ex.: “Aniversário de Cidade X”)
        e escolha o tipo <strong>Municipal</strong> ou <strong>Estadual</strong>. Depois clique em <strong>Salvar feriados</strong>.
        Sempre confira no calendário oficial da prefeitura e na CCT.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button type="button" class="btn btn-outline btn-sm" onclick="importarFeriadosNacionais()">Importar feriados nacionais…</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="adicionarFeriadoEmBranco()">➕ Feriado manual</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Data</th><th>Nome</th><th>Tipo</th><th></th></tr></thead>
          <tbody id="feriadosTableBody">${feriadosRows || '<tr><td colspan="4" style="color:var(--text3)">Nenhum feriado cadastrado.</td></tr>'}</tbody>
        </table>
      </div>
      <button type="button" class="btn btn-primary btn-sm" style="margin-top:12px" onclick="salvarFeriadosJornada()">Salvar feriados</button>
    </div>
  `;

  root.querySelectorAll('.jornada-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      root.querySelectorAll('.jornada-tab').forEach((b) => b.classList.toggle('active', b === btn));
      root.querySelectorAll('.jornada-panel').forEach((panel) => {
        const show = panel.id === `jornada-panel-${tab}`;
        panel.classList.toggle('active', show);
        panel.style.display = show ? 'block' : 'none';
      });
    });
  });
}

function coletarDiasDoDom() {
  const rows = document.querySelectorAll('#jornada-panel-jornada tr[data-dia]');
  const dias = [];
  rows.forEach((tr) => {
    const diaSemana = parseInt(tr.getAttribute('data-dia'), 10);
    dias.push({
      diaSemana,
      ativo: !!tr.querySelector('.jorn-dia-ativo')?.checked,
      entrada: tr.querySelector('.jorn-ent')?.value || '',
      saidaAlmoco: tr.querySelector('.jorn-sai-alm')?.value || '',
      voltaAlmoco: tr.querySelector('.jorn-volta-alm')?.value || '',
      saida: tr.querySelector('.jorn-sai')?.value || ''
    });
  });
  return dias.sort((a, b) => a.diaSemana - b.diaSemana);
}

async function salvarJornadaEmpresa() {
  if (!currentOrg) { toast('Selecione uma organização', 'error'); return; }
  await garantirJornadaSettingsDoc();
  const j = getJornadaSettingsMerged();
  const payload = {
    nome: document.getElementById('jornNome')?.value?.trim() || 'Padrão da empresa',
    dias: coletarDiasDoDom(),
    cargaSemanalAlvo: parseFloat(document.getElementById('jornCargaSemanal')?.value) || 44,
    descricao: document.getElementById('jornDescricao')?.value || ''
  };
  if (j.id) await fsUpdate('jornadaSettings', j.id, payload);
  else {
    const novo = await fsAdd('jornadaSettings', payload);
    jornadaSettings = [novo];
  }
  jornadaSettings[0] = { ...jornadaSettings[0], ...payload, id: j.id || jornadaSettings[0].id };
  toast('Jornada salva!', 'success');
  renderJornadaPoliticaPage();
}

function aplicarTemplateJornada44h() {
  document.getElementById('jornCargaSemanal').value = '44';
  const dias = getDefaultJornadaDias();
  dias.forEach((dia) => {
    const tr = document.querySelector(`#jornada-panel-jornada tr[data-dia="${dia.diaSemana}"]`);
    if (!tr) return;
    tr.querySelector('.jorn-dia-ativo').checked = dia.ativo;
    tr.querySelector('.jorn-ent').value = dia.entrada;
    tr.querySelector('.jorn-sai-alm').value = dia.saidaAlmoco;
    tr.querySelector('.jorn-volta-alm').value = dia.voltaAlmoco;
    tr.querySelector('.jorn-sai').value = dia.saida;
  });
  toast('Modelo aplicado na tela. Salve a jornada.', 'info');
}

async function salvarPoliticaJornada() {
  if (!currentOrg) { toast('Selecione uma organização', 'error'); return; }
  await garantirPoliticaJornadaDoc();
  const p = getPoliticaMerged();
  const payload = {
    modoHoras: document.getElementById('polModoHoras')?.value || 'pagamento_mes',
    toleranciaMinutos: parseInt(document.getElementById('polTolerancia')?.value, 10) || 0,
    descontaDsrFaltaInjustificada: !!document.getElementById('polDsr')?.checked,
    extraDiaUtilPct: parseFloat(document.getElementById('polExtra50')?.value) || 50,
    extraDomFeriadoPct: parseFloat(document.getElementById('polExtra100')?.value) || 100,
    adicionalNoturnoAtivo: !!document.getElementById('polNoturno')?.checked,
    adicionalNoturnoPct: parseFloat(document.getElementById('polNoturnoPct')?.value) || 20,
    prazoCompensacaoBancoDias: parseInt(document.getElementById('polPrazoBanco')?.value, 10) || 180,
    tetoBancoHorasPositivo: parseFloat(document.getElementById('polTetoBanco')?.value) || 40,
    observacoesPolitica: document.getElementById('polObs')?.value || ''
  };
  if (p.id) await fsUpdate('politicaJornada', p.id, payload);
  else {
    const novo = await fsAdd('politicaJornada', payload);
    politicaJornada = [novo];
  }
  politicaJornada[0] = { ...politicaJornada[0], ...payload, id: p.id || politicaJornada[0].id };
  toast('Política salva!', 'success');
  renderJornadaPoliticaPage();
}

function adicionarFeriadoEmBranco() {
  feriados.push({ id: 'tmp_' + Date.now(), data: '', nome: '', tipo: 'municipal' });
  renderJornadaPoliticaPage();
  document.querySelector('.jornada-tab[data-tab="feriados"]')?.click();
}

async function excluirFeriadoJornada(id) {
  if (!id) return;
  if (!await confirmar('Excluir feriado?', '')) return;
  if (String(id).startsWith('tmp_')) {
    feriados = feriados.filter((f) => f.id !== id);
  } else {
    await fsDelete('feriados', id);
    feriados = feriados.filter((f) => f.id !== id);
  }
  toast('Removido', 'success');
  renderJornadaPoliticaPage();
  document.querySelector('.jornada-tab[data-tab="feriados"]')?.click();
}

async function importarFeriadosNacionais() {
  const padraoAno = String(new Date().getFullYear());
  const y1Str = prompt(
    'Importar feriados nacionais (Lei Federal + datas móveis: Carnaval, Sexta Santa, Páscoa, Corpus Christi, etc.)\n\n' +
    'Ano INICIAL (ex.: 2027):',
    padraoAno
  );
  const y1 = parseInt(y1Str, 10);
  if (!y1 || y1 < 2000 || y1 > 2100) { toast('Ano inicial inválido (use 2000 a 2100).', 'error'); return; }

  const y2Str = prompt(
    'Ano FINAL (ex.: 2050).\n' +
    'Deixe em branco para importar só o ano inicial (' + y1 + '):',
    ''
  );
  let y2 = y1;
  if (String(y2Str || '').trim() !== '') {
    y2 = parseInt(y2Str, 10);
    if (!y2 || y2 < 2000 || y2 > 2100) { toast('Ano final inválido.', 'error'); return; }
  }
  if (y2 < y1) { toast('O ano final não pode ser menor que o inicial.', 'error'); return; }

  const span = y2 - y1 + 1;
  if (span > 50) {
    toast('No máximo 50 anos por importação. Reduza o intervalo (ex.: 2027–2076 e depois 2077–2050 em outro passo).', 'error');
    return;
  }
  if (span > 15 && !await confirmar(
    'Importar vários anos?',
    `Serão ${span} anos (${y1} a ${y2}). Isso cria vários registros no Firestore. Continuar?`
  )) return;

  const existentes = new Set((feriados || []).map((f) => f.data).filter(Boolean));
  let add = 0;
  for (let ano = y1; ano <= y2; ano++) {
    const nacionais = feriadosNacionaisBrasil(ano);
    for (const item of nacionais) {
      if (existentes.has(item.data)) continue;
      existentes.add(item.data);
      if (db && currentOrg) {
        const novo = await fsAdd('feriados', item);
        feriados.push(novo);
      } else {
        feriados.push({
          ...item,
          id: 'feriados_' + ano + '_' + item.data + '_' + Math.random().toString(36).slice(2, 8)
        });
      }
      add++;
    }
  }
  toast(`Importados ${add} feriado(s) de ${y1} a ${y2} (datas já existentes foram ignoradas).`, 'success');
  renderJornadaPoliticaPage();
  document.querySelector('.jornada-tab[data-tab="feriados"]')?.click();
}

async function salvarFeriadosJornada() {
  const body = document.getElementById('feriadosTableBody');
  if (!body) return;
  const rows = body.querySelectorAll('tr[data-id]');
  for (const tr of rows) {
    const id = tr.getAttribute('data-id');
    const data = tr.querySelector('.fer-data')?.value || '';
    const nome = tr.querySelector('.fer-nome')?.value?.trim() || '';
    const tipo = tr.querySelector('.fer-tipo')?.value || 'empresa';
    if (!data || !nome) continue;
    const payload = { data, nome, tipo };
    if (String(id).startsWith('tmp_')) {
      const novo = await fsAdd('feriados', payload);
      const idx = feriados.findIndex((f) => f.id === id);
      if (idx >= 0) feriados[idx] = novo;
    } else {
      await fsUpdate('feriados', id, payload);
      const idx = feriados.findIndex((f) => f.id === id);
      if (idx >= 0) Object.assign(feriados[idx], payload);
    }
  }
  feriados = await fsGetAll('feriados');
  toast('Feriados salvos!', 'success');
  renderJornadaPoliticaPage();
  document.querySelector('.jornada-tab[data-tab="feriados"]')?.click();
}

function getJornadaEfetivaFuncionario(func) {
  const padrao = getJornadaSettingsMerged().dias;
  if (!func || func.jornadaUsarPadraoOrg !== false) return { origem: 'org', dias: padrao };
  const dias = mergeJornadaDias(func.jornadaDias);
  return { origem: 'funcionario', dias };
}

function renderFuncionarioJornadaOverride(func) {
  const tbody = document.getElementById('funcJornadaDiasBody');
  const chk = document.getElementById('funcJornadaUsarPadrao');
  if (!tbody || !chk) return;
  const usePadrao = !func || func.jornadaUsarPadraoOrg !== false;
  chk.checked = usePadrao;
  const dias = mergeJornadaDias(usePadrao ? null : func.jornadaDias);
  tbody.innerHTML = dias.map((dia) => `
    <tr data-fjd="${dia.diaSemana}">
      <td style="font-weight:600">${JORNADA_DIA_LABELS[dia.diaSemana]}</td>
      <td><input type="checkbox" class="fj-ativo" ${dia.ativo ? 'checked' : ''}></td>
      <td><input type="time" class="form-input fj-ent" value="${dia.entrada || ''}"></td>
      <td><input type="time" class="form-input fj-salm" value="${dia.saidaAlmoco || ''}"></td>
      <td><input type="time" class="form-input fj-valm" value="${dia.voltaAlmoco || ''}"></td>
      <td><input type="time" class="form-input fj-sai" value="${dia.saida || ''}"></td>
    </tr>
  `).join('');
  const wrap = document.getElementById('funcJornadaOverrideWrap');
  if (wrap) wrap.style.opacity = usePadrao ? '0.55' : '1';
  tbody.querySelectorAll('input').forEach((inp) => { inp.disabled = usePadrao; });
  chk.onchange = () => {
    const on = chk.checked;
    if (wrap) wrap.style.opacity = on ? '0.55' : '1';
    tbody.querySelectorAll('input').forEach((inp) => { inp.disabled = on; });
  };
}

function coletarJornadaOverrideFuncionario() {
  const tbody = document.getElementById('funcJornadaDiasBody');
  if (!tbody) return null;
  const dias = [];
  tbody.querySelectorAll('tr[data-fjd]').forEach((tr) => {
    const diaSemana = parseInt(tr.getAttribute('data-fjd'), 10);
    dias.push({
      diaSemana,
      ativo: !!tr.querySelector('.fj-ativo')?.checked,
      entrada: tr.querySelector('.fj-ent')?.value || '',
      saidaAlmoco: tr.querySelector('.fj-salm')?.value || '',
      voltaAlmoco: tr.querySelector('.fj-valm')?.value || '',
      saida: tr.querySelector('.fj-sai')?.value || ''
    });
  });
  return dias.sort((a, b) => a.diaSemana - b.diaSemana);
}
