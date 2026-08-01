// Fábrica das `cy.task` do Job 2 — registrada em cypress.config.js (setupNodeEvents).
//
// Tudo que é I/O (disco, SOAP, POST) vive aqui, em Node puro, para que a spec fique só com a
// orquestração e o plano B da §6.6 (runner sem Cypress) reuse os mesmos módulos.
//
// `cy.task` NUNCA deve devolver `undefined` (o Cypress trata como "task não encontrada"),
// então toda task abaixo retorna um objeto — inclusive nos caminhos de erro.

const fs = require("fs");
const path = require("path");

const { caminhoXmlCandidato } = require("./manifest");
const { appendResult, marcarPosted, OUTCOME_INFRA_ERROR } = require("./results");
const { enviarDocumento } = require("./pollux");
const { postCypressResult } = require("./api-client");

const DIR_FIXTURES_WS = path.resolve(__dirname, "..", "..", "fixtures", "webservices");

function lerEnvelope(nome) {
  return fs.readFileSync(path.join(DIR_FIXTURES_WS, nome), "utf8");
}

/**
 * @param {{runDir: string|null, runId: string|null, env: object}} contexto
 *   `env` é o `config.env` já resolvido (cypress.env.json + variáveis de ambiente CYPRESS_*).
 */
function criarTasks(contexto) {
  const { runDir, runId, env } = contexto;

  // URLs NUNCA são inventadas aqui: se faltarem, o candidato vira `infra_error` com mensagem
  // explícita (ver pollux.enviarDocumento) em vez de apontar para um host plausível.
  const urlInserir = env.poluxUrlInserirDocumento || process.env.LP_POLLUX_URL_INSERIR || null;
  const urlConsultar = env.poluxUrlConsultarProtocolo || process.env.LP_POLLUX_URL_CONSULTAR || null;
  const apiUrl = env.layoutParserApiUrl || process.env.LP_API_URL || null;
  const strictTls = process.env.LP_POLLUX_STRICT_TLS === "1";
  const esperaProtocoloMs = Number(process.env.LP_POLLUX_WAIT_MS || 5000);
  const timeoutMs = Number(process.env.LP_POLLUX_TIMEOUT_MS || 60000);

  return {
    /**
     * Submete um candidato ao Pollux. SEMPRE resolve — nunca lança.
     * Aceita `{ candidate }` (lê o XML do run dir) ou `{ xml }` (conteúdo direto).
     */
    async enviarPollux({ candidate = null, xml = null } = {}) {
      const inicio = Date.now();

      if (!xml && candidate) {
        const caminho = caminhoXmlCandidato(runDir, candidate);
        if (!caminho) {
          return {
            outcome: OUTCOME_INFRA_ERROR,
            cStat: null,
            protocolo: null,
            mensagemGeral: null,
            mensagemItem: null,
            erro: `Candidato ${candidate.candidateId} sem xmlPath no manifesto.`,
            durationMs: Date.now() - inicio,
          };
        }
        try {
          xml = fs.readFileSync(caminho, "utf8");
        } catch (e) {
          return {
            outcome: OUTCOME_INFRA_ERROR,
            cStat: null,
            protocolo: null,
            mensagemGeral: null,
            mensagemItem: null,
            erro: `XML do candidato ilegível em ${caminho}: ${e.code || e.message}`,
            durationMs: Date.now() - inicio,
          };
        }
      }

      let resultado;
      try {
        resultado = await enviarDocumento({
          xml,
          urlInserir,
          urlConsultar,
          envelopeInserir: lerEnvelope("inserirDocumento.xml"),
          envelopeConsultar: lerEnvelope("consultarProtocolo.xml"),
          timeoutMs,
          esperaProtocoloMs,
          strictTls,
        });
      } catch (e) {
        // Rede de segurança: qualquer exceção inesperada vira infra_error, nunca derruba o run.
        resultado = {
          outcome: OUTCOME_INFRA_ERROR,
          cStat: null,
          protocolo: null,
          mensagemGeral: null,
          mensagemItem: null,
          erro: `Exceção inesperada ao falar com o Pollux: ${e && e.message ? e.message : String(e)}`,
        };
      }

      return { ...resultado, durationMs: Date.now() - inicio };
    },

    /** Append imediato no cypress-results.ndjson (disco = fonte da verdade). */
    appendResult({ record, onlyIfMissing = false } = {}) {
      if (!runDir) return { appended: false, erro: "sem runDir — nada gravado" };
      try {
        return appendResult(runDir, record, { onlyIfMissing });
      } catch (e) {
        console.error(`[job2] Falha ao gravar resultado de ${record && record.candidateId}: ${e.message}`);
        return { appended: false, erro: e.message };
      }
    },

    /** POST best-effort + atualização do flag `posted` na linha já gravada. */
    async postResult({ record } = {}) {
      const resposta = await postCypressResult({ apiUrl, record });
      if (runDir) {
        try {
          marcarPosted(runDir, record.candidateId, resposta.posted, resposta.erro || null);
        } catch (e) {
          console.warn(`[job2] Não consegui atualizar 'posted' de ${record.candidateId}: ${e.message}`);
        }
      }
      if (!resposta.posted && resposta.erro) console.warn(`[job2] POST não efetivado — ${resposta.erro}`);
      return resposta;
    },
  };
}

module.exports = { criarTasks, DIR_FIXTURES_WS };
