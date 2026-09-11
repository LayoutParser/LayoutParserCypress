---
description: Matriz de autoridade e delegação entre os agentes do LayoutParserCypress.
---

# Agent Authority — LayoutParserCypress

## Matriz de delegação

### @cy-devops (Gage-e2e) — Autoridade EXCLUSIVA

| Operação | Exclusivo? | Outros agentes |
|----------|-----------|----------------|
| `git push` / `git push --force` | SIM | BLOQUEADO |
| `gh pr create` / `gh pr merge` | SIM | BLOQUEADO |
| Editar `.github/workflows/` | SIM | BLOQUEADO |
| Gestão de `cypress.env.json` real / rotação de credenciais | SIM | BLOQUEADO |

### @cy-architect (Aria) — Design

| Possui | Delega para |
|--------|-------------|
| Desenho do fluxo e2e (UI+API+Ollama+Pollux) | `@qa-cypress` (fluxo UI/gate padrão) / `@cy-ai-flow` (fluxo de candidatos IA) |
| Estratégia de dado sintético | — |
| **NÃO** escreve `.cy.js` nem executa suíte | `@qa-cypress` / `@cy-ai-flow` |

### @qa-cypress (Cass) — Implementação e execução (gate padrão)

| Permitido | Bloqueado |
|-----------|-----------|
| `git add`, `git commit`, `git status`, `git diff` (local) | `git push` → `@cy-devops` |
| Criar/editar specs, rodar suíte, reportar resultado real | Gerir segredo/CI → `@cy-devops` |

### @cy-ai-flow (Lia-e2e) — Fluxo de candidatos IA/Ollama

| Possui | Não possui |
|--------|-----------|
| `ia-candidates-batch.cy.js`, `verdict.js`, semântica de veredito do Job 2 | Gate padrão dos mapeadores (`@qa-cypress`) |
| Diagnóstico de timeout/infra na chamada ao Pollux | git push |

### @cy-doc (Duda-e2e) — Documentação

| Possui | Não possui |
|--------|-----------|
| README, CLAUDE.md, documentação de fluxo | Código de produção/spec · git push |

## Fluxos de delegação

```
Novo cenário e2e:  @cy-architect (desenha) → @qa-cypress / @cy-ai-flow (implementa e roda)
                   → @cy-doc (documenta) → @cy-devops (push)

Git push:          QUALQUER agente → @cy-devops *push

Segredo exposto:   QUALQUER agente detecta → @cy-devops *secure-secrets
```

## Escalonamento

1. Agente não consegue concluir → escalar ao usuário com contexto.
2. Ambiente (`cypress.env.json`) incompleto → parar e pedir ao usuário, nunca hardcode.
3. Segredo/credencial detectado → BLOQUEIA commit, aciona `@cy-devops`.

## Enforcement técnico da branch protection — mesma limitação (com uma ressalva)

A matriz acima ("`@cy-devops` é o único que publica") vale hoje por **convenção
documentada**, não por bloqueio técnico do GitHub. Confirmado em 2026-08-29:

```
gh api repos/LayoutParser/LayoutParserCypress/branches/master/protection
→ 404 "Branch not protected"
```

Ou seja: qualquer colaborador com permissão de escrita no repo consegue, hoje, dar
`git push` direto em `master` ou mergear um PR sem que nenhum gate técnico impeça — os
workflows de CI (`ci-dev.yml`, `merge-gate.yml`) rodam e reportam status, mas não bloqueiam
merge de fato (ver comentário em `merge-gate.yml`).

Esse é o mesmo cenário já documentado no LayoutParserApi
(`../LayoutParserApi/.claude/rules/agent-authority.md` §"Enforcement técnico da branch
protection — PERDIDO"), mas a causa raiz é diferente aqui:

- **LayoutParserApi / LayoutParserReact**: repositórios **privados** em plano GitHub Free —
  branch protection nativa (required status checks / required reviewers) não está disponível
  nesse plano para repo privado.
- **LayoutParserCypress**: este repo é **público**
  (`gh repo view --json isPrivate,visibility` → `isPrivate: false`). Repositórios públicos
  **têm acesso a branch protection clássica no plano Free**, inclusive em conta pessoal —
  a limitação de plano privado não se aplica aqui. O 404 acima significa apenas "ainda não
  configurada", não "impossível de configurar".

**Atualização 2026-08-29 — habilitada de verdade.** O usuário pediu explicitamente para
ativar. Ativado via `gh api --method PUT repos/LayoutParser/LayoutParserCypress/branches/master/protection`:

- `required_pull_request_reviews`: 1 aprovação, descarta aprovações velhas em novo push.
- `required_status_checks.contexts`: `["Gate dos mapeadores (dev)"]` (job de `ci-dev.yml`), `strict=true` (branch precisa estar atualizada com `master`).
- `allow_force_pushes=false`, `allow_deletions=false`.
- `enforce_admins=false` — o dono do repo ainda pode contornar em emergência; mude para `true` se quiser que nem admin escape.

A partir de agora, ao contrário do LayoutParserApi/LayoutParserReact, um `git push` direto em
`master` deste repo **é rejeitado pelo GitHub de verdade**, não só por convenção. Só PR com CI
verde (`ci-dev.yml` + `enforce-develop-to-master.yml`) consegue mergear.

**Atualização 2026-09-10 — `required_approving_review_count` zerado.** O usuário (dono e único
colaborador do repo) confirmou o motivo: o GitHub nunca conta auto-aprovação do próprio autor
do PR, então `required_approving_review_count: 1` bloqueava merge de qualquer PR dele mesmo com
`enforce_admins: false` — a exigência de review (diferente de status checks) não tem bypass
equivalente pra quem só tem a si mesmo como revisor possível. Ação: `gh api --method PATCH
repos/LayoutParser/LayoutParserCypress/branches/master/protection/required_pull_request_reviews`
com `required_approving_review_count=0`, mantendo `dismiss_stale_reviews=true`,
`require_code_owner_reviews=false`, `require_last_push_approval=false`. Resto da proteção
inalterado: `required_status_checks.contexts = ["Gate dos mapeadores (dev)", "PR para master
vem de develop?"]`, `strict=true`, `allow_force_pushes=false`, `allow_deletions=false`,
`enforce_admins=false`. Ou seja: merge para `master` continua exigindo CI verde e PR vindo de
`develop`, só não exige mais aprovação de terceiro — requisito impossível de satisfazer com um
único colaborador.

**Atualização 2026-09-11 — `Gate dos mapeadores (dev)` removido dos checks obrigatórios.**
Autorizado explicitamente pelo usuário (dono do repo). Motivo: esse check falha sempre, e vai
continuar falhando, por uma limitação estrutural de rede — o job de `ci-dev.yml` roda em runner
hospedado do GitHub, que não tem acesso à rede interna da NDD (auth M2M, runner Sysmiddle, SQL
Server compartilhado ficam em rede privada). Não é falha de qualidade do código; é ausência de
runner self-hosted com acesso a essa rede. Isso estava bloqueando o merge do PR #18
(`develop`→`master`) mesmo com `mergeable=true` e conflitos já resolvidos.

Ação: `gh api --method PATCH
repos/LayoutParser/LayoutParserCypress/branches/master/protection/required_status_checks` com
`strict=true` e `contexts=["PR para master vem de develop?"]` (removendo `Gate dos mapeadores
(dev)` da lista). Confirmado via GET que `required_status_checks.contexts` agora contém só
`"PR para master vem de develop?"`.

Importante: o workflow `ci-dev.yml` **continua rodando normalmente** em todo PR — só deixou de
ser bloqueante. Ele segue informativo: se algum dia existir runner self-hosted com acesso à
rede interna da NDD, o check pode voltar a ser adicionado aos `contexts` obrigatórios. Até lá,
falha nesse check não impede merge, mas deve ser lida pelo time como sinal de que a suíte não
pôde validar contra o e-forms/Pollux real — não como "está tudo verde".
