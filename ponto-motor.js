// Motor Sprint 4/5 — resumo mensal a partir de marcações + jornada (MVP operacional).

function pontoMotorMesKey(mes, ano) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

function pontoMotorParseEm(m) {
  if (!m) return null;
  if (m.em) {
    if (typeof m.em === 'string') return new Date(m.em);
    if (typeof m.em.toDate === 'function') return m.em.toDate();
    if (m.em.seconds != null) return new Date(m.em.seconds * 1000);
  }
  if (m.criadoEm) {
    if (typeof m.criadoEm === 'string') return new Date(m.criadoEm);
    if (typeof m.criadoEm.toDate === 'function') return m.criadoEm.toDate();
  }
  return null;
}

function pontoMotorDataKeySP(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function pontoMotorDiaSemanaSP(dateKey) {
  const [y, mo, da] = dateKey.split('-').map(Number);
  const d = new Date(`${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}T12:00:00-03:00`);
  return d.getDay();
}

function pontoMotorTimeToMin(t) {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function pontoMotorExpectedMinutes(diaCfg) {
  if (!diaCfg || diaCfg.ativo === false) return 0;
  const e = pontoMotorTimeToMin(diaCfg.entrada);
  const sa = pontoMotorTimeToMin(diaCfg.saidaAlmoco);
  const va = pontoMotorTimeToMin(diaCfg.voltaAlmoco);
  const s = pontoMotorTimeToMin(diaCfg.saida);
  if (s <= e) return 0;
  const almoco = va > sa ? va - sa : 0;
  return s - e - almoco;
}

function pontoMotorMergeJornadaDias(saved) {
  const def = [];
  const diaPadrao = { entrada: '08:00', saidaAlmoco: '12:00', voltaAlmoco: '13:00', saida: '17:00' };
  for (let d = 0; d <= 6; d++) {
    def.push({
      diaSemana: d,
      ativo: d >= 1 && d <= 5,
      entrada: diaPadrao.entrada,
      saidaAlmoco: diaPadrao.saidaAlmoco,
      voltaAlmoco: diaPadrao.voltaAlmoco,
      saida: diaPadrao.saida
    });
  }
  if (!Array.isArray(saved) || !saved.length) return def;
  const by = {};
  saved.forEach((x) => {
    if (x && typeof x.diaSemana === 'number') by[x.diaSemana] = x;
  });
  return def.map((row) => ({ ...row, ...(by[row.diaSemana] || {}) }));
}

function pontoMotorMergePolitica(saved) {
  return {
    toleranciaMinutos: 10,
    ...(saved || {})
  };
}

function pontoMotorWorkedMinutes(sortedDates) {
  const arr = sortedDates
    .map((d) => d.getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  if (arr.length < 2) return 0;
  if (arr.length === 2) return (arr[1] - arr[0]) / 60000;
  if (arr.length >= 4) {
    const e = arr[0];
    const s1 = arr[1];
    const e2 = arr[2];
    const s2 = arr[arr.length - 1];
    return (s2 - e - (e2 - s1)) / 60000;
  }
  return (arr[arr.length - 1] - arr[0]) / 60000;
}

function pontoMotorIsFeriado(feriadosList, dateKey) {
  return (feriadosList || []).some((f) => f && f.data === dateKey);
}

/**
 * @returns {Record<string, { horasExtras: number, diasTrabalhados: number, faltas: number }>}
 */
function calcularResumoPontoMes(opts) {
  const {
    mes,
    ano,
    funcionarios: funcs,
    marcacoesPonto: marcas,
    jornadaSettings,
    politicaJornada,
    feriados: feriadosList
  } = opts;

  const mesKey = pontoMotorMesKey(mes, ano);
  const diasCfg = pontoMotorMergeJornadaDias(jornadaSettings && jornadaSettings[0] ? jornadaSettings[0].dias : null);
  const politica = pontoMotorMergePolitica(politicaJornada && politicaJornada[0] ? politicaJornada[0] : null);
  const tol = Math.max(0, parseInt(politica.toleranciaMinutos, 10) || 0);

  const marcaNoMes = (marcas || []).filter((m) => {
    const dt = pontoMotorParseEm(m);
    if (!dt) return false;
    const k = pontoMotorDataKeySP(dt);
    return k.slice(0, 7) === mesKey;
  });

  const byFuncDia = {};
  for (const m of marcaNoMes) {
    const fid = m.funcionarioId;
    if (!fid) continue;
    const dt = pontoMotorParseEm(m);
    if (!dt) continue;
    const dk =
      typeof m.dataDia === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.dataDia)
        ? m.dataDia.slice(0, 10)
        : pontoMotorDataKeySP(dt);
    if (!byFuncDia[fid]) byFuncDia[fid] = {};
    if (!byFuncDia[fid][dk]) byFuncDia[fid][dk] = [];
    byFuncDia[fid][dk].push(dt);
  }

  const res = {};
  const diasNoMes = new Date(ano, mes, 0).getDate();

  for (const f of funcs || []) {
    if (f.ativo === false) continue;
    if (f.pontoAtivo === false) continue;
    if (!f.pontoPinHash) continue;

    let extraMin = 0;
    let faltas = 0;
    let diasTrabalhados = 0;

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dateKey = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const dow = pontoMotorDiaSemanaSP(dateKey);
      const diaCfg = diasCfg.find((d) => d.diaSemana === dow) || diasCfg[dow];
      const feriado = pontoMotorIsFeriado(feriadosList, dateKey);
      const expected = !feriado ? pontoMotorExpectedMinutes(diaCfg) : 0;
      const punches = (byFuncDia[f.id] && byFuncDia[f.id][dateKey]) || [];
      const worked = pontoMotorWorkedMinutes(punches);

      if (expected > 0) {
        if (punches.length === 0) {
          faltas += 1;
        } else if (worked + tol >= expected * 0.5) {
          diasTrabalhados += 1;
        }
        if (worked > expected + tol) {
          extraMin += worked - expected - tol;
        }
      } else {
        if (worked > tol) {
          extraMin += worked;
        }
      }
    }

    res[f.id] = {
      horasExtras: Math.round((extraMin / 60) * 10) / 10,
      diasTrabalhados,
      faltas
    };
  }

  return res;
}

function folhaPontoMesKey(mes, ano) {
  return pontoMotorMesKey(mes, ano);
}

function contarMarcacoesPontoMes(mes, ano, marcas) {
  const mk = pontoMotorMesKey(mes, ano);
  let n = 0;
  for (const m of marcas || []) {
    const dt = pontoMotorParseEm(m);
    if (!dt) continue;
    if (pontoMotorDataKeySP(dt).slice(0, 7) === mk) n++;
  }
  return n;
}
