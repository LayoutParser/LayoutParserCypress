// Job 2 — Cypress em modo batch (ver docs/architecture/handoff-job2-cypress-batch.md no
// repo LayoutParserApi).
//
// Consome os candidatos XML gerados pelo Job 1 (`ai/XslSynth --mode=metrics-batch`), submete
// cada um ao e-forms/Pollux (SEFAZ fake de dev) e grava o veredito em disco:
//
//   $LP_METRICS_RUN_DIR/cypress-results.ndjson   (append imediato, 1 linha por candidato)
//   $LP_METRICS_RUN_DIR/cypress-summary.json     (agregado, escrito no after:run)
//
// LEIA ANTES DE MEXER — este spec inverte a intuição usual de teste E2E:
//
//   • O Cypress aqui é INSTRUMENTO DE MEDIÇÃO, não gate de qualidade. Uma NF-e recusada pelo
//     Pollux (`rejected`) é o dado que queremos medir — NÃO é falha do job.
//   • O exit code do `cypress run` é IGNORADO pelo run-cypress-batch.sh. Quem decide o exit
//     code do Job 2 é o scripts/verdict.js, a partir do cypress-summary.json.
//   • Os `expect` no fim de cada it() existem só para o relatório do Cypress ficar legível
//     para inspeção humana (verde = aceito, vermelho = rejeitado/sem veredito).
//
// A descoberta dos candidatos acontece em cypress.config.js (setupNodeEvents), em Node,
// ANTES do load desta spec — aqui só se lê `Cypress.expose`, de forma síncrona. Ver §4 do handoff.

// `record.js` é o único módulo de lib/ sem dependência de `fs` — pode ser importado aqui
// (bundle do browser) e também pelas tasks em Node, sem duplicar o formato do registro.
const { montarRegistro } = require("../support/lib/record");

const candidatos = (Cypress.expose("lpCandidates") || []).filter(
  (c) => c && c.eligibleForPollux === true
);
const runId = Cypress.expose("lpRunId");
const runDir = Cypress.expose("lpRunDir");

describe("Job 2 — candidatos IA vs Pollux", () => {
  if (candidatos.length === 0) {
    // `candidates: []` é estado VÁLIDO do contrato (§2.5): rodada legítima em que nada passou
    // na validação do Job 1. Skip limpo, summary com total 0, veredito PASS.
    it("nenhum candidato elegível nesta rodada", function () {
      cy.log(`runDir=${runDir ?? "(nenhum)"} runId=${runId ?? "(nenhum)"}`);
      this.skip();
    });
    return;
  }

  // Mapa título -> candidato, usado pela rede de segurança do afterEach.
  const porTitulo = new Map();
  const gravados = new Set();

  candidatos.forEach((candidato) => {
    const titulo = `${candidato.candidateId}`;
    porTitulo.set(titulo, candidato);

    // Um it() por candidato: o Mocha já isola — um candidato que falha não impede os
    // seguintes de rodar e serem gravados (§5.1.1).
    it(titulo, () => {
      cy.enviarNFeParaPolluxSoft(candidato).then((resultado) => {
        cy.log(
          `[${candidato.candidateId}] outcome=${resultado.outcome} cStat=${resultado.cStat} ` +
            `protocolo=${resultado.protocolo}`
        );
        if (resultado.erro) cy.log(`[${candidato.candidateId}] detalhe: ${resultado.erro}`);

        const registro = montarRegistro(candidato, resultado, { runId });

        // ORDEM IMPORTA (§5.1.4): grava em disco -> POST best-effort -> só então asserta.
        // Se o assert falhar, o dado já está persistido.
        cy.task("appendResult", { record: registro }).then(() => {
          gravados.add(candidato.candidateId);

          cy.task("postResult", { record: registro }).then((respostaPost) => {
            if (!respostaPost.posted && respostaPost.erro) {
              cy.log(`[${candidato.candidateId}] POST não efetivado: ${respostaPost.erro}`);
            }

            // Assert só para leitura humana do relatório — não governa o exit code do Job 2.
            expect(
              resultado.outcome,
              `veredito do Pollux para ${candidato.candidateId}` +
                (resultado.erro ? ` — ${resultado.erro}` : "")
            ).to.eq("accepted");
          });
        });
      });
    });
  });

  // Rede de segurança: se um it() morrer por exceção inesperada ANTES do appendResult, o
  // candidato ficaria sem linha no NDJSON — e "sem veredito" precisa ficar registrado como
  // infra_error, não sumir. `onlyIfMissing` garante que isto nunca sobrescreve uma medição boa
  // (o caso comum: rejeição, que deixa o it() vermelho mas já gravou).
  afterEach(function () {
    const candidato = porTitulo.get(this.currentTest && this.currentTest.title);
    if (!candidato) return;
    if (gravados.has(candidato.candidateId)) return;
    if (this.currentTest.state === "passed") return;

    const erro = this.currentTest.err ? this.currentTest.err.message : "falha sem mensagem";
    cy.task("appendResult", {
      onlyIfMissing: true,
      record: montarRegistro(
        candidato,
        {
          outcome: "infra_error",
          erro: `Teste abortou antes de registrar o veredito: ${String(erro).slice(0, 400)}`,
        },
        { runId }
      ),
    });
  });
});
