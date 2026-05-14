/**
 * Textos de apoio à configuração de jornada — não substituem assessoria trabalhista.
 * Atualize JORNADA_LEGAL_REF.dataRevisao ao revisar os links e mensagens.
 */
const JORNADA_LEGAL_REF = {
  dataRevisao: '2026-05-14',
  urlClt: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm',
  urlMte: 'https://www.gov.br/trabalho-e-emprego/pt-br'
};

function jornadaLegalAvisoGeralHtml() {
  return `
    <div class="legal-disclaimer-box">
      <strong>Aviso importante</strong>
      <p>As explicações abaixo são <strong>resumos didáticos</strong> para ajudar na configuração do sistema.
      A legislação e a jurisprudência mudam; convenções coletivas (CCT) e contratos podem <strong>prevalecer</strong> sobre regras genéricas.
      Consulte sempre seu contador ou assessor jurídico. Referência textual consolidada da CLT:
      <a href="${JORNADA_LEGAL_REF.urlClt}" target="_blank" rel="noopener">Planalto (CLT)</a>.
      <span class="legal-ref-date">Textos de apoio revisados em: ${JORNADA_LEGAL_REF.dataRevisao}</span></p>
    </div>`;
}

function jornadaLegalDetalhe(titulo, corpoHtml) {
  return `
    <details class="legal-details-inline">
      <summary>${titulo}</summary>
      <div class="legal-details-body">${corpoHtml}</div>
    </details>`;
}

function jornadaLegalPoliticaBlocos() {
  return jornadaLegalDetalhe(
    'Saiba mais: horas extras, banco de horas e faltas (visão geral)',
    `<p>Em linha geral, a CLT trata de jornada, horas extraordinárias e regimes de compensação.
    O detalhamento (percentuais, prazos, banco de horas, feriados trabalhados) costuma ser combinado em <strong>norma coletiva</strong> ou acordo.</p>
    <p><a href="${JORNADA_LEGAL_REF.urlClt}" target="_blank" rel="noopener">Abrir CLT no Planalto</a> e buscar por “jornada”, “horas extraordinárias”, “banco de horas”.</p>`
  ) + jornadaLegalDetalhe(
    'Saiba mais: DSR (descanso semanal remunerado)',
    `<p>O DSR é direito do trabalhador urbano; a perda proporcional em caso de falta injustificada
    costuma estar ligada à semana de trabalho completa — a regra exata depende de caso e de CCT.</p>
    <p>Use o sistema para <strong>registrar e auditar</strong>; a decisão de aplicar ou não desconto deve ser validada profissionalmente.</p>
    <p><a href="${JORNADA_LEGAL_REF.urlClt}" target="_blank" rel="noopener">CLT (Planalto)</a></p>`
  ) + jornadaLegalDetalhe(
    'Saiba mais: feriados e trabalho em feriado',
    `<p>Feriados nacionais, estaduais e municipais variam. O trabalho em feriado pode ter tratamento diferenciado por lei ou por convenção.</p>
    <p>A importação de feriados nacionais neste sistema é <strong>apenas uma lista de datas comuns</strong>; confira sempre o calendário oficial e a CCT da sua categoria.</p>`
  );
}
