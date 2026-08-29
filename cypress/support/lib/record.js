// Formato do registro NDJSON do Job 2 (contrato §3.1 do handoff-job2-cypress-batch.md).
//
// Módulo SEM dependência de `fs`/`http` de propósito: é o único da pasta lib/ que precisa
// rodar dos DOIS lados da fronteira — no browser (a spec monta o registro) e em Node (tasks,
// replay, plano B da §6.6). Se você adicionar um `require("fs")` aqui, a spec quebra no bundle.

const OUTCOME_ACCEPTED = "accepted";
const OUTCOME_REJECTED = "rejected";
const OUTCOME_INFRA_ERROR = "infra_error";
const SCHEMA_VERSION = 1;

/**
 * Monta a linha do cypress-results.ndjson para um candidato.
 *
 * ⚠️ O DETALHE QUE MATA ESTA INTEGRAÇÃO: `layout` é copiado BYTE-A-BYTE do manifesto, com as
 * barras invertidas (`NFe\4.00\NFe009_4.00_EnvioNFe_NeoGridToSefaz`). É a chave de junção com
 * o `AiMetricsReaderService` da LayoutParserApi. Normalizar para `/`, mudar a caixa ou cortar
 * o prefixo faz o merge falhar SILENCIOSAMENTE, sem erro nenhum, e o painel fica vazio.
 * Nenhuma transformação neste campo. Nenhuma.
 *
 * @param {{candidateId?: string, layout?: string}} candidate Candidato como veio do manifesto.
 * @param {{outcome: string, cStat?: string|null, protocolo?: string|null,
 *          mensagemGeral?: string|null, mensagemItem?: string|null, erro?: string|null,
 *          durationMs?: number|null}} resultado Veredito do Pollux.
 * @param {{runId?: string|null}} meta
 */
function montarRegistro(candidate, resultado, meta = {}) {
  const outcome = resultado.outcome;
  return {
    schemaVersion: SCHEMA_VERSION,
    runId: meta.runId ?? null,
    candidateId: candidate.candidateId ?? null,
    layout: candidate.layout ?? null, // ⚠️ sem transformação — ver comentário acima
    outcome,
    cypressValidado:
      outcome === OUTCOME_ACCEPTED ? true : outcome === OUTCOME_REJECTED ? false : null,
    cStatPollux: resultado.cStat ?? null,
    protocolo: resultado.protocolo ?? null,
    mensagemGeral: resultado.mensagemGeral ?? null,
    mensagemItem: resultado.mensagemItem ?? null,
    observacao: resultado.erro ?? null,
    durationMs: typeof resultado.durationMs === "number" ? resultado.durationMs : null,
    posted: false, // atualizado pela task `postResult` quando o POST for aceito
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  SCHEMA_VERSION,
  OUTCOME_ACCEPTED,
  OUTCOME_REJECTED,
  OUTCOME_INFRA_ERROR,
  montarRegistro,
};
