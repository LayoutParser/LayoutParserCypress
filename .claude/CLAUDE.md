# CLAUDE.md — LayoutParserCypress

Suíte de testes E2E (Cypress) do ecossistema LayoutParser — validação empírica de que os
documentos transformados (NF-e) são aceitos pelo **e-forms/Pollux** (SEFAZ fake de
desenvolvimento da NDD).

> Idioma: responda ao usuário em português (PT-BR).

## 1. O que é este projeto

Repo dedicado, criado do zero em 2026-07-28 (deliberadamente NÃO vendorizado de
`ndd-api-plataforma-cypress` — aquele repo é da plataforma NDD/API Central, produto
diferente; serviu só de referência conceitual). Complementa o ecossistema LayoutParser:

| Repo | Papel |
|------|-------|
| LayoutParserApi | Orquestra parse/transformação de documentos — é o que este repo testa. |
| LayoutParserLib / LayoutParserDecrypt / LayoutParserReact | Demais peças do ecossistema. |
| **LayoutParserCypress** *(este)* | Valida ponta-a-ponta: TXT → transformação → aceito pelo e-forms? |

## 2. Escopo atual (fase alpha — não expandir sem decisão explícita)

Só **Emissão normal de NF-e**, comparando os DOIS pathways de transformação que já existem
na LayoutParserApi:
- **Sysmiddle / LowCode-auto** — `POST /api/parse/upload` (campos `transformationsStatus`/
  `transformations` na resposta — ver histórico do LayoutParserApi, memória
  `unified-logging-and-multi-transform.md`, pra contrato exato).
- **TCL/XSL / Canônico** — `TransformationExecutionController` (`TransformTxtToXmlAsync`).

O objetivo é enviar a saída de AMBOS os pathways pro e-forms/Pollux e comparar qual (ou quais)
retornam autorização (`cStat=100` ou equivalente) — isso serve de oráculo empírico pra saber
qual pathway/mapper está correto para um documento real (motivação original: ambiguidade de
mapeadores da Fiat, múltiplas linhas em `tbMapper` pro mesmo `InputLayoutGuid`).

Cancelamento e Inutilização ficam **fora de escopo por enquanto** — Inutilização em particular
precisa encadear com uma rejeição real (enviar → capturar nNF/série da rejeição → inutilizar
esse número específico), não é extensão trivial; decisão registrada no LayoutParserApi.

## 3. Ambiente alvo

Ambiente de **desenvolvimento** — e-forms/Pollux (SEFAZ fake da NDD). URLs e credenciais vêm de
`cypress.env.json` (gitignored, NUNCA commitado) — ver `cypress.env.json.example` pro que
precisa ser preenchido localmente.

## 4. Agente

`@qa-cypress` — único agente deste repo (ver `.claude/agents/qa-cypress.md`).

## 5. Segurança

NUNCA commitar `cypress.env.json` real (URLs/credenciais de ambiente). NUNCA commitar CNPJ ou
dado real de cliente em fixture — usar dado sintético/de teste sempre que possível.
