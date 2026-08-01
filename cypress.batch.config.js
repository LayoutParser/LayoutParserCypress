const { defineConfig } = require("cypress");
const config = require("./cypress.config");

// O Job 2 fala apenas com URLs absolutas (Pollux + API de métricas). Herdar a baseUrl da
// suíte alpha faria o Cypress tentar validar a LayoutParserApi antes de carregar a spec e
// abortar o run quando a API estivesse fora — impedindo até a gravação do infra_error.
// Omitir a propriedade é diferente de passar `--config baseUrl=`: no Cypress 15 esse valor
// vazio não remove a baseUrl já definida no arquivo principal.
const { baseUrl: _baseUrlAlpha, ...e2eSemBaseUrl } = config.e2e;

module.exports = defineConfig({
  ...config,
  allowCypressEnv: false,
  e2e: e2eSemBaseUrl,
});
