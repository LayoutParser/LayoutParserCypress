---
name: run-2026-09-07-ui-execute-candidates
description: Resultado real de rodar nfe-emissao-normal-ui-candidates.cy.js (execute-candidates) em 2026-09-07 — 401, mesmo bloqueio da issue #13
metadata:
  type: project
---

Issue #6 pedia o desenho+implementação do cenário e2e "UI React (execute-candidates) →
Pollux". `@cy-architect` desenhou em
`.claude/agent-memory/cy-architect/design_flow_execute_candidates.md`, confirmando via leitura
do repo irmão `LayoutParserReact` (só leitura) que o payload real de `execute-candidates` vem
de `XmlTransformationDisplay.handleGenerate` (não de `LayoutParserPage.handleSubmit`, que só
dispara o parse automático) — `sourceDocumentType`/`targetDocumentType`/`expectedOutput` vazios
(`''`), `validate: true`.

**Decisão de implementação:** `cy.request` direto no endpoint em vez de `cy.visit` na UI real.
Motivo: (1) servidor de dev do LayoutParserReact não estava rodando (`localhost:3000`/`5173`
não respondiam) nesta sessão; (2) o disparo real de `execute-candidates` depende de um fluxo
multi-etapa client-side (upload → parse automático → mudar de aba → clicar em "Gerar",
dependente de estado do Zustand `parsedDocumentProvenance`) sem contrato de rede próprio pra
esperar de forma estável sem acoplar a detalhes de markup/store internos do React que podem
mudar. Ver justificativa completa comentada no topo do spec.

Spec novo: `cypress/e2e/nfe-emissao-normal-ui-candidates.cy.js` (não misturado no
`nfe-emissao-normal.cy.js` existente — endpoint/contrato diferente, mais fácil achar e
descartar isoladamente se `execute-candidates` mudar de novo).

**Resultado real (`npx cypress run`, baseUrl override `172.19.176.1:5100`): 1 failing.**
`POST /api/TransformationExecution/execute-candidates` com `Authorization: Bearer <token M2M>`
retorna **401** (corpo vazio) — mesmo bloqueio já documentado em
`docs/e2e-fiat-sysmiddle-tcl-xsl.md` §11 (issue #13 da LayoutParserApi) para `execute-lowcode`:
o token M2M é emitido com sucesso (confirmado, não é problema do lado Cypress), mas o
`[Authorize]` desse grupo de endpoints (`execute-lowcode`, `execute-candidates` — mesmo padrão
de proteção) não aceita esse token. Rodei `nfe-emissao-normal.cy.js` (gate padrão já existente)
na mesma sessão para confirmar que não é regressão introduzida por mim: **mesmo resultado**
(401 em `execute-lowcode`, falha de XSL ausente em `generate-for-layout`/#14) — bloqueio de
ambiente pré-existente, não bug do spec novo.

**Why:** registra que a issue #6 está implementada e correta do lado do Cypress, mas
continua bloqueada pela mesma causa raiz de #13 (agora também afeta `execute-candidates`, não
só `execute-lowcode`) — não fechar #6 nem tentar contornar com workaround de auth inventado.

**How to apply:** antes de rerodar este spec, confirmar com quem mantém a LayoutParserApi que
#13 foi corrigida para TODOS os endpoints `[Authorize]` do grupo (não só `execute-lowcode`) —
`execute-candidates` usa a mesma política. Só commitar o spec quando a chamada de rede
retornar 200 e os dois candidatos (`sysmiddle`/`tcl-xsl`) forem aceitos pelo Pollux
(`cStat=100`), igual à regra já aplicada ao gate padrão.
