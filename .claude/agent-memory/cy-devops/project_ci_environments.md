---
name: project-ci-environments
description: Estado do CI/CD e GitHub Environments do LayoutParserCypress, criados em 2026-08-29
metadata:
  type: project
---

Workflows `.github/workflows/ci-dev.yml`, `merge-gate.yml`, `prod-gate.yml` e GitHub
Environments `development`/`production` foram criados em 2026-08-29 (autorização explícita
do usuário nesta sessão). Nenhum secret/var real foi populado — ficou como pendência do
usuário preencher pela UI do GitHub: `LP_LAYOUT_PARSER_API_URL`, `LP_POLLUX_URL` (vars) e
`LP_POLLUX_USERNAME`, `LP_POLLUX_PASSWORD` (secrets) em cada Environment, mais
`LP_CNPJ_EMITENTE_TESTE` (var, sintético).

**Descoberta importante**: `LayoutParserCypress` é um repo **PÚBLICO** no GitHub (diferente
de `LayoutParserApi`/`LayoutParserReact`, que são privados). Isso significa que, ao contrário
dos repos irmãos, branch protection clássica nativa do GitHub Free **é tecnicamente possível
aqui** (repos públicos têm acesso a required status checks mesmo no plano Free). O 404 em
`branches/master/protection` aqui reflete "ainda não configurado", não uma limitação de
plano. Ver [[feedback-branch-protection]] e `.claude/rules/agent-authority.md` do próprio
repo para o texto completo.

**Why**: o usuário pediu para criar workflows/Environments e documentar a limitação de
branch protection, assumindo (baseado no LayoutParserApi) que seria a mesma limitação de
plano privado — mas a causa raiz é diferente aqui.

**How to apply**: se o usuário no futuro perguntar sobre habilitar enforcement real de
push/merge neste repo específico, lembrar que aqui (diferente dos irmãos) é possível de
verdade via `gh api -X PUT .../protection`, e que isso ainda não foi feito.
