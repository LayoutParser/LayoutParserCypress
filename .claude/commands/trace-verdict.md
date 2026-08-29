---
description: Diagnostica por que um veredito do Pollux não chegou ou saiu diferente do esperado.
---

# /trace-verdict

Uso: `/trace-verdict <runId ou nome da spec>`

1. Confirme qual semântica aplica: gate padrão (`@qa-cypress` — rejeição fiscal = FALHA) ou
   batch de IA (`@cy-ai-flow` — só ausência de veredito = FALHA).
2. Inspecione `cypress/support/lib/pollux.js` (chamada de inserir/consultar protocolo) e o
   `taskTimeout` em `cypress.config.js`/`cypress.batch.config.js`.
3. Para o batch, cheque `cypress-summary.json` gerado (`accepted`/`rejected`/`infraError`/`posted`)
   e `scripts/verdict.js` para o exit code.
4. Reporte causa raiz (timeout de infra vs. rejeição fiscal genuína vs. bug de leitura de manifesto).
