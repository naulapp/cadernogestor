// =====================================================
// EQUIPE
// =====================================================
function renderEquipe() {
  const tbody = document.getElementById('tabelaEquipe');
  const membros = currentOrg?.membros || [];
  if (membros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">👥</div><h3>Só você</h3></div></td></tr>`;
    return;
  }
  const roles = { gestor: 'Gestor', empregador: 'Empregador', funcionario: 'Funcionario' };
  tbody.innerHTML = membros.map(m => `<tr>
    <td><strong>${escapeHtml(m.nome || '-')}</strong></td>
    <td style="color:var(--text3)">${escapeHtml(m.email || '-')}</td>
    <td><span class="badge badge-accent">${roles[m.role] || m.role}</span></td>
    <td><span class="badge badge-green">Ativo</span></td>
    <td style="text-align:right"><button class="btn btn-outline btn-sm" onclick="editarMembro('${escapeAttr(m.uid)}')">Permissoes</button></td>
  </tr>`).join('');
}

// editarMembro e salvarMembro definidos abaixo com permissões granulares

function selectRole(role) {
  document.querySelectorAll('.role-option').forEach(r => r.classList.remove('active'));
  document.getElementById('role-' + role)?.classList.add('active');
}

function gerarConvite() {
  if (!currentOrg) return;
  const code = Math.random().toString(36).substring(2,8).toUpperCase();
  currentOrg.invite = code;
  if (db) db.collection('orgs').doc(currentOrg.id).update({ invite: code });
  else localDB.setOrg(currentOrg.id, currentOrg);
  document.getElementById('inviteDisplay').textContent = code;
  toast('Novo código gerado: ' + code, 'success');
}

function copyInvite() {
  const code = document.getElementById('inviteDisplay').textContent;
  navigator.clipboard.writeText(code).then(() => toast('Código copiado!', 'success'));
}

function openOrgSelector() {
  const nome = prompt('Nome da organização:', currentOrg?.nome || '');
  if (nome && currentOrg) {
    currentOrg.nome = nome;
    if (db) db.collection('orgs').doc(currentOrg.id).update({ nome });
    else localDB.setOrg(currentOrg.id, currentOrg);
    localStorage.setItem('cgOrgNome', nome);
    document.getElementById('currentOrgBadge').textContent = '🏢 ' + nome;
    toast('Nome atualizado', 'success');
  }
}

// =====================================================
// CONFIGURAÇÕES
// =====================================================
async function salvarConfig() {
  if (!currentOrg) return;
  const update = {
    nome: document.getElementById('cfgNome').value,
    cnpj: document.getElementById('cfgCnpj').value,
    cidade: document.getElementById('cfgCidade').value,
    responsavel: document.getElementById('cfgResponsavel').value,
  };
  Object.assign(currentOrg, update);
  if (db) await db.collection('orgs').doc(currentOrg.id).update(update);
  else localDB.setOrg(currentOrg.id, currentOrg);
  localStorage.setItem('cgOrgNome', update.nome);
  document.getElementById('currentOrgBadge').textContent = '🏢 ' + update.nome;
  toast('Dados da empresa salvos!', 'success');
}

// =====================================================
// POPULATE SELECTS
// =====================================================
function getDefaultEscalaSettings() {
  return {
    nome: 'Escala padrao',
    abertura: '08:00',
    fechamento: '18:00',
    tipo: '5x2',
    cargaSemanal: 44,
    jornadaDiaria: 8,
    intervalo: 60,
    limiteExtra: 2,
    coberturaMinima: 1,
    prioridade: 'equilibrar',
    diasFuncionamento: [1, 2, 3, 4, 5]
  };
}

function getEscalaSettings() {
  return escalaSettings[0] ? { ...getDefaultEscalaSettings(), ...escalaSettings[0] } : getDefaultEscalaSettings();
}

function getEscalaRule(funcionarioId) {
  return escalaRules.find(r => r.funcionarioId === funcionarioId) || {
    funcionarioId,
    participaEscala: true,
    podeHoraExtra: false,
    limiteExtraIndividual: null,
    preferenciaTurno: 'indiferente',
    entradaPreferida: '',
    diasIndisponiveis: [],
    folgaFixa: '0',
    cargaSemanalIndividual: null,
    observacoes: ''
  };
}

function renderEscalaPage() {
  const settings = getEscalaSettings();
  const fields = {
    escalaConfigNome: settings.nome,
    escalaAbertura: settings.abertura,
    escalaFechamento: settings.fechamento,
    escalaTipo: settings.tipo,
    escalaCargaSemanal: settings.cargaSemanal,
    escalaJornadaDiaria: settings.jornadaDiaria,
    escalaIntervalo: settings.intervalo,
    escalaHoraExtraLimite: settings.limiteExtra,
    escalaCoberturaMinima: settings.coberturaMinima,
    escalaPrioridade: settings.prioridade
  };
  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = value ?? '';
  });
  const diasEl = document.getElementById('escalaDiasFuncionamento');
  if (diasEl) {
    // Suporte a div com checkboxes
    if (diasEl.tagName === 'DIV') {
      diasEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = (settings.diasFuncionamento || [1,2,3,4,5]).includes(parseInt(cb.value, 10));
      });
    } else {
      Array.from(diasEl.options || []).forEach(opt => {
        opt.selected = (settings.diasFuncionamento || [1,2,3,4,5]).includes(parseInt(opt.value, 10));
      });
    }
  }
  const now = new Date();
  const mesEl = document.getElementById('escalaMes');
  const anoEl = document.getElementById('escalaAno');
  if (mesEl && !mesEl.value) mesEl.value = now.getMonth() + 1;
  if (anoEl && !anoEl.value) anoEl.value = now.getFullYear();
  renderEscalaFuncionarios();
  renderEscalaResultado();
}

function renderEscalaFuncionarios() {
  const tbody = document.getElementById('escalaFuncionariosTable');
  if (!tbody) return;
  const ativos = funcionarios.filter(f => f.ativo !== false);
  if (ativos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">S</div><h3>Nenhum funcionario ativo</h3><p>Cadastre funcionarios antes de montar a escala</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = ativos.map(f => {
    const rule = getEscalaRule(f.id);
    const fid = escapeAttr(f.id);
    const nome = escapeHtml(f.nome);
    const observacoes = escapeAttr(f.observacoes || '');
    const cargo = escapeHtml(f.cargo || '-')
    return `<tr>
      <td><span style="cursor:pointer;color:var(--accent2);text-decoration:underline" onclick="abrirFichaFuncionario('${fid}')" title="Ver ficha completa"><strong>${nome}</strong></span>${f.observacoes ? ` <span title="${observacoes}" style="cursor:help;color:var(--text3);font-size:0.8rem">obs</span>` : ''}</td>
      <td>${cargo}</td>
      <td><span class="badge ${rule.participaEscala !== false ? 'badge-green' : 'badge-gray'}">${rule.participaEscala !== false ? 'Sim' : 'Nao'}</span></td>
      <td><span class="badge ${rule.podeHoraExtra ? 'badge-accent' : 'badge-gray'}">${rule.podeHoraExtra ? 'Permitida' : 'Bloqueada'}</span></td>
      <td>${labelTurno(rule.preferenciaTurno)}</td>
      <td>${labelDiaSemana(rule.folgaFixa)}</td>
      <td style="text-align:right"><button class="btn btn-outline btn-sm" onclick="openEscalaRuleModal('${fid}')">Configurar</button></td>
    </tr>`;
  }).join('');
}

function openEscalaRuleModal(funcionarioId) {
  const rule = getEscalaRule(funcionarioId);
  document.getElementById('escalaRegraFuncionarioId').value = funcionarioId;
  document.getElementById('escalaRegraAtivo').value = rule.participaEscala !== false ? 'sim' : 'nao';
  document.getElementById('escalaRegraHoraExtra').value = rule.podeHoraExtra ? 'sim' : 'nao';
  document.getElementById('escalaRegraLimiteExtra').value = rule.limiteExtraIndividual ?? '';
  document.getElementById('escalaRegraTurno').value = rule.preferenciaTurno || 'indiferente';
  document.getElementById('escalaRegraEntradaPreferida').value = rule.entradaPreferida || '';
  document.getElementById('escalaRegraFolgaFixa').value = rule.folgaFixa ?? '0';
  document.getElementById('escalaRegraCargaSemanal').value = rule.cargaSemanalIndividual ?? '';
  document.getElementById('escalaRegraObservacoes').value = rule.observacoes || '';
  const indisponiveis = rule.diasIndisponiveis || [];
  Array.from(document.getElementById('escalaRegraIndisponiveis').options).forEach(opt => {
    opt.selected = indisponiveis.includes(parseInt(opt.value, 10));
  });
  openModal('modal-escala-regra');
}

async function saveEscalaRule() {
  const funcionarioId = document.getElementById('escalaRegraFuncionarioId').value;
  if (!funcionarioId) return;
  const podeHoraExtra = document.getElementById('escalaRegraHoraExtra').value === 'sim';
  const payload = {
    funcionarioId,
    participaEscala: document.getElementById('escalaRegraAtivo').value === 'sim',
    podeHoraExtra,
    limiteExtraIndividual: podeHoraExtra ? (parseFloat(document.getElementById('escalaRegraLimiteExtra').value) || null) : 0,
    preferenciaTurno: document.getElementById('escalaRegraTurno').value,
    entradaPreferida: document.getElementById('escalaRegraEntradaPreferida').value || '',
    folgaFixa: document.getElementById('escalaRegraFolgaFixa').value,
    cargaSemanalIndividual: parseFloat(document.getElementById('escalaRegraCargaSemanal').value) || null,
    diasIndisponiveis: getSelectedValues('escalaRegraIndisponiveis').map(v => parseInt(v, 10)),
    observacoes: document.getElementById('escalaRegraObservacoes').value.trim()
  };
  const existente = escalaRules.find(r => r.funcionarioId === funcionarioId);
  if (existente?.id) {
    await fsUpdate('escalaRules', existente.id, payload);
    Object.assign(existente, payload);
  } else {
    const novo = await fsAdd('escalaRules', payload);
    escalaRules.push(novo);
  }
  closeModal('modal-escala-regra');
  renderEscalaFuncionarios();
  toast('Regra da escala salva!', 'success');
}

async function saveEscalaSettings() {
  const diasFuncionamento = getSelectedValues('escalaDiasFuncionamento').map(v => parseInt(v, 10));
  if (diasFuncionamento.length === 0) {
    toast('Selecione ao menos um dia de funcionamento', 'error');
    return null;
  }
  const payload = {
    nome: document.getElementById('escalaConfigNome').value.trim() || 'Escala padrao',
    abertura: document.getElementById('escalaAbertura').value,
    fechamento: document.getElementById('escalaFechamento').value,
    tipo: document.getElementById('escalaTipo').value,
    cargaSemanal: parseFloat(document.getElementById('escalaCargaSemanal').value) || 44,
    jornadaDiaria: parseFloat(document.getElementById('escalaJornadaDiaria').value) || 8,
    intervalo: parseFloat(document.getElementById('escalaIntervalo').value) || 60,
    limiteExtra: parseFloat(document.getElementById('escalaHoraExtraLimite').value) || 0,
    coberturaMinima: parseInt(document.getElementById('escalaCoberturaMinima').value, 10) || 1,
    prioridade: document.getElementById('escalaPrioridade').value,
    diasFuncionamento
  };
  if (!payload.abertura || !payload.fechamento || payload.abertura >= payload.fechamento) {
    toast('Revise os horarios de abertura e fechamento', 'error');
    return null;
  }
  if (escalaSettings[0]?.id) {
    await fsUpdate('escalaSettings', escalaSettings[0].id, payload);
    escalaSettings[0] = { ...escalaSettings[0], ...payload };
  } else {
    const novo = await fsAdd('escalaSettings', payload);
    escalaSettings = [novo];
  }
  renderEscalaPage();
  toast('Configuracoes da escala salvas!', 'success');
  return payload;
}

async function generateEscala() {
  const saved = await saveEscalaSettings();
  if (!saved) {
    return;
  }
  const settings = getEscalaSettings();
  const mes = parseInt(document.getElementById('escalaMes').value, 10);
  const ano = parseInt(document.getElementById('escalaAno').value, 10);
  const equipe = funcionarios.filter(f => f.ativo !== false)
    .map((funcionario, index) => ({ funcionario, regra: getEscalaRule(funcionario.id), index }))
    .filter(item => item.regra.participaEscala !== false);
  if (equipe.length === 0) {
    toast('Nenhum funcionario ativo participa da escala', 'error');
    return;
  }
  const resultadoEquipe = equipe.map(item => buildEscalaFuncionario(item.funcionario, item.regra, settings, mes, ano, item.index, equipe.length));
  escalaGerada = {
    competencia: `${ano}-${String(mes).padStart(2, '0')}`,
    settings,
    equipe: resultadoEquipe,
    alertas: collectEscalaAlertas(resultadoEquipe, settings, mes, ano),
    geradoEm: new Date().toISOString()
  };
  // preview select removed
  renderEscalaResultado();
  try {
    await fsAdd('monthlyScales', {
      competencia: escalaGerada.competencia,
      geradoEm: escalaGerada.geradoEm,
      resumo: resultadoEquipe.map(item => ({
        funcionarioId: item.funcionario.id,
        funcionarioNome: item.funcionario.nome,
        horasMes: item.totalHorasMes,
        horasExtrasMes: item.totalExtrasMes,
        diasEscalados: item.diasEscalados
      })),
      alertas: escalaGerada.alertas
    });
  } catch (e) {
    console.warn('Falha ao salvar historico da escala', e);
  }
  toast('Escala mensal gerada!', 'success');
}

function buildEscalaFuncionario(funcionario, regra, settings, mes, ano, index, totalEquipe) {
  const dias = [];
  const diasFuncionamento = settings.diasFuncionamento || [];
  const jornadaPadraoMin = Math.round((settings.jornadaDiaria || 8) * 60);
  const intervaloMin = parseInt(settings.intervalo, 10) || 0;
  const cargaSemanalMin = Math.round((parseFloat(regra.cargaSemanalIndividual) || settings.cargaSemanal) * 60);
  const limiteExtraMin = Math.round(((regra.podeHoraExtra ? (regra.limiteExtraIndividual ?? settings.limiteExtra) : 0) || 0) * 60);
  const aberturaMin = timeToMinutes(settings.abertura);
  const fechamentoMin = timeToMinutes(settings.fechamento);
  const janelaEmpresaMin = Math.max(jornadaPadraoMin, fechamentoMin - aberturaMin - intervaloMin);
  const totaisSemana = {};
  for (let dia = 1; dia <= daysInMonth(mes, ano); dia++) {
    const data = new Date(ano, mes - 1, dia);
    const diaSemana = data.getDay();
    if (!diasFuncionamento.includes(diaSemana)) continue;
    if (String(diaSemana) === String(regra.folgaFixa)) continue;
    if ((regra.diasIndisponiveis || []).includes(diaSemana)) continue;
    const weekKey = getWeekKey(data);
    const usadoSemana = totaisSemana[weekKey] || 0;
    let restanteSemana = Math.max(0, cargaSemanalMin - usadoSemana);
    if (restanteSemana <= 0) continue;
    let minutosTrabalho = Math.min(jornadaPadraoMin, restanteSemana);
    const lacunaCobertura = Math.max(0, janelaEmpresaMin - jornadaPadraoMin);
    // Sempre adicionar horas extras se o funcionário tem limite definido
    if (regra.podeHoraExtra && limiteExtraMin > 0) {
      minutosTrabalho += Math.min(limiteExtraMin, janelaEmpresaMin - minutosTrabalho);
    }
    minutosTrabalho = Math.min(minutosTrabalho, janelaEmpresaMin);
    if (minutosTrabalho < 240 && dias.length > 0) continue;
    const horario = suggestHorario(regra, settings, minutosTrabalho, intervaloMin, index, totalEquipe);
    totaisSemana[weekKey] = (totaisSemana[weekKey] || 0) + minutosTrabalho;
    dias.push({
      data: toInputDate(data),
      diaSemana,
      entrada: horario.entrada,
      saidaIntervalo: horario.saidaIntervalo,
      retornoIntervalo: horario.retornoIntervalo,
      saidaFinal: horario.saidaFinal,
      horasPrevistas: roundToOne(minutosTrabalho / 60),
      horaExtraPrevista: roundToOne(Math.max(0, minutosTrabalho - jornadaPadraoMin) / 60),
      observacao: ''
    });
  }
  return {
    funcionario,
    regra,
    dias,
    diasEscalados: dias.length,
    totalHorasMes: roundToOne(dias.reduce((sum, item) => sum + item.horasPrevistas, 0)),
    totalExtrasMes: roundToOne(dias.reduce((sum, item) => sum + item.horaExtraPrevista, 0))
  };
}

function collectEscalaAlertas(resultadoEquipe, settings, mes, ano) {
  const alertas = [];
  const coberturaMinima = parseInt(settings.coberturaMinima, 10) || 1;
  const diasFuncionamento = settings.diasFuncionamento || [];
  const coberturaDia = {};
  resultadoEquipe.forEach(item => {
    if (item.dias.length === 0) {
      alertas.push(`Sem escala gerada para ${item.funcionario.nome}. Revise folga fixa, indisponibilidades ou carga semanal.`);
    }
    item.dias.forEach(dia => {
      coberturaDia[dia.data] = (coberturaDia[dia.data] || 0) + 1;
      if (dia.horaExtraPrevista > 0 && !item.regra.podeHoraExtra) {
        alertas.push(`${item.funcionario.nome} recebeu hora extra em ${fmtData(dia.data)} sem permissao.`);
      }
    });
  });
  for (let dia = 1; dia <= daysInMonth(mes, ano); dia++) {
    const data = new Date(ano, mes - 1, dia);
    if (!diasFuncionamento.includes(data.getDay())) continue;
    const chave = toInputDate(data);
    if ((coberturaDia[chave] || 0) < coberturaMinima) {
      alertas.push(`Cobertura abaixo do minimo em ${fmtData(chave)}.`);
    }
  }
  return alertas;
}

function renderEscalaResultado() {
  const resumoEl = document.getElementById('escalaResumo');
  const alertasEl = document.getElementById('escalaAlertas');
  const previewEl = document.getElementById('escalaPreview');
  if (!resumoEl || !alertasEl || !previewEl) return;
  if (!escalaGerada) {
    resumoEl.innerHTML = '';
    alertasEl.innerHTML = '';
    previewEl.innerHTML = '';
    return;
  }
  const horasEquipe = roundToOne(escalaGerada.equipe.reduce((sum, item) => sum + item.totalHorasMes, 0));
  const extrasEquipe = roundToOne(escalaGerada.equipe.reduce((sum, item) => sum + item.totalExtrasMes, 0));
  resumoEl.innerHTML = `
    <div class="section-card">
      <div class="section-card-title">Resumo da competencia</div>
      <div class="escala-summary-grid">
        <div class="escala-summary-card"><div class="label">Competencia</div><div class="value">${escalaGerada.competencia}</div></div>
        <div class="escala-summary-card"><div class="label">Funcionarios escalados</div><div class="value">${escalaGerada.equipe.length}</div></div>
        <div class="escala-summary-card"><div class="label">Horas previstas</div><div class="value">${horasEquipe}h</div></div>
        <div class="escala-summary-card"><div class="label">Horas extras previstas</div><div class="value">${extrasEquipe}h</div></div>
      </div>
      <div style="margin-top:18px;overflow:auto">
        <table>
          <thead><tr><th>Funcionário</th><th>Dias</th><th>Horas</th><th>Extras</th><th>Turno</th><th style="text-align:center">Folha de Ponto</th></tr></thead>
          <tbody>${escalaGerada.equipe.map(item => `
            <tr>
              <td>${item.funcionario.nome}</td>
              <td>${item.diasEscalados}</td>
              <td>${item.totalHorasMes}h</td>
              <td>${item.totalExtrasMes}h</td>
              <td>${labelTurno(item.regra.preferenciaTurno)}</td>
              <td style="text-align:center;white-space:nowrap">
                <button class="btn-icon" title="Imprimir"
                  onclick="printEscalaFuncionario('${item.funcionario.id}')">🖨️</button>
                <button class="btn-icon" title="Baixar PDF" style="margin-left:4px"
                  onclick="downloadEscalaPdfFuncionario('${item.funcionario.id}')">📥</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    </div>`;
  alertasEl.innerHTML = escalaGerada.alertas.length > 0
    ? `<div class="section-card"><div class="section-card-title">Alertas</div>${escalaGerada.alertas.map(alerta => `<div class="escala-alert"><strong>Atencao:</strong> ${alerta}</div>`).join('')}</div>`
    : `<div class="section-card"><div class="section-card-title">Alertas</div><div class="empty-state"><div class="icon">OK</div><h3>Nenhum alerta critico</h3><p>A escala foi montada dentro dos limites configurados.</p></div></div>`;
  // renderEscalaPreview is now a no-op
  renderEscalaCheckList();
}

function renderEscalaPreview() {
  // Preview individual agora é feito pelos botões 🖨️ e 📥 na tabela de funcionários
  const previewEl = document.getElementById('escalaPreview');
  if (previewEl) previewEl.innerHTML = '';
}

function printEscalaPreview() {
  // Substitudo por printEscalaFuncionario(funcId)  use os botes na tabela
  toast('Use os botões 🖨️ ao lado de cada funcionário na tabela', 'info');
  return;
  const area = null;
  if (!area) return;
  const popup = window.open('', '_blank', 'width=980,height=720');
  popup.document.write(`<!DOCTYPE html><html><head><title>FOLHA DE PONTO</title><style>body{font-family:Arial,sans-serif;padding:24px;background:#fff;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:8px;font-size:12px;text-align:left}.escala-preview-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}.escala-preview-title{font-size:22px;font-weight:700}.escala-preview-sub,.escala-preview-meta{font-size:13px;color:#475569}.escala-preview-sign{margin-top:28px;display:flex;justify-content:space-between;gap:24px}.escala-preview-sign-line{flex:1;padding-top:14px;border-top:1px solid #94a3b8;text-align:center;font-size:12px}</style></head><body>${area.innerHTML}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

function downloadEscalaPdf() {
  const select = null; // removed
  if (!escalaGerada || !select?.value) {
    toast('Gere a escala e escolha um funcionario para exportar', 'error');
    return;
  }
  const item = escalaGerada.equipe.find(entry => entry.funcionario.id === select.value);
  if (!item) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FOLHA DE PONTO', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Empresa: ${currentOrg?.nome || 'Empresa'}`, 14, 24);
  doc.text(`Funcionario: ${item.funcionario.nome}`, 14, 30);
  doc.text(`Competencia: ${monthNameFromPeriod(escalaGerada.competencia)}`, 14, 36);
  doc.text(`TOTAL: ${item.totalHorasMes}h`, 14, 42);
  doc.text(`HORA EXTRA: ${item.totalExtrasMes}h`, 14, 48);
  doc.autoTable({
    startY: 54,
    head: [['DATA', 'DIA', 'ENTRADA', 'SAÍDA INT.', 'RETORNO', 'SAÍDA', 'TOTAL', 'H. EXTRA']],
    body: item.dias.map(dia => [fmtData(dia.data), dayNameShort(dia.diaSemana).toUpperCase(), dia.entrada, dia.saidaIntervalo, dia.retornoIntervalo, dia.saidaFinal, `${dia.horasPrevistas}h`, dia.horaExtraPrevista > 0 ? `${dia.horaExtraPrevista}h` : '']),
    styles: { fontSize: 8, cellPadding: 2.4 },
    headStyles: { fillColor: [15, 23, 42] }
  });
  doc.save(`Escala_${sanitizeFileName(item.funcionario.nome)}_${escalaGerada.competencia}.pdf`);
}

function suggestHorario(regra, settings, minutosTrabalho, intervaloMin, index, totalEquipe) {
  const aberturaMin = timeToMinutes(settings.abertura);
  const fechamentoMin = timeToMinutes(settings.fechamento);
  const duracaoPresencial = minutosTrabalho + intervaloMin;
  const maxInicio = Math.max(aberturaMin, fechamentoMin - duracaoPresencial);
  let entradaMin = aberturaMin;
  if (regra.entradaPreferida) {
    entradaMin = clamp(timeToMinutes(regra.entradaPreferida), aberturaMin, maxInicio);
  } else if (regra.preferenciaTurno === 'tarde') {
    entradaMin = clamp(aberturaMin + 120, aberturaMin, maxInicio);
  } else if (regra.preferenciaTurno === 'noite') {
    entradaMin = clamp(fechamentoMin - duracaoPresencial, aberturaMin, maxInicio);
  } else {
    const espaco = Math.max(0, maxInicio - aberturaMin);
    const passo = totalEquipe > 1 ? Math.floor(espaco / Math.max(1, totalEquipe - 1)) : 0;
    entradaMin = clamp(aberturaMin + (passo * index), aberturaMin, maxInicio);
  }
  const saidaIntervaloMin = entradaMin + Math.max(180, Math.floor(minutosTrabalho / 2));
  const retornoMin = saidaIntervaloMin + intervaloMin;
  const saidaFinalMin = retornoMin + Math.max(0, minutosTrabalho - (saidaIntervaloMin - entradaMin));
  return {
    entrada: minutesToTime(entradaMin),
    saidaIntervalo: minutesToTime(saidaIntervaloMin),
    retornoIntervalo: minutesToTime(retornoMin),
    saidaFinal: minutesToTime(Math.min(saidaFinalMin, fechamentoMin))
  };
}

function getSelectedValues(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return [];
  // Suporte para div com checkboxes (dias de funcionamento)
  if (el.tagName === 'DIV') {
    return Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
  }
  // select múltiplo tradicional
  return Array.from(el.selectedOptions || el.options || [])
    .filter(o => o.selected).map(opt => opt.value);
}

function labelTurno(turno) {
  return ({ manha: 'Manha', tarde: 'Tarde', noite: 'Noite', indiferente: 'Indiferente' })[turno] || 'Indiferente';
}

function labelDiaSemana(dia) {
  if (dia === '' || dia === null || typeof dia === 'undefined') return 'Nenhuma';
  return ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'][parseInt(dia, 10)] || 'Nenhuma';
}

function dayNameShort(index) {
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][index] || '';
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function getWeekKey(date) {
  const tmp = new Date(date);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() - tmp.getDay() + 1);
  return `${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}-${String(tmp.getDate()).padStart(2, '0')}`;
}

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(value) {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  return (h * 60) + m;
}

function minutesToTime(value) {
  const safe = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundToOne(value) {
  return Math.round((value || 0) * 10) / 10;
}

function monthNameFromPeriod(periodo) {
  const [ano, mes] = String(periodo).split('-');
  const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${meses[(parseInt(mes, 10) || 1) - 1]} / ${ano}`;
}

function sanitizeFileName(text) {
  return String(text || 'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function populateSelects() {
  const opts = funcionarios.map(f => `<option value="${escapeAttr(f.id)}">${escapeHtml(f.nome)}</option>`).join('');
  ['empFuncionario','valeFuncionario'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">Selecione...</option>' + opts;
  });
}

// =====================================================
// UTILS
// =====================================================
function fmtMoney(val) {
  return (parseFloat(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Formatar input como BRL ao perder foco
function formatMoneyBlur(el) {
  const val = parseFloat(el.value.replace(/[^0-9,.-]/g,'').replace(',','.')) || 0;
  el.value = val.toFixed(2).replace('.',',');
}

// Retorna valor numérico de input BRL formatado
function parseMoneyInput(el) {
  return parseFloat((el?.value||'0').replace(/\./g,'').replace(',','.')) || 0;
}


function fmtData(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function maskValorReais(el) {
  // Remove tudo que não é dígito
  let v = el.value.replace(/\D/g, '');
  if (!v) { el.value = ''; return; }
  // Converter para centavos e formatar
  const num = parseInt(v, 10);
  const reais = Math.floor(num / 100);
  const cents = num % 100;
  const reaisStr = reais.toLocaleString('pt-BR');
  el.value = reaisStr + ',' + String(cents).padStart(2, '0');
}

function maskCnpj(el) {
  let v = el.value.replace(/\D/g,'').substring(0,14);
  if (v.length > 12) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
  else if (v.length > 8) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d+)/,'$1.$2.$3/$4');
  else if (v.length > 5) v = v.replace(/(\d{2})(\d{3})(\d+)/,'$1.$2.$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d+)/,'$1.$2');
  el.value = v;
}

function maskCpf(el) {
  let v = el.value.replace(/\D/g,'');
  if (v.length > 11) v = v.slice(0,11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  el.value = v;
}

function toast(msg, type='info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':'ℹ️'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// Number to words (PT-BR, simplified)
function numberToWords(num) {
  const n = Math.round(num * 100);
  const reais = Math.floor(n / 100);
  const centavos = n % 100;
  const units = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const tens = ['','dez','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const hundreds = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];

  function convert(n) {
    if (n === 0) return 'zero';
    if (n === 100) return 'cem';
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' e ' + units[n%10] : '');
    if (n < 1000) return hundreds[Math.floor(n/100)] + (n%100 ? ' e ' + convert(n%100) : '');
    if (n < 1000000) {
      const k = Math.floor(n/1000);
      return (k===1 ? 'mil' : convert(k) + ' mil') + (n%1000 ? ' e ' + convert(n%1000) : '');
    }
    return n.toString();
  }

  let text = convert(reais) + (reais === 1 ? ' real' : ' reais');
  if (centavos > 0) text += ' e ' + convert(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  return text;
}

// =====================================================
// TEMA CLARO / ESCURO
// =====================================================
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('cgTheme', isDark ? 'light' : 'dark');
}

// Aplicar tema salvo (padrão: light)
(function() {
  const saved = localStorage.getItem('cgTheme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  window.addEventListener('load', () => {
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = saved === 'dark' ? '🌙' : '☀️';
  });
})();

// =====================================================
// CARGO  HELPERS
// =====================================================
let adicionaisGrupo = [];

function calcGrupoCargaMensal() {
  const semanal = parseFloat(document.getElementById('grupoCargaSemanal').value) || 44;
  // Carga mensal padrão CLT = (semanal / 6) * 30
  const mensal = Math.round((semanal / 6) * 30);
  document.getElementById('grupoCargaMensal').value = mensal;
  calcGrupoHoraExtra();
}

function calcGrupoHoraExtra() {
  const salario = parseFloat(document.getElementById('grupoSalario').value) || 0;
  const mensal = parseFloat(document.getElementById('grupoCargaMensal').value) || 220;
  const adicPct = parseFloat(document.getElementById('grupoHoraExtraPct').value) || 50;
  if (!salario || !mensal) return;
  // Sincronizar estado dos checkboxes com o array
  adicionaisGrupo.forEach((a, i) => {
    const cb = document.getElementById(`chkHoraExtra_adicionaisGrupo_${i}`);
    if (cb) a.incideHoraExtra = cb.checked;
    const cbValor = document.querySelector(`#grupoAdicionais .form-group:nth-child(${i+1}) input[type=checkbox]`);
  });
  const baseAdicionais = adicionaisGrupo
    .filter(a => a.incideHoraExtra && !a.isValorFixo)
    .reduce((s, a) => s + (salario * (a.pct||0) / 100), 0);
  const baseFixos = adicionaisGrupo
    .filter(a => a.incideHoraExtra && a.isValorFixo)
    .reduce((s, a) => s + (a.valor||0), 0);
  const baseTotal = salario + baseAdicionais + baseFixos;
  const horaBase = baseTotal / mensal;
  document.getElementById('grupoHoraExtra').value = (horaBase * (1 + adicPct/100)).toFixed(2);
}

function toggleInssType() {
  const tipo = document.getElementById('grupoInssType').value;
  document.getElementById('grupoInssValorGroup').style.display = tipo === 'valor' ? '' : 'none';
  document.getElementById('grupoInssPctGroup').style.display = tipo === 'pct' ? '' : 'none';
  atualizarResumoGrupo();
}

function addAdicionalGrupo() {
  adicionaisGrupo.push({ nome: adicionaisNomes[0]||'Insalubridade', isValorFixo:false, pct:0, valor:0, incideHoraExtra:false, incideInss:false });
  renderAdicionaisGrupo();
}

function removeAdicionalGrupo(idx) {
  adicionaisGrupo.splice(idx, 1);
  renderAdicionaisGrupo();
}

// Lista de nomes de adicionais pré-cadastrados
let adicionaisNomes = JSON.parse(localStorage.getItem('cgAdicionaisNomes') || 'null') ||
  ['Insalubridade','Periculosidade','Adicional Noturno','Hora Extra 50%','Hora Extra 100%','Adicional de Função'];

function salvarAdicionaisNomes() {
  localStorage.setItem('cgAdicionaisNomes', JSON.stringify(adicionaisNomes));
}

function renderAdicional(lista, idx, onRemove, onUpdate) {
  const a = lista[idx];
  const isValor = a.isValorFixo;
  return `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:8px;align-items:flex-end;margin-bottom:8px">
        <div class="form-group" style="margin:0">
          <label class="form-label">NOME / TIPO DO ADICIONAL</label>
          <div style="display:flex;gap:6px">
            <select class="form-input" style="flex:1"
              onchange="if(this.value==='__novo__'){cadastrarNovoAdicional(this,'${onUpdate}',${idx});}else{${onUpdate}[${idx}].nome=this.value;}">
              ${adicionaisNomes.map(n => `<option value="${n}" ${a.nome===n?'selected':''}>${n}</option>`).join('')}
              <option value="__novo__">+ Cadastrar novo...</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">${isValor?'VALOR (R$)':'PERCENTUAL (%)'}</label>
          <input type="number" class="form-input"
            value="${isValor?(a.valor||''):(a.pct||'')}"
            placeholder="${isValor?'200.00':'20'}"
            step="${isValor?'0.01':'1'}"
            oninput="${onUpdate}[${idx}].${isValor?'valor':'pct'}=parseFloat(this.value)||0">
        </div>
        <button class="btn-icon" onclick="${onRemove}(${idx})" style="height:42px;margin-bottom:0">🗑️</button>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.8rem">
          <input type="checkbox" ${isValor?'checked':''}
            onchange="${onUpdate}[${idx}].isValorFixo=this.checked;renderAdicionais${onUpdate==='adicionaisGrupo'?'Grupo':'Func'}()">
          <span>Valor fixo (R$)</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.8rem">
          <input type="checkbox" ${a.incideHoraExtra?'checked':''}
            onchange="${onUpdate}[${idx}].incideHoraExtra=this.checked;" id="chkHoraExtra_${onUpdate}_${idx}">
          <span>Incide na hora extra</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.8rem">
          <input type="checkbox" ${a.incideInss?'checked':''}
            onchange="${onUpdate}[${idx}].incideInss=this.checked">
          <span>Incide no INSS</span>
        </label>
      </div>
    </div>`;
}

function cadastrarNovoAdicional(selectEl, listName, idx) {
  const nome = prompt('Nome do novo adicional:');
  if (!nome || !nome.trim()) { selectEl.value = adicionaisNomes[0] || ''; return; }
  const nomeFmt = nome.trim();
  if (!adicionaisNomes.includes(nomeFmt)) {
    adicionaisNomes.push(nomeFmt);
    salvarAdicionaisNomes();
  }
  if (listName === 'adicionaisGrupo') {
    adicionaisGrupo[idx].nome = nomeFmt;
    renderAdicionaisGrupo();
  } else {
    adicionaisFunc[idx].nome = nomeFmt;
    renderAdicionaisFunc();
  }
}

function renderAdicionaisGrupo() {
  const c = document.getElementById('grupoAdicionais');
  if (!c) return;
  c.innerHTML = adicionaisGrupo.map((a, i) => renderAdicional(adicionaisGrupo, i, 'removeAdicionalGrupo', 'adicionaisGrupo')).join('');
}

function preencherAdicionaisGrupo(lista) {
  adicionaisGrupo = lista || [];
  renderAdicionaisGrupo();
}


// =====================================================
// ALERTAS DASHBOARD  vales e parcelas vencendo
// =====================================================
function renderAlertasDashboard() {
  const container = document.getElementById('dashAlertas');
  if (!container) return;
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const em3dias = new Date(hoje); em3dias.setDate(hoje.getDate() + 3);

  const alertas = [];

  // Vales pendentes vencidos ou vencendo
  vales.filter(v => v.status !== 'descontado').forEach(v => {
    if (!v.data) return;
    const d = new Date(v.data + 'T00:00:00');
    const func = funcionarios.find(f => f.id === v.funcionarioId);
    const nome = func?.nome || 'Funcionrio';
    const diasDiff = Math.floor((d - hoje) / 86400000);
    if (diasDiff < 0) alertas.push({ tipo: 'red', msg: `Vale de ${nome} (R$ ${fmtMoney(v.valor)}) está em atraso há ${Math.abs(diasDiff)} dia(s)` });
    else if (diasDiff <= 3) alertas.push({ tipo: 'yellow', msg: `Vale de ${nome} (R$ ${fmtMoney(v.valor)}) vence em ${diasDiff === 0 ? 'hoje' : diasDiff + ' dia(s)'}` });
  });

  // Parcelas de empréstimos
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  emprestimos.filter(e => e.status === 'ativo' || !e.status).forEach(e => {
    const func = funcionarios.find(f => f.id === e.funcionarioId);
    const nome = func?.nome || 'Funcionrio';
    const restante = (e.total || 0) - (e.pago || 0);
    if (restante > 0 && restante <= e.valorParcela) {
      alertas.push({ tipo: 'green', msg: `ltima parcela de ${nome}  ${e.descricao} (R$ ${fmtMoney(restante)})` });
    }
  });

  if (alertas.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = `<div class="section-card" style="margin-bottom:0">
    <div class="section-card-title">⚠️ Alertas</div>
    ${alertas.map(a => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="width:10px;height:10px;border-radius:50%;background:var(--${a.tipo});flex-shrink:0"></span>
      <span style="font-size:0.85rem">${a.msg}</span>
    </div>`).join('')}
  </div>`;
}

// =====================================================
// HISTÓRICO DE FOLHAS
// =====================================================
async function salvarHistoricoFolha(mesRef, dados) {
  // dados = { funcionarios: [{nome, totalProventos, totalDescontos, liquido}] }
  const totalBruto = dados.reduce((s, d) => s + (d.totalProventos || 0), 0);
  const totalDesc = dados.reduce((s, d) => s + (d.totalDescontos || 0), 0);
  const totalLiq = dados.reduce((s, d) => s + (d.liquido || 0), 0);
  const payload = {
    mesRef, geradoEm: new Date().toISOString(),
    qtdFuncionarios: dados.length,
    totalBruto, totalDescontos: totalDesc, totalLiquido: totalLiq,
    snapshot: dados
  };
  const existing = getCol('historicoFolhas').getAll().find(h => h.mesRef === mesRef);
  if (existing) {
    await fsUpdate('historicoFolhas', existing.id, payload);
  } else {
    await fsAdd('historicoFolhas', payload);
  }
  renderHistoricoFolhas();
}

async function renderHistoricoFolhas() {
  const lista = getCol('historicoFolhas').getAll().sort((a,b) => b.mesRef?.localeCompare(a.mesRef));
  const tbody = document.getElementById('tabelaHistoricoFolhas');
  if (!tbody) return;
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">📁</div><h3>Nenhuma folha salva</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(h => `<tr>
    <td><strong>${h.mesRef || ''}</strong></td>
    <td>${h.qtdFuncionarios || 0}</td>
    <td class="mono" style="color:var(--green)">R$ ${fmtMoney(h.totalBruto)}</td>
    <td class="mono" style="color:var(--red)">R$ ${fmtMoney(h.totalDescontos)}</td>
    <td class="mono" style="color:var(--accent2)">R$ ${fmtMoney(h.totalLiquido)}</td>
    <td style="font-size:0.78rem;color:var(--text3)">${h.geradoEm ? new Date(h.geradoEm).toLocaleDateString('pt-BR') : ''}</td>
    <td><button class="btn btn-outline btn-sm" onclick="verDetalhesHistorico('${h.id}')">👁️ Ver</button></td>
  </tr>`).join('');
}

function verDetalhesHistorico(id) {
  const h = getCol('historicoFolhas').getAll().find(x => x.id === id);
  if (!h || !h.snapshot) { toast('Sem detalhes salvos', 'info'); return; }
  const rows = h.snapshot.map(d => `<tr>
    <td>${d.nome}</td>
    <td class="mono">R$ ${fmtMoney(d.totalProventos)}</td>
    <td class="mono" style="color:var(--red)">R$ ${fmtMoney(d.totalDescontos)}</td>
    <td class="mono" style="color:var(--accent2)"><strong>R$ ${fmtMoney(d.liquido)}</strong></td>
  </tr>`).join('');
  document.getElementById('folhaDetalheTitulo').textContent = `Histórico  ${h.mesRef}`;
  document.getElementById('folhaDetalheBody').innerHTML = `
    <table><thead><tr><th>Funcionário</th><th>Bruto</th><th>Descontos</th><th>Líquido</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  document.querySelector('#modal-folha-detalhe .modal-footer').innerHTML =
    `<button class="btn btn-outline btn-sm" onclick="closeModal('modal-folha-detalhe')">Fechar</button>`;
  openModal('modal-folha-detalhe');
}

// =====================================================
// RELATÓRIO CONSOLIDADO
// =====================================================
function populateRelatorioGrupos() {
  const relGrupoSel = document.getElementById('relGrupo');
  if (!relGrupoSel) return;
  const current = relGrupoSel.value;
  relGrupoSel.innerHTML = '<option value="">Todos</option>' +
    grupos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
  if (current) relGrupoSel.value = current;
}

function gerarRelatorio() {
  const mes = parseInt(document.getElementById('relMes').value);
  const ano = parseInt(document.getElementById('relAno').value);
  const grupoFiltro = document.getElementById('relGrupo').value;
  const mesRef = `${String(mes).padStart(2,'0')}/${ano}`;
  const mesRefHist = `${String(mes).padStart(2,'0')}/${ano}`;
  populateRelatorioGrupos();

  const ativos = funcionarios.filter(f => {
    if (f.ativo === false) return false;
    if (grupoFiltro && f.grupoId !== grupoFiltro) return false;
    return true;
  });

  if (ativos.length === 0) {
    document.getElementById('relatorioContent').innerHTML = `<div class="empty-state"><div class="icon">👥</div><h3>Nenhum funcionário encontrado</h3><p>Verifique os filtros selecionados</p></div>`;
    return;
  }

  // Verificar se existe histórico de folha para este mês
  const historicoFolhas = getCol('historicoFolhas').getAll();
  const folhaDoMes = historicoFolhas.find(h => h.mesRef === mesRefHist);

  // Se não há folha consolidada para este mês, usar snapshot se existir
  // Caso contrário mostrar aviso
  if (!folhaDoMes && !folhaDetalhe[ativos[0]?.id]) {
    // Verificar se folhaDetalhe tem dados para este mês
    const mesAtual = new Date();
    const mesAtualRef = `${String(mesAtual.getMonth()+1).padStart(2,'0')}/${mesAtual.getFullYear()}`;
    const temFolhaCarregada = Object.keys(folhaDetalhe).length > 0;

    if (!temFolhaCarregada) {
      document.getElementById('relatorioContent').innerHTML = `
        <div class="section-card" style="text-align:center;padding:32px">
          <div style="font-size:3rem;margin-bottom:12px">📋</div>
          <h3 style="margin-bottom:8px">Nenhuma folha gerada para ${mesRef}</h3>
          <p style="color:var(--text3);margin-bottom:16px">Para gerar o relatório de um mês, você precisa primeiro gerar a Folha de Pagamento daquele período.</p>
          <button class="btn btn-primary btn-sm" onclick="navigate('folha')">📋 Ir para Folha de Pagamento</button>
        </div>`;
      return;
    }
  }

  // Se há folha carregada na memória (folhaDetalhe), usar esses dados
  // Se há snapshot histórico, usar o snapshot
  let totalBruto = 0, totalDesc = 0, totalLiq = 0;
  const rows = [];

  const ativosOrd = [...ativos].sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));
  for (const f of ativosOrd) {
    let bruto = 0, descontos = 0, liq = 0;
    let fonte = 'sem dados';

    // Prioridade 1: snapshot histórico
    if (folhaDoMes?.snapshot) {
      const snap = folhaDoMes.snapshot.find(s => s.funcionarioId === f.id || s.nome === f.nome);
      if (snap) {
        bruto = snap.totalProventos || 0;
        descontos = snap.totalDescontos || 0;
        liq = snap.liquido || 0;
        fonte = 'consolidado';
      }
    }

    // Prioridade 2: folhaDetalhe carregado na memória
    if (bruto === 0 && folhaDetalhe[f.id]) {
      const d = folhaDetalhe[f.id];
      const calc = calcFolhaTotais(d);
      bruto = calc.totalProventos;
      descontos = calc.totalDescontos;
      liq = calc.liquido;
      fonte = 'em aberto';
    }

    // Não mostrar funcionários sem dados reais para o período
    if (bruto === 0 && descontos === 0) continue;

    totalBruto += bruto;
    totalDesc += descontos;
    totalLiq += liq;

    const alerta = liq < 0 ? '⚠️' : '';
    const badgeFonte = fonte === 'consolidado'
      ? '<span class="badge badge-green" style="font-size:0.65rem">consolidado</span>'
      : '<span class="badge badge-yellow" style="font-size:0.65rem">em aberto</span>';

    rows.push(`<tr ${liq < 0 ? 'style="background:rgba(239,68,68,0.07)"' : ''}>
      <td><span style="cursor:pointer;color:var(--accent2);text-decoration:underline" onclick="abrirFichaFuncionario('${f.id}')"><strong>${f.nome}</strong></span> ${badgeFonte}</td>
      <td>${f.cargo || ''}</td>
      <td class="mono">R$ ${fmtMoney(bruto)}</td>
      <td class="mono" style="color:var(--red)">R$ ${fmtMoney(descontos)}</td>
      <td class="mono" style="color:${liq < 0 ? 'var(--red)' : 'var(--accent2)'}"><strong>${alerta} R$ ${fmtMoney(liq)}</strong></td>
    </tr>`);
  }

  if (rows.length === 0) {
    document.getElementById('relatorioContent').innerHTML = `
      <div class="section-card" style="text-align:center;padding:32px">
        <div style="font-size:3rem;margin-bottom:12px">📋</div>
        <h3 style="margin-bottom:8px">Sem dados para ${mesRef}</h3>
        <p style="color:var(--text3);margin-bottom:16px">Não há folha de pagamento gerada ou consolidada para este período.</p>
        <button class="btn btn-primary btn-sm" onclick="navigate('folha')">📋 Gerar Folha de Pagamento</button>
      </div>`;
    return;
  }

  document.getElementById('relatorioContent').innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <div class="stat-card" style="flex:1"><div class="stat-label">Total Bruto</div><div class="stat-value green">R$ ${fmtMoney(totalBruto)}</div></div>
      <div class="stat-card" style="flex:1"><div class="stat-label">Total Descontos</div><div class="stat-value red">R$ ${fmtMoney(totalDesc)}</div></div>
      <div class="stat-card" style="flex:1"><div class="stat-label">Total Líquido</div><div class="stat-value accent">R$ ${fmtMoney(totalLiq)}</div></div>
      <div class="stat-card" style="flex:1"><div class="stat-label">Funcionários</div><div class="stat-value">${rows.length}</div></div>
    </div>
    <div class="table-wrap">
      <div class="table-header">
        <div class="table-title">Relatório ${mesRef}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="exportRelatorioExcel()">📊 Excel</button>
          <button class="btn btn-outline btn-sm" onclick="exportRelatorioPDF()">📄 PDF</button>
        </div>
      </div>
      <table><thead><tr><th>Funcionário</th><th>Cargo</th><th>Bruto</th><th>Descontos</th><th>Líquido</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot><tr style="background:var(--bg2)">
        <td colspan="2"><strong>TOTAL (${rows.length} func.)</strong></td>
        <td class="mono"><strong>R$ ${fmtMoney(totalBruto)}</strong></td>
        <td class="mono" style="color:var(--red)"><strong>R$ ${fmtMoney(totalDesc)}</strong></td>
        <td class="mono" style="color:var(--accent2)"><strong>R$ ${fmtMoney(totalLiq)}</strong></td>
      </tr></tfoot></table>
    </div>`;
}

function exportRelatorioPDF() {
  const mes = parseInt(document.getElementById('relMes')?.value);
  const ano = parseInt(document.getElementById('relAno')?.value);
  const mesRef = `${String(mes).padStart(2,'0')}/${ano}`;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const lm = 14, pw = 269, rm = lm + pw;
  let y = 14;

  const COR = [27,45,107];
  doc.setFillColor(...COR);
  doc.rect(lm, y, pw, 18, 'FD');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('RELATÓRIO CONSOLIDADO DE FUNCIONÁRIOS', lm+6, y+8);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(`Competncia: ${mesRef}  ${currentOrg?.nome||''}`, lm+6, y+14);
  doc.setTextColor(30,30,45); y += 24;

  // Header da tabela
  doc.setFillColor(46,158,79);
  doc.rect(lm, y, pw, 8, 'FD');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  doc.text('FUNCIONÁRIO', lm+5, y+5.5);
  doc.text('CARGO', lm+80, y+5.5);
  doc.text('BRUTO', lm+155, y+5.5);
  doc.text('DESCONTOS', lm+190, y+5.5);
  doc.text('LÍQUIDO', rm-5, y+5.5, {align:'right'});
  doc.setTextColor(30,30,45); y += 8;

  // Linhas
  const tbody = document.querySelector('#relatorioContent tbody');
  if (tbody) {
    Array.from(tbody.rows).forEach((row, i) => {
      const cells = Array.from(row.cells).map(td => (td.innerText||'').replace(/\n.*/,'').trim());
      doc.setFillColor(i%2===0?255:248, i%2===0?255:250, i%2===0?255:255);
      doc.rect(lm, y, pw, 7, 'FD');
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      doc.text((cells[0]||'').substring(0,32), lm+5, y+5);
      doc.text((cells[1]||'').substring(0,22), lm+80, y+5);
      doc.setFont('helvetica','bold');
      doc.setTextColor(46,158,79);  doc.text(cells[2]||'', lm+155, y+5);
      doc.setTextColor(200,30,30);  doc.text(cells[3]||'', lm+190, y+5);
      doc.setTextColor(27,45,107);  doc.text(cells[4]||'', rm-5, y+5, {align:'right'});
      doc.setTextColor(30,30,45); y += 7;
      if (y > 195) { doc.addPage(); y = 14; }
    });
  }

  // Rodapé totais
  const tfoot = document.querySelector('#relatorioContent tfoot td');
  if (tfoot) {
    doc.setFillColor(27,45,107); doc.rect(lm, y, pw, 9, 'FD');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
    const totalCells = Array.from(document.querySelectorAll('#relatorioContent tfoot td')).map(td => td.innerText.trim());
    doc.text(totalCells[0]||'TOTAL', lm+5, y+6);
    doc.text(totalCells[2]||'', lm+155, y+6);
    doc.text(totalCells[3]||'', lm+190, y+6);
    doc.text(totalCells[4]||'', rm-5, y+6, {align:'right'});
  }

  doc.save(`Relatorio_${mesRef.replace('/','_')}.pdf`);
  toast('PDF exportado!', 'success');
}

// =====================================================
// EXCEL EXPORTS
// =====================================================
function exportFuncionariosExcel() {
  if (typeof XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'error'); return; }
  const data = funcionarios.map(f => {
    const grupo = grupos.find(g => g.id === f.grupoId);
    return {
      'Nome': f.nome || '',
      'CPF': f.cpf || '',
      'Cargo': getNomeCargo(f),
      'Cargo': grupo?.nome || 'Manual',
      'Salário Base': f.salario || 0,
      'Valor Hora Extra': f.horaExtra || 0,
      'INSS': f.inss || 0,
      'Status': f.ativo !== false ? 'Ativo' : 'Inativo'
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Funcionários');
  XLSX.writeFile(wb, 'Funcionarios_CadernoGestor.xlsx');
  toast('Excel exportado!', 'success');
}

function exportRelatorioExcel() {
  if (typeof XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'error'); return; }
  const mes = parseInt(document.getElementById('relMes')?.value || new Date().getMonth()+1);
  const ano = parseInt(document.getElementById('relAno')?.value || new Date().getFullYear());
  const mesRef = `${String(mes).padStart(2,'0')}/${ano}`;

  const valesMes = vales.filter(v => {
    if (!v.data) return false;
    const d = new Date(v.data + 'T00:00:00');
    return d.getMonth()+1 === mes && d.getFullYear() === ano && v.status !== 'descontado';
  });
  const empAtivos = emprestimos.filter(e => e.status === 'ativo' || !e.status);

  const data = funcionarios.filter(f => f.ativo !== false).map(f => {
    const grupo = f.grupoId ? grupos.find(g => g.id === f.grupoId) : null;
    const salario = grupo ? grupo.salario : (f.salario || 0);
    const inss = grupo ? grupo.inss : (f.inss || 0);
    const empF = empAtivos.filter(e => e.funcionarioId === f.id).reduce((s,e) => s + e.valorParcela, 0);
    const valesF = valesMes.filter(v => v.funcionarioId === f.id).reduce((s,v) => s + v.valor, 0);
    const descontos = inss + empF + valesF;
    return {
      'Funcionário': f.nome,
      'Cargo': getNomeCargo(f),
      'Salário Bruto': salario,
      'INSS': inss,
      'Vale Quinzena': valeQ,
      'Parcelas Emp. Funcionários': empF,
      'Vales do Mês': valesF,
      'Total Descontos': descontos,
      'Líquido': salario - descontos
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Relatorio_${mesRef.replace('/','_')}`);
  XLSX.writeFile(wb, `Relatorio_${mesRef.replace('/','_')}.xlsx`);
  toast('Excel exportado!', 'success');
}

// =====================================================
