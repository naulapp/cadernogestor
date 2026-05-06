
// =====================================================
// HISTÓRICO GLOBAL DE AÇÕES
// =====================================================
async function registrarHistorico(modulo, descricao, refId) {
  if (!db || !currentOrg || !currentUser) return;
  try {
    await db.collection('orgs').doc(currentOrg.id).collection('historicoAcoes').add({
      modulo,
      descricao,
      refId: refId || '',
      usuario: currentUser.displayName || currentUser.email || 'Usuário',
      uid: currentUser.uid,
      data: new Date().toISOString()
    });
  } catch(e) { /* histórico não é crítico */ }
}

async function renderHistoricoAcoes() {
  const el = document.getElementById('historicoAcoesList');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--text3)">Carregando...</p>';
  try {
    const snap = await db.collection('orgs').doc(currentOrg.id)
      .collection('historicoAcoes')
      .orderBy('data', 'desc')
      .limit(100)
      .get();
    const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
    if (!items.length) { el.innerHTML = '<p style="color:var(--text3)">Nenhuma ação registrada ainda.</p>'; return; }
    const modIcons = { acerto:'🤝', funcionario:'👤', folha:'📋', adiantamento:'💵', emprestimo:'💰', cargo:'👔', sistema:'⚙️' };
    el.innerHTML = items.map(a => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:6px">
        <div style="font-size:1.3rem;flex-shrink:0">${modIcons[a.modulo]||'📌'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem">${a.descricao}</div>
          <div style="font-size:0.72rem;color:var(--text3);margin-top:2px">
            ${a.usuario} • ${a.data ? new Date(a.data).toLocaleString('pt-BR') : '—'}
          </div>
        </div>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = '<p style="color:var(--text3)">Erro ao carregar histórico.</p>';
  }
}

// =====================================================
// CATEGORIAS DO ACERTO DE CONTAS
// =====================================================
function getCategoriasPar(parId) {
  const key = 'cgCatAcerto_' + parId;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function salvarCategoriasPar(parId, cats) {
  localStorage.setItem('cgCatAcerto_' + parId, JSON.stringify(cats));
}

function popularSelectCategoria(parId) {
  const sel = document.getElementById('lancCategoria');
  if (!sel || !parId) return;
  const cats = getCategoriasPar(parId);
  sel.innerHTML = '<option value="">Sem categoria</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function adicionarCategoriaAcerto() {
  const parId = document.getElementById('lancPar').value;
  if (!parId) { toast('Selecione um par primeiro', 'error'); return; }
  // Usar modal personalizado em vez de prompt() (não funciona em iOS PWA)
  const nomeInput = document.getElementById('novaCategoriaInput');
  if (nomeInput) nomeInput.value = '';
  document.getElementById('modal-nova-categoria')?.style &&
    (document.getElementById('modal-nova-categoria').style.display = 'flex');
}

function confirmarNovaCategoria() {
  const parId = document.getElementById('lancPar').value;
  const nome = document.getElementById('novaCategoriaInput')?.value?.trim();
  fecharModalCategoria();
  if (!nome) return;
  const cats = getCategoriasPar(parId);
  if (!cats.includes(nome)) {
    cats.push(nome);
    salvarCategoriasPar(parId, cats);
  }
  popularSelectCategoria(parId);
  document.getElementById('lancCategoria').value = nome;
  toast('Categoria adicionada!', 'success');
}

function fecharModalCategoria() {
  const m = document.getElementById('modal-nova-categoria');
  if (m) m.style.display = 'none';
}

function renderFuncionarios(filter='', cargoFiltro='') {
  const tbody = document.getElementById('tabelaFuncionarios');
  // Popular filtro de cargos
  const cargoSel = document.getElementById('funcCargoFiltro');
  if (cargoSel && cargoSel.options.length <= 1) {
    grupos.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id; opt.textContent = g.nome;
      cargoSel.appendChild(opt);
    });
  }
  const list = getFuncionariosOrdenados(filter, cargoFiltro, funcOrdemAZ);
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">👥</div><h3>Nenhum funcionário encontrado</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(f => {
    const nomeCargo = getNomeCargo(f);
    const fid = escapeAttr(f.id);
    const nome = escapeHtml(f.nome);
    const observacoes = escapeAttr(f.observacoes || '');
    const cpf = escapeHtml(f.cpf || '-')
    const cargo = escapeHtml(nomeCargo);
    return `<tr>
      <td><span style="cursor:pointer;color:var(--accent2);text-decoration:underline" onclick="abrirFichaFuncionario('${fid}')" title="Ver ficha completa"><strong>${nome}</strong></span>${f.observacoes ? ` <span title="${observacoes}" style="cursor:help;color:var(--text3);font-size:0.8rem">obs</span>` : ''}</td>
      <td style="font-family:var(--mono);font-size:0.78rem">${cpf}</td>
      <td><span class="badge badge-accent">${cargo}</span></td>
      <td><span class="badge ${f.ativo!==false ? 'badge-green' : 'badge-gray'}">${f.ativo!==false ? 'Ativo' : 'Inativo'}</span></td>
      <td style="text-align:right;white-space:nowrap;display:flex;gap:4px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="abrirFichaFuncionario('${fid}')" title="Ficha">📋 Ficha</button>
        <button class="btn-icon" onclick="editarFuncionario('${fid}')" title="Editar">✏️</button>
        <button class="btn-icon" onclick="excluirFuncionario('${fid}')" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function populateGrupoSelect() {
  const sel = document.getElementById('funcGrupo');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Sem cargo definido</option>' +
    grupos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('') +
    '<option value="__novo__">➕ Criar novo cargo...</option>';
  if (current) sel.value = current;
}

function editarCargoDoFunc() {
  const grupoId = document.getElementById('funcGrupo').value;
  if (!grupoId || grupoId === '__novo__') {
    openModal('modal-grupo');
    return;
  }
  editarGrupo(grupoId);
}

async function salvarFuncionario() {
  const id = document.getElementById('funcId').value;
  const nome = document.getElementById('funcNome').value.trim();
  if (!nome) { toast('Nome obrigatório', 'error'); return; }
  const cpfVal = document.getElementById('funcCpf').value;
  if (cpfVal && !validarCpf(cpfVal)) { toast('CPF inválido', 'error'); return; }
  if (cpfVal && verificarCpfDuplicado(cpfVal, document.getElementById('funcId').value)) {
    toast('CPF já cadastrado em outro funcionário', 'error'); return;
  }

  const data = {
    nome, cpf: document.getElementById('funcCpf').value,
    cargo: document.getElementById('funcCargo').value,
    grupoId: document.getElementById('funcGrupo').value || null,
    salario: parseFloat(document.getElementById('funcSalario').value) || 0,
    cargaSemanal: parseFloat(document.getElementById('funcCargaSemanal').value) || 44,
    cargaMensal: parseFloat(document.getElementById('funcCargaMensal').value) || 220,
    horaExtraPct: parseFloat(document.getElementById('funcHoraExtraPct').value) || 50,
    horaExtra: parseFloat(document.getElementById('funcHoraExtra').value) || 0,
    adicionais: JSON.parse(JSON.stringify(adicionaisFunc || [])),
    inssType: document.getElementById('funcInssType').value || 'valor',
    inss: parseFloat(document.getElementById('funcInss').value) || 0,
    inssPct: parseFloat(((document.getElementById('funcInssPct')?.value||'').replace(',','.')) || '0') || 0,
    observacoes: document.getElementById('funcObservacoes')?.value || '',
    ativo: true
  };

  // Se tem grupo, herdar TODOS os valores do grupo
  if (data.grupoId) {
    const grupo = grupos.find(g => g.id === data.grupoId);
    if (grupo) {
      data.salario = grupo.salario || data.salario;
      data.horaExtra = grupo.horaExtra || data.horaExtra;
      data.horaExtraPct = grupo.horaExtraPct || data.horaExtraPct;
      data.inss = grupo.inss || data.inss;
      data.inssPct = grupo.inssPct || data.inssPct;
      data.inssType = grupo.inssType || data.inssType;
      data.cargaSemanal = grupo.cargaSemanal || 44;
      data.cargaMensal = grupo.cargaMensal || 220;
      data.adicionais = grupo.adicionais || [];
      data.valeQuinzena = grupo.valeQuinzena || data.valeQuinzena;
    }
  }

  if (id) {
    await fsUpdate('funcionarios', id, data);
    const idx = funcionarios.findIndex(f => f.id === id);
    if (idx >= 0) funcionarios[idx] = { ...funcionarios[idx], ...data };
    registrarHistorico('funcionario', `Atualizou funcionário: ${nome}`, id);
  } else {
    const novo = await fsAdd('funcionarios', data);
    funcionarios.push(novo);
    registrarHistorico('funcionario', `Cadastrou funcionário: ${nome}`, novo?.id || '');
  }

  closeModal('modal-funcionario');
  renderFuncionarios();
  populateSelects();
  toast(id ? 'Funcionário atualizado' : 'Funcionário cadastrado!', 'success');
  limparFormFuncionario();
}

function editarFuncionario(id) {
  const f = funcionarios.find(f => f.id === id);
  if (!f) return;
  populateGrupoSelect();
  loadCargos(); // garante que o select de cargo está populado
  setTimeout(() => {
    document.getElementById('funcCargo').value = f.cargo || '';
  }, 50); // aguarda populate
  document.getElementById('funcId').value = f.id;
  document.getElementById('funcNome').value = f.nome;
  document.getElementById('funcCpf').value = f.cpf || '';
  document.getElementById('funcGrupo').value = f.grupoId || '';
  document.getElementById('funcSalario').value = f.salario || '';
  document.getElementById('funcCargaSemanal').value = f.cargaSemanal || 44;
  document.getElementById('funcCargaMensal').value = f.cargaMensal || 220;
  document.getElementById('funcHoraExtraPct').value = f.horaExtraPct || 50;
  document.getElementById('funcHoraExtra').value = f.horaExtra || '';
  document.getElementById('funcInssType').value = f.inssType || 'valor';
  document.getElementById('funcInss').value = f.inss || '';
  document.getElementById('funcInssPct').value = f.inssPct || '';
  const obsEl = document.getElementById('funcObservacoes');
  if (obsEl) obsEl.value = f.observacoes || '';
  adicionaisFunc = f.adicionais ? JSON.parse(JSON.stringify(f.adicionais)) : [];
  toggleFuncInssType();
  renderAdicionaisFunc();
  openModal('modal-funcionario');
}

async function excluirFuncionario(id) {
  if (!await confirmar('Excluir funcionrio?', 'Esta ao pode ser desfeita em seguida.')) return;
  const backup = {...funcionarios.find(f=>f.id===id)};
  await fsDelete('funcionarios', id);
  funcionarios = funcionarios.filter(f => f.id !== id);
  pushUndo({ descricao: `Excluir funcionrio ${backup?.nome||''}`, reverter: async () => {
    const novo = await fsAdd('funcionarios', backup);
    funcionarios.push(novo); renderFuncionarios(); renderDashboard();
  }});
  renderFuncionarios(); renderDashboard();
  toast('Excluído (desfazer disponível)', 'success');
}

function limparFormFuncionario() {
  // Limpar TODOS os campos do modal de funcionário
  const campos = ['funcId','funcNome','funcCpf','funcSalario','funcHoraExtra',
    'funcInss','funcInssPct','funcObservacoes'];
  campos.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Selects  resetar para valor padro
  const selects = {
    funcCargo: '',
    funcGrupo: '',
    funcInssType: 'valor'
  };
  Object.entries(selects).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  // Numéricos com padrão
  document.getElementById('funcCargaSemanal').value = '44';
  document.getElementById('funcCargaMensal').value = '220';
  document.getElementById('funcHoraExtraPct').value = '50';
  // Ocultar herança
  const heranca = document.getElementById('grupoHerancaInfo');
  if (heranca) heranca.style.display = 'none';
  // Resetar adicionais
  adicionaisFunc = [];
  renderAdicionaisFunc();
  toggleFuncInssType();
  // Forçar atualizar resumo limpo
  atualizarResumoFunc();
}

// =====================================================
// GRUPOS SALARIAIS
// =====================================================
function renderGrupos() {
  const container = document.getElementById('listaGrupos');
  if (grupos.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🏷️</div><h3>Nenhum grupo criado</h3><p>Crie grupos para padronizar salários por cargo</p></div>`;
    return;
  }
  container.innerHTML = grupos.map(g => {
    const count = funcionarios.filter(f => f.grupoId === g.id).length;
    const adics = (g.adicionais||[]).map(a => a.nome).join(', ') || '';
    const inssLabel = g.inssType === 'pct' ? `${g.inssPct||0}%` : `R$ ${fmtMoney(g.inss)}`;
    return `<div class="section-card" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:160px">
        <div style="font-weight:600;font-size:0.95rem">${g.nome}</div>
        <div style="color:var(--text3);font-size:0.78rem;margin-top:2px">${count} funcionrio(s)  ${g.cargaSemanal||44}h/sem  ${g.cargaMensal||220}h/ms</div>
      </div>
      <div style="display:flex;gap:14px;font-size:0.82rem;flex-wrap:wrap">
        <div><div style="color:var(--text3)">Salário</div><div style="font-family:var(--mono)">R$ ${fmtMoney(g.salario)}</div></div>
        <div><div style="color:var(--text3)">H. Extra</div><div style="font-family:var(--mono)">R$ ${fmtMoney(g.horaExtra)} (+${g.horaExtraPct||50}%)</div></div>
        <div><div style="color:var(--text3)">Adicionais</div><div style="font-size:0.75rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${adics}</div></div>
        <div><div style="color:var(--text3)">INSS</div><div style="font-family:var(--mono)">${inssLabel}</div></div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn-icon" onclick="editarGrupo('${g.id}')">✏️</button>
        <button class="btn-icon" onclick="excluirGrupo('${g.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

async function salvarGrupo() {
  const id = document.getElementById('grupoId').value;
  const nome = document.getElementById('grupoNome').value.trim();
  if (!nome) { toast('Nome obrigatório', 'error'); return; }
  const inssType = document.getElementById('grupoInssType').value;
  const data = {
    nome,
    salario: parseFloat(document.getElementById('grupoSalario').value) || 0,
    cargaSemanal: parseFloat(document.getElementById('grupoCargaSemanal').value) || 44,
    cargaMensal: parseFloat(document.getElementById('grupoCargaMensal').value) || 220,
    horaExtraPct: parseFloat(document.getElementById('grupoHoraExtraPct').value) || 50,
    horaExtra: parseFloat(document.getElementById('grupoHoraExtra').value) || 0,
    adicionais: JSON.parse(JSON.stringify(adicionaisGrupo)),
    inssType,
    inss: inssType === 'valor' ? (parseFloat(document.getElementById('grupoInss').value) || 0) : 0,
    inssPct: inssType === 'pct' ? (parseFloat((document.getElementById('grupoInssPct').value||'').replace(',','.')) || 0) : 0,
  };
  let grupoIdFinal = id;
  if (id) {
    await fsUpdate('grupos', id, data);
    const idx = grupos.findIndex(g => g.id === id);
    if (idx >= 0) grupos[idx] = { ...grupos[idx], ...data };
  } else {
    const novo = await fsAdd('grupos', data);
    grupos.push(novo);
    grupoIdFinal = novo.id; // ID real do novo grupo
  }

  // Usar checkboxes para definir quais funcionários estão no grupo
  if (grupoIdFinal) {
    // Funcionários selecionados via checkbox
    const selecionados = funcionarios.filter(f => {
      const cb = document.getElementById('gfc_' + f.id);
      return cb && cb.checked;
    }).map(f => f.id);
    // Remover grupo de quem foi desmarcado
    const antigos = funcionarios.filter(f => f.grupoId === grupoIdFinal && !selecionados.includes(f.id));
    for (const f of antigos) {
      await fsUpdate('funcionarios', f.id, { grupoId: null });
      const fi = funcionarios.findIndex(fn => fn.id === f.id);
      if (fi >= 0) funcionarios[fi].grupoId = null;
    }
    // Vincular selecionados
    const vinculados = funcionarios.filter(f => selecionados.includes(f.id));
    const atualizacao = {
      salario: data.salario,
      horaExtra: data.horaExtra,
      horaExtraPct: data.horaExtraPct,
      inss: data.inss,
      inssPct: data.inssPct,
      inssType: data.inssType,
      cargaSemanal: data.cargaSemanal,
      cargaMensal: data.cargaMensal,
      adicionais: data.adicionais,
      valeQuinzena: data.valeQuinzena
    };
    for (const f of vinculados) {
      await fsUpdate('funcionarios', f.id, atualizacao);
      const fi = funcionarios.findIndex(fn => fn.id === f.id);
      if (fi >= 0) Object.assign(funcionarios[fi], atualizacao);
    }
    if (vinculados.length > 0) {
      toast(`Grupo salvo e ${vinculados.length} funcionário(s) atualizado(s)!`, 'success');
    } else {
      toast('Grupo salvo!', 'success');
    }
  } else {
    toast('Grupo salvo!', 'success');
  }

  registrarHistorico('cargo', id ? `Atualizou cargo: ${nome}` : `Cadastrou cargo: ${nome}`, grupoIdFinal || '');

  closeModal('modal-grupo');
  renderGrupos();
  renderFuncionarios();
  populateGrupoSelect();
  adicionaisGrupo = [];
  document.getElementById('grupoId').value = '';
}

function editarGrupo(id) {
  const g = grupos.find(g => g.id === id);
  if (!g) return;
  adicionaisGrupo = g.adicionais ? JSON.parse(JSON.stringify(g.adicionais)) : [];
  document.getElementById('grupoId').value = g.id;
  document.getElementById('grupoNome').value = g.nome;
  document.getElementById('grupoSalario').value = g.salario || '';
  document.getElementById('grupoCargaSemanal').value = g.cargaSemanal || 44;
  document.getElementById('grupoCargaMensal').value = g.cargaMensal || 220;
  document.getElementById('grupoHoraExtraPct').value = g.horaExtraPct || 50;
  document.getElementById('grupoHoraExtra').value = g.horaExtra || '';
  document.getElementById('grupoInssType').value = g.inssType || 'valor';
  document.getElementById('grupoInss').value = g.inss || '';
  document.getElementById('grupoInssPct').value = g.inssPct || '';
  toggleInssType();
  renderAdicionaisGrupo();
  openModal('modal-grupo');
}

async function excluirGrupo(id) {
  if (!await confirmar('Excluir cargo?', 'Os funcionrios vinculados ficaro sem grupo.')) return;
  await fsDelete('grupos', id);
  grupos = grupos.filter(g => g.id !== id);
  renderGrupos();
  toast('Grupo removido', 'info');
}

// =====================================================
// EMPRÉSTIMOS A FUNCIONÁRIOS
// =====================================================
function renderEmprestimos(filter='') {
  const tbody = document.getElementById('tabelaEmprestimos');
  const list = filter ? emprestimos.filter(e => {
    const f = funcionarios.find(fn => fn.id === e.funcionarioId);
    return (f?.nome||'').toLowerCase().includes(filter.toLowerCase()) || e.descricao.toLowerCase().includes(filter.toLowerCase());
  }) : emprestimos;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">💰</div><h3>Nenhum empréstimo</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(e => {
    const func = funcionarios.find(f => f.id === e.funcionarioId);
    const restante = (e.total||0) - (e.pago||0);
    const pct = e.total > 0 ? Math.min(100, (e.pago||0)/e.total*100) : 0;
    const parcelasRestantes = e.valorParcela > 0 ? Math.ceil(restante / e.valorParcela) : 0;
    const status = restante <= 0 ? 'quitado' : 'ativo';
    return `<tr>
      <td><strong>${func?.nome || e.funcionarioNome || ''}</strong></td>
      <td>${e.descricao}</td>
      <td class="mono">R$ ${fmtMoney(e.total)}</td>
      <td>${e.parcelas}x</td>
      <td class="mono">${e.tipoParcela === 'ultima_diferente'
        ? `${e.parcelas-1}x R$ ${fmtMoney(e.valorParcela)} + 1x R$ ${fmtMoney(e.ultimaParcela||0)}`
        : `R$ ${fmtMoney(e.valorParcela)}`
      }</td>
      <td>
        <div style="font-family:var(--mono);font-size:0.82rem">R$ ${fmtMoney(e.pago||0)}</div>
        <div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${pct}%"></div></div>
      </td>
      <td><span class="badge ${status==='quitado'?'badge-green':'badge-yellow'}">${status==='quitado'?'Quitado':'Ativo'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn-icon" onclick="openEmprestimoModal('${e.id}')" title="Editar">✏️</button>

        <button class="btn-icon" onclick="excluirEmprestimo('${e.id}')" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function filterEmprestimos(v) { renderEmprestimos(v); }

// calcParcela is defined later with full logic

async function salvarEmprestimo() {
  const id = document.getElementById('empId').value;
  const funcId = document.getElementById('empFuncionario').value;
  const descricao = document.getElementById('empDescricao').value.trim();
  if (!funcId || !descricao) { toast('Funcionário e descrição obrigatórios', 'error'); return; }
  // Validar que parcelas batem com total
  const alertaEl = document.getElementById('empValidacaoAlerta');
  if (alertaEl && alertaEl.style.display !== 'none') {
    toast('Corrija o parcelamento antes de salvar', 'error'); return;
  }
  const func = funcionarios.find(f => f.id === funcId);
  const data = {
    funcionarioId: funcId, funcionarioNome: func?.nome||'', descricao,
    total: parseFloat(document.getElementById('empTotal').value) || 0,
    parcelas: parseInt(document.getElementById('empParcelas').value) || 1,
    tipoParcela: document.getElementById('empTipoParcela')?.value || 'igual',
    valorParcela: parseFloat(document.getElementById('empValorParcela').value) || 0,
    ultimaParcela: parseFloat(document.getElementById('empUltimaParcela')?.value) || 0,
    dataInicio: document.getElementById('empDataInicio').value || new Date().toISOString().slice(0,10),
  };
  if (id) {
    await fsUpdate('emprestimos', id, data);
    const idx = emprestimos.findIndex(e=>e.id===id);
    if (idx>=0) Object.assign(emprestimos[idx], data);
    toast('Empréstimo atualizado!', 'success');
    registrarHistorico('emprestimo', `Atualizou empréstimo: ${descricao} (${func?.nome || ''})`, id);
  } else {
    const novo = await fsAdd('emprestimos', {...data, pago:0, parcelasPagas:0, status:'ativo'});
    emprestimos.push(novo);
    toast('Empréstimo a funcionário registrado!', 'success');
    registrarHistorico('emprestimo', `Novo empréstimo: ${descricao} — ${func?.nome || ''}`, novo?.id || '');
  }
  closeModal('modal-emprestimo');
  renderEmprestimos();
  renderDashboard();
}

async function registrarPagamento(id) {
  const e = emprestimos.find(e => e.id === id);
  if (!e) return;
  const parcelasPagas = e.parcelasPagas || 0;
  const isUltima = e.tipoParcela === 'ultima_diferente' && parcelasPagas === e.parcelas - 1;
  const sugerido = isUltima ? (e.ultimaParcela || e.valorParcela) : e.valorParcela;
  const valor = parseFloat(prompt(`Valor pago (parcela sugerida: R$ ${fmtMoney(sugerido)}):`, sugerido));
  if (!valor || isNaN(valor)) return;
  const novoPago = (e.pago || 0) + valor;
  const novasParcelas = (e.parcelasPagas || 0) + 1;
  const status = novoPago >= e.total ? 'quitado' : 'ativo';
  await fsUpdate('emprestimos', id, { pago: novoPago, parcelasPagas: novasParcelas, status });
  const idx = emprestimos.findIndex(e => e.id === id);
  if (idx >= 0) emprestimos[idx] = { ...emprestimos[idx], pago: novoPago, parcelasPagas: novasParcelas, status };
  renderEmprestimos();
  renderDashboard();
  toast(`Pagamento de R$ ${fmtMoney(valor)} registrado!`, 'success');
}

async function excluirEmprestimo(id) {
  if (!await confirmar('Excluir emprstimo?', 'Esta ao pode ser desfeita em seguida.')) return;
  const backup = {...emprestimos.find(e=>e.id===id)};
  await fsDelete('emprestimos', id);
  emprestimos = emprestimos.filter(e => e.id !== id);
  pushUndo({ descricao: `Excluir emprstimo ${backup?.descricao||''}`, reverter: async () => {
    const novo = await fsAdd('emprestimos', backup);
    emprestimos.push(novo); renderEmprestimos(); renderDashboard();
  }});
  renderEmprestimos(); renderDashboard();
  toast('Excluído (desfazer disponível)', 'success');
}

// =====================================================
// ADIANTAMENTOS SALARIAIS
// =====================================================
function renderVales() {
  const tbody = document.getElementById('tabelaVales');
  const filtroStatus = document.getElementById('valesFiltro')?.value || 'pendente';
  const filtroFunc = document.getElementById('valesFiltroFunc')?.value || '';
  const filtroMes = document.getElementById('valesFiltroMes')?.value || '';

  // Populate func filter
  const funcSel = document.getElementById('valesFiltroFunc');
  if (funcSel && funcSel.options.length <= 1) {
    funcionarios.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id; opt.textContent = f.nome;
      funcSel.appendChild(opt);
    });
  }

  const lista = vales.filter(v => {
    if (filtroStatus === 'pendente' && v.status === 'descontado') return false;
    if (filtroStatus === 'descontado' && v.status !== 'descontado') return false;
    if (filtroFunc && v.funcionarioId !== filtroFunc) return false;
    if (filtroMes && v.data) {
      const [ym] = filtroMes.split('-');
      const [y2,m2] = filtroMes.split('-');
      const d = new Date(v.data+'T00:00:00');
      if (d.getFullYear() !== parseInt(y2) || d.getMonth()+1 !== parseInt(m2)) return false;
    }
    return true;
  }).sort((a,b) => (b.data||'').localeCompare(a.data||''));

  const totalFiltro = lista.reduce((s,v) => s + (v.valor||0), 0);
  const el = document.getElementById('valesTotalFiltro');
  if (el) el.textContent = lista.length > 0 ? `${lista.length} registro(s)  Total: R$ ${fmtMoney(totalFiltro)}` : '';

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🎫</div><h3>Nenhum adiantamento encontrado</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(v => {
    const func = funcionarios.find(f => f.id === v.funcionarioId);
    const isPendente = v.status !== 'descontado';
    const parcelasInfo = v.tipo==='parcelado' && v.nParcelas ? `${v.nParcelas}x R$ ${fmtMoney(v.valorParc||v.valor/v.nParcelas)}` : '';
    return `<tr>
      <td><strong>${func?.nome || v.funcionarioNome || ''}</strong></td>
      <td style="font-family:var(--mono);font-size:0.82rem">${v.data?fmtData(v.data):''}</td>
      <td>${v.descricao||'Adiantamento'}</td>
      <td class="mono" style="color:${isPendente?'var(--red)':'var(--text3)'}">R$ ${fmtMoney(v.valor)}</td>
      <td style="font-size:0.78rem">${parcelasInfo}</td>
      <td><span class="badge ${isPendente?'badge-yellow':'badge-gray'}">${isPendente?'Pendente':'Descontado'}</span></td>
      <td style="white-space:nowrap;display:flex;gap:4px">
        <button class="btn-icon" onclick="editarVale('${v.id}')" title="Editar">✏️</button>

        <button class="btn-icon" onclick="excluirVale('${v.id}')" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

async function salvarVale() {
  const id = document.getElementById('valeId').value;
  const funcId = document.getElementById('valeFuncionario').value;
  if (!funcId) { toast('Selecione o funcionário', 'error'); return; }
  const func = funcionarios.find(f => f.id === funcId);
  const tipo = document.getElementById('valeTipo').value;
  const nParcelas = parseInt(document.getElementById('valeNParcelas')?.value) || 1;
  const valor = parseFloat(document.getElementById('valeValor').value) || 0;
  const data = {
    funcionarioId: funcId, funcionarioNome: func?.nome||'',
    data: document.getElementById('valeData').value,
    valor, descricao: document.getElementById('valeDescricao').value,
    tipo, nParcelas: tipo==='parcelado'?nParcelas:1,
    valorParc: tipo==='parcelado'?valor/nParcelas:valor,
    status: 'pendente'
  };
  if (id) {
    await fsUpdate('vales', id, data);
    const idx = vales.findIndex(v => v.id===id);
    if (idx>=0) vales[idx] = {...vales[idx], ...data};
    toast('Adiantamento atualizado!', 'success');
    registrarHistorico('adiantamento', `Atualizou adiantamento: ${data.descricao || '—'} — ${func?.nome || ''}`, id);
  } else {
    const novo = await fsAdd('vales', data);
    vales.push(novo);
    toast('Adiantamento registrado!', 'success');
    registrarHistorico('adiantamento', `Registrou adiantamento: ${data.descricao || '—'} — ${func?.nome || ''}`, novo?.id || '');
  }
  document.getElementById('valeId').value = '';
  document.getElementById('valeTituloModal').textContent = 'Registrar Adiantamento';
  closeModal('modal-vale');
  renderVales();
}

async function marcarValeDescontado(id) {
  await fsUpdate('vales', id, { status: 'descontado' });
  const idx = vales.findIndex(v => v.id === id);
  if (idx >= 0) vales[idx].status = 'descontado';
  renderVales();
  toast('Vale marcado como descontado', 'success');
}

async function excluirVale(id) {
  if (!await confirmar('Excluir adiantamento?', 'Esta ao pode ser desfeita em seguida.')) return;
  const backup = {...vales.find(v=>v.id===id)};
  await fsDelete('vales', id);
  vales = vales.filter(v => v.id !== id);
  pushUndo({ descricao: `Excluir adiantamento ${backup?.descricao||''}`, reverter: async () => {
    const novo = await fsAdd('vales', backup);
    vales.push(novo); renderVales(); renderDashboard();
  }});
  renderVales();
  toast('Excluído (desfazer disponível)', 'success');
}

// =====================================================
// FOLHA DE PAGAMENTO
// =====================================================
let folhaDetalhe = {}; // funcionario id -> dados folha

async function gerarNovaFolha() {
  navigate('folha');
  // Aguardar DOM atualizar antes de chamar loadFolha
  setTimeout(async () => {
    // Garantir que mês/ano estão preenchidos
    const mesEl = document.getElementById('folhaMes');
    const anoEl = document.getElementById('folhaAno');
    if (mesEl && !mesEl.value) {
      const now = new Date();
      mesEl.value = now.getMonth() + 1;
    }
    if (anoEl && !anoEl.value) {
      anoEl.value = new Date().getFullYear();
    }
    await loadFolha();
  }, 100);
}

async function loadFolha() {
  const mes = parseInt(document.getElementById('folhaMes').value);
  const ano = parseInt(document.getElementById('folhaAno').value);
  const mesRef = `${String(mes).padStart(2,'0')}/${ano}`;
  const ativos = funcionarios.filter(f => f.ativo !== false);

  const infoEl = document.getElementById('folhaInfo');
  if (infoEl) infoEl.style.display = 'block';
  if (ativos.length === 0) {
    document.getElementById('folhaList').innerHTML = `<div class="empty-state"><div class="icon">📋</div><h3>Nenhum funcionário ativo</h3><p>Cadastre funcionários primeiro</p></div>`;
    return;
  }

  // Buscar adiantamentos pendentes (todos, no s do ms  gestor decide quais descontar)
  const valesMes = vales.filter(v => v.status !== 'descontado');
  const empAtivos = emprestimos.filter(e => e.status === 'ativo' || !e.status);

  folhaDetalhe = {};
  // Ordenar funcionários A-Z
  const ativosOrdenados = [...ativos].sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));

  const cards = ativosOrdenados.map(f => {
    const grupo = f.grupoId ? grupos.find(g => g.id === f.grupoId) : null;
    const salario = grupo ? (grupo.salario||0) : (f.salario || 0);
    const horaExtraVal = grupo ? (grupo.horaExtra||0) : (f.horaExtra || 0);
    const horaExtraPct = grupo ? (grupo.horaExtraPct||50) : (f.horaExtraPct || 50);
    const cargaMensal = grupo ? (grupo.cargaMensal||220) : (f.cargaMensal || 220);

    // INSS  preferncia: tipo e valor do funcionrio, fallback do grupo
    const inssType = f.inssType || grupo?.inssType || 'valor';
    const inssPct = f.inssPct || grupo?.inssPct || 0;
    const inssValor = inssType === 'pct'
      ? Math.round(salario * (inssPct / 100) * 100) / 100
      : (f.inss || grupo?.inss || 0);

    // Adicionais  do funcionrio primeiro, fallback do grupo
    const adicionais = (f.adicionais?.length ? f.adicionais : grupo?.adicionais) || [];

    // Calcular valor de cada adicional
    const adicionaisComValor = adicionais.map(a => ({
      ...a,
      valorCalculado: a.isValorFixo ? (a.valor||0) : Math.round(salario*(a.pct||0)/100*100)/100
    }));

    const empFuncionario = empAtivos.filter(e => e.funcionarioId === f.id);
    const valesFuncionario = valesMes.filter(v => v.funcionarioId === f.id);

    const descontoEmprestimos = empFuncionario.map(e => ({
      label: e.descricao, valor: e.valorParcela,
      numero: (e.parcelasPagas||0) + 1, total: e.parcelas, id: e.id
    }));

    const descontoVales = valesFuncionario.map(v => ({
      label: v.descricao || 'Adiantamento', data: v.data, valor: v.valor, id: v.id
    }));

    folhaDetalhe[f.id] = {
      funcionario: f,
      salario, horaExtraVal, horaExtraPct, cargaMensal,
      inssType, inssPct, inssValor,
      adicionaisBase: adicionaisComValor, // adicionais do cargo/func (editáveis)
      diasTrabalhados: 0,
      horasExtras: 0,
      reflexoDsr: 0,
      descontoEmprestimos,
      descontoVales,
      outrosProventos: [],
      outrosDescontos: [],
      faltas: 0
    };
    return buildFolhaCard(f, folhaDetalhe[f.id]);
  }).join('');

  document.getElementById('folhaList').innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer">
        <input type="checkbox" id="selecionarTodosFolha" checked
          onchange="toggleTodosFolha(this.checked)">
        Selecionar todos
      </label>
      <button class="btn btn-primary btn-sm" onclick="gerarTodosPDFs()">📄 PDF selecionados</button>
      <button class="btn btn-success btn-sm" onclick="consolidarPeriodoTodos()">✅ Consolidar todos</button>
      <button class="btn btn-outline btn-sm" onclick="expandirTodosCards()">▼ Expandir todos</button>
      <button class="btn btn-outline btn-sm" onclick="recolherTodosCards()">▲ Recolher todos</button>
    </div>
    ${cards}`;
}

function calcFolhaTotais(d) {
  const horasExtrasValor = (d.horasExtras||0) * (d.horaExtraVal||0);
  const insalubridade = (d.salario||0) * ((d.insalPct||0) / 100);
  const reflexoDsr = d.horasExtras > 0 ? (d.reflexoDsr || calcReflexoDsr(d.salario, d.horasExtras, d.horaExtraVal)) : 0;
  let salarioBase = d.salario||0;
  if (d.diasTrabalhados > 0 && d.diasTrabalhados < 30) salarioBase = (d.salario/30)*d.diasTrabalhados;
  // Adicionais: usar adicionaisBase (já calculados no loadFolha) ou direto do funcionário
  const adics = d.adicionaisBase || (d.funcionario?.adicionais || []);
  const totalAdics = adics.reduce((s,a) => {
    const val = a.valorEditado !== undefined ? a.valorEditado :
                (a.valorCalculado !== undefined ? a.valorCalculado :
                (a.isValorFixo ? (a.valor||0) : (salarioBase*(a.pct||0)/100)));
    return s + val;
  }, 0);
  const totalProventos = salarioBase + horasExtrasValor + totalAdics + reflexoDsr + (d.premioDesempenho||0) +
    (d.outrosProventos||[]).reduce((s,o) => s+(o.valor||0), 0);
  // Só descontos MARCADOS
  const empSel = (d.descontoEmprestimos||[]).filter(e=>e.selecionado!==false);
  const valSel = (d.descontoVales||[]).filter(v=>v.selecionado!==false);
  let totalDescontos = (d.inssValor||0) +
    empSel.reduce((s,e)=>s+(e.valorPagar||e.valor||0),0) +
    valSel.reduce((s,v)=>s+(v.valorPagar||v.valor||0),0) +
    (d.outrosDescontos||[]).reduce((s,o)=>s+(o.valor||0),0);
  if (d.faltas>0) totalDescontos += calcFaltas(d.salario,d.faltas,reflexoDsr);
  return { salarioBase, horasExtrasValor, insalubridade, reflexoDsr, totalAdics, totalProventos, totalDescontos, liquido: totalProventos-totalDescontos };
}

function buildFolhaCard(f, d) {
  const calc = calcFolhaTotais(d);
  const alertaDesc = calc.liquido < 0 ? 'style="border-color:var(--red)"' : '';

  // Resumo proventos
  const provList = [];
  if (calc.salarioBase > 0) provList.push(`Salário: R$ ${fmtMoney(calc.salarioBase)}`);
  if (calc.horasExtrasValor > 0) provList.push(`H.Extra (${d.horasExtras||0}h): R$ ${fmtMoney(calc.horasExtrasValor)}`);
  // Listar adicionais individualmente
  const adicsFunc = d.funcionario?.adicionais || [];
  if (adicsFunc.length > 0) {
    adicsFunc.forEach(a => {
      const val = a.isValorFixo ? (a.valor||0) : ((d.salario||0)*(a.pct||0)/100);
      if (val > 0) provList.push(`${a.nome}: R$ ${fmtMoney(val)}`);
    });
  } // No mostrar total genrico de adicionais  já listados individualmente acima
  if (calc.reflexoDsr > 0) provList.push(`DSR: R$ ${fmtMoney(calc.reflexoDsr)}`);
  (d.outrosProventos||[]).filter(o=>o.valor>0).forEach(o => provList.push(`${o.descricao}: R$ ${fmtMoney(o.valor)}`));

  // Resumo descontos
  const descList = [];
  if (d.inssValor > 0) descList.push(`INSS: R$ ${fmtMoney(d.inssValor)}`);
  (d.descontoEmprestimos||[]).filter(e=>e.selecionado!==false).forEach(e => descList.push(`${e.label} (p.${e.numero}): R$ ${fmtMoney(e.valorPagar||e.valor)}`));
  (d.descontoVales||[]).filter(v=>v.selecionado!==false).forEach(v => descList.push(`${v.label}: R$ ${fmtMoney(v.valorPagar||v.valor)}`));
  (d.outrosDescontos||[]).filter(o=>o.valor>0).forEach(o => descList.push(`${o.descricao}: R$ ${fmtMoney(o.valor)}`));
  if (d.faltas > 0) descList.push(`Faltas (${d.faltas}): R$ ${fmtMoney(calcFaltas(d.salario,d.faltas,calc.reflexoDsr))}`);

  return `<div class="folha-card" id="fc-${f.id}" ${alertaDesc}>
    <!-- CABEÇALHO -->
    <div class="folha-card-header">
      <div style="display:flex;align-items:center;gap:10px">
        <input type="checkbox" class="folha-func-cb" data-id="${f.id}" checked style="width:16px;height:16px;flex-shrink:0">
        <div>
          <div class="folha-employee-name">${f.nome}</div>
          <div class="folha-employee-role">${getNomeCargo(f)}  CPF: ${f.cpf||''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="confirmarGerarPdf('${f.id}')">📄 PDF</button>
      </div>
    </div>

    <!-- RESUMO PROVENTOS / DESCONTOS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
      <div style="background:rgba(46,158,79,0.08);border-radius:8px;padding:10px">
        <div style="font-size:0.7rem;font-weight:700;color:var(--green);margin-bottom:6px">▲ PROVENTOS</div>
        ${provList.length ? provList.map(p=>`<div style="font-size:0.78rem;display:flex;justify-content:space-between"><span>${p.split(':')[0]}</span><span style="font-family:var(--mono)">${p.split(':').slice(1).join(':')}</span></div>`).join('') : '<div style="font-size:0.78rem;color:var(--text3)">Nenhum</div>'}
        <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;font-size:0.82rem;font-weight:700;color:var(--green);display:flex;justify-content:space-between">
          <span>TOTAL</span><span style="font-family:var(--mono)">R$ ${fmtMoney(calc.totalProventos)}</span>
        </div>
      </div>
      <div style="background:rgba(239,68,68,0.08);border-radius:8px;padding:10px">
        <div style="font-size:0.7rem;font-weight:700;color:var(--red);margin-bottom:6px">▼ DESCONTOS</div>
        ${descList.length ? descList.map(p=>`<div style="font-size:0.78rem;display:flex;justify-content:space-between"><span>${p.split(':')[0]}</span><span style="font-family:var(--mono)">${p.split(':').slice(1).join(':')}</span></div>`).join('') : '<div style="font-size:0.78rem;color:var(--text3)">Nenhum selecionado</div>'}
        <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;font-size:0.82rem;font-weight:700;color:var(--red);display:flex;justify-content:space-between">
          <span>TOTAL</span><span style="font-family:var(--mono)">R$ ${fmtMoney(calc.totalDescontos)}</span>
        </div>
      </div>
    </div>

    <!-- LÍQUIDO -->
    <div style="margin-top:10px;padding:10px;background:var(--bg2);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:700">LÍQUIDO A RECEBER</span>
      <span style="font-family:var(--mono);font-size:1.1rem;font-weight:700;color:${calc.liquido<0?'var(--red)':'var(--accent2)'}">R$ ${fmtMoney(calc.liquido)}</span>
    </div>
    ${calc.liquido<0?'<div style="color:var(--red);font-size:0.78rem;padding:4px 0">⚠️ Descontos maiores que o salário — revise os itens</div>':''}

    <!-- BOTO EXPANDIR/RECOLHER -->
    <div style="text-align:center;margin-top:8px">
      <button class="btn btn-outline btn-sm" onclick="toggleFolhaInline('${f.id}')" id="btn-toggle-${f.id}"
        style="width:100%;font-size:0.8rem;color:var(--text3)">
        ▼ Editar proventos e descontos
      </button>
    </div>

    <!-- REA INLINE DE EDIO (oculta por padro) -->
    <div id="folha-inline-${f.id}" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:10px">
        <div class="form-group" style="margin:0">
          <label class="form-label">DIAS TRAB. (0=mês)</label>
          <input type="number" class="form-input" value="${d.diasTrabalhados||0}" min="0" max="31"
            onchange="folhaDetalhe['${f.id}'].diasTrabalhados=parseInt(this.value)||0;rebuildCard('${f.id}')">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">HORAS EXTRAS</label>
          <input type="number" class="form-input" value="${d.horasExtras||0}" step="0.01"
            onchange="folhaDetalhe['${f.id}'].horasExtras=parseFloat(this.value)||0;rebuildCard('${f.id}')">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">VLR HORA EXTRA</label>
          <input type="number" class="form-input" value="${d.horaExtraVal||0}" step="0.01"
            onchange="folhaDetalhe['${f.id}'].horaExtraVal=parseFloat(this.value)||0;rebuildCard('${f.id}')">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">INSS</label>
          <div style="display:flex;gap:4px">
            <select class="form-input" style="width:70px" onchange="calcInssInline('${f.id}',this.value)">
              <option value="valor" ${(!d.inssType||d.inssType==='valor')?'selected':''}>R$</option>
              <option value="pct" ${d.inssType==='pct'?'selected':''}>%</option>
            </select>
            <input type="number" class="form-input" id="inss-inline-${f.id}"
              value="${d.inssType==='pct'?(d.inssPct||0):(d.inssValor||0)}" step="0.01"
              oninput="calcInssInline('${f.id}',document.querySelector('#inss-inline-${f.id}').previousElementSibling.value,this.value)">
          </div>
          <div style="font-size:0.7rem;color:var(--text3);margin-top:2px">
            ${d.inssType==='pct'?'Valor: R$ '+fmtMoney((d.salario||0)*(d.inssPct||0)/100):''}
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">FALTAS</label>
          <input type="number" class="form-input" value="${d.faltas||0}" min="0"
            onchange="folhaDetalhe['${f.id}'].faltas=parseInt(this.value)||0;rebuildCard('${f.id}')">
          <div style="font-size:0.7rem;color:var(--text3);margin-top:2px">
            Desconto: R$ ${fmtMoney(calcFaltas(d.salario||0,d.faltas||0,calc.reflexoDsr||0))}
            <span style="color:var(--text3)"> (Salário/30 × faltas)</span>
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">DSR (R$)</label>
          <input type="number" class="form-input" value="${d.reflexoDsr||0}" step="0.01"
            oninput="folhaDetalhe['${f.id}'].reflexoDsr=parseFloat(this.value)||0;rebuildCard('${f.id}')"
            placeholder="Auto">
          <div style="font-size:0.7rem;color:var(--text3)">Auto: R$ ${fmtMoney(d.horasExtras>0 ? calcReflexoDsr(d.salario,d.horasExtras,d.horaExtraVal) : 0)}</div>
        </div>
      </div>

      <!-- ADICIONAIS DO CARGO (editáveis) -->
      ${(d.adicionaisBase||[]).length > 0 ? `
      <div style="font-size:0.78rem;font-weight:700;color:var(--green);margin:10px 0 6px">▲ ADICIONAIS DO CARGO</div>
      ${(d.adicionaisBase||[]).map((a,i) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="flex:2;font-size:0.82rem">${a.nome}${!a.isValorFixo && a.pct ? ` (${a.pct}%)` : ''}</span>
          <div style="position:relative;flex:1">
            <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:0.75rem;color:var(--text3)">R$</span>
            <input type="number" class="form-input" value="${a.valorEditado!==undefined?a.valorEditado:a.valorCalculado||0}" step="0.01"
              style="padding-left:26px;font-size:0.82rem"
              oninput="folhaDetalhe['${f.id}'].adicionaisBase[${i}].valorEditado=parseFloat(this.value)||0;rebuildCard('${f.id}')">
          </div>
        </div>`).join('')}` : ''}

      <!-- OUTROS PROVENTOS (extras) -->
      <div style="font-size:0.78rem;font-weight:700;color:var(--green);margin:10px 0 6px">▲ OUTROS PROVENTOS</div>
      <div style="margin-bottom:8px">
        ${(d.outrosProventos||[]).map((o,i)=>`
        <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
          <select class="form-input" style="flex:2" onchange="folhaDetalhe['${f.id}'].outrosProventos[${i}].descricao=this.value;rebuildCard('${f.id}')">
            ${proventosNomes.map(n=>`<option value="${n}" ${o.descricao===n?'selected':''}>${n}</option>`).join('')}
          </select>
          <input type="number" class="form-input" value="${o.valor||0}" step="0.01" style="flex:1"
            onchange="folhaDetalhe['${f.id}'].outrosProventos[${i}].valor=parseFloat(this.value)||0;rebuildCard('${f.id}')">
          <button class="btn-icon" onclick="folhaDetalhe['${f.id}'].outrosProventos.splice(${i},1);rebuildCard('${f.id}')">🗑️</button>
        </div>`).join('')}
        <button class="btn btn-outline btn-sm" onclick="addProventoInline('${f.id}')">➕ Provento</button>
      </div>

      <!-- DESCONTOS -->
      <div style="font-size:0.78rem;font-weight:700;color:var(--red);margin:10px 0 6px">▼ DESCONTOS SELECIONÁVEIS</div>
      ${d.descontoEmprestimos.length>0?`
      <div style="font-size:0.78rem;font-weight:600;color:var(--text2);margin-bottom:4px">EMPRÉSTIMOS A FUNCIONÁRIOS:</div>
      ${d.descontoEmprestimos.map((e,i)=>`
      <label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg2);border-radius:6px;margin-bottom:4px;cursor:pointer">
        <input type="checkbox" ${e.selecionado!==false?'checked':''} style="flex-shrink:0"
          onchange="folhaDetalhe['${f.id}'].descontoEmprestimos[${i}].selecionado=this.checked;rebuildCard('${f.id}')">
        <span style="flex:1;font-size:0.8rem">${e.numero} parcela  ${e.label}</span>
        <input type="number" class="form-input" value="${e.valorPagar||e.valor}" step="0.01" style="width:90px;font-size:0.8rem"
          onchange="folhaDetalhe['${f.id}'].descontoEmprestimos[${i}].valorPagar=parseFloat(this.value)||0;rebuildCard('${f.id}')">
      </label>`).join('')}`:``}

      ${d.descontoVales.length>0?`
      <div style="font-size:0.78rem;font-weight:600;color:var(--text2);margin-bottom:4px;margin-top:6px">ADIANTAMENTOS:</div>
      ${d.descontoVales.map((v,i)=>`
      <label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg2);border-radius:6px;margin-bottom:4px;cursor:pointer">
        <input type="checkbox" ${v.selecionado!==false?'checked':''} style="flex-shrink:0"
          onchange="folhaDetalhe['${f.id}'].descontoVales[${i}].selecionado=this.checked;rebuildCard('${f.id}')">
        <span style="flex:1;font-size:0.8rem">${v.label}${v.data?' ('+fmtData(v.data)+')':''}</span>
        <input type="number" class="form-input" value="${v.valorPagar||v.valor}" step="0.01" style="width:90px;font-size:0.8rem"
          onchange="folhaDetalhe['${f.id}'].descontoVales[${i}].valorPagar=parseFloat(this.value)||0;rebuildCard('${f.id}')">
      </label>`).join('')}`:``}
    </div>
  </div>`;
}

function calcReflexoDsr(salario, horas, valHora) {
  // Reflexo DSR ~= 1/5 dos extras (simplificado)
  return Math.round((horas * valHora) / 5 * 100) / 100;
}

function calcFaltas(salario, faltas, reflexo) {
  const diasFalta = (salario / 30) * faltas;
  const dsrFalta = reflexo || 0;
  return diasFalta + dsrFalta;
}

function openFolhaDetalhe(funcId) {
  const d = folhaDetalhe[funcId];
  if (!d) return;
  const f = d.funcionario;
  document.getElementById('folhaDetalheTitulo').textContent = `Folha  ${f.nome}`;
  document.getElementById('folhaDetalheBody').innerHTML = buildFolhaDetalheForm(funcId, d);
  folhaAtualId = funcId;
  openModal('modal-folha-detalhe');
}

// Abrir ficha na FOLHA DE PAGAMENTO  com checkboxes de desconto
function abrirFolhaFuncionario(funcId) {
  const d = folhaDetalhe[funcId];
  if (!d) { toast('Carregue a folha primeiro', 'error'); return; }
  const f = d.funcionario;

  // Inicializar selecionado se não existe
  d.descontoEmprestimos.forEach(e => { if (e.selecionado===undefined) e.selecionado=true; if (e.valorPagar===undefined) e.valorPagar=e.valor; });
  d.descontoVales.forEach(v => { if (v.selecionado===undefined) v.selecionado=true; if (v.valorPagar===undefined) v.valorPagar=v.valor; });

  const calc = calcFolhaTotais(d);
  const empAtivos = emprestimos.filter(e => (e.status==='ativo'||!e.status) && e.funcionarioId===funcId);

  document.getElementById('folhaDetalheTitulo').textContent = `Folha  ${f.nome}`;
  document.getElementById('folhaDetalheBody').innerHTML = `
    <!-- PROVENTOS -->
    <div class="section-card-title">PROVENTOS</div>
    <div class="form-grid form-grid-3" style="margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">Dias trabalhados (0=mês completo)</label>
        <input type="number" class="form-input" id="fd-dias" value="${d.diasTrabalhados||0}" min="0" max="31">
      </div>
      <div class="form-group">
        <label class="form-label">Horas extras</label>
        <input type="number" class="form-input" id="fd-horas" value="${d.horasExtras||0}" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Valor hora extra (R$)</label>
        <input type="number" class="form-input" id="fd-valhoraextra" value="${d.horaExtraVal||0}" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">INSS (R$)</label>
        <input type="number" class="form-input" id="fd-inss" value="${d.inssValor||0}" step="0.01">
      </div>

      <div class="form-group">
        <label class="form-label">Faltas</label>
        <input type="number" class="form-input" id="fd-faltas" value="${d.faltas||0}" min="0">
      </div>
    </div>
    <div id="fd-extra-proventos" style="margin-bottom:8px">
      ${(d.outrosProventos||[]).map((o,i) => `
        <div style="display:flex;gap:8px;margin-bottom:6px">
          <input type="text" class="form-input" value="${o.descricao||''}" placeholder="Descrição" style="flex:2"
            oninput="folhaDetalhe['${funcId}'].outrosProventos[${i}].descricao=this.value">
          <input type="number" class="form-input" value="${o.valor||0}" step="0.01" style="flex:1"
            oninput="folhaDetalhe['${funcId}'].outrosProventos[${i}].valor=parseFloat(this.value)||0;recalcFolhaCard('${funcId}')">
          <button class="btn-icon" onclick="removerExtraProvento('${funcId}',${i})">🗑️</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-outline btn-sm" onclick="adicionarExtraProvento('${funcId}')">➕ Outro provento</button>

    <!-- DESCONTOS OBRIGATÓRIOS -->
    <div class="section-card-title" style="margin-top:16px">DESCONTOS  SELECIONE O QUE DESCONTAR NESTE MS</div>
    <p style="color:var(--text3);font-size:0.78rem;margin-bottom:10px">✅ = será incluído no PDF e baixado automaticamente ao confirmar</p>

    ${d.descontoEmprestimos.length > 0 ? `
    <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px">EMPRÉSTIMOS A FUNCIONÁRIOS:</div>
    ${d.descontoEmprestimos.map((e,i) => {
      const emp = emprestimos.find(x=>x.id===e.id);
      const restante = emp ? ((emp.total||0)-(emp.pago||0)) : e.valor;
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:6px;flex-wrap:wrap">
        <input type="checkbox" id="emp_sel_${e.id}" ${e.selecionado!==false?'checked':''}
          onchange="folhaDetalhe['${funcId}'].descontoEmprestimos[${i}].selecionado=this.checked;recalcFolhaCard('${funcId}')">
        <div style="flex:1;min-width:200px">
          <div style="font-size:0.85rem;font-weight:600">${e.numero} PARCELA  ${e.label.toUpperCase()}</div>
          <div style="font-size:0.75rem;color:var(--text3)">Restante: R$ ${fmtMoney(restante)}  ${e.numero}/${e.total||'?'} parcelas</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <label style="font-size:0.78rem;color:var(--text3)">Valor:</label>
          <input type="number" class="form-input" value="${e.valorPagar||e.valor}" step="0.01"
            style="width:100px;font-family:var(--mono)"
            oninput="folhaDetalhe['${funcId}'].descontoEmprestimos[${i}].valorPagar=parseFloat(this.value)||0;recalcFolhaCard('${funcId}')">
        </div>
      </div>`;
    }).join('')}` : ''}

    ${d.descontoVales.length > 0 ? `
    <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;margin-top:10px">ADIANTAMENTOS:</div>
    ${d.descontoVales.map((v,i) => {
      const valeObj = vales.find(x=>x.id===v.id);
      const abatido = valeObj?.abatimentos?.reduce((s,a)=>s+a.valor,0)||0;
      const restante = (v.valor||0) - abatido;
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:6px;flex-wrap:wrap">
        <input type="checkbox" id="val_sel_${v.id}" ${v.selecionado!==false?'checked':''}
          onchange="folhaDetalhe['${funcId}'].descontoVales[${i}].selecionado=this.checked;recalcFolhaCard('${funcId}')">
        <div style="flex:1;min-width:200px">
          <div style="font-size:0.85rem;font-weight:600">${(v.label||'Adiantamento').toUpperCase()}${v.data?'  '+fmtData(v.data):''}</div>
          <div style="font-size:0.75rem;color:var(--text3)">Original: R$ ${fmtMoney(v.valor)}${abatido>0?'  J abatido: R$ '+fmtMoney(abatido)+'  Restante: R$ '+fmtMoney(restante):''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <label style="font-size:0.78rem;color:var(--text3)">Pagar:</label>
          <input type="number" class="form-input" value="${v.valorPagar||restante}" step="0.01"
            max="${restante}" style="width:100px;font-family:var(--mono)"
            oninput="folhaDetalhe['${funcId}'].descontoVales[${i}].valorPagar=Math.min(parseFloat(this.value)||0,${restante});this.value=folhaDetalhe['${funcId}'].descontoVales[${i}].valorPagar;recalcFolhaCard('${funcId}')">
        </div>
      </div>`;
    }).join('')}` : '<p style="color:var(--text3);font-size:0.82rem">Nenhum adiantamento pendente neste mês.</p>'}

    <!-- OUTROS DESCONTOS -->
    <div id="fd-extra-descontos" style="margin-top:8px">
      ${(d.outrosDescontos||[]).map((o,i) => `
        <div style="display:flex;gap:8px;margin-bottom:6px">
          <input type="text" class="form-input" value="${o.descricao||''}" placeholder="Descrição" style="flex:2"
            oninput="folhaDetalhe['${funcId}'].outrosDescontos[${i}].descricao=this.value">
          <input type="number" class="form-input" value="${o.valor||0}" step="0.01" style="flex:1"
            oninput="folhaDetalhe['${funcId}'].outrosDescontos[${i}].valor=parseFloat(this.value)||0;recalcFolhaCard('${funcId}')">
          <button class="btn-icon" onclick="removerExtraDesconto('${funcId}',${i})">🗑️</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-outline btn-sm" onclick="adicionarExtraDesconto('${funcId}')">➕ Outro desconto</button>

    <!-- RESUMO -->
    <div style="background:var(--bg2);border-radius:10px;padding:14px;margin-top:16px">
      <div id="fd-resumo-${funcId}">
        ${buildResumoFolha(funcId)}
      </div>
    </div>
  `;

  folhaAtualId = funcId;
  // Atualizar footer do modal
  document.querySelector('#modal-folha-detalhe .modal-footer').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="closeModal('modal-folha-detalhe')">Fechar</button>
    <button class="btn btn-success btn-sm" onclick="salvarFolhaDetalhe()">💾 Salvar</button>
    <button class="btn btn-success btn-sm" onclick="gerarPdfEQuitarFolha('${funcId}')">✅ Consolidar período</button>
  `;
  openModal('modal-folha-detalhe');
}

function buildResumoFolha(funcId) {
  const d = folhaDetalhe[funcId];
  if (!d) return '';
  const calc = calcFolhaTotais(d);
  return `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Salário bruto</span><span style="font-family:var(--mono)">R$ ${fmtMoney(calc.totalProventos)}</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--red)"><span>Total descontos selecionados</span><span style="font-family:var(--mono)">- R$ ${fmtMoney(calc.totalDescontos)}</span></div>
    <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);font-size:1.05rem;font-weight:700;color:${calc.liquido<0?'var(--red)':'var(--accent2)'}">
      <span>LÍQUIDO A RECEBER</span><span style="font-family:var(--mono)">R$ ${fmtMoney(calc.liquido)}</span>
    </div>
    ${calc.liquido<0?'<div style="color:var(--red);font-size:0.78rem;margin-top:6px">⚠️ Descontos maiores que o salário. Revise os itens selecionados.</div>':''}
  `;
}

function recalcFolhaCard(funcId) {
  const resumoEl = document.getElementById(`fd-resumo-${funcId}`);
  if (resumoEl) resumoEl.innerHTML = buildResumoFolha(funcId);
  // Update card summary
  const card = document.getElementById(`fc-${funcId}`);
  const d = folhaDetalhe[funcId];
  if (card && d) {
    const calc = calcFolhaTotais(d);
    const descEl = card.querySelector('.folha-value-num.neg');
    const liqEl = card.querySelector('.folha-value-num.total');
    if (descEl) descEl.textContent = `- R$ ${fmtMoney(calc.totalDescontos)}`;
    if (liqEl) liqEl.textContent = `R$ ${fmtMoney(calc.liquido)}`;
  }
}

function adicionarExtraProvento(funcId) {
  if (!folhaDetalhe[funcId].outrosProventos) folhaDetalhe[funcId].outrosProventos = [];
  folhaDetalhe[funcId].outrosProventos.push({ descricao: '', valor: 0 });
  abrirFolhaFuncionario(funcId);
}

function removerExtraProvento(funcId, idx) {
  folhaDetalhe[funcId].outrosProventos.splice(idx, 1);
  abrirFolhaFuncionario(funcId);
}

function adicionarExtraDesconto(funcId) {
  if (!folhaDetalhe[funcId].outrosDescontos) folhaDetalhe[funcId].outrosDescontos = [];
  folhaDetalhe[funcId].outrosDescontos.push({ descricao: '', valor: 0 });
  abrirFolhaFuncionario(funcId);
}

function removerExtraDesconto(funcId, idx) {
  folhaDetalhe[funcId].outrosDescontos.splice(idx, 1);
  abrirFolhaFuncionario(funcId);
}

async function gerarPdfEQuitarFolha(funcId, fecharModal=true) {
  salvarFolhaDetalhe();
  // Gerar PDF
  gerarPdfFuncionario(funcId);
  // Quitar itens selecionados
  const d = folhaDetalhe[funcId];
  if (!d) return;
  let baixados = 0;

  // Empréstimos selecionados
  for (const e of d.descontoEmprestimos.filter(x=>x.selecionado!==false)) {
    const empObj = emprestimos.find(x=>x.id===e.id);
    if (!empObj) continue;
    const valorPago = e.valorPagar||e.valor;
    const novoPago = (empObj.pago||0) + valorPago;
    const novoRestante = (empObj.total||0) - novoPago;
    const novasParcelas = (empObj.parcelasPagas||0) + 1;
    const status = novoRestante <= 0.01 ? 'quitado' : 'ativo';
    await fsUpdate('emprestimos', e.id, { pago: novoPago, parcelasPagas: novasParcelas, status });
    const idx = emprestimos.findIndex(x=>x.id===e.id);
    if (idx>=0) Object.assign(emprestimos[idx], { pago: novoPago, parcelasPagas: novasParcelas, status });
    baixados++;
  }

  // Vales selecionados
  for (const v of d.descontoVales.filter(x=>x.selecionado!==false)) {
    const valeObj = vales.find(x=>x.id===v.id);
    if (!valeObj) continue;
    const valorPago = v.valorPagar||v.valor;
    const abatimentos = valeObj.abatimentos||[];
    abatimentos.push({ valor: valorPago, data: new Date().toISOString().slice(0,10), tipo: 'folha' });
    const totalAbatido = abatimentos.reduce((s,a)=>s+a.valor,0);
    const status = totalAbatido >= (valeObj.valor||0) ? 'descontado' : 'pendente';
    await fsUpdate('vales', v.id, { abatimentos, status });
    const idx = vales.findIndex(x=>x.id===v.id);
    if (idx>=0) Object.assign(vales[idx], { abatimentos, status });
    baixados++;
  }

  if (fecharModal) closeModal('modal-folha-detalhe');
  renderEmprestimos();
  renderVales();
  renderDashboard();
  toast(`PDF gerado + ${baixados} item(ns) baixado(s)! (Ctrl+Z para desfazer)`, 'success');
}

function buildFolhaDetalheForm(funcId, d) {
  return `
  <div class="form-grid">
    <div class="section-card-title" style="margin-top:0">COMPOSIO SALARIAL</div>
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label">Salário mensal (R$)</label>
        <input type="number" class="form-input" id="fd-salario" value="${d.salario}" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Dias trabalhados (0 = mês completo)</label>
        <input type="number" class="form-input" id="fd-dias" value="${d.diasTrabalhados}" min="0" max="31">
      </div>
      <div class="form-group">
        <label class="form-label">Horas extras</label>
        <input type="number" class="form-input" id="fd-horas" value="${d.horasExtras}" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Valor hora extra (R$)</label>
        <input type="number" class="form-input" id="fd-valhoraextra" value="${d.horaExtraVal}" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Insalubridade %</label>
        <input type="number" class="form-input" id="fd-insalubridade" value="${d.insalPct}" step="1">
      </div>
      <div class="form-group">

      </div>
    </div>

    <div class="section-card-title">DESCONTOS</div>
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label">INSS (R$)</label>
        <input type="number" class="form-input" id="fd-inss" value="${d.inssValor||0}" step="0.01">
      </div>
      
      <div class="form-group">
        <label class="form-label">Faltas injustificadas</label>
        <input type="number" class="form-input" id="fd-faltas" value="${d.faltas||0}" min="0">
      </div>
    </div>

    ${d.descontoEmprestimos.length > 0 ? `
    <div class="section-card-title">PARCELAS DE EMPRÉSTIMOS</div>
    ${d.descontoEmprestimos.map((e,i) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <input type="text" class="form-input" value="${e.numero}ª PARCELA ${e.label.toUpperCase()}" style="flex:2" readonly>
      <input type="number" class="form-input fd-emp-val" data-idx="${i}" value="${e.valor}" step="0.01" style="flex:1">
    </div>`).join('')}` : ''}

    ${d.descontoVales.length > 0 ? `
    <div class="section-card-title">VALES</div>
    ${d.descontoVales.map((v,i) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <input type="text" class="form-input" value="${v.descricao || 'Vale'}${v.data ? ' ' + fmtData(v.data) : ''}" style="flex:2" readonly>
      <input type="number" class="form-input fd-vale-val" data-idx="${i}" value="${v.valor}" step="0.01" style="flex:1">
    </div>`).join('')}` : ''}
  </div>`;
}

function salvarFolhaDetalhe() {
  const id = folhaAtualId;
  if (!id || !folhaDetalhe[id]) return;
  const d = folhaDetalhe[id];

  const getVal = (elId, fallback=0) => {
    const el = document.getElementById(elId);
    return el ? (parseFloat(el.value)||fallback) : fallback;
  };
  const getInt = (elId, fallback=0) => {
    const el = document.getElementById(elId);
    return el ? (parseInt(el.value)||fallback) : fallback;
  };

  d.diasTrabalhados = getInt('fd-dias', 0);
  d.horasExtras = getVal('fd-horas', 0);
  d.horaExtraVal = getVal('fd-valhoraextra', d.horaExtraVal);
  d.inssValor = getVal('fd-inss', d.inssValor);
  d.faltas = getInt('fd-faltas', 0);

  folhaDetalhe[id] = d;
  const card = document.getElementById('fc-' + id);
  if (card) card.outerHTML = buildFolhaCard(d.funcionario, d);

  registrarHistorico('folha', `Editou dados da folha: ${d.funcionario?.nome || ''}`, id);

  closeModal('modal-folha-detalhe');
  toast('Folha salva!', 'success');
}

// =====================================================
// PDF GENERATION
// =====================================================
function computeFolha(d) {
  const horasExtrasValor = d.horasExtras * d.horaExtraVal;
  let salarioBase = d.salario;
  if (d.diasTrabalhados > 0 && d.diasTrabalhados < 30) salarioBase = (d.salario / 30) * d.diasTrabalhados;
  const insalubridade = salarioBase * (d.insalPct / 100);
  const reflexoDsr = d.horasExtras > 0 ? calcReflexoDsr(d.salario, d.horasExtras, d.horaExtraVal) : 0;
  const premioDesempenho = d.premioDesempenho || 0;
  const totalProventos = salarioBase + horasExtrasValor + (d.insalPct > 0 ? insalubridade : 0) + reflexoDsr + premioDesempenho;
  const totalDescontos = (d.inssValor||0) + (d.valeQuinzena||0) +
    d.descontoEmprestimos.reduce((s,e) => s + e.valor, 0) +
    d.descontoVales.reduce((s,v) => s + v.valor, 0) +
    (d.faltas > 0 ? calcFaltas(d.salario, d.faltas, reflexoDsr) : 0);
  const liquido = totalProventos - totalDescontos;
  return { salarioBase, horasExtrasValor, insalubridade, reflexoDsr, premioDesempenho, totalProventos, totalDescontos, liquido };
}

function gerarPdfFolha() { gerarPdfFuncionario(folhaAtualId); }

function gerarPdfFuncionario(funcId) {
  const d = folhaDetalhe[funcId];
  if (!d) { toast('Carregue a folha primeiro', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const f = d.funcionario;
  const calc = computeFolha(d);
  const orgNome = currentOrg?.nome || 'Empresa';
  const orgCnpj = currentOrg?.cnpj || '';
  const cidade = currentOrg?.cidade || '';

  const mes = document.getElementById('folhaMes');
  const ano = document.getElementById('folhaAno').value;
  const mesNome = mes.options[mes.selectedIndex].text;
  const dataFolha = cidade + ', ' + new Date().getDate() + ' de ' + mesNome.toLowerCase() + ' de ' + ano;

  gerarPdfFolhaCompleto(doc, { f, d, calc, orgNome, orgCnpj, dataFolha, mesNome, ano }, 10, true);
  // Salvar no histórico
  const mesRef2 = `${String(parseInt(document.getElementById('folhaMes').value)).padStart(2,'0')}/${document.getElementById('folhaAno').value}`;
  const historicoAtual = getCol('historicoFolhas').getAll().find(h => h.mesRef === mesRef2);
  const snapAtual = historicoAtual?.snapshot || [];
  const jaExiste = snapAtual.findIndex(s => s.nome === f.nome);
  const novoEntry = { nome: f.nome, totalProventos: calc.totalProventos, totalDescontos: calc.totalDescontos, liquido: calc.liquido };
  if (jaExiste >= 0) snapAtual[jaExiste] = novoEntry; else snapAtual.push(novoEntry);
  salvarHistoricoFolha(mesRef2, snapAtual);
  registrarHistorico('folha', `Gerou PDF contracheque: ${f.nome} (${mesRef2})`, funcId);
}

function gerarPdfFolhaCompleto(doc, params, startY = 10, save = false) {
  const { f, d, calc, orgNome, orgCnpj, dataFolha, mesNome = '', ano = '' } = params;

  // CORES DO TEMA
  const COR_PRIMARIA  = [27, 45, 107];   // navy
  const COR_SECUNDARIA = [46, 158, 79];  // green
  const COR_CLARA     = [245, 248, 252]; // bg light
  const COR_TEXTO     = [30, 30, 45];
  const COR_VERMELHO  = [200, 30, 30];
  const COR_BORDA     = [200, 210, 225];

  const lm = 14, pw = 182, rm = lm + pw;
  let y = startY;

  // ── CABEÇALHO EMPRESA ──────────────────────────────
  doc.setFillColor(...COR_PRIMARIA);
  doc.rect(lm, y, pw, 22, 'FD');

  doc.setTextColor(255,255,255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(orgNome || 'EMPRESA', lm + 6, y + 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (orgCnpj) doc.text(`CNPJ: ${orgCnpj}`, lm + 6, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('FOLHA DE PAGAMENTO', rm - 6, y + 9, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Competência: ${mesNome} / ${ano}`, rm - 6, y + 15, { align: 'right' });

  doc.setTextColor(...COR_TEXTO);
  y += 26;

  // ── DADOS DO FUNCIONÁRIO ────────────────────────────
  doc.setFillColor(...COR_CLARA);
  doc.setDrawColor(...COR_BORDA);
  doc.rect(lm, y, pw, 20, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COR_PRIMARIA);
  doc.text('FUNCIONÁRIO', lm + 5, y + 6);
  doc.text('CPF', lm + 80, y + 6);
  doc.text('CARGO / FUNO', lm + 130, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COR_TEXTO);
  // Nome pode ser longo  quebrar se necessrio
  const nomeText = f.nome || '';
  if (nomeText.length > 30) {
    doc.setFontSize(9);
    doc.text(nomeText.substring(0, 35), lm + 5, y + 14);
    doc.setFontSize(10);
  } else {
    doc.text(nomeText, lm + 5, y + 14);
  }
  doc.text(f.cpf || '', lm + 80, y + 14);
  // Cargo: buscar do grupo se não tiver no funcionário
  const grupoNomeObj = d?.funcionario?.grupoId ? grupos.find(g => g.id === d.funcionario.grupoId) : null;
  const cargoText = f.cargo || grupoNomeObj?.nome || '';
  doc.setFontSize(8.5);
  const cargoLines = doc.splitTextToSize(cargoText, 52);
  doc.text(cargoLines[0] || '', lm + 130, y + 11);
  if (cargoLines[1]) doc.text(cargoLines[1], lm + 130, y + 17);
  doc.setFontSize(10);
  y += 24;

  // ── PROVENTOS ───────────────────────────────────────
  // Header
  doc.setFillColor(...COR_SECUNDARIA);
  doc.rect(lm, y, pw, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255,255,255);
  doc.text('PROVENTOS', lm + 5, y + 5.5);
  doc.text('VALOR (R$)', rm - 5, y + 5.5, { align: 'right' });
  doc.setTextColor(...COR_TEXTO);
  y += 8;

  const proventos = [];
  const diasLabel = d.diasTrabalhados > 0 ? `Salrio Mensal (${d.diasTrabalhados} dias trabalhados)` : 'Salrio Mensal';
  proventos.push([diasLabel, fmtMoney(calc.salarioBase)]);
  if (d.horasExtras > 0) proventos.push([`Horas Extras (${d.horasExtras}h × R$ ${fmtMoney(d.horaExtraVal)})`, fmtMoney(calc.horasExtrasValor)]);
  if (calc.reflexoDsr > 0) proventos.push(['Reflexo DSR em Horas Extras', fmtMoney(calc.reflexoDsr)]);
  const adicsFunc2 = d.funcionario?.adicionais || [];
  adicsFunc2.forEach(a => {
    const val = a.isValorFixo ? (a.valor||0) : ((d.salario||0)*(a.pct||0)/100);
    if (val > 0) proventos.push([a.nome + (a.isValorFixo ? '' : ` (${a.pct}%)`), fmtMoney(val)]);
  });
  (d.outrosProventos||[]).forEach(o => { if ((o.valor||0)>0) proventos.push([o.descricao, fmtMoney(o.valor)]); });

  proventos.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 255);
    doc.rect(lm, y, pw, 7, 'FD');
    doc.setDrawColor(...COR_BORDA);
    doc.line(lm, y+7, rm, y+7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(row[0], lm + 5, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COR_SECUNDARIA);
    doc.text(row[1], rm - 5, y + 5, { align: 'right' });
    doc.setTextColor(...COR_TEXTO);
    y += 7;
  });

  // Total proventos
  doc.setFillColor(230, 245, 235);
  doc.rect(lm, y, pw, 8, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('TOTAL DE PROVENTOS', lm + 5, y + 5.5);
  doc.setTextColor(...COR_SECUNDARIA);
  doc.text(`R$ ${fmtMoney(calc.totalProventos)}`, rm - 5, y + 5.5, { align: 'right' });
  doc.setTextColor(...COR_TEXTO);
  y += 12;

  // ── DESCONTOS ───────────────────────────────────────
  doc.setFillColor(...COR_VERMELHO);
  doc.rect(lm, y, pw, 8, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(255,255,255);
  doc.text('DESCONTOS', lm + 5, y + 5.5);
  doc.text('VALOR (R$)', rm - 5, y + 5.5, { align: 'right' });
  doc.setTextColor(...COR_TEXTO);
  y += 8;

  const descontos = [];
  if ((d.inssValor||0) > 0) {
    const inssLabel = d.inssType === 'pct' ? `INSS (${d.inssPct||0}%)` : 'INSS';
    descontos.push([inssLabel, fmtMoney(d.inssValor)]);
  }
  (d.descontoEmprestimos||[]).filter(e=>e.selecionado!==false).forEach(e => {
    descontos.push([`${e.numero} Parcela  Emprstimo: ${e.label}`, fmtMoney(e.valorPagar||e.valor)]);
  });
  (d.descontoVales||[]).filter(v=>v.selecionado!==false).forEach(v => {
    const label = (v.label||v.descricao||'Adiantamento') + (v.data ? ` (${fmtData(v.data)})` : '');
    descontos.push([label, fmtMoney(v.valorPagar||v.valor)]);
  });
  if ((d.faltas||0) > 0) {
    const descFalta = calcFaltas(d.salario, d.faltas, calc.reflexoDsr);
    descontos.push([`${d.faltas} Falta(s)  Desconto proporcional`, fmtMoney(descFalta)]);
  }
  (d.outrosDescontos||[]).forEach(o => { if ((o.valor||0)>0) descontos.push([o.descricao, fmtMoney(o.valor)]); });

  descontos.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 255, i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 248);
    doc.rect(lm, y, pw, 7, 'FD');
    doc.setDrawColor(...COR_BORDA);
    doc.line(lm, y+7, rm, y+7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(row[0], lm + 5, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COR_VERMELHO);
    doc.text(`- R$ ${row[1]}`, rm - 5, y + 5, { align: 'right' });
    doc.setTextColor(...COR_TEXTO);
    y += 7;
  });

  if (descontos.length === 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(150,150,160);
    doc.text('Nenhum desconto neste período', lm + 5, y + 5);
    doc.setTextColor(...COR_TEXTO);
    y += 7;
  }

  // Total descontos
  doc.setFillColor(255, 235, 235);
  doc.rect(lm, y, pw, 8, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('TOTAL DE DESCONTOS', lm + 5, y + 5.5);
  doc.setTextColor(...COR_VERMELHO);
  doc.text(`- R$ ${fmtMoney(calc.totalDescontos)}`, rm - 5, y + 5.5, { align: 'right' });
  doc.setTextColor(...COR_TEXTO);
  y += 12;

  // ── LÍQUIDO ─────────────────────────────────────────
  doc.setFillColor(...COR_PRIMARIA);
  doc.rect(lm, y, pw, 14, 'FD');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('VALOR LÍQUIDO A RECEBER', lm + 6, y + 9);
  doc.setFontSize(14);
  doc.text(`R$ ${fmtMoney(calc.liquido)}`, rm - 6, y + 9, { align: 'right' });
  doc.setTextColor(...COR_TEXTO);
  y += 18;

  // ── RECIBO ──────────────────────────────────────────
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.5);
  doc.line(lm, y, rm, y);
  y += 5;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('RECIBO DE PAGAMENTO', lm + pw/2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const valorExtenso = numberToWords(calc.liquido);
  const recibo = `Declaro que recebi da empresa ${orgNome}${orgCnpj ? ' (CNPJ: '+orgCnpj+')' : ''} a importncia de R$ ${fmtMoney(calc.liquido)} (${valorExtenso}), referente ao salrio do ms de ${mesNome}/${ano}, na funo de ${f.cargo || 'no definido'}.`;
  const lines = doc.splitTextToSize(recibo, pw - 10);
  doc.text(lines, lm + 5, y);
  y += lines.length * 5 + 8;

  doc.setFontSize(9);
  doc.text(dataFolha, rm - 5, y, { align: 'right' });
  y += 16;

  // Linha de assinatura
  const sigX = lm + pw/2;
  doc.setLineWidth(0.4);
  doc.setDrawColor(100,100,120);
  doc.line(sigX - 50, y, sigX + 50, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(f.nome || '', sigX, y + 4, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(130,130,150);
  doc.text('Assinatura do Funcionário', sigX, y + 8, { align: 'center' });
  doc.setTextColor(...COR_TEXTO);

  if (save) {
    const nomeSalvo = `${(f.nome||'Funcionario').replace(/\s+/g,'_')}_-_Folha_de_Pagamento_${mesNome}_${ano}.pdf`;
    doc.save(nomeSalvo);
    toast('PDF gerado!', 'success');
    closeModal('modal-folha-detalhe');
  }
  return y;
}

function gerarTodosPDFs() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const orgNome = currentOrg?.nome || 'Empresa';
  const orgCnpj = currentOrg?.cnpj || '';
  const cidade = currentOrg?.cidade || '';
  const mes = document.getElementById('folhaMes');
  const ano = document.getElementById('folhaAno').value;
  const mesNome = mes.options[mes.selectedIndex].text;
  const dataFolha = cidade + ', ' + new Date().getDate() + ' de ' + mesNome.toLowerCase() + ' de ' + ano;

  const ids = Object.keys(folhaDetalhe);
  ids.forEach((funcId, idx) => {
    if (idx > 0) doc.addPage();
    const d = folhaDetalhe[funcId];
    const calc = computeFolha(d);
    gerarPdfFolhaCompleto(doc, { f: d.funcionario, d, calc, orgNome, orgCnpj, dataFolha, mesNome, ano }, 10, false);
  });

  const _mesAno = `${String(new Date().getMonth()+1).padStart(2,'0')}_${new Date().getFullYear()}`;
  doc.save(`Folha_de_Pagamento_${_mesAno}_Todos.pdf`);
  // Salvar histórico
  const snapshot = ids.map(id => {
    const d = folhaDetalhe[id];
    const calc = computeFolha(d);
    return { nome: d.funcionario.nome, totalProventos: calc.totalProventos, totalDescontos: calc.totalDescontos, liquido: calc.liquido };
  });
  const mesRef = `${String(mes.selectedIndex+1).padStart(2,'0')}/${ano}`;
  salvarHistoricoFolha(mesRef, snapshot);
  registrarHistorico('folha', `Gerou PDF coletivo da folha ${mesRef} (${ids.length} funcionário(s))`, mesRef);
  toast(`${ids.length} folhas geradas e histórico salvo!`, 'success');
}

// =====================================================
// ACERTO DE CONTAS PESSOAIS
// =====================================================

/** Regra do acerto: cada lançamento tem "Quem deve" = quem deve esse valor ao OUTRO do par.
 *  Soma dos lançamentos onde aparece A = total que A deve a B; idem para B.
 *  Saldo líquido = (total A deve) − (total B deve). Positivo ⇒ A deve a B a diferença; negativo ⇒ B deve a A. */
function acertoNomeIgual(deNome, nomePar) {
  const a = String(deNome || '').trim().normalize('NFC');
  const b = String(nomePar || '').trim().normalize('NFC');
  if (a === b) return true;
  try {
    return a.localeCompare(b, 'pt-BR', { sensitivity: 'accent' }) === 0;
  } catch (_) {
    return false;
  }
}

/** Soma valores dos lançamentos em que `de` corresponde a essa pessoa. */
function acertoSomaOndeDeve(lances, nome) {
  return lances.reduce((s, l) => (acertoNomeIgual(l.de, nome) ? s + (Number(l.valor) || 0) : s), 0);
}

function renderAcerto() {
  const container = document.getElementById('acertoPares');
  if (!container) return;
  if (acertoPares.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🤝</div><h3>Nenhum par configurado</h3><p>Crie um par para começar os registros</p></div>`;
    return;
  }
  // Usar Firebase diretamente para garantir dados frescos
  carregarERenderAcerto(container);
}
async function carregarERenderAcerto(container) {
  try {
    if (db && currentOrg) {
      // Usar .get() com timeout para evitar "message channel closed"
      const snap = await Promise.race([
        db.collection('orgs').doc(currentOrg.id).collection('lancamentos').get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      lancamentosCache = snap.docs.map(d => ({id: d.id, ...d.data()}));
    } else {
      lancamentosCache = getCol('lancamentos').getAll();
    }
  } catch(e) {
    console.warn('carregarERenderAcerto fallback:', e.message);
    // Usar cache existente se falhar
  }
  const todosLancamentos = lancamentosCache;
  container.innerHTML = acertoPares.map(par => {
    // Filtrar apenas lançamentos ativos (não consolidados)
    const periodoAtual = par.consolidadoEm || null;
    const lances = todosLancamentos.filter(l => {
      if (l.parId !== par.id) return false;
      if (!periodoAtual) return true;
      if (!l.data) return true;
      return l.data > periodoAtual;
    }).sort((a,b) => (b.data||'').localeCompare(a.data||''));
    // "de" = quem DEVE (valor positivo = essa pessoa deve ao outro do par)
    const devidoPorA = acertoSomaOndeDeve(lances, par.pessoaA);
    const devidoPorB = acertoSomaOndeDeve(lances, par.pessoaB);
    const totalAB = devidoPorA; // quanto A deve
    const totalBA = devidoPorB; // quanto B deve
    // saldo: positivo = A deve mais que B → A é devedor líquido
    const saldo = totalAB - totalBA;
    const devedor = saldo > 0 ? par.pessoaA : par.pessoaB;
    const credor  = saldo > 0 ? par.pessoaB : par.pessoaA;
    const quitado = Math.abs(saldo) < 0.01;

    // Últimos 5 lançamentos
    const ultimos = lances.slice(0,5);

    return `<div class="acerto-card" style="margin-bottom:12px;cursor:pointer" onclick="abrirPaginaPar('${par.id}')">
      <!-- Cabeçalho -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div style="font-weight:700;font-size:1.05rem">🤝 ${par.pessoaA} ↔ ${par.pessoaB}</div>
        <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" style="font-size:0.78rem" onclick="event.stopPropagation();openLancamentoPar('${par.id}','${par.pessoaA}')">
              ${par.pessoaA} deve
            </button>
            <button class="btn btn-outline btn-sm" style="font-size:0.78rem" onclick="event.stopPropagation();openLancamentoPar('${par.id}','${par.pessoaB}')">
              ${par.pessoaB} deve
            </button>
            <button class="btn btn-primary btn-sm" onclick="abrirPaginaPar('${par.id}')">Ver →</button>
          </div>
        </div>
      </div>

      <!-- Saldo -->
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin-bottom:12px">
        <div style="text-align:center">
          <div style="font-weight:600">${par.pessoaA}</div>
          <div style="font-size:0.78rem;color:var(--red)">deve R$ ${fmtMoney(totalAB)}</div>
        </div>
        <div style="text-align:center;min-width:120px">
          <div style="font-size:0.78rem;color:var(--text3)">${quitado ? '✅ Quitados' : devedor+' deve a '+credor}</div>
          <div style="font-family:var(--mono);font-size:1.1rem;font-weight:700;color:${quitado?'var(--green)':'var(--yellow)'}">
            R$ ${fmtMoney(Math.abs(saldo))}
          </div>
        </div>
        <div style="text-align:center">
          <div style="font-weight:600">${par.pessoaB}</div>
          <div style="font-size:0.78rem;color:var(--red)">deve R$ ${fmtMoney(totalBA)}</div>
        </div>
      </div>

      <!-- Último lançamento -->
      <div style="border-top:1px solid var(--border);padding-top:8px;font-size:0.78rem;color:var(--text3)">
        ${lances.length > 0
          ? `${lances.length} lançamento(s)  último: ${lances[0].data?fmtData(lances[0].data):''}`
          : 'Nenhum lançamento ainda'}
      </div>
    </div>`;
  }).join('');
}

async function excluirLancamento(lancId, parId) {
  if (!await confirmar('Excluir lançamento?', 'Esta ao no pode ser desfeita.')) return;
  if (db && currentOrg) {
    await db.collection('orgs').doc(currentOrg.id).collection('lancamentos').doc(lancId).delete();
  } else {
    getCol('lancamentos').delete(lancId);
  }
  lancamentosCache = lancamentosCache.filter(l => l.id !== lancId);
  renderAcerto();
  toast('Lançamento excluído', 'success');
}

// exportarAcertoPar movido para export_fns

function populateLancPar() {
  const sel = document.getElementById('lancPar');
  if (!sel) return;
  sel.innerHTML = '<option value=""> Selecionar par </option>' +
    acertoPares.map(p => `<option value="${p.id}">${p.pessoaA} ↔ ${p.pessoaB}</option>`).join('');
}

function lancParChanged() {
  const parId = document.getElementById('lancPar').value;
  if (!parId) {
    document.getElementById('lancDe').innerHTML = '<option value=""> Selecionar </option>';
    const at = document.getElementById('lancAtalhos');
    if (at) at.style.display = 'none';
    return;
  }
  popularSelectLancDe(parId);
  // Mostrar atalhos rápidos
  const par = acertoPares.find(p => p.id === parId);
  const at = document.getElementById('lancAtalhos');
  if (at && par) {
    at.style.display = 'flex';
    at.innerHTML = `
      <button class="btn btn-outline btn-sm" style="flex:1;font-size:0.78rem"
        onclick="document.getElementById('lancDe').value='${par.pessoaA}'" >
        ${par.pessoaA} deve
      </button>
      <button class="btn btn-outline btn-sm" style="flex:1;font-size:0.78rem"
        onclick="document.getElementById('lancDe').value='${par.pessoaB}'">
        ${par.pessoaB} deve
      </button>`;
  }
}

document.getElementById('lancPar').addEventListener('change', lancParChanged);

function openLancamentoPar(parId, pessoaDeve) {
  // Limpar campos primeiro
  document.getElementById('lancValor').value = '';
  document.getElementById('lancDescricao').value = '';
  document.getElementById('lancData').value = new Date().toISOString().slice(0,10);
  populateLancPar();
  setTimeout(() => {
    document.getElementById('lancPar').value = parId;
    lancParChanged();
    // Se veio com pessoa pré-selecionada
    if (pessoaDeve) {
      setTimeout(() => {
        document.getElementById('lancDe').value = pessoaDeve;
      }, 50);
    }
  }, 50);
  openModal('modal-lancamento');
}

async function salvarPar() {
  const a = document.getElementById('parPessoaA').value.trim();
  const b = document.getElementById('parPessoaB').value.trim();
  if (!a || !b || a === '__novo__' || b === '__novo__') { toast('Selecione as duas pessoas', 'error'); return; }
  if (a === b) { toast('As duas pessoas devem ser diferentes', 'error'); return; }
  const novo = await fsAdd('acertoPares', { pessoaA: a, pessoaB: b });
  acertoPares.push(novo);
  closeModal('modal-acerto-par');
  renderAcerto();
  toast('Par criado!', 'success');
}

// Lista de pessoas do acerto de contas pessoais
let acertoPessoas = JSON.parse(localStorage.getItem('cgAcertoPessoas') || '[]');

function cadastrarPessoaAcerto(selectId) {
  const nome = prompt('Nome da pessoa:');
  if (!nome?.trim()) {
    document.getElementById(selectId).value = acertoPessoas[0] || '';
    return;
  }
  const nomeFmt = nome.trim();
  if (!acertoPessoas.includes(nomeFmt)) {
    acertoPessoas.push(nomeFmt);
    localStorage.setItem('cgAcertoPessoas', JSON.stringify(acertoPessoas));
  }
  popularSelectsPar();
  document.getElementById(selectId).value = nomeFmt;
}

function popularSelectsPar() {
  ['parPessoaA','parPessoaB'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = acertoPessoas.map(p => `<option value="${p}">${p}</option>`).join('') +
      '<option value="__novo__">➕ Adicionar pessoa...</option>';
    if (cur && cur !== '__novo__') sel.value = cur;
  });
}

function popularSelectLancDe(parId) {
  const par = acertoPares.find(p => p.id === parId);
  if (!par) return;
  const sel = document.getElementById('lancDe');
  if (!sel) return;
  sel.innerHTML = `<option value=""> Selecionar </option><option value="${par.pessoaA}">${par.pessoaA}</option><option value="${par.pessoaB}">${par.pessoaB}</option>`;
}

async function salvarLancamento() {
  const parId = document.getElementById('lancPar').value;
  const de = document.getElementById('lancDe').value;
  const valorRaw = document.getElementById('lancValor').value.replace(/\./g,'').replace(',','.');
  const valor = parseFloat(valorRaw) || 0;
  if (!parId || !de || !valor) { toast('Preencha todos os campos', 'error'); return; }
  // Garantir que data está preenchida  sem data, lançamento fica oculto
  const lancDataVal = document.getElementById('lancData').value || new Date().toISOString().slice(0,10);
  const data = {
    parId, de, valor,
    data: lancDataVal,
    descricao: document.getElementById('lancDescricao').value,
    categoria: document.getElementById('lancCategoria')?.value || ''
  };
  const novoLanc = await fsAdd('lancamentos', data);
  // Registrar no histórico global
  registrarHistorico('acerto', `Lançamento: ${de} deve R$ ${fmtMoney(valor)}${data.descricao ? ' — ' + data.descricao : ''}`, parId);
  // Adicionar ao cache local imediatamente
  lancamentosCache.push(novoLanc || {...data, id: Date.now().toString()});
  // Garantir que as pessoas do par estão na lista
  const parAtual = acertoPares.find(p => p.id === parId);
  if (parAtual) {
    [parAtual.pessoaA, parAtual.pessoaB].forEach(nome => {
      if (nome && !acertoPessoas.includes(nome)) {
        acertoPessoas.push(nome);
        localStorage.setItem('cgAcertoPessoas', JSON.stringify(acertoPessoas));
      }
    });
  }
  closeModal('modal-lancamento');
  document.getElementById('lancValor').value = '';
  document.getElementById('lancDescricao').value = '';
  toast('Lançamento registrado!', 'success');
  // Aguardar Firebase propagar antes de recarregar
  await new Promise(r => setTimeout(r, 500));
  // Recarregar lançamentos do Firebase
  if (db && currentOrg) {
    try {
      const snap = await db.collection('orgs').doc(currentOrg.id).collection('lancamentos').get();
      lancamentosCache = snap.docs.map(d => ({id: d.id, ...d.data()}));
    } catch(e) { /* manter cache */ }
  }
  renderAcerto();
  // Se estiver na página do par, atualizar também
  if (parAtualId === parId) renderParPage(parId);
}

async function excluirPar(id) {
  if (!await confirmar('Excluir par?', 'Todos os lançamentos deste par sero removidos. Isso pode ser desfeito.')) return;
  const backup = acertoPares.find(p=>p.id===id);
  await fsDelete('acertoPares', id);
  acertoPares = acertoPares.filter(p => p.id !== id);
  pushUndo({ descricao: `Excluir par ${backup?.pessoaA||''} ↔ ${backup?.pessoaB||''}`, reverter: async () => {
    const novo = await fsAdd('acertoPares', backup);
    acertoPares.push(novo);
    renderAcerto(); if (parAtualId === id) navigate('acerto');
  }});
  navigate('acerto');
  renderAcerto();
  toast('Par excluído (desfazer disponível)', 'success');
}

function verLancamentos(parId) {
  const par = acertoPares.find(p => p.id === parId);
  if (!par) return;
  const lances = lancamentosCache.filter(l => l.parId === parId);
  if (lances.length === 0) { toast('Nenhum lançamento ainda', 'info'); return; }
  const html = `<table><thead><tr><th>Data</th><th>De</th><th>Valor</th><th>Descrição</th></tr></thead><tbody>
    ${lances.map(l => `<tr>
      <td>${l.data ? fmtData(l.data) : ''}</td>
      <td><strong>${l.de}</strong></td>
      <td class="mono" style="color:var(--green)">R$ ${fmtMoney(l.valor)}</td>
      <td>${l.descricao || ''}</td>
    </tr>`).join('')}
  </tbody></table>`;
  document.getElementById('folhaDetalheTitulo').textContent = `Histórico: ${par.pessoaA} ↔ ${par.pessoaB}`;
  document.getElementById('folhaDetalheBody').innerHTML = html;
  document.querySelector('#modal-folha-detalhe .modal-footer').innerHTML =
    `<button class="btn btn-outline btn-sm" onclick="closeModal('modal-folha-detalhe')">Fechar</button>`;
  openModal('modal-folha-detalhe');
}

