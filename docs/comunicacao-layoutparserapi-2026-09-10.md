# Comunicação com o time LayoutParserApi — reteste 2026-09-10

**Data:** 2026-09-10
**Status:** aguardando resposta do time da LayoutParserApi
**Issues relacionadas:** [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13), [#14](https://github.com/LayoutParser/LayoutParserCypress/issues/14), [#15](https://github.com/LayoutParser/LayoutParserCypress/issues/15), PRs da API #218/#221/#295

Este arquivo guarda o texto pronto para copiar/enviar ao time da LayoutParserApi, em resposta
ao pedido deles de reteste pós fix de timing de deploy da config M2M (2026-09-08).

---

## Mensagem para o time LayoutParserApi

Olá! Rodamos o reteste que vocês pediram, em dois ambientes, e encontramos dois sintomas
diferentes — nenhum dos dois fecha ainda o cenário `sysmiddle` (issue #13 no nosso repo de
testes). Detalhando para vocês investigarem:

### 1) Ambiente local (`172.19.176.1:5100`) — sintoma original de #13 persiste

Mesmo com token M2M válido (`client_credentials`, client `LayoutParserE2EClient`, scope
`api://f76c2598-4759-48a9-8145-8a967ec7ac96/.default`, confirmado `200` no Entra),
`POST /api/TransformationExecution/execute-lowcode` continua retornando `401`, sem header
`WWW-Authenticate`, corpo vazio.

Importante: `GET /health/ready` dessa instância retorna `Unhealthy` — SQL Server
indisponível ("Erro de rede... SQL Server não foi encontrado") e `MappingDraftStore` em
timeout para tcl/xslt. Não sabemos se essa é a instância que vocês corrigiram em 08/09, ou
se é uma instância local separada, potencialmente com `appsettings.json` desatualizado (sem
o scheme M2M novo).

**Pergunta:** essa é a URL correta pra validar o fix de vocês, ou o "servidor real" que
vocês corrigiram é outro endereço? Se for outro, poderiam nos passar a URL?

### 2) Ambiente `https://layoutparser.duckdns.org` — sintoma novo, possivelmente causa raiz diferente

Testamos pela primeira vez este ambiente com Cypress real (via Electron/Windows — `curl`
direto do nosso WSL trava no handshake TLS contra esse host; pode ser particularidade de
rede do nosso lado, não necessariamente do servidor de vocês).

Com o mesmo token M2M válido:

- `POST /api/TransformationExecution/execute-lowcode` → `401`, mas agora **com corpo JSON
  estruturado**:
  ```json
  {"statusCode":401,"error":"Unauthorized","message":"Autenticação obrigatória.","correlationId":"6059934c-a08e-4dfc-a54f-09d45dd2229b"}
  ```
- `POST /api/AutoTransformation/generate-for-layout` — que no ambiente local responde `404
  "Layout não encontrado"` **sem exigir autenticação nenhuma** — **também retornou 401 com o
  mesmo formato** `"Autenticação obrigatória."` nesse ambiente.

Isso nos chamou atenção porque `generate-for-layout` não deveria estar atrás de
`[Authorize]` (não está, no ambiente local). O fato de os dois endpoints — um protegido por
M2M, outro aparentemente não — devolverem o mesmo erro genérico nesse ambiente sugere que
existe uma camada extra (API Gateway, reverse proxy, ou o `TrustedIdentityMiddleware`) na
frente de **todos** os endpoints ali, que não está reconhecendo esse token M2M (talvez
espere outro `audience`/`issuer`, ou outro scheme de header).

**Perguntas para vocês:**

(a) Por que o token M2M válido (mesmo client/audience que vocês configuraram) continua
sendo rejeitado com `"Autenticação obrigatória"` especificamente no ambiente
`https://layoutparser.duckdns.org`?

(b) Por que um endpoint que não deveria exigir autenticação (`generate-for-layout`) também
está retornando `401` lá? Isso sugere um problema de configuração de gateway/middleware
afetando todos os endpoints nesse ambiente específico, não só o M2M — poderiam confirmar se
existe algo na frente da API nesse domínio (proxy/gateway) que não existe no ambiente local?

(c) Qual o status real do ambiente local (`172.19.176.1:5100`)? Ele segue `Unhealthy`
(SQL Server indisponível) do nosso lado — ele ainda é o ambiente de referência correto pra
validar os fixes de vocês, ou devemos usar só o `duckdns` daqui pra frente? Se for o
`duckdns`, poderiam confirmar a URL/config esperada de autenticação para esse domínio
especificamente?

Seguimos com ambos os ambientes documentados como testados em 2026-09-10 — não decidimos
qual deve ser o canônico, isso depende da resposta de vocês.

Issues completas com todo o histórico, caso ajude: #13 (sintoma ambiente local), #15
(sintoma ambiente duckdns), #14 (XSL não gerado pro layout FIAT, sem novidade nesta rodada).

---

## Notas de uso deste documento

- Texto acima pronto para copiar/colar (Slack, email, issue cross-repo — o que for o canal
  usado com o time da API).
- Não contém segredo real: `client_id`/`scope`/`correlationId` aqui não são credenciais
  sensíveis (o `client secret` nunca é citado). Confirmar antes de enviar se o time de vocês
  tem alguma política própria de não expor `client_id` fora de canal interno.

---

## Adendo 2026-09-10 (tarde) — divergência de PR/branch na resposta deles

**Status:** aguardando esclarecimento do time da LayoutParserApi antes de qualquer novo reteste.
**Issue relacionada:** [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13)

O time da LayoutParserApi respondeu ao reteste acima dizendo que a config M2M
(`Authentication:ServiceClient:Authority`/`Audience`) já está presente no `appsettings.json`
do `master`, citando as PRs **#360** e **#361**, mergeadas "hoje" (2026-09-10).

Ao checar o checkout local da LayoutParserApi nesta máquina — **o único computador/checkout
que temos disponível, não há outra máquina com `master` atualizado** — encontramos uma
divergência:

- O checkout está na branch `feat/xml-layout-sample-generator-356` (não `master`), com
  working tree sujo (mudanças não commitadas em `Program.cs`,
  `RepairOrchestratorXslSynthesizerService.cs`, `TrainingDataCaptureService.cs`, entre
  outros arquivos).
- `git log --oneline -5` nesse checkout mostra: `9337385` (issue #356), `f56d3fb` (merge PR
  #362 `artifact-provenance-341`), `39c4909` (merge PR #360 `llm-provider-abstraction-340`),
  `84c8e7c` (fix namespace), `9da2845` (merge PR #359 `endpoint-generate-sample-355`).
- A PR **#361** não aparece em lugar nenhum desse log.
- A PR **#360** que aparece é sobre `llm-provider-abstraction`, sem relação óbvia com
  M2M/`ServiceClient`/`Authentication`.

Isso já foi registrado como comentário/ressalva na issue #13. Abaixo, o prompt formal para
pedir esclarecimento ao time antes de rodar qualquer novo reteste.

### Mensagem para o time LayoutParserApi (esclarecimento de PR/branch)

Olá! Antes de rodarmos o checklist técnico de vocês (subir a API, checar o warning do
`ServiceClient`, retestar `execute-lowcode`), encontramos uma divergência que precisa ser
esclarecida primeiro — porque este é o único computador/checkout que temos disponível para
validar (não há outra máquina com `master` atualizado para comparar).

Vocês citaram as PRs #360 e #361, mergeadas hoje em `master`, como a origem da config
`Authentication:ServiceClient:Authority`/`Audience`. No nosso checkout local:

- Estamos na branch `feat/xml-layout-sample-generator-356`, não em `master`, com trabalho
  em andamento não commitado (issue #356).
- O `git log` não mostra PR #361 em nenhum lugar.
- A PR #360 visível no log é sobre `llm-provider-abstraction`, sem relação aparente com
  M2M/`ServiceClient`.

Precisamos que vocês nos ajudem com um dos dois caminhos:

**(a) Confirmar o PR/branch correto** — se o merge do scheme M2M está em outra numeração de
PR, ou em outra branch, ou se na verdade ainda não foi mergeado em `master` apesar do que
foi informado, poderiam apontar exatamente onde está?

**(b) Ou, se #360/#361 estão corretas em `master`,** nos orientar como sincronizar este
checkout específico — que está em `feat/xml-layout-sample-generator-356` com mudanças locais
não commitadas — até o ponto certo, sem perder o trabalho em andamento nessa branch (issue
#356). Não queremos descartar esse trabalho para "simplesmente" trocar para `master`.

Também pedimos que confirmem, para conferência local via `git log -p`/`git show`:

1. Em qual arquivo exato os valores de `Authentication:ServiceClient:Authority`/`Audience`
   foram introduzidos — `appsettings.json`? `appsettings.Development.json`? outro?
2. Em qual commit/PR isso foi introduzido de fato (número exato).
3. Se existe algum branch específico de deploy/release (diferente de `master`) que devemos
   usar para validar isso, em vez de `master` diretamente.

Só depois desse esclarecimento vamos rodar o checklist técnico de vocês (subir a API,
verificar o warning do `ServiceClient`, retestar `execute-lowcode`) — não queremos repetir o
reteste contra um checkout que pode estar desatualizado ou divergente do que vocês
validaram.

### Notas de uso deste adendo

- Não decidimos aqui qual branch/PR está correta — isso depende da resposta do time da API.
  As duas opções (a)/(b) ficam para o usuário escolher depois que a resposta chegar.
- Texto pronto para copiar/colar no canal usado com o time da API (Slack, email, issue
  cross-repo).
