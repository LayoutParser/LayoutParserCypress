const { defineConfig } = require("cypress");

const { lerManifesto, filtrarElegiveis } = require("./cypress/support/lib/manifest");
const { criarTasks } = require("./cypress/support/lib/tasks");
const { gerarSummary } = require("./cypress/support/lib/results");

module.exports = defineConfig({
  e2e: {
    // Placeholder de exemplo — a baseUrl real (LayoutParserApi de dev) vem de
    // cypress.env.json (gitignored). NÃO hardcodar URL definitiva aqui.
    // Exemplo: "http://localhost:5000"
    baseUrl: "http://localhost:5000",

    // O Job 2 fala com o Pollux dentro de uma cy.task (inserir + espera de protocolo +
    // consultar), o que estoura folgadamente o taskTimeout default de 60s.
    taskTimeout: 180000,

    setupNodeEvents(on, config) {
      // ── Job 2 (modo batch) — descoberta dos candidatos do Job 1 ──────────────────────
      //
      // A descoberta acontece AQUI, em Node, de forma síncrona, ANTES de a spec carregar.
      // Não use `cy.task` dentro de um `before()` para isso: o Mocha registra os `it()` no
      // load da spec e a task async só resolveria depois — não dá para criar casos
      // dinamicamente. É a parede em que se bate primeiro (§4 do handoff).
      //
      // Esta leitura DEGRADA em vez de estourar: uma exceção aqui derruba o Cypress antes de
      // escrever qualquer artefato, inclusive o cypress-summary.json.
      const runDir = process.env.LP_METRICS_RUN_DIR || null;
      const info = lerManifesto(runDir);

      if (info.erro) {
        console.warn(`[job2] ${info.erro}`);
        console.warn("[job2] Seguindo com 0 candidatos — a spec dá skip limpo e o verdict.js decide o exit code.");
      }

      const elegiveis = filtrarElegiveis(info.candidates);
      console.log(
        `[job2] runDir=${info.runDir ?? "(nenhum)"} runId=${info.runId ?? "(nenhum)"} ` +
          `candidatos=${info.candidates.length} elegiveis=${elegiveis.length}`
      );

      config.env.lpRunDir = info.runDir;
      config.env.lpRunId = info.runId;
      config.env.lpCandidates = info.candidates; // a spec filtra por eligibleForPollux (§4)

      on("task", criarTasks({ runDir: info.runDir, runId: info.runId, env: config.env }));

      let startedAt = new Date().toISOString();
      on("before:run", () => {
        startedAt = new Date().toISOString();
        return null;
      });

      // O summary é escrito no after:run, que roda mesmo com testes falhos (rejeição do
      // Pollux deixa o it() vermelho de propósito — ver §5.2).
      on("after:run", () => {
        if (!info.runDir) {
          console.warn("[job2] Sem runDir — cypress-summary.json não pode ser escrito.");
          return null;
        }
        try {
          const summary = gerarSummary(info.runDir, {
            runId: info.runId,
            startedAt,
            finishedAt: new Date().toISOString(),
            expected: elegiveis.length,
            manifestErro: info.erro,
          });
          console.log(
            `[job2] summary: total=${summary.total} accepted=${summary.accepted} ` +
              `rejected=${summary.rejected} infraError=${summary.infraError} ` +
              `posted=${summary.posted} verdict=${summary.verdict}`
          );
        } catch (e) {
          console.error(`[job2] Falha ao escrever cypress-summary.json: ${e.message}`);
        }
        return null;
      });

      return config;
    },

    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
  },
});
