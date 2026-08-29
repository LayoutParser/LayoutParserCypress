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

Por instrução explícita recebida nesta sessão, nenhuma tentativa de
`gh api ... -X PUT .../protection` foi feita — a criação de regra de proteção real (required
status check apontando pro job `ci-dev` / `merge-gate`, restrição de push direto) fica como
decisão do usuário, não do agente. Se o usuário quiser habilitar enforcement técnico de
verdade neste repo (diferente dos repos irmãos, aqui é tecnicamente possível), isso deve ser
pedido explicitamente a `@cy-devops`.
