# E2E FIAT — caminhos Sysmiddle e TCL/XSL vs. Pollux

**Data:** 2026-08-29 (última atualização: 2026-09-10)
**Status:** implementado — caminho `sysmiddle` bloqueado por 401 em `execute-lowcode`.
Checklist técnico do time LayoutParserApi executado de verdade em clone limpo (ver seção
16): config M2M confirmada carregada corretamente, mas **causa raiz real encontrada** —
mismatch de formato de issuer v1/v2 do Entra (`IDX10205`). Pergunta enviada ao time da API
sobre qual das duas correções aplicar. `layoutparser.duckdns.org` (#15) classificado pelo
time da API como "ambiente incorreto por design" (passa pelo BFF) — aguardando confirmação
do dono do repo para fechar. Caminho `tcl-xsl` bloqueado por XSL ausente pro layout FIAT
(#14); UI (front-end) fora deste cenário, bloqueada por dúvida de contrato (#6).
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

## 13. Atualização 2026-09-10 — teste em dois ambientes, dois sintomas distintos de 401

### O que foi pedido

Por instrução do usuário, testamos o reteste de #13 em **dois ambientes** da
LayoutParserApi na mesma rodada, em vez de escolher um: o local já conhecido
(`172.19.176.1:5100`) e, pela primeira vez com Cypress real,
`https://layoutparser.duckdns.org` (ambiente que o time da API trata como "servidor
real"/dev). O mesmo token M2M válido (client `LayoutParserE2EClient`, scope
`api://f76c2598-4759-48a9-8145-8a967ec7ac96/.default`) foi usado nos dois.

### Ambiente 1 — local (`172.19.176.1:5100`)

Sem novidade em relação à seção 12: `execute-lowcode` → `401` sem body/`WWW-Authenticate`;
`GET /health/ready` → `Unhealthy` (SQL Server indisponível); segundo `it()` → `404 "Layout
não encontrado"` (issue #14, já conhecida).

### Ambiente 2 — `https://layoutparser.duckdns.org` (primeira vez testado com Cypress real)

`curl` direto do WSL contra esse host trava no handshake TLS (connection reset) — só foi
possível testar via Cypress rodando em Electron/Windows. Resultado:

- `POST /api/TransformationExecution/execute-lowcode` com o mesmo Bearer M2M → `401`, mas
  **com corpo JSON estruturado**:
  ```json
  {"statusCode":401,"error":"Unauthorized","message":"Autenticação obrigatória.","correlationId":"6059934c-a08e-4dfc-a54f-09d45dd2229b"}
  ```
- `POST /api/AutoTransformation/generate-for-layout` — endpoint que no ambiente local
  responde `404` **sem exigir autenticação** — **também retornou `401`** com o mesmo formato
  `"Autenticação obrigatória."` nesse ambiente.

### Leitura

Dois sintomas distintos em ambientes distintos, provavelmente causas raiz diferentes:

- **Ambiente local:** 401 sem body, isolado ao `execute-lowcode` — sintoma original de
  [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13), possivelmente ligado
  à instância local estar `Unhealthy`/desatualizada.
- **Ambiente `duckdns`:** 401 com body estruturado, afetando inclusive endpoint sem
  `[Authorize]` — sugere uma camada de auth (API Gateway/reverse proxy, ou
  `TrustedIdentityMiddleware`) na frente de **todos** os endpoints nesse ambiente específico,
  não reconhecendo o token M2M Entra ali. Rastreado em issue nova
  [#15](https://github.com/LayoutParser/LayoutParserCypress/issues/15) (mantido separado de
  #13 por parecer escopo/causa diferente).

### Encaminhamento

Comentário registrado em [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13)
com os dois resultados lado a lado. Prompt formal para o time da LayoutParserApi, cobrindo as
três perguntas em aberto (token rejeitado no `duckdns`, endpoint sem auth também bloqueado lá,
e status/uso correto do ambiente local `Unhealthy`), salvo em
[`docs/comunicacao-layoutparserapi-2026-09-10.md`](comunicacao-layoutparserapi-2026-09-10.md)
para o usuário copiar/enviar. Nenhum agente decidiu qual ambiente é o canônico — ambos seguem
documentados como testados nesta data, por instrução explícita do usuário.

## 14. Atualização 2026-09-10 (cont.) — resposta do time LayoutParserApi + divergência de PR/branch encontrada

Time LayoutParserApi respondeu ao prompt formal (seção 13) com diagnóstico distinto para
cada ambiente. Resposta completa comentada em
[#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13#issuecomment-5618255664)
e em
[#15](https://github.com/LayoutParser/LayoutParserCypress/issues/15#issuecomment-5618257861)
(reproduzida na íntegra lá, não resumida aqui para evitar perda de detalhe técnico). Síntese:

- **`layoutparser.duckdns.org` (#15):** classificado como "não serve pra M2M em nenhuma
  hipótese" — esse domínio passa por um BFF (Fastify/Entra OIDC) antes da API .NET; o corpo
  `{"statusCode":401,"error":"Unauthorized","message":"Autenticação obrigatória."}` é
  serialização do BFF, não da API — o BFF rejeita o token M2M (audience errada pro seu OIDC)
  antes mesmo de chegar num endpoint com ou sem `[Authorize]`. Veredito deles: não é bug, é o
  BFF funcionando como projetado. Pedem para fechar #15 com esse veredito — **não fechamos**;
  comentário pede confirmação do dono do repo antes de fechar.
- **`172.19.176.1:5100` (#13):** classificado como alvo correto (sem BFF no caminho), mas
  instância desatualizada — scheme ServiceClient/M2M (`Authentication:ServiceClient:Authority`/
  `Audience`) não estaria ativo em runtime nessa instância, caindo no handler TrustedHeader que
  rejeita origem não-loopback com 401 seco. Dizem que os valores corretos já estão no
  `appsettings.json` do `master` da LayoutParserApi (citam merges das PRs #360/#361 "hoje").
  Pedem checklist: `git pull` master → subir API → conferir ausência do warning
  "Authentication:ServiceClient não configurado" → repetir `execute-lowcode` (esperado 200 ou
  401 com `WWW-Authenticate`, nunca mais 401 seco).
- Também esclarecem que o "servidor real" corrigido em 2026-09-08 escuta só em loopback
  (`127.0.0.1:5000`, atrás do BFF co-hospedado), inalcançável por `172.19.176.1` ou IP de rede
  — bater nele direto sem BFF exigiria um "caminho 1" (runner co-localizado/túnel) que ainda
  não existe, item futuro do lado deles (`@lp-devops` da API).

### Ressalva — divergência de PR/branch não confirmada

Antes de qualquer um rodar o checklist acima, verificamos o checkout local do repo irmão
`/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi` para confirmar as PRs #360/#361
citadas:

- Checkout está na branch **`feat/xml-layout-sample-generator-356`**, não `master`, com
  working tree sujo (mudanças não commitadas em `Program.cs`,
  `RepairOrchestratorXslSynthesizerService.cs`, `TrainingDataCaptureService.cs`, memórias de
  agente).
- `git log --oneline -5`: `9337385` (issue #356), `f56d3fb` (merge PR #362
  artifact-provenance-341), `39c4909` (merge PR #360 llm-provider-abstraction-340), `84c8e7c`
  (fix namespace), `9da2845` (merge PR #359 endpoint-generate-sample-355). **Não aparece PR
  #361**; a PR #360 visível é sobre "llm-provider-abstraction", sem relação óbvia com
  M2M/ServiceClient no nome do merge.

**Conclusão:** não confirmamos, a partir deste checkout, que o merge do scheme M2M esteja
de fato em `master` — pode ser branch/checkout desatualizado localmente, numeração de PR
diferente da citada, ou estar tudo certo e só não aparecer nesse log recente. **O checklist
técnico (git pull + restart da instância local) ainda não foi executado** — depende de
esclarecimento do time da LayoutParserApi sobre essa divergência, e de decisão do usuário
sobre qual checkout/branch usar. Isso é fora do escopo de `@cy-pm` (não decide nem executa
esse checklist) — registrado aqui só para rastreabilidade.

**Encaminhamento formal (2026-09-10, tarde):** prompt pronto para copiar/enviar ao time
LayoutParserApi, pedindo esclarecimento sobre a divergência de PR/branch (opções: confirmar
PR/branch correta, ou orientar como sincronizar o checkout local sem perder o trabalho em
`feat/xml-layout-sample-generator-356`) e detalhes do commit/arquivo exato da config M2M —
ver adendo em
[`docs/comunicacao-layoutparserapi-2026-09-10.md`](comunicacao-layoutparserapi-2026-09-10.md).
Comentado também em #13. Checklist técnico segue bloqueado até resposta.

## 15. Atualização 2026-09-10 (noite) — divergência de PR/branch esclarecida, checklist ainda pendente

O time da LayoutParserApi respondeu à ressalva da seção 14 e **corrigiu** a numeração de
PR/commit citada antes. Comentário completo e literal em
[#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13#issuecomment-5618767622).
Resumo:

- **#360/#361 estavam erradas** — são de outro assunto (`ILlmProvider` e endpoint
  `generate-sample`), não M2M.
- **Números corretos:** scheme M2M (JWT Bearer ServiceClient, SmartAuth, bloco
  `Authentication:ServiceClient`) → commit `bb458fa` / **PR #305** (2026-09-04). Valores
  reais de Authority/Audience do Entra → commit `39d9cbd` / **PR #316** (2026-09-06, mesmo
  hotfix do crash de boot do Canary). Ambos confirmados ancestrais de `origin/master`.
- **Causa da divergência anterior:** checkout local preso na branch
  `feat/xml-layout-sample-generator-356`, cortada de `develop` antes dessas promoções para
  `master` — checkout desatualizado, não divergência real entre os times.
- **Recomendação:** NÃO mexer no checkout sujo existente (trabalho em andamento de outros
  agentes, issue #356). Fazer um **clone limpo separado** só para subir a API do reteste —
  nesse clone o `appsettings.json` de `master` já traz Authority/Audience corretos.

**Próximo passo — checklist técnico (PENDENTE, NÃO EXECUTADO nesta sessão):**

1. Clonar a LayoutParserApi em diretório separado, checkout `master`.
2. Subir a API a partir desse clone; conferir ausência do warning
   `"Authentication:ServiceClient não configurado"` no log de startup.
3. Opcional: setar `Database__Password` para `/health/ready` ficar verde.
4. Repetir `POST /api/TransformationExecution/execute-lowcode` com token M2M — esperado
   `200` (válido) ou `401` com `WWW-Authenticate` (inválido).

Isso depende de decisão do usuário sobre quem/como executa (precisa de dotnet runtime
disponível e possivelmente `Database__Password`) — não decidido nem executado por
`@cy-pm`. O time da API afirma que, feito isso, a issue #13 pode ser fechada; fechamento
fica a critério do dono do repo, não de `@cy-pm`.

## 16. Atualização 2026-09-10 (noite) — checklist executado, causa raiz real encontrada: mismatch de issuer v1/v2 do Entra

O checklist técnico pendente na seção 15 foi finalmente executado, de verdade, contra um
clone limpo.

### O que foi feito

1. Clone limpo em `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste`, branch
   `master`. Confirmado que `bb458fa` (#305, scheme M2M) e `39d9cbd` (#316, Authority/
   Audience) são ancestrais de HEAD, e que `appsettings.json` já traz o bloco
   `Authentication:ServiceClient` com
   `Authority="https://login.microsoftonline.com/8de72b5f-31a7-44aa-831e-d60750ab55d7/v2.0"`
   e `Audience="api://f76c2598-4759-48a9-8145-8a967ec7ac96"`.
2. Build ok (0 erros). API subida a partir desse clone limpo. Bind forçado em loopback
   (`127.0.0.1:5000`) por design de segurança — confirmado no log ("Identidade do BFF ATIVA
   com guarda de loopback... origem remota é ignorada", warning "Overriding address(es)
   'http://0.0.0.0:5200'. Binding to endpoints defined via IConfiguration") — exatamente
   como o time da API descreveu.
3. **Ausência do warning** "Authentication:ServiceClient não configurado (Authority/
   Audience vazios)" no log de startup confirma que a config M2M carregou corretamente
   nesta instância nova.
4. Como o Cypress roda como processo Windows nativo (node.exe/Electron, não processo WSL),
   consegue alcançar `127.0.0.1:5000` diretamente mesmo executado via WSL bash.
   Reapontamos `cypress.env.json` (`layoutParserApiUrl`) temporariamente para
   `http://127.0.0.1:5000` e rodamos `nfe-emissao-normal.cy.js` de verdade contra essa
   instância nova.

### Resultado — causa raiz real

`execute-lowcode` **continua 401** (seco, sem `WWW-Authenticate`) — mas desta vez, com a
config M2M confirmadamente carregada, o log da API durante essa requisição específica
revelou a causa raiz real:

```
[WRN] Falha ao validar token ServiceClient (M2M)
Microsoft.IdentityModel.Tokens.SecurityTokenInvalidIssuerException: IDX10205: Issuer validation failed.
Issuer: 'https://sts.windows.net/8de72b5f-31a7-44aa-831e-d60750ab55d7/'.
Did not match: validationParameters.ValidIssuer: 'null' or validationParameters.ValidIssuers: 'null' or
validationParameters.ConfigurationManager.CurrentConfiguration.Issuer: 'https://login.microsoftonline.com/8de72b5f-31a7-44aa-831e-d60750ab55d7/v2.0'.
```

**Mismatch de formato de issuer v1 vs v2 do Entra.** O token M2M que o Cypress obtém via
`POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` (endpoint v2,
`client_credentials`) vem de volta com `iss` = `https://sts.windows.net/{tenant}/` (formato
v1/ADAL), não `https://login.microsoftonline.com/{tenant}/v2.0` (formato v2) que a API
espera via `options.Authority` no `AddJwtBearer` (`Program.cs`, linhas ~224-250 do
LayoutParserApi).

Isso é comportamento clássico do Entra: quando o App Registration da API (recurso, aqui
LayoutParserApi / audience `api://f76c2598-...`) tem a propriedade de manifesto
`accessTokenAcceptedVersion` configurada como `1` (ou `null`, que também vira o default v1
para App Registrations mais antigas), o Entra emite tokens v1 (issuer `sts.windows.net`)
mesmo quando o CLIENTE pede via o endpoint v2 — o formato do token é decidido pelo
manifesto do **recurso** (API), não pelo endpoint que o cliente chamou.

**A config M2M está correta e o scheme está ativo — o bloqueio é especificamente esse
mismatch de formato de issuer.**

### Duas correções possíveis (qualquer uma resolve) — pergunta devolvida ao time da API

1. **(a)** No App Registration "LayoutParserApi" (recurso, Client ID
   `f76c2598-4759-48a9-8145-8a967ec7ac96`) no Entra, editar o Manifest e setar
   `"accessTokenAcceptedVersion": 2` — o Entra passa a emitir tokens v2 com issuer
   `.../v2.0`, batendo com a `Authority` configurada. Trade-off: mexe em config do Entra,
   fora do código, pode afetar outros clientes que já dependem do formato v1 desse App
   Registration.
2. **(b)** OU, sem mexer no App Registration, ajustar a validação no `Program.cs`
   (`AddJwtBearer`, por volta da linha 224) para aceitar ambos os formatos de issuer —
   setar `options.TokenValidationParameters.ValidIssuers = new[] {
   $"https://login.microsoftonline.com/{tenantId}/v2.0", $"https://sts.windows.net/{tenantId}/"
   }` (ou equivalente configurável), já que ambos são o mesmo tenant/emissor, só formatos
   diferentes de string. Trade-off: mexe em código da API, precisa novo deploy/PR.

Comentado em
[#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13#issuecomment-5619023020)
com a pergunta de qual correção o time da API prefere aplicar — nenhum agente decidiu por
eles.

### Encerramento do ambiente de reteste

A instância de reteste foi encerrada (processo Windows PID 31488, `dotnet.exe`/
`LayoutParserApi.exe`, finalizado) e `cypress.env.json` foi restaurado para o valor
original (`172.19.176.1:5100`) — nada ficou rodando nem modificado permanentemente. O clone
`/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste` ficou no disco (não
removido) caso seja útil pra próximo reteste depois da correção.

## 17. Atualização 2026-09-10 (madrugada) — issue #15 fechada; prompt formal enviado sobre mismatch de issuer

Issue [#15](https://github.com/LayoutParser/LayoutParserCypress/issues/15) fechada
(veredito confirmado pelo dono do repo): o domínio `https://layoutparser.duckdns.org` não é
ambiente correto para chamada M2M direta — passa por um BFF (Fastify/Entra OIDC) que valida
contra seu próprio audience OIDC e rejeita o token M2M (audience da API) antes de repassar
a chamada, o que explica o 401 em todos os endpoints ali, inclusive os sem `[Authorize]`.

Prompt formal com as duas correções possíveis para o mismatch de issuer v1/v2 (seção 16
acima) foi escrito e adicionado a
`docs/comunicacao-layoutparserapi-2026-09-10.md` (adendo "madrugada"), perguntando ao time
LayoutParserApi se preferem (a) ajustar `accessTokenAcceptedVersion` no Manifest do Entra,
(b) ajustar `ValidIssuers` no `Program.cs`, ou as duas. Issue #13 segue aberta aguardando
essa resposta antes do próximo reteste no clone limpo
`/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste`.

## 18. Atualização 2026-09-10 — decisão do time API sobre o mismatch de issuer; próximo passo depende do usuário

Time LayoutParserApi respondeu ao prompt formal da seção 17 e comentou em
[#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13):

- Confirmam o diagnóstico (`Program.cs` ~linha 224, `options.Authority = ".../v2.0"` valida
  `iss` contra v2 e rejeita token v1 `sts.windows.net`).
- **Decisão:** opção (a) — setar `accessTokenAcceptedVersion: 2` no Manifest do App
  Registration "LayoutParserApi" (Client ID `f76c2598-4759-48a9-8145-8a967ec7ac96`) via
  Portal Azure. Não farão a opção (b) (`ValidIssuers` no código) — justificam que corrigir
  na origem do token é a prática correta numa fronteira de auth que controlam, e que só o
  Cypress/E2E usa esse caminho hoje (raio de impacto nulo); (a) também não exige PR/deploy.
- Não haverá PR/mudança de código da parte deles.
- Pedem, após o manifest propagar: obter token M2M novo, conferir `iss` = `.../v2.0` (jwt.ms),
  repetir `POST /api/TransformationExecution/execute-lowcode` no clone limpo de `master`
  (esperado 200; se 401, reportar novo `IDXxxxxx`). Feito isso, fecham #13 do lado deles.

**Bloqueio confirmado nesta sessão:** não há Azure CLI (`az`) instalado/autenticado nesta
máquina, e a mudança de manifest exige acesso admin ao Azure AD/Entra (role Application
Administrator ou Cloud Application Administrator no Portal Azure) — fora do alcance de
qualquer agente Cypress e do ferramental disponível aqui.

**PRÓXIMO PASSO PRÁTICO (depende do usuário/dono do repo, ou de quem tiver esse acesso):**
1. Entrar no Portal Azure → App registrations → "LayoutParserApi"
   (`f76c2598-4759-48a9-8145-8a967ec7ac96`) → Manifest.
2. Setar `"accessTokenAcceptedVersion": 2` e salvar.
3. Avisar para rodarmos o reteste no clone
   `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste` (pode precisar subir a
   instância de novo, já foi derrubada numa rodada anterior).

Issue #13 permanece aberta até esse reteste confirmar 200/resposta de negócio (ou um novo
código `IDXxxxxx` se ainda falhar).

## 19. Atualização 2026-09-10 (tarde) — issuer resolvido, novo bloqueio: audience mismatch (GUID vs URI)

O usuário aplicou a correção da seção 18 (`accessTokenAcceptedVersion: 2` no manifest do
App Registration "LayoutParserApi", confirmado colando o manifesto completo com
`"api": {"requestedAccessTokenVersion": 2, ...}`).

Reteste executado subindo de novo o clone limpo
`/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste` (branch `master`, mesmo
clone já confirmado com `bb458fa`/#305 e `39d9cbd`/#316 ancestrais, `appsettings.json` com
Authority/Audience corretos), rodando a spec real contra `http://127.0.0.1:5000` (Cypress
roda como processo Windows nativo, alcança o loopback do Windows mesmo executado via WSL).

**Progresso confirmado:** o erro anterior (`IDX10205`, mismatch de issuer v1/v2) sumiu.
Token M2M novo decodificado (mesmo client_credentials/scope de sempre) vem com:

```
iss = https://login.microsoftonline.com/8de72b5f-31a7-44aa-831e-d60750ab55d7/v2.0
ver = 2.0
aud = f76c2598-4759-48a9-8145-8a967ec7ac96
roles = ['Service.E2E']
```

**Novo bloqueio:** `execute-lowcode` continua 401 — agora com erro diferente no log:

```
[WRN] Falha ao validar token ServiceClient (M2M)
Microsoft.IdentityModel.Tokens.SecurityTokenInvalidAudienceException: IDX10214: Audience validation failed.
```

Causa provável: o `aud` do token v2 vem como **GUID puro**
(`f76c2598-4759-48a9-8145-8a967ec7ac96`), mas a API está configurada
(`Authentication:ServiceClient:Audience` no `appsettings.json`, e `options.Audience` no
`Program.cs` ~linha 227) esperando o formato **URI** (`api://f76c2598-...`). Efeito
colateral conhecido da mudança v1→v2: tokens v2 emitidos via `.default` scope para um
recurso cujo App ID URI é `api://<próprio-appId>` costumam trazer `aud` como o GUID puro,
mesmo que o `identifierUris` do App Registration continue `api://f76c2598-...`.

Não é um novo problema nosso — é consequência direta e esperada da correção que o time da
API escolheu aplicar (opção a da seção 18). Precisa de mais um ajuste do lado deles: ou
mudar `Authentication:ServiceClient:Audience` (e equivalente em outros ambientes) para o
GUID puro, ou configurar `TokenValidationParameters.ValidAudiences` no `Program.cs` para
aceitar ambos os formatos — decisão devolvida ao time da API, não decidida aqui, igual da
vez passada (seção 17). Comentado em
[#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13).

Limpeza feita: processo da API de teste encerrado, `cypress.env.json` restaurado ao valor
original (`172.19.176.1:5100`). Clone `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste`
continua no disco, pronto para o próximo reteste assim que ajustarem o Audience.

Prompt formal para o time da API sobre este achado (issuer resolvido, audience mismatch
GUID vs URI, duas opções de correção): ver adendo "2026-09-10 (noite)" em
`docs/comunicacao-layoutparserapi-2026-09-10.md`.
