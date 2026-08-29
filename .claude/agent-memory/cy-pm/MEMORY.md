# Memória — @cy-pm (Pia-e2e)

## Rodada 2026-08-29 — board-init + story-from-request + doc-persist

### board-init
`gh project list --owner LayoutParser` não listava projeto deste repo antes desta rodada
(existiam só `LayoutParserApi — Backlog` #2 e `LayoutParserReact — Backlog` #3). Criado agora:

- **LayoutParserCypress — Backlog** — número **4**, id `PVT_kwDODnBfYs4Bh1dg`, owner
  `LayoutParser`, status `open`.

### story-from-request
Rascunho de 4 itens devolvido ao dono para confirmação (ver resposta da sessão) — **nenhuma
issue foi criada ainda**, por regra da persona (lote >1 item exige rascunho + confirmação
antes de criar). Granularidade proposta:
1. Story — harness de agentes criado no repo.
2. Story — cenário e2e sysmiddle+tcl-xsl implementado (spec + design doc).
3. Blocked/bug — execução real não pôde ser validada (API fora do ar em `localhost:5214`).
4. Story/pendência — fluxo via UI (front-end) ainda não desenhado, bloqueado por divergência de
   contrato `execute-candidates` vs. `generate-for-layout`+`execute`.

Próximo passo assim que o dono confirmar: `gh issue create` para cada item + `gh project
item-add` linkando ao project 4.

### doc-persist
Escrito [`docs/e2e-fiat-sysmiddle-tcl-xsl.md`](../../../docs/e2e-fiat-sysmiddle-tcl-xsl.md)
consolidando pedido → harness → dados → desenho (`@cy-architect`) → implementação
(`@qa-cypress`) → resultado real (falha de infra, API fora do ar) → pendências (UI/front-end).

### Não fiz nesta rodada
- Não criei issues (aguardando confirmação do rascunho).
- Não fiz commit/push da spec `.cy.js` (autoridade de `@qa-cypress`/`@cy-devops`).
- Não editei CI/segredos (autoridade exclusiva de `@cy-devops`).

## Rodada 2026-08-29 (cont.) — issues formalizadas + linkadas ao Project #4

Dono confirmou o rascunho dos 4 itens acima. Criadas as issues em
`LayoutParser/LayoutParserCypress` e adicionadas ao Project #4 (`LayoutParserCypress —
Backlog`):

- **#3** — story: implementar harness de agentes espelhando LayoutParserApi/LayoutParserReact
- **#4** — story: cenário e2e FIAT — Sysmiddle e TCL/XSL validados contra Pollux
- **#5** — blocked: validação e2e FIAT sysmiddle/tcl-xsl não rodou — API fora do ar
- **#6** — story: desenhar fluxo e2e via UI (front-end React) — bloqueado por divergência de
  contrato (`execute-candidates` vs. `generate-for-layout`+`execute`)

Todas as 4 já têm item correspondente no Project #4 via `gh project item-add`.

### Não fiz nesta rodada (cont.)
- Não fiz `git push` — só commit local do MEMORY.md atualizado, se solicitado.
- Não editei CI/segredos.

## Rodada 2026-08-29 (cont. 2) — CI/CD, branch protection real, novas pendências

`@cy-devops` criou workflows (`ci-dev`, `merge-gate`, `prod-gate`) + Environments
`development`/`production` (vazios). Repo é **público** (diferente de LayoutParserApi/React,
privados) — branch protection nativa é viável aqui. Usuário pediu para ativar de verdade;
orquestrador ativou via `gh api PUT .../branches/master/protection` (1 aprovação, status
check `Gate dos mapeadores (dev)` obrigatório, push direto/force-push bloqueados, exclusão de
branch bloqueada). Confirmei que issue **#6** é sobre outra coisa (contrato
`execute-candidates` da UI) — não mexi nela.

Criadas 2 issues novas, direto (item único/inequívoco cada, sem rascunho):
- **#7** — story: preencher secrets/vars reais nos Environments development/production
  (bloqueia CI rodar de verdade; só o usuário preenche pela UI do GitHub).
- **#8** — blocked: acesso de rede WSL↔Windows para rodar a suíte localmente (Kestrel
  provavelmente só em 127.0.0.1; orientação: `--urls 0.0.0.0` ou `netsh portproxy`).

Ambas adicionadas ao Project #4. Comentei em #5 linkando o contexto de CI/branch protection e
as novas pendências #7/#8 (não fechei #5 — continua bloqueada até #7 e #8 resolverem).

Atualizado `docs/e2e-fiat-sysmiddle-tcl-xsl.md` com seção 9 "Atualização 2026-08-29 — CI/CD e
branch protection".

## Rodada 2026-08-29 (cont. 3) — causa raiz real dos bloqueios (não é mais "API fora do ar")

Usuário confirmou, via `.claude/agent-memory/qa-cypress/run-2026-08-29-nfe-emissao-normal.md`,
que os 2 `it()` que falharam na rodada de `test:mappers` não são infra momentânea, são
bloqueios reais de escopo/dev pendente do lado da **LayoutParserApi**:

1. `execute-lowcode` retorna 401 — API agora exige OAuth (Google/Microsoft), sem mecanismo de
   autenticação de serviço/tokenização não interativa para clientes automatizados (Cypress).
   Trabalho novo a decidir/desenvolver na API.
2. `generate-for-layout` retorna `success:false, "Tipo de layout não suportado: 2"` para o
   layout FIAT — hipótese plausível (não confirmada) de TCL/XSL incompleto pra esse layoutType;
   alternativa não descartada é GUID/layout desatualizado no spec.

Ações tomadas:
- Comentário em **#5** explicando a mudança de causa (infra → escopo/dev pendente na API);
  **não fechei #5**, ela evoluiu, não foi resolvida.
- Criadas issues **#9** (`blocked:` OAuth/tokenização de serviço) e **#10** (`blocked:`
  confirmar status TCL/XSL do layoutType FIAT), ambas deixando explícito que a correção é do
  lado da LayoutParserApi, não deste repo. Ambas adicionadas ao Project #4.
- `docs/e2e-fiat-sysmiddle-tcl-xsl.md` ganhou seção 10 "Atualização 2026-08-29 — causas reais
  dos bloqueios", linkando #5/#9/#10.
- Commit local (sem push) só do arquivo de doc que eu mesma escrevi — não toquei nos demais
  arquivos modificados/untracked de outros agentes (harness `.claude/`, specs, config etc.).
