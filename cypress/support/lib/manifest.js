// Leitura do manifesto do Job 1 (contrato §2 do handoff-job2-cypress-batch.md).
//
// Módulo Node PURO (sem dependência de Cypress) de propósito: é chamado de
// `setupNodeEvents` (cypress.config.js), do `scripts/verdict.js` e, se o plano B da §6.6
// for acionado (sudo negado na VM), de um runner Node sem Cypress — sem reescrita.
//
// REGRA CENTRAL: esta leitura DEGRADA, nunca estoura. Uma exceção em `setupNodeEvents`
// derruba o Cypress inteiro ANTES de qualquer teste rodar — e aí nem o cypress-summary.json
// é escrito. Manifesto ausente/ilegível/versão desconhecida => candidates: [] + aviso.
// Quem transforma "manifesto ilegível" em FAIL(2) é o scripts/verdict.js, não este módulo.

const fs = require("fs");
const path = require("path");

const MANIFEST_NAME = "manifest.json";
const SCHEMA_VERSION_SUPORTADA = 1;

/**
 * Lê o manifesto de um diretório de run do Job 1.
 *
 * @param {string|null|undefined} runDir Caminho absoluto do run dir ($LP_METRICS_RUN_DIR).
 * @returns {{runDir: string|null, runId: string|null, manifest: object|null,
 *            candidates: Array<object>, erro: string|null}}
 *   `erro !== null` significa "não consegui ler o contrato de entrada" — nunca é lançado.
 */
function lerManifesto(runDir) {
  const vazio = {
    runDir: runDir || null,
    runId: null,
    manifest: null,
    candidates: [],
    erro: null,
  };

  if (!runDir || typeof runDir !== "string" || runDir.trim() === "") {
    return {
      ...vazio,
      erro:
        "LP_METRICS_RUN_DIR não definido — não há run dir do Job 1 para consumir. " +
        "Não invente um caminho: exporte a variável ou passe o run dir como argumento.",
    };
  }

  const manifestPath = path.join(runDir, MANIFEST_NAME);

  let bruto;
  try {
    bruto = fs.readFileSync(manifestPath, "utf8");
  } catch (e) {
    return {
      ...vazio,
      erro: `manifest.json não pôde ser lido em ${manifestPath} (${e.code || e.message}). ` +
        "A presença do manifesto é o sinal de 'run do Job 1 completo' — sem ele não há o que medir.",
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(bruto);
  } catch (e) {
    return { ...vazio, erro: `manifest.json ilegível (JSON inválido) em ${manifestPath}: ${e.message}` };
  }

  if (!manifest || typeof manifest !== "object") {
    return { ...vazio, erro: `manifest.json em ${manifestPath} não é um objeto JSON.` };
  }

  if (manifest.schemaVersion !== SCHEMA_VERSION_SUPORTADA) {
    return {
      ...vazio,
      runId: typeof manifest.runId === "string" ? manifest.runId : null,
      erro:
        `manifest.json com schemaVersion=${JSON.stringify(manifest.schemaVersion)} — ` +
        `este Job 2 só entende schemaVersion=${SCHEMA_VERSION_SUPORTADA}. ` +
        "Tratando como manifesto ilegível em vez de adivinhar o formato.",
    };
  }

  const candidates = Array.isArray(manifest.candidates) ? manifest.candidates : [];

  // `candidates: []` é estado VÁLIDO (§2.5 do contrato): rodada legítima em que nada passou
  // na validação. Não é erro — não preencha `erro` aqui.
  return {
    runDir,
    runId: typeof manifest.runId === "string" ? manifest.runId : null,
    manifest,
    candidates,
    erro: null,
  };
}

/**
 * Filtra os candidatos elegíveis ao Pollux.
 *
 * O Job 2 NÃO reimplementa a regra de elegibilidade (§2.4 do contrato) — ela já vem decidida
 * pelo Job 1 no campo `eligibleForPollux`. Ampliar o escopo (cancelamento, CT-e) passa a ser
 * mudança só no Job 1, sem tocar nesta spec.
 */
function filtrarElegiveis(candidates) {
  return (Array.isArray(candidates) ? candidates : []).filter(
    (c) => c && c.eligibleForPollux === true
  );
}

/**
 * Resolve o caminho absoluto do XML de um candidato (xmlPath é relativo ao run dir).
 */
function caminhoXmlCandidato(runDir, candidate) {
  if (!candidate || !candidate.xmlPath) return null;
  return path.isAbsolute(candidate.xmlPath)
    ? candidate.xmlPath
    : path.join(runDir, candidate.xmlPath);
}

module.exports = {
  MANIFEST_NAME,
  SCHEMA_VERSION_SUPORTADA,
  lerManifesto,
  filtrarElegiveis,
  caminhoXmlCandidato,
};
