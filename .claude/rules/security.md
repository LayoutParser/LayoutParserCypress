---
description: Regras de segurança para este repo de testes E2E.
---

# Security — LayoutParserCypress

## Segredos e ambiente

- `cypress.env.json` **NUNCA** é commitado (já está no `.gitignore`) — contém URLs e
  credenciais do ambiente de desenvolvimento (LayoutParserApi, e-forms/Pollux).
- Variáveis `LP_*` (ex.: `LP_API_URL`, `LP_POLLUX_URL_INSERIR`) têm precedência sobre o
  arquivo local — usadas em CI/VM. Não hardcode valor plausível em `cypress.config.js`
  quando faltar: pare e peça ao usuário.
- Ao encontrar credencial/URL sensível em texto plano fora de `cypress.env.json`, sinalize
  e acione `@cy-devops`.

## Dados de teste

- **NUNCA** commitar CNPJ real ou dado real de cliente em fixture/spec.
- Dados sintéticos de layout/TXT usados em desenho de cenário (`@cy-architect`) devem ser
  anonimizados antes de virar fixture versionada.
- Arquivos de exemplo fora do repo (ex.: `.claude/temp/` em repos irmãos) podem conter dado
  real de cliente da NDD — nunca copiar para dentro deste repo sem anonimizar primeiro.

## LLM/Ollama

- O fluxo de geração de TCL/XSL usa Ollama local primeiro (dado sensível fica on-premise);
  fallback em nuvem (Gemini/OpenAI) é decisão do lado da LayoutParserApi, não deste repo.
  Se um cenário e2e expuser documento real indo para LLM em nuvem, pare e avise o usuário.
