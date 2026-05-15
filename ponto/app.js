(() => {
  const WORKER_URL_PADRAO = 'https://cadernogestor.luan-eu55.workers.dev';

  const LS_PONTO_QS = 'cg_ponto_url_search_v1';
  const LS_COD_EMPRESA = 'cg_ponto_ultimo_cod_empresa_v1';
  const LS_TOKEN = 'cg_ponto_token_v1';
  const LS_CFG = 'cg_ponto_cfg_v1';
  const LS_NOME_SESSAO = 'cg_ponto_nome_sessao';
  const OUTBOX = 'cg_ponto_outbox_v1';

  function mergePontoUrlParams() {
    const params = new URLSearchParams(location.search || '');
    try {
      const saved = localStorage.getItem(LS_PONTO_QS) || '';
      if (saved) {
        const qs = saved.charAt(0) === '?' ? saved : '?' + saved;
        const ps = new URLSearchParams(qs);
        if (!params.get('c') && ps.get('c')) params.set('c', ps.get('c'));
        if (!params.get('t') && ps.get('t')) params.set('t', ps.get('t'));
        if (!params.get('n') && ps.get('n')) params.set('n', ps.get('n'));
      }
    } catch (e) {
      /* ignore */
    }
    if (params.get('c') || params.get('t')) {
      try {
        localStorage.setItem(LS_PONTO_QS, '?' + params.toString());
      } catch (e2) {
        /* ignore */
      }
    }
    return params;
  }

  const params = mergePontoUrlParams();
  const urlCodigo = (params.get('c') || '').trim().toUpperCase();
  const urlToken = (params.get('t') || '').trim();

  const workerBase = normalizarWorkerUrl(WORKER_URL_PADRAO);

  function normalizarWorkerUrl(u) {
    let s = String(u || '').trim().replace(/\/$/, '');
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s;
  }

  const $ = (id) => document.getElementById(id);

  function setStatus(msg, err) {
    const el = $('status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = err ? '#b42318' : '#3d434d';
  }

  function api(path) {
    return workerBase + path;
  }

  function migrateSessionStorageToLocal() {
    try {
      const t = sessionStorage.getItem(LS_TOKEN);
      if (t && !localStorage.getItem(LS_TOKEN)) {
        localStorage.setItem(LS_TOKEN, t);
        const cfg = sessionStorage.getItem(LS_CFG);
        if (cfg) localStorage.setItem(LS_CFG, cfg);
        const n = sessionStorage.getItem(LS_NOME_SESSAO);
        if (n) localStorage.setItem(LS_NOME_SESSAO, n);
      }
      sessionStorage.removeItem(LS_TOKEN);
      sessionStorage.removeItem(LS_CFG);
      sessionStorage.removeItem(LS_NOME_SESSAO);
    } catch (e) {
      /* ignore */
    }
  }

  function getAuthToken() {
    try {
      return localStorage.getItem(LS_TOKEN) || '';
    } catch (e) {
      return '';
    }
  }

  function compressDataUrl(file, maxW, q) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = (h * maxW) / w;
          w = maxW;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Foto'));
              return;
            }
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = () => reject(new Error('Leitura'));
            fr.readAsDataURL(blob);
          },
          'image/jpeg',
          q
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Imagem'));
      };
      img.src = url;
    });
  }

  async function getGeo() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS não disponível neste aparelho'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 22000, maximumAge: 0 }
      );
    });
  }

  function outboxLoad() {
    try {
      return JSON.parse(localStorage.getItem(OUTBOX) || '[]');
    } catch {
      return [];
    }
  }

  function outboxSave(arr) {
    try {
      localStorage.setItem(OUTBOX, JSON.stringify(arr.slice(0, 12)));
    } catch (e) {
      setStatus('Fila offline cheia — apague fotos antigas ou libere espaço.', true);
    }
  }

  async function flushOutbox() {
    if (!navigator.onLine) return;
    const token = getAuthToken();
    if (!token) return;
    let q = outboxLoad();
    if (!q.length) return;
    const next = [];
    const wb = workerBase.replace(/\/$/, '');
    for (const item of q) {
      try {
        let fotoKey = item.fotoKey || '';
        if (item.base64 && !fotoKey) {
          const up = await fetch(wb + '/api/upload-foto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ base64: item.base64, contentType: item.contentType || 'image/jpeg' })
          });
          const ju = await up.json();
          if (!ju.ok) throw new Error(ju.error || 'upload');
          fotoKey = ju.fotoKey;
        }
        const reg = await fetch(wb + '/api/registrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            geo: item.geo,
            fotoKey: fotoKey || '',
            tipoBatida: 0,
            offlineId: item.offlineId || ''
          })
        });
        const jr = await reg.json();
        if (!jr.ok) throw new Error(jr.error || 'registrar');
      } catch (e) {
        item.attempts = (item.attempts || 0) + 1;
        if (item.attempts < 8) next.push(item);
      }
    }
    outboxSave(next);
    if (next.length) setStatus('Algumas batidas offline ainda na fila. Mantenha o app aberto online.', false);
  }

  function mesAtualRef() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function formatarDataPt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  }

  async function carregarResumo() {
    const token = getAuthToken();
    const box = $('resumoConteudo');
    if (!token || !box) return;
    box.textContent = 'Carregando resumo…';
    try {
      const mes = mesAtualRef();
      const res = await fetch(api('/api/minhas-marcacoes?mes=' + encodeURIComponent(mes)), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        box.textContent = 'Não foi possível carregar o resumo.';
        return;
      }
      if (!data.ok) {
        box.textContent = data.error || 'Resumo indisponível.';
        return;
      }
      renderResumo(data);
    } catch (e) {
      if (box) box.textContent = 'Erro de rede ao carregar resumo.';
    }
  }

  function renderResumo(data) {
    const box = $('resumoConteudo');
    if (!box) return;
    const u = data.ultimaMarcacao;
    const r = data.resumoMes || {};
    const mesLbl = (data.mesRef || '').split('-').reverse().join('/') || '';

    let html = '';
    html += '<div class="resumo-bloco"><strong>Última batida</strong><br/>';
    if (u && (u.em || u.dataDia)) {
      html += `<span class="resumo-valor">${formatarDataPt(u.em)}</span>`;
      if (u.dataDia) html += `<br/><span class="resumo-detalhe">Dia ${u.dataDia} · Batida nº ${u.tipoBatida != null ? u.tipoBatida : '—'}</span>`;
    } else {
      html += '<span class="resumo-detalhe">Nenhuma batida registrada ainda.</span>';
    }
    html += '</div>';

    html += '<div class="resumo-bloco"><strong>Este mês (' + mesLbl + ')</strong><br/>';
    html += `<span class="resumo-valor">${r.totalBatidas || 0} batida(s)</span> · `;
    html += `<span class="resumo-detalhe">${r.diasComRegistro || 0} dia(s) com registro</span></div>`;

    const dias = r.porDia || [];
    if (dias.length) {
      html += '<div class="resumo-lista-titulo">Registros recentes no mês</div><ul class="resumo-lista">';
      for (const dia of dias.slice(0, 8)) {
        const hor = (dia.horarios || []).join(', ');
        html += `<li><span class="resumo-dia">${dia.dataDia}</span> — ${dia.qtd} batida(s): ${hor || '—'}</li>`;
      }
      html += '</ul>';
    }

    box.innerHTML = html;
  }

  function showLogin() {
    $('screen-login').style.display = 'block';
    $('screen-app').style.display = 'none';
  }

  function showApp() {
    $('screen-login').style.display = 'none';
    $('screen-app').style.display = 'block';
  }

  async function doLogin() {
    const codEmp = ($('codEmpresa') && $('codEmpresa').value.trim().toUpperCase()) || urlCodigo;
    const pin = ($('pin') && $('pin').value.replace(/\D/g, '')) || '';
    const cpf4 = ($('cpf4') && $('cpf4').value.replace(/\D/g, '')) || '';

    if (!codEmp) {
      setStatus('Informe o código da empresa.', true);
      return;
    }
    if (pin.length !== 6) {
      setStatus('A senha (PIN) deve ter 6 dígitos.', true);
      return;
    }

    const body = { c: codEmp, pin };
    if (urlToken) body.t = urlToken;
    else if (cpf4.length === 4) body.cpfUltimos4 = cpf4;
    else {
      setStatus('Informe os 4 últimos dígitos do seu CPF.', true);
      return;
    }

    setStatus('Entrando…');
    try {
      const res = await fetch(api('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        setStatus(
          'Resposta inválida do servidor (HTTP ' + res.status + '). Verifique a internet ou tente mais tarde.',
          true
        );
        return;
      }
      if (!data.ok) {
        let msg = data.error || 'Falha no login';
        if (data.code) msg += ' [' + data.code + ']';
        if (res.status === 403) {
          msg +=
            ' No admin: CPF com 11 dígitos, «Ponto ativo» e «Gerar PIN» após salvar o funcionário.';
        }
        setStatus(msg, true);
        return;
      }
      try {
        localStorage.setItem(LS_TOKEN, data.token);
        localStorage.setItem(LS_CFG, JSON.stringify(data.pontoConfig || {}));
        localStorage.setItem(LS_NOME_SESSAO, data.nome || '');
        localStorage.setItem(LS_COD_EMPRESA, codEmp);
      } catch (e2) {
        setStatus('Não foi possível salvar a sessão neste aparelho.', true);
        return;
      }
      $('appNome').textContent = data.nome || 'Colaborador';
      const cfg = data.pontoConfig || {};
      $('appCfg').textContent =
        (cfg.exigirFoto !== false ? 'Foto obrigatória em cada batida' : 'Foto opcional') +
        ' · Limite/dia: ' +
        (data.batidasPorDia && data.batidasPorDia > 0 ? data.batidasPorDia : 'sem limite');
      window.__pontoCfg = cfg;
      showApp();
      setStatus('');
      flushOutbox();
      carregarResumo();
    } catch (e) {
      setStatus('Erro de rede: ' + (e.message || e), true);
    }
  }

  async function executarBatidaComArquivo(file) {
    const token = getAuthToken();
    if (!token) {
      showLogin();
      return;
    }
    const cfg = window.__pontoCfg || {};
    const needPhoto = cfg.exigirFoto !== false;

    if (needPhoto && !file) {
      setStatus('É preciso tirar a foto para registrar.', true);
      return;
    }

    setStatus('Obtendo localização…');
    let geo;
    try {
      geo = await getGeo();
    } catch (e) {
      setStatus('GPS obrigatório: ative a localização e tente de novo.', true);
      return;
    }

    let dataUrl = '';
    if (needPhoto && file) {
      setStatus('Preparando foto…');
      try {
        dataUrl = await compressDataUrl(file, 1024, 0.72);
      } catch (e2) {
        setStatus('Não foi possível usar esta foto.', true);
        return;
      }
    }

    const b64 = dataUrl ? dataUrl.split(',')[1] : '';
    const payloadUpload = { base64: b64, contentType: 'image/jpeg' };
    const payloadReg = (fotoKey) => ({
      geo: { lat: geo.lat, lng: geo.lng },
      fotoKey: fotoKey || '',
      tipoBatida: 0
    });

    const wb = workerBase.replace(/\/$/, '');
    const offlineId = 'off_' + Date.now();

    if (!navigator.onLine) {
      outboxSave(
        outboxLoad().concat([
          {
            base64: b64,
            contentType: 'image/jpeg',
            geo: { lat: geo.lat, lng: geo.lng },
            tipoBatida: 0,
            offlineId,
            attempts: 0
          }
        ])
      );
      setStatus('Sem internet: batida guardada. Enviaremos quando voltar a rede.', false);
      return;
    }

    try {
      let fotoKey = '';
      if (needPhoto && b64) {
        setStatus('Enviando foto…');
        const up = await fetch(wb + '/api/upload-foto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(payloadUpload)
        });
        const ju = await up.json();
        if (!ju.ok) throw new Error(ju.error || 'Upload');
        fotoKey = ju.fotoKey;
      }

      setStatus('Registrando ponto…');
      const reg = await fetch(wb + '/api/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payloadReg(fotoKey))
      });
      const jr = await reg.json();
      if (!jr.ok) throw new Error(jr.error || 'Registro');
      setStatus('Ponto registrado em ' + (jr.dataDia || '') + ' ✓', false);
      flushOutbox();
      carregarResumo();
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  function abrirCameraERegistrar() {
    const cfg = window.__pontoCfg || {};
    const needPhoto = cfg.exigirFoto !== false;
    const fileInp = $('foto');
    if (!fileInp) return;

    if (!needPhoto) {
      executarBatidaComArquivo(null);
      return;
    }

    fileInp.value = '';
    fileInp.onchange = async () => {
      const f = fileInp.files && fileInp.files[0];
      fileInp.onchange = null;
      fileInp.value = '';
      if (!f) {
        setStatus('Registro cancelado (sem foto).', true);
        return;
      }
      await executarBatidaComArquivo(f);
    };
    fileInp.click();
  }

  function logout() {
    try {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_CFG);
      localStorage.removeItem(LS_NOME_SESSAO);
      localStorage.removeItem(LS_PONTO_QS);
    } catch (e) {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(LS_TOKEN);
      sessionStorage.removeItem(LS_CFG);
      sessionStorage.removeItem(LS_NOME_SESSAO);
    } catch (e2) {
      /* ignore */
    }
    showLogin();
  }

  window.__pontoDoLogin = doLogin;
  window.__pontoRegistrarPonto = abrirCameraERegistrar;
  window.__pontoLogout = logout;
  window.__pontoFlush = flushOutbox;
  window.__pontoRecarregarResumo = carregarResumo;

  document.addEventListener('DOMContentLoaded', () => {
    migrateSessionStorageToLocal();

    const codEl = $('codEmpresa');
    if (codEl) {
      codEl.value = urlCodigo || (function () {
        try {
          return localStorage.getItem(LS_COD_EMPRESA) || '';
        } catch (e) {
          return '';
        }
      })();
    }

    if (!urlToken) {
      const w4 = $('cpf4Wrap');
      if (w4) w4.style.display = 'block';
    }

    if (getAuthToken()) {
      try {
        window.__pontoCfg = JSON.parse(localStorage.getItem(LS_CFG) || '{}');
      } catch (e) {
        window.__pontoCfg = {};
      }
      $('appNome').textContent = localStorage.getItem(LS_NOME_SESSAO) || 'Colaborador';
      $('appCfg').textContent = '';
      showApp();
      flushOutbox();
      carregarResumo();
    } else {
      showLogin();
      if (!codEl || !codEl.value) {
        setStatus('Informe o código da empresa, os 4 últimos dígitos do CPF e o PIN.', false);
      }
    }

    window.addEventListener('online', () => {
      setStatus('Conexão restabelecida. Enviando fila…');
      flushOutbox();
    });
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
