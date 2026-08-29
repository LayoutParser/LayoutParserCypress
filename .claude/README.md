# Harness Claude Code — LayoutParserCypress

Este diretório configura o desenvolvimento assistido por IA da suíte E2E. Espelha o padrão
usado em LayoutParserApi/LayoutParserReact, adaptado ao escopo deste repo (specs Cypress).

## Estrutura

```
.claude/
├── CLAUDE.md                # Comportamento base, escopo do teste e mapa de agentes
├── agents/
│   ├── cy-architect.md      # Aria      — desenha o fluxo e2e (UI+API/Ollama+Pollux), não implementa
│   ├── qa-cypress.md        # Cass      — implementa/roda specs do gate padrão (existente)
│   ├── cy-ai-flow.md        # Lia-e2e   — fluxo de candidatos IA/Ollama (ia-candidates-batch)
│   ├── cy-devops.md         # Gage-e2e  — git push (exclusivo), CI, segredos
│   └── cy-doc.md            # Duda-e2e  — documentação bilíngue
├── rules/
│   ├── agent-authority.md   # Quem pode o quê (push é só do devops)
│   ├── agent-handoff.md     # Compactação de contexto ao trocar de agente
│   └── security.md          # Segredos, dado de teste, LLM local vs. nuvem
├── commands/
│   ├── new-e2e-flow.md      # /new-e2e-flow — desenha + implementa cenário novo
│   ├── run-suite.md         # /run-suite — roda gate padrão, batch ou job2
│   ├── security-scan.md     # /security-scan — varre segredos/dado real
│   └── trace-verdict.md     # /trace-verdict — diagnostica veredito do Pollux
├── hooks/
│   └── git-push-advisory.cjs # Lembrete não-bloqueante sobre push (Node)
├── settings.json.example    # Template de settings (idioma + permissões + hook)
└── README.md                # este arquivo
```

## Como usar

```
@cy-architect desenhe o fluxo e2e via UI para o layout FIAT (LAY_ad4fb6f4-...) com o TXT X
@qa-cypress   implemente a spec conforme o desenho, rodando via UI do LayoutParserReact
@cy-ai-flow   rode o batch de candidatos e reporte o summary
@cy-doc       documente o novo cenário no README
@cy-devops    faça push quando a suíte estiver verde de verdade
```

Fluxo típico:

```
@cy-architect → @qa-cypress / @cy-ai-flow → @cy-doc → @cy-devops
```

### Ativar o settings (opcional)

```bash
cp .claude/settings.json.example .claude/settings.json
# remova as chaves de comentário "//..." (JSON não aceita comentários)
```

> Use `.claude/settings.local.json` para overrides por máquina (não versionar).

## Princípios do harness

1. **Enxuto > completo:** 5 agentes cobrindo o ciclo deste repo (não replica os 7 da API).
2. **Autoridade clara:** só `@cy-devops` publica e mexe em segredos/CI.
3. **Duas semânticas de veredito, nunca misturadas:** gate padrão (rejeição = FALHA) vs.
   batch de IA (só ausência de veredito = FALHA) — ver CLAUDE.md §2.
4. **Nunca declarar verde sem rodar** — regra de ouro de todo agente aqui.
