const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

const {
  appendResult,
  gerarSummary,
  lerRegistros,
  lerSummary,
  montarRegistro,
} = require("../cypress/support/lib/results");

const repoDir = path.resolve(__dirname, "..");
const cypressCli = path.join(repoDir, "node_modules", "cypress", "bin", "cypress");

function executar(comando, args, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(comando, args, {
      cwd: repoDir,
      env: { ...process.env, ...opcoes.env },
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function respostaSoapInsercao(protocolo, mensagem = "Processado") {
  const interno = protocolo
    ? `<retorno><protocolo>${protocolo}</protocolo><mensagem>${mensagem}</mensagem></retorno>`
    : `<retorno><mensagem>${mensagem}</mensagem></retorno>`;
  const escapado = interno.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<soap:Envelope xmlns:soap="urn:test"><soap:Body><eDocumentResult>${escapado}</eDocumentResult></soap:Body></soap:Envelope>`;
}

function respostaSoapConsulta() {
  const interno =
    "<eformsConsultarProtocoloRetorno>" +
    "<mensagemconsulta><mensagem>Processo de consulta realizado com sucesso</mensagem></mensagemconsulta>" +
    "<listaprotocolo><itemprotocolo>" +
    "<mensagemconsulta><mensagem>Processo realizado com sucesso</mensagem></mensagemconsulta>" +
    "<cStat>100</cStat>" +
    "</itemprotocolo></listaprotocolo></eformsConsultarProtocoloRetorno>";
  const escapado = interno.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<soap:Envelope xmlns:soap="urn:test"><soap:Body><ConsultarProtocoloResult>${escapado}</ConsultarProtocoloResult></soap:Body></soap:Envelope>`;
}

function iniciarServicos() {
  const posts = [];
  let falharPrimeiroPost = true;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      res.setHeader("Content-Type", "text/xml; charset=utf-8");

      if (req.url === "/pollux/inserir") {
        res.end(
          body.includes("REJEITAR")
            ? respostaSoapInsercao(null, "Documento rejeitado pelo schema")
            : respostaSoapInsercao("PROTOCOLO-ACEITO")
        );
        return;
      }
      if (req.url === "/pollux/consultar") {
        res.end(respostaSoapConsulta());
        return;
      }
      if (req.url === "/api/ai-metrics/cypress-result") {
        res.setHeader("Content-Type", "application/json");
        posts.push(JSON.parse(body));
        if (falharPrimeiroPost) {
          falharPrimeiroPost = false;
          res.statusCode = 503;
          res.end('{"error":"falha simulada"}');
        } else {
          res.statusCode = 200;
          res.end("{}");
        }
        return;
      }

      res.statusCode = 404;
      res.end("not found");
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        posts,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
  });
}

function escreverRun(runDir) {
  fs.mkdirSync(path.join(runDir, "candidates"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "candidates", "aceito.xml"), "<NFe>ACEITAR</NFe>");
  fs.writeFileSync(path.join(runDir, "candidates", "rejeitado.xml"), "<NFe>REJEITAR</NFe>");
  fs.writeFileSync(
    path.join(runDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      runId: "20990101T000000Z",
      candidates: [
        {
          candidateId: "aceito",
          layout: "NFe\\4.00\\Aceito",
          eligibleForPollux: true,
          xmlPath: "candidates/aceito.xml",
        },
        {
          candidateId: "rejeitado",
          layout: "NFe\\4.00\\Rejeitado",
          eligibleForPollux: true,
          xmlPath: "candidates/rejeitado.xml",
        },
        {
          candidateId: "sem_xml",
          layout: "NFe\\4.00\\SemXml",
          eligibleForPollux: true,
          xmlPath: "candidates/inexistente.xml",
        },
      ],
    })
  );
}

test("Job 2 mede accepted/rejected/infra_error, persiste, posta e permite replay", { timeout: 180_000 }, async (t) => {
  assert.ok(fs.existsSync(cypressCli), `Cypress não instalado em ${cypressCli}`);

  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "layoutparser-job2-"));
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));
  escreverRun(runDir);

  const servicos = await iniciarServicos();
  t.after(() => servicos.server.close());

  const cacheWindows = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Cypress", "Cache")
    : undefined;
  const env = {
    LP_METRICS_RUN_DIR: runDir,
    LP_POLLUX_URL_INSERIR: `${servicos.baseUrl}/pollux/inserir`,
    LP_POLLUX_URL_CONSULTAR: `${servicos.baseUrl}/pollux/consultar`,
    LP_POLLUX_WAIT_MS: "0",
    LP_POLLUX_TIMEOUT_MS: "2000",
    LP_API_URL: servicos.baseUrl,
    ...(process.platform === "win32" && cacheWindows
      ? { CYPRESS_CACHE_FOLDER: cacheWindows }
      : {}),
  };

  const cypress = await executar(
    process.execPath,
    [
      cypressCli,
      "run",
      "--config-file",
      "cypress.batch.config.js",
      "--spec",
      "cypress/e2e/ia-candidates-batch.cy.js",
    ],
    { env }
  );
  assert.notEqual(cypress.code, 0, "rejected/infra_error devem deixar o relatório Cypress vermelho");

  const registros = lerRegistros(runDir).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  assert.ok(
    registros.length > 0,
    `Cypress não gravou resultados. exit=${cypress.code}\nstdout:\n${cypress.stdout}\nstderr:\n${cypress.stderr}`
  );
  assert.deepEqual(
    registros.map((r) => [r.candidateId, r.outcome]),
    [
      ["aceito", "accepted"],
      ["rejeitado", "rejected"],
      ["sem_xml", "infra_error"],
    ]
  );
  assert.equal(registros.find((r) => r.candidateId === "sem_xml").posted, false);
  assert.equal(servicos.posts.length, 2, "infra_error não pode ser postado");
  assert.equal(servicos.posts[0].layout, "NFe\\4.00\\Aceito", "layout deve ser preservado byte a byte");

  const summary = lerSummary(runDir);
  assert.equal(summary.total, 3);
  assert.equal(summary.accepted, 1);
  assert.equal(summary.rejected, 1);
  assert.equal(summary.infraError, 1);
  assert.equal(summary.verdict, "FAIL");

  const verdict = await executar(process.execPath, ["scripts/verdict.js", runDir], { env });
  assert.equal(verdict.code, 1, verdict.stderr || verdict.stdout);

  const replay = await executar(process.execPath, ["scripts/replay-results.js", runDir], { env });
  assert.equal(replay.code, 0, replay.stderr || replay.stdout);
  const depoisReplay = lerRegistros(runDir);
  assert.equal(
    depoisReplay.filter((r) => r.outcome !== "infra_error").every((r) => r.posted === true),
    true
  );
  const summaryDepoisReplay = lerSummary(runDir);
  assert.equal(summaryDepoisReplay.posted, 2);
  assert.equal(summaryDepoisReplay.postFailed, 0);
  assert.equal(summaryDepoisReplay.verdict, "FAIL", "replay não apaga o infra_error do Pollux");
});

test("Cypress executa lote vazio com skip, summary e PASS", { timeout: 120_000 }, async (t) => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "layoutparser-job2-empty-"));
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(runDir, "manifest.json"),
    JSON.stringify({ schemaVersion: 1, runId: "20990102T000000Z", candidates: [] })
  );
  const cacheWindows = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Cypress", "Cache")
    : undefined;
  const cypress = await executar(
    process.execPath,
    [
      cypressCli,
      "run",
      "--config-file",
      "cypress.batch.config.js",
      "--spec",
      "cypress/e2e/ia-candidates-batch.cy.js",
    ],
    {
      env: {
        LP_METRICS_RUN_DIR: runDir,
        ...(process.platform === "win32" && cacheWindows
          ? { CYPRESS_CACHE_FOLDER: cacheWindows }
          : {}),
      },
    }
  );
  assert.equal(cypress.code, 0, cypress.stderr || cypress.stdout);

  const summary = lerSummary(runDir);
  assert.equal(summary.total, 0);
  assert.equal(summary.verdict, "PASS");

  const vazio = await executar(process.execPath, ["scripts/verdict.js", runDir]);
  assert.equal(vazio.code, 0, vazio.stderr || vazio.stdout);
});

test("manifesto ausente é FAIL(2)", async (t) => {
  const semManifesto = fs.mkdtempSync(path.join(os.tmpdir(), "layoutparser-job2-missing-"));
  t.after(() => fs.rmSync(semManifesto, { recursive: true, force: true }));
  const ausente = await executar(process.execPath, ["scripts/verdict.js", semManifesto]);
  assert.equal(ausente.code, 2, ausente.stderr || ausente.stdout);
});

test("100% rejected continua PASS do Job 2", async (t) => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "layoutparser-job2-rejected-"));
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));
  const candidate = {
    candidateId: "rejeitado",
    layout: "NFe\\4.00\\Rejeitado",
    eligibleForPollux: true,
    xmlPath: "candidates/rejeitado.xml",
  };
  fs.writeFileSync(
    path.join(runDir, "manifest.json"),
    JSON.stringify({ schemaVersion: 1, runId: "20990103T000000Z", candidates: [candidate] })
  );
  appendResult(
    runDir,
    montarRegistro(candidate, { outcome: "rejected", cStat: "215" }, { runId: "20990103T000000Z" })
  );
  const summary = gerarSummary(runDir, { runId: "20990103T000000Z", expected: 1 });
  assert.equal(summary.rejected, 1);
  assert.equal(summary.infraError, 0);
  assert.equal(summary.verdict, "PASS");

  const verdict = await executar(process.execPath, ["scripts/verdict.js", runDir]);
  assert.equal(verdict.code, 0, verdict.stderr || verdict.stdout);
});
