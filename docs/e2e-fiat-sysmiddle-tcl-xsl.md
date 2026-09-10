# E2E FIAT — caminhos Sysmiddle e TCL/XSL vs. Pollux

**Data:** 2026-08-29 (última atualização: 2026-09-10)
**Status:** implementado — caminho `sysmiddle` bloqueado por 401 em `execute-lowcode` (#13, reteste 2026-09-10 aguardando decisão de URL); caminho `tcl-xsl` bloqueado por XSL ausente pro layout FIAT (#14); UI (front-end) fora deste cenário, bloqueada por dúvida de contrato (#6).

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

## 10. Atualização 2026-08-29 — causas reais dos bloqueios

A leitura de "API fora do ar" da seção 6/7 estava incompleta. O usuário confirmou a causa raiz
real dos dois `it()` que falharam na rodada de `npm run test:mappers` (ver
`.claude/agent-memory/qa-cypress/run-2026-08-29-nfe-emissao-normal.md`): não é infra
momentânea, são dois bloqueios de escopo/desenvolvimento pendente do lado da
**LayoutParserApi**, fora do controle deste repo de testes.

1. **`execute-lowcode` retorna 401.** O endpoint passou a exigir login OAuth (Google/Microsoft)
   numa mudança recente da LayoutParserApi. Não existe hoje mecanismo de
   autenticação/tokenização de serviço (não interativo) para clientes automatizados como o
   Cypress — precisa ser decidido/desenvolvido do lado da API. Rastreado em
   [#9](https://github.com/LayoutParser/LayoutParserCypress/issues/9).
2. **`generate-for-layout` retorna `success:false, "Tipo de layout não suportado: 2"`** para o
   layout FIAT (`layoutType: "2"`). Hipótese plausível (não confirmada) do usuário: o
   desenvolvimento do TCL/XSL na API ainda não está completo para esse tipo de layout.
   Alternativa não descartada: o GUID/layout usado no spec está desatualizado. Precisa
   confirmação de quem mantém a LayoutParserApi. Rastreado em
   [#10](https://github.com/LayoutParser/LayoutParserCypress/issues/10).

Issue [#5](https://github.com/LayoutParser/LayoutParserCypress/issues/5) foi comentada com este
contexto e continua aberta — evoluiu de "bloqueio de infra" para "bloqueio de escopo/dev
pendente na API", não foi resolvida.

## 11. Atualização 2026-09-07 — revalidação M2M pós PR #295 (e #218/#221 de auth M2M)

A LayoutParserApi anunciou dois PRs prontos: um novo esquema de autenticação M2M (JWT Bearer
via `client_credentials`, paralelo ao `TrustedIdentityMiddleware` — PRs #218/#221) e o PR #295
(fix de `LayoutType` numérico). `@qa-cypress` revalidou o gate FIAT de ponta a ponta contra a
LayoutParserApi local (`172.19.176.1:5100`). Resultado real, não maquiado: os dois `it()`
(`sysmiddle` e `tcl-xsl`) ainda falharam, mas por motivos **novos e distintos** dos
registrados nas seções 9/10.

### O que ficou confirmado funcionando

1. **PR #295 resolveu a causa raiz de #10.** `generate-for-layout` para o layout FIAT
   (`LAY_ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c`) agora retorna `layoutType: "TextPositional"`
   em vez de "Tipo de layout não suportado: 2".
2. **Token M2M funciona.** `POST` ao `m2mTokenUrl` com `client_credentials` (client
   `LayoutParserE2EClient`, App Role `Service.E2E`) retorna `200` com `access_token` válido.
   Validado também isoladamente via script Node, fora do Cypress — não é problema de como o
   Cypress monta a requisição.

### Bloqueios novos

1. **`execute-lowcode` continua com 401**, mesmo com o token M2M válido anexado como
   `Authorization: Bearer <token>`. Corpo vazio, sem header `WWW-Authenticate`. Hipótese não
   confirmada: o `[Authorize]` desse endpoint específico não reconhece `audience`/`issuer`/role
   claim desse token, ou o scheme M2M ainda não está plugado nesse endpoint. Isso atualiza a
   issue [#9](https://github.com/LayoutParser/LayoutParserCypress/issues/9) (que registrava
   "não existe mecanismo" — agora existe, mas não funciona aqui). Rastreado em issue nova
   [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13).
2. **`generate-for-layout` não gera XSL para o layout FIAT.** Gera o `.tcl`, mas
   `generatedFiles` não traz nenhum `.xsl`/`.xslt`, com o warning "Nenhum mapeador encontrado
   para o layout LAY_TXT_MQSERIES_ENVNFE_4.00_NFe (Guid:
   ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c)". Sem XSL, o `execute` não consegue prosseguir.
   Hipótese: falta cadastro/associação de mapeador XSL para esse layout no catálogo da API.
   Isso substitui a causa original da issue
   [#10](https://github.com/LayoutParser/LayoutParserCypress/issues/10) (corrigida pelo #295)
   por um bloqueio novo, rastreado em issue nova
   [#14](https://github.com/LayoutParser/LayoutParserCypress/issues/14).

### Consequência

Nenhum dos dois caminhos (`sysmiddle` nem `tcl-xsl`) chegou a submeter XML ao Pollux nesta
rodada — `cStat=100` ainda não pôde ser confirmado por nenhum dos dois. Issues #9 e #10 foram
comentadas com este contexto e mantidas abertas (não fechadas) — decisão registrada nos
próprios comentários: preferi manter o histórico completo (causa original → corrigida/mudou →
bloqueio novo) em vez de fechar e perder o rastro.

## 12. Atualização 2026-09-09/10 — reteste de #13 pedido pela LayoutParserApi: 401 persiste, causa provável mudou

### O que foi pedido

O time da LayoutParserApi reportou que a causa raiz do 401 da issue
[#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13) era **timing de
deploy** — a config M2M (Authority/Audience do Entra) só chegou no "servidor real" deles em
2026-09-08 — e pediu para reexecutarmos o teste.

### O que foi feito

`@qa-cypress` reexecutou `cypress/e2e/nfe-emissao-normal.cy.js` (it `FIAT [sysmiddle] —
execute-lowcode → Pollux`) contra a LayoutParserApi configurada em `cypress.env.json`
(`layoutParserApiUrl = http://172.19.176.1:5100`), com diagnóstico adicional via `curl`
direto contra o Entra e contra a API (fora do Cypress, pra isolar se o problema era como o
Cypress monta a requisição).

### Resultado real

1. Obtenção do token M2M continua funcionando: `POST` a
   `https://login.microsoftonline.com/8de72b5f-31a7-44aa-831e-d60750ab55d7/oauth2/v2.0/token`
   (client `LayoutParserE2EClient`, scope
   `api://f76c2598-4759-48a9-8145-8a967ec7ac96/.default`) retorna `200` com `access_token`
   válido. Config do lado Entra está correta.
2. `POST /api/TransformationExecution/execute-lowcode` com `Authorization: Bearer <token>`
   continua retornando **401**, sem header `WWW-Authenticate` — mesmo sintoma original de
   #13, mesmo depois do fix reportado pela API.
3. **Achado novo:** `172.19.176.1:5100` é uma instância **local** da LayoutParserApi rodando
   no host Windows (via gateway WSL), não o "servidor real" de dev que o time da API disse
   ter corrigido em 08/09. `GET /health/ready` dessa instância retorna `Unhealthy` — SQL
   Server indisponível ("Erro de rede... SQL Server não foi encontrado") e
   `MappingDraftStore` em timeout para tcl/xslt. Indício de que essa instância local está com
   `appsettings.json` desatualizado (sem o scheme M2M novo) e/ou simplesmente não está
   operacional o bastante pra validar o fix.
4. O segundo `it()` (`FIAT [tcl-xsl] — generate-for-layout + execute → Pollux`) falhou com
   `404 "Layout não encontrado"` — isso é a issue #14 já conhecida, sem novidade, não é
   bloqueio novo.

### Bloqueio — decisão pendente do dono

Não há confirmação de **qual URL de LayoutParserApi** usar pra validar o fix real de #13:

1. reapontar `cypress.env.json` (`layoutParserApiUrl`) pro servidor de dev real do time da
   API (falta a URL), ou
2. considerar que a instância local (`172.19.176.1:5100`) deveria estar saudável/atualizada
   — nesse caso depende de alguém subir/atualizar essa instância local, fora do alcance de
   qualquer agente Cypress.

Registrado como comentário na issue
[#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13) — decisão de qual URL
usar devolvida ao dono, não decidida por nenhum agente.
