#!/usr/bin/env node
// Reenvia à LayoutParserApi os resultados que ficaram com `posted: false` num run (§3.2).
//
// Existe porque o POST é best-effort: se a API estiver parada no fim de semana (que é
// exatamente quando o Job 1 roda, sábado 00:00), o disco preserva a medição e o replay
// recupera o painel sem repetir uma rodada de 3-4h. O endpoint de destino é idempotente por
// construção (merge lógico pela entrada mais recente por Layout), então reenviar é seguro.
//
//   Uso: node scripts/replay-results.js <runDir|runId>
//        node scripts/replay-results.js            (usa LP_METRICS_RUN_DIR)
//
// Resolução de <runId>: só funciona se LP_METRICS_HOME estiver definido
// (=> $LP_METRICS_HOME/runs/<runId>). Sem isso, informe o caminho completo — este script
// não adivinha caminho de VM.

const fs = require("fs");
const path = require("path");

const {
  lerRegistros,
  lerSummary,
  marcarPosted,
  gerarSummary,
  caminhoNdjson,
} = require("../cypress/support/lib/results");
const { postCypressResult } = require("../cypress/support/lib/api-client");

function resolverRunDir(entrada) {
  if (!entrada) return null;
  if (fs.existsSync(path.resolve(entrada))) return path.resolve(entrada);

  const metricsHome = process.env.LP_METRICS_HOME || null;
  if (metricsHome) {
    const candidato = path.join(metricsHome, "runs", entrada);
    if (fs.existsSync(candidato)) return candidato;
  }
  return null;
}

function lerApiUrl() {
  // Mesma precedência das tasks: override explícito do processo -> arquivo local.
  if (process.env.LP_API_URL) return process.env.LP_API_URL;

  const arquivo = path.resolve(__dirname, "..", "cypress.env.json");
  try {
    const env = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    if (env.layoutParserApiUrl) return env.layoutParserApiUrl;
  } catch (e) {
    /* sem cypress.env.json local — segue para a env var */
  }
  return null;
}

async function main() {
  const entrada = process.argv[2] || process.env.LP_METRICS_RUN_DIR || null;
  const runDir = resolverRunDir(entrada);

  if (!runDir) {
    console.error(
      `[replay] Run dir não encontrado a partir de ${JSON.stringify(entrada)}. ` +
        "Passe o caminho completo do run, ou defina LP_METRICS_HOME para resolver por runId."
    );
    return 2;
  }

  const apiUrl = lerApiUrl();
  if (!apiUrl) {
    console.error(
      "[replay] layoutParserApiUrl não configurado (cypress.env.json ou LP_API_URL). " +
        "Não invente a URL da API — preencha a configuração local."
    );
    return 2;
  }

  const registros = lerRegistros(runDir);
  if (registros.length === 0) {
    console.error(`[replay] Nenhum registro em ${caminhoNdjson(runDir)}.`);
    return 1;
  }

  const pendentes = registros.filter((r) => r.posted !== true && r.outcome !== "infra_error");
  console.log(
    `[replay] ${registros.length} registro(s) no run; ${pendentes.length} pendente(s) de envio.`
  );
  if (pendentes.length === 0) return 0;

  let enviados = 0;
  for (const registro of pendentes) {
    const resposta = await postCypressResult({ apiUrl, record: registro });
    marcarPosted(runDir, registro.candidateId, resposta.posted, resposta.erro || null);
    if (resposta.posted) {
      enviados += 1;
      console.log(`[replay] OK  ${registro.candidateId}`);
    } else {
      console.warn(`[replay] ERRO ${registro.candidateId} — ${resposta.erro}`);
    }
  }

  // O NDJSON é a fonte da verdade, mas o summary precisa continuar sendo um agregado fiel
  // depois do replay. Preservamos os tempos do run original e recalculamos os contadores.
  const summaryAnterior = lerSummary(runDir);
  if (summaryAnterior) {
    gerarSummary(runDir, {
      runId: summaryAnterior.runId,
      startedAt: summaryAnterior.startedAt,
      finishedAt: summaryAnterior.finishedAt,
      expected: summaryAnterior.expected,
    });
  }

  console.log(`[replay] ${enviados}/${pendentes.length} reenviado(s) com sucesso.`);
  return enviados === pendentes.length ? 0 : 1;
}

main().then((codigo) => process.exit(codigo));
