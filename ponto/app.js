(() => {
  // Manter IGUAL a PONTO_WORKER_URL_PADRAO em ponto-admin.js (troca global).
  const WORKER_URL_PADRAO = 'https://cadernogestor.luan-eu55.workers.dev';

  const params = new URLSearchParams(location.search);
  const c = (params.get('c') || '').trim().toUpperCase();
  const t = (params.get('t') || '').trim();
  const workerBase = normalizarWorkerUrl(WORKER_URL_PADRAO);
  const LS_TOKEN = 'cg_ponto_token_v1';
  const LS_CFG = 'cg_ponto_cfg_v1';
  const LS_NOME_SESSAO = 'cg_ponto_nome_sessao';
  const OUTBOX = 'cg_ponto_outbox_v1';

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
    const token = sessionStorage.getItem(LS_TOKEN);
    if (!token) return;
    let q = outboxLoad();
    if (!q.length) return;
    const next = [];
    for (const item of q) {
      try {
        const wb = workerBase.replace(/\/$/, '');
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
            tipoBatida: item.tipoBatida || 1,
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

  function showLogin() {
    $('screen-login').style.display = 'block';
    $('screen-app').style.display = 'none';
  }

  function showApp() {
    $('screen-login').style.display = 'none';
    $('screen-app').style.display = 'block';
  }

  async function doLogin() {
    const pin = ($('pin') && $('pin').value) ? $('pin').value.replace(/\D/g, '') : '';
    const cpfRaw = $('cpf') ? $('cpf').value : '';
    if (!c) {
      setStatus('Abra pelo link com código (c) da empresa ou digite o código na URL ?c=', true);
      return;
    }
    if (pin.length !== 6) {
      setStatus('PIN deve ter 6 dígitos.', true);
      return;
    }
    setStatus('Entrando…');
    try {
      const body = { c, pin, t };
      if (!t) body.cpf = cpfRaw;
      const res = await fetch(api('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus(data.error || 'Falha no login', true);
        return;
      }
      sessionStorage.setItem(LS_TOKEN, data.token);
      try {
        sessionStorage.setItem(LS_CFG, JSON.stringify(data.pontoConfig || {}));
      } catch (e2) { /* ignore */ }
      try {
        sessionStorage.setItem(LS_NOME_SESSAO, data.nome || '');
      } catch (e3) { /* ignore */ }
      $('appNome').textContent = data.nome || 'Colaborador';
      const cfg = data.pontoConfig || {};
      $('appCfg').textContent =
        'Foto: ' + (cfg.exigirFoto !== false ? 'obrigatória' : 'opcional') +
        ' · Batidas/dia: ' +
        (data.batidasPorDia && data.batidasPorDia > 0 ? data.batidasPorDia : 'sem limite');
      window.__pontoCfg = cfg;
      showApp();
      setStatus('');
      flushOutbox();
    } catch (e) {
      setStatus('Erro de rede: ' + (e.message || e), true);
    }
  }

  async function doBatida() {
    const token = sessionStorage.getItem(LS_TOKEN);
    if (!token) {
      showLogin();
      return;
    }
    const cfg = window.__pontoCfg || {};
    const needPhoto = cfg.exigirFoto !== false;
    const fileInp = $('foto');
    if (needPhoto && fileInp && !fileInp.files?.length) {
      setStatus('Tire a foto antes de registrar.', true);
      return;
    }

    setStatus('Obtendo GPS…');
    let geo;
    try {
      geo = await getGeo();
    } catch (e) {
      setStatus('GPS obrigatório: ative localização para o app.', true);
      return;
    }

    let dataUrl = '';
    if (needPhoto && fileInp?.files?.[0]) {
      setStatus('Preparando foto…');
      try {
        dataUrl = await compressDataUrl(fileInp.files[0], 1024, 0.72);
      } catch {
        setStatus('Não foi possível ler a foto.', true);
        return;
      }
    }

    const b64 = dataUrl ? dataUrl.split(',')[1] : '';

    const payloadUpload = { base64: b64, contentType: 'image/jpeg' };
    const payloadReg = (fotoKey) => ({
      geo: { lat: geo.lat, lng: geo.lng },
      fotoKey: fotoKey || '',
      tipoBatida: parseInt($('tipoBatida') && $('tipoBatida').value, 10) || 1
    });

    const wb = workerBase.replace(/\/$/, '');
    const offlineId = 'off_' + Date.now();

    if (!navigator.onLine) {
      outboxSave(
        outboxLoad().concat([
          {
            workerBase: wb,
            base64: b64,
            contentType: 'image/jpeg',
            geo: { lat: geo.lat, lng: geo.lng },
            tipoBatida: payloadReg('').tipoBatida,
            offlineId,
            attempts: 0
          }
        ])
      );
      setStatus('Sem internet: batida guardada. Enviamos quando voltar a rede.', false);
      if (fileInp) fileInp.value = '';
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

      setStatus('Registrando batida…');
      const reg = await fetch(wb + '/api/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payloadReg(fotoKey))
      });
      const jr = await reg.json();
      if (!jr.ok) throw new Error(jr.error || 'Registro');
      setStatus('Batida registrada em ' + (jr.dataDia || '') + ' ✓', false);
      if (fileInp) fileInp.value = '';
      flushOutbox();
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  function logout() {
    sessionStorage.removeItem(LS_TOKEN);
    sessionStorage.removeItem(LS_NOME_SESSAO);
    try {
      sessionStorage.removeItem(LS_CFG);
    } catch (e) { /* ignore */ }
    showLogin();
  }

  window.__pontoDoLogin = doLogin;
  window.__pontoDoBatida = doBatida;
  window.__pontoLogout = logout;
  window.__pontoFlush = flushOutbox;

  document.addEventListener('DOMContentLoaded', () => {
    if (!c) {
      setStatus('Código da empresa ausente. Use o link enviado pelo RH ou ?c=CÓDIGO na URL.', true);
    }
    if (sessionStorage.getItem(LS_TOKEN)) {
      try {
        window.__pontoCfg = JSON.parse(sessionStorage.getItem(LS_CFG) || '{}');
      } catch (e) {
        window.__pontoCfg = {};
      }
      $('appNome').textContent = sessionStorage.getItem(LS_NOME_SESSAO) || 'Colaborador';
      $('appCfg').textContent = '';
      showApp();
      flushOutbox();
    } else {
      showLogin();
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
