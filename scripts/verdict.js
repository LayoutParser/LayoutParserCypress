#!/usr/bin/env node
// Veredito do Job 2 (§5.2 do handoff-job2-cypress-batch.md).
//
// ESTE script define o exit code do Job 2 — NÃO o `cypress run`, cujo exit code é ignorado
// de propósito pelo run-cypress-batch.sh. Racional: no Job 2 o Cypress é instrumento de
// medição. Um XSLT que gera XML rejeitado pelo Pollux é resultado VÁLIDO (é justamente a
// métrica de negócio). Se rejeição virasse exit ≠ 0, o operador concluiria que o job quebrou.
//
//   Uso: node scripts/verdict.js <runDir>          (ou LP_METRICS_RUN_DIR no ambiente)
//
//   exit 0  PASS — todos os candidatos tiveram veredito (mesmo 100% rejected), ou nada elegível
//   exit 1  FAIL — houve infra_error, candidato sem medição, ou summary ausente/ilegível
//   exit 2  FAIL — manifesto do Job 1 ausente/ilegível: o Job 1 não entregou o contrato

const path = require("path");
const { lerManifesto, filtrarElegiveis } = require("../cypress/support/lib/manifest");
const { lerSummary, caminhoSummary, caminhoNdjson } = require("../cypress/support/lib/results");

function main() {
  const runDir = process.argv[2] || process.env.LP_METRICS_RUN_DIR || null;

  if (!runDir) {
    console.error(
      "[verdict] FAIL(2): run dir não informado. Passe como argumento ou exporte LP_METRICS_RUN_DIR."
    );
    return 2;
  }

  const absoluto = path.resolve(runDir);

  // 1. O contrato de ENTRADA existe? (checado ANTES do summary de propósito: sem manifesto,
  //    um summary com total=0 seria indistinguível de "rodada legítima sem candidatos".)
  const manifesto = lerManifesto(absoluto);
  if (manifesto.erro) {
    console.error(`[verdict] FAIL(2): ${manifesto.erro}`);
    console.error(`[verdict] Job 1 não entregou o run dir esperado em ${absoluto}.`);
    return 2;
  }

  const elegiveis = filtrarElegiveis(manifesto.candidates);

  // 2. O artefato de SAÍDA existe?
  const summary = lerSummary(absoluto);
  if (!summary) {
    console.error(`[verdict] FAIL(1): ${caminhoSummary(absoluto)} ausente ou ilegível.`);
    console.error(
      "[verdict] O after:run do Cypress não escreveu o summary — a suíte provavelmente nem chegou a rodar."
    );
    console.error(`[verdict] Confira ${caminhoNdjson(absoluto)} para ver o que chegou a ser medido.`);
    return 1;
  }

  console.log(
    `[verdict] runId=${summary.runId ?? "(nenhum)"} elegiveis=${elegiveis.length} ` +
      `total=${summary.total} accepted=${summary.accepted} rejected=${summary.rejected} ` +
      `infraError=${summary.infraError} posted=${summary.posted} postFailed=${summary.postFailed}`
  );

  if (summary.verdict === "PASS") {
    if (summary.total === 0) {
      console.log("[verdict] PASS(0): nenhum candidato elegível nesta rodada — nada a medir.");
    } else if (summary.accepted === 0) {
      // 100% rejeitado é PASS: o job mediu o que tinha que medir. O sinal de qualidade do
      // XSLT está no painel, não no exit code.
      console.log(
        `[verdict] PASS(0): ${summary.total} candidato(s) medido(s), nenhum aceito pelo Pollux. ` +
          "Rejeição é dado, não falha do job."
      );
    } else {
      console.log(`[verdict] PASS(0): ${summary.total} candidato(s) medido(s) com veredito do Pollux.`);
    }
    if (summary.postFailed > 0) {
      console.log(
        `[verdict] Aviso: ${summary.postFailed} resultado(s) não chegaram à API (posted=false). ` +
          `Reenvie com: npm run replay:results -- "${absoluto}"`
      );
    }
    return 0;
  }

  console.error(`[verdict] FAIL(1): ${summary.verdictReason ?? "veredito FAIL sem motivo registrado"}`);
  console.error(`[verdict] Detalhes por candidato em ${caminhoNdjson(absoluto)}`);
  return 1;
}

process.exit(main());
