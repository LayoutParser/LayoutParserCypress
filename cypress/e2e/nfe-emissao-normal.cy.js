// Gate E2E dos mapeadores padrão de emissão normal de NF-e.
//
// Para cada cliente: a API gera TCL/XSL a partir do layout SysMiddle cadastrado, executa o
// TXT posicional com esses artefatos e devolve transformedXml; o Cypress submete essa saída
// ao Pollux. Aqui rejeição fiscal FALHA o job — diferente do batch de métricas da IA, onde
// rejected é uma medição válida.

const casos = [
  {
    cliente: "FIAT",
    layoutName:
      Cypress.expose("fiatLayoutName") ||
      "LAY_TXT_MQSERIES_ENVNFE_4.00_NFe",
    layoutGuid: "ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c",
    fixture: "txt-input/nfe-emissao-normal.mq_series.txt",
    fileName: "QMWNFe1_QMWNFE1.SAPiens_MRB.INBOX_07-11-2025.mq_series.txt",
  },
];

function validarAceitacaoPollux(xmlTransformado, cliente) {
  return cy.enviarNFeParaPolux(xmlTransformado).then((resultado) => {
    cy.log(`[${cliente}] protocolo=${resultado.protocolo} cStat=${resultado.cStat}`);
    cy.log(`[${cliente}] mensagemGeral=${resultado.mensagemGeral}`);
    cy.log(`[${cliente}] mensagemItem=${resultado.mensagemItem}`);

    if (resultado.cStat) {
      expect(resultado.cStat, `cStat retornado pelo Pollux para ${cliente}`).to.eq("100");
      return;
    }

    expect(
      resultado.mensagemGeral,
      `mensagem geral de sucesso do Pollux para ${cliente}`
    ).to.equal("Processo de consulta realizado com sucesso");
    expect(resultado.mensagemItem, `mensagem do item de protocolo para ${cliente}`).to.equal(
      "Processo realizado com sucesso"
    );
  });
}

describe("Mapeadores padrão — TXT posicional → TCL/XSL gerado → NF-e → Pollux", () => {
  casos.forEach((caso) => {
    it(`${caso.cliente} — gera, transforma e obtém autorização do Pollux`, () => {
      const apiUrl = Cypress.expose("layoutParserApiUrl");
      expect(apiUrl, "layoutParserApiUrl (LP_API_URL ou cypress.env.json)")
        .to.be.a("string")
        .and.not.be.empty;

      const generationTimeout = Number(Cypress.expose("mapperGenerationTimeoutMs") || 120000);
      const executionTimeout = Number(Cypress.expose("mapperExecutionTimeoutMs") || 120000);

      cy.fixture(caso.fixture, "utf-8").then((txtInput) => {
        // 1. Gera os artefatos que estão sob teste. Não aceitamos XSL/TCL antigo em disco:
        // cada rodada exercita a geração atual da API para este layout.
        cy.request({
          method: "POST",
          url: `${apiUrl}/api/AutoTransformation/generate-for-layout`,
          body: { layoutGuid: caso.layoutGuid, layoutName: caso.layoutName },
          failOnStatusCode: false,
          timeout: generationTimeout,
        }).then((generationResponse) => {
          cy.log(`[${caso.cliente}] status geração TCL/XSL: ${generationResponse.status}`);

          expect(
            generationResponse.status,
            `geração TCL/XSL falhou: ${JSON.stringify(generationResponse.body).slice(0, 800)}`
          ).to.eq(200);
          expect(generationResponse.body.success, "success=true na geração TCL/XSL").to.eq(true);
          expect(generationResponse.body.layoutName, "layout exato selecionado no catálogo").to.eq(
            caso.layoutName
          );
          expect(
            String(generationResponse.body.layoutGuid).toLowerCase(),
            "GUID exato do layout SysMiddle selecionado"
          ).to.eq(caso.layoutGuid);

          const generatedFiles = Array.isArray(generationResponse.body.generatedFiles)
            ? generationResponse.body.generatedFiles
            : [];
          expect(
            generatedFiles.some((arquivo) => /\.tcl$/i.test(String(arquivo))),
            "arquivo TCL gerado"
          ).to.eq(true);
          expect(
            generatedFiles.some((arquivo) => /\.xsl(?:t)?$/i.test(String(arquivo))),
            "arquivo XSL/XSLT gerado"
          ).to.eq(true);

          // 2. Executa exatamente o TXT posicional indicado usando os artefatos recém-gerados.
          cy.request({
            method: "POST",
            url: `${apiUrl}/api/transformation-execution/execute`,
            body: {
              inputContent: txtInput,
              layoutName: caso.layoutName,
              targetDocumentType: "NFe",
              validate: false,
              fileName: caso.fileName,
            },
            failOnStatusCode: false,
            timeout: executionTimeout,
          }).then((executionResponse) => {
            cy.log(`[${caso.cliente}] status transformação: ${executionResponse.status}`);

            expect(
              executionResponse.status,
              `transformação falhou: ${JSON.stringify(executionResponse.body).slice(0, 800)}`
            ).to.eq(200);
            expect(executionResponse.body.success, "success=true na transformação").to.eq(true);

            const xmlTransformado = executionResponse.body.transformedXml;
            expect(xmlTransformado, "transformedXml presente e não vazio")
              .to.be.a("string")
              .and.not.be.empty;

            validarAceitacaoPollux(xmlTransformado, caso.cliente);
          });
        });
      });
    });
  });
});
