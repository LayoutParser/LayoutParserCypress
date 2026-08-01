#!/usr/bin/env bash
# Job 2 — Cypress em modo batch. Wrapper chamado pelo encadeamento do cron na VM
# (172.25.32.31), logo após o Job 1 (ai/XslSynth --mode=metrics-batch).
#
#   Uso: ./run-cypress-batch.sh <runDir>
#        (ou LP_METRICS_RUN_DIR exportado, sem argumento)
#
# DECISÃO CENTRAL (§5.2 do handoff): o exit code do `cypress run` é IGNORADO. Ele fica ≠ 0
# sempre que algum candidato é rejeitado pelo Pollux — e rejeição é o DADO que este job existe
# para coletar, não uma falha. Quem define o exit code do Job 2 é o scripts/verdict.js, a
# partir do cypress-summary.json.
#
# `set -e` também é evitado de propósito: queremos tratar a falha e ainda escrever o veredito,
# não abortar mudo no meio.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

RUN_DIR="${1:-${LP_METRICS_RUN_DIR:-}}"

if [ -z "$RUN_DIR" ]; then
  echo "[job2] ERRO: informe o run dir do Job 1 como argumento ou exporte LP_METRICS_RUN_DIR." >&2
  echo "[job2]        uso: $0 <runDir>" >&2
  exit 2
fi

# Fail-fast antes de pagar o boot do Cypress: sem manifesto, o Job 1 não entregou o contrato.
# (O verdict.js repete esta checagem — é a mesma regra, aplicada nos dois pontos de entrada.)
if [ ! -f "$RUN_DIR/manifest.json" ]; then
  echo "[job2] ERRO: manifest.json ausente em $RUN_DIR — o Job 1 não completou (o manifesto é" >&2
  echo "[job2]        escrito por último, logo sua ausência significa run incompleto)." >&2
  echo "[job2]        Nenhum artefato foi escrito. Veredito do Job 2: FAIL(2)." >&2
  exit 2
fi

export LP_METRICS_RUN_DIR="$RUN_DIR"

# O default (~/.cache/Cypress) resolve pelo HOME do usuário: se o cron rodar sob usuário
# diferente do que instalou, o binário "some" e o Cypress tenta baixar 200 MB dentro do cron.
export CYPRESS_CACHE_FOLDER="${CYPRESS_CACHE_FOLDER:-/home/elson/.cache/Cypress}"

# Overrides existem só para ambientes onde `node`/`npx` não estão no PATH padrão (ex.: rodar
# este script no WSL contra o Node do Windows durante o desenvolvimento). Na VM os defaults valem.
NPX_BIN="${LP_NPX_BIN:-npx}"
NODE_BIN="${LP_NODE_BIN:-node}"

echo "[job2] runDir=$RUN_DIR"
echo "[job2] CYPRESS_CACHE_FOLDER=$CYPRESS_CACHE_FOLDER"

# NÃO envolver em `xvfb-run`: o Cypress sobe o Xvfb ele mesmo quando DISPLAY está ausente
# (caso do cron). `xvfb-run` por fora conflita com o Xvfb interno e mascara erros. O pacote
# `xvfb` precisa estar instalado, só isso.
#
# `--config baseUrl=` NÃO é cosmético: com um baseUrl definido, o Cypress faz um health check
# nele e ABORTA o run inteiro se o servidor não responder ("Cypress failed to verify that your
# server is running"), antes de qualquer teste e antes de escrever qualquer artefato. Como este
# job roda sábado de madrugada — exatamente quando a LayoutParserApi pode estar fora do ar — o
# Job 2 morreria sem sequer registrar o motivo. A spec do Job 2 usa só URLs absolutas
# (cypress.env.json), então baseUrl é dispensável aqui.
"$NPX_BIN" cypress run --config baseUrl= --spec cypress/e2e/ia-candidates-batch.cy.js
CYPRESS_EXIT=$?
echo "[job2] cypress run terminou com exit=$CYPRESS_EXIT (ignorado de propósito — ver cabeçalho)"

"$NODE_BIN" "$SCRIPT_DIR/scripts/verdict.js" "$RUN_DIR"
VERDICT_EXIT=$?

echo "[job2] veredito final do Job 2: exit=$VERDICT_EXIT"
exit $VERDICT_EXIT
