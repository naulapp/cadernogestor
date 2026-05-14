// =====================================================
// ALMOXARIFADO — itens + movimentos (MVP)
// =====================================================

function renderAlmoxarifadoPage() {
  const root = document.getElementById('almoxRoot');
  if (!root) return;

  const itens = (almoxItens || []).filter((i) => i.ativo !== false).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  const movs = (almoxMovimentos || []).slice().sort((a, b) => (b.em || b.criadoEm || '').localeCompare(a.em || a.criadoEm || '')).slice(0, 80);

  const estoque = (id) => {
    const it = almoxItens.find((x) => x.id === id);
    return it?.estoqueAtual ?? 0;
  };

  root.innerHTML = `
    <div class="section-card" style="margin-bottom:16px">
      <div class="section-card-title">Novo item</div>
      <div class="form-grid form-grid-3">
        <div class="form-group" style="grid-column:span 2">
          <label class="form-label">Nome *</label>
          <input type="text" class="form-input" id="almoxNomeNovo" placeholder="Ex.: Correia A-28">
        </div>
        <div class="form-group">
          <label class="form-label">Unidade</label>
          <input type="text" class="form-input" id="almoxUnNovo" placeholder="UN, pc, m">
        </div>
        <div class="form-group">
          <label class="form-label">Estoque inicial</label>
          <input type="number" class="form-input" id="almoxEstNovo" value="0" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Estoque mínimo (alerta)</label>
          <input type="number" class="form-input" id="almoxMinNovo" value="0" min="0" step="0.01">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Categoria / observação</label>
          <input type="text" class="form-input" id="almoxCatNovo" placeholder="Manutenção, elétrica…">
        </div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick="almoxSalvarNovoItem()">Cadastrar item</button>
    </div>

    <div class="section-card" style="margin-bottom:16px">
      <div class="section-card-title">Movimentar estoque</div>
      <div class="form-grid form-grid-3">
        <div class="form-group" style="grid-column:span 2">
          <label class="form-label">Item</label>
          <select class="form-input" id="almoxMovItem">${itens.map((i) =>
            `<option value="${escapeAttr(i.id)}">${escapeHtml(i.nome)} (${escapeHtml(i.unidade || 'un')}) — est: ${i.estoqueAtual ?? 0}</option>`).join('') || '<option value="">Cadastre um item</option>'}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-input" id="almoxMovTipo"><option value="entrada">Entrada</option><option value="saida">Saída</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantidade</label>
          <input type="number" class="form-input" id="almoxMovQtd" value="1" min="0.01" step="0.01">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Motivo / referência</label>
          <input type="text" class="form-input" id="almoxMovMotivo" placeholder="OS 123, troca preventiva…">
        </div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick="almoxRegistrarMovimento()">Registrar movimento</button>
    </div>

    <div class="section-card" style="margin-bottom:16px">
      <div class="section-card-title">Itens (${itens.length})</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Item</th><th>Un.</th><th>Estoque</th><th>Mín.</th><th></th></tr></thead>
          <tbody>${itens.map((i) => {
            const min = Number(i.estoqueMinimo) || 0;
            const st = Number(i.estoqueAtual) <= min && min > 0 ? 'color:#c0392b;font-weight:700' : '';
            return `<tr>
              <td>${escapeHtml(i.nome)}${i.categoria ? ` <span style="color:var(--text3);font-size:0.75rem">(${escapeHtml(i.categoria)})</span>` : ''}</td>
              <td>${escapeHtml(i.unidade || 'un')}</td>
              <td style="${st}">${i.estoqueAtual ?? 0}</td>
              <td>${min}</td>
              <td style="text-align:right"><button type="button" class="btn-icon" title="Inativar" onclick="almoxInativarItem('${escapeAttr(i.id)}')">🗑️</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="5" style="color:var(--text3)">Nenhum item.</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-title">Últimos movimentos</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th>Qtd</th><th>Motivo</th></tr></thead>
          <tbody>${movs.map((m) => {
            const it = almoxItens.find((x) => x.id === m.itemId);
            const em = m.em || m.criadoEm || '';
            return `<tr>
              <td style="font-size:0.8rem">${escapeHtml(String(em).slice(0, 19))}</td>
              <td>${escapeHtml(it?.nome || m.itemId)}</td>
              <td>${escapeHtml(m.tipo)}</td>
              <td>${escapeHtml(String(m.quantidade))}</td>
              <td>${escapeHtml(m.motivo || '—')}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="5" style="color:var(--text3)">Nenhum movimento.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function almoxSalvarNovoItem() {
  const nome = document.getElementById('almoxNomeNovo')?.value?.trim();
  if (!nome) { toast('Nome do item obrigatório', 'error'); return; }
  const est = parseFloat(document.getElementById('almoxEstNovo')?.value) || 0;
  const payload = {
    nome,
    unidade: (document.getElementById('almoxUnNovo')?.value || 'un').trim(),
    estoqueAtual: est,
    estoqueMinimo: parseFloat(document.getElementById('almoxMinNovo')?.value) || 0,
    categoria: (document.getElementById('almoxCatNovo')?.value || '').trim(),
    ativo: true
  };
  const novo = await fsAdd('almoxItens', payload);
  almoxItens.push(novo);
  toast('Item cadastrado!', 'success');
  renderAlmoxarifadoPage();
}

async function almoxInativarItem(id) {
  if (!id || !await confirmar('Inativar item?', 'O histórico de movimentos permanece.')) return;
  await fsUpdate('almoxItens', id, { ativo: false });
  const ix = almoxItens.findIndex((x) => x.id === id);
  if (ix >= 0) almoxItens[ix].ativo = false;
  toast('Item inativado', 'success');
  renderAlmoxarifadoPage();
}

async function almoxRegistrarMovimento() {
  const itemId = document.getElementById('almoxMovItem')?.value;
  if (!itemId) { toast('Selecione um item', 'error'); return; }
  const tipo = document.getElementById('almoxMovTipo')?.value || 'saida';
  const qtd = parseFloat(document.getElementById('almoxMovQtd')?.value) || 0;
  if (qtd <= 0) { toast('Quantidade inválida', 'error'); return; }
  const motivo = (document.getElementById('almoxMovMotivo')?.value || '').trim();
  const it = almoxItens.find((x) => x.id === itemId);
  if (!it) return;
  let novoEst = Number(it.estoqueAtual) || 0;
  if (tipo === 'entrada') novoEst += qtd;
  else novoEst -= qtd;
  if (novoEst < 0) { toast('Estoque não pode ficar negativo.', 'error'); return; }

  const mov = {
    itemId,
    tipo,
    quantidade: qtd,
    motivo,
    em: new Date().toISOString()
  };
  await fsAdd('almoxMovimentos', mov);
  await fsUpdate('almoxItens', itemId, { estoqueAtual: novoEst });
  const ix = almoxItens.findIndex((x) => x.id === itemId);
  if (ix >= 0) almoxItens[ix].estoqueAtual = novoEst;
  almoxMovimentos = await fsGetAll('almoxMovimentos');
  toast('Movimento registrado!', 'success');
  renderAlmoxarifadoPage();
}
