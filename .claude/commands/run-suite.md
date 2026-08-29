---
description: Roda a suíte relevante (gate padrão ou batch de IA) e reporta o resultado fielmente.
---

# /run-suite

Uso: `/run-suite [mappers|batch|job2]`

- `mappers` (default): `npm run test:mappers` — gate padrão, qualquer rejeição fiscal falha.
- `batch`: `npm run batch` — candidatos de IA, só ausência de veredito do Pollux falha.
- `job2`: `npm run test:job2` — teste de integração do job2 em Node.

Invoque `@qa-cypress` (mappers) ou `@cy-ai-flow` (batch/job2). Reporte a saída real do
Cypress/Node, nunca resumida a ponto de esconder a causa de uma falha.
