# LayoutParserCypress

Suíte de testes E2E (Cypress) do ecossistema LayoutParser — validação empírica de que os
documentos transformados (NF-e) são aceitos pelo **e-forms/Pollux** (SEFAZ fake de
desenvolvimento da NDD). Complementa os demais repos do ecossistema (`LayoutParserApi`,
`LayoutParserLib`, `LayoutParserDecrypt`, `LayoutParserReact`), fechando o ciclo com validação
externa de aceitação — não só que a transformação roda, mas que o resultado é aceito pelo
ambiente fiscal de destino.

## Como rodar

1. Instalar dependências:
   ```bash
   npm install
   ```
2. Copiar o template de variáveis de ambiente e preencher com os valores reais locais
   (URL da LayoutParserApi de dev, URL do e-forms/Pollux de dev, credenciais/CNPJ de teste):
   ```bash
   cp cypress.env.json.example cypress.env.json
   ```
   `cypress.env.json` é ignorado pelo git — nunca commitar valores reais.
3. Abrir o Cypress em modo interativo:
   ```bash
   npm run cypress:open
   ```
   Ou rodar a suíte em modo headless:
   ```bash
   npm run cypress:run
   ```

## Escopo atual

Ver [`.claude/CLAUDE.md`](.claude/CLAUDE.md) para o escopo detalhado (fase alpha: só emissão
normal de NF-e, comparando os pathways Sysmiddle e TCL/XSL).
