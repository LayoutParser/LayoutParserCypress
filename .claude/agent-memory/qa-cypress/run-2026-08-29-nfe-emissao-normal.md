---
name: run-2026-08-29-nfe-emissao-normal
description: Resultado real de npm run test:mappers em 2026-08-29 — ambos it() falharam por causas de infra/API, não por bug no spec
metadata:
  type: project
---

Rodei `npm run test:mappers` de verdade em 2026-08-29 contra
`layoutParserApiUrl=http://172.19.176.1:5100` (IP do gateway WSL→host Windows, porta 5100 —
pode mudar entre reboots do WSL, reconfirmar com `ip route | awk '/default/{print $3}'` se a API
parecer inacessível). `cypress.env.json` local já tinha essa URL preenchida.

Resultado: **2 failing, 0 passing**. Não commitei o spec `nfe-emissao-normal.cy.js` (regra do
agente: só commita se ambos os it() passarem).

**Falha 1 — `FIAT [sysmiddle] — execute-lowcode → Pollux`:**
`TypeError: Cannot read properties of undefined (reading 'slice')` na linha que monta a mensagem
de erro (`JSON.stringify(lowcodeResponse.body).slice(...)`). Causa raiz real (confirmada via
`curl` direto no endpoint): `POST /api/TransformationExecution/execute-lowcode` retorna
**HTTP 401 com corpo vazio**. O TypeError é só sintoma — `JSON.stringify(undefined)` retorna
`undefined`, então `.slice` estoura antes da asserção de status rodar. O spec mascara um 401 real
como erro de código. Hipótese: endpoint passou a exigir autenticação e nada em
`cypress.env.json`/no request envia credencial. Não decidi mecanismo de auth — não inventar
header/token, perguntar a quem mantém a LayoutParserApi.

**Falha 2 — `FIAT [tcl-xsl] — generate-for-layout + execute → Pollux`:**
`AssertionError: success=true na geração TCL/XSL: expected false to equal true`. Confirmado via
curl: `POST /api/AutoTransformation/generate-for-layout` com
`layoutGuid=ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c` retorna HTTP 200 mas
`{"success":false,"layoutType":"2","warnings":["Tipo de layout não suportado: 2"]}` — o catálogo
reporta `layoutType: "2"` pra esse GUID e o endpoint não suporta esse tipo. Não chegou a haver
rejeição fiscal do Pollux — a geração nem produziu artefatos TCL/XSL. Pode ser (a) o
`generate-for-layout` não suportar mais/ainda esse tipo de layout, ou (b) o GUID/layout usado no
spec estar desatualizado para o fluxo tcl-xsl.

**Why:** registra causa raiz real pra próxima rodada não perder tempo redescobrindo — ambas
falhas são de infraestrutura/config da API, não do spec Cypress em si.

**How to apply:** antes de rerodar `test:mappers`, confirmar com quem mantém a
LayoutParserApi (1) se `execute-lowcode` agora exige auth e qual mecanismo usar, (2) se
`layoutType: "2"` do layout FIAT é esperado no fluxo `generate-for-layout` ou se o GUID/layout
do caso `FIAT` no spec precisa ser atualizado. Só depois disso vale rerodar a suíte e considerar
commit.
