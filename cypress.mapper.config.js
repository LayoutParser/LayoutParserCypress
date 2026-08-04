const { defineConfig } = require("cypress");
const config = require("./cypress.config");

// A spec usa URLs absolutas da API e do Pollux. Sem baseUrl o Cypress não faz um health
// check separado contra localhost antes de carregar o teste; indisponibilidade da API aparece
// no próprio passo que falhou, com o contexto do mapeador.
const { baseUrl: _baseUrlLocal, ...e2eSemBaseUrl } = config.e2e;

module.exports = defineConfig({
  ...config,
  allowCypressEnv: false,
  e2e: e2eSemBaseUrl,
});
