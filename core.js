// =====================================================
// FIREBASE CONFIG
// =====================================================
const firebaseConfig = {
  apiKey: "AIzaSyAjLvQcgbdisKnuXap6ISE9-doao3HszKM",
  authDomain: "cadernogestor.firebaseapp.com",
  projectId: "cadernogestor",
  storageBucket: "cadernogestor.firebasestorage.app",
  messagingSenderId: "651102579775",
  appId: "1:651102579775:web:169a18acdcfc7d9ad15c8a",
  measurementId: "G-60MRP19E12"
};

// =====================================================
// APP STATE
// =====================================================
let db, auth;
let currentUser = null;
let currentOrg = null;
let funcionarios = [];
let grupos = [];
let emprestimos = [];
let vales = [];
let acertoPares = [];
let lancamentosCache = []; // cache de lançamentos do Firebase
let escalaSettings = [];
let escalaRules = [];
let escalaGerada = null;
let folhaAtualId = null;
let firebaseReady = false;
const APP_VERSION = '20260502d';

async function refreshAppCacheIfNeeded() {
  try {
    const previousVersion = localStorage.getItem('cgAppVersion');
    if (previousVersion === APP_VERSION) return;
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('cadernogestor-')).map(key => caches.delete(key)));
    }
    localStorage.setItem('cgAppVersion', APP_VERSION);
  } catch (error) {
    console.warn('Falha ao limpar caches antigos:', error?.message || error);
  }
}

// =====================================================
// INIT
// =====================================================
window.addEventListener('load', async () => {
  refreshAppCacheIfNeeded();
  const splashFailSafe = setTimeout(() => {
    const splash = document.getElementById('screen-splash');
    if (splash?.classList.contains('active')) {
      showScreen('auth');
    }
  }, 6000);

  // Se URL tem ?logout=1 ou ?trocar=1, fazer logout imediato antes de tudo
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('logout') === '1' || urlParams.get('trocar') === '1') {
    clearTimeout(splashFailSafe);
    clearAppLocalStorage();
    // Limpar param da URL sem recarregar
    window.history.replaceState({}, '', window.location.pathname);
    try {
      firebase.initializeApp(firebaseConfig);
      await firebase.auth().signOut();
    } catch(e) {}
    showScreen('auth');
    return;
  }

  setTimeout(async () => {
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      auth = firebase.auth();
      firebaseReady = true;

      // PRIMEIRO: verificar se voltou de um redirect Google
      try {
        const redirectResult = await auth.getRedirectResult();
        if (redirectResult?.user) {
          console.log('Redirect result OK:', redirectResult.user.email);
        }
      } catch(redirectErr) {
        console.warn('Redirect result error:', redirectErr.message);
      }

      // DEPOIS: escutar mudanças de auth normalmente
      auth.onAuthStateChanged(async user => {
        clearTimeout(splashFailSafe);
        if (user) {
          currentUser = user;
          const orgId = localStorage.getItem('cgOrgId');
          if (orgId) {
            await loadOrg(orgId);
            showScreen('app');
            await loadAllData();
          } else {
            showScreen('setup');
            setTimeout(() => {
              const emailEl = document.getElementById('setupUserEmail');
              if (emailEl && currentUser) {
                emailEl.textContent = 'Conta: ' + (currentUser.email || currentUser.displayName || '');
              }
            }, 100);
            // Tentar encontrar org automaticamente pelo UID
            buscarOrgDoUsuario(user.uid);
          }
        } else {
          showScreen('auth');
        }
      });
    } catch(e) {
      clearTimeout(splashFailSafe);
      console.warn('Firebase não configurado, modo demo:', e.message);
      showScreen('auth');
    }
  }, 1800);
});

// =====================================================
// SCREENS
// =====================================================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');

  if (name === 'app') {
    // Set date
    const d = new Date();
    document.getElementById('dashDate').textContent =
      d.toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});

    // Set default month/year
    document.getElementById('folhaMes').value = d.getMonth() + 1;
    document.getElementById('folhaAno').value = d.getFullYear();
    const escalaMes = document.getElementById('escalaMes');
    const escalaAno = document.getElementById('escalaAno');
    if (escalaMes) escalaMes.value = d.getMonth() + 1;
    if (escalaAno) escalaAno.value = d.getFullYear();
  }
}

// =====================================================
// AUTH
// =====================================================
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (i===0 && tab==='login') || (i===1 && tab==='register')));
  document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPassword').value;
  if (!email || !pass) { toast('Preencha e-mail e senha', 'error'); return; }

  if (!firebaseReady) {
    // Demo mode
    currentUser = { uid: 'demo', email, displayName: 'Usuário Demo' };
    handleAfterAuth();
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    toast('Erro: ' + e.message, 'error');
  }
}

async function doRegister() {
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const pass = document.getElementById('regPassword').value;
  if (!name || !email || !pass) { toast('Preencha todos os campos', 'error'); return; }

  if (!firebaseReady) {
    currentUser = { uid: 'demo', email, displayName: name };
    handleAfterAuth();
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    currentUser = cred.user;
  } catch(e) {
    toast('Erro: ' + e.message, 'error');
  }
}

async function doGoogleLogin() {
  if (!firebaseReady) {
    currentUser = { uid: 'demo', email: 'demo@email.com', displayName: 'Usuário Demo' };
    handleAfterAuth();
    return;
  }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // Detectar se está rodando como PWA (standalone) ou browser normal
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || document.referrer.includes('android-app://');

    // No PWA standalone: popup é obrigatório pois redirect perde o contexto
    // No browser mobile: também popup (mais moderno e confiável)
    // Só usar redirect se popup for bloqueado
    try {
      await auth.signInWithPopup(provider);
    } catch(popupErr) {
      if (popupErr.code === 'auth/popup-blocked') {
        // Popup bloqueado pelo browser  usar redirect como fallback
        if (!isStandalone) {
          await auth.signInWithRedirect(provider);
        } else {
          // No PWA, popup bloqueado é um problema sério
          toast('Permita popups para fazer login com Google no app instalado', 'error');
        }
      } else if (popupErr.code === 'auth/popup-closed-by-user') {
        // Usurio fechou  no mostrar erro
      } else {
        throw popupErr;
      }
    }
  } catch(e) {
    toast('Erro ao fazer login com Google: ' + (e.message || e.code), 'error');
  }
}

// Busca automtica de org pelo UID  resolve problema mobile
async function buscarOrgDoUsuario(uid) {
  if (!db || !uid) return;
  try {
    // Buscar orgs onde o usuário é membro
    const snap = await db.collection('orgs')
      .where('membroIds', 'array-contains', uid)
      .limit(1)
      .get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      const org = { id: doc.id, ...doc.data() };
      localStorage.setItem('cgOrgId', org.id);
      localStorage.setItem('cgOrgNome', org.nome || '');
      currentOrg = org;
      toast('Organização encontrada: ' + org.nome, 'success');
      afterOrgLoad();
    } else {
      // Tentar pelo campo dono
      const snap2 = await db.collection('orgs')
        .where('dono', '==', uid)
        .limit(1)
        .get();
      if (!snap2.empty) {
        const doc = snap2.docs[0];
        const org = { id: doc.id, ...doc.data() };
        localStorage.setItem('cgOrgId', org.id);
        localStorage.setItem('cgOrgNome', org.nome || '');
        currentOrg = org;
        toast('Organização encontrada: ' + org.nome, 'success');
        afterOrgLoad();
      }
    }
  } catch(e) {
    console.warn('buscarOrgDoUsuario:', e.message);
  }
}

function handleAfterAuth() {
  const orgId = localStorage.getItem('cgOrgId');
  if (orgId) {
    currentOrg = { id: orgId, nome: localStorage.getItem('cgOrgNome') || 'Minha Empresa' };
    afterOrgLoad();
  } else {
    showScreen('setup');
    // Mostrar email do usuário logado
    setTimeout(() => {
      const emailEl = document.getElementById('setupUserEmail');
      if (emailEl && currentUser) {
        emailEl.textContent = 'Conta: ' + (currentUser.email || currentUser.displayName || '');
      }
    }, 100);
  }
}

function doLogout() {
  localStorage.removeItem('cgOrgId');
  localStorage.removeItem('cgOrgNome');
  currentUser = null; currentOrg = null;
  funcionarios = []; grupos = []; emprestimos = []; vales = []; acertoPares = [];
  folhaDetalhe = {};
  if (auth) auth.signOut().catch(()=>{});
  showScreen('auth');
}

// Versão forçada  redireciona para URL com ?logout=1
// Garante funcionar mesmo quando JS está em estado inconsistente
function doLogoutForce() {
  clearAppLocalStorage();
  window.location.href = window.location.pathname + '?logout=1';
}

// =====================================================
// ORG SETUP
// =====================================================
function selectOrgOpt(opt) {
  document.getElementById('opt-create').classList.toggle('active', opt === 'create');
  document.getElementById('opt-join').classList.toggle('active', opt === 'join');
  document.getElementById('setup-create').style.display = opt === 'create' ? 'block' : 'none';
  document.getElementById('setup-join').style.display = opt === 'join' ? 'block' : 'none';
}

async function createOrg() {
  const nome = document.getElementById('orgName').value.trim();
  if (!nome) { toast('Informe o nome da empresa', 'error'); return; }

  const cnpj = document.getElementById('orgCnpj').value;
  const cidade = document.getElementById('orgCidade').value;
  const invite = Math.random().toString(36).substring(2,8).toUpperCase();

  const uid = currentUser?.uid || 'demo';
  const org = { nome, cnpj, cidade, invite, dono: uid,
    membroIds: [uid],
    adminIds: [uid],
    membros: [{ uid, nome: currentUser?.displayName || 'Você', role: 'gestor', email: currentUser?.email || '' }],
    criadoEm: new Date().toISOString() };

  if (db) {
    const ref = await db.collection('orgs').add(org);
    org.id = ref.id;
    // Atualizar membro com id
    await ref.update({ id: ref.id });
  } else {
    org.id = 'org_' + Date.now();
    localDB.setOrg(org.id, org);
  }

  localStorage.setItem('cgOrgId', org.id);
  localStorage.setItem('cgOrgNome', nome);
  currentOrg = org;
  afterOrgLoad();
}

async function joinOrg() {
  const code = document.getElementById('inviteCode').value.trim().toUpperCase();
  if (!code) { toast('Informe o código de convite', 'error'); return; }

  if (db) {
    const snap = await db.collection('orgs').where('invite', '==', code).get();
    if (snap.empty) { toast('Código inválido', 'error'); return; }
    const doc = snap.docs[0];
    const org = { id: doc.id, ...doc.data() };
    // Adicionar como membro
    const membros = org.membros || [];
    if (!membros.find(m => m.uid === currentUser.uid)) {
      membros.push({ uid: currentUser.uid, nome: currentUser.displayName, role: 'funcionario', email: currentUser.email });
      await syncOrgMembersAccess(doc.ref, membros);
    }
    localStorage.setItem('cgOrgId', org.id);
    localStorage.setItem('cgOrgNome', org.nome);
    currentOrg = {
      ...org,
      membros,
      membroIds: buildMemberIds(membros),
      adminIds: org.adminIds?.length ? org.adminIds : buildAdminIds(membros)
    };
    afterOrgLoad();
  } else {
    toast('Firebase no configurado  use modo demo', 'error');
  }
}

async function loadOrg(orgId) {
  if (db) {
    const doc = await db.collection('orgs').doc(orgId).get();
    if (doc.exists) { currentOrg = { id: doc.id, ...doc.data() }; }
    else { localStorage.removeItem('cgOrgId'); showScreen('setup'); }
  } else {
    const stored = localDB.getOrg(orgId);
    if (stored) currentOrg = stored;
    else { currentOrg = { id: orgId, nome: localStorage.getItem('cgOrgNome') || 'Demo', invite: 'DEMO01', membros: [] }; }
  }
}

function afterOrgLoad() {
  showScreen('app');
  updateOrgUI();
  loadAllData();
}

function updateOrgUI() {
  // Mostrar email na tela de setup
  const emailEl = document.getElementById('setupUserEmail');
  if (emailEl && currentUser) {
    emailEl.textContent = 'Conta: ' + (currentUser.email || currentUser.displayName || '');
  }
  if (!currentOrg) return;
  document.getElementById('currentOrgBadge').textContent = '🏢 ' + currentOrg.nome;
  document.getElementById('inviteDisplay').textContent = currentOrg.invite || '';
  const name = currentUser?.displayName || currentUser?.email || 'U';
  document.getElementById('userAvatar').textContent = name[0].toUpperCase();
  // Config fields
  document.getElementById('cfgNome').value = currentOrg.nome || '';
  document.getElementById('cfgCnpj').value = currentOrg.cnpj || '';
  document.getElementById('cfgCidade').value = currentOrg.cidade || '';
  document.getElementById('cfgResponsavel').value = currentOrg.responsavel || '';
}

// =====================================================
// LOCAL DB (fallback sem Firebase)
// =====================================================
const localDB = {
  get: (key) => { try { return JSON.parse(localStorage.getItem('cg_' + key) || 'null'); } catch { return null; } },
  set: (key, val) => localStorage.setItem('cg_' + key, JSON.stringify(val)),
  getOrg: (id) => { try { return JSON.parse(localStorage.getItem('cg_org_' + id) || 'null'); } catch { return null; } },
  setOrg: (id, val) => localStorage.setItem('cg_org_' + id, JSON.stringify(val)),
  collection: (orgId, col) => {
    const key = `${orgId}_${col}`;
    return {
      getAll: () => localDB.get(key) || [],
      set: (items) => localDB.set(key, items),
      add: (item) => {
        const items = localDB.get(key) || [];
        item.id = col + '_' + Date.now();
        items.push(item);
        localDB.set(key, items);
        return item;
      },
      update: (id, data) => {
        const items = localDB.get(key) || [];
        const idx = items.findIndex(i => i.id === id);
        if (idx >= 0) { items[idx] = {...items[idx], ...data}; localDB.set(key, items); }
      },
      delete: (id) => {
        const items = (localDB.get(key) || []).filter(i => i.id !== id);
        localDB.set(key, items);
      }
    };
  }
};

// DB helpers
function getCol(name) { return localDB.collection(currentOrg?.id || 'demo', name); }

async function fsGetAll(col) {
  if (db && currentOrg) {
    const snap = await db.collection('orgs').doc(currentOrg.id).collection(col).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return getCol(col).getAll();
}

async function fsAdd(col, data) {
  const clean = sanitizeData({...data, criadoEm: new Date().toISOString()});
  if (db && currentOrg) {
    const ref = await db.collection('orgs').doc(currentOrg.id).collection(col).add(clean);
    return { id: ref.id, ...clean };
  }
  return getCol(col).add(clean);
}

async function fsUpdate(col, id, data) {
  const clean = sanitizeData(data);
  if (db && currentOrg) {
    await db.collection('orgs').doc(currentOrg.id).collection(col).doc(id).update(clean);
    return;
  }
  getCol(col).update(id, clean);
}

async function fsDelete(col, id) {
  if (db && currentOrg) {
    await db.collection('orgs').doc(currentOrg.id).collection(col).doc(id).delete();
    return;
  }
  getCol(col).delete(id);
}

// =====================================================
// LOAD ALL DATA
// =====================================================
// Migração automática: garante que membroIds existe na org
async function garantirAcessosOrg() {
  if (!db || !currentOrg) return;
  try {
    const orgRef = db.collection('orgs').doc(currentOrg.id);
    const doc = await orgRef.get();
    if (!doc.exists) return;
    const data = doc.data();
    // Se membroIds não existe, criar a partir de membros
    const membros = data.membros || currentOrg.membros || [];
    const membroIds = buildMemberIds(membros);
    const adminIds = buildAdminIds(membros);
    const membroIdsIguais = JSON.stringify(data.membroIds || []) === JSON.stringify(membroIds);
    const adminIdsIguais = JSON.stringify(data.adminIds || []) === JSON.stringify(adminIds);

    currentOrg.membros = membros;
    currentOrg.membroIds = data.membroIds?.length ? data.membroIds : membroIds;
    currentOrg.adminIds = data.adminIds?.length ? data.adminIds : adminIds;

    if ((!membroIdsIguais || !adminIdsIguais) && (currentUser?.uid === data.dono || (data.adminIds || adminIds).includes(currentUser?.uid))) {
      await orgRef.update({ membroIds, adminIds });
      currentOrg.membroIds = membroIds;
      currentOrg.adminIds = adminIds;
    }
  } catch(e) {
    console.warn('Não foi possível verificar membroIds:', e.message);
  }
}

async function loadAllData() {
  updateOrgUI();
  // Garantir que membroIds existe na org (migração automática)
  await garantirAcessosOrg();
  try {
    [funcionarios, grupos, emprestimos, vales, acertoPares] = await Promise.all([
      fsGetAll('funcionarios'), fsGetAll('grupos'), fsGetAll('emprestimos'),
      fsGetAll('vales'), fsGetAll('acertoPares')
    ]);
    lancamentosCache = await fsGetAll('lancamentos');
  } catch(e) {
    console.warn('Erro ao carregar dados:', e.message);
    // Tentar carregar do localStorage como fallback
    funcionarios = getCol('funcionarios').getAll();
    grupos = getCol('grupos').getAll();
    emprestimos = getCol('emprestimos').getAll();
    vales = getCol('vales').getAll();
    acertoPares = getCol('acertoPares').getAll();
    if (e.code === 'permission-denied') {
      toast('⚠️ Permissões do Firebase precisam ser atualizadas. Usando dados locais.', 'error');
    }
  }
  [escalaSettings, escalaRules] = await Promise.all([
    fsGetAll('escalaSettings'),
    fsGetAll('escalaRules')
  ]);
  // Carregar cargos
  cargosLista = getCol('cargos').getAll().map(c => c.nome).filter(Boolean);
  if (cargosLista.length === 0) {
    cargosLista = ['AJUDANTE DE CARGA E DESCARGA','AUXILIAR ADMINISTRATIVO','AUXILIAR DE LIMPEZA','MOTORISTA','OPERADOR'];
  }
  renderDashboard();
  renderFuncionarios();
  renderGrupos();
  renderEmprestimos();
  renderVales();
  renderAcerto();
  renderEquipe();
  renderEscalaPage();
  renderHistoricoFolhas();
  populateSelects();
}

// =====================================================
// NAVIGATION
// =====================================================

// ── SIDEBAR MOBILE ──────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btn = document.getElementById('hamburgerBtn');
  const isOpen = sidebar?.classList.contains('open');
  sidebar?.classList.toggle('open', !isOpen);
  overlay?.classList.toggle('active', !isOpen);
  btn?.classList.toggle('open', !isOpen);
}

// Fechar sidebar ao navegar no mobile
function navigate(page) {
  // Fechar sidebar no mobile ao navegar
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
  document.getElementById('hamburgerBtn')?.classList.remove('open');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));

  const p = document.getElementById('page-' + page);
  if (p) p.classList.add('active');
  if (page === 'relatorio') populateRelatorioGrupos();
  if (page === 'calculadora') { calcRenderFita(); renderFitasSalvas(); }
  if (page === 'contratos') renderContratosLista();
  if (page === 'historico-acoes') renderHistoricoAcoes();
  if (page === 'historico-fin') renderHistoricoFin();
  if (page === 'historico-folha') renderHistoricoFolhas();
  if (page === 'folha') { const d=new Date(); document.getElementById('folhaMes').value=d.getMonth()+1; document.getElementById('folhaAno').value=d.getFullYear(); }
  if (page === 'dashboard') setTimeout(() => {
    if (typeof applyDashCalcLayout === 'function') applyDashCalcLayout();
    if (document.getElementById('dashCalcFita')) dashCalcRenderFita();
  }, 80);
  const n = document.getElementById('nav-' + page);
  if (n) n.classList.add('active');
  // Close dropdown
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.mobile-nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(`'${page}'`)) n.classList.add('active');
  });
  if (page === 'escala') renderEscalaPage();
}

// =====================================================
// MODALS
// =====================================================
function openModal(id) {
  document.getElementById(id).classList.add('active');
  // populate selects when opening
  if (id === 'modal-emprestimo' || id === 'modal-vale') populateSelects();
  if (id === 'modal-funcionario') { if (!document.getElementById('funcId').value) limparFormFuncionario(); populateGrupoSelect(); loadCargos(); toggleFuncInssType(); }
  if (id === 'modal-dash-config') openDashConfig();
  if (id === 'modal-acerto-par') popularSelectsPar();
  if (id === 'modal-lancamento') {
    populateLancPar();
    const editLanc = document.getElementById('lancEditId')?.value;
    if (!editLanc) {
      document.getElementById('lancValor').value = '';
      document.getElementById('lancDescricao').value = '';
      document.getElementById('lancData').value = new Date().toISOString().slice(0, 10);
      const titL = document.querySelector('#modal-lancamento .modal-title');
      if (titL) titL.textContent = 'Novo lançamento';
    }
  }
  if (id === 'modal-vale-lote') openValesLoteModal();
  if (id === 'modal-vale') {
    const vid = document.getElementById('valeId');
    if (vid && !vid.value) {
      // Novo vale  limpar campos
      document.getElementById('valeData').value = new Date().toISOString().slice(0,10);
      document.getElementById('valeValor').value = '';
      document.getElementById('valeDescricao').value = '';
      document.getElementById('valeTipo').value = 'integral';
      document.getElementById('valeNParcelas').value = '';
      document.getElementById('valeValorParc').value = '';
      const funcSel = document.getElementById('valeFuncionario');
      if (funcSel) funcSel.value = '';
      document.getElementById('valeTituloModal').textContent = 'Registrar Adiantamento';
      toggleValeParcelas();
    }
  }
  if (id === 'modal-grupo') { setTimeout(() => { renderGrupoFuncionariosCheck(document.getElementById('grupoId').value); atualizarResumoGrupo(); }, 50); }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (id === 'modal-lancamento') {
    const hid = document.getElementById('lancEditId');
    if (hid) hid.value = '';
    const tit = document.querySelector('#modal-lancamento .modal-title');
    if (tit) tit.textContent = 'Novo lançamento';
  }
}

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('active'); });
});

function toggleDropdown(id) {
  const m = document.getElementById(id);
  m.classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
  }
});

// =====================================================
// DASHBOARD
// =====================================================

// =====================================================
// FUNCIONÁRIOS
// =====================================================
let funcOrdemAZ = true;

function toggleOrdemFuncionarios() {
  funcOrdemAZ = !funcOrdemAZ;
  const icon = document.getElementById('ordemFuncIcon');
  if (icon) icon.textContent = funcOrdemAZ ? '↑' : '↓';
  const btn = document.querySelector('[onclick="toggleOrdemFuncionarios()"]');
  if (btn) btn.textContent = `⇅ ${funcOrdemAZ ? 'A-Z' : 'Z-A'}`;
  renderFuncionarios(document.getElementById('funcBuscaInput')?.value || '');
}

function filterFuncionarios(v) {
  const cargoFiltro = document.getElementById('funcCargoFiltro')?.value || '';
  renderFuncionarios(v, cargoFiltro);
}
