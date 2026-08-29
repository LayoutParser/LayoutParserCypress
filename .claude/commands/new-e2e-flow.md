---
description: Desenha e implementa um novo cenário e2e (UI+API/Ollama+Pollux ou API+Pollux direto).
---

# /new-e2e-flow

Uso: `/new-e2e-flow <layout GUID ou nome> <caminho do TXT> [via-ui|via-api]`

1. Invoque `@cy-architect` com missão `design-e2e-flow` passando layout + TXT — ele mapeia
   os passos (UI opcional → generate-for-layout → execute → Pollux) e o critério de veredito.
2. Com o desenho pronto:
   - `via-ui` (default se não especificado): `@qa-cypress` missão `e2e-ui-flow`.
   - `via-api`: `@qa-cypress` missão `add-spec` (padrão direto à API, como `nfe-emissao-normal.cy.js`).
3. Rode a suíte de verdade (`@qa-cypress` missão `run-suite`) — nunca declare sucesso sem rodar.
4. Se passou: `@cy-doc` missão `doc-flow` para registrar o novo cenário no README/CLAUDE.md.
5. Push fica com `@cy-devops`, só quando o usuário pedir.

Nunca invente GUID de layout ou caminho de TXT — peça ao usuário se não foi informado.
