const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // Placeholder de exemplo — a baseUrl real (LayoutParserApi de dev) vem de
    // cypress.env.json (gitignored). NÃO hardcodar URL definitiva aqui.
    // Exemplo: "http://localhost:5000"
    baseUrl: "http://localhost:5000",
    setupNodeEvents(on, config) {
      // implementar listeners de node events aqui quando necessário
      return config;
    },
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
  },
});
