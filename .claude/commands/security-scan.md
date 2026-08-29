---
description: Varre o repo por segredos, credenciais e dado real de cliente commitados por engano.
---

# /security-scan

1. `git log --all --source -- cypress.env.json` — confirma que nunca foi commitado.
2. Grep por padrões de CNPJ (`\d{2}\.?\d{3}\.?\d{3}/\d{4}-\d{2}`), URL interna hardcoded, e
   chave/token em `cypress/`, `scripts/`, `test/`.
3. Confira `.gitignore` cobre `cypress.env.json`, `cypress.batch.config.js` (se local) e
   diretórios de resultado/run gerados.
4. Reporte achados a `@cy-devops`; nada aqui é corrigido automaticamente sem confirmação.
