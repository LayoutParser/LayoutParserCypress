# E2E FIAT — caminhos Sysmiddle e TCL/XSL vs. Pollux

**Data:** 2026-08-29
**Status:** implementado, não commitado — execução real bloqueada por API fora do ar; UI (front-end) fora deste cenário, bloqueada por dúvida de contrato.

## 1. Pedido original

O usuário pediu, no repo `LayoutParserCypress`: (a) criar um sistema de agents/comandos
espelhando o padrão já usado em `LayoutParserApi` e `LayoutParserReact`; (b) montar um teste e2e
real entre front-end (`LayoutParserReact`), API (`LayoutParserApi`, com Ollama) e Pollux, usando
um documento e layout que o usuário já tinha em mãos (FIAT).

## 2. Harness de agentes criado

Em `.claude/` (ainda não commitado nesta sessão):

- Agentes: `cy-architect` (Aria — desenha fluxo e2e), `qa-cypress` (Cass — já existia, atualizado
  com a missão `e2e-ui-flow`), `cy-ai-flow` (Lia-e2e — fluxo de candidatos IA/Ollama), `cy-devops`
  (Gage-e2e — push/CI/segredos, autoridade exclusiva), `cy-doc` (Duda-e2e — documentação), `cy-pm`
  (Pia-e2e — este agente, board + documentação persistente).
- Rules: `agent-authority.md`, `agent-handoff.md` (com a seção "Handoff não substitui
  documentação persistente"), `security.md`.
- Commands: `/new-e2e-flow`, `/run-suite`, `/security-scan`, `/trace-verdict`.
- Hook: `git-push-advisory.cjs`.
- `settings.json.example`, `.claude/README.md` (mapa do harness), `agent-memory/<agente>/` por
  agente.
- `CLAUDE.md` do repo atualizado (§4) com o mapa de agentes e o escopo expandido "teste e2e
  completo (front + API/Ollama + Pollux)".

Referência: [`.claude/README.md`](../.claude/README.md).

## 3. Dados de teste usados

- Layout FIAT: GUID `ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c`
  (`LAY_TXT_MQSERIES_ENVNFE_4.00_NFe`), localizado em `../LayoutParserApi/.claude/temp/teste/`
  (repo irmão, só leitura).
- TXT posicional MQSeries real do FIAT/NDD, já commitado neste repo em
  [`cypress/fixtures/txt-input/nfe-emissao-normal.mq_series.txt`](../cypress/fixtures/txt-input/nfe-emissao-normal.mq_series.txt).
  O usuário confirmou que é dado da própria NDD (não de terceiro/cliente) e autorizou usar como
  está — não precisou anonimizar.
- Gabarito de referência (XML esperado, mesma NF-e) já commitado em
  [`cypress/fixtures/txt-input/nfe-emissao-normal.gabarito.xml`](../cypress/fixtures/txt-input/nfe-emissao-normal.gabarito.xml).

## 4. Desenho do cenário (`@cy-architect`)

Documento completo: [`.claude/agent-memory/cy-architect/design_flow_fiat_ui.md`](../.claude/agent-memory/cy-architect/design_flow_fiat_ui.md).

Dois caminhos de geração de NF-e a partir do mesmo TXT, ambos submetidos ao Pollux no mesmo
cenário de teste:

1. **Sysmiddle (low-code direto):** `POST /api/TransformationExecution/execute-lowcode` com
   `mapperId=MAP_f31a6758-69c9-4cf6-92d2-24f0e27a1ab5` (`MAP_MQSERIES_SEND_ENV_TXT_XML_NFE`),
   `package=938f9978-836f-48c1-9c0f-c2898caf4b20`.
   - **Achado importante:** existe um mapper homônimo errado
     (`MAP_MARELLI_MQSERIES_SEND_ENV_TXT_XML_NFE`, `MAP_1cfab556-4b0e-45ce-baee-4f9570f1ca51`)
     que roda com `exit=0` mas gera XML incompleto (faltam `<total>`, `<ICMSTot>`, `<transp>`,
     `<cobr>`, `<pag>`, `<compra>`; sobram `<B2B>`, `<comb>`, `<descANP>`). O teste tem asserção
     estrutural específica para pegar essa armadilha antes de chegar ao Pollux.
2. **TCL/XSL (via Ollama):** `generate-for-layout` + `execute` — fluxo que já existia e já era
   testado antes desta sessão, sem mudanças de contrato.

Confirmado que o mapper resolvido pelo Redis (`MapperCacheService`, chave
`mappers:search:all`) NÃO é usado no caminho `execute-lowcode` — sem risco de falha transitória
por warmup de cache.

**Pendência em aberto, não resolvida:** o fluxo real de upload da UI do LayoutParserReact usa a
rota `execute-candidates`, que diverge do par `generate-for-layout` + `execute` usado no gate
atual. Não foi confirmado se é o mesmo pathway internamente. Isso bloqueia a parte "front-end"
(UI) do teste e2e original pedido pelo usuário — por ora o cenário implementado é só API+Pollux,
sem abrir a UI React.

## 5. Implementação (`@qa-cypress`)

Arquivo [`cypress/e2e/nfe-emissao-normal.cy.js`](../cypress/e2e/nfe-emissao-normal.cy.js)
atualizado com dois `it()`, reaproveitando `validarAceitacaoPollux`:

- `FIAT [sysmiddle] — execute-lowcode → Pollux`
- `FIAT [tcl-xsl] — generate-for-layout + execute → Pollux`

**Ainda não commitado.**

## 6. Resultado real de execução

`@qa-cypress` rodou `npm run test:mappers`. **Ambos os testes falharam por infraestrutura**: a
`LayoutParserApi` não estava rodando em `localhost:5214` (conexão recusada). Não é bug de teste
nem de configuração da spec — é ambiente indisponível no momento da execução. O commit da spec
fica pendente até rodar de novo com a API no ar.

## 7. Pendências / bloqueios

1. **Bloqueio de execução:** API fora do ar durante a rodada de validação — precisa re-rodar
   `npm run test:mappers` com `LayoutParserApi` ativa em `localhost:5214` antes de commitar a
   spec.
2. **Pendência de desenho (UI/front-end):** contrato `execute-candidates` (usado pela UI React)
   vs. `generate-for-layout` + `execute` (usado pelo gate atual) não está confirmado como o mesmo
   pathway internamente — bloqueia desenhar/implementar a parte "front-end" do teste e2e
   completo pedido originalmente pelo usuário.

## 8. Referências

- Harness: [`.claude/README.md`](../.claude/README.md)
- Desenho: [`.claude/agent-memory/cy-architect/design_flow_fiat_ui.md`](../.claude/agent-memory/cy-architect/design_flow_fiat_ui.md)
- Spec: [`cypress/e2e/nfe-emissao-normal.cy.js`](../cypress/e2e/nfe-emissao-normal.cy.js)
- CLAUDE.md do repo: [`.claude/CLAUDE.md`](../.claude/CLAUDE.md)

## 9. Atualização 2026-08-29 — CI/CD e branch protection

`@cy-devops` criou `.github/workflows/{ci-dev,merge-gate,prod-gate}.yml` e os GitHub
Environments `development`/`production` (ainda vazios, sem secrets/vars). Documentou em
`.claude/rules/agent-authority.md` que este repo é **público** — diferente do
LayoutParserApi/LayoutParserReact, que são privados — logo branch protection nativa do GitHub
é tecnicamente viável aqui (não é o caso nos repos privados do ecossistema).

O usuário pediu explicitamente para habilitar de verdade, e a proteção foi ativada via
`gh api --method PUT repos/LayoutParser/LayoutParserCypress/branches/master/protection`:

- 1 aprovação obrigatória em Pull Request;
- status check `Gate dos mapeadores (dev)` obrigatório antes de merge;
- push direto e force-push em `master` bloqueados;
- exclusão da branch `master` bloqueada.

Isso já está **ativo** no repositório.

**Pendências abertas, rastreadas como issues:**

- [#7](https://github.com/LayoutParser/LayoutParserCypress/issues/7) — preencher
  secrets/vars reais nos Environments `development`/`production` (vars
  `LP_LAYOUT_PARSER_API_URL`, `LP_POLLUX_URL`, `LP_CNPJ_EMITENTE_TESTE`; secrets
  `LP_POLLUX_USERNAME`, `LP_POLLUX_PASSWORD`). Só o usuário pode preencher, pela UI do GitHub.
- [#8](https://github.com/LayoutParser/LayoutParserCypress/issues/8) — acesso de rede
  WSL↔Windows para rodar a suíte localmente: `curl` a `localhost:5214` e
  `172.19.176.1:5214` (gateway WSL) retornam conexão recusada mesmo com a LayoutParserApi
  supostamente rodando no Windows. Causa provável: Kestrel escutando só em `127.0.0.1`.
  Orientação passada: `dotnet run --urls "http://0.0.0.0:5214"` ou `netsh interface
  portproxy`.

Enquanto #7 e #8 não forem resolvidas, nem os workflows de CI rodam de ponta a ponta nem a
suíte pode ser validada localmente — a pendência de execução registrada na seção 7 acima
(issue [#5](https://github.com/LayoutParser/LayoutParserCypress/issues/5)) continua aberta.
