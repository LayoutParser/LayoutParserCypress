// Cliente SOAP do e-forms/Pollux em Node PURO — a variante "soft" do fluxo já validado em
// cypress/support/commands.js (`cy.enviarNFeParaPolux`).
//
// POR QUE NODE E NÃO `cy.request`:
//   O requisito da §5.1.3 do handoff é "sempre resolve, nunca lança" — inclusive quando o
//   Pollux está inacessível (ECONNREFUSED/ENOTFOUND/timeout). `cy.request` NÃO tem catch:
//   uma falha de rede aborta o teste e o candidato ficaria SEM linha no NDJSON, que é
//   exatamente o dado (`infra_error`) que o Job 2 precisa registrar. Além disso, a §6.6 pede
//   que a lógica de I/O e POST viva em módulos Node reusáveis, para que o plano B (runner
//   sem Cypress, se o sudo for negado na VM) seja um `main()` novo e não uma reescrita.
//
// A diferença de comportamento em relação ao comando alpha é DELIBERADA e restrita a este
// caminho: "sem protocolo" aqui é `rejected` (medição), não crash. O oráculo de aceitação
// (cStat=100, com fallback nas mensagens textuais) é o MESMO da spec alpha.

const http = require("http");
const https = require("https");
const { URL } = require("url");

const OUTCOME_ACCEPTED = "accepted";
const OUTCOME_REJECTED = "rejected";
const OUTCOME_INFRA_ERROR = "infra_error";

const MSG_SUCESSO_GERAL = "Processo de consulta realizado com sucesso";
const MSG_SUCESSO_ITEM = "Processo realizado com sucesso";

/**
 * POST HTTP(S) que NUNCA rejeita — devolve `{ ok, status, body }` ou `{ ok: false, erro }`.
 */
function postXml({ url, body, timeoutMs = 60000, strictTls = false }) {
  return new Promise((resolve) => {
    let alvo;
    try {
      alvo = new URL(url);
    } catch (e) {
      resolve({ ok: false, erro: `URL inválida (${url}): ${e.message}` });
      return;
    }

    const cliente = alvo.protocol === "https:" ? https : http;
    const payload = Buffer.from(body, "utf8");

    const req = cliente.request(
      {
        protocol: alvo.protocol,
        hostname: alvo.hostname,
        port: alvo.port || (alvo.protocol === "https:" ? 443 : 80),
        path: `${alvo.pathname}${alvo.search}`,
        method: "POST",
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          "Content-Length": payload.length,
          SOAPAction: "",
        },
        // Mesmo comportamento do `cy.request` (que não valida cadeia TLS por padrão) —
        // o e-forms de dev usa certificado interno. `LP_POLLUX_STRICT_TLS=1` reativa a
        // validação sem mexer no código.
        rejectUnauthorized: strictTls === true,
      },
      (res) => {
        const pedacos = [];
        res.on("data", (d) => pedacos.push(d));
        res.on("end", () =>
          resolve({ ok: true, status: res.statusCode, body: Buffer.concat(pedacos).toString("utf8") })
        );
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`timeout após ${timeoutMs}ms`));
    });
    req.on("error", (e) => resolve({ ok: false, erro: `${e.code || "ERRO"}: ${e.message}` }));
    req.write(payload);
    req.end();
  });
}

function decodificarEntidades(texto) {
  if (typeof texto !== "string") return texto;
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&"); // por último, senão desfaz os anteriores
}

function desembrulharCdata(texto) {
  if (typeof texto !== "string") return texto;
  const m = texto.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : texto;
}

/**
 * Equivalente ao `getElementsByTagName(tag)[0].textContent` do DOMParser usado no comando
 * alpha: aceita prefixo de namespace, desembrulha CDATA e decodifica entidades.
 */
function extrairTexto(xml, tag) {
  if (typeof xml !== "string") return null;
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  const cru = desembrulharCdata(m[1]);
  return cru === m[1] ? decodificarEntidades(cru) : cru;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Submete um XML de NF-e ao Pollux e devolve o veredito. NUNCA rejeita nem lança.
 *
 * @returns {Promise<{outcome: 'accepted'|'rejected'|'infra_error', cStat: string|null,
 *   protocolo: string|null, mensagemGeral: string|null, mensagemItem: string|null,
 *   erro: string|null, httpStatusInsercao: number|null, httpStatusConsulta: number|null}>}
 */
async function enviarDocumento({
  xml,
  urlInserir,
  urlConsultar,
  envelopeInserir,
  envelopeConsultar,
  timeoutMs = 60000,
  esperaProtocoloMs = 5000,
  strictTls = false,
}) {
  const base = {
    outcome: OUTCOME_INFRA_ERROR,
    cStat: null,
    protocolo: null,
    mensagemGeral: null,
    mensagemItem: null,
    erro: null,
    httpStatusInsercao: null,
    httpStatusConsulta: null,
  };

  if (!urlInserir || !urlConsultar) {
    return {
      ...base,
      erro:
        "poluxUrlInserirDocumento/poluxUrlConsultarProtocolo não configurados em cypress.env.json — " +
        "não invente a URL, preencha o arquivo local.",
    };
  }
  if (typeof xml !== "string" || xml.trim() === "") {
    return { ...base, erro: "XML do candidato vazio ou ilegível." };
  }

  // ── 1. WSInserirDocumento ────────────────────────────────────────────────────────────
  const respInsercao = await postXml({
    url: urlInserir,
    body: envelopeInserir.replace("{{DOCUMENTO}}", xml),
    timeoutMs,
    strictTls,
  });

  if (!respInsercao.ok) {
    return { ...base, erro: `Pollux inacessível no WSInserirDocumento — ${respInsercao.erro}` };
  }
  base.httpStatusInsercao = respInsercao.status;

  if (respInsercao.status !== 200) {
    return {
      ...base,
      erro: `WSInserirDocumento respondeu HTTP ${respInsercao.status} (esperado 200). Corpo (truncado): ${String(
        respInsercao.body
      ).slice(0, 300)}`,
    };
  }

  const xmlInterno = extrairTexto(respInsercao.body, "eDocumentResult");
  if (!xmlInterno) {
    return {
      ...base,
      erro: `WSInserirDocumento não retornou eDocumentResult (resposta ilegível). Corpo (truncado): ${String(
        respInsercao.body
      ).slice(0, 300)}`,
    };
  }

  const protocolo = xmlInterno.match(/<protocolo>(.*?)<\/protocolo>/)?.[1] ?? null;
  const mensagemInsercao = xmlInterno.match(/<mensagem>(.*?)<\/mensagem>/)?.[1] ?? null;

  if (!protocolo) {
    // ⚠️ AQUI está a diferença deliberada em relação ao comando alpha: sem protocolo é
    // REJEIÇÃO (o Pollux respondeu e recusou) — dado que queremos, não falha de infra.
    return {
      ...base,
      outcome: OUTCOME_REJECTED,
      mensagemGeral: mensagemInsercao,
      erro: `Rejeitado na inserção (sem protocolo). Mensagem: ${
        mensagemInsercao ?? "(não encontrada)"
      }`,
    };
  }
  base.protocolo = protocolo;

  // Processamento assíncrono do e-forms antes da consulta ficar disponível (mesmo valor da
  // referência real usada pelo comando alpha).
  await espera(esperaProtocoloMs);

  // ── 2. WSConsultarProtocolo ──────────────────────────────────────────────────────────
  const respConsulta = await postXml({
    url: urlConsultar,
    body: envelopeConsultar.replace("{{PROTOCOLO}}", protocolo),
    timeoutMs,
    strictTls,
  });

  if (!respConsulta.ok) {
    return {
      ...base,
      erro: `Pollux inacessível no WSConsultarProtocolo (protocolo ${protocolo}) — ${respConsulta.erro}`,
    };
  }
  base.httpStatusConsulta = respConsulta.status;

  if (respConsulta.status !== 200) {
    return {
      ...base,
      erro: `WSConsultarProtocolo respondeu HTTP ${respConsulta.status} (esperado 200).`,
    };
  }

  const retorno = extrairTexto(respConsulta.body, "ConsultarProtocoloResult");
  if (!retorno) {
    return {
      ...base,
      erro: `WSConsultarProtocolo não retornou ConsultarProtocoloResult (resposta ilegível). Corpo (truncado): ${String(
        respConsulta.body
      ).slice(0, 300)}`,
    };
  }

  const blocoGeral = retorno.match(
    /<eformsConsultarProtocoloRetorno[\s\S]*?>([\s\S]*?)<\/eformsConsultarProtocoloRetorno>/i
  )?.[1];
  const blocoItem = retorno.match(/<itemprotocolo[\s\S]*?>([\s\S]*?)<\/itemprotocolo>/i)?.[1];

  const mensagemGeral = blocoGeral
    ? extrairTexto(
        (blocoGeral.split(/<itemprotocolo/i)[0] || blocoGeral).match(
          /<mensagemconsulta[\s\S]*?>([\s\S]*?)<\/mensagemconsulta>/i
        )?.[1] ?? "",
        "mensagem"
      )
    : null;

  const mensagemItem = blocoItem
    ? extrairTexto(
        blocoItem.match(/<mensagemconsulta[\s\S]*?>([\s\S]*?)<\/mensagemconsulta>/i)?.[1] ?? "",
        "mensagem"
      )
    : null;

  // cStat, quando presente, é o oráculo mais forte de autorização SEFAZ (100 = autorizado).
  const cStat = retorno.match(/<cStat>(\d+)<\/cStat>/)?.[1] ?? null;

  const resultado = { ...base, cStat, mensagemGeral, mensagemItem };

  if (cStat) {
    resultado.outcome = cStat === "100" ? OUTCOME_ACCEPTED : OUTCOME_REJECTED;
    if (resultado.outcome === OUTCOME_REJECTED) {
      resultado.erro = `Pollux recusou: cStat=${cStat}${
        mensagemGeral ? ` (${mensagemGeral})` : ""
      }`;
    }
    return resultado;
  }

  // Ambiente e-forms pode não expor cStat na consulta de protocolo — mesmo fallback textual
  // da spec alpha.
  if (mensagemGeral === MSG_SUCESSO_GERAL && mensagemItem === MSG_SUCESSO_ITEM) {
    resultado.outcome = OUTCOME_ACCEPTED;
    return resultado;
  }

  resultado.outcome = OUTCOME_REJECTED;
  resultado.erro = `Pollux não confirmou sucesso (sem cStat). mensagemGeral=${JSON.stringify(
    mensagemGeral
  )} mensagemItem=${JSON.stringify(mensagemItem)}`;
  return resultado;
}

module.exports = {
  OUTCOME_ACCEPTED,
  OUTCOME_REJECTED,
  OUTCOME_INFRA_ERROR,
  MSG_SUCESSO_GERAL,
  MSG_SUCESSO_ITEM,
  postXml,
  extrairTexto,
  decodificarEntidades,
  enviarDocumento,
};
