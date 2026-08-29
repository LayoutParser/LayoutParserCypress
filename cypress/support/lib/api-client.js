// POST best-effort para a LayoutParserApi (contrato §3.2 do handoff-job2-cypress-batch.md).
//
//   POST {layoutParserApiUrl}/api/ai-metrics/cypress-result
//   { layout, cypressValidado, cStatPollux, observacao }
//
// REGRA: falha aqui NUNCA falha o candidato nem o Job 2 — a API pode estar parada no fim de
// semana. O disco (NDJSON) é a fonte da verdade; a linha fica com `posted: false` e o
// scripts/replay-results.js reenvia depois (o endpoint é idempotente por construção).
//
// Módulo Node PURO — sem Cypress.

const http = require("http");
const https = require("https");
const { URL } = require("url");

const ROTA_CYPRESS_RESULT = "/api/ai-metrics/cypress-result";

/** POST JSON que NUNCA rejeita. */
function postJson({ url, payload, timeoutMs = 15000, strictTls = true }) {
  return new Promise((resolve) => {
    let alvo;
    try {
      alvo = new URL(url);
    } catch (e) {
      resolve({ ok: false, erro: `URL inválida (${url}): ${e.message}` });
      return;
    }

    const cliente = alvo.protocol === "https:" ? https : http;
    const corpo = Buffer.from(JSON.stringify(payload), "utf8");

    const req = cliente.request(
      {
        protocol: alvo.protocol,
        hostname: alvo.hostname,
        port: alvo.port || (alvo.protocol === "https:" ? 443 : 80),
        path: `${alvo.pathname}${alvo.search}`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": corpo.length },
        rejectUnauthorized: strictTls !== false,
      },
      (res) => {
        const pedacos = [];
        res.on("data", (d) => pedacos.push(d));
        res.on("end", () =>
          resolve({ ok: true, status: res.statusCode, body: Buffer.concat(pedacos).toString("utf8") })
        );
      }
    );

    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout após ${timeoutMs}ms`)));
    req.on("error", (e) => resolve({ ok: false, erro: `${e.code || "ERRO"}: ${e.message}` }));
    req.write(corpo);
    req.end();
  });
}

/**
 * Envia o resultado de um candidato para o painel de métricas de IA.
 *
 * @param {{apiUrl: string|null, record: object, runId?: string|null, timeoutMs?: number}} opts
 * @returns {Promise<{posted: boolean, status?: number, erro?: string}>} nunca rejeita.
 */
async function postCypressResult({ apiUrl, record, timeoutMs = 15000 }) {
  // `infra_error` NÃO é postado (§3.2): `cypressValidado: null` no painel vira um "pendente"
  // indistinguível de "nunca rodou".
  if (record.outcome === "infra_error") {
    return { posted: false, erro: "infra_error não é postado (regra §3.2)" };
  }

  if (!apiUrl || typeof apiUrl !== "string" || apiUrl.trim() === "") {
    return {
      posted: false,
      erro:
        "layoutParserApiUrl não configurado (cypress.env.json ou env LP_API_URL) — " +
        "resultado gravado só em disco. Não invente a URL da API.",
    };
  }

  if (!record.layout) {
    return { posted: false, erro: "candidato sem `layout` no manifesto — POST inútil (layout é a chave de merge)." };
  }

  const url = `${apiUrl.replace(/\/+$/, "")}${ROTA_CYPRESS_RESULT}`;

  // ⚠️ `layout` vai byte-a-byte como veio do manifesto (com as barras invertidas). É a chave
  // de junção com o AiMetricsReaderService. Qualquer normalização quebra o merge em silêncio.
  const observacaoPartes = [];
  if (record.runId) observacaoPartes.push(`runId=${record.runId}`);
  if (record.protocolo) observacaoPartes.push(`protocolo=${record.protocolo}`);
  if (record.observacao) observacaoPartes.push(record.observacao);
  else if (record.mensagemGeral) observacaoPartes.push(record.mensagemGeral);

  const payload = {
    layout: record.layout,
    cypressValidado: record.cypressValidado,
    cStatPollux: record.cStatPollux,
    observacao: observacaoPartes.length ? observacaoPartes.join(" ") : null,
  };

  const resposta = await postJson({ url, payload, timeoutMs });

  if (!resposta.ok) return { posted: false, erro: `POST ${url} falhou — ${resposta.erro}` };
  if (resposta.status < 200 || resposta.status >= 300) {
    return {
      posted: false,
      status: resposta.status,
      erro: `POST ${url} respondeu HTTP ${resposta.status}: ${String(resposta.body).slice(0, 200)}`,
    };
  }
  return { posted: true, status: resposta.status };
}

module.exports = { ROTA_CYPRESS_RESULT, postJson, postCypressResult };
