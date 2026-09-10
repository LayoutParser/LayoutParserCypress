// Obtenção de token M2M (client_credentials, Microsoft Entra ID) para autenticar chamadas de
// serviço ao endpoint [Authorize] POST /api/TransformationExecution/execute-lowcode.
//
// Módulo Node PURO (sem Cypress) — roda dentro de uma cy.task para que o client secret NUNCA
// trafegue para o processo do browser onde a spec executa (diferente de Cypress.expose(), que
// expõe valores ao contexto de teste no browser). Ver cypress/support/lib/tasks.js.
//
// Cacheia o token em memória do processo Node (setupNodeEvents roda uma vez por `cypress run`)
// até ~60s antes do `expires_in` reportado pela Microsoft, evitando um round-trip ao Entra ID
// por it() quando a suíte cresce.

const https = require("https");
const { URL } = require("url");

let cache = { accessToken: null, expiresAt: 0 };

function postForm({ url, form, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    let alvo;
    try {
      alvo = new URL(url);
    } catch (e) {
      reject(new Error(`m2mTokenUrl inválida (${url}): ${e.message}`));
      return;
    }

    const corpo = Buffer.from(
      Object.entries(form)
        .map(([chave, valor]) => `${encodeURIComponent(chave)}=${encodeURIComponent(valor)}`)
        .join("&"),
      "utf8"
    );

    const req = https.request(
      {
        protocol: alvo.protocol,
        hostname: alvo.hostname,
        port: alvo.port || 443,
        path: `${alvo.pathname}${alvo.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": corpo.length,
        },
      },
      (res) => {
        const pedacos = [];
        res.on("data", (d) => pedacos.push(d));
        res.on("end", () => {
          const bruto = Buffer.concat(pedacos).toString("utf8");
          resolve({ status: res.statusCode, body: bruto });
        });
      }
    );

    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout após ${timeoutMs}ms ao chamar ${url}`)));
    req.on("error", (e) => reject(e));
    req.write(corpo);
    req.end();
  });
}

/**
 * @param {{tokenUrl: string, clientId: string, clientSecret: string, scope: string}} opts
 * @returns {Promise<{accessToken: string, statusCode: number, cached: boolean}>}
 *   NUNCA inventa token — lança erro explícito se alguma variável faltar ou se o Entra ID
 *   recusar (o erro carrega o corpo bruto retornado, truncado, para diagnóstico real).
 */
async function obterTokenM2M({ tokenUrl, clientId, clientSecret, scope }) {
  if (!tokenUrl || !clientId || !clientSecret || !scope) {
    throw new Error(
      "Config M2M incompleta (m2mTokenUrl/m2mClientId/m2mClientSecret/m2mScope) — " +
        "preencher cypress.env.json local, não hardcodar."
    );
  }

  const agora = Date.now();
  if (cache.accessToken && cache.expiresAt > agora) {
    return { accessToken: cache.accessToken, statusCode: 200, cached: true };
  }

  const resposta = await postForm({
    url: tokenUrl,
    form: {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    },
  });

  let payload;
  try {
    payload = JSON.parse(resposta.body);
  } catch (e) {
    throw new Error(
      `Resposta do token endpoint (${resposta.status}) não é JSON válido: ${resposta.body.slice(0, 500)}`
    );
  }

  if (resposta.status < 200 || resposta.status >= 300 || !payload.access_token) {
    throw new Error(
      `Falha ao obter token M2M (HTTP ${resposta.status}): ${JSON.stringify(payload).slice(0, 800)}`
    );
  }

  const expiresInSeg = Number(payload.expires_in || 3600);
  cache = {
    accessToken: payload.access_token,
    expiresAt: agora + Math.max(0, (expiresInSeg - 60) * 1000),
  };

  return { accessToken: payload.access_token, statusCode: resposta.status, cached: false };
}

module.exports = { obterTokenM2M };
