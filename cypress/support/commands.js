// ***********************************************
// Comandos customizados do Cypress para este projeto.
// ***********************************************

/**
 * Envia um XML de NF-e já transformado para o e-forms/Pollux (WSInserirDocumento) e,
 * na sequência, consulta o protocolo retornado (WSConsultarProtocolo).
 *
 * Adaptado da lógica real de
 * ndd-api-plataforma-cypress/ndd-eforms-stage/cypress/e2e/webservices-eforms/inserirDocumento.cy.js
 * (NÃO copiado estrutura de pastas, só o padrão de chamada SOAP/CDATA).
 *
 * Nenhuma credencial HTTP (Basic Auth/header) é usada aqui de propósito — o fluxo real
 * inspecionado (referência acima) não envia Authorization, e `poluxUsername`/`poluxPassword`
 * ficaram vazios em cypress.env.json porque não foram encontrados em nenhum dos dois projetos
 * NDD-fonte. Se isso mudar (ambiente exigir auth), o correto é adicionar aqui, não inventar.
 *
 * @param {string} xmlNFe - XML da NF-e (envi NFe) já transformado por um dos pathways.
 * @returns {Cypress.Chainable<{protocolo: string, cStat: string|null, mensagemGeral: string, mensagemItem: string, insercaoBody: string, consultaBody: string}>}
 */
Cypress.Commands.add("enviarNFeParaPolux", (xmlNFe) => {
  const urlInserir = Cypress.expose("poluxUrlInserirDocumento");
  const urlConsultar = Cypress.expose("poluxUrlConsultarProtocolo");

  if (!urlInserir || !urlConsultar) {
    throw new Error(
      "poluxUrlInserirDocumento/poluxUrlConsultarProtocolo não configurados em cypress.env.json — não invente a URL, preencha o arquivo local."
    );
  }

  return cy.fixture("webservices/inserirDocumento.xml").then((envelopeInserir) => {
    const bodyInserir = envelopeInserir.replace("{{DOCUMENTO}}", xmlNFe);

    return cy
      .request({
        method: "POST",
        url: urlInserir,
        headers: { "Content-Type": "text/xml;charset=UTF-8" },
        body: bodyInserir,
        failOnStatusCode: false,
      })
      .then((responseInserir) => {
        expect(responseInserir.status, "status HTTP do WSInserirDocumento").to.eq(200);

        const parser = new DOMParser();
        const soapDoc = parser.parseFromString(responseInserir.body, "text/xml");
        const resultNode = soapDoc.getElementsByTagName("eDocumentResult")[0];

        if (!resultNode) {
          throw new Error(
            `WSInserirDocumento não retornou eDocumentResult. Corpo bruto (truncado): ${String(
              responseInserir.body
            ).slice(0, 500)}`
          );
        }

        const xmlInterno = resultNode.textContent;
        const protocolo = xmlInterno.match(/<protocolo>(.*?)<\/protocolo>/)?.[1];
        const mensagemInsercao = xmlInterno.match(/<mensagem>(.*?)<\/mensagem>/)?.[1];

        if (!protocolo) {
          // Não força passthrough: reporta o que o Pollux disse antes de estourar.
          throw new Error(
            `Pollux não retornou protocolo (rejeição na inserção). Mensagem: ${
              mensagemInsercao ?? "(não encontrada)"
            }. XML interno (truncado): ${xmlInterno.slice(0, 800)}`
          );
        }

        cy.log(`Protocolo Pollux: ${protocolo}`);

        // Tempo de processamento assíncrono do lado do e-forms antes da consulta ficar disponível
        // (mesmo valor usado na referência real, ndd-eforms-stage).
        cy.wait(5000);

        return cy.fixture("webservices/consultarProtocolo.xml").then((envelopeConsultar) => {
          const bodyConsultar = envelopeConsultar.replace("{{PROTOCOLO}}", protocolo);

          return cy
            .request({
              method: "POST",
              url: urlConsultar,
              headers: { "Content-Type": "text/xml;charset=UTF-8" },
              body: bodyConsultar,
              failOnStatusCode: false,
            })
            .then((responseConsultar) => {
              expect(responseConsultar.status, "status HTTP do WSConsultarProtocolo").to.eq(200);

              const soapDocConsulta = parser.parseFromString(responseConsultar.body, "text/xml");
              const resultNodeConsulta = soapDocConsulta.getElementsByTagName(
                "ConsultarProtocoloResult"
              )[0];

              if (!resultNodeConsulta) {
                throw new Error(
                  `WSConsultarProtocolo não retornou ConsultarProtocoloResult. Corpo bruto (truncado): ${String(
                    responseConsultar.body
                  ).slice(0, 500)}`
                );
              }

              const retornoDoc = parser.parseFromString(resultNodeConsulta.textContent, "text/xml");

              const mensagemGeral = retornoDoc
                .getElementsByTagName("eformsConsultarProtocoloRetorno")[0]
                ?.getElementsByTagName("mensagemconsulta")[0]
                ?.getElementsByTagName("mensagem")[0]?.textContent;

              const itemProtocolo = retornoDoc.getElementsByTagName("itemprotocolo")[0];
              const mensagemItem = itemProtocolo
                ?.getElementsByTagName("mensagemconsulta")[0]
                ?.getElementsByTagName("mensagem")[0]?.textContent;

              // cStat, quando presente, é o oráculo mais forte de autorização SEFAZ (100 = autorizado).
              // O ambiente e-forms pode não expor cStat diretamente na consulta de protocolo (a
              // referência real só valida as mensagens de texto acima) — por isso capturamos os
              // dois sinais e deixamos a spec decidir qual usar.
              const cStat = resultNodeConsulta.textContent.match(/<cStat>(\d+)<\/cStat>/)?.[1] ?? null;

              return {
                protocolo,
                cStat,
                mensagemGeral: mensagemGeral ?? null,
                mensagemItem: mensagemItem ?? null,
                insercaoBody: responseInserir.body,
                consultaBody: responseConsultar.body,
              };
            });
        });
      });
  });
});

/**
 * Variante SOFT usada pelo Job 2 (batch de candidatos da IA) — ver
 * `cypress/e2e/ia-candidates-batch.cy.js` e o handoff §5.1.3.
 *
 * Diferença deliberada em relação ao `cy.enviarNFeParaPolux` acima: este comando **sempre
 * resolve**, nunca lança. No Job 2 o Cypress é instrumento de MEDIÇÃO, não gate de qualidade —
 * uma NF-e recusada pelo Pollux (sem protocolo, cStat ≠ 100) é `rejected`, que é exatamente o
 * dado que o painel de métricas de IA quer; não é crash. Só a AUSÊNCIA de veredito (Pollux
 * inacessível, timeout, HTTP ≠ 200, resposta ilegível) é `infra_error`.
 *
 * O comando alpha acima NÃO foi alterado — `nfe-emissao-normal.cy.js` depende do `throw`.
 *
 * Implementado sobre `cy.task` (Node) e não sobre `cy.request` por um motivo concreto:
 * `cy.request` não tem catch — uma falha de rede aborta o teste e o candidato ficaria sem
 * linha no NDJSON, perdendo justamente o registro de `infra_error`. Além disso mantém a
 * lógica SOAP em módulo Node reusável pelo plano B da §6.6 (runner sem Cypress).
 *
 * @param {string|{candidateId?: string, xmlPath?: string}} alvo
 *   XML de NF-e (string) OU o objeto candidato do manifesto (o XML é lido do run dir).
 * @returns {Cypress.Chainable<{outcome: 'accepted'|'rejected'|'infra_error', cStat: string|null,
 *   protocolo: string|null, mensagemGeral: string|null, mensagemItem: string|null,
 *   erro: string|null, durationMs: number}>}
 */
Cypress.Commands.add("enviarNFeParaPolluxSoft", (alvo) => {
  const argumentos = typeof alvo === "string" ? { xml: alvo } : { candidate: alvo };
  // Teto de tempo por candidato (inserir + espera do protocolo + consultar). Configurável para
  // não exigir edição de código ao ajustar o ambiente; se estourar, quem registra o
  // `infra_error` é a rede de segurança do afterEach da spec.
  const timeout = Number(Cypress.expose("lpTaskTimeoutMs") || 180000);
  return cy.task("enviarPollux", argumentos, { log: true, timeout });
});
