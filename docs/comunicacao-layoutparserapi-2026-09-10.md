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

---

## Adendo 2026-09-10 (noite) — resposta do time com correção de PR/branch (esclarecido)

**Status:** divergência esclarecida, não era problema real. Próximo passo: checklist técnico
em clone limpo, ainda não executado.
**Issue relacionada:** [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13)
(comentado com o texto completo e literal da resposta).

O time da LayoutParserApi reconheceu que as PRs #360/#361 citadas antes estavam erradas
(essas são de outro assunto — `ILlmProvider` e endpoint `generate-sample`). Números
corretos:

- Scheme M2M (JWT Bearer ServiceClient, SmartAuth, bloco `Authentication:ServiceClient` no
  `appsettings.json`) → commit `bb458fa` / **PR #305** (2026-09-04).
- Valores reais de Authority/Audience do Entra → commit `39d9cbd` / **PR #316** (2026-09-06,
  mesmo hotfix do crash de boot do Canary).
- Ambos confirmados como ancestrais de `origin/master` (comandos de verificação fornecidos
  pelo time: `git show origin/master:appsettings.json | sed -n '21,27p'` e
  `git merge-base --is-ancestor <commit> origin/master`).

**Causa raiz da divergência anterior:** nosso checkout local está na branch
`feat/xml-layout-sample-generator-356`, cortada de `develop` **antes** dessas promoções para
`master` — checkout desatualizado, não uma divergência real de fato entre times.

**Recomendação do time (e decisão registrada aqui):** NÃO mexer no checkout sujo existente
(tem trabalho em andamento de outros agentes, issue #356). Em vez disso, fazer um **clone
limpo separado** (`git clone <url> /caminho/limpo/LayoutParserApi-reteste`, checkout
`master`) só para subir a API do reteste — nesse clone o `appsettings.json` já traz
Authority/Audience sem precisar de env var.

**Checklist técnico a executar no clone limpo (PENDENTE — não executado nesta sessão):**

1. Subir a API a partir do clone limpo (branch `master`), conferir ausência do warning
   `"Authentication:ServiceClient não configurado"` no log de startup.
2. Opcional: setar `Database__Password` para o `/health/ready` ficar verde.
3. Repetir `POST /api/TransformationExecution/execute-lowcode` com token M2M válido —
   esperado `200` (válido) ou `401` com header `WWW-Authenticate` (token efetivamente
   inválido, comportamento correto).

Respostas de referência do time: arquivo exato = `appsettings.json` na raiz (não
`Development`); branch de validação = `master` (não há branch de release separada;
`deploy.yml` sai de `master`, mas o servidor de deploy só escuta loopback
`127.0.0.1:5000` atrás do BFF — para bater direto na API sem BFF, o alvo precisa ser uma
instância subida a partir de `master`, como no clone limpo).

**Por que ainda não executamos:** subir esse clone limpo requer decisão do usuário sobre
quem/como vai fazer (dotnet runtime disponível, e possivelmente `Database__Password` para o
health check). Isso NÃO foi executado nesta sessão — fica registrado como próximo passo
explícito, sem tomar a decisão pelo usuário. O time da API afirma que, feito isso, a issue
#13 pode ser fechada — mas o fechamento em si também fica para o dono do repo, não para
`@cy-pm`.

### Notas de uso deste adendo

- Divergência de PR/branch da rodada anterior está esclarecida — não repetir a pergunta ao
  time, apenas seguir para o checklist técnico quando o usuário decidir executá-lo.
- Comentário completo e literal já publicado na issue #13.

---

## Adendo 2026-09-10 (madrugada) — issue #15 fechada + prompt sobre mismatch de issuer (v1 vs v2)

**Status:** #15 fechada (veredito do time confirmado pelo dono do repo). Aguardando o time
da LayoutParserApi decidir entre as duas correções propostas abaixo para o mismatch de
issuer registrado em #13.
**Issue relacionada:** [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13)
(mismatch já comentado lá, seção 16 do doc `e2e-fiat-sysmiddle-tcl-xsl.md`).

### Issue #15 — fechada

Fechada com o veredito do time da API: `https://layoutparser.duckdns.org` não é ambiente
correto para chamada M2M direta — passa por um BFF (Fastify/Entra OIDC) antes da API .NET, e
o BFF valida contra seu próprio audience OIDC, rejeitando o token M2M (audience da API)
antes de repassar a chamada. Isso explica por que até endpoints sem `[Authorize]`
(`generate-for-layout`) devolviam o mesmo 401 ali — o bloqueio é na camada do BFF, não na
API. Comentário de fechamento publicado em #15.

### Prompt formal — mismatch de issuer v1 vs v2 (pronto para copiar/enviar)

Olá! Seguindo o checklist técnico que combinamos, subimos a API a partir de um clone limpo
de `master` (config M2M carregada corretamente, sem o warning de `ServiceClient` ausente) e
retestamos `execute-lowcode` direto contra a API (não mais contra o domínio `duckdns`, que
já esclarecemos que passa pelo BFF e não serve para esse teste).

`execute-lowcode` continua devolvendo `401`, mas desta vez o log do servidor mostrou o
motivo exato: `IDX10205: Issuer validation failed`. O token M2M emitido pelo Entra tem
issuer no formato **v1** (`https://sts.windows.net/{tenant}/`), enquanto a validação
configurada em `Program.cs` espera o formato **v2**
(`https://login.microsoftonline.com/{tenant}/v2.0`) — ou vice-versa, dependendo de qual lado
vocês configuraram. Isso costuma vir de `accessTokenAcceptedVersion` não estar setado como
`2` no App Registration "LayoutParserApi" (recurso, Client ID
`f76c2598-4759-48a9-8145-8a967ec7ac96`).

Vemos duas correções possíveis e gostaríamos da opinião de vocês sobre qual aplicar:

**(a) Ajustar o Manifest do App Registration no Entra** — setar
`"accessTokenAcceptedVersion": 2`, fazendo o Entra emitir tokens v2 (issuer
`.../v2.0`) diretamente.
- Prós: não toca em código, efeito imediato, sem necessidade de novo deploy.
- Contras: é uma mudança de configuração fora do código versionado (não fica em PR/diff
  revisável); precisa de alguém com acesso admin ao App Registration no Entra.

**(b) Ajustar `Program.cs` (bloco `AddJwtBearer`, por volta da linha 224)** para aceitar
múltiplos issuers válidos, por exemplo:
```csharp
options.TokenValidationParameters.ValidIssuers = new[]
{
    "https://login.microsoftonline.com/{tenant}/v2.0",
    "https://sts.windows.net/{tenant}/"
};
```
- Prós: mudança de código versionada, revisável em PR, testável.
- Contras: precisa de novo PR + deploy para ter efeito.

**Pergunta objetiva:** qual das duas preferem aplicar — (a) ou (b) — ou preferem as **duas**
juntas (defesa em profundidade: aceitar ambos os formatos de issuer no código, e ainda assim
manter o Manifest correto)?

Assim que a correção for aplicada, avisem que rodamos o reteste imediatamente — já temos um
clone limpo dedicado pronto (`/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste`,
`master`) só para isso, sem mexer no checkout com trabalho em andamento.

### Notas de uso deste adendo

- Não decidimos aqui qual opção (a)/(b)/ambas é a correta — cabe ao time da API, que tem
  acesso ao App Registration e ao código.
- Texto pronto para copiar/colar no canal usado com o time da API.

---

## Adendo 2026-09-10 (noite) — issuer resolvido, novo bloqueio: audience mismatch (GUID vs URI)

**Status:** aguardando o time da LayoutParserApi decidir entre as duas correções propostas
abaixo para o novo mismatch de audience registrado em #13 (seção 19 do doc
`e2e-fiat-sysmiddle-tcl-xsl.md`).
**Issue relacionada:** [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13)
(comentário [aqui](https://github.com/LayoutParser/LayoutParserCypress/issues/13#issuecomment-5623268147)).

### Prompt formal — audience mismatch v2 (GUID vs URI) (pronto para copiar/enviar)

Olá! Boa notícia primeiro: a correção que vocês aplicaram para o mismatch de issuer
(`accessTokenAcceptedVersion: 2` no manifest do App Registration "LayoutParserApi")
funcionou. Retestamos e confirmamos, decodificando o token M2M novo:

```
iss = https://login.microsoftonline.com/8de72b5f-31a7-44aa-831e-d60750ab55d7/v2.0
ver = 2.0
roles = ['Service.E2E']
```

`iss`/`ver` corretos agora — o erro `IDX10205` (issuer) não aparece mais.

Só que apareceu um novo bloqueio, ainda em `execute-lowcode`, com um erro diferente no log
do servidor:

```
Microsoft.IdentityModel.Tokens.SecurityTokenInvalidAudienceException: IDX10214: Audience validation failed.
```

O motivo: o token v2 traz `aud` como **GUID puro**:

```
aud = f76c2598-4759-48a9-8145-8a967ec7ac96
```

Mas a API está configurada esperando o formato **URI** (`Authentication:ServiceClient:Audience`
no `appsettings.json`, e `options.Audience` no `Program.cs` ~linha 227):

```
api://f76c2598-4759-48a9-8145-8a967ec7ac96
```

Pelo que observamos, isso é efeito colateral conhecido e esperado da própria mudança v1→v2
que vocês aplicaram (não é um sintoma novo e desconectado) — tokens v2 emitidos via
`.default` scope tendem a trazer `aud` como o GUID puro do App ID, mesmo quando o
`identifierUris` do App Registration continua `api://<guid>`.

Vemos duas correções possíveis e gostaríamos da opinião de vocês sobre qual aplicar:

**(a) Mudar `Authentication:ServiceClient:Audience`** no `appsettings.json` (e no
`Program.cs`, se houver algum valor hardcoded em paralelo) de `api://f76c2598-...` para o
GUID puro `f76c2598-4759-48a9-8145-8a967ec7ac96`.
- Prós: simples, uma linha de config.
- Contras: precisa confirmar que o GUID puro é de fato o formato estável esperado para
  **todo** consumidor v2 futuro dessa API (não só o token M2M do Cypress) — se algum outro
  fluxo/cliente ainda emitir `aud` no formato URI, essa mudança quebraria esse outro fluxo.

**(b) Configurar `TokenValidationParameters.ValidAudiences`** no `Program.cs` para aceitar
ambos os formatos, por exemplo:
```csharp
options.TokenValidationParameters.ValidAudiences = new[]
{
    "f76c2598-4759-48a9-8145-8a967ec7ac96",
    "api://f76c2598-4759-48a9-8145-8a967ec7ac96"
};
```
- Prós: mais tolerante — não depende de prever exatamente qual formato cada cliente/flow vai
  popular no `aud`, aceita os dois sem risco de quebrar outro consumidor.
- Contras: mudança de código versionada, precisa de novo PR + deploy para ter efeito (assim
  como a opção (b) da rodada anterior sobre issuer).

**Pergunta objetiva:** qual das duas preferem aplicar — (a) ou (b)?

Assim que a correção for aplicada, avisem que rodamos o reteste imediatamente — mesmo clone
limpo dedicado já validado nas duas rodadas anteriores
(`/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste`, branch `master`).

### Notas de uso deste adendo

- Não decidimos aqui qual opção (a)/(b) é a correta — cabe ao time da API.
- Texto pronto para copiar/colar no canal usado com o time da API.

---

**Status:** aguardando o time da LayoutParserApi decidir entre as três opções abaixo para o
próximo bloqueio (não é regressão de auth) registrado na seção 21 do doc
`e2e-fiat-sysmiddle-tcl-xsl.md`.
**Issue relacionada:** [LayoutParserApi#373](https://github.com/LayoutParser/LayoutParserApi/issues/373)
(já existente, cobre exatamente este sintoma — não abrimos issue nova).

### Prompt formal — LayoutParserLowCodeRunner.exe ausente no host de dev/teste (madrugada 2, pronto para copiar/enviar)

Olá! Antes de mais nada: a saga de autenticação M2M (issue #13) está **fechada e resolvida** —
issuer e audience corrigidos, confirmado ponta a ponta no reteste. Isto aqui **não é
regressão nem bloqueio de auth**; é o próximo degrau para completar o reteste E2E do gate
padrão FIAT.

Com auth funcionando, o `execute-lowcode` agora avança até tentar de fato rodar a
transformação low-code, e falha com `500`:

```
An error occurred trying to start process
'C:\inetpub\wwwroot\layoutparser\api\LayoutParserLowCodeRunner.exe'
with working directory 'C:\Users\elson.lopes\source\repos\LayoutParserApi-reteste\bin\Debug\net10.0'.
The system cannot find the file specified.
```

O log de startup da própria API já avisava sobre isso desde a primeira vez que subimos este
clone (`LayoutParserApi-reteste`):

```
LowCode:RunnerPath aponta para um arquivo que NÃO EXISTE:
C:\inetpub\wwwroot\layoutparser\api\LayoutParserLowCodeRunner.exe.
Toda transformação low-code vai falhar até o runner ser publicado neste host.
```

Encontramos a issue [#373](https://github.com/LayoutParser/LayoutParserApi/issues/373), que já
descreve a causa raiz do lado de produção (nenhum workflow publica o runner). Nosso caso é a
versão "dev local" do mesmo problema: `LowCode:RunnerPath` está fixo em um caminho de
produção/IIS (`C:\inetpub\wwwroot\layoutparser\api\...`), que não existe (nem deveria existir)
num clone de dev.

Três perguntas objetivas, sem preferência nossa por nenhuma delas:

**1. Onde fica o código-fonte do runner e como buildar localmente?**
É um projeto dentro do próprio repo LayoutParserApi (ex.: `tools/LowCodeRunner/`, mencionado
na #373) ou um repo companheiro separado? Qual o comando `dotnet publish` específico (ou
passo documentado em README/ADR que não encontramos) para gerar o `.exe` localmente?

**2. Dá para tornar `LowCode:RunnerPath` configurável para dev local?**
Hoje parece fixo (via `appsettings.json`) em um caminho de produção/IIS. Seria possível
promover isso para `appsettings.Development.json` ou variável de ambiente, apontando para um
caminho relativo ao clone de teste, em vez de exigir replicar a estrutura de pastas do IIS de
produção numa máquine de dev?

**3. Existe binário pré-buildado do runner que possamos simplesmente copiar?**
Já que para o reteste E2E não precisamos desenvolver o runner em si, só executá-lo — se
houver um `.exe` já publicado em algum artefato de CI/release, copiá-lo direto para
`C:\inetpub\wwwroot\layoutparser\api\LayoutParserLowCodeRunner.exe` (ou outro caminho, se a
resposta da pergunta 2 permitir) resolveria sem precisar montar o ambiente de build do
runner.

Não temos preferência entre as três — qualquer uma que destrave o reteste real (`200` de
verdade no gate padrão FIAT) serve. Assim que tivermos uma direção, aplicamos e rodamos o
reteste imediatamente no mesmo clone já validado
(`/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste`, branch `master`, no commit
`6fba6a6` da correção de audience).

### Notas de uso deste adendo

- Não decidimos aqui qual das três opções é a correta — cabe ao time da API.
- Não é regressão nem bloqueio de auth — a saga M2M (#13) segue fechada.
- Issue #373 (LayoutParserApi) já existe e cobre a causa raiz do lado de produção/CI; não
  abrimos issue nova neste repo nem no LayoutParserApi.
- Texto pronto para copiar/colar no canal usado com o time da API.

---

## Adendo 2026-09-10 (noite 2) — reteste do fix #14 bloqueado por falta de credencial SQL local

**Status:** aguardando o time da LayoutParserApi escolher entre as duas opções abaixo.
**Issue relacionada:** [#14](https://github.com/LayoutParser/LayoutParserCypress/issues/14)
(comentário publicado lá com o mesmo teor).

### Prompt formal — credencial SQL para reteste local, ou reteste feito por vocês (pronto para copiar/enviar)

Olá! Tentamos o reteste que vocês pediram do fix do #14 (normalização do prefixo `LAY_` no
`MapperDatabaseService`, PR #386→#387/#388, commit `9259b0e` em `master`, deploy em produção
2026-09-10 ~21:18).

Primeiro, deixamos claro: **isso não contesta nem questiona o resultado dos 772/772 testes
verdes de vocês** — é só uma lacuna de setup do nosso ambiente de reteste local que não
tínhamos identificado antes.

No nosso clone dedicado (`/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste`):

1. `git pull` na `master` — confirmamos `9259b0e` como HEAD (o commit do fix).
2. Build limpo (0 erros), API subida do zero.
3. Repetimos `POST /api/AutoTransformation/generate-for-layout` para o layout FIAT
   (`ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c` / `LAY_TXT_MQSERIES_ENVNFE_4.00_NFe`).

**Não conseguimos validar o fix** — bloqueado por um problema diferente, não relacionado ao
mapper. No log da API, no momento exato da chamada:

```
[INF] Gerando transformações para layout: ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c / LAY_TXT_MQSERIES_ENVNFE_4.00_NFe
[INF] Buscando layouts com termo: LAY_TXT_MQSERIES_ENVNFE_4.00_NFe
[ERR] Erro ao buscar layouts no banco de dados
Microsoft.Data.SqlClient.SqlException (0x80131904): Login failed for user 'macgyver'.
```

Essa busca específica (por termo exato do layout) dispara uma query nova no banco
`ConnectUS_Macgyver` (`172.31.249.51`), diferente da busca "all" que já tinha ficado em cache
de rodada anterior. Sem `Database__Password` — credencial que nunca configuramos no nosso
ambiente, não temos essa senha — a consulta falha antes mesmo de chegar no
`MapperDatabaseService.GetMapperByInputLayoutGuidAsync` que vocês corrigiram, e a API devolve
`404 "Layout não encontrado"` ao Cypress mesmo com o layout existindo no banco.

Ou seja: com o ambiente que temos hoje, não dá para confirmar se o mapper agora é encontrado
ou não — a falha acontece uma etapa antes do código corrigido.

Vemos duas formas de destravar, sem preferência nossa:

**(a) Vocês nos passarem a credencial de leitura** — `Database__Password` (ou a connection
string completa, read-only) para `172.31.249.51` / banco `ConnectUS_Macgyver`, usuário
`macgyver` (ou outro usuário read-only dedicado, se preferirem não reaproveitar esse). Só
para viabilizar reteste local — não pedimos acesso de escrita.
- Contras que já antecipamos: é banco compartilhado, razoável vocês preferirem não passar
  senha por canal externo.

**(b) Vocês rodarem o reteste específico do zero**, no ambiente de vocês que já tem acesso ao
banco: `POST /api/AutoTransformation/generate-for-layout` com esse mesmo layout GUID, e nos
passar a resposta completa (`generatedFiles` com `.tcl` e `.xsl`/`.xslt`, ou o warning "Nenhum
mapeador encontrado" se persistir).

**Pergunta objetiva:** qual das duas preferem — (a) ou (b)?

Só para registro: a suíte de testes de vocês roda com mock/in-memory, por isso não precisa
dessa senha; é só o nosso clone local de reteste (que bate no SQL real) que expõe essa
lacuna.

### Notas de uso deste adendo

- Não decidimos aqui qual opção (a)/(b) é a correta — cabe ao time da API.
- Deixar claro no envio que isso não é regressão do fix nem contesta os 772/772 testes verdes.
- Texto pronto para copiar/colar no canal usado com o time da API.

---

## Adendo (2026-09-10, noite 2) — bug de log4net no LowCodeRunner

Seguindo a resposta anterior de vocês sobre o runner real (`tools/LowCodeRunner/Functions/`,
`LowCode:RunnerPath` configurável), configuramos o clone `LayoutParserApi-reteste` apontando
para o runner real e subimos a API via `dotnet run`. O `execute-lowcode` agora **executa o
runner de verdade** (progresso real — antes dava erro de arquivo não encontrado), mas falha
com exit=1:

```
System.IO.FileLoadException: Could not load file or assembly 'log4net, Version=2.0.17.0, Culture=neutral, PublicKeyToken=669e0ddf0bb1aa2a' or one of its dependencies. The located assembly's manifest definition does not match the assembly reference.
File name: 'log4net, Version=2.0.16.0, Culture=neutral, PublicKeyToken=669e0ddf0bb1aa2a'
   at SysMiddle.Base.InstanceFactory.Initialize()
   at SysMiddle.Base.InstanceFactory.get_Instance()
   at LayoutParserLowCodeRunner.SysmiddleRuntime.Create(String globalFolder, String packageGuid)
```

Causa identificada por nós (sem decidir qual lado corrigir): em
`tools/LowCodeRunner/Functions/LayoutParserLowCodeRunner.exe.config`, o binding redirect é:

```xml
<assemblyIdentity name="log4net" publicKeyToken="669e0ddf0bb1aa2a" culture="neutral" />
<bindingRedirect oldVersion="0.0.0.0-2.0.17.0" newVersion="2.0.17.0" />
```

Redireciona tudo para 2.0.17.0. Mas o `log4net.dll` fisicamente presente em
`tools/LowCodeRunner/Functions/log4net.dll` (versionado no git) tem **AssemblyVersion real
2.0.16.0** (confirmado via `[System.Reflection.AssemblyName]::GetAssemblyName()` — o
`FileVersion` do arquivo mostra `1.2.13.0`, mas o `AssemblyVersion` é 2.0.16.0, exatamente o
que aparece no erro). O binding redirect aponta para uma versão que não bate com o binário
que está de fato na pasta.

**Pergunta objetiva, sem tomar partido**: qual dos dois está errado —
(a) o `.exe.config` (deveria redirecionar para 2.0.16.0), ou
(b) o `log4net.dll` commitado em `Functions/` (deveria ser a 2.0.17.0)?
Pedimos que corrijam `tools/LowCodeRunner/Functions/` no repo, o que fizer sentido do lado de
vocês.

Isso só aparece quando `SysMiddle.Base.InstanceFactory.Initialize()` é chamado de verdade —
por isso não apareceu antes, quando o runner só falhava por "arquivo não existe" (issue
LayoutParserApi#373).

Dado interessante: o próprio log do runner (`runnerLog`, versionado/gerado em
`tools/LowCodeRunner/Functions/`) mostra execuções **bem-sucedidas anteriores** do mesmo
mapper (`MAP_f31a6758-...`, "Mapeamento realizado com sucesso"), datadas de antes (ex.
2026-08-28 e uma entrada de 2026-09-10 15:11 que já tinha rodado com sucesso) — sugerindo que
em algum outro ambiente/máquina (provavelmente do time da API, ou uma máquina com o
log4net.dll certo já instalado no GAC/side-by-side) isso funcionou. Reforça que é questão de
qual `log4net.dll` está fisicamente na pasta `Functions/` deste checkout específico, não erro
de lógica do runner em si.

Limpeza feita após o teste: processo encerrado, `cypress.env.json` restaurado
(`172.19.176.1:5100`).

### Notas de uso deste adendo

- Não decidimos qual dos dois arquivos (`.exe.config` ou `log4net.dll`) está errado — cabe ao
  time da API.
- Issue própria aberta para rastrear, linkada a esta e à LayoutParserApi#373: ver
  `docs/e2e-fiat-sysmiddle-tcl-xsl.md`, seção 22 (extensão), para o número exato.
