# Reteste issue #14 — fix do prefixo LAY_ confirmado + dois novos bugs (spec e API)

**Data:** 2026-09-11
**Status:** #14 fechada (resolvida). Dois bugs de spec corrigidos localmente. Um bug novo,
diferente e ainda bloqueante, aberto para o time da API.
**Issues relacionadas:** [#14](https://github.com/LayoutParser/LayoutParserCypress/issues/14)
(fechada nesta sessão), issue nova aberta para o bug de convenção de nome XSL (ver abaixo).
**Doc relacionado:** [`docs/e2e-fiat-sysmiddle-tcl-xsl.md`](./e2e-fiat-sysmiddle-tcl-xsl.md)
(seção 22 registrou o bloqueio de credencial SQL que impedia este reteste até agora),
[`docs/comunicacao-layoutparserapi-2026-09-10.md`](./comunicacao-layoutparserapi-2026-09-10.md)
(adendo "noite 2" — pedido de credencial que o usuário atendeu para viabilizar esta sessão).

---

## Contexto

Sessão de reteste do fix do #14 (bug do prefixo `LAY_` no `MapperDatabaseService`, PR
#386→#387/#388, commit `9259b0e` em `master` da LayoutParserApi). Retestes anteriores
(2026-09-10) tinham ficado bloqueados por falta de credencial de leitura no SQL Server
compartilhado (`172.31.249.51` / banco `ConnectUS_Macgyver`, usuário `macgyver`). O usuário
forneceu a senha real nesta sessão para desbloquear o teste no clone dedicado
`LayoutParserApi-reteste` (branch `master`, sincronizado).

## 1. #14 CONFIRMADO RESOLVIDO

Com acesso real ao SQL (antes bloqueado), o log da API mostrou, repetidamente, a linha
`Prefixo LAY_ removido: <guid>` sendo aplicada corretamente a cada um dos 638 mapeadores
carregados do banco — incluindo o layout FIAT
(`ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c` / `LAY_TXT_MQSERIES_ENVNFE_4.00_NFe`).

`POST /api/AutoTransformation/generate-for-layout` passou a retornar `200` para esse layout
— antes retornava `404 "Layout não encontrado"` (o sintoma original do #14, causado pelo
mapper não normalizar o prefixo `LAY_` antes de comparar).

**Veredito:** o fix do time da API está confirmado funcional. Issue #14 fechada.

## 2. Dois bugs reais encontrados e corrigidos no spec Cypress (não relacionados ao #14)

Arquivo: `cypress/e2e/nfe-emissao-normal.cy.js`, teste
`FIAT [tcl-xsl] — generate-for-layout + execute → Pollux`.

**a. URL errada (kebab-case vs. PascalCase de rota).** O spec chamava
`POST /api/transformation-execution/execute`, mas a rota real do
`TransformationExecutionController` é `api/TransformationExecution/execute`
(PascalCase, sem hífen) — o roteamento do ASP.NET é case-insensitive, mas não faz match de
hífen contra `PascalCase` sem hífen. Corrigido no spec para `TransformationExecution/execute`.

**b. Body do POST incompleto.** O spec não enviava `sourceDocumentType` nem
`expectedOutput`. O model `TransformationRequest.cs` declara esses campos como `string`
não-anulável (nullable reference types), o que faz o ASP.NET model binding inferir
`[Required]` automaticamente — mesmo o controller tratando-os como opcionais internamente
(`request.SourceDocumentType ?? "NFe"`). Corrigido no spec enviando
`sourceDocumentType: "NFe"` e `expectedOutput: ""`.

Esses dois ajustes já foram commitados localmente no spec (fora do escopo desta issue de
documentação — ver commit do `@qa-cypress`/sessão de reteste).

## 3. NOVO bug, do lado da API, ainda bloqueando o teste tcl-xsl

Diferente do #14 — sintoma novo, causa raiz diferente, ainda bloqueia totalmente o fluxo
`tcl-xsl` (`generate-for-layout` + `execute`).

**Inconsistência de convenção de nome de arquivo XSL entre geração e execução:**

- `AutoTransformationGeneratorService.cs`, linha ~355 — gera o arquivo como
  `{layout.Name}.xsl` (ex.: `LAY_TXT_MQSERIES_ENVNFE_4.00_NFe.xsl`), **sem nenhum prefixo**
  antes do nome do layout.
- `TransformationPipelineService.cs`, método `FindXslFile` (linha ~440-474) — busca com o
  padrão glob `*_{layoutName}.xsl`, que exige obrigatoriamente algum texto antes de um `_`
  seguido do nome do layout. O próprio comentário no código (linha ~430) documenta a
  "convenção real" esperada como `{mapperName}_{layoutName}.xsl`.

**Resultado:** o arquivo gerado nunca bate com o padrão buscado — bug estrutural, não caso
de borda, afeta qualquer layout.

Erro observado na resposta:
```json
{"success":false,"errors":["Arquivo XSL não encontrado para transformação Intermediate → NFe"]}
```

Log da API:
```
Nenhum arquivo XSL encontrado para o layout LAY_TXT_MQSERIES_ENVNFE_4.00_NFe (padrão esperado: *_LAY_TXT_MQSERIES_ENVNFE_4.00_NFe.xsl em C:\inetpub\wwwroot\layoutparser\xsl)
```

Issue aberta para o time da API rastrear este achado (ver seção "Itens de rastreamento"
abaixo).

## 4. Teste sysmiddle (execute-lowcode) — fronteira inalterada

Continua na mesma fronteira já registrada em
[`docs/e2e-fiat-sysmiddle-tcl-xsl.md`](./e2e-fiat-sysmiddle-tcl-xsl.md) seção 24: rejeição
fiscal do Pollux (`"Processo realizado com erro"` em vez de sucesso) — não é bug de infra, é
a nova fronteira já documentada. Nenhuma mudança nesta sessão.

## Limpeza do ambiente

Após os testes, o clone `LayoutParserApi-reteste` foi limpo:
- `cypress.env.json` restaurado para `172.19.176.1:5100`.
- Processo da API do clone finalizado.
- Senha SQL removida de `appsettings.Development.json` (nunca foi commitada, uso só local).

## Itens de rastreamento (GitHub Project / Issues)

- Issue [#14](https://github.com/LayoutParser/LayoutParserCypress/issues/14) — reaberta
  temporariamente para comentário de confirmação e fechada novamente com o veredito acima.
- Issue nova aberta neste repo para o bug de convenção de nome XSL (achado 3) — ver número
  exato no comentário de fechamento do #14 e no item do GitHub Project
  `LayoutParserCypress — Backlog`.
