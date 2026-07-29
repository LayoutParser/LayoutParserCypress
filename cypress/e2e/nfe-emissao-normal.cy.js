// Fase alpha (ver .claude/CLAUDE.md) — Emissão normal de NF-e, comparando os dois pathways de
// transformação da LayoutParserApi (TCL/XSL canônico e Sysmiddle/LowCode) contra o oráculo real
// e-forms/Pollux (SEFAZ fake de dev). Um teste passa quando o Pollux autoriza (cStat=100 ou
// mensagem de sucesso equivalente) a NF-e gerada por aquele pathway especificamente.
//
// Entrada real: TXT MQSeries de exemplo (não sintético) — ver histórico do LayoutParserApi,
// .claude/tmp/exemplos/txt input/ — copiado para cypress/fixtures/txt-input/.
//
// IMPORTANTE (leia antes de rodar): a LayoutParserApi precisa estar rodando localmente na URL
// de `layoutParserApiUrl` (cypress.env.json) e ter o mapeador/layout deste documento já
// cadastrado no catálogo (banco `tbMapper`/`tbLayout`). O `layoutName`/`mapperName` usados aqui
// vieram do dump real do servidor (.claude/tmp/servidor/layoutparser/Examples/) e podem não
// existir no ambiente local — se não existirem, a spec falha nesse ponto e reporta claramente,
// não inventa.

const layoutName =
  Cypress.env("layoutName") || "LAY_CNHI_TXT_MQSERIES_ENVNFE_4.00_NFe";
const lowCodeMapperId = Cypress.env("lowCodeMapperId"); // opcional — ver seção "Pathway 2" abaixo
const lowCodeMapperName = Cypress.env("lowCodeMapperName"); // opcional — idem

describe("Emissão normal de NF-e — TXT MQSeries -> transformação -> aceitação Pollux", () => {
  let txtInput;

  before(() => {
    cy.fixture("txt-input/nfe-emissao-normal.mq_series.txt", "utf-8").then((conteudo) => {
      txtInput = conteudo;
    });
  });

  it("Pathway TCL/XSL (canônico) — POST /api/transformation-execution/execute", () => {
    const apiUrl = Cypress.env("layoutParserApiUrl");
    expect(apiUrl, "layoutParserApiUrl em cypress.env.json").to.be.a("string").and.not.be.empty;

    cy.request({
      method: "POST",
      url: `${apiUrl}/api/transformation-execution/execute`,
      body: {
        inputContent: txtInput,
        layoutName,
        targetDocumentType: "NFe",
        validate: false,
      },
      failOnStatusCode: false,
    }).then((response) => {
      // Reporta fielmente o resultado da transformação antes de seguir para o Pollux — se a
      // LayoutParserApi já rejeitou, não faz sentido (nem é possível) prosseguir.
      cy.log(`Status transformação TCL/XSL: ${response.status}`);

      expect(
        response.status,
        `transformação TCL/XSL falhou: ${JSON.stringify(response.body).slice(0, 500)}`
      ).to.eq(200);
      expect(response.body.success, "success=true no corpo de /execute").to.eq(true);

      const xmlTransformado = response.body.transformedXml;
      expect(xmlTransformado, "transformedXml presente e não vazio").to.be.a("string").and.not.be.empty;

      cy.enviarNFeParaPolux(xmlTransformado).then((resultado) => {
        cy.log(`[TCL/XSL] protocolo=${resultado.protocolo} cStat=${resultado.cStat}`);
        cy.log(`[TCL/XSL] mensagemGeral=${resultado.mensagemGeral}`);
        cy.log(`[TCL/XSL] mensagemItem=${resultado.mensagemItem}`);

        if (resultado.cStat) {
          expect(resultado.cStat, "cStat retornado pelo Pollux para o pathway TCL/XSL").to.eq("100");
        } else {
          // Ambiente e-forms pode não expor cStat na consulta de protocolo — usa a mensagem
          // textual como oráculo alternativo (mesmo critério do teste de referência real).
          expect(
            resultado.mensagemGeral,
            "mensagem geral de sucesso do Pollux (fallback quando cStat não vem na resposta)"
          ).to.equal("Processo de consulta realizado com sucesso");
          expect(resultado.mensagemItem, "mensagem do item de protocolo").to.equal(
            "Processo realizado com sucesso"
          );
        }
      });
    });
  });

  it("Pathway Sysmiddle/LowCode — POST /api/transformation-execution/execute-lowcode", function () {
    const apiUrl = Cypress.env("layoutParserApiUrl");
    expect(apiUrl, "layoutParserApiUrl em cypress.env.json").to.be.a("string").and.not.be.empty;

    if (!lowCodeMapperId && !lowCodeMapperName) {
      // Restrição real: /execute-lowcode exige MapperId OU MapperName explícito (não faz
      // auto-detecção como o /api/parse/upload). Não temos, no momento em que esta spec foi
      // escrita, um mapeador confirmado no catálogo local pra este TXT específico — resolver
      // isso é um passo manual (consultar GET /api/mapperdatabase/by-input/{inputLayoutGuid}
      // com o LayoutGuid real do layout, ou o cadastro correspondente no banco tbMapper) antes
      // de rodar este teste de verdade. Documentando o bloqueio em vez de inventar um valor.
      cy.log(
        "BLOQUEADO: defina lowCodeMapperId ou lowCodeMapperName em cypress.env.json para habilitar este teste."
      );
      this.skip();
      return;
    }

    cy.request({
      method: "POST",
      url: `${apiUrl}/api/transformation-execution/execute-lowcode`,
      body: {
        inputContent: txtInput,
        mapperId: lowCodeMapperId || undefined,
        mapperName: lowCodeMapperName || undefined,
        fileName: "nfe-emissao-normal.mq_series.txt",
      },
      failOnStatusCode: false,
    }).then((response) => {
      cy.log(`Status transformação LowCode: ${response.status}`);

      expect(
        response.status,
        `transformação LowCode falhou: ${JSON.stringify(response.body).slice(0, 500)}`
      ).to.eq(200);
      expect(response.body.success, "success=true no corpo de /execute-lowcode").to.eq(true);

      const xmlTransformado = response.body.transformedXml;
      expect(xmlTransformado, "transformedXml presente e não vazio").to.be.a("string").and.not.be.empty;

      cy.enviarNFeParaPolux(xmlTransformado).then((resultado) => {
        cy.log(`[LowCode] protocolo=${resultado.protocolo} cStat=${resultado.cStat}`);
        cy.log(`[LowCode] mensagemGeral=${resultado.mensagemGeral}`);
        cy.log(`[LowCode] mensagemItem=${resultado.mensagemItem}`);

        if (resultado.cStat) {
          expect(resultado.cStat, "cStat retornado pelo Pollux para o pathway LowCode").to.eq("100");
        } else {
          expect(
            resultado.mensagemGeral,
            "mensagem geral de sucesso do Pollux (fallback quando cStat não vem na resposta)"
          ).to.equal("Processo de consulta realizado com sucesso");
          expect(resultado.mensagemItem, "mensagem do item de protocolo").to.equal(
            "Processo realizado com sucesso"
          );
        }
      });
    });
  });
});
