---
description: Protocolo de handoff (compactação de contexto) ao trocar de agente.
---

# Agent Handoff — LayoutParserCypress

## Propósito

Evitar acúmulo de contexto ao alternar entre agentes (`@cy-*` / `@qa-cypress`). Em cada
troca, o agente que sai é compactado num **artefato de handoff (~400 tokens)**.

## Artefato de handoff

```yaml
handoff:
  from_agent: "{agente_atual}"
  to_agent: "{novo_agente}"
  contexto:
    tarefa: "{tarefa/missão em andamento}"
    cenario: "{layout/TXT/spec envolvido}"
    arquivos_tocados: ["{arquivo 1}", "{arquivo 2}"]   # máx. 10
  decisoes:                                            # máx. 5
    - "{decisão-chave 1}"
  bloqueios: ["{bloqueio ativo, se houver}"]           # máx. 3
  proximo_passo: "{o que o agente que entra deve fazer}"
```

## O que SEMPRE preservar
- Cenário/layout/TXT em teste e branch atual.
- Arquivos de spec criados/alterados.
- Critério de veredito acordado (gate padrão vs. semântica do batch de IA).
- Bloqueios ativos (ex.: `cypress.env.json` incompleto) e próximo passo.

## O que SEMPRE descartar
- Persona completa do agente anterior.
- Lista de tools/missões do agente anterior.

## Exemplo

`@cy-architect` desenha o fluxo UI→API→Ollama→Pollux para um layout novo → troca para
`@qa-cypress`: persona da arquiteta é descartada; handoff retém o desenho (passos +
critério de veredito) e o próximo passo (implementar a spec).

## Handoff não substitui documentação persistente

O handoff acima é **efêmero** — existe só para a troca de contexto entre agentes na mesma
sessão, e é descartado depois. Ele **não é** o registro do que foi feito.

Toda entrega relevante (novo cenário e2e, mudança de escopo, decisão não óbvia, resultado
de execução real) precisa, além do handoff, virar:

1. **Item no GitHub Project** deste repo, via `@cy-pm` (`gh issue`/`gh project item-add`).
2. **Doc persistente** em `docs/` deste repo, via `@cy-pm` missão `doc-persist` — o que foi
   pedido, desenhado, implementado e o resultado real (inclusive bloqueios).

Qualquer agente que concluir uma entrega relevante deve, antes de encerrar, acionar
`@cy-pm` para registrar — não basta deixar só no handoff ou na memória interna do agente.
