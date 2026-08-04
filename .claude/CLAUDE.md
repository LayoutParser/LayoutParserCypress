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

## 2. Escopo atual

Só **Emissão normal de NF-e**. O gate dos mapeadores padrão segue o fluxo:

1. a LayoutParserApi gera TCL + XSL para o layout SysMiddle cadastrado
   (`POST /api/AutoTransformation/generate-for-layout`);
2. a API executa o TXT posicional com os artefatos recém-gerados
   (`POST /api/transformation-execution/execute`);
3. o Cypress envia o `transformedXml` ao e-forms/Pollux e exige autorização
   (`cStat=100` ou equivalente).

A matriz começa com **FIAT** (`LAY_TXT_MQSERIES_ENVNFE_4.00_NFe`, layout GUID
`LAY_ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c`). A expansão planejada é Comau, Marelli e CNHi,
um `it()` isolado por mapeador, quando cada par layout + TXT estiver habilitado.

O batch de candidatos sintetizados pela IA é uma suíte separada
(`ia-candidates-batch.cy.js`) e conserva sua própria semântica de veredito: rejeição é medição
válida; apenas ausência de veredito do Pollux falha o Job 2. No gate dos mapeadores padrão,
qualquer rejeição fiscal falha o teste.

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
