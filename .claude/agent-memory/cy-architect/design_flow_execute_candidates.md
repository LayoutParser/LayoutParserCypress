---
name: design-flow-execute-candidates
description: Desenho do cenário e2e "UI React -> execute-candidates -> Pollux" (issue #6) — contrato multi-candidato + fallback IA assíncrono confirmados na LayoutParserApi
metadata:
  type: project
---

Desenhado em 2026-09-07 para destravar a issue #6 (LayoutParserCypress), a partir da resposta
oficial da LayoutParserApi sobre o contrato real usado pela UI. Complementa/substitui a dúvida
em aberto registrada em `design_flow_fiat_ui.md` §"Achado importante" — aquela dúvida está
agora **resolvida**: a UI usa `execute-candidates`, não `generate-for-layout`+`execute`.

## Contrato confirmado (fonte: `LayoutParserReact/src/types/transformation.ts` +
`src/services/api/transformationService.ts`, validado em ambiente de integração 2026-07-20/29)

- `POST /api/transformationexecution/execute-candidates` — mesmo shape de request do antigo
  `execute` de candidato único (`inputContent`, `layoutName`, `layoutGuid`, `sourceDocumentType`,
  `targetDocumentType`, `validate`, `expectedOutput`), mas devolve `candidates[]` em vez de um
  `transformedXml` só.
- Dispara em paralelo dois pathways síncronos: `sysmiddle` (via `_lowCodeAuto.RunAsync`, mesmo
  motor do `execute-lowcode`/`parse/auto`) e `tcl-xsl` (via Ollama). Cada pathway que produz
  resultado vira um item em `candidates[]`; um pathway que falha **não aparece no array** — o
  motivo vai em `warnings` (texto livre) ou `failureReason` do candidato, se existir mas com
  problema.
- `candidateId` previsível: `"sysmiddle-{MapperGuid}"` ou `"tclxsl-1"` (fixo, só 1 candidato
  possível nesse pathway).
- `recommendedCandidateId: string | null` — indica qual candidato a API recomenda.
- `score` **nunca vem preenchido de verdade ainda** — não ordenar por score.
- `validation` só preenchido no candidato `tcl-xsl`; `null` no `sysmiddle` não é erro (esse
  pathway não tem validação XSD).
- `candidates: []` com HTTP 200 é **sucesso válido** (zero candidatos, motivo em `warnings`),
  não falha de rede/infra.
- Fallback assíncrono de IA (issue #140): se nenhum candidato sai na primeira tentativa, a API
  enfileira um job em background e sinaliza via texto livre em `warnings` (sem campo
  estruturado dedicado). Resultado só existe via polling em
  `GET /api/transformationexecution/execute-candidates/{ticket}/ia-status`, que devolve
  `{status: running|converged|failed|not-applicable|not-found, candidate, diagnostics}`.
  `diagnostics.hasGroundTruth=false` significa "não havia mapper Sysmiddle cadastrado pra
  comparar" — convergência nesse caso é só XSD válido + regra de negócio, nunca diff canônico
  contra gabarito real.

## 1. Fluxo UI (LayoutParserPage.tsx, rota `/upload`)

1. `layoutService.searchLayouts()` popula `LayoutCombobox` — usuário seleciona o layout FIAT
   (GUID `LAY_ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c`).
2. Upload do TXT (fixture já commitada, `cypress/fixtures/txt-input/nfe-emissao-normal.mq_series.txt`
   — dado próprio NDD, autorizado, não precisa anonimizar, ver `design_flow_fiat_ui.md`).
3. `handleSubmit` monta `TransformationCandidatesRequest` e chama
   `transformationService.executeTransformationCandidates`, que bate em
   `POST /api/transformationexecution/execute-candidates`.
4. UI exibe candidatos (`XmlTransformationDisplay.tsx`) — se a resposta trouxer `warnings`
   sinalizando fallback de IA enfileirado, a UI dispara polling via
   `useAiFallbackPolling.ts` (`GET .../{ticket}/ia-status`, backoff progressivo).

## 2. Ponto de asserção — Cypress intercepta a chamada de rede

`cy.intercept('POST', '**/api/transformationexecution/execute-candidates').as('executeCandidates')`
após disparar o submit na UI. Aguardar `@executeCandidates`, então:

1. HTTP 200, `success === true`.
2. `candidates` é array; se vazio, o teste deve FALHAR com mensagem explícita citando
   `warnings` (zero candidatos síncronos não é o cenário feliz esperado para o layout FIAT já
   validado — se acontecer, é regressão, não sucesso "silencioso" como o contrato trata para a
   UI genérica).
3. Selecionar candidato de veredito: ver decisão abaixo.
4. Sobre o candidato selecionado, replicar as MESMAS asserções estruturais já usadas no
   caminho Sysmiddle direto (`design_flow_fiat_ui.md` "Atualização 2026-08-29 — fechado"):
   XML bem-formado, presença de `<total>`/`<ICMSTot>`/`<transp>`/`<cobr>`/`<pag>`/`<compra>`,
   ausência de `<B2B>`/`<comb>`/`<descANP>` (anti-armadilha do mapper Marelli homônimo) —
   aplicável quando `pathway === 'sysmiddle'`; para candidato `tcl-xsl`, reaproveitar as
   asserções já usadas em `nfe-emissao-normal.cy.js`.

## 3. Decisão — critério de veredito: qual(is) candidato(s) validar

**Decisão: testar os DOIS candidatos síncronos que aparecerem (`sysmiddle` e `tcl-xsl`),
independentemente de qual é `recommendedCandidateId`, cada um em seu próprio `it()` — não só
o recomendado.**

Justificativa:
- `recommendedCandidateId` reflete uma escolha de UX (qual XML mostrar por padrão pro
  usuário), não uma garantia fiscal — o contrato deixa explícito que `score` não está
  implementado de verdade, então não há sinal de qualidade objetivo por trás da recomendação
  hoje. Confiar só nele deixaria o outro pathway sem cobertura de regressão.
- O gate padrão (`nfe-emissao-normal.cy.js` + o desenho já fechado em
  `design_flow_fiat_ui.md`) já trata os dois pathways como merecedores de veredito
  independente (`[sysmiddle]` e `[tcl-xsl]`, cada um exigindo `cStat=100`). Manter a mesma
  granularidade aqui evita que uma regressão em um pathway fique mascarada pelo outro via UI.
- Custo extra é baixo: a resposta já traz ambos no mesmo `candidates[]`, não exige requisição
  adicional — é só iterar o array em vez de pegar um item.
- Ainda assim, assertar que `recommendedCandidateId` aponta pra um `candidateId` presente em
  `candidates` (sanity check barato de que a API não está recomendando um ID fantasma) —
  falha nessa asserção é bug de contrato, reportar separado do veredito fiscal.

Se no futuro `score` passar a refletir qualidade real, revisitar essa decisão para privilegiar
o recomendado como veredito principal e os demais como sinal secundário.

## 4. Decisão — caminho assíncrono (fallback de IA com ticket)

**Decisão: o cenário e2e do gate padrão (via UI, layout FIAT) documenta e MONITORA o fallback
de IA, mas NÃO o exige nem faz dele parte do veredito PASS/FAIL do gate padrão — se cair nesse
caminho, é sinal de regressão a ser investigado, tratado como `it.skip`/aviso, não como
critério fiscal.**

Justificativa:
- Para o layout FIAT especificamente, os dois pathways síncronos (`sysmiddle` via
  `execute-lowcode`/mesmo motor, e `tcl-xsl` via Ollama) já são comprovadamente capazes de
  gerar candidato (ver `design_flow_fiat_ui.md`, MapperId/Package confirmados, TCL/XSL já
  validado em `nfe-emissao-normal.cy.js`). Cair no fallback de IA para ESTE layout específico
  indica quebra de um dos dois pathways síncronos, não o cenário esperado — não faz sentido
  esperar/aceitar isso como parte normal do gate padrão.
- O fallback de IA já tem semântica de veredito própria e deliberadamente diferente em
  `ia-candidates-batch.cy.js` (Job 2, `@cy-ai-flow`): lá, rejeição fiscal é MEDIÇÃO válida
  (o objetivo é medir taxa de acerto de candidatos sintetizados, não garantir que todo
  candidato passa). Misturar essa semântica no gate padrão via UI criaria uma ambiguidade:
  o mesmo `it()` ora exigiria `cStat=100` (pathways síncronos) ora aceitaria rejeição como OK
  (pathway IA) — isso enfraquece o veredito do gate padrão como um todo.
- Portanto: **não reusar a semântica de `ia-candidates-batch.cy.js` neste cenário** — são
  propósitos diferentes (gate padrão de regressão vs. medição de taxa de acerto de IA). Se
  algum dia se quiser testar o fallback de IA do layout FIAT deliberadamente (ex.: simulando
  os dois pathways síncronos falhando), isso deveria ser um cenário SEPARADO, delegado a
  `@cy-ai-flow`, não ao gate padrão de `@qa-cypress`.
- Implementação sugerida para `@qa-cypress`: após receber a resposta de `execute-candidates`,
  se `warnings` contiver texto indicando fallback de IA enfileirado (checar substring, já que
  não há campo estruturado — ex. procurar menção a "ticket"/"IA" no array de warnings), o
  teste deve:
  1. Logar (`cy.log`) o conteúdo de `warnings` e o `correlationId`, para investigação manual.
  2. Falhar explicitamente com mensagem clara ("layout FIAT caiu no fallback de IA —
     regressão em um dos pathways síncronos, ver warnings/correlationId acima"), em vez de
     tentar fazer polling em `ia-status` dentro do gate padrão.
  3. NÃO implementar polling de `ia-status` neste teste — isso pertence ao escopo de
     `@cy-ai-flow`/`ia-candidates-batch.cy.js` se algum dia quiserem testar esse pathway
     deliberadamente.
- Trade-off aceito: se um dia o pathway `sysmiddle` OU `tcl-xsl` regredir de forma
  intermitente (não determinística) e cair ocasionalmente no fallback, o gate padrão vai
  falhar de forma "flaky" em vez de silenciosamente aceitar via IA — isso é uma escolha
  deliberada (falha visível > mascarar regressão), mas pode gerar ruído se o pathway
  síncrono for realmente instável; se isso acontecer na prática, revisitar aqui antes de
  simplesmente aumentar retries.

## 5. Estrutura sugerida da spec (para `@qa-cypress`, não implementada aqui)

Dentro do `describe` do cenário "via UI" (ou spec dedicada `nfe-emissao-normal-ui.cy.js`):

```
it('${cliente} [UI][sysmiddle] — upload+layout -> execute-candidates -> Pollux', ...)
it('${cliente} [UI][tcl-xsl] — upload+layout -> execute-candidates -> Pollux', ...)
```

Ambos compartilham a mesma intercept de `execute-candidates` (a chamada é única; os dois
`it()`s podem, na prática, ser dois `expect` dentro do mesmo teste em vez de dois `it()`s
totalmente separados, para evitar duplicar upload+intercept — decisão de organização de spec
fica a critério de `@qa-cypress`, não é uma restrição de design). O que importa preservar é:
veredito independente por candidato, mesma exigência `cStat=100` do gate padrão, e a
asserção de sanity check do `recommendedCandidateId` (item 3 acima).

## Pendências / próximos passos
- Confirmar com `@lp-front-dev` se `LayoutParserPage.tsx`/`handleSubmit` ainda monta o request
  exatamente como `TransformationCandidatesRequest` (campos `sourceDocumentType`/
  `expectedOutput` — valores default usados pela UI para o layout FIAT) antes de
  `@qa-cypress` fixar o payload exato no intercept/asserção de request body.
- Não investigado ainda: se o teste deve rodar em navegador real (Cypress abrindo a UI) ou se
  basta reproduzir a chamada HTTP com o mesmo payload sem abrir a UI de fato — isso é decisão
  de implementação de `@qa-cypress`, mas se a UI tiver lógica não trivial de montagem de
  payload (ex. normalização de `layoutGuid` nulo vs vazio), abrir a UI de verdade é mais fiel;
  se não, reproduzir via `cy.request` é mais rápido/estável. Recomendo `@qa-cypress` decidir
  isso olhando `handleSubmit` linha a linha, não assumido aqui.

## Referências de arquivo (só leitura)
- `LayoutParserReact/src/types/transformation.ts` (contrato completo, comentários com proveniência)
- `LayoutParserReact/src/services/api/transformationService.ts` (`executeTransformationCandidates`, `getAiCandidateStatus`)
- `LayoutParserReact/src/hooks/useAiFallbackPolling.ts` (polling client-side, backoff)
- `LayoutParserReact/src/components/analysis/XmlTransformationDisplay.tsx` (exibição multi-candidato)
- `LayoutParserApi/Controllers/TransformationExecutionController.cs` (`ExecuteTransformationCandidates`, não lido nesta rodada — confirmar payload exato se necessário)
- Gate padrão existente / dado sintético: `.claude/agent-memory/cy-architect/design_flow_fiat_ui.md`
