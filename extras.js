// VALIDAÇÕES
// =====================================================
function validarCpf(cpf) {
  cpf = cpf.replace(/[^\d]/g,'');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i=0; i<9; i++) sum += parseInt(cpf[i]) * (10-i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i=0; i<10; i++) sum += parseInt(cpf[i]) * (11-i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}

function verificarCpfDuplicado(cpf, excludeId='') {
  const limpo = cpf.replace(/[^\d]/g,'');
  if (!limpo) return false;
  return funcionarios.some(f => f.id !== excludeId && f.cpf?.replace(/[^\d]/g,'') === limpo);
}

function alertaDescontoMaiorSalario(salario, totalDescontos, nome) {
  if (totalDescontos > salario) {
    const nomeFmt = nome || 'Funcion?rio';
    const salarioFmt = typeof fmtMoney === 'function' ? fmtMoney(salario) : Number(salario || 0).toFixed(2);
    const descontosFmt = typeof fmtMoney === 'function' ? fmtMoney(totalDescontos) : Number(totalDescontos || 0).toFixed(2);
    const titulo = 'Descontos maiores que o sal?rio';
    const html = `<div style="text-align:left">O total de descontos de <strong>${escapeHtml(nomeFmt)}</strong> ficou maior que o sal?rio base.<br><br>Sal?rio: <strong>R$ ${escapeHtml(salarioFmt)}</strong><br>Descontos: <strong>R$ ${escapeHtml(descontosFmt)}</strong></div>`;
    if (window.Swal?.fire) {
      Swal.fire({
        icon: 'warning',
        title: titulo,
        html,
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#1b2d6b'
      });
      return;
    }
    alert(`${titulo}\n\nO total de descontos de ${nomeFmt} ficou maior que o sal?rio base.\n\nSal?rio: R$ ${salarioFmt}\nDescontos: R$ ${descontosFmt}`);
  }
}

// FIRESTORE SECURITY RULES (para exibir na tela)
// =====================================================
function mostrarRegrasFirestore() {
  const regras = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function orgDoc(orgId) {
      return get(/databases/$(database)/documents/orgs/$(orgId));
    }

    function isOrgMember(orgId) {
      return signedIn()
        && orgDoc(orgId).exists()
        && request.auth.uid in orgDoc(orgId).data.membroIds;
    }

    function isOrgOwner(orgId) {
      return isOrgMember(orgId)
        && request.auth.uid == orgDoc(orgId).data.dono;
    }

    function isOrgAdmin(orgId) {
      return isOrgMember(orgId)
        && request.auth.uid in orgDoc(orgId).data.adminIds;
    }

    function validAccessLists() {
      return request.resource.data.membroIds is list
        && request.resource.data.adminIds is list;
    }

    function preservesOwner() {
      return request.resource.data.dono == resource.data.dono;
    }

    match /orgs/{orgId} {
      allow create: if signedIn()
        && request.resource.data.dono == request.auth.uid
        && validAccessLists()
        && request.auth.uid in request.resource.data.membroIds
        && request.auth.uid in request.resource.data.adminIds;

      allow read: if isOrgMember(orgId);

      allow update: if (isOrgOwner(orgId) || isOrgAdmin(orgId))
        && validAccessLists()
        && preservesOwner();

      allow delete: if isOrgOwner(orgId);

      match /funcionarios/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update, delete: if isOrgAdmin(orgId);
      }

      match /grupos/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update, delete: if isOrgAdmin(orgId);
      }

      match /cargos/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update, delete: if isOrgAdmin(orgId);
      }

      match /historicoFolhas/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update, delete: if isOrgAdmin(orgId);
      }

      match /folhas/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update, delete: if isOrgAdmin(orgId);
      }

      match /escalaSettings/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update, delete: if isOrgAdmin(orgId);
      }

      match /escalaRules/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update, delete: if isOrgAdmin(orgId);
      }

      match /convites/{docId} {
        allow read, create, update, delete: if isOrgAdmin(orgId);
      }

      match /vales/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update: if isOrgMember(orgId);
        allow delete: if isOrgAdmin(orgId);
      }

      match /emprestimos/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update: if isOrgMember(orgId);
        allow delete: if isOrgAdmin(orgId);
      }

      match /acertoPares/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update: if isOrgMember(orgId);
        allow delete: if isOrgAdmin(orgId);
      }

      match /lancamentos/{docId} {
        allow read: if isOrgMember(orgId);
        allow create, update: if isOrgMember(orgId);
        allow delete: if isOrgAdmin(orgId);
      }
    }
  }
}`;
  document.getElementById('folhaDetalheTitulo').textContent = 'Regras de Segurana  Firestore';
  document.getElementById('folhaDetalheBody').innerHTML = `
    <p style="color:var(--text3);font-size:0.85rem;margin-bottom:12px">Cole estas regras no Firebase Console → Firestore → Rules:</p>
    <pre style="background:var(--bg2);padding:16px;border-radius:8px;font-size:0.78rem;overflow-x:auto;color:var(--text)">\${regras}</pre>
    <p style="color:var(--yellow);font-size:0.82rem;margin-top:12px">⚠️ Você também precisa adicionar o campo <strong>membroIds</strong> (array de UIDs) em cada organização no Firestore.</p>`;
  document.querySelector('#modal-folha-detalhe .modal-footer').innerHTML =
    `<button class="btn btn-outline btn-sm" onclick="closeModal('modal-folha-detalhe')">Fechar</button>
     <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.querySelector('pre').textContent).then(()=>toast('Copiado!','success'))">📋 Copiar</button>`;
  openModal('modal-folha-detalhe');
}


// =====================================================
// CARGOS  lista gerencivel
// =====================================================
let cargosLista = [];

function loadCargos() {
  cargosLista = getCol('cargos').getAll().map(c => c.nome).filter(Boolean);
  if (cargosLista.length === 0) {
    // Cargos padrão
    cargosLista = ['AJUDANTE DE CARGA E DESCARGA','AUXILIAR ADMINISTRATIVO','AUXILIAR DE LIMPEZA','MOTORISTA','OPERADOR'];
  }
  populateCargoSelect();
}

function populateCargoSelect() {
  const sel = document.getElementById('funcCargo');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Selecione ou cadastre...</option>' +
    cargosLista.map(c => `<option value="${c}">${c}</option>`).join('') +
    '<option value="__novo__">+ Cadastrar novo cargo...</option>';
  if (current) sel.value = current;
}

function onCargoChange(sel) {
  if (sel.value === '__novo__') {
    sel.value = '';
    cadastrarNovoCargo();
  }
}

async function cadastrarNovoCargo() {
  const nome = prompt('Nome do novo cargo (será salvo em maiúsculas):');
  if (!nome || !nome.trim()) return;
  const nomeFmt = nome.trim().toUpperCase();
  if (cargosLista.includes(nomeFmt)) { toast('Cargo já existe', 'info'); return; }
  cargosLista.push(nomeFmt);
  await fsAdd('cargos', { nome: nomeFmt });
  populateCargoSelect();
  document.getElementById('funcCargo').value = nomeFmt;
  toast('Cargo cadastrado!', 'success');
}

// loadCargos já integrado ao openModal principal

// =====================================================
// PARCELAMENTO  ltima parcela diferente
// =====================================================
function calcParcela() {
  const total = parseFloat(document.getElementById('empTotal').value) || 0;
  const n = parseInt(document.getElementById('empParcelas').value) || 1;
  const tipo = document.getElementById('empTipoParcela')?.value || 'igual';
  const grupoUltima = document.getElementById('empUltimaParcelaGroup');

  if (grupoUltima) grupoUltima.style.display = tipo === 'ultima_diferente' ? '' : 'none';

  if (!total || !n) {
    document.getElementById('empSimulacao').style.display = 'none';
    return;
  }

  // Sempre mostrar simulação com ambas as opções
  const valIgual = Math.round((total / n) * 100) / 100;
  const somaIgual = valIgual * n;
  const diffIgual = Math.round((total - somaIgual) * 100) / 100;

  const valPadrao = Math.floor(total / n * 100) / 100;
  const ultimaDif = Math.round((total - valPadrao * (n-1)) * 100) / 100;

  const simIgual = document.getElementById('empSimIgual');
  const simUltima = document.getElementById('empSimUltima');
  if (simIgual) simIgual.innerHTML = `<span style="color:var(--accent2);font-weight:600">Parcelas iguais:</span> ${n}x <strong>R$ ${fmtMoney(valIgual)}</strong>${Math.abs(diffIgual)>0.01?' <span style="color:var(--text3);font-size:0.78rem">(ltima: R$ '+fmtMoney(valIgual+diffIgual)+')</span>':''}`;
  if (simUltima) simUltima.innerHTML = `<span style="color:var(--yellow);font-weight:600">Última diferente:</span> ${n-1}x <strong>R$ ${fmtMoney(valPadrao)}</strong> + 1x <strong>R$ ${fmtMoney(ultimaDif)}</strong>`;
  document.getElementById('empSimulacao').style.display = '';

  if (tipo === 'igual') {
    document.getElementById('empValorParcela').value = valIgual.toFixed(2);
  } else if (tipo === 'ultima_diferente') {
    document.getElementById('empValorParcela').value = valPadrao.toFixed(2);
    document.getElementById('empUltimaParcela').value = ultimaDif.toFixed(2);
  }

  calcValidarParcelas();
}

function calcUltimaParcela() {
  calcValidarParcelas();
}

function calcValidarParcelas() {
  const total = parseFloat(document.getElementById('empTotal').value) || 0;
  const n = parseInt(document.getElementById('empParcelas').value) || 1;
  const tipo = document.getElementById('empTipoParcela')?.value || 'igual';
  const alerta = document.getElementById('empValidacaoAlerta');
  if (!total || !n || !alerta) return;

  let soma = 0;
  if (tipo === 'igual') {
    soma = (parseFloat(document.getElementById('empValorParcela').value)||0) * n;
  } else {
    soma = (parseFloat(document.getElementById('empValorParcela').value)||0) * (n-1) +
           (parseFloat(document.getElementById('empUltimaParcela').value)||0);
  }

  const diff = Math.abs(soma - total);
  if (diff > 0.02) {
    alerta.style.display = 'block';
    alerta.textContent = `⚠️ A soma das parcelas (R$ ${fmtMoney(soma)}) não confere com o total (R$ ${fmtMoney(total)}). Diferença: R$ ${fmtMoney(diff)}`;
  } else {
    alerta.style.display = 'none';
  }
}

// =====================================================
// IMPRIMIR / PDF TODOS OS FUNCIONÁRIOS
// =====================================================
function printTodasEscalas() {
  if (!escalaGerada || escalaGerada.equipe.length === 0) {
    toast('Gere a escala primeiro', 'error'); return;
  }
  const orgNome = currentOrg?.nome || 'Empresa';
  const competencia = monthNameFromPeriod(escalaGerada.competencia);
  let html = `<!DOCTYPE html><html><head><title>FOLHA DE PONTO  ${competencia}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:0;background:#fff;color:#111}
    .sheet{padding:24px;page-break-after:always}
    .sheet:last-child{page-break-after:auto}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #aaa;padding:6px;font-size:11px;text-align:left}
    th{background:#f0f0f0;font-weight:bold}
    .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
    .title{font-size:18px;font-weight:bold}
    .sub{font-size:12px;color:#555;margin-top:2px}
    .meta{font-size:12px;text-align:right}
    .sign{margin-top:24px;display:flex;justify-content:space-between;gap:24px}
    .sign-line{flex:1;padding-top:12px;border-top:1px solid #666;text-align:center;font-size:11px}
    @media print{.sheet{padding:16px}}
  </style></head><body>`;

  escalaGerada.equipe.forEach(item => {
    html += `<div class="sheet">
      <div class="head">
        <div>
          <div class="title">FOLHA DE PONTO</div>
          <div class="sub">${orgNome}  ${item.funcionario.nome}  ${item.funcionario.cargo || ''}</div>
        </div>
        <div class="meta">
          <div><strong>COMPETÊNCIA:</strong> ${competencia}</div>
          <div><strong>TOTAL:</strong> ${item.totalHorasMes}h</div>
          <div><strong>HORA EXTRA:</strong> ${item.totalExtrasMes}h</div>
        </div>
      </div>
      <table>
        <thead><tr><th>DATA</th><th>DIA</th><th>ENTRADA</th><th>SAÍDA INT.</th><th>RETORNO</th><th>SAÍDA</th><th>TOTAL</th><th>H. EXTRA</th><th>OBS.</th></tr></thead>
        <tbody>
          ${item.dias.map(dia => `<tr>
            <td>${fmtData(dia.data)}</td>
            <td>${dayNameShort(dia.diaSemana).toUpperCase()}</td>
            <td>${dia.entrada}</td>
            <td>${dia.saidaIntervalo}</td>
            <td>${dia.retornoIntervalo}</td>
            <td>${dia.saidaFinal}</td>
            <td>${dia.horasPrevistas}h</td>
            <td>${dia.horaExtraPrevista > 0 ? dia.horaExtraPrevista + 'h' : ''}</td>
            <td></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="sign">
        <div class="sign-line">ASSINATURA DO FUNCIONÁRIO</div>
        <div class="sign-line">RESPONSÁVEL / GESTOR</div>
      </div>
    </div>`;
  });

  html += '</body></html>';
  const popup = window.open('', '_blank');
  popup.document.write(html);
  popup.document.close();
  popup.onload = () => { popup.focus(); popup.print(); };
  toast(`${escalaGerada.equipe.length} folhas preparadas para impressão`, 'success');
}

function downloadTodasEscalasPdf() {
  if (!escalaGerada || escalaGerada.equipe.length === 0) {
    toast('Gere a escala primeiro', 'error'); return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const orgNome = currentOrg?.nome || 'Empresa';
  const competencia = monthNameFromPeriod(escalaGerada.competencia);

  escalaGerada.equipe.forEach((item, idx) => {
    if (idx > 0) doc.addPage();
    doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('FOLHA DE PONTO', 14, 14);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`${orgNome}  ${item.funcionario.nome}  ${item.funcionario.cargo || ''}`, 14, 20);
    doc.text(`COMPETÊNCIA: ${competencia}`, 200, 14, { align: 'right' });
    doc.text(`TOTAL: ${item.totalHorasMes}h  |  HORA EXTRA: ${item.totalExtrasMes}h`, 200, 20, { align: 'right' });

    doc.autoTable({
      startY: 25,
      head: [['DATA','DIA','ENTRADA','SAÍDA INT.','RETORNO','SAÍDA','TOTAL','H. EXTRA','OBS.']],
      body: item.dias.map(dia => [
        fmtData(dia.data), dayNameShort(dia.diaSemana).toUpperCase(),
        dia.entrada, dia.saidaIntervalo, dia.retornoIntervalo, dia.saidaFinal,
        `${dia.horasPrevistas}h`, dia.horaExtraPrevista > 0 ? `${dia.horaExtraPrevista}h` : '', ''
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [27,45,107], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245,248,252] }
    });

    const finalY = doc.lastAutoTable.finalY + 14;
    doc.line(14, finalY, 100, finalY);
    doc.line(110, finalY, 196, finalY);
    doc.setFontSize(8);
    doc.text('ASSINATURA DO FUNCIONÁRIO', 57, finalY + 4, { align: 'center' });
    doc.text('RESPONSÁVEL / GESTOR', 153, finalY + 4, { align: 'center' });
  });

  doc.save(`FolhaPonto_${escalaGerada.competencia}_Todos.pdf`);
  toast(`PDF com ${escalaGerada.equipe.length} folhas gerado!`, 'success');
}


// =====================================================
// MODAL DE CONFIRMAO
// =====================================================
let _confirmarResolve = null;

function confirmar(titulo, msg) {
  return new Promise(resolve => {
    _confirmarResolve = resolve;
    document.getElementById('confirmarTitulo').textContent = titulo;
    document.getElementById('confirmarMsg').textContent = msg || '';
    document.getElementById('modal-confirmar').classList.add('active');
  });
}

function resolveConfirmar(val) {
  document.getElementById('modal-confirmar').classList.remove('active');
  if (_confirmarResolve) { _confirmarResolve(val); _confirmarResolve = null; }
}


// =====================================================
// BACKUP JSON
// =====================================================
function exportarBackup() {
  const backup = {
    exportadoEm: new Date().toISOString(),
    org: currentOrg?.nome || '',
    funcionarios, grupos, emprestimos, vales, acertoPares,
    historicoFolhas: getCol('historicoFolhas').getAll(),
    cargos: getCol('cargos').getAll()
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CadernoGestor_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportado!', 'success');
}


// Auto-preenche campos do funcionário ao selecionar grupo
function onGrupoFuncChange(grupoId) {
  if (grupoId === '__novo__') {
    document.getElementById('funcGrupo').value = '';
    openModal('modal-grupo');
    return;
  }
  const info = document.getElementById('grupoHerancaInfo');
  if (!grupoId) { if (info) info.style.display = 'none'; return; }
  const grupo = grupos.find(g => g.id === grupoId);
  if (!grupo) return;
  // Preencher TODOS os campos do grupo
  if (grupo.salario) document.getElementById('funcSalario').value = grupo.salario;
  if (grupo.cargaSemanal) document.getElementById('funcCargaSemanal').value = grupo.cargaSemanal;
  if (grupo.cargaMensal) document.getElementById('funcCargaMensal').value = grupo.cargaMensal;
  if (grupo.horaExtraPct) document.getElementById('funcHoraExtraPct').value = grupo.horaExtraPct;
  if (grupo.horaExtra) document.getElementById('funcHoraExtra').value = grupo.horaExtra;
  if (grupo.inssType) { document.getElementById('funcInssType').value = grupo.inssType; toggleFuncInssType(); }
  if (grupo.inss) document.getElementById('funcInss').value = grupo.inss;
  if (grupo.inssPct) document.getElementById('funcInssPct').value = grupo.inssPct;
  if (grupo.valeQuinzena) document.getElementById('funcInss').value = grupo.valeQuinzena;
  adicionaisFunc = grupo.adicionais ? JSON.parse(JSON.stringify(grupo.adicionais)) : [];
  renderAdicionaisFunc();
  if (info) info.style.display = 'block';
  toast(`Valores herdados do grupo "${grupo.nome}"`, 'info');
}


// =====================================================
// SANITIZE DATA  remove undefined/NaN antes do Firebase
// =====================================================
function sanitizeData(obj) {
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue; // ignora undefined
    if (typeof v === 'number' && isNaN(v)) { clean[k] = 0; continue; }
    if (Array.isArray(v)) { clean[k] = v.map(i => typeof i === 'object' && i !== null ? sanitizeData(i) : i); continue; }
    if (typeof v === 'object' && v !== null) { clean[k] = sanitizeData(v); continue; }
    clean[k] = v;
  }
  return clean;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function clearAppLocalStorage() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cg')) keys.push(key);
  }
  keys.forEach(key => localStorage.removeItem(key));
}

function buildMemberIds(membros) {
  return [...new Set((membros || []).map(m => m?.uid).filter(Boolean))];
}

function isAdminMember(membro) {
  if (!membro?.uid) return false;
  if (['gestor', 'empregador', 'admin'].includes(membro.role)) return true;
  const equipePerms = membro.permissoes?.equipe || [];
  const configPerms = membro.permissoes?.configuracoes || [];
  return equipePerms.includes('editar_permissoes')
    || equipePerms.includes('convidar')
    || configPerms.includes('editar');
}

function buildAdminIds(membros) {
  return [...new Set((membros || []).filter(isAdminMember).map(m => m.uid).filter(Boolean))];
}

async function syncOrgMembersAccess(orgRef, membros) {
  const membroIds = buildMemberIds(membros);
  const adminIds = buildAdminIds(membros);
  if (db && orgRef) {
    await orgRef.update({ membros, membroIds, adminIds });
  }
  if (currentOrg) {
    currentOrg.membros = membros;
    currentOrg.membroIds = membroIds;
    currentOrg.adminIds = adminIds;
  }
  return { membroIds, adminIds };
}


// =====================================================
// FUNCIONRIO  ADICIONAIS E HELPERS
// =====================================================
let adicionaisFunc = [];

function toggleFuncInssType() {
  const tipo = document.getElementById('funcInssType')?.value;
  const vg = document.getElementById('funcInssValorGroup');
  const pg = document.getElementById('funcInssPctGroup');
  if (vg) vg.style.display = tipo === 'valor' ? '' : 'none';
  if (pg) pg.style.display = tipo === 'pct' ? '' : 'none';
  atualizarResumoFunc(); // atualizar resumo ao trocar tipo
}

function calcFuncHoraExtra() {
  const salario = parseFloat(document.getElementById('funcSalario').value) || 0;
  const mensal = parseFloat(document.getElementById('funcCargaMensal').value) || 220;
  const pct = parseFloat(document.getElementById('funcHoraExtraPct').value) || 50;
  if (!salario || !mensal) return;
  // Sincronizar checkboxes com array
  adicionaisFunc.forEach((a, i) => {
    const cb = document.getElementById(`chkHoraExtra_adicionaisFunc_${i}`);
    if (cb) a.incideHoraExtra = cb.checked;
  });
  const baseAdicionais = adicionaisFunc
    .filter(a => a.incideHoraExtra && !a.isValorFixo)
    .reduce((s, a) => s + (salario * (a.pct||0) / 100), 0);
  const baseFixos = adicionaisFunc
    .filter(a => a.incideHoraExtra && a.isValorFixo)
    .reduce((s, a) => s + (a.valor||0), 0);
  const baseTotal = salario + baseAdicionais + baseFixos;
  const horaBase = baseTotal / mensal;
  document.getElementById('funcHoraExtra').value = (horaBase * (1 + pct/100)).toFixed(2);
}

function addAdicionalFunc() {
  adicionaisFunc.push({ nome: adicionaisNomes[0]||'Insalubridade', isValorFixo:false, pct:0, valor:0, incideHoraExtra:false, incideInss:false });
  renderAdicionaisFunc();
}

function removeAdicionalFunc(idx) {
  adicionaisFunc.splice(idx, 1);
  renderAdicionaisFunc();
}

function renderAdicionaisFunc() {
  const c = document.getElementById('funcAdicionais');
  if (!c) return;
  c.innerHTML = adicionaisFunc.map((a, i) => renderAdicional(adicionaisFunc, i, 'removeAdicionalFunc', 'adicionaisFunc')).join('');
}

// =====================================================
// GRUPO  SELECIONAR FUNCIONRIOS VINCULADOS
// =====================================================
function renderGrupoFuncionariosCheck(grupoId) {
  const container = document.getElementById('grupoFuncionariosCheck');
  if (!container) return;
  if (funcionarios.length === 0) {
    container.innerHTML = '<p style="color:var(--text3);font-size:0.82rem">Nenhum funcionário cadastrado ainda.</p>';
    return;
  }
  container.innerHTML = getFuncionariosOrdenados('','',true).map(f => `
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 0">
      <input type="checkbox" id="gfc_${f.id}" ${f.grupoId === grupoId ? 'checked' : ''}
        style="width:16px;height:16px;cursor:pointer">
      <span style="font-size:0.85rem">${f.nome}</span>
      ${f.grupoId && f.grupoId !== grupoId
        ? `<span style="font-size:0.72rem;color:var(--yellow)">(em outro grupo)</span>`
        : ''}
    </label>`).join('');
}


// =====================================================
// FICHA DO FUNCIONÁRIO
// =====================================================
let fichaFuncAtual = null;

function abrirFichaFuncionario(funcId, voltarPara='funcionarios') {
  const f = funcionarios.find(fn => fn.id === funcId);
  if (!f) return;
  fichaFuncAtual = funcId;

  document.getElementById('fichaVoltarBtn').onclick = () => navigate(voltarPara);
  document.getElementById('fichaTitulo').textContent = f.nome;
  document.getElementById('fichaSubtitulo').textContent = (f.cargo||'') + (f.grupoId ? '  ' + (grupos.find(g=>g.id===f.grupoId)?.nome||'') : '');

  renderFichaConteudo(funcId);
  navigate('ficha-funcionario');
}

function renderFichaConteudo(funcId) {
  const f = funcionarios.find(fn => fn.id === funcId);
  if (!f) return;

  const empAtivos = emprestimos.filter(e => (e.status==='ativo'||!e.status) && e.funcionarioId===funcId);
  const totalEmp = empAtivos.reduce((s,e) => s+((e.total||0)-(e.pago||0)), 0);
  const valesPend = vales.filter(v => v.funcionarioId===funcId && v.status!=='descontado');
  const totalVales = valesPend.reduce((s,v) => {
    const abatido = (v.abatimentos||[]).reduce((s2,a)=>s2+a.valor,0);
    return s + Math.max(0,(v.valor||0)-abatido);
  }, 0);
  const totalDev = totalEmp + totalVales;

  document.getElementById('fichaCards').innerHTML = `
    <div class="stat-card"><div class="stat-label">Empréstimos a Funcionários em Aberto</div><div class="stat-value red" style="font-size:1.2rem">R$ ${fmtMoney(totalEmp)}</div></div>
    <div class="stat-card"><div class="stat-label">Adiantamentos pendentes</div><div class="stat-value yellow" style="font-size:1.2rem">R$ ${fmtMoney(totalVales)}</div></div>
    <div class="stat-card"><div class="stat-label">SALDO DEVEDOR</div><div class="stat-value ${totalDev>0?'red':'green'}" style="font-size:1.3rem">R$ ${fmtMoney(totalDev)}</div></div>
    <div class="stat-card"><div class="stat-label">Salário base</div><div class="stat-value accent" style="font-size:1.2rem">R$ ${fmtMoney(f.salario||0)}</div></div>
  `;

  // EMPRSTIMOS A FUNCIONRIOS  com boto de detalhe e pagamento
  const empEl = document.getElementById('fichaEmprestimos');
  if (empAtivos.length === 0) {
    empEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Nenhum empréstimo ativo.</p>';
  } else {
    empEl.innerHTML = empAtivos.map(e => {
      const rest = (e.total||0)-(e.pago||0);
      const pct = e.total>0 ? Math.min(100,(e.pago||0)/e.total*100) : 0;
      const parcelaAtual = (e.parcelasPagas||0)+1;
      return `<div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:10px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.95rem">${e.descricao}</div>
            <div style="font-size:0.78rem;color:var(--text3);margin-top:2px">
              Parcela ${parcelaAtual}/${e.parcelas}  Valor: R$ ${fmtMoney(e.valorParcela)}/parcela
            </div>
            <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap">
              <div><div style="font-size:0.72rem;color:var(--text3)">Total</div><div style="font-family:var(--mono)">R$ ${fmtMoney(e.total)}</div></div>
              <div><div style="font-size:0.72rem;color:var(--text3)">Pago</div><div style="font-family:var(--mono);color:var(--green)">R$ ${fmtMoney(e.pago||0)}</div></div>
              <div><div style="font-size:0.72rem;color:var(--text3)">Restante</div><div style="font-family:var(--mono);color:var(--red)">R$ ${fmtMoney(rest)}</div></div>
            </div>
            <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn-outline btn-sm" onclick="fichaRegistrarPagamentoEmp('${e.id}','${funcId}')">💳 Registrar pagamento</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // VALES  com abatimento parcial
  const valesFunc = vales.filter(v => v.funcionarioId===funcId).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const valesEl = document.getElementById('fichaVales');
  if (valesFunc.filter(v=>v.status!=='descontado').length === 0) {
    valesEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Nenhum adiantamento pendente.</p>';
  } else {
    valesEl.innerHTML = valesFunc.filter(v=>v.status!=='descontado').map(v => {
      const abatido = (v.abatimentos||[]).reduce((s,a)=>s+a.valor,0);
      const restante = Math.max(0,(v.valor||0)-abatido);
      return `<div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:10px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.9rem">${v.descricao||'Adiantamento'}${v.data?'  '+fmtData(v.data):''}</div>
            <div style="margin-top:6px;display:flex;gap:16px;flex-wrap:wrap">
              <div><div style="font-size:0.72rem;color:var(--text3)">Original</div><div style="font-family:var(--mono)">R$ ${fmtMoney(v.valor)}</div></div>
              ${abatido>0?`<div><div style="font-size:0.72rem;color:var(--text3)">Abatido</div><div style="font-family:var(--mono);color:var(--green)">R$ ${fmtMoney(abatido)}</div></div>`:''}
              <div><div style="font-size:0.72rem;color:var(--text3)">Restante</div><div style="font-family:var(--mono);color:var(--red)">R$ ${fmtMoney(restante)}</div></div>
            </div>
            ${(v.abatimentos||[]).length>0?`<div style="font-size:0.72rem;color:var(--text3);margin-top:4px">Histórico: ${v.abatimentos.map(a=>`R$ ${fmtMoney(a.valor)} em ${fmtData(a.data)}`).join('  ')}</div>`:''}
          </div>
          <button class="btn btn-outline btn-sm" onclick="fichaAbaterVale('${v.id}','${funcId}')">💸 Registrar pagamento</button>
        </div>
      </div>`;
    }).join('');
  }

  // HISTÓRICO FOLHAS
  const histEl = document.getElementById('fichaHistoricoFolhas');
  const historicoFolhas = getCol('historicoFolhas').getAll();
  const folhasFunc = historicoFolhas.filter(h => h.snapshot?.some(s => s.nome===f.nome));
  if (folhasFunc.length === 0) {
    histEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Nenhuma folha gerada ainda.</p>';
  } else {
    histEl.innerHTML = `<table><thead><tr><th>Competência</th><th>Bruto</th><th>Descontos</th><th>Líquido</th></tr></thead>
      <tbody>${folhasFunc.map(h => {
        const snap = h.snapshot?.find(s => s.nome===f.nome);
        return snap?`<tr>
          <td><strong>${h.mesRef}</strong></td>
          <td class="mono">R$ ${fmtMoney(snap.totalProventos)}</td>
          <td class="mono" style="color:var(--red)">R$ ${fmtMoney(snap.totalDescontos)}</td>
          <td class="mono" style="color:var(--accent2)"><strong>R$ ${fmtMoney(snap.liquido)}</strong></td>
        </tr>`:'';
      }).join('')}</tbody></table>`;
  }
}

// Registrar pagamento de empréstimo pela ficha
async function fichaRegistrarPagamentoEmp(empId, funcId) {
  await registrarPagamentoMelhorado(empId);
  // Após fechar modal de confirmação, re-renderizar ficha
  setTimeout(() => renderFichaConteudo(funcId), 500);
}

// Abater vale pela ficha (integral ou parcial)
async function fichaAbaterVale(valeId, funcId) {
  const v = vales.find(x=>x.id===valeId);
  if (!v) return;
  const abatido = (v.abatimentos||[]).reduce((s,a)=>s+a.valor,0);
  const restante = Math.max(0,(v.valor||0)-abatido);

  document.getElementById('confirmarTitulo').textContent = `Pagamento de vale  ${v.descricao||'Adiantamento'}`;
  document.getElementById('confirmarMsg').innerHTML = `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Valor original:</span><strong>R$ ${fmtMoney(v.valor)}</strong></div>
      ${abatido>0?`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>J pago:</span><strong style="color:var(--green)">R$ ${fmtMoney(abatido)}</strong></div>`:''}
      <div style="display:flex;justify-content:space-between"><span>Restante:</span><strong style="color:var(--red)">R$ ${fmtMoney(restante)}</strong></div>
    </div>
    <label style="font-size:0.82rem;color:var(--text2)">Valor a pagar agora (pode ser parcial):</label>
    <input type="number" id="valeAbateInput" class="form-input" value="${restante.toFixed(2)}" max="${restante}" step="0.01" style="margin-top:6px">
    <div id="valeAbateInfo" style="font-size:0.78rem;color:var(--text3);margin-top:6px"></div>
  `;

  setTimeout(() => {
    const inp = document.getElementById('valeAbateInput');
    if (!inp) return;
    inp.addEventListener('input', () => {
      const val = parseFloat(inp.value)||0;
      const el = document.getElementById('valeAbateInfo');
      if (!el) return;
      if (val >= restante) { el.textContent = '✅ Vale será quitado completamente'; el.style.color='var(--green)'; }
      else if (val > 0) { el.textContent = `Restará R$ ${fmtMoney(restante-val)} após este pagamento`; el.style.color='var(--yellow)'; }
    });
  }, 100);

  document.getElementById('modal-confirmar').classList.add('active');
  _confirmarResolve = async (ok) => {
    document.getElementById('modal-confirmar').classList.remove('active');
    _confirmarResolve = null;
    if (!ok) return;
    const inp2 = document.getElementById('valeAbateInput');
    const valor = Math.min(parseFloat(inp2?.value)||0, restante);
    if (!valor) return;
    const novosAbatimentos = [...(v.abatimentos||[]), { valor, data: new Date().toISOString().slice(0,10), tipo: 'avulso' }];
    const totalAbatido2 = novosAbatimentos.reduce((s,a)=>s+a.valor,0);
    const novoStatus = totalAbatido2 >= (v.valor||0) ? 'descontado' : 'pendente';
    const valeAntes = {...vales.find(x=>x.id===valeId)};
    await fsUpdate('vales', valeId, { abatimentos: novosAbatimentos, status: novoStatus });
    const idx = vales.findIndex(x=>x.id===valeId);
    if (idx>=0) Object.assign(vales[idx], { abatimentos: novosAbatimentos, status: novoStatus });
    pushUndo({ descricao: `Abatimento R$ ${fmtMoney(valor)} no vale ${v.descricao||''}`, reverter: async () => {
      await fsUpdate('vales', valeId, { abatimentos: valeAntes.abatimentos||[], status: valeAntes.status||'pendente' });
      const i2 = vales.findIndex(x=>x.id===valeId);
      if (i2>=0) Object.assign(vales[i2], { abatimentos: valeAntes.abatimentos||[], status: valeAntes.status||'pendente' });
      renderVales(); renderFichaConteudo(funcId); renderDashboard();
    }});
    renderFichaConteudo(funcId);
    renderVales();
    renderDashboard();
    toast(`R$ ${fmtMoney(valor)} abatido! (Ctrl+Z para desfazer)`, 'success');
  };
}

// =====================================================
// RESUMO SALARIAL NO CADASTRO
// =====================================================
function atualizarResumoGrupo() {
  const salario = parseFloat(document.getElementById('grupoSalario').value) || 0;
  const mensal = parseFloat(document.getElementById('grupoCargaMensal').value) || 220;
  const pctHE = parseFloat(document.getElementById('grupoHoraExtraPct').value) || 50;
  const horaExtra = parseFloat(document.getElementById('grupoHoraExtra').value) || 0;
  const inssType = document.getElementById('grupoInssType')?.value || 'valor';
  let inss = 0;
  if (inssType === 'pct') {
    const pctStr = document.getElementById('grupoInssPct')?.value || '0';
    const pct = parseFloat(pctStr.replace(',','.')) || 0;
    inss = Math.round(salario * pct / 100 * 100) / 100;
  } else {
    inss = parseFloat(document.getElementById('grupoInss')?.value) || 0;
  }

  let totalAdicionais = 0;
  const linhasAdic = [];
  adicionaisGrupo.forEach(a => {
    const val = a.isValorFixo ? (a.valor||0) : Math.round(salario*(a.pct||0)/100*100)/100;
    totalAdicionais += val;
    if (val > 0) linhasAdic.push(`
      <div style="display:flex;justify-content:space-between;margin-top:3px">
        <span>${a.nome}${!a.isValorFixo&&a.pct?' ('+a.pct+'%)':''}</span>
        <span style="font-family:var(--mono);color:var(--green)">+ R$ ${fmtMoney(val)}</span>
      </div>`);
  });

  const totalBruto = salario + totalAdicionais;
  const liquido = totalBruto - inss;
  const heCalc = salario && mensal ? parseFloat(((salario/mensal)*(1+pctHE/100)).toFixed(2)) : horaExtra;

  const el = document.getElementById('grupoResumoSalarial');
  if (!el) return;
  if (!salario) { el.innerHTML = '<span style="color:var(--text3);font-size:0.8rem">Preencha o salário para ver o resumo</span>'; return; }
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span>Salário base</span><span style="font-family:var(--mono)">R$ ${fmtMoney(salario)}</span>
    </div>
    ${linhasAdic.join('')}
    <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:2px solid var(--border);font-weight:700;color:var(--green)">
      <span>TOTAL BRUTO</span><span style="font-family:var(--mono)">R$ ${fmtMoney(totalBruto)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:5px;color:var(--text3);font-size:0.8rem">
      <span>Hora extra (${pctHE}%)</span>
      <span style="font-family:var(--mono)">R$ ${fmtMoney(heCalc)}/h</span>
    </div>
    ${inss>0?`<div style="display:flex;justify-content:space-between;margin-top:4px;color:var(--red);font-size:0.8rem">
      <span>INSS${inssType==='pct'?' ('+((document.getElementById('grupoInssPct')?.value||'0').replace(',','.')+'%'):''})</span>
      <span style="font-family:var(--mono)">- R$ ${fmtMoney(inss)}</span>
    </div>`:''}
    <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:2px solid var(--border);font-weight:700;color:var(--accent2)">
      <span>LÍQUIDO ESTIMADO</span><span style="font-family:var(--mono)">R$ ${fmtMoney(liquido)}</span>
    </div>
  `;
}

function atualizarResumoFunc() {
  const salario = parseFloat(document.getElementById('funcSalario').value) || 0;
  const mensal = parseFloat(document.getElementById('funcCargaMensal').value) || 220;
  const pctHE = parseFloat(document.getElementById('funcHoraExtraPct').value) || 50;

  // Hora extra: calcular automaticamente do salário se campo estiver vazio/zero
  let horaExtra = parseFloat(document.getElementById('funcHoraExtra').value) || 0;
  if (salario && mensal && horaExtra === 0) {
    horaExtra = parseFloat(((salario / mensal) * (1 + pctHE/100)).toFixed(2));
    document.getElementById('funcHoraExtra').value = horaExtra.toFixed(2);
  }

  // INSS: corretamente lendo o tipo e calculando %
  const inssType = document.getElementById('funcInssType')?.value || 'valor';
  let inss = 0;
  if (inssType === 'pct') {
    const pctStr = document.getElementById('funcInssPct')?.value || '0';
    const pct = parseFloat(pctStr.replace(',','.')) || 0;
    inss = Math.round(salario * pct / 100 * 100) / 100;
  } else {
    inss = parseFloat(document.getElementById('funcInss').value) || 0;
  }

  // Adicionais
  let totalAdicionais = 0;
  const linhasAdic = [];
  adicionaisFunc.forEach(a => {
    const val = a.isValorFixo ? (a.valor||0) : Math.round(salario*(a.pct||0)/100*100)/100;
    totalAdicionais += val;
    if (val > 0) linhasAdic.push(`
      <div style="display:flex;justify-content:space-between;margin-top:3px">
        <span>${a.nome}${!a.isValorFixo&&a.pct?' ('+a.pct+'%)':''}</span>
        <span style="font-family:var(--mono);color:var(--green)">+ R$ ${fmtMoney(val)}</span>
      </div>`);
  });

  const totalBruto = salario + totalAdicionais;
  const liquido = totalBruto - inss;

  const el = document.getElementById('funcResumoSalarial');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span>Salário base</span><span style="font-family:var(--mono)">R$ ${fmtMoney(salario)}</span>
    </div>
    ${linhasAdic.join('')}
    <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:2px solid var(--border);font-weight:700;color:var(--green)">
      <span>TOTAL BRUTO</span><span style="font-family:var(--mono)">R$ ${fmtMoney(totalBruto)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:5px;color:var(--text3);font-size:0.8rem">
      <span>Hora extra (${pctHE}%)</span>
      <span style="font-family:var(--mono)">R$ ${fmtMoney(horaExtra)}/h</span>
    </div>
    ${inss>0?`<div style="display:flex;justify-content:space-between;margin-top:4px;color:var(--red);font-size:0.8rem">
      <span>INSS${inssType==='pct'?' ('+((document.getElementById('funcInssPct')?.value||'0').replace(',','.')+'%'):''})</span>
      <span style="font-family:var(--mono)">- R$ ${fmtMoney(inss)}</span>
    </div>`:''}
    <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:2px solid var(--border);font-weight:700;color:var(--accent2)">
      <span>LÍQUIDO ESTIMADO</span><span style="font-family:var(--mono)">R$ ${fmtMoney(liquido)}</span>
    </div>
  `;
}

// =====================================================
// VALES  novas funes
// =====================================================
function toggleValeParcelas() {
  const tipo = document.getElementById('valeTipo').value;
  document.getElementById('valeParcGroup').style.display = tipo==='parcelado' ? '' : 'none';
}

function calcValeParc() {
  const valor = parseFloat(document.getElementById('valeValor').value) || 0;
  const n = parseInt(document.getElementById('valeNParcelas').value) || 0;
  if (valor && n > 0) {
    document.getElementById('valeValorParc').value = (valor/n).toFixed(2);
  }
}

function limparFiltrosVales() {
  document.getElementById('valesFiltroFunc').value = '';
  document.getElementById('valesFiltro').value = 'pendente';
  document.getElementById('valesFiltroMes').value = '';
  renderVales();
}

function editarVale(id) {
  const v = vales.find(x => x.id===id);
  if (!v) return;
  document.getElementById('valeId').value = v.id;
  document.getElementById('valeTituloModal').textContent = 'Editar Adiantamento';
  document.getElementById('valeFuncionario').value = v.funcionarioId;
  document.getElementById('valeData').value = v.data || '';
  document.getElementById('valeValor').value = v.valor || '';
  document.getElementById('valeDescricao').value = v.descricao || '';
  document.getElementById('valeTipo').value = v.tipo || 'integral';
  toggleValeParcelas();
  if (v.nParcelas) {
    document.getElementById('valeNParcelas').value = v.nParcelas;
    document.getElementById('valeValorParc').value = v.valorParc || '';
  }
  openModal('modal-vale');
}

function openValesLoteModal() {
  const container = document.getElementById('lotevaleFuncionarios');
  const hoje = new Date().toISOString().slice(0,10);
  document.getElementById('lotevaleData').value = hoje;
  if (!container) return;
  container.innerHTML = getFuncionariosOrdenados('','',true).map(f => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <input type="checkbox" id="lote_cb_${f.id}" checked style="width:16px;height:16px;flex-shrink:0">
      <label for="lote_cb_${f.id}" style="flex:1;font-size:0.85rem;cursor:pointer">${f.nome}</label>
      <input type="number" id="lote_val_${f.id}" placeholder="0.00" step="0.01"
        style="width:100px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px;color:var(--text);font-size:0.82rem;text-align:right">
    </div>`).join('');
}

function aplicarValorPadrao() {
  const padrao = parseFloat(document.getElementById('lotevaleValorPadrao').value) || 0;
  funcionarios.filter(f=>f.ativo!==false).forEach(f => {
    const el = document.getElementById(`lote_val_${f.id}`);
    if (el) el.value = padrao.toFixed(2);
  });
}

async function salvarValesLote() {
  const data = document.getElementById('lotevaleData').value;
  const desc = document.getElementById('lotevaleDescricao').value || 'Vale';
  const salvos = [];
  for (const f of funcionarios.filter(fn=>fn.ativo!==false)) {
    const cb = document.getElementById(`lote_cb_${f.id}`);
    const valEl = document.getElementById(`lote_val_${f.id}`);
    if (!cb?.checked || !valEl) continue;
    const valor = parseFloat(valEl.value) || 0;
    if (valor <= 0) continue;
    const novo = await fsAdd('vales', {
      funcionarioId: f.id, funcionarioNome: f.nome,
      data, valor, descricao: desc, tipo: 'integral', status: 'pendente'
    });
    vales.push(novo);
    salvos.push(f.nome);
  }
  closeModal('modal-vale-lote');
  renderVales();
  renderAlertasDashboard();
  if (salvos.length) registrarHistorico('adiantamento', `Adiantamentos em lote: ${salvos.length} — ${desc}`, '');
  toast(`${salvos.length} vale(s) lançado(s)!`, 'success');
}

// =====================================================
// EMPRSTIMOS A FUNCIONRIOS  editar e registrar parcela melhorado
// =====================================================
function openEmprestimoModal(id) {
  document.getElementById('empId').value = id || '';
  document.getElementById('empTituloModal').textContent = id ? 'Editar Emprstimo' : 'Novo Emprstimo';
  if (id) {
    const e = emprestimos.find(x => x.id===id);
    if (!e) return;
    document.getElementById('empFuncionario').value = e.funcionarioId || '';
    document.getElementById('empDescricao').value = e.descricao || '';
    document.getElementById('empTotal').value = e.total || '';
    document.getElementById('empParcelas').value = e.parcelas || '';
    document.getElementById('empTipoParcela').value = e.tipoParcela || 'igual';
    document.getElementById('empValorParcela').value = e.valorParcela || '';
    document.getElementById('empUltimaParcela').value = e.ultimaParcela || '';
    document.getElementById('empDataInicio').value = e.dataInicio || '';
    calcParcela();
  } else {
    // Limpar
    ['empId','empDescricao','empTotal','empParcelas','empValorParcela','empUltimaParcela'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value='';
    });
    document.getElementById('empTipoParcela').value = 'igual';
    document.getElementById('empDataInicio').value = new Date().toISOString().slice(0,10);
  }
  openModal('modal-emprestimo');
}

async function registrarPagamentoMelhorado(id) {
  const e = emprestimos.find(x => x.id===id);
  if (!e) return;

  const parcelasPagas = e.parcelasPagas || 0;
  const totalParcelas = e.parcelas || 1;
  const restante = (e.total||0) - (e.pago||0);

  // Montar lista de parcelas pendentes
  const parcelasDisponiveis = [];
  for (let i = parcelasPagas; i < totalParcelas; i++) {
    const num = i + 1;
    const isUltima = num === totalParcelas;
    let valor = e.valorParcela || 0;
    if (isUltima && e.tipoParcela==='ultima_diferente' && e.ultimaParcela) valor = e.ultimaParcela;
    // Não exceder restante
    valor = Math.min(valor, restante - parcelasDisponiveis.reduce((s,p)=>s+p.valor,0));
    if (valor <= 0.01) break;
    parcelasDisponiveis.push({ num, valor, isUltima });
  }

  // Gerar HTML da lista de parcelas
  const parcHtml = parcelasDisponiveis.map((p, pidx) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg2);border-radius:6px;margin-bottom:6px">
      <input type="checkbox" id="parc_cb_${p.num}" ${pidx===0?'checked':''} style="width:16px;height:16px;flex-shrink:0">
      <label for="parc_cb_${p.num}" style="flex:1;font-size:0.85rem;cursor:pointer">
        Parcela ${p.num}/${totalParcelas}${p.isUltima?' (ltima)':''}
      </label>
      <input type="number" id="parc_val_${p.num}" class="form-input" value="${p.valor.toFixed(2)}" step="0.01"
        style="width:100px;font-family:var(--mono);font-size:0.82rem">
    </div>`).join('');

  document.getElementById('confirmarTitulo').textContent = `Registrar pagamento  ${e.descricao}`;
  document.getElementById('confirmarMsg').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:12px">
      <span>Total restante:</span><strong style="font-family:var(--mono)">R$ ${fmtMoney(restante)}</strong>
    </div>
    <div style="font-size:0.82rem;font-weight:600;color:var(--text2);margin-bottom:8px">
      Selecione as parcelas a pagar (e edite os valores se necessário):
    </div>
    ${parcHtml || `<p style="color:var(--text3)">Empréstimo já quitado ou sem parcelas pendentes.</p>`}
    <div id="pagTotalInfo" style="margin-top:10px;padding:8px;background:var(--bg3);border-radius:6px;font-size:0.82rem;color:var(--accent2)"></div>
  `;

  // Calcular total selecionado
  setTimeout(() => {
    const calcTotal = () => {
      let tot = 0;
      parcelasDisponiveis.forEach(p => {
        const cb = document.getElementById(`parc_cb_${p.num}`);
        const vi = document.getElementById(`parc_val_${p.num}`);
        if (cb?.checked && vi) tot += parseFloat(vi.value)||0;
      });
      const el = document.getElementById('pagTotalInfo');
      if (el) {
        const novoRest = restante - tot;
        el.textContent = `Total a pagar: R$ ${fmtMoney(tot)} → Restante: R$ ${fmtMoney(Math.max(0,novoRest))}`;
      }
    };
    parcelasDisponiveis.forEach(p => {
      document.getElementById(`parc_cb_${p.num}`)?.addEventListener('change', calcTotal);
      document.getElementById(`parc_val_${p.num}`)?.addEventListener('input', calcTotal);
    });
    calcTotal();
  }, 100);

  document.getElementById('modal-confirmar').classList.add('active');
  _confirmarResolve = async (ok) => {
    document.getElementById('modal-confirmar').classList.remove('active');
    _confirmarResolve = null;
    if (!ok) return;

    // Registrar cada parcela selecionada
    let totalPago = 0;
    let parcelasRegistradas = 0;
    const empAntes = {...e};

    for (const p of parcelasDisponiveis) {
      const cb = document.getElementById(`parc_cb_${p.num}`);
      const vi = document.getElementById(`parc_val_${p.num}`);
      if (!cb?.checked) continue;
      const valor = parseFloat(vi?.value) || p.valor;
      if (valor <= 0) continue;
      totalPago += valor;
      parcelasRegistradas++;
    }

    if (totalPago <= 0) return;

    const novoPago = (e.pago||0) + totalPago;
    const novoRestante = Math.max(0, (e.total||0) - novoPago);
    const novasParcPagas = parcelasPagas + parcelasRegistradas;
    const status = novoRestante <= 0.01 ? 'quitado' : 'ativo';
    const updates = { pago: novoPago, parcelasPagas: novasParcPagas, status };
    if (status==='ativo' && novasParcPagas === totalParcelas-1) updates.ultimaParcela = novoRestante;

    const empIdx = emprestimos.findIndex(x=>x.id===id);
    await fsUpdate('emprestimos', id, updates);
    if (empIdx>=0) Object.assign(emprestimos[empIdx], updates);

    pushUndo({ descricao: `Pagamento ${parcelasRegistradas} parcela(s) de ${e.descricao}`, reverter: async () => {
      await fsUpdate('emprestimos', id, { pago: empAntes.pago, parcelasPagas: empAntes.parcelasPagas, status: empAntes.status||'ativo' });
      const i2 = emprestimos.findIndex(x=>x.id===id);
      if (i2>=0) Object.assign(emprestimos[i2], { pago: empAntes.pago, parcelasPagas: empAntes.parcelasPagas, status: empAntes.status||'ativo' });
      renderEmprestimos(); renderDashboard();
    }});

    renderEmprestimos();
    renderDashboard();
    toast(`${parcelasRegistradas} parcela(s) registrada(s)  R$ ${fmtMoney(totalPago)}! Restante: R$ ${fmtMoney(novoRestante)}`, 'success');
  };
}

// =====================================================
// SIMULAO AUTOMTICA NO MODAL EMPRSTIMO
// =====================================================
function atualizarSimulacaoEmp() {
  const total = parseFloat(document.getElementById('empTotal').value) || 0;
  const n = parseInt(document.getElementById('empParcelas').value) || 0;
  if (!total || !n) { document.getElementById('empSimulacao').style.display='none'; return; }

  const igualVal = Math.round(total/n*100)/100;
  const igualTotal = igualVal * n;
  const diff = Math.round((total - igualTotal)*100)/100;

  // Opção 1: Iguais
  document.getElementById('empSimIgual').innerHTML =
    `<span style="color:var(--accent2)">Iguais:</span> ${n}x R$ ${fmtMoney(igualVal)}${Math.abs(diff)>0?' <span style="color:var(--text3)">(ltima R$ '+fmtMoney(igualVal+diff)+')</span>':''}`;

  // Opção 2: Parcela padrão + última diferente
  const padraoVal = Math.floor(total/n*100)/100;
  const ultimaVal = Math.round((total - padraoVal*(n-1))*100)/100;
  document.getElementById('empSimUltima').innerHTML =
    `<span style="color:var(--yellow)">Com última diferente:</span> ${n-1}x R$ ${fmtMoney(padraoVal)} + 1x R$ ${fmtMoney(ultimaVal)}`;

  document.getElementById('empSimulacao').style.display = '';
}


// =====================================================
// SISTEMA DE UNDO  histórico de aes reversveis
// =====================================================
const undoStack = [];
const MAX_UNDO = 20;

function pushUndo(acao) {
  // acao = { descricao, async reverter() {} }
  undoStack.push(acao);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  renderUndoBtn();
}

function renderUndoBtn() {
  let btn = document.getElementById('undoFloatBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'undoFloatBtn';
    btn.style.cssText = 'position:fixed;bottom:90px;right:16px;background:var(--navy);color:white;border:none;border-radius:20px;padding:10px 18px;font-size:0.82rem;cursor:pointer;z-index:9000;box-shadow:0 4px 20px rgba(0,0,0,0.4);display:none;font-family:var(--font);max-width:280px;word-break:break-word;';
    btn.onclick = desfazerUltimaAcao;
    document.body.appendChild(btn);
  }
  if (undoStack.length > 0) {
    btn.style.display = 'block';
    btn.textContent = `↩️ Desfazer: ${undoStack[undoStack.length-1].descricao}`;
  } else {
    btn.style.display = 'none';
  }
}

async function desfazerUltimaAcao() {
  const acao = undoStack.pop();
  if (!acao) return;
  try {
    await acao.reverter();
    toast(`Ação desfeita: ${acao.descricao}`, 'success');
  } catch(e) {
    toast('Erro ao desfazer: ' + e.message, 'error');
  }
  renderUndoBtn();
}

// Atalho Ctrl+Z
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    const active = document.activeElement;
    // Não interceptar em inputs/textareas
    if (!['INPUT','TEXTAREA'].includes(active.tagName)) {
      e.preventDefault();
      desfazerUltimaAcao();
    }
  }
});


// =====================================================
// HISTÓRICO FINANCEIRO
// =====================================================
function renderHistoricoFin() {
  // Emprstimos  todos, incluindo quitados
  const empEl = document.getElementById('histFinEmprestimos');
  if (empEl) {
    const todos = emprestimos.sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||''));
    if (todos.length === 0) {
      empEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Nenhum empréstimo.</p>';
    } else {
      empEl.innerHTML = todos.map(e => {
        const func = funcionarios.find(f=>f.id===e.funcionarioId);
        const rest = (e.total||0)-(e.pago||0);
        const pct = e.total>0 ? Math.min(100,(e.pago||0)/e.total*100) : 0;
        const isQuitado = e.status==='quitado' || rest<=0.01;
        return `<div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:8px;opacity:${isQuitado?0.7:1}">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <div style="font-weight:600">${e.descricao}</div>
              <div style="font-size:0.78rem;color:var(--text3)">${func?.nome||''}  ${e.criadoEm?new Date(e.criadoEm).toLocaleDateString('pt-BR'):''}</div>
            </div>
            <span class="badge ${isQuitado?'badge-green':'badge-yellow'}">${isQuitado?'✅ Quitado':'Em andamento'}</span>
          </div>
          <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;font-size:0.82rem">
            <div><span style="color:var(--text3)">Total: </span><span style="font-family:var(--mono)">R$ ${fmtMoney(e.total)}</span></div>
            <div><span style="color:var(--text3)">Pago: </span><span style="font-family:var(--mono);color:var(--green)">R$ ${fmtMoney(e.pago||0)}</span></div>
            <div><span style="color:var(--text3)">Parcelas: </span><span>${e.parcelasPagas||0}/${e.parcelas}</span></div>
          </div>
          <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join('');
    }
  }

  // Vales  todos
  const valesEl = document.getElementById('histFinVales');
  if (valesEl) {
    const todos = vales.sort((a,b) => (b.data||'').localeCompare(a.data||''));
    if (todos.length === 0) {
      valesEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Nenhum adiantamento.</p>';
    } else {
      valesEl.innerHTML = `<table><thead><tr><th>Data</th><th>Funcionário</th><th>Descrição</th><th>Valor</th><th>Abatido</th><th>Restante</th><th>Status</th></tr></thead>
        <tbody>${todos.map(v => {
          const func = funcionarios.find(f=>f.id===v.funcionarioId);
          const abatido = (v.abatimentos||[]).reduce((s,a)=>s+a.valor,0);
          const rest = Math.max(0,(v.valor||0)-abatido);
          return `<tr>
            <td style="font-size:0.8rem">${v.data?fmtData(v.data):''}</td>
            <td>${func?.nome||''}</td>
            <td>${v.descricao||'Adiantamento'}</td>
            <td class="mono">R$ ${fmtMoney(v.valor)}</td>
            <td class="mono" style="color:var(--green)">R$ ${fmtMoney(abatido)}</td>
            <td class="mono" style="color:${rest>0?'var(--red)':'var(--text3)'}">R$ ${fmtMoney(rest)}</td>
            <td><span class="badge ${v.status==='descontado'?'badge-green':'badge-yellow'}">${v.status==='descontado'?'Quitado':'Pendente'}</span></td>
          </tr>`;
        }).join('')}</tbody></table>`;
    }
  }
}

function toggleTodosFolha(checked) {
  document.querySelectorAll('.folha-func-cb').forEach(cb => cb.checked = checked);
}

async function consolidarPeriodoTodos() {
  const mes = document.getElementById('folhaMes')?.value;
  const ano = document.getElementById('folhaAno')?.value;
  const confirm = await confirmar('Consolidar perodo?', `Isso dar baixa em todos os itens selecionados de todos os funcionrios marcados para ${mes}/${ano}. Esta ao pode ser desfeita com Ctrl+Z.`);
  if (!confirm) return;
  // Processar cada funcionário marcado
  const marcados = [...document.querySelectorAll('.folha-func-cb:checked')].map(cb => cb.dataset.id);
  let total = 0;
  for (const funcId of marcados) {
    await gerarPdfEQuitarFolha(funcId, false); // false = não fechar modal
    total++;
  }
  toast(`${total} funcionário(s) consolidado(s)!`, 'success');
}


// =====================================================
// FOLHA INLINE
// =====================================================
let proventosNomes = JSON.parse(localStorage.getItem('cgProventosNomes') || 'null') ||
  ['Prêmio Bom Desempenho', 'Bônus Produção', 'Horas Extras 100%', 'Adicional Noturno', 'Outros'];

function salvarProventosNomes() {
  localStorage.setItem('cgProventosNomes', JSON.stringify(proventosNomes));
}

function calcInssInline(funcId, tipo, val) {
  const d = folhaDetalhe[funcId];
  if (!d) return;
  // val pode vir do select (tipo mudou) ou do input (valor mudou)
  const inputEl = document.getElementById(`inss-inline-${funcId}`);
  const v = val !== undefined ? parseFloat(val)||0 : (inputEl ? parseFloat(inputEl.value)||0 : 0);
  d.inssType = tipo;
  if (tipo === 'pct') {
    d.inssPct = v;
    d.inssValor = (d.salario||0) * v / 100;
  } else {
    d.inssValor = v;
    d.inssPct = 0;
  }
  rebuildCard(funcId);
}

function addProventoInline(funcId) {
  if (!folhaDetalhe[funcId]) return;
  if (!folhaDetalhe[funcId].outrosProventos) folhaDetalhe[funcId].outrosProventos = [];
  folhaDetalhe[funcId].outrosProventos.push({ descricao: proventosNomes[0]||'Prêmio', valor: 0 });
  rebuildCard(funcId);
}

function toggleFolhaInline(funcId) {
  const el = document.getElementById(`folha-inline-${funcId}`);
  const btn = document.getElementById(`btn-toggle-${funcId}`);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.textContent = isOpen ? '▼ Editar proventos e descontos' : '▲ Recolher';
}

function expandirTodosCards() {
  document.querySelectorAll('[id^="folha-inline-"]').forEach(el => {
    const funcId = el.id.replace('folha-inline-','');
    el.style.display = 'block';
    const btn = document.getElementById(`btn-toggle-${funcId}`);
    if (btn) btn.textContent = '▲ Recolher';
  });
}

function recolherTodosCards() {
  document.querySelectorAll('[id^="folha-inline-"]').forEach(el => {
    const funcId = el.id.replace('folha-inline-','');
    el.style.display = 'none';
    const btn = document.getElementById(`btn-toggle-${funcId}`);
    if (btn) btn.textContent = '▼ Editar proventos e descontos';
  });
}

function rebuildCard(funcId) {
  const d = folhaDetalhe[funcId];
  if (!d) return;
  const card = document.getElementById(`fc-${funcId}`);
  if (!card) return;
  const wasOpen = document.getElementById(`folha-inline-${funcId}`)?.style.display !== 'none';
  card.outerHTML = buildFolhaCard(d.funcionario, d);
  // Re-abrir se estava aberto
  if (wasOpen) {
    const newInline = document.getElementById(`folha-inline-${funcId}`);
    if (newInline) newInline.style.display = 'block';
  }
}

async function confirmarGerarPdf(funcId) {
  const d = folhaDetalhe[funcId];
  if (!d) { toast('Carregue a folha primeiro', 'error'); return; }
  const f = d.funcionario;

  // Verificar se campos essenciais foram preenchidos
  const alertas = [];
  if (!d.horasExtras && d.horaExtraVal > 0) alertas.push('Horas extras não foram informadas');
  if ((d.descontoEmprestimos||[]).filter(e=>e.selecionado!==false).length === 0 &&
      (d.descontoVales||[]).filter(v=>v.selecionado!==false).length === 0 &&
      emprestimos.some(e=>e.funcionarioId===funcId && (e.status==='ativo'||!e.status))) {
    alertas.push('Existem empréstimos/adiantamentos mas nenhum está selecionado para desconto');
  }

  if (alertas.length > 0) {
    const msg = `Atenção antes de gerar o PDF:\n\n${alertas.map(a=>'⚠️ '+a).join('\n')}\n\nDeseja continuar mesmo assim?`;
    if (!await confirmar('Verificar antes de gerar PDF', msg)) return;
  }

  gerarPdfFuncionario(funcId);
}


// =====================================================
// SISTEMA DE PERMISSÕES GRANULARES
// =====================================================
const TODAS_PERMISSOES = {
  funcionarios: {
    label: 'Funcionários',
    acoes: ['ver', 'cadastrar', 'editar', 'excluir', 'ver_ficha']
  },
  cargos: {
    label: 'Cargos',
    acoes: ['ver', 'cadastrar', 'editar', 'excluir']
  },
  folha: {
    label: 'Folha de Pagamento',
    acoes: ['ver', 'gerar', 'editar', 'pdf', 'consolidar']
  },
  emprestimos: {
    label: 'Empréstimos a Funcionários',
    acoes: ['ver', 'cadastrar', 'editar', 'excluir']
  },
  vales: {
    label: 'Adiantamentos Salariais',
    acoes: ['ver', 'cadastrar', 'editar', 'excluir', 'lote']
  },
  pagamentos: {
    label: 'Registrar Pagamentos',
    acoes: ['registrar_parcela', 'abater_vale', 'consolidar_folha']
  },
  escala: {
    label: 'Assistente de Escala',
    acoes: ['ver', 'configurar', 'gerar', 'imprimir']
  },
  relatorio: {
    label: 'Relatórios',
    acoes: ['ver', 'exportar_excel']
  },
  acerto: {
    label: 'Acerto de Contas Pessoais',
    acoes: ['ver', 'cadastrar_par', 'lancar', 'excluir']
  },
  equipe: {
    label: 'Equipe & Acessos',
    acoes: ['ver', 'convidar', 'editar_permissoes', 'remover']
  },
  configuracoes: {
    label: 'Configurações',
    acoes: ['ver', 'editar']
  },
  historico: {
    label: 'Histórico Financeiro',
    acoes: ['ver']
  }
};

// Perfis pré-definidos
const PERFIS_PADRAO = {
  gestor: { label: '👑 Gestor', cor: '#2E9E4F', descricao: 'Acesso total', permissoes: {} },
  empregador: { label: '🏢 Empregador', cor: '#1B2D6B', descricao: 'Gerencia folha e financeiro', permissoes: {
    funcionarios: ['ver','cadastrar','editar','ver_ficha'],
    cargos: ['ver','cadastrar','editar'],
    folha: ['ver','gerar','editar','pdf','consolidar'],
    emprestimos: ['ver','cadastrar','editar'],
    vales: ['ver','cadastrar','editar','lote'],
    pagamentos: ['registrar_parcela','abater_vale','consolidar_folha'],
    escala: ['ver','configurar','gerar','imprimir'],
    relatorio: ['ver','exportar_excel'],
    acerto: ['ver','cadastrar_par','lancar'],
    historico: ['ver']
  }},
  funcionario: { label: '👤 Funcionário', cor: '#4a6a99', descricao: 'Apenas visualiza próprios dados', permissoes: {
    folha: ['ver'],
    emprestimos: ['ver'],
    vales: ['ver'],
    historico: ['ver']
  }}
};

// Preencher gestor com tudo
Object.entries(TODAS_PERMISSOES).forEach(([mod, info]) => {
  PERFIS_PADRAO.gestor.permissoes[mod] = [...info.acoes];
});

function renderPermissoesModal(perfilId, permissoes, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = Object.entries(TODAS_PERMISSOES).map(([mod, info]) => `
    <div style="margin-bottom:14px">
      <div style="font-size:0.8rem;font-weight:700;color:var(--text2);margin-bottom:6px;text-transform:uppercase">${info.label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${info.acoes.map(acao => {
          const checked = permissoes?.[mod]?.includes(acao);
          const label = acao.replace(/_/g,' ').replace(/\w/g, l=>l.toUpperCase());
          return `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.78rem;background:var(--bg2);border-radius:6px;padding:4px 8px;border:1px solid ${checked?'var(--accent)':'var(--border)'}">
            <input type="checkbox" data-mod="${mod}" data-acao="${acao}" ${checked?'checked':''}
              onchange="this.closest('label').style.borderColor=this.checked?'var(--accent)':'var(--border)'">
            ${label}
          </label>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function coletarPermissoes(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return {};
  const perms = {};
  container.querySelectorAll('input[data-mod]:checked').forEach(cb => {
    const mod = cb.dataset.mod;
    const acao = cb.dataset.acao;
    if (!perms[mod]) perms[mod] = [];
    perms[mod].push(acao);
  });
  return perms;
}

function temPermissao(acao, modulo) {
  // Gestor tem tudo
  const membro = currentOrg?.membros?.find(m => m.uid === currentUser?.uid);
  if (!membro) return false;
  if (membro.role === 'gestor') return true;
  // Verificar permissões granulares
  if (membro.permissoes) {
    return membro.permissoes[modulo]?.includes(acao) || false;
  }
  // Fallback para perfil padrão
  const perfil = PERFIS_PADRAO[membro.role];
  if (!perfil) return false;
  return perfil.permissoes[modulo]?.includes(acao) || false;
}


// =====================================================
// FUNES DE PERMISSO
// =====================================================
function renderBotoesPerfilMembro() {
  const wrap = document.getElementById('membroPerfisBotoes');
  if (!wrap) return;
  wrap.innerHTML = Object.entries(PERFIS_PADRAO).map(([id, p]) => `
    <button type="button" class="btn btn-outline btn-sm" onclick="aplicarPerfil('${id}')"
      style="border-color:${p.cor};color:${p.cor}">
      ${p.label} ${p.descricao}
    </button>`).join('') +
    `<button type="button" class="btn btn-outline btn-sm" onclick="aplicarPerfil('custom')" style="border-color:var(--yellow);color:var(--yellow)">⚙️ Personalizado</button>`;
}

function popularSelectPreConvite() {
  const sel = document.getElementById('preConvitePerfil');
  if (!sel) return;
  sel.innerHTML = Object.entries(PERFIS_PADRAO).map(([id, p]) =>
    `<option value="${id}">${p.label}</option>`).join('') +
    '<option value="custom">⚙️ Personalizado</option>';
}

function editarMembro(uid) {
  const membro = currentOrg?.membros?.find(m => m.uid === uid);
  document.getElementById('membroId').value = uid;
  document.getElementById('membroNome').value = membro?.nome || '';
  document.getElementById('membroEmail').value = membro?.email || '';
  document.getElementById('membroModalTitulo').textContent = `Permisses  ${membro?.nome || uid}`;
  renderBotoesPerfilMembro();
  renderPermissoesModal(membro?.role, membro?.permissoes || PERFIS_PADRAO[membro?.role||'funcionario']?.permissoes || {}, 'permissoesContainer');
  openModal('modal-membro');
}

function aplicarPerfil(perfilId) {
  const perfil = PERFIS_PADRAO[perfilId];
  const perms = perfil ? perfil.permissoes : {};
  renderPermissoesModal(perfilId, perms, 'permissoesContainer');
}

async function salvarMembro() {
  const uid = document.getElementById('membroId').value;
  const nome = document.getElementById('membroNome').value;
  const email = document.getElementById('membroEmail').value;
  const permissoes = coletarPermissoes('permissoesContainer');
  if (!currentOrg?.membros) return;
  const idx = currentOrg.membros.findIndex(m => m.uid === uid);
  const updates = { permissoes, role: 'custom' };
  if (nome) updates.nome = nome;
  if (email) updates.email = email;
  // Detectar se é perfil padrão
  for (const [pid, p] of Object.entries(PERFIS_PADRAO)) {
    if (JSON.stringify(p.permissoes) === JSON.stringify(permissoes)) {
      updates.role = pid;
      break;
    }
  }
  if (idx >= 0) {
    Object.assign(currentOrg.membros[idx], updates);
  } else {
    currentOrg.membros.push({ uid, ...updates });
  }
  if (db) await syncOrgMembersAccess(db.collection('orgs').doc(currentOrg.id), currentOrg.membros);
  else localDB.setOrg(currentOrg.id, currentOrg);
  closeModal('modal-membro');
  renderEquipe();
  toast('Permissões salvas!', 'success');
}

function openPreConvite() {
  popularSelectPreConvite();
  const sel = document.getElementById('preConvitePerfil');
  if (sel) sel.value = 'empregador';
  aplicarPerfilConvite('empregador');
  openModal('modal-pre-convite');
}

function aplicarPerfilConvite(perfilId) {
  const perfil = PERFIS_PADRAO[perfilId];
  const perms = perfil ? perfil.permissoes : {};
  renderPermissoesModal(perfilId, perms, 'permissoesConviteContainer');
}

async function gerarConviteComPerms() {
  const nome = document.getElementById('preConviteNome').value.trim();
  const permissoes = coletarPermissoes('permissoesConviteContainer');
  const code = Math.random().toString(36).substring(2,8).toUpperCase();
  // Salvar convite pendente com permissões pré-definidas
  if (!currentOrg.convitesPendentes) currentOrg.convitesPendentes = [];
  currentOrg.convitesPendentes.push({ code, nome, permissoes, criadoEm: new Date().toISOString() });
  currentOrg.invite = code; // Atualizar convite ativo
  if (db) await db.collection('orgs').doc(currentOrg.id).update({
    invite: code, convitesPendentes: currentOrg.convitesPendentes
  });
  else localDB.setOrg(currentOrg.id, currentOrg);
  document.getElementById('inviteDisplay').textContent = code;
  closeModal('modal-pre-convite');
  navigator.clipboard.writeText(code).catch(()=>{});
  toast(`Convite gerado: ${code} (copiado!)`, 'success');
}

// Ao entrar com convite, aplicar permissões pré-definidas
async function aplicarPermissoesPendentes(orgData, uid) {
  const pendente = (orgData.convitesPendentes||[]).find(c => c.code === orgData.invite);
  if (pendente?.permissoes) return pendente.permissoes;
  return PERFIS_PADRAO.funcionario.permissoes;
}


// =====================================================
// ESCALA  Imprimir / PDF individual por funcionrio
// =====================================================
function getEscalaItem(funcId) {
  return escalaGerada?.equipe.find(e => e.funcionario.id === funcId);
}

function buildEscalaHtml(item) {
  if (!item) return '';
  const orgNome = currentOrg?.nome || 'Empresa';
  const competencia = monthNameFromPeriod(escalaGerada.competencia);
  return `<!DOCTYPE html><html><head><title>FOLHA DE PONTO  ${item.funcionario.nome}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:20px;background:#fff;color:#111}
    h2{font-size:16px;margin:0}
    .sub{font-size:11px;color:#555;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border:1px solid #aaa;padding:5px 7px;font-size:10px;text-align:left}
    th{background:#f0f0f0;font-weight:bold}
    .sign{margin-top:24px;display:flex;justify-content:space-between;gap:24px}
    .sign-line{flex:1;padding-top:12px;border-top:1px solid #666;text-align:center;font-size:10px}
    @media print{@page{size:A4 landscape;margin:15mm}}
  </style></head><body>
  <h2>FOLHA DE PONTO</h2>
  <div class="sub">${orgNome} &nbsp;&nbsp; ${item.funcionario.nome} &nbsp;&nbsp; ${item.funcionario.cargo||''} &nbsp;&nbsp; Competncia: ${competencia} &nbsp;&nbsp; Total: ${item.totalHorasMes}h &nbsp;&nbsp; Hora Extra: ${item.totalExtrasMes}h</div>
  <table>
    <thead><tr><th>DATA</th><th>DIA</th><th>ENTRADA</th><th>SAÍDA INT.</th><th>RETORNO</th><th>SAÍDA</th><th>TOTAL</th><th>H. EXTRA</th></tr></thead>
    <tbody>
      ${item.dias.map(dia => `<tr>
        <td>${fmtData(dia.data)}</td>
        <td>${dayNameShort(dia.diaSemana).toUpperCase()}</td>
        <td>${dia.entrada}</td>
        <td>${dia.saidaIntervalo}</td>
        <td>${dia.retornoIntervalo}</td>
        <td>${dia.saidaFinal}</td>
        <td>${dia.horasPrevistas}h</td>
        <td>${dia.horaExtraPrevista > 0 ? dia.horaExtraPrevista + 'h' : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="sign">
    <div class="sign-line">ASSINATURA DO FUNCIONÁRIO</div>
    <div class="sign-line">RESPONSÁVEL / GESTOR</div>
  </div>
  </body></html>`;
}

function printEscalaFuncionario(funcId) {
  const item = getEscalaItem(funcId);
  if (!item) { toast('Gere a escala primeiro', 'error'); return; }
  const popup = window.open('', '_blank');
  popup.document.write(buildEscalaHtml(item));
  popup.document.close();
  popup.onload = () => { popup.focus(); popup.print(); };
}

function downloadEscalaPdfFuncionario(funcId) {
  const item = getEscalaItem(funcId);
  if (!item) { toast('Gere a escala primeiro', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const orgNome = currentOrg?.nome || 'Empresa';
  const competencia = monthNameFromPeriod(escalaGerada.competencia);

  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('FOLHA DE PONTO', 14, 14);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`${orgNome}  ${item.funcionario.nome}  ${item.funcionario.cargo||''}`, 14, 20);
  doc.text(`Competência: ${competencia}   Total: ${item.totalHorasMes}h   Hora Extra: ${item.totalExtrasMes}h`, 14, 25);

  doc.autoTable({
    startY: 29,
    head: [['DATA','DIA','ENTRADA','SAÍDA INT.','RETORNO','SAÍDA','TOTAL','H. EXTRA']],
    body: item.dias.map(dia => [
      fmtData(dia.data),
      dayNameShort(dia.diaSemana).toUpperCase(),
      dia.entrada, dia.saidaIntervalo, dia.retornoIntervalo, dia.saidaFinal,
      `${dia.horasPrevistas}h`,
      dia.horaExtraPrevista > 0 ? `${dia.horaExtraPrevista}h` : ''
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [27,45,107], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245,248,252] }
  });

  const finalY = doc.lastAutoTable.finalY + 14;
  if (finalY < 195) {
    doc.line(14, finalY, 130, finalY);
    doc.line(140, finalY, 283, finalY);
    doc.setFontSize(8);
    doc.text('ASSINATURA DO FUNCIONÁRIO', 72, finalY + 4, { align: 'center' });
    doc.text('RESPONSÁVEL / GESTOR', 211, finalY + 4, { align: 'center' });
  }

  const nomePdf = `${(item.funcionario.nome||'').replace(/\s+/g,'_')}_Folha_de_Ponto_${escalaGerada.competencia}.pdf`;
  doc.save(nomePdf);
  toast(`PDF gerado: ${nomePdf}`, 'success');
}


// =====================================================
// DASHBOARD PERSONALIZÁVEL
// =====================================================

// Definição de todos os widgets disponíveis
const DASH_WIDGETS = {
  atalhos: {
    label: '🚀 Atalhos Rápidos',
    descricao: 'Botões de acesso rápido a ações frequentes',
    padrao: true,
    render: () => {
      // Atalhos configurveis  carregados do localStorage
      const todosAtalhos = {
        'adiantamento': { label: '💵 Adiantamento Salarial', action: "openModal('modal-vale')" },
        'adiantamento_lote': { label: '📋 Adiantamentos em Lote', action: "openModal('modal-vale-lote')" },
        'acerto': { label: '🤝 Novo Acerto de Contas Pessoais', action: "openModal('modal-lancamento')" },
        'par': { label: '🔗 Novo Par', action: "openModal('modal-acerto-par')" },
        'emprestimo': { label: '💰 Novo Empréstimo a Funcionários', action: "openEmprestimoModal()" },
        'folha': { label: '📋 Folha de Pagamento', action: "navigate('folha')" },
        'funcionario': { label: '👤 Novo Funcionário', action: "openModal('modal-funcionario')" },
        'cargo': { label: '👔 Novo Cargo', action: "openModal('modal-grupo')" },
        'calculadora': { label: '🧮 Calculadora', action: "navigate('calculadora')" },
        'contrato': { label: '📝 Novo Contrato', action: "navigate('contratos')" },
        'escala': { label: '🗓️ Assistente de Escala', action: "navigate('escala')" },
        'relatorio': { label: '📊 Relatório', action: "navigate('relatorio')" },
      };
      const atalhosSel = JSON.parse(localStorage.getItem('cgAtalhosDash') || 'null') ||
        ['adiantamento','adiantamento_lote','acerto','par','emprestimo','folha'];
      const btns = atalhosSel.map(k => todosAtalhos[k]).filter(Boolean);
      return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${btns.map(b => `<button class="btn btn-outline btn-sm" onclick="${b.action}" style="flex:1;min-width:130px;text-align:center">${b.label}</button>`).join('')}
      </div>`;
    }
  },
  resumo: {
    label: '📊 Resumo Geral',
    descricao: 'Cards com totais de funcionários, empréstimos e folha',
    padrao: true,
    render: () => {
      const funcAtivos = funcionarios.filter(f => f.ativo !== false).length;
      const empAtivos = emprestimos.filter(e => e.status === 'ativo' || !e.status);
      const totalAberto = empAtivos.reduce((s, e) => s + ((e.total||0)-(e.pago||0)), 0);
      const valesPend = vales.filter(v => v.status !== 'descontado');
      const totalVales = valesPend.reduce((s,v)=>s+(v.valor||0),0);
      const folhasHist = getCol('historicoFolhas').getAll();
      const ultimaFolha = folhasHist.sort((a,b)=>(b.mesRef||'').localeCompare(a.mesRef||''))[0];
      return `<div class="cards-grid" style="margin-bottom:16px">
        <div class="stat-card" style="cursor:pointer" onclick="navigate('funcionarios')">
          <div class="stat-label">Funcionários ativos</div>
          <div class="stat-value accent">${funcAtivos}</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="navigate('emprestimos')">
          <div class="stat-label">Empréstimos a Funcionários em Aberto</div>
          <div class="stat-value yellow">R$ ${fmtMoney(totalAberto)}</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="navigate('vales')">
          <div class="stat-label">Adiantamentos pendentes</div>
          <div class="stat-value red">R$ ${fmtMoney(totalVales)}</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="navigate('historico-folha')">
          <div class="stat-label">Última folha gerada</div>
          <div class="stat-value" style="font-size:1rem">${ultimaFolha?.mesRef || ''}</div>
        </div>
      </div>`;
    }
  },
  acerto: {
    label: '🤝 Acerto de Contas Pessoais',
    descricao: 'Resumo dos saldos entre os pares cadastrados',
    padrao: false,
    render: () => {
      if (acertoPares.length === 0) {
        return `<div class="section-card" style="margin-bottom:16px">
          <div class="section-card-title">🤝 ACERTO DE CONTAS PESSOAIS</div>
          <div class="empty-state" style="padding:20px">
            <div class="icon" style="font-size:32px">🤝</div>
            <h3>Nenhum par cadastrado</h3>
            <p><button class="btn btn-primary btn-sm" onclick="openModal('modal-acerto-par')">🔗 Criar par</button></p>
          </div>
        </div>`;
      }
      const rows = acertoPares.map(par => {
        const periodoAtual = par.consolidadoEm || null;
        const lances = lancamentosCache.filter(l => {
          if (l.parId !== par.id) return false;
          if (!periodoAtual) return true;
          if (!l.data) return true;
          return l.data > periodoAtual;
        }).sort((a,b) => (b.data||'').localeCompare(a.data||''));
        const devidoPorA = acertoSomaOndeDeve(lances, par.pessoaA);
        const devidoPorB = acertoSomaOndeDeve(lances, par.pessoaB);
        const totalAB = devidoPorA;
        const totalBA = devidoPorB;
        const saldo = totalAB - totalBA; // positivo = A deve mais
        const devedor = saldo > 0 ? par.pessoaA : par.pessoaB;
        const credor  = saldo > 0 ? par.pessoaB : par.pessoaA;
        const quitado = Math.abs(saldo) < 0.01;
        const ultimoLanc = lances[0];
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg2);border-radius:8px;margin-bottom:6px">
          <!-- Info do par -->
          <div style="flex:1;min-width:0;cursor:pointer" onclick="abrirPaginaPar('${par.id}')">
            <div style="font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${par.pessoaA} ↔ ${par.pessoaB}</div>
            <div style="font-size:0.7rem;margin-top:1px;color:${quitado?'var(--green)':'var(--yellow)'}">
              ${quitado ? '✅ Quitado' : '⚠️ ' + devedor + ' deve R$ ' + fmtMoney(Math.abs(saldo))}
            </div>
          </div>
          <!-- Botes compactos  mesmo estilo do acerto de contas -->
          <button onclick="openLancamentoPar('${par.id}','${par.pessoaA}')"
            class="btn btn-outline btn-sm"
            style="font-size:0.72rem;padding:4px 8px;white-space:nowrap;flex-shrink:0">
            ${par.pessoaA.split(' ')[0]} deve
          </button>
          <button onclick="openLancamentoPar('${par.id}','${par.pessoaB}')"
            class="btn btn-outline btn-sm"
            style="font-size:0.72rem;padding:4px 8px;white-space:nowrap;flex-shrink:0">
            ${par.pessoaB.split(' ')[0]} deve
          </button>
        </div>`;
      }).join('');
      return `<div class="section-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="section-card-title" style="margin:0">🤝 ACERTO DE CONTAS PESSOAIS</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" onclick="navigate('acerto')">Ver todos</button>
            <button class="btn btn-primary btn-sm" onclick="openModal('modal-lancamento')">➕ Lançar</button>
          </div>
        </div>
        ${rows}
      </div>`;
    }
  },
  valesPendentes: {
    label: '💵 Adiantamentos Salariais Pendentes',
    descricao: 'Lista dos vales ainda não descontados',
    padrao: false,
    render: () => {
      const pend = vales.filter(v=>v.status!=='descontado').slice(0,5);
      if (pend.length === 0) return `<div class="section-card" style="margin-bottom:16px">
        <div class="section-card-title">🎫 ADIANTAMENTOS PENDENTES</div>
        <p style="color:var(--text3);font-size:0.85rem">Nenhum adiantamento pendente.</p>
      </div>`;
      return `<div class="section-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="section-card-title" style="margin:0">💵 ADIANTAMENTOS PENDENTES</div>
          <button class="btn btn-outline btn-sm" onclick="navigate('vales')">Ver todos</button>
        </div>
        <table><thead><tr><th>Funcionário</th><th>Descrição</th><th>Valor</th><th>Data</th></tr></thead>
        <tbody>${pend.map(v=>{
          const f=funcionarios.find(fn=>fn.id===v.funcionarioId);
          return `<tr>
            <td>${f?.nome||''}</td>
            <td>${v.descricao||'Adiantamento'}</td>
            <td class="mono" style="color:var(--red)">R$ ${fmtMoney(v.valor)}</td>
            <td style="font-size:0.78rem">${v.data?fmtData(v.data):''}</td>
          </tr>`;
        }).join('')}</tbody></table>
        ${vales.filter(v=>v.status!=='descontado').length > 5 ? `<p style="font-size:0.78rem;color:var(--text3);margin-top:8px">+${vales.filter(v=>v.status!=='descontado').length-5} outros</p>` : ''}
      </div>`;
    }
  },
  emprestimosResumo: {
    label: '💰 Empréstimos a Funcionários Resumo',
    descricao: 'Lista dos empréstimos ativos com saldo devedor',
    padrao: false,
    render: () => {
      const ativos = emprestimos.filter(e=>e.status==='ativo'||!e.status).slice(0,5);
      if (ativos.length === 0) return `<div class="section-card" style="margin-bottom:16px">
        <div class="section-card-title">💰 EMPRÉSTIMOS A FUNCIONÁRIOS</div>
        <p style="color:var(--text3);font-size:0.85rem">Nenhum empréstimo ativo.</p>
      </div>`;
      return `<div class="section-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="section-card-title" style="margin:0">💰 EMPRÉSTIMOS A FUNCIONÁRIOS — ATIVOS</div>
          <button class="btn btn-outline btn-sm" onclick="navigate('emprestimos')">Ver todos</button>
        </div>
        <table><thead><tr><th>Funcionário</th><th>Descrição</th><th>Restante</th><th>Próx. Parcela</th></tr></thead>
        <tbody>${ativos.map(e=>{
          const f=funcionarios.find(fn=>fn.id===e.funcionarioId);
          const rest=(e.total||0)-(e.pago||0);
          return `<tr>
            <td>${f?.nome||e.funcionarioNome||''}</td>
            <td>${e.descricao}</td>
            <td class="mono" style="color:var(--red)">R$ ${fmtMoney(rest)}</td>
            <td class="mono">R$ ${fmtMoney(e.valorParcela)}</td>
          </tr>`;
        }).join('')}</tbody></table>
      </div>`;
    }
  },
  calculadora: {
    label: '🧮 Calculadora',
    descricao: 'Calculadora com fita de papel integrada no dashboard',
    padrao: false,
    render: () => {
      return `<div class="section-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="section-card-title" style="margin:0">🧮 CALCULADORA</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" onclick="calcNovaDash()" title="Nova fita (Esc)">🗑️</button>
            <button class="btn btn-outline btn-sm" onclick="calcImprimirDash('a4')">🖨️ A4</button>
            <button class="btn btn-outline btn-sm" onclick="calcImprimirDash('cupom')">🧾</button>
            <button class="btn btn-outline btn-sm" onclick="navigate('calculadora')">↗ Expandir</button>
          </div>
        </div>

        <!-- Desktop: mesma grade da página Calculadora; mobile via CSS -->
        <div id="dashCalcLayout" class="calc-layout">

          <!-- FITA -->
          <div style="background:var(--bg3);border-radius:10px;padding:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:0.72rem;font-weight:700;color:var(--text3)">FITA</span>
              <span id="dashCalcTotal" style="font-family:var(--mono);font-size:1rem;font-weight:700;color:var(--accent2)">0,00</span>
            </div>
            <div id="dashCalcFita" style="font-family:var(--mono);font-size:0.78rem;min-height:60px;max-height:200px;overflow-y:auto">
              <p style="color:var(--text3);font-size:0.72rem;text-align:center;margin:12px 0">Nenhuma operação</p>
            </div>
          </div>

          <!-- TECLADO -->
          <div>
            <div style="background:var(--bg3);border-radius:8px;padding:8px 12px;margin-bottom:8px;text-align:right">
              <div id="dashCalcDisplay" style="font-family:var(--mono);font-size:1.8rem;font-weight:700;color:var(--text)">0</div>
              <div id="dashCalcOp" style="font-size:0.65rem;color:var(--text3);min-height:12px"></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
              <button class="calc-btn calc-fn" onclick="dashCalcFn('%')">%</button>
              <button class="calc-btn calc-fn" onclick="dashCalcFn('CE')">CE</button>
              <button class="calc-btn calc-fn" onclick="dashCalcFn('C')">C</button>
              <button class="calc-btn calc-op" onclick="dashCalcFn('÷')">÷</button>
              <button class="calc-btn" onclick="dashCalcNum('7')">7</button>
              <button class="calc-btn" onclick="dashCalcNum('8')">8</button>
              <button class="calc-btn" onclick="dashCalcNum('9')">9</button>
              <button class="calc-btn calc-op" onclick="dashCalcFn('×')">×</button>
              <button class="calc-btn" onclick="dashCalcNum('4')">4</button>
              <button class="calc-btn" onclick="dashCalcNum('5')">5</button>
              <button class="calc-btn" onclick="dashCalcNum('6')">6</button>
              <button class="calc-btn calc-op calc-minus" onclick="dashCalcFn('-')">−</button>
              <button class="calc-btn" onclick="dashCalcNum('1')">1</button>
              <button class="calc-btn" onclick="dashCalcNum('2')">2</button>
              <button class="calc-btn" onclick="dashCalcNum('3')">3</button>
              <button class="calc-btn calc-op calc-plus" onclick="dashCalcFn('+')">+</button>
              <button class="calc-btn calc-fn" onclick="dashCalcFn('SUB')">SUB</button>
              <button class="calc-btn" onclick="dashCalcNum('0')">0</button>
              <button class="calc-btn" onclick="dashCalcNum(',')">.</button>
              <button class="calc-btn calc-eq" onclick="dashCalcFn('=')">=</button>
            </div>
          </div>
        </div>
      </div>`;
    }
  },
  historicoAcoes: {
    label: '📜 Histórico de Ações',
    descricao: 'Log de todas as ações realizadas no sistema',
    padrao: false,
    render: () => `<div class="section-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="section-card-title" style="margin:0">📜 HISTÓRICO DE AÇÕES</div>
        <button class="btn btn-outline btn-sm" onclick="navigate('historico-acoes')">Ver tudo →</button>
      </div>
      <div id="dashHistoricoAcoes"><p style="color:var(--text3);font-size:0.82rem">Carregando...</p></div>
    </div>`
  },
  historicoFolhas: {
    label: '📁 Histórico de Folhas',
    descricao: 'Últimas folhas geradas',
    padrao: false,
    render: () => {
      const hist = getCol('historicoFolhas').getAll().sort((a,b)=>(b.mesRef||'').localeCompare(a.mesRef||'')).slice(0,4);
      if (hist.length === 0) return '';
      return `<div class="section-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="section-card-title" style="margin:0">📁 FOLHAS RECENTES</div>
          <button class="btn btn-outline btn-sm" onclick="navigate('historico-folha')">Ver todas</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${hist.map(h=>`<div class="stat-card" style="flex:1;min-width:130px;cursor:pointer" onclick="navigate('historico-folha')">
            <div class="stat-label">${h.mesRef}</div>
            <div style="font-family:var(--mono);font-size:0.9rem;color:var(--accent2)">R$ ${fmtMoney(h.totalLiquido)}</div>
            <div style="font-size:0.72rem;color:var(--text3)">${h.qtdFuncionarios} func.</div>
          </div>`).join('')}
        </div>
      </div>`;
    }
  }
};

// Config padrão
function getDashConfig() {
  const saved = localStorage.getItem('cgDashConfig');
  if (saved) return JSON.parse(saved);
  // Padrão: widgets ativos na ordem padrão
  return Object.keys(DASH_WIDGETS).filter(k => DASH_WIDGETS[k].padrao);
}

function salvarDashConfig(config) {
  localStorage.setItem('cgDashConfig', JSON.stringify(config));
}

function renderDashboard() {
  // Atualizar data
  const d = new Date();
  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = d.toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});

  const config = getDashConfig();
  const container = document.getElementById('dashConteudo');
  if (!container) return;

  container.innerHTML = config
    .filter(k => DASH_WIDGETS[k])
    .map(k => DASH_WIDGETS[k].render())
    .join('');

  setTimeout(() => {
    applyDashCalcLayout();
    if (document.getElementById('dashCalcFita')) dashCalcRenderFita();
  }, 0);
}

function applyDashCalcLayout() {
  const lay = document.getElementById('dashCalcLayout');
  if (!lay) return;
  const isMobile = window.innerWidth <= 768;
  lay.style.display = 'grid';
  lay.style.gridTemplateColumns = isMobile ? '1fr' : '1fr minmax(240px,280px)';
  lay.style.gap = '16px';
  lay.style.alignItems = 'start';
}

function openDashConfig() {
  const config = getDashConfig();
  const container = document.getElementById('dashWidgetsConfig');
  if (!container) return;
  container.innerHTML = Object.entries(DASH_WIDGETS).map(([id, w]) => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg2);border-radius:8px;margin-bottom:8px">
      <input type="checkbox" id="dw_${id}" ${config.includes(id)?'checked':''}
        style="width:18px;height:18px;flex-shrink:0;cursor:pointer">
      <label for="dw_${id}" style="flex:1;cursor:pointer">
        <div style="font-weight:600;font-size:0.9rem">${w.label}</div>
        <div style="font-size:0.78rem;color:var(--text3)">${w.descricao}</div>
      </label>
    </div>
  `).join('');

  // Configurar atalhos
  const atalhosContainer = document.getElementById('dashAtalhosConfig');
  if (atalhosContainer) {
    const todosAtalhos = {
      'adiantamento': '💵 Adiantamento Salarial',
      'adiantamento_lote': '📋 Adiantamentos em Lote',
      'acerto': '🤝 Novo Acerto de Contas Pessoais',
      'par': '🔗 Novo Par',
      'emprestimo': '💰 Novo Empréstimo a Funcionários',
      'folha': '📋 Folha de Pagamento',
      'funcionario': '👤 Novo Funcionário',
      'cargo': '👔 Novo Cargo',
      'calculadora': '🧮 Calculadora',
      'contrato': '📝 Novo Contrato',
      'escala': '🗓️ Assistente de Escala',
      'relatorio': '📊 Relatório',
    };
    const atalhosSel = JSON.parse(localStorage.getItem('cgAtalhosDash') || 'null') ||
      ['adiantamento','adiantamento_lote','acerto','par','emprestimo','folha'];
    atalhosContainer.innerHTML = Object.entries(todosAtalhos).map(([id, label]) => `
      <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg2);border-radius:8px;cursor:pointer;font-size:0.82rem;border:1px solid ${atalhosSel.includes(id)?'var(--accent)':'var(--border)'}">
        <input type="checkbox" id="da_${id}" ${atalhosSel.includes(id)?'checked':''}
          onchange="this.closest('label').style.borderColor=this.checked?'var(--accent)':'var(--border)'">
        ${label}
      </label>`).join('');
  }
}

function salvarDashboard() {
  const config = Object.keys(DASH_WIDGETS).filter(id => {
    const cb = document.getElementById(`dw_${id}`);
    return cb?.checked;
  });
  salvarDashConfig(config);
  // Salvar atalhos selecionados
  const atalhosSel = Array.from(document.querySelectorAll('[id^="da_"]:checked')).map(cb => cb.id.replace('da_',''));
  if (atalhosSel.length > 0) localStorage.setItem('cgAtalhosDash', JSON.stringify(atalhosSel));
  closeModal('modal-dash-config');
  renderDashboard();
  toast('Dashboard personalizado!', 'success');
}

function resetarDashboard() {
  localStorage.removeItem('cgDashConfig');
  openDashConfig();
  toast('Configuração resetada para o padrão', 'info');
}


// =====================================================
// EXPORTAR ACERTO DE CONTAS
// =====================================================
function setExportPeriodo(tipo) {
  const parId = document.getElementById('exportAcertoParId').value;
  const par = acertoPares.find(p => p.id === parId);
  const hoje = new Date();
  if (tipo === 'aberto') {
    // Após última consolidação
    const desde = par?.consolidadoEm || '';
    document.getElementById('exportAcertoDe').value = desde;
    document.getElementById('exportAcertoAte').value = '';
  } else if (tipo === 'este_mes') {
    document.getElementById('exportAcertoDe').value = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
    document.getElementById('exportAcertoAte').value = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10);
  } else if (tipo === 'mes_passado') {
    document.getElementById('exportAcertoDe').value = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1).toISOString().slice(0,10);
    document.getElementById('exportAcertoAte').value = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0,10);
  } else {
    document.getElementById('exportAcertoDe').value = '';
    document.getElementById('exportAcertoAte').value = '';
  }
}

function abrirExportarAcerto(parId) {
  document.getElementById('exportAcertoParId').value = parId;
  // Datas padrão: último mês
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  document.getElementById('exportAcertoDe').value = primeiroDia.toISOString().slice(0,10);
  document.getElementById('exportAcertoAte').value = ultimoDia.toISOString().slice(0,10);
  openModal('modal-exportar-acerto');
}

function filtrarLancamentosExport() {
  const parId = document.getElementById('exportAcertoParId').value;
  const de = document.getElementById('exportAcertoDe').value;
  const ate = document.getElementById('exportAcertoAte').value;
  return lancamentosCache
    .filter(l => {
      if (l.parId !== parId) return false;
      if (de && l.data && l.data < de) return false;
      if (ate && l.data && l.data > ate) return false;
      return true;
    })
    .sort((a,b) => (a.data||'').localeCompare(b.data||''));
}

function exportarAcertoExcel() {
  if (typeof XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'error'); return; }
  const parId = document.getElementById('exportAcertoParId').value;
  const par = acertoPares.find(p => p.id === parId);
  if (!par) return;
  const lances = filtrarLancamentosExport();
  const data = lances.map(l => ({
    'Data': l.data || '',
    'De (quem deve)': l.de || '',
    'Categoria': l.categoria || '',
    'Descrição': l.descricao || '',
    'Valor (R$)': (l.valor||0).toFixed(2).replace('.',',')
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  const nomeAba = `${par.pessoaA}_${par.pessoaB}`.substring(0,28);
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  XLSX.writeFile(wb, `AcertoContas_${par.pessoaA}_${par.pessoaB}.xlsx`);
  closeModal('modal-exportar-acerto');
  toast('Excel exportado!', 'success');
}

function exportarAcertoPDF() {
  const parId = document.getElementById('exportAcertoParId').value;
  const par = acertoPares.find(p => p.id === parId);
  if (!par) return;
  const lances = filtrarLancamentosExport();
  const de = document.getElementById('exportAcertoDe').value;
  const ate = document.getElementById('exportAcertoAte').value;

  const datasOrd = lances.map(l => l.data).filter(Boolean).sort();
  const hojeStr = new Date().toISOString().slice(0,10);
  const primeiroData = datasOrd[0];
  const ultimoData = datasOrd.length ? datasOrd[datasOrd.length - 1] : '';

  let labelPeriodo;
  let subPeriodo = '';
  if (de && ate) {
    labelPeriodo = `${fmtData(de)} a ${fmtData(ate)}`;
  } else if (de && !ate) {
    labelPeriodo = 'Periodo em aberto';
    const fimExib = ultimoData || hojeStr;
    subPeriodo = `Inicio do periodo: ${fmtData(de)}   Fim do periodo: ${fmtData(fimExib)}`;
  } else {
    labelPeriodo = 'Historico completo';
    if (primeiroData && ultimoData) {
      subPeriodo = `De ${fmtData(primeiroData)} a ${fmtData(ultimoData)}`;
    }
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210;
  const PH = 297;
  const ML = 18;
  const MR = 195;
  const CW = MR - ML;
  const ABA_W = 12;

  const NAVY  = [22, 42, 100];
  const GREEN = [40, 160, 80];
  const BLUE  = [50, 120, 200];
  const ORANGE= [220, 140, 20];
  const PURPLE= [100, 80, 160];
  const GRAY  = [108, 112, 120];
  const LGRAY = [245, 247, 250];
  const TEXT  = [30, 35, 50];
  const WHITE = [255,255,255];

  function t(str) {
    return (str||'').replace(/[\u0080-\uffff]/g, c => {
      const m = {
        '\u00e7':'c','\u00c7':'C','\u00e3':'a','\u00c3':'A','\u00e1':'a','\u00e9':'e',
        '\u00ed':'i','\u00f3':'o','\u00fa':'u','\u00c1':'A','\u00c9':'E','\u00cd':'I',
        '\u00d3':'O','\u00da':'U','\u00e2':'a','\u00ea':'e','\u00f4':'o','\u00c2':'A',
        '\u00ca':'E','\u00d4':'O','\u00e0':'a','\u00f5':'o','\u00d5':'O','\u2194':' x ',
        '\u00b0':'o','\u00ba':'o','\u00aa':'a',
      };
      return m[c]||'';
    });
  }

  const lancesA = lances.filter(l => acertoNomeIgual(l.de, par.pessoaA));
  const lancesB = lances.filter(l => acertoNomeIgual(l.de, par.pessoaB));
  const totalA  = lancesA.reduce((s,l) => s + (Number(l.valor) || 0), 0);
  const totalB  = lancesB.reduce((s,l) => s + (Number(l.valor) || 0), 0);
  const saldo   = totalA - totalB;
  const devedor = saldo > 0 ? par.pessoaA : par.pessoaB;
  const credor  = saldo > 0 ? par.pessoaB : par.pessoaA;
  const quitado = Math.abs(saldo) < 0.01;

  let pageNum = 0;

  function novaPageLayout() {
    pageNum++;
    if (pageNum > 1) doc.addPage();

    doc.setFillColor(252, 251, 248);
    doc.rect(0, 0, PW, PH, 'F');

    doc.setFillColor(180, 185, 195);
    for (let sy = 14; sy < PH - 10; sy += 8.5) {
      doc.circle(8, sy, 2, 'F');
    }
    doc.setDrawColor(200, 205, 210);
    doc.setLineWidth(0.3);
    doc.line(8, 10, 8, PH - 10);

    doc.setDrawColor(225, 228, 235);
    doc.setLineWidth(0.3);
    doc.line(MR, 0, MR, PH);

    const abas = [
      { label: 'RESUMO', cor: GREEN,  y: 30 },
      { label: t(par.pessoaA).substring(0,10), cor: BLUE,   y: 78 },
      { label: t(par.pessoaB).substring(0,10), cor: ORANGE, y: 126 },
      { label: 'HISTORICO', cor: PURPLE, y: 174 },
      { label: 'DETALHES',  cor: GRAY,   y: 222 },
    ];
    abas.forEach(a => {
      doc.setFillColor(...a.cor);
      if (typeof doc.roundedRect === 'function') doc.roundedRect(MR, a.y, ABA_W + 2, 40, 2, 2, 'F');
      else doc.rect(MR, a.y, ABA_W + 2, 40, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica','bold');
      doc.setFontSize(6.5);
      try {
        doc.text(a.label, MR + ABA_W / 2 + 1, a.y + 20, { align:'center', angle: 90 });
      } catch (e) {
        doc.text(a.label, MR + 2, a.y + 20);
      }
    });

    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(0.4);
    doc.line(ML, PH - 20, MR, PH - 20);
  }

  function desenharRodape() {
    const ry = PH - 17;
    doc.setFillColor(...LGRAY);
    doc.rect(ML, ry, CW, 14, 'F');
    doc.setDrawColor(210, 215, 225);
    doc.setLineWidth(0.3);
    doc.rect(ML, ry, CW, 14, 'S');

    doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text('Caderno', ML + 4, ry + 5.5);
    doc.setTextColor(...GREEN);
    doc.text('Gestor', ML + 4 + doc.getTextWidth('Caderno') + 0.5, ry + 5.5);

    doc.setFont('helvetica','italic'); doc.setFontSize(6); doc.setTextColor(120,125,140);
    doc.text('Saia do papel. Sem sair do caderno.', ML + 4, ry + 10.5);

    const cols = [
      ['Seguranca', 'Seus dados protegidos com confianca.'],
      ['Acessivel',  'De onde estiver, quando precisar.'],
      ['Organizacao','Tudo em um so lugar, do seu jeito.'],
    ];
    cols.forEach((col, i) => {
      const cx = ML + 45 + i * 42;
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...NAVY);
      doc.text(col[0], cx, ry + 5.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(110,115,130);
      doc.text(col[1], cx, ry + 9.5);
    });

    doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(150,155,165);
    doc.text(`Pag. ${pageNum}`, MR - 8, ry + 8, {align:'right'});
  }

  novaPageLayout();
  let y = 12;

  doc.setFillColor(...WHITE);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, 62, 22, 2, 2, 'F');
  else doc.rect(ML, y, 62, 22, 'F');
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, 62, 22, 2, 2, 'S');
  else doc.rect(ML, y, 62, 22, 'S');

  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...NAVY);
  doc.text('Caderno', ML + 8, y + 9);
  doc.setTextColor(...GREEN);
  doc.text('Gestor', ML + 8 + doc.getTextWidth('Caderno') + 0.5, y + 9);
  doc.setFont('helvetica','italic'); doc.setFontSize(6); doc.setTextColor(130,135,150);
  doc.text('Saia do papel. Sem sair do caderno.', ML + 8, y + 15);

  const titX = ML + 68, titW = 62;
  doc.setFillColor(...LGRAY);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(titX, y, titW, 22, 2, 2, 'F');
  else doc.rect(titX, y, titW, 22, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...NAVY);
  doc.text('RELATORIO', titX + titW/2, y + 10, {align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text('ACERTO DE CONTAS PESSOAIS', titX + titW/2, y + 16, {align:'center'});

  const metX = titX + titW + 4, metW = MR - metX;
  doc.setFillColor(...LGRAY);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(metX, y, metW, 22, 2, 2, 'F');
  else doc.rect(metX, y, metW, 22, 'F');

  const hoje = new Date();
  const hojeDataStr = hoje.toLocaleDateString('pt-BR');
  const horaStr = hoje.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

  doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...TEXT);
  doc.text('Periodo:', metX + 3, y + 5);
  doc.setFont('helvetica','normal'); doc.setTextColor(...GRAY);
  doc.text(t(labelPeriodo), metX + 3, y + 9);
  doc.setFont('helvetica','bold'); doc.setTextColor(...TEXT);
  doc.text('Emitido em:', metX + 3, y + 14);
  doc.setFont('helvetica','normal'); doc.setTextColor(...GRAY);
  doc.text(`${hojeDataStr} as ${horaStr}`, metX + 3, y + 18);

  y += 27;

  doc.setFillColor(...NAVY);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, CW, 16, 3, 3, 'F');
  else doc.rect(ML, y, CW, 16, 'F');
  doc.setFillColor(...GREEN);
  doc.circle(ML + 9, y + 8, 5, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...WHITE);
  doc.text(t(par.pessoaA).toUpperCase() + '  x  ' + t(par.pessoaB).toUpperCase(), ML + 18, y + 8.5);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GREEN);
  doc.text(t(subPeriodo || 'Historico completo'), ML + 18, y + 13.5);
  y += 22;

  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...TEXT);
  doc.text('RESUMO', ML, y + 5);
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.5);
  doc.line(ML, y + 7, MR, y + 7);
  y += 10;

  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAY);
  doc.text('Cada total e a soma dos valores em que essa pessoa consta em "Quem deve" (deve ao outro).', ML, y + 4);
  doc.text(`Saldo = (total ${t(par.pessoaA)}) - (total ${t(par.pessoaB)}).`, ML, y + 8);
  y += 12;

  const cardW = (CW - 6) / 3;
  const cards = [
    { cor: GREEN,  corFundo: [235,248,240], label1: 'Total que', label2: t(par.pessoaA), label3: 'deve ao outro', valor: totalA },
    { cor: BLUE,   corFundo: [235,240,252], label1: 'Total que', label2: t(par.pessoaB), label3: 'deve ao outro', valor: totalB },
    { cor: ORANGE, corFundo: [252,245,230], label1: '', label2: 'Saldo', label3: 'liquido', valor: Math.abs(saldo) },
  ];
  cards.forEach((card, i) => {
    const cx = ML + i * (cardW + 3);
    doc.setFillColor(...card.corFundo);
    if (typeof doc.roundedRect === 'function') doc.roundedRect(cx, y, cardW, 30, 3, 3, 'F');
    else doc.rect(cx, y, cardW, 30, 'F');
    doc.setDrawColor(...card.cor.map(v => Math.min(v + 30, 255)));
    doc.setLineWidth(0.4);
    if (typeof doc.roundedRect === 'function') doc.roundedRect(cx, y, cardW, 30, 3, 3, 'S');
    else doc.rect(cx, y, cardW, 30, 'S');

    doc.setFillColor(...card.cor);
    doc.circle(cx + 7, y + 8, 4, 'F');

    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...GRAY);
    if (card.label1) doc.text(card.label1, cx + 14, y + 6);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...card.cor);
    doc.text(card.label2.substring(0,14), cx + 14, y + 11);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAY);
    doc.text(card.label3, cx + 14, y + 15.5);

    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...card.cor);
    doc.text('R$ ' + fmtMoney(card.valor).replace('.',','), cx + cardW / 2, y + 25, {align:'center'});
  });
  y += 35;

  doc.setFillColor(235, 248, 240);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, CW, 11, 2, 2, 'F');
  else doc.rect(ML, y, CW, 11, 'F');
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, CW, 11, 2, 2, 'S');
  else doc.rect(ML, y, CW, 11, 'S');
  doc.setFillColor(...GREEN);
  doc.circle(ML + 6, y + 5.5, 3.5, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...WHITE);
  doc.text('v', ML + 5, y + 6.8);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...TEXT);
  const concStr = quitado
    ? 'Contas quitadas! Nenhum deve ao outro.'
    : `Conclusao: ${t(devedor)} deve R$ ${fmtMoney(Math.abs(saldo))} a ${t(credor)} (credito de quem recebe).`;
  doc.text(t(concStr), ML + 13, y + 6.5);
  y += 17;

  function renderSecao(nome, lista, corPessoa) {
    if (lista.length === 0) return;
    if (y > 220) { desenharRodape(); novaPageLayout(); y = 14; }

    const totalPessoa = lista.reduce((s,l) => s + (Number(l.valor) || 0), 0);

    doc.setFillColor(...corPessoa);
    if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, CW, 11, 2, 2, 'F');
    else doc.rect(ML, y, CW, 11, 'F');
    doc.setFillColor(...WHITE);
    doc.circle(ML + 7, y + 5.5, 3.5, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...WHITE);
    doc.text('DIVIDAS REGISTRADAS EM NOME DE ', ML + 13, y + 5);
    doc.setTextColor(255,255,180);
    doc.text(t(nome).toUpperCase(), ML + 13 + doc.getTextWidth('DIVIDAS REGISTRADAS EM NOME DE '), y + 5);
    doc.setTextColor(...WHITE);
    doc.text('Subtotal   R$ ' + fmtMoney(totalPessoa), MR - 5, y + 5, {align:'right'});
    y += 14;

    const porCat = {};
    lista.forEach(l => {
      const cat = t((l.categoria || '').trim()) || 'Sem categoria';
      if (!porCat[cat]) porCat[cat] = [];
      porCat[cat].push(l);
    });

    Object.entries(porCat).forEach(([cat, items]) => {
      if (y > 230) { desenharRodape(); novaPageLayout(); y = 14; }
      const subT = items.reduce((s,l) => s + (Number(l.valor) || 0), 0);

      doc.setFillColor(230, 235, 245);
      if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, CW, 7, 1, 1, 'F');
      else doc.rect(ML, y, CW, 7, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(60,75,130);

      const catUp = cat.toUpperCase();
      const catW = doc.getTextWidth(catUp) + 6;
      doc.setFillColor(180, 190, 220);
      if (typeof doc.roundedRect === 'function') doc.roundedRect(ML + 2, y + 1.5, catW, 4, 1, 1, 'F');
      else doc.rect(ML + 2, y + 1.5, catW, 4, 'F');
      doc.setTextColor(...WHITE);
      doc.text(catUp, ML + 5, y + 4.8);

      doc.setTextColor(60,75,130);
      doc.text('R$ ' + fmtMoney(subT), MR - 4, y + 4.8, {align:'right'});
      y += 8;

      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...GRAY);
      doc.text('DATA', ML + 4, y + 4);
      doc.text('DESCRICAO', ML + 30, y + 4);
      doc.text('VALOR', MR - 4, y + 4, {align:'right'});
      doc.setDrawColor(200, 205, 215);
      doc.setLineWidth(0.3);
      doc.line(ML, y + 5.5, MR, y + 5.5);
      y += 7;

      items.forEach((l, i) => {
        if (y > 265) { desenharRodape(); novaPageLayout(); y = 14; }
        if (i % 2 === 0) {
          doc.setFillColor(250, 251, 253);
          doc.rect(ML, y - 1, CW, 7.5, 'F');
        }
        doc.setFillColor(210, 220, 240);
        if (typeof doc.roundedRect === 'function') doc.roundedRect(ML + 2, y + 0.5, 4, 4, 0.5, 0.5, 'F');
        else doc.rect(ML + 2, y + 0.5, 4, 4, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(5); doc.setTextColor(80,100,160);
        doc.text('31', ML + 3, y + 3.8);

        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...TEXT);
        doc.text(l.data ? fmtData(l.data) : '', ML + 8, y + 4.5);
        const desc = t(l.descricao || '-');
        doc.text(desc.substring(0,38), ML + 30, y + 4.5);
        doc.setFont('helvetica','bold'); doc.setTextColor(...GREEN);
        doc.text('R$ ' + fmtMoney(Number(l.valor) || 0), MR - 4, y + 4.5, {align:'right'});
        doc.setTextColor(...TEXT);
        y += 7.5;
      });

      doc.setDrawColor(220, 225, 235);
      doc.setLineWidth(0.2);
      doc.line(ML, y, MR, y);
      y += 5;
    });

    y += 4;
  }

  renderSecao(par.pessoaA, lancesA, NAVY);
  renderSecao(par.pessoaB, lancesB, [80, 100, 170]);

  if (y > 235) { desenharRodape(); novaPageLayout(); y = 14; }
  y += 4;

  doc.setFillColor(235, 248, 240);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, CW, 28, 3, 3, 'F');
  else doc.rect(ML, y, CW, 28, 'F');
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  if (typeof doc.roundedRect === 'function') doc.roundedRect(ML, y, CW, 28, 3, 3, 'S');
  else doc.rect(ML, y, CW, 28, 'S');

  doc.setFillColor(...GREEN);
  doc.circle(ML + 12, y + 14, 8, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...WHITE);
  doc.text('R$', ML + 9.5, y + 15.5);

  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...TEXT);
  doc.text('SALDO LIQUIDO', ML + 24, y + 8);
  doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(...NAVY);
  const devedorStr = quitado ? 'Contas quitadas!' : `${t(devedor)} deve`;
  doc.text(devedorStr, ML + 24, y + 17);
  if (!quitado) {
    doc.setFontSize(18); doc.setTextColor(...GREEN);
    doc.text('R$ ' + fmtMoney(Math.abs(saldo)), ML + 24, y + 25);
  }

  if (!quitado) {
    doc.setFillColor(210, 240, 220);
    if (typeof doc.roundedRect === 'function') doc.roundedRect(MR - 55, y + 4, 50, 18, 2, 2, 'F');
    else doc.rect(MR - 55, y + 4, 50, 18, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(50, 100, 60);
    doc.text(`Base: soma do que ${t(par.pessoaA)}`, MR - 53, y + 9);
    doc.text('deve ao outro menos soma do que', MR - 53, y + 13);
    doc.text(`${t(par.pessoaB)} deve ao outro.`, MR - 53, y + 17);
    doc.setFillColor(...GREEN);
    doc.circle(MR - 6, y + 22, 3.5, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...WHITE);
    doc.text('v', MR - 7.5, y + 23.5);
  }

  desenharRodape();

  doc.save('AcertoContas_' + t(par.pessoaA) + '_' + t(par.pessoaB) + '.pdf');
  closeModal('modal-exportar-acerto');
  toast('PDF exportado!', 'success');
}

// Velha função mantida por compatibilidade
async function exportarAcertoPar(parId) {
  abrirExportarAcerto(parId);
}


// =====================================================
// PÁGINA INDIVIDUAL DO PAR
// =====================================================
let parAtualId = null;

function decodeHtml(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str || '';
  return txt.value;
}

function abrirPaginaPar(parId) {
  parAtualId = parId;
  const par = acertoPares.find(p => p.id === parId);
  if (!par) return;
  // Decodificar HTML entities nos nomes
  par.pessoaA = decodeHtml(par.pessoaA);
  par.pessoaB = decodeHtml(par.pessoaB);

  document.getElementById('parPageTitulo').textContent = `${par.pessoaA} ↔ ${par.pessoaB}`;

  // Configurar botões do header
  document.getElementById('parLancarBtn').onclick = () => openLancamentoPar(parId);
  document.getElementById('parExportBtn').onclick = () => abrirExportarAcerto(parId);
  document.getElementById('parConsolidarBtn').onclick = () => consolidarPeriodoPar(parId);
  document.getElementById('parExcluirBtn').onclick = () => excluirPar(parId);

  renderParPage(parId);
  navigate('acerto-par');
}

function acertoCatHue(str) {
  let h = 0;
  const s = str || '';
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h) % 360;
}

function acertoCatBadgeHtml(cat) {
  const c = (cat || '').trim();
  if (!c) return '<span class="cat-badge-acerto" style="background:#e8eaed;color:#5f6368">Sem categoria</span>';
  const hue = acertoCatHue(c);
  return `<span class="cat-badge-acerto" style="background:hsla(${hue},42%,90%,1);color:hsla(${hue},55%,26%,1);border:1px solid hsla(${hue},35%,78%,1)">${escapeHtml(c)}</span>`;
}

async function renderParPage(parId) {
  // Recarregar lançamentos antes de renderizar
  try {
    if (db && currentOrg) {
      const snap = await db.collection('orgs').doc(currentOrg.id).collection('lancamentos').get();
      lancamentosCache = snap.docs.map(d => ({id: d.id, ...d.data()}));
    }
  } catch(e) { /* usar cache */ }
  const par = acertoPares.find(p => p.id === parId);
  if (!par) return;

  const periodoAtual = par.consolidadoEm || null;
  const todosLances = lancamentosCache.filter(l => l.parId === parId);
  const lancesAtivos = todosLances.filter(l => {
    if (!periodoAtual) return true;
    if (!l.data) return true;
    return l.data > periodoAtual;
  }).sort((a,b) => (b.data||'').localeCompare(a.data||''));

  const devidoPorA = acertoSomaOndeDeve(lancesAtivos, par.pessoaA);
  const devidoPorB = acertoSomaOndeDeve(lancesAtivos, par.pessoaB);
  const saldo = devidoPorA - devidoPorB;
  const devedor = saldo > 0 ? par.pessoaA : par.pessoaB;
  const credor  = saldo > 0 ? par.pessoaB : par.pessoaA;
  const quitado = Math.abs(saldo) < 0.01;

  // Subtítulo
  document.getElementById('parPageSaldo').textContent = quitado
    ? '✅ Sem pendências no período atual'
    : `${devedor} deve R$ ${fmtMoney(Math.abs(saldo))} a ${credor}`;

  document.getElementById('parCards').innerHTML = `
    <div class="stat-card par-stat-card par-stat-card--a">
      <div class="stat-label">TOTAL QUE ${escapeHtml(par.pessoaA)} DEVE:</div>
      <div class="stat-value red" style="font-size:1.25rem;margin-top:6px">R$ ${fmtMoney(devidoPorA)}</div>
    </div>
    <div class="stat-card par-stat-card par-stat-card--b">
      <div class="stat-label">TOTAL QUE ${escapeHtml(par.pessoaB)} DEVE:</div>
      <div class="stat-value red" style="font-size:1.25rem;margin-top:6px">R$ ${fmtMoney(devidoPorB)}</div>
    </div>
    <div class="stat-card par-stat-card par-stat-card--diff">
      <div class="stat-label">DIFERENÇA</div>
      <div class="stat-value ${quitado?'green':'yellow'}" style="font-size:1.35rem;margin-top:6px">R$ ${fmtMoney(Math.abs(saldo))}</div>
      <div class="stat-sub">${quitado ? 'Nenhuma diferença entre as partes' : `${escapeHtml(devedor)} deve a ${escapeHtml(credor)}`}</div>
    </div>
    <div class="stat-card par-stat-card par-stat-card--count">
      <div class="stat-label">LANÇAMENTOS</div>
      <div class="stat-value accent" style="margin-top:6px">${lancesAtivos.length}</div>
    </div>
  `;

  renderParLancamentos();
  renderParConsolidacoes(parId);
}

function renderParLancamentos() {
  const par = acertoPares.find(p => p.id === parAtualId);
  if (!par) return;
  const filtroDe = document.getElementById('parFiltroDe')?.value || '';
  const filtroAte = document.getElementById('parFiltroAte')?.value || '';
  const periodoAtual = par.consolidadoEm || null;

  let lances = lancamentosCache.filter(l => {
    if (l.parId !== parAtualId) return false;
    if (!periodoAtual) return true;
    if (!l.data) return true;
    return l.data > periodoAtual;
  });

  if (filtroDe) lances = lances.filter(l => !l.data || l.data >= filtroDe);
  if (filtroAte) lances = lances.filter(l => !l.data || l.data <= filtroAte);

  lances.sort((a,b) => (b.data||'').localeCompare(a.data||''));

  const el = document.getElementById('parLancamentosList');
  if (!el) return;

  if (lances.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Nenhum lançamento no período.</p>';
    return;
  }

  el.innerHTML = `<div class="par-lanc-table-wrap"><table>
    <thead><tr>
      <th>Data</th><th>Quem deve</th><th>Categoria</th><th>Descrição</th>
      <th style="text-align:right">Valor</th><th style="width:92px;text-align:right">Ações</th>
    </tr></thead>
    <tbody>${lances.map(l => `<tr>
      <td style="font-size:0.8rem">${l.data?fmtData(l.data):''}</td>
      <td><span style="font-weight:600;color:var(--red)">${escapeHtml(l.de||'')}</span></td>
      <td>${acertoCatBadgeHtml(l.categoria)}</td>
      <td>${escapeHtml(l.descricao||'')}</td>
      <td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--green)">R$ ${fmtMoney(l.valor)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button type="button" class="btn-icon" title="Editar" onclick="editarLancamentoPar('${escapeAttr(l.id)}')">✏️</button>
        <button type="button" class="btn-icon" title="Excluir" onclick="excluirLancamentoParPage('${escapeAttr(l.id)}')">🗑️</button>
      </td>
    </tr>`).join('')}
    </tbody>
  </table></div>`;
}

async function excluirLancamentoParPage(lancId) {
  if (!await confirmar('Excluir lançamento?', 'Esta ao no pode ser desfeita.')) return;
  if (db && currentOrg) {
    await db.collection('orgs').doc(currentOrg.id).collection('lancamentos').doc(lancId).delete();
  } else {
    getCol('lancamentos').delete(lancId);
  }
  lancamentosCache = lancamentosCache.filter(l => l.id !== lancId);
  renderParPage(parAtualId);
  renderAcerto();
  toast('Lançamento excluído', 'success');
}

function renderParConsolidacoes(parId) {
  const par = acertoPares.find(p => p.id === parId);
  if (!par) return;
  const el = document.getElementById('parConsolidacoes');
  if (!el) return;
  const consolidacoes = (par.consolidacoes || []).sort((a,b) => (b.data||'').localeCompare(a.data||''));
  if (consolidacoes.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:0.82rem">Nenhuma consolidação ainda.</p>';
    return;
  }
  el.innerHTML = consolidacoes.map(c => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:6px">
      <div style="font-size:1.2rem">🏁</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:0.88rem">Período consolidado em ${fmtData(c.data)}</div>
        <div style="font-size:0.78rem;color:var(--text3)">
          ${c.pessoaA} devia R$ ${fmtMoney(c.devidoA)}  ${c.pessoaB} devia R$ ${fmtMoney(c.devidoB)}
           Saldo quitado: R$ ${fmtMoney(c.saldo)}
        </div>
      </div>
      <span class="badge badge-green">Quitado</span>
    </div>`).join('');
}

async function consolidarPeriodoPar(parId) {
  const par = acertoPares.find(p => p.id === parId);
  if (!par) return;

  const periodoAtual = par.consolidadoEm || null;
  const lancesAtivos = lancamentosCache.filter(l => {
    if (l.parId !== parId) return false;
    if (!periodoAtual) return true;
    if (!l.data) return true;
    return l.data > periodoAtual;
  });

  const devidoPorA = acertoSomaOndeDeve(lancesAtivos, par.pessoaA);
  const devidoPorB = acertoSomaOndeDeve(lancesAtivos, par.pessoaB);
  const saldo = Math.abs(devidoPorA - devidoPorB);

  if (lancesAtivos.length === 0) { toast('Nenhum lançamento ativo para consolidar', 'error'); return; }

  const ok = await confirmar(
    '✅ Consolidar período?',
    `Isso irá zerar o saldo atual entre ${par.pessoaA} e ${par.pessoaB}.

` +
    `${par.pessoaA} deve: R$ ${fmtMoney(devidoPorA)}
` +
    `${par.pessoaB} deve: R$ ${fmtMoney(devidoPorB)}
` +
    `Saldo líquido: R$ ${fmtMoney(saldo)}

` +
    `Os lançamentos anteriores ficam no histórico mas não contam mais para o saldo.`
  );
  if (!ok) return;

  const hoje = new Date().toISOString().slice(0,10);
  const novaConsolidacao = {
    data: hoje, pessoaA: par.pessoaA, pessoaB: par.pessoaB,
    devidoA: devidoPorA, devidoB: devidoPorB, saldo
  };
  const consolidacoes = [...(par.consolidacoes||[]), novaConsolidacao];
  const updates = { consolidadoEm: hoje, consolidacoes };

  if (db && currentOrg) {
    await db.collection('orgs').doc(currentOrg.id).collection('acertoPares').doc(parId).update(updates);
  } else {
    getCol('acertoPares').update(parId, updates);
  }
  const idx = acertoPares.findIndex(p=>p.id===parId);
  if (idx>=0) Object.assign(acertoPares[idx], updates);

  const parBackup = {...acertoPares.find(p=>p.id===parId)};
  const consolidacoesAntes = parBackup.consolidacoes ? [...parBackup.consolidacoes.slice(0,-1)] : [];
  pushUndo({ descricao: `Consolidar período ${par.pessoaA} ↔ ${par.pessoaB}`, reverter: async () => {
    const reverts = { consolidadoEm: consolidacoesAntes.length > 0 ? consolidacoesAntes[consolidacoesAntes.length-1]?.data||null : null, consolidacoes: consolidacoesAntes };
    if (db && currentOrg) await db.collection('orgs').doc(currentOrg.id).collection('acertoPares').doc(parId).update(reverts);
    else getCol('acertoPares').update(parId, reverts);
    const pidx = acertoPares.findIndex(p=>p.id===parId);
    if (pidx>=0) Object.assign(acertoPares[pidx], reverts);
    renderParPage(parId); renderAcerto();
  }});
  renderParPage(parId);
  renderAcerto();
  toast('Período consolidado! (desfazer disponível)', 'success');
}


// =====================================================
// ESCALA  seleo para imprimir/baixar
// =====================================================
function renderEscalaCheckList() {
  if (!escalaGerada) return;
  const el = document.getElementById('escalaCheckList');
  const selEl = document.getElementById('escalaSelecao');
  const btnsEl = document.getElementById('escalaBotoesPos');
  if (!el) return;
  if (selEl) selEl.style.display = 'block';
  if (btnsEl) btnsEl.style.display = 'flex';
  el.innerHTML = escalaGerada.equipe.map(item => `
    <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg2);border-radius:8px;cursor:pointer">
      <input type="checkbox" id="escCb_${item.funcionario.id}" checked style="width:16px;height:16px">
      <span style="font-size:0.85rem">${item.funcionario.nome}</span>
      <span style="font-size:0.75rem;color:var(--text3)">${item.totalHorasMes}h (${item.totalExtrasMes}h extras)</span>
    </label>
  `).join('');
}

function toggleTodosEscala(checked) {
  document.querySelectorAll('[id^="escCb_"]').forEach(cb => cb.checked = checked);
}

function getEscalaSelecionados() {
  if (!escalaGerada) return [];
  return escalaGerada.equipe.filter(item => {
    const cb = document.getElementById(`escCb_${item.funcionario.id}`);
    return !cb || cb.checked;
  });
}

function printEscalasSelecionadas() {
  const selecionados = getEscalaSelecionados();
  if (!selecionados.length) { toast('Selecione ao menos um funcionário', 'error'); return; }
  if (selecionados.length === 1) {
    printEscalaFuncionario(selecionados[0].funcionario.id);
    return;
  }
  printTodasEscalas(selecionados);
}

function downloadEscalasSelecionadasPdf() {
  const selecionados = getEscalaSelecionados();
  if (!selecionados.length) { toast('Selecione ao menos um funcionário', 'error'); return; }
  if (selecionados.length === 1) {
    downloadEscalaPdfFuncionario(selecionados[0].funcionario.id);
    return;
  }
  downloadTodasEscalasPdf(selecionados);
}

// =====================================================
// FILTROS PERODO  Acerto de Contas
// =====================================================
function filtrarParPeriodo(tipo) {
  const hoje = new Date();
  let de, ate;
  if (tipo === 'este_mes') {
    de = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    ate = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0);
  } else if (tipo === 'mes_passado') {
    de = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1);
    ate = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  } else if (tipo === 'este_ano') {
    de = new Date(hoje.getFullYear(), 0, 1);
    ate = new Date(hoje.getFullYear(), 11, 31);
  } else {
    document.getElementById('parFiltroDe').value = '';
    document.getElementById('parFiltroAte').value = '';
    renderParLancamentos();
    return;
  }
  document.getElementById('parFiltroDe').value = de.toISOString().slice(0,10);
  document.getElementById('parFiltroAte').value = ate.toISOString().slice(0,10);
  renderParLancamentos();
}

// =====================================================
// UNDO GLOBAL  boto flutuante em TODAS as aes
// =====================================================
function pushUndoGlobal(descricao, reverterFn) {
  pushUndo({ descricao, reverter: reverterFn });
}

// Wrapper para excluir com undo
async function excluirComUndo(descricao, deleteFn, undoFn) {
  await deleteFn();
  pushUndoGlobal(descricao, undoFn);
}

// =====================================================
// VOLTAR AO TOPO  boto flutuante
// =====================================================
function adicionarBotaoTopo() {
  if (document.getElementById('btnVoltarTopo')) return;
  const btn = document.createElement('button');
  btn.id = 'btnVoltarTopo';
  btn.innerHTML = '▲';
  btn.title = 'Voltar ao topo';
  btn.style.cssText = 'position:fixed;bottom:16px;right:16px;width:42px;height:42px;border-radius:50%;background:var(--navy);color:white;border:none;font-size:1rem;cursor:pointer;z-index:8999;box-shadow:0 4px 14px rgba(0,0,0,0.3);display:none;font-family:var(--font)';
  btn.onclick = () => window.scrollTo({top:0,behavior:'smooth'});
  document.body.appendChild(btn);
  window.addEventListener('scroll', () => {
    btn.style.display = window.scrollY > 200 ? 'flex' : 'none';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
  });
}
document.addEventListener('DOMContentLoaded', adicionarBotaoTopo);

function exportFuncionariosPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const lm = 14, pw = 182, rm = lm + pw;
  let y = 14;
  doc.setFillColor(27,45,107); doc.rect(lm, y, pw, 18, 'FD');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text('RELATÓRIO DE FUNCIONÁRIOS', lm+6, y+8);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text(`${currentOrg?.nome||''}  ${new Date().toLocaleDateString('pt-BR')}`, lm+6, y+14);
  doc.setTextColor(30,30,45); y += 24;

  doc.setFillColor(46,158,79); doc.rect(lm, y, pw, 8, 'FD');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  ['NOME','CPF','CARGO','SALÁRIO','STATUS'].forEach((h, i) => {
    const xs = [lm+3, lm+55, lm+90, lm+140, lm+168];
    doc.text(h, xs[i], y+5.5);
  });
  doc.setTextColor(30,30,45); y += 8;

  funcionarios.forEach((f, i) => {
    const grupo = grupos.find(g => g.id === f.grupoId);
    doc.setFillColor(i%2===0?255:248, i%2===0?255:250, i%2===0?255:255);
    doc.rect(lm, y, pw, 7, 'FD');
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text((f.nome||'').substring(0,24), lm+3, y+5);
    doc.text(f.cpf||'', lm+55, y+5);
    doc.text(getNomeCargo(f).substring(0,18), lm+90, y+5);
    doc.setFont('helvetica','bold'); doc.setTextColor(46,158,79);
    doc.text(`R$ ${fmtMoney(f.salario||0)}`, lm+140, y+5);
    doc.setTextColor(f.ativo!==false?46:200, f.ativo!==false?158:30, f.ativo!==false?79:30);
    doc.text(f.ativo!==false?'Ativo':'Inativo', lm+168, y+5);
    doc.setTextColor(30,30,45); y += 7;
    if (y > 270) { doc.addPage(); y = 14; }
  });

  doc.save('Funcionarios.pdf');
  toast('PDF exportado!', 'success');
}


// =====================================================
// CALCULADORA  FITA DE PAPEL
// =====================================================
let calcEstado = {
  display: '0',
  acumulador: null,
  operacao: null,
  novoNumero: true,
  fita: [],
  totalAtual: 0
};

function calcNum(n) {
  if (n === ',' || n === '.') {
    if (calcEstado.display.includes(',')) return;
    if (calcEstado.novoNumero) { calcEstado.display = '0,'; calcEstado.novoNumero = false; return calcRender(); }
    calcEstado.display += ',';
  } else {
    if (calcEstado.novoNumero) { calcEstado.display = n; calcEstado.novoNumero = false; }
    else { if (calcEstado.display === '0') calcEstado.display = n; else calcEstado.display += n; }
  }
  calcRender();
}

function calcValor() {
  return parseFloat(calcEstado.display.replace(',','.')) || 0;
}

function calcFn(op) {
  const val = calcValor();
  const desc = ''; // descrição agora é inline na fita

  if (op === 'C') {
    // C: limpa só o número atual
    calcEstado.display = '0'; calcEstado.novoNumero = true; calcRender(); return;
  }
  if (op === 'CE') {
    // CE: limpa display E operação pendente (mantém fita)
    calcEstado.display = '0'; calcEstado.acumulador = null; calcEstado.operacao = null;
    calcEstado.novoNumero = true;
    document.getElementById('calcOpDisplay').textContent = '';
    calcRender(); return;
  }
  if (op === 'CF') {
    // CF: limpa a fita inteira
    calcNova(); return;
  }

  if (op === '%') {
    const pct = calcEstado.acumulador !== null ? calcEstado.acumulador * val / 100 : val / 100;
    calcEstado.display = String(pct).replace('.',',');
    calcRender(); return;
  }

  if (op === 'subtotal') {
    calcEstado.fita.push({ tipo:'subtotal', valor: calcEstado.totalAtual, desc: 'Subtotal' });
    calcRenderFita(); return;
  }

  if (['+','-','×','÷'].includes(op)) {
    if (calcEstado.operacao && !calcEstado.novoNumero) {
      // Executar operação anterior
      calcExecutar(val, desc);
    } else {
      if (calcEstado.acumulador === null) {
        calcEstado.acumulador = val;
        calcEstado.totalAtual = val;
        calcEstado.fita.push({ tipo: 'entrada', op: '', valor: val, desc: '' });
        calcRenderFita();
      }
    }
    calcEstado.operacao = op;
    calcEstado.novoNumero = true;
    document.getElementById('calcOpDisplay').textContent = `${fmtMoney(calcEstado.acumulador)} ${op}`;
    calcRender(); return;
  }

  if (op === '=') {
    if (calcEstado.operacao && !calcEstado.novoNumero) {
      calcExecutar(val, desc);
    }
    calcEstado.operacao = null;
    calcEstado.novoNumero = true;
    document.getElementById('calcOpDisplay').textContent = '';
    calcRender();
  }
}

function calcExecutar(val, desc) {
  const acc = calcEstado.acumulador;
  const opSim = calcEstado.operacao;
  let resultado = acc;
  if (opSim === '+') resultado = acc + val;
  if (opSim === '-') resultado = acc - val;
  if (opSim === '×') resultado = acc * val;
  if (opSim === '') resultado = val !== 0 ? acc / val : 0;

  calcEstado.fita.push({ tipo:'entrada', op: opSim, valor: val, resultado, desc: '' });
  calcEstado.acumulador = resultado;
  calcEstado.totalAtual = resultado;
  calcEstado.display = String(Math.round(resultado*100)/100).replace('.',',');
  calcRenderFita();
}

function calcFormatDisplay(str) {
  // Formatar número enquanto digita: 1500 → 1.500
  if (!str || str === '0') return '0';
  const negative = str.startsWith('-');
  const parts = str.replace('-','').split(',');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decPart = parts[1] !== undefined ? ',' + parts[1] : '';
  return (negative ? '-' : '') + intPart + decPart;
}

function calcRender() {
  const el = document.getElementById('calcDisplay');
  const tot = document.getElementById('calcTotalDisplay');
  if (el) el.textContent = calcFormatDisplay(calcEstado.display);
  if (tot) tot.textContent = fmtMoney(calcEstado.totalAtual);
}

function calcRenderFita() {
  const el = document.getElementById('calcFita');
  if (!el) return;
  if (calcEstado.fita.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:0.82rem;text-align:center;padding:20px">Nenhuma operação ainda</p>';
    return;
  }
  el.innerHTML = calcEstado.fita.map((linha, i) => {
    if (linha.tipo === 'subtotal') {
      return `<div class="calc-linha cl-sub">
        <span class="cl-op" style="color:var(--navy)">SUB</span>
        <span class="cl-desc">Subtotal</span>
        <span class="cl-val" style="color:var(--navy)">R$ ${fmtMoney(linha.valor)}</span>
      </div>`;
    }
    const cor = linha.op==='+' ? 'var(--green)' : linha.op==='-' ? 'var(--red)' : 'var(--text)';
    return `<div class="calc-linha ${linha.resultado!==undefined?'cl-eq':''}">
      <span class="cl-op" style="color:${cor}">${linha.op||'='}</span>
      <input type="text" class="calc-desc-input" placeholder="descrição..."
        value="${linha.desc||''}"
        oninput="calcEstado.fita[${i}].desc=this.value"
        style="border:none;background:transparent;color:var(--text3);font-size:0.75rem;flex:2;outline:none;padding:0 2px">
      <span class="cl-val" style="color:${cor}">R$ ${fmtMoney(linha.valor)}</span>
      ${linha.resultado!==undefined ? `<span style="font-family:var(--mono);font-weight:700;color:var(--accent2);min-width:80px;text-align:right">= R$ ${fmtMoney(linha.resultado)}</span>` : ''}
      <button class="btn-icon" style="font-size:11px;opacity:0.5" onclick="calcRemoverLinha(${i})">✕</button>
    </div>`;
  }).join('');
  calcRender();
}

function calcRemoverLinha(idx) {
  calcEstado.fita.splice(idx, 1);
  calcRenderFita();
}

function calcNova() {
  calcEstado = { display:'0', acumulador:null, operacao:null, novoNumero:true, fita:[], totalAtual:0 };
  calcRender(); calcRenderFita();
}

function calcImprimir(tipo) {
  const orgNome = currentOrg?.nome || 'Empresa';
  const data = new Date().toLocaleDateString('pt-BR');
  const hora = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
  const total = fmtMoney(calcEstado.totalAtual);

  const linhas = calcEstado.fita.map(l => {
    if (l.tipo === 'subtotal') return `<tr style="border-top:2px solid #333"><td colspan="2" style="font-weight:bold">SUBTOTAL</td><td style="text-align:right;font-weight:bold">R$ ${fmtMoney(l.valor)}</td></tr>`;
    const cor = l.op==='+' ? 'green' : l.op==='-' ? 'red' : '#333';
    return `<tr><td style="color:${cor};font-weight:700">${l.op||'='}</td><td>${l.desc||''}</td><td style="text-align:right;color:${cor}">R$ ${fmtMoney(l.valor)}</td></tr>`;
  }).join('');

  const cupomW = tipo==='cupom' ? 'width:72mm;' : '';
  const html = `<!DOCTYPE html><html><head><title>Calculadora  ${orgNome}</title>
  <style>
    body{font-family:${tipo==='cupom'?'Courier New,monospace':'Arial,sans-serif'};${cupomW}padding:${tipo==='cupom'?'4mm':'20px'};font-size:${tipo==='cupom'?'10px':'11px'};-webkit-font-smoothing:none;font-weight:${tipo==='cupom'?'bold':'normal'}}
    table{width:100%;border-collapse:collapse}
    td{padding:${tipo==='cupom'?'2px 3px':'5px 8px'};border-bottom:1px dashed #ddd}
    .total{font-size:${tipo==='cupom'?'12px':'16px'};font-weight:700;border-top:2px solid #333;padding-top:8px}
    h3{text-align:center;margin:0 0 8px}
    .info{text-align:center;color:#666;font-size:${tipo==='cupom'?'8px':'10px'};margin-bottom:10px}
    @media print{@page{size:${tipo==='cupom'?'80mm auto':'A4'};margin:${tipo==='cupom'?'3mm':'15mm'}}}
  </style></head><body>
  <h3>${orgNome}</h3>
  <div class="info">${data} ${hora}</div>
  <table>${linhas}
    <tr class="total"><td colspan="2">TOTAL</td><td style="text-align:right">R$ ${total}</td></tr>
  </table>
  </body></html>`;

  const popup = window.open('','_blank');
  popup.document.write(html);
  popup.document.close();
  popup.onload = () => { popup.focus(); popup.print(); };
}

async function calcSalvarFita() {
  const nome = prompt('Nome para esta fita:');
  if (!nome?.trim()) return;
  const fita = {
    nome: nome.trim(),
    data: new Date().toISOString().slice(0,10),
    total: calcEstado.totalAtual,
    linhas: [...calcEstado.fita]
  };
  await fsAdd('calculadoraFitas', fita);
  toast('Fita salva!', 'success');
  renderFitasSalvas();
}

async function renderFitasSalvas() {
  const el = document.getElementById('calcFitasSalvas');
  if (!el) return;
  const fitas = await fsGetAll('calculadoraFitas');
  if (!fitas || fitas.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Nenhuma fita salva ainda.</p>';
    return;
  }
  el.innerHTML = fitas.sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(f => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:6px">
      <div style="flex:1">
        <div style="font-weight:600;font-size:0.88rem">${f.nome}</div>
        <div style="font-size:0.75rem;color:var(--text3)">${f.data?fmtData(f.data):''}  ${f.linhas?.length||0} operaes</div>
      </div>
      <div style="font-family:var(--mono);font-weight:700;color:var(--accent2)">R$ ${fmtMoney(f.total)}</div>
      <button class="btn btn-outline btn-sm" onclick="calcCarregarFita('${f.id}')">Carregar</button>
      <button class="btn-icon" onclick="calcExcluirFita('${f.id}')">🗑️</button>
    </div>`).join('');
}

async function calcCarregarFita(id) {
  const fitas = await fsGetAll('calculadoraFitas');
  const fita = fitas.find(f=>f.id===id);
  if (!fita) return;
  calcEstado.fita = fita.linhas || [];
  calcEstado.totalAtual = fita.total || 0;
  calcEstado.display = String(fita.total||0).replace('.',',');
  calcRenderFita();
  toast(`Fita "${fita.nome}" carregada!`, 'success');
}

async function calcExcluirFita(id) {
  await fsDelete('calculadoraFitas', id);
  renderFitasSalvas();
  toast('Fita excluída', 'success');
}

// =====================================================
// CONTRATOS  Templates e gerao
// =====================================================
let contratoAtual = { tipo:'', campos:{} };

const CONTRATOS_TEMPLATES = {
  clt: {
    titulo: 'Contrato de Trabalho  CLT',
    campos: [
      {id:'funcionarioId', label:'Funcionário', tipo:'select-funcionario'},
      {id:'dataAdmissao', label:'Data de admissão', tipo:'date'},
      {id:'salario', label:'Salário (R$)', tipo:'money'},
      {id:'jornada', label:'Jornada semanal (horas)', tipo:'number', default:'44'},
      {id:'localTrabalho', label:'Local de trabalho', tipo:'text'},
      {id:'beneficios', label:'Benefícios (opcional)', tipo:'textarea'},
    ]
  },
  temporario: {
    titulo: 'Contrato de Trabalho Temporário',
    campos: [
      {id:'funcionarioId', label:'Funcionário', tipo:'select-funcionario'},
      {id:'dataInicio', label:'Data de início', tipo:'date'},
      {id:'dataFim', label:'Data de término', tipo:'date'},
      {id:'salario', label:'Salário (R$)', tipo:'money'},
      {id:'motivoContratacao', label:'Motivo da contratação temporária', tipo:'textarea'},
    ]
  },
  estagio: {
    titulo: 'Contrato de Estágio',
    campos: [
      {id:'nomeEstagiario', label:'Nome do estagiário', tipo:'text'},
      {id:'cpfEstagiario', label:'CPF do estagiário', tipo:'text'},
      {id:'instituicao', label:'Instituição de ensino', tipo:'text'},
      {id:'curso', label:'Curso', tipo:'text'},
      {id:'supervisor', label:'Supervisor responsável', tipo:'text'},
      {id:'bolsa', label:'Valor da bolsa (R$)', tipo:'money'},
      {id:'dataInicio', label:'Data de início', tipo:'date'},
      {id:'dataFim', label:'Data de término', tipo:'date'},
      {id:'cargaHoraria', label:'Carga horária diária (horas)', tipo:'number'},
    ]
  },
  servico: {
    titulo: 'Contrato de Prestação de Serviço',
    campos: [
      {id:'contratadoNome', label:'Nome/Razão Social do contratado', tipo:'text'},
      {id:'contratadoCpfCnpj', label:'CPF/CNPJ do contratado', tipo:'text'},
      {id:'descricaoServico', label:'Descrição do serviço', tipo:'textarea'},
      {id:'valor', label:'Valor total (R$)', tipo:'money'},
      {id:'prazo', label:'Prazo de execução', tipo:'text', placeholder:'Ex: 30 dias'},
      {id:'formaPagamento', label:'Forma de pagamento', tipo:'text'},
      {id:'dataInicio', label:'Data de início', tipo:'date'},
    ]
  },
  fornecimento: {
    titulo: 'Contrato de Fornecimento',
    campos: [
      {id:'fornecedorNome', label:'Nome/Razão Social do fornecedor', tipo:'text'},
      {id:'fornecedorCnpj', label:'CNPJ do fornecedor', tipo:'text'},
      {id:'produtoServico', label:'Produto/serviço fornecido', tipo:'textarea'},
      {id:'valorMensal', label:'Valor mensal estimado (R$)', tipo:'money'},
      {id:'prazoContrato', label:'Vigência do contrato', tipo:'text', placeholder:'Ex: 12 meses'},
      {id:'condicoesPagamento', label:'Condições de pagamento', tipo:'text'},
    ]
  },
  compra_venda: {
    titulo: 'Contrato de Compra e Venda',
    campos: [
      {id:'vendedorNome', label:'Nome/Razão Social do vendedor', tipo:'text'},
      {id:'vendedorCnpj', label:'CPF/CNPJ do vendedor', tipo:'text'},
      {id:'descricaoBem', label:'Descrição do bem/produto', tipo:'textarea'},
      {id:'valor', label:'Valor total (R$)', tipo:'money'},
      {id:'formaPagamento', label:'Forma de pagamento', tipo:'text'},
      {id:'dataEntrega', label:'Data de entrega', tipo:'date'},
    ]
  },
  emprestimo_func: {
    titulo: 'Termo de Empréstimo/Adiantamento a Funcionário',
    campos: [
      {id:'funcionarioId', label:'Funcionário', tipo:'select-funcionario'},
      {id:'valor', label:'Valor (R$)', tipo:'money'},
      {id:'parcelas', label:'Número de parcelas', tipo:'number'},
      {id:'dataConcessao', label:'Data de concessão', tipo:'date'},
      {id:'motivoEmprestimo', label:'Finalidade (opcional)', tipo:'text'},
    ]
  },
  rescisao: {
    titulo: 'Termo de Rescisão Contratual',
    campos: [
      {id:'funcionarioId', label:'Funcionário', tipo:'select-funcionario'},
      {id:'dataRescisao', label:'Data da rescisão', tipo:'date'},
      {id:'tipoRescisao', label:'Tipo de rescisão', tipo:'select',
        opcoes:['Pedido de demissão','Demissão sem justa causa','Demissão com justa causa','Acordo mútuo (Lei 13.467)']},
      {id:'avisoPrevio', label:'Aviso prévio', tipo:'select', opcoes:['Trabalhado','Indenizado','Dispensado']},
      {id:'saldoSalario', label:'Saldo de salário (R$)', tipo:'money'},
      {id:'fgts', label:'FGTS a recolher/sacar (R$)', tipo:'money'},
    ]
  }
};

function usarTemplate(tipo) {
  const tmpl = CONTRATOS_TEMPLATES[tipo];
  if (!tmpl) return;
  contratoAtual = { tipo, campos: {} };
  document.getElementById('contratoModalTitulo').textContent = tmpl.titulo;

  const body = document.getElementById('contratoModalBody');
  body.innerHTML = `
    <p style="color:var(--text3);font-size:0.82rem;margin-bottom:16px">Preencha os campos abaixo. Os dados da empresa são preenchidos automaticamente.</p>
    <div class="form-grid">
      ${tmpl.campos.map(campo => renderCampoContrato(campo)).join('')}
    </div>`;

  // Popular selects de funcionário
  tmpl.campos.filter(f => f.tipo === 'select-funcionario').forEach(f => {
    const sel = document.getElementById(`cc_${f.id}`);
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>' +
      funcionarios.filter(fn => fn.ativo !== false).map(fn =>
        `<option value="${fn.id}">${fn.nome}</option>`).join('');
  });

  // Preencher data de hoje nos campos de data
  tmpl.campos.filter(f => f.tipo === 'date').forEach(f => {
    const el = document.getElementById(`cc_${f.id}`);
    if (el && !el.value) el.value = new Date().toISOString().slice(0,10);
  });

  openModal('modal-contrato');
}

function renderCampoContrato(campo) {
  const id = `cc_${campo.id}`;
  if (campo.tipo === 'select-funcionario') {
    return `<div class="form-group"><label class="form-label">${campo.label}</label><select class="form-input" id="${id}"></select></div>`;
  }
  if (campo.tipo === 'select') {
    return `<div class="form-group"><label class="form-label">${campo.label}</label><select class="form-input" id="${id}">${campo.opcoes.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></div>`;
  }
  if (campo.tipo === 'textarea') {
    return `<div class="form-group" style="grid-column:1/-1"><label class="form-label">${campo.label}</label><textarea class="form-input" id="${id}" rows="3" placeholder="${campo.placeholder||''}" style="resize:vertical;font-family:var(--font)"></textarea></div>`;
  }
  if (campo.tipo === 'money') {
    return `<div class="form-group"><label class="form-label">${campo.label}</label><div style="position:relative"><span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);pointer-events:none">R$</span><input type="number" class="form-input" id="${id}" step="0.01" placeholder="0,00" style="padding-left:34px" value="${campo.default||''}"></div></div>`;
  }
  return `<div class="form-group"><label class="form-label">${campo.label}</label><input type="${campo.tipo==='number'?'number':'text'}" class="form-input" id="${id}" placeholder="${campo.placeholder||''}" value="${campo.default||''}"></div>`;
}

function coletarCamposContrato() {
  const tmpl = CONTRATOS_TEMPLATES[contratoAtual.tipo];
  if (!tmpl) return {};
  const dados = {};
  tmpl.campos.forEach(campo => {
    const el = document.getElementById(`cc_${campo.id}`);
    if (!el) return;
    dados[campo.id] = el.value;
    // Para select-funcionario, guardar também o objeto
    if (campo.tipo === 'select-funcionario' && el.value) {
      dados[campo.id + '_obj'] = funcionarios.find(f => f.id === el.value);
    }
  });
  return dados;
}

async function gerarContratoPDF() {
  const tmpl = CONTRATOS_TEMPLATES[contratoAtual.tipo];
  if (!tmpl) return;
  const dados = coletarCamposContrato();
  const org = currentOrg || { nome: 'EMPRESA', cnpj: '', cidade: '' };
  const hoje = new Date();
  const dataExtenso = hoje.toLocaleDateString('pt-BR', {day:'numeric',month:'long',year:'numeric'});
  const cidade = org.cidade || '';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const lm = 25, pw = 160, rm = lm + pw;
  let y = 20;

  // Cabeçalho
  doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text(org.nome.toUpperCase(), lm + pw/2, y, {align:'center'});
  if (org.cnpj) {
    y += 6; doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(`CNPJ: ${org.cnpj}`, lm + pw/2, y, {align:'center'});
  }
  y += 8;
  doc.setLineWidth(0.8); doc.setDrawColor(27,45,107);
  doc.line(lm, y, rm, y);
  y += 8;

  // Título
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text(tmpl.titulo.toUpperCase(), lm + pw/2, y, {align:'center'});
  y += 12;

  // Texto do contrato
  const texto = gerarTextoContrato(contratoAtual.tipo, dados, org);
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
  const linhas = doc.splitTextToSize(texto, pw);
  linhas.forEach(linha => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.text(linha, lm, y);
    y += 5.5;
  });

  // Assinaturas
  y = Math.max(y + 15, 240);
  if (y > 270) { doc.addPage(); y = 30; }
  doc.setLineWidth(0.4); doc.setDrawColor(100,100,120);
  doc.line(lm, y, lm+70, y);
  doc.line(rm-70, y, rm, y);
  doc.setFontSize(9);
  const contratante = org.nome.substring(0,25);
  const contratado = dados.funcionarioId_obj?.nome || dados.contratadoNome || dados.vendedorNome || dados.fornecedorNome || 'CONTRATADO(A)';
  doc.text(contratante, lm+35, y+5, {align:'center'});
  doc.text(contratado.substring(0,25), rm-35, y+5, {align:'center'});
  doc.setFontSize(8); doc.setTextColor(130,130,150);
  doc.text('CONTRATANTE', lm+35, y+9, {align:'center'});
  doc.text('CONTRATADO(A)', rm-35, y+9, {align:'center'});
  doc.setTextColor(30,30,45);
  y += 16;
  doc.setFontSize(9);
  doc.text(`${cidade ? cidade + ', ' : ''}${dataExtenso}`, lm+pw/2, y, {align:'center'});

  const nomePdf = `${tmpl.titulo.replace(/[\/:*?"<>|]/g,'_')}.pdf`;
  doc.save(nomePdf);

  // Salvar registro
  await fsAdd('contratos', {
    tipo: contratoAtual.tipo,
    titulo: tmpl.titulo,
    dados,
    geradoEm: new Date().toISOString()
  });

  closeModal('modal-contrato');
  renderContratosLista();
  toast('Contrato gerado!', 'success');
}

function gerarTextoContrato(tipo, d, org) {
  const func = d.funcionarioId_obj;
  const empresa = `${org.nome}${org.cnpj ? ', inscrita no CNPJ sob o n ' + org.cnpj : ''}${org.cidade ? ', com sede em ' + org.cidade : ''}`;

  const textos = {
    clt: `Pelo presente instrumento particular, ${empresa}, doravante denominada CONTRATANTE, e ${func?.nome||'___'}, portador(a) do CPF n ${func?.cpf||'___'}, doravante denominado(a) CONTRATADO(A), tm justo e acordado o presente Contrato de Trabalho por Prazo Indeterminado, regido pela Consolidao das Leis do Trabalho (CLT), mediante as seguintes clusulas e condies:

CLUSULA 1  DA FUNO
O(A) CONTRATADO(A)  admitido(a) para exercer a funo de ${func?.cargo||'___'}, com ingresso em ${d.dataAdmissao ? fmtData(d.dataAdmissao) : '___'}, no local de trabalho: ${d.localTrabalho||'___'}.

CLUSULA 2  DA REMUNERAO
O(A) CONTRATADO(A) perceberá salário mensal de R$ ${fmtMoney(parseFloat(d.salario)||0)} (${numberToWords(parseFloat(d.salario)||0)}), pago até o 5º dia útil do mês subsequente ao vencido.

CLUSULA 3  DA JORNADA DE TRABALHO
A jornada de trabalho será de ${d.jornada||'44'} (${d.jornada||'quarenta e quatro'}) horas semanais, distribuídas de segunda-feira a sexta-feira, de acordo com o horário estabelecido pela CONTRATANTE.

CLUSULA 4  DAS FRIAS E 13 SALRIO
O(A) CONTRATADO(A) fará jus a férias anuais remuneradas acrescidas de 1/3 constitucional, bem como ao 13º salário, nos termos da legislação vigente.

CLUSULA 5  DO FGTS E INSS
A CONTRATANTE recolherá, mensalmente, o FGTS e contribuição previdenciária (INSS) sobre a remuneração do(a) CONTRATADO(A), nos percentuais legalmente estabelecidos.

${d.beneficios ? `CLUSULA 6  DOS BENEFCIOS\n${d.beneficios}\n\n` : ''}CLUSULA ${d.beneficios?'7':'6'}  DA RESCISO
O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio, de acordo com as disposições da CLT e legislação vigente.

CLUSULA ${d.beneficios?'8':'7'}  DO FORO
As partes elegem o foro da comarca de ${org.cidade||'___'} para dirimir quaisquer controvérsias oriundas deste contrato.

E, por estarem assim justos e contratados, as partes assinam o presente instrumento em 2 (duas) vias de igual teor.`,

    rescisao: `Pelo presente instrumento particular, ${empresa}, doravante denominada EMPREGADORA, e ${func?.nome||'___'}, portador(a) do CPF n ${func?.cpf||'___'}, admitido(a) em ___ para exercer a funo de ${func?.cargo||'___'}, doravante denominado(a) EMPREGADO(A), formalizam o distrato do contrato de trabalho, mediante as seguintes condies:

CLUSULA 1  DA RESCISO
Fica rescindido o contrato de trabalho em ${d.dataRescisao ? fmtData(d.dataRescisao) : '___'}, por ${d.tipoRescisao||'___'}.

CLUSULA 2  DO AVISO PRVIO
O aviso prévio foi: ${d.avisoPrevio||'___'}.

CLUSULA 3  DAS VERBAS RESCISRIAS
O(A) EMPREGADO(A) receberá as seguintes verbas rescisórias:
 Saldo de salrio: R$ ${fmtMoney(parseFloat(d.saldoSalario)||0)}
 FGTS: R$ ${fmtMoney(parseFloat(d.fgts)||0)}
${d.tipoRescisao?.includes('sem justa causa') ? ' Multa de 40% sobre FGTS conforme legislao vigente\n' : ''}
CLUSULA 4  DA QUITAO
Recebidas as verbas devidas, as partes dão plena, geral e irrevogável quitação de todos os direitos e obrigações decorrentes do contrato de trabalho ora rescindido, nada mais podendo reclamar, a qualquer título.

E, por estarem assim justos e acordados, assinam o presente em 2 (duas) vias de igual teor.`,

    servico: `Pelo presente instrumento particular, ${empresa}, doravante denominada CONTRATANTE, e ${d.contratadoNome||'___'}, inscrito(a) no CPF/CNPJ sob o nº ${d.contratadoCpfCnpj||'___'}, doravante denominado(a) CONTRATADO(A), têm entre si justo e contratado a prestação de serviços, mediante as seguintes cláusulas:

CLUSULA 1  DO OBJETO
O(A) CONTRATADO(A) prestará os seguintes serviços à CONTRATANTE: ${d.descricaoServico||'___'}.

CLUSULA 2  DO VALOR E PAGAMENTO
Pela prestação dos serviços, a CONTRATANTE pagará ao(à) CONTRATADO(A) o valor de R$ ${fmtMoney(parseFloat(d.valor)||0)} (${numberToWords(parseFloat(d.valor)||0)}), mediante ${d.formaPagamento||'___'}.

CLUSULA 3  DO PRAZO
Os servios devero ser executados no prazo de ${d.prazo||'___'}, contados a partir de ${d.dataInicio ? fmtData(d.dataInicio) : '___'}.

CLUSULA 4  DA NATUREZA DOS SERVIOS
O(A) CONTRATADO(A) prestará os serviços de forma autônoma, sem subordinação, não configurando vínculo empregatício entre as partes.

CLUSULA 5  DO FORO
Fica eleito o foro da comarca de ${org.cidade||'___'} para dirimir quaisquer controvérsias.

E, por estarem assim justos e contratados, assinam o presente em 2 (duas) vias de igual teor.`,

    emprestimo_func: `Pelo presente instrumento particular, ${empresa}, doravante denominada EMPREGADORA, e ${func?.nome||'___'}, portador(a) do CPF n ${func?.cpf||'___'}, funcionrio(a) da EMPREGADORA na funo de ${func?.cargo||'___'}, doravante denominado(a) BENEFICIRIO(A), formalizam o presente Termo de Emprstimo, nas seguintes condies:

CLUSULA 1  DO VALOR
A EMPREGADORA concede ao() BENEFICIRIO(A) emprstimo/adiantamento no valor de R$ ${fmtMoney(parseFloat(d.valor)||0)} (${numberToWords(parseFloat(d.valor)||0)}), em ${d.dataConcessao ? fmtData(d.dataConcessao) : '___'}${d.motivoEmprestimo ? '\nFinalidade: ' + d.motivoEmprestimo : ''}

CLUSULA 2  DA DEVOLUO
O valor será descontado diretamente da folha de pagamento do(a) BENEFICIÁRIO(A), em ${d.parcelas||'___'} (${d.parcelas||'___'}) parcelas mensais iguais, iniciando-se no próximo pagamento.

CLUSULA 3  DO RECONHECIMENTO DE DVIDA
O(A) BENEFICIÁRIO(A) reconhece o débito e autoriza expressamente os descontos em folha de pagamento, nos termos do art. 462 da CLT.

CLUSULA 4  DA RESCISO
Em caso de rescisão contratual, o saldo devedor será integralmente descontado das verbas rescisórias devidas.

E, por estarem assim justos e acordados, assinam o presente em 2 (duas) vias de igual teor.`,
  };

  // Templates restantes (fornecimento, compra_venda, temporario, estagio) - versão simplificada
  const padrao = `Pelo presente instrumento, ${empresa} e ${d.contratadoNome||d.fornecedorNome||d.vendedorNome||func?.nome||'___'} ajustam entre si o presente contrato, tendo como objeto: ${d.descricaoBem||d.produtoServico||d.descricaoServico||'___'}.

Valor: R$ ${fmtMoney(parseFloat(d.valor||d.valorMensal||d.bolsa||d.salario)||0)}
Vigência: ${d.prazoContrato||d.prazo||''}
Condições: ${d.condicoesPagamento||d.formaPagamento||''}

As partes elegem o foro de ${org.cidade||'___'} para dirimir quaisquer controvérsias.`;

  return textos[tipo] || padrao;
}

async function renderContratosLista() {
  const el = document.getElementById('contratosLista');
  if (!el) return;
  const contratos = await fsGetAll('contratos');
  if (!contratos || contratos.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Nenhum contrato gerado ainda.</p>';
    return;
  }
  el.innerHTML = contratos.sort((a,b)=>(b.geradoEm||'').localeCompare(a.geradoEm||'')).map(ct => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:6px">
      <div style="font-size:1.5rem">📄</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:0.88rem">${ct.titulo}</div>
        <div style="font-size:0.75rem;color:var(--text3)">${ct.geradoEm?new Date(ct.geradoEm).toLocaleDateString('pt-BR'):''}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="usarTemplate('${ct.tipo}')">📋 Usar novamente</button>
      <button class="btn-icon" onclick="excluirContrato('${ct.id}')">🗑️</button>
    </div>`).join('');
}

async function excluirContrato(id) {
  if (!await confirmar('Excluir contrato?','')) return;
  await fsDelete('contratos', id);
  renderContratosLista();
}

function abrirNovoContrato() {
  document.getElementById('contratosTemplates').scrollIntoView({behavior:'smooth'});
  toast('Escolha um template abaixo', 'info');
}

function previewContrato() {
  toast('Preencha os campos e clique em Gerar PDF para visualizar', 'info');
}


// =====================================================
// CALCULADORA  TECLADO DO COMPUTADOR
// =====================================================
function calcHandleKeyboard(e) {
  // Só funciona quando a página da calculadora está ativa
  if (!document.getElementById('page-calculadora')?.classList.contains('active')) return;
  // Não interceptar quando estiver num input (exceto calcDesc)
  const active = document.activeElement;
  if (active && active.id !== 'calcDesc' && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName)) return;

  const key = e.key;
  e.preventDefault();

  if (key >= '0' && key <= '9') { calcNum(key); return; }
  if (key === ',' || key === '.') { calcNum(','); return; }
  if (key === '+') { calcFn('+'); return; }
  if (key === '-') { calcFn('-'); return; }
  if (key === '*') { calcFn('×'); return; }
  if (key === '/') { calcFn('÷'); return; }
  if (key === '%') { calcFn('%'); return; }
  if (key === 'Enter' || key === '=') { calcFn('='); return; }
  if (key === 'Backspace') {
    if (calcEstado.display.length > 1) {
      calcEstado.display = calcEstado.display.slice(0, -1);
    } else {
      calcEstado.display = '0';
    }
    calcRender(); return;
  }
  if (key === 'Escape') { calcNova(); return; } // Esc = Nova fita
  if (key === 'Delete') { calcFn('CE'); return; } // Del = limpa operação
  if (key === 'F9') { calcFn('CF'); return; } // F9 = limpa fita
  // Enter no campo descrio  confirma operao pendente
  if (key === 'Tab' && calcEstado.operacao) { calcFn('='); return; }
}

document.addEventListener('keydown', (e) => {
  // Não interceptar Ctrl+Z (undo) nem outros atalhos do sistema
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  calcHandleKeyboard(e);
});


// Helper: retorna o nome do cargo de um funcionário
function getNomeCargo(f) {
  if (f.grupoId) {
    const g = grupos.find(g => g.id === f.grupoId);
    if (g) return g.nome;
  }
  return f.cargo || '';
}

// Helper: lista de funcionários ativos ordenada e filtrada
function getFuncionariosOrdenados(filtro='', cargoFiltro='', ordemAZ=true) {
  let lista = funcionarios.filter(f => f.ativo !== false);
  if (filtro) {
    const q = filtro.toLowerCase();
    lista = lista.filter(f =>
      f.nome.toLowerCase().includes(q) ||
      getNomeCargo(f).toLowerCase().includes(q) ||
      (f.cpf||'').includes(q)
    );
  }
  if (cargoFiltro) {
    lista = lista.filter(f => f.grupoId === cargoFiltro || f.cargo === cargoFiltro);
  }
  lista.sort((a, b) => {
    const cmp = a.nome.localeCompare(b.nome, 'pt-BR');
    return ordemAZ ? cmp : -cmp;
  });
  return lista;
}
// =====================================================
// CALCULADORA DO DASHBOARD  estado prprio
// =====================================================
let dashCalcEstado = {
  display: '0', acumulador: null, operacao: null,
  novoNumero: true, fita: [], totalAtual: 0
};

function dashCalcNum(n) {
  const s = dashCalcEstado;
  if (n === ',' || n === '.') {
    if (s.display.includes(',')) return;
    if (s.novoNumero) { s.display = '0,'; s.novoNumero = false; }
    else s.display += ',';
  } else {
    if (s.novoNumero) { s.display = n; s.novoNumero = false; }
    else { s.display = s.display === '0' ? n : s.display + n; }
  }
  dashCalcRender();
}

function dashCalcValor() {
  return parseFloat(dashCalcEstado.display.replace(',', '.')) || 0;
}

function dashCalcFn(op) {
  const s = dashCalcEstado;
  const val = dashCalcValor();

  if (op === 'C') { s.display = '0'; s.novoNumero = true; dashCalcRender(); return; }
  if (op === 'CE') {
    s.display = '0'; s.acumulador = null; s.operacao = null; s.novoNumero = true;
    const opEl = document.getElementById('dashCalcOp');
    if (opEl) opEl.textContent = '';
    dashCalcRender(); return;
  }
  if (op === 'SUB') {
    s.fita.push({ tipo: 'subtotal', valor: s.totalAtual });
    dashCalcRenderFita(); return;
  }
  if (op === '%') {
    const pct = s.acumulador !== null ? s.acumulador * val / 100 : val / 100;
    s.display = String(pct).replace('.', ',');
    dashCalcRender(); return;
  }

  if (['+', '-', '×', '÷'].includes(op)) {
    if (s.operacao && !s.novoNumero) {
      dashCalcExecutar(val);
    } else if (s.acumulador === null) {
      s.acumulador = val;
      s.totalAtual = val;
      s.fita.push({ tipo: 'entrada', op: '', valor: val });
      dashCalcRenderFita();
    }
    s.operacao = op;
    s.novoNumero = true;
    const opEl = document.getElementById('dashCalcOp');
    if (opEl) opEl.textContent = `${fmtMoney(s.acumulador)} ${op}`;
    dashCalcRender(); return;
  }

  if (op === '=') {
    if (s.operacao && !s.novoNumero) dashCalcExecutar(val);
    s.operacao = null; s.novoNumero = true;
    const opEl = document.getElementById('dashCalcOp');
    if (opEl) opEl.textContent = '';
    dashCalcRender();
  }
}

function dashCalcExecutar(val) {
  const s = dashCalcEstado;
  const acc = s.acumulador;
  let res = acc;
  if (s.operacao === '+') res = acc + val;
  if (s.operacao === '-') res = acc - val;
  if (s.operacao === '×') res = acc * val;
  if (s.operacao === '') res = val !== 0 ? acc / val : 0;
  res = Math.round(res * 100) / 100;
  s.fita.push({ tipo: 'entrada', op: s.operacao, valor: val, resultado: res });
  s.acumulador = res;
  s.totalAtual = res;
  s.display = String(res).replace('.', ',');
  dashCalcRenderFita();
}

function dashCalcRender() {
  const s = dashCalcEstado;
  const el = document.getElementById('dashCalcDisplay');
  const tot = document.getElementById('dashCalcTotal');
  if (el) el.textContent = calcFormatDisplay(s.display);
  if (tot) tot.textContent = fmtMoney(s.totalAtual);
}

function dashCalcRenderFita() {
  const el = document.getElementById('dashCalcFita');
  if (!el) return;
  const s = dashCalcEstado;
  if (s.fita.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:0.72rem;text-align:center;margin:12px 0">Nenhuma operação</p>';
    dashCalcRender(); return;
  }
  el.innerHTML = s.fita.map((linha, i) => {
    if (linha.tipo === 'subtotal') {
      return `<div style="display:flex;justify-content:space-between;padding:2px 0;border-top:1px solid var(--navy);font-weight:700;color:var(--navy);font-size:0.72rem">
        <span>SUB</span><span>R$ ${fmtMoney(linha.valor)}</span></div>`;
    }
    const cor = linha.op === '+' ? 'var(--green)' : linha.op === '-' ? 'var(--red)' : 'var(--text)';
    return `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid var(--border);font-size:0.72rem">
      <span style="width:14px;font-weight:700;color:${cor};flex-shrink:0">${linha.op || '='}</span>
      <span style="flex:1;color:${cor}">${fmtMoney(linha.valor)}</span>
      ${linha.resultado !== undefined ? `<span style="font-weight:700;color:var(--accent2)">= ${fmtMoney(linha.resultado)}</span>` : ''}
      <button onclick="dashCalcRemoverLinha(${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:10px;padding:0 2px;line-height:1">✕</button>
    </div>`;
  }).join('');
  // Auto-scroll para baixo
  el.scrollTop = el.scrollHeight;
  dashCalcRender();
}

function dashCalcRemoverLinha(idx) {
  dashCalcEstado.fita.splice(idx, 1);
  dashCalcRenderFita();
}

function calcNovaDash() {
  dashCalcEstado = { display:'0', acumulador:null, operacao:null, novoNumero:true, fita:[], totalAtual:0 };
  dashCalcRender();
  dashCalcRenderFita();
}

function calcImprimirDash(tipo) {
  // Usa a mesma função da calculadora principal mas com o estado do dashboard
  const estadoBackup = calcEstado;
  calcEstado = dashCalcEstado;
  calcImprimir(tipo);
  calcEstado = estadoBackup;
}

// Sincronizar teclado com calculadora do dashboard quando dashboard estiver ativo
function calcHandleKeyboardDash(e) {
  // Só quando dashboard está ativo E calculadora do dashboard está visível
  const dashPage = document.getElementById('page-dashboard');
  const dashFita = document.getElementById('dashCalcFita');
  if (!dashPage?.classList.contains('active') || !dashFita) return;

  const active = document.activeElement;
  if (active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName)) return;

  const key = e.key;
  if (key >= '0' && key <= '9') { e.preventDefault(); dashCalcNum(key); return; }
  if (key === ',' || key === '.') { e.preventDefault(); dashCalcNum(','); return; }
  if (key === '+') { e.preventDefault(); dashCalcFn('+'); return; }
  if (key === '-') { e.preventDefault(); dashCalcFn('-'); return; }
  if (key === '*') { e.preventDefault(); dashCalcFn('×'); return; }
  if (key === '/') { e.preventDefault(); dashCalcFn('÷'); return; }
  if (key === 'Enter' || key === '=') { e.preventDefault(); dashCalcFn('='); return; }
  if (key === 'Backspace') {
    e.preventDefault();
    const s = dashCalcEstado;
    s.display = s.display.length > 1 ? s.display.slice(0,-1) : '0';
    dashCalcRender(); return;
  }
  if (key === 'Escape') { e.preventDefault(); calcNovaDash(); return; }
}

// Adicionar ao listener de teclado existente
document.addEventListener('keydown', calcHandleKeyboardDash);

// Dashboard calc init handled in navigate()

function initModaisEquipe() {
  renderBotoesPerfilMembro();
  popularSelectPreConvite();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModaisEquipe);
} else {
  initModaisEquipe();
}

// Service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=20260502d')
      .then(reg => {
        // Forçar update imediato
        reg.update();
      })
      .catch(() => {});
  });
}
