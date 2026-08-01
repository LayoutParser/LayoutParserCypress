// Artefatos de SAÍDA do Job 2 (contrato §3.1 do handoff-job2-cypress-batch.md).
//
//   $LP_METRICS_RUN_DIR/cypress-results.ndjson  — 1 linha por candidato, APPEND imediato
//   $LP_METRICS_RUN_DIR/cypress-summary.json    — agregação, escrita no after:run
//
// Disco é a fonte da verdade; a API é best-effort. O append acontece assim que o candidato
// termina (não no fim da suíte) justamente para que uma suíte que morra no meio preserve o
// que já mediu.
//
// Módulo Node PURO — sem Cypress. Ver comentário de topo em manifest.js.

const fs = require("fs");
const path = require("path");

const {
  SCHEMA_VERSION,
  OUTCOME_ACCEPTED,
  OUTCOME_REJECTED,
  OUTCOME_INFRA_ERROR,
  montarRegistro,
} = require("./record");

const NDJSON_NAME = "cypress-results.ndjson";
const SUMMARY_NAME = "cypress-summary.json";

function caminhoNdjson(runDir) {
  return path.join(runDir, NDJSON_NAME);
}

function caminhoSummary(runDir) {
  return path.join(runDir, SUMMARY_NAME);
}

/** Escrita atômica: grava .tmp e renomeia — nunca deixa um artefato meio escrito no disco. */
function escreverAtomico(destino, conteudo) {
  const tmp = `${destino}.tmp`;
  fs.writeFileSync(tmp, conteudo, "utf8");
  fs.renameSync(tmp, destino);
}

/**
 * Lê os registros já gravados. Linhas corrompidas são ignoradas com aviso — um NDJSON
 * parcialmente escrito (processo morto no meio de um append) não pode derrubar o summary.
 */
function lerRegistros(runDir) {
  const arquivo = caminhoNdjson(runDir);
  let bruto;
  try {
    bruto = fs.readFileSync(arquivo, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") {
      console.warn(`[job2] Falha ao ler ${arquivo}: ${e.message}`);
    }
    return [];
  }

  const registros = [];
  bruto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .forEach((linha, i) => {
      try {
        registros.push(JSON.parse(linha));
      } catch (e) {
        console.warn(`[job2] Linha ${i + 1} de ${NDJSON_NAME} ilegível, ignorada: ${e.message}`);
      }
    });
  return registros;
}

function reescreverRegistros(runDir, registros) {
  const conteudo = registros.map((r) => JSON.stringify(r)).join("\n") + (registros.length ? "\n" : "");
  escreverAtomico(caminhoNdjson(runDir), conteudo);
}

/**
 * Grava (append) o resultado de UM candidato.
 *
 * @param {string} runDir
 * @param {object} record Registro já montado (ver montarRegistro).
 * @param {{onlyIfMissing?: boolean}} opcoes
 *   `onlyIfMissing` é usado pela rede de segurança do afterEach da spec: só grava se aquele
 *   candidato ainda não tiver linha, para não sobrescrever uma medição boa com um erro genérico.
 * @returns {{appended: boolean, motivo?: string, arquivo: string}}
 */
function appendResult(runDir, record, opcoes = {}) {
  const arquivo = caminhoNdjson(runDir);
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });

  const existentes = lerRegistros(runDir);
  const idx = existentes.findIndex((r) => r && r.candidateId === record.candidateId);

  if (idx >= 0) {
    if (opcoes.onlyIfMissing) {
      return { appended: false, motivo: "ja-existe", arquivo };
    }
    // Medição nova para o mesmo candidato substitui a anterior — mantém 1 linha por candidato.
    existentes[idx] = record;
    reescreverRegistros(runDir, existentes);
    return { appended: true, motivo: "substituido", arquivo };
  }

  fs.appendFileSync(arquivo, JSON.stringify(record) + "\n", "utf8");
  return { appended: true, arquivo };
}

/** Atualiza o flag `posted` de um candidato já gravado (chamado depois do POST best-effort). */
function marcarPosted(runDir, candidateId, posted, observacaoPost) {
  const registros = lerRegistros(runDir);
  const idx = registros.findIndex((r) => r && r.candidateId === candidateId);
  if (idx < 0) return { atualizado: false, motivo: "registro-nao-encontrado" };

  registros[idx].posted = posted === true;
  if (observacaoPost) registros[idx].postError = observacaoPost;
  else delete registros[idx].postError;

  reescreverRegistros(runDir, registros);
  return { atualizado: true };
}

/**
 * Agrega o NDJSON e grava o cypress-summary.json (contrato §3.1).
 *
 * @param {string} runDir
 * @param {{startedAt?: string, finishedAt?: string, expected?: number|null,
 *          manifestErro?: string|null}} meta
 *   `expected` = quantidade de candidatos elegíveis do manifesto. Se vieram menos vereditos
 *   do que o esperado, algum candidato ficou sem medição — isso é FAIL (§5.2).
 */
function gerarSummary(runDir, meta = {}) {
  const registros = lerRegistros(runDir);

  const total = registros.length;
  const accepted = registros.filter((r) => r.outcome === OUTCOME_ACCEPTED).length;
  const rejected = registros.filter((r) => r.outcome === OUTCOME_REJECTED).length;
  const infraError = registros.filter((r) => r.outcome === OUTCOME_INFRA_ERROR).length;
  const posted = registros.filter((r) => r.posted === true).length;
  const postaveis = registros.filter((r) => r.outcome !== OUTCOME_INFRA_ERROR).length;
  const postFailed = postaveis - posted;

  const expected = typeof meta.expected === "number" ? meta.expected : null;
  const missing = expected !== null ? Math.max(0, expected - total) : 0;

  const motivos = [];
  if (meta.manifestErro) motivos.push(`manifesto do Job 1 ilegível/ausente: ${meta.manifestErro}`);
  if (infraError > 0) motivos.push(`${infraError} candidato(s) sem veredito do Pollux (infra_error)`);
  if (missing > 0)
    motivos.push(`${missing} candidato(s) elegível(is) sem linha no NDJSON (não mediram)`);

  const verdict = motivos.length === 0 ? "PASS" : "FAIL";

  const summary = {
    schemaVersion: SCHEMA_VERSION,
    runId: meta.runId ?? (registros[0] && registros[0].runId) ?? null,
    startedAt: meta.startedAt ?? null,
    finishedAt: meta.finishedAt ?? new Date().toISOString(),
    total,
    expected,
    missing,
    accepted,
    rejected,
    infraError,
    posted,
    postFailed,
    verdict,
    // 100% rejected é PASS de propósito: rejeição é o DADO que queremos, não falha do job.
    verdictReason: motivos.length === 0 ? null : motivos.join("; "),
  };

  fs.mkdirSync(runDir, { recursive: true });
  escreverAtomico(caminhoSummary(runDir), JSON.stringify(summary, null, 2) + "\n");
  return summary;
}

function lerSummary(runDir) {
  try {
    return JSON.parse(fs.readFileSync(caminhoSummary(runDir), "utf8"));
  } catch (e) {
    return null;
  }
}

module.exports = {
  NDJSON_NAME,
  SUMMARY_NAME,
  SCHEMA_VERSION,
  OUTCOME_ACCEPTED,
  OUTCOME_REJECTED,
  OUTCOME_INFRA_ERROR,
  caminhoNdjson,
  caminhoSummary,
  lerRegistros,
  appendResult,
  marcarPosted,
  montarRegistro, // reexportado de ./record (usado por tasks/replay/plano B)
  gerarSummary,
  lerSummary,
};
