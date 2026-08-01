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

## Job 2 — candidatos de IA em batch

O batch consome o `manifest.json` produzido pelo Job 1 e grava os resultados no mesmo diretório
de run. O manifesto deve existir antes da execução; sua ausência retorna exit `2`.

Na VM:

```bash
export LP_METRICS_RUN_DIR=/home/elson/layoutparser-ai-metrics/runs/<runId>
export LP_POLLUX_URL_INSERIR='https://.../WSInserirDocumento'
export LP_POLLUX_URL_CONSULTAR='https://.../WSConsultarProtocolo'
export LP_API_URL='http://.../layoutparserapi' # opcional; POST é best-effort

./run-cypress-batch.sh "$LP_METRICS_RUN_DIR"
```

O wrapper ignora deliberadamente o exit code visual do Cypress e usa
`scripts/verdict.js`: rejeições fiscais são medições válidas; somente `infra_error`, candidato
sem registro ou artefato ausente fazem o Job 2 falhar.

Artefatos gerados:

- `cypress-results.ndjson`: uma linha incremental por candidato.
- `cypress-summary.json`: agregado final e veredito do job.

Se a API estava indisponível, reenvie apenas os registros pendentes sem repetir o Pollux:

```bash
npm run replay:results -- "$LP_METRICS_RUN_DIR"
```

Teste local autocontido (usa Pollux e API simulados, sem acessar os serviços reais):

```bash
npm run test:job2
```
