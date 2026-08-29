---
name: design-flow-fiat-ui
description: Desenho do primeiro cenário e2e via UI (React) para o gate padrão FIAT — passos, pontos de asserção e dúvida de contrato em aberto
metadata:
  type: project
---

Desenhado em 2026-08-29 para o primeiro cenário e2e "via UI" (LayoutParserReact →
LayoutParserApi/Ollama → Pollux) do gate padrão FIAT, complementando o gate direto-à-API já
existente em `cypress/e2e/nfe-emissao-normal.cy.js` (que fala com
`/api/AutoTransformation/generate-for-layout` + `/api/transformation-execution/execute`
sem passar pela UI).

## Achado importante — possível divergência de contrato UI x gate atual

O gate atual (`nfe-emissao-normal.cy.js`) usa:
- `POST /api/AutoTransformation/generate-for-layout` (gera TCL/XSL via Ollama para o layout)
- `POST /api/transformation-execution/execute` (aplica os artefatos no TXT, devolve `transformedXml`)

Mas o LayoutParserReact (`src/services/api/transformationService.ts`), na tela de upload
(`LayoutParserPage.tsx`, rota `/upload`), **não chama essas duas rotas**. O fluxo de UI observado é:
1. `layoutService.searchLayouts()` — busca layouts cadastrados (com cache local via
   `layoutCache.ts`), popula `LayoutCombobox`.
2. Usuário seleciona layout + sobe TXT (`handleSubmit` em `LayoutParserPage.tsx`, linha ~260) —
   isso chama um serviço de parse/documento (não é `generate-for-layout`/`execute`; não
   confirmei o nome exato do serviço nem a rota HTTP usada aqui, só vi o objeto
   `{ layoutFile, txtFile, layoutName }` sendo montado).
3. Depois, para transformação multi-candidato, `transformationService.executeTransformationCandidates`
   chama `POST /api/transformationexecution/execute-candidates` (rota com nome "transformationexecution"
   sem hífen, diferente de "transformation-execution" usado no gate atual) — devolve **vários
   candidatos**, não um único `transformedXml` direto.

**Não tenho certeza se isso é**: (a) uma rota BFF diferente que internamente delega para
generate-for-layout+execute, (b) o pathway novo de "multi-candidato" (relacionado ao Job 2 / IA,
fora do escopo de emissão normal), ou (c) o fluxo real que a UI usa em produção para o gate
padrão, substituindo as duas chamadas diretas. **Isso precisa ser confirmado com `@lp-front-dev`
(LayoutParserReact) e/ou o time da LayoutParserApi antes de qualquer spec via UI ser escrita** —
não adivinhei qual candidato de `execute-candidates` corresponderia ao "candidato SysMiddle
padrão" equivalente ao par TCL/XSL do gate atual.

## Desenho do fluxo (assumindo confirmação do contrato acima)

1. **UI — seleção de layout:**
   - Navegar para `/upload` (rota do `routes.tsx`).
   - Aguardar `layoutService.searchLayouts()` popular o `LayoutCombobox` (asserção: combobox
     lista o layout `LAY_TXT_MQSERIES_ENVNFE_4.00_NFe` / GUID
     `LAY_ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c`).
   - Selecionar o layout FIAT no combobox.
   - Asserção: `selectedLayout.layoutGuid` bate com o GUID esperado (visível via estado da UI
     ou atributo do combobox).

2. **UI — upload do TXT:**
   - Upload do arquivo TXT posicional MQSeries (idealmente uma fixture anonimizada — ver seção
     "dado sintético" abaixo) via input de arquivo do formulário (`file-upload-form`).
   - Asserção: `uploadProgress` avança e `uploadError` permanece vazio.
   - Disparar submit (`handleSubmit`).

3. **API + Ollama (ponto de asserção de rede):**
   - Interceptar (cy.intercept) a(s) chamada(s) de rede disparada(s) pelo submit — hoje
     desconhecido se é `generate-for-layout`+`execute` ou `execute-candidates`. Assertar:
     - status 200/sucesso;
     - XML retornado é bem-formado (parseável) e contém os elementos mínimos de `enviNFe`/`NFe`
       esperados pelo layout FIAT (chave de acesso, CNPJ emitente sintético, itens);
     - se `execute-candidates`: identificar o candidato "SysMiddle padrão" equivalente e usar
       o `transformedXml` desse candidato — não pegar candidato IA arbitrário.

4. **UI — exibição do resultado / disparo ao Pollux:**
   - Se a UI expõe um botão para enviar ao e-forms/Pollux, mapear esse clique. Caso a UI não
     tenha esse botão (upload é só até "gerar XML"), o envio ao Pollux continua sendo feito por
     `cy.enviarNFeParaPolux(xmlTransformado)` (comando já existente em `commands.js`), pegando o
     XML capturado na intercept do passo 3 — o teste via UI cobre até a geração; o veredito
     fiscal usa a mesma infraestrutura do gate atual.

5. **Veredito (igual ao gate atual, `nfe-emissao-normal.cy.js`):**
   - `cStat === "100"` (ou, na ausência de cStat, `mensagemGeral === "Processo de consulta
     realizado com sucesso"` e `mensagemItem === "Processo realizado com sucesso"`).
   - Qualquer rejeição fiscal é FALHA (gate padrão, não é o batch de candidatos IA).

## Dado sintético recomendado

O TXT real (`QMWNFe1_QMWNFE1.SAPiens_MRB.INBOX_07-11-2025.mq_series.txt`) contém dado de
cliente real (CNPJ emitente `36519422000115`, razão social "IVG BRASIL LTDA", destinatário
"ENCAIXE EMP TRANSP LTDA", endereços reais, e-mail real `pamela.silva@fiatservices.com`,
nome de solicitante "Ana B Costa// Pamela Guedes"). **Não deve ser usado nem commitado como
está.**

Recomendação: gerar uma fixture anonimizada preservando exatamente o layout posicional
(mesmos offsets/comprimentos de campo do layout XML, para não invalidar o parse), substituindo:
- CNPJ emitente e destinatário por CNPJ sintético válido (dígito verificador correto, mas de
  faixa reservada a teste, ex. `36519422000115` → gerar um novo com mesmo algoritmo);
- razão social / nomes de pessoa por valores fictícios óbvios (ex. "EMPRESA TESTE LTDA",
  "FULANO DE TESTE");
- endereços por endereços fictícios genéricos (mantendo UF/município válidos para não quebrar
  validação de tabela do IBGE, se houver);
- e-mail por `teste@exemplo.com.br` ou similar;
- valores financeiros podem ficar como estão (não são PII).

Isso é preferível a pedir um TXT sintético novo do zero, porque preserva fielmente o
posicionamento real de campos do layout FIAT (081/082/etc., linhas HEADER/campos numerados)
que seria fácil errar reconstruindo à mão — reduz risco de o teste passar/falhar por motivo
errado (erro de layout, não erro de regra fiscal). Guardar a fixture anonimizada em
`cypress/fixtures/txt-input/` (mesmo padrão já usado por `nfe-emissao-normal.mq_series.txt`
referenciado em `cypress.mapper.config.js`).

## Atualização 2026-08-29

### 1. Fixture TXT já existe e já usa dado próprio da NDD — não precisa anonimizar

Correção da recomendação anterior: `cypress/fixtures/txt-input/nfe-emissao-normal.mq_series.txt`
**já existe** neste repo (já commitado) e é byte-idêntico ao TXT real de referência
(`LayoutParserApi/.claude/temp/teste/QMWNFe1_...txt`). O gabarito
`cypress/fixtures/txt-input/nfe-emissao-normal.gabarito.xml` (também já commitado) contém o XML
de NF-e esperado com os MESMOS valores (CNPJ `36519422000115`, "IVG BRASIL LTDA", endereço,
destinatário "ENCAIXE EMP TRANSP LTDA", e-mail `pamela.silva@fiatservices.com`, etc.).

O usuário confirmou que esses dados são da própria NDD (não são de terceiro/cliente) e autorizou
usá-los como estão — **não há necessidade de anonimizar nem recriar a fixture do zero**. A
fixture existente já serve tanto para o caminho Sysmiddle quanto para o caminho TCL/XSL, e o
`gabarito.xml` já serve de XML esperado para comparação/asserção estrutural, se algum dia se
quiser comparar campo a campo (não é feito hoje pela spec, que só valida `cStat`).
Recomendação anterior de anonimização fica revogada.

### 2. Dois caminhos de transformação → dois envios ao Pollux no mesmo teste

Investigado em `LayoutParserApi/Controllers/TransformationExecutionController.cs` (só leitura).
Confirmado: **os dois endpoints já existem hoje**, ambos sob
`api/TransformationExecution` (nome de rota controller = `[controller]` = `TransformationExecution`,
sem hífen):

- **Caminho TCL/XSL (Ollama):** `POST /api/AutoTransformation/generate-for-layout` (gera TCL/XSL) +
  `POST /api/TransformationExecution/execute` (aplica) — é exatamente o par que
  `nfe-emissao-normal.cy.js` já exercita hoje com sucesso. **Isto já está pronto e testado**, ao
  contrário do que foi relatado — vale confirmar com o usuário se o que ele quis dizer com "não
  está pronto" é algo mais específico (ex.: instabilidade recente, ou um layout/mapper diferente
  ainda não gerado), porque pelo código e pela spec existente esse caminho já funciona fim-a-fim.
- **Caminho Sysmiddle (low-code, direto do layout, sem LLM):**
  `POST /api/TransformationExecution/execute-lowcode` — `LowCodeTransformationRequest { InputContent,
  MapperId?, MapperName?, FileName?, Package?, GlobalFolder?, SysmiddleDir? }`, exige
  `MapperId` OU `MapperName` (não confirmei ainda qual é o MapperId/MapperName exato cadastrado
  para o mapeador FIAT — provavelmente o mesmo nome do layout,
  `LAY_TXT_MQSERIES_ENVNFE_4.00_NFe`, mas isso precisa ser confirmado batendo no endpoint ou lendo
  `MapperDatabaseService`/`LowCodeLayoutGuidResolver`, não adivinhar). Devolve
  `{ success: true, transformedXml }` em caso de sucesso, 400 se faltar `InputContent` ou
  `MapperId`/`MapperName`, 500 em erro do runner x86 do Sysmiddle.
- Existe ainda um terceiro endpoint relacionado (`execute-candidates`, multi-candidato, que
  provavelmente orquestra ambos os pathways internamente e é o que a UI React consome — ver seção
  acima) e um `field-mappings` (Issue #140, resolução estrutural, propósito diferente — não é
  candidato a veredito fiscal).

### 3. Desenho atualizado da spec (2 envios ao Pollux)

Passos (nível API direta, sem UI — a UI ainda tem a pendência de contrato do item 1 do desenho
original):

1. `POST /api/TransformationExecution/execute-lowcode` com `{ inputContent: txtInput, mapperName:
   "LAY_TXT_MQSERIES_ENVNFE_4.00_NFe" (a confirmar), fileName }` → capturar `transformedXml`
   (caminho Sysmiddle).
2. `POST /api/AutoTransformation/generate-for-layout` + `POST
   /api/TransformationExecution/execute` (fluxo já existente, inalterado) → capturar
   `transformedXml` (caminho TCL/XSL).
3. Enviar AMBOS os XMLs ao Pollux via `cy.enviarNFeParaPolux`, um `it()` (ou dois `it()`s
   irmãos dentro do mesmo `describe`) por caminho, rotulando claramente qual pathway cada envio
   representa nos logs/asserções (`cy.log`/mensagens de expect já citam `caso.cliente` — sugerir
   estender para `${caso.cliente} [sysmiddle]` / `${caso.cliente} [tcl-xsl]`).
4. Veredito por caminho é independente: os dois devem retornar `cStat=100`; se o usuário
   confirmar que o caminho TCL/XSL "não está pronto" por algum motivo concreto (não evidenciado
   no código lido), a spec desse `it()` pode nascer com `it.skip`/`xit` documentado (comentário
   explicando a razão e link do ticket), sem bloquear o caminho Sysmiddle. Não recomendo já
   implementar o skip sem essa confirmação, já que o código e a spec atual indicam que o caminho
   TCL/XSL funciona.

### Pendências / bloqueios em aberto
- Confirmar `MapperId`/`MapperName` exato do mapeador FIAT para `execute-lowcode` (não adivinhado).
- Confirmar com o usuário o motivo concreto de "TCL/XSL não está pronto" — o código e a spec
  existente sugerem o contrário; pode ser um mal-entendido ou referir-se a outro mapeador/ambiente.
- Dúvida do contrato UI (`execute-candidates` vs. `generate-for-layout`+`execute`) do desenho
  original continua em aberto — não investigada nesta rodada.

## Atualização 2026-08-29 — fechado

MapperId/Package do FIAT confirmados via memória `@lp-backend-dev`
(`LayoutParserApi/.claude/agent-memory/lp-backend-dev/gabarito-fiat-comando-de-verificacao.md`,
só leitura):

- `MapperId = MAP_f31a6758-69c9-4cf6-92d2-24f0e27a1ab5` (nome `MAP_MQSERIES_SEND_ENV_TXT_XML_NFE`).
- `Package = 938f9978-836f-48c1-9c0f-c2898caf4b20`.
- **Armadilha documentada, replicar como asserção negativa no teste:** existe um mapper homônimo
  `MAP_MARELLI_MQSERIES_SEND_ENV_TXT_XML_NFE` (`MAP_1cfab556-4b0e-45ce-baee-4f9570f1ca51`) que
  roda com `exit=0` mas produz XML incompleto (2852 bytes vs ~4245 esperado) — falta
  `<total>`/`<ICMSTot>`, `<transp>`, `<cobr>`, `<pag>`, `<compra>` e sobra `<B2B>`, `<comb>`,
  `<descANP>`. Sinal de diagnóstico: **elementos a mais** = mapper errado, não regressão real
  (regra que falha remove nós, não inventa). O teste deve assertar a AUSÊNCIA de `<B2B>`/`<comb>`/
  `<descANP>` e a PRESENÇA de `<total>`, `<ICMSTot>`, `<transp>`, `<cobr>`, `<pag>`, `<compra>` no
  `transformedXml` do Sysmiddle — isso pega silenciosamente o mapper errado antes mesmo de chegar
  no Pollux, e distingue "mapper trocado" de "regra fiscal quebrada".
- `globalFolder`: verificado pelo `@lp-backend-dev` que qualquer um dos dois catálogos existentes
  serve (`tools/LowCodeRunner/globalfolder` ou `C:\inetpub\wwwroot\layoutparser\globalfolder`) —
  não é a variável relevante; não fixar um valor específico na spec, deixar como padrão do
  ambiente/appsettings da API (não enviar `GlobalFolder` no payload a menos que o ambiente de
  teste exija).
- Gabarito byte-a-byte citado nessa memória (`.claude/tmp/exemplos/xml output/...-env.xml`, 4245
  bytes) **NÃO existe em disco** (verificado via glob nesta rodada, `.claude/tmp/exemplos/` não
  encontrado no LayoutParserApi). Usar em seu lugar
  `cypress/fixtures/txt-input/nfe-emissao-normal.gabarito.xml` (já commitado neste repo) como
  referência de conteúdo mínimo — mesma NF-e/mesmo TXT de origem. Não é garantido que seja
  byte-idêntico ao gabarito de 4245 bytes citado pelo `@lp-backend-dev` (não confirmado), mas é
  semanticamente a mesma NF-e (mesmo emitente/destinatário/item/valores) e serve para a asserção
  estrutural de presença/ausência de elementos acima — comparação byte-a-byte fica como
  melhoria futura, não bloqueia a implementação.

### Payload exato — `it()` `[sysmiddle]`

```
POST {layoutParserApiUrl}/api/TransformationExecution/execute-lowcode
Body: {
  inputContent: <conteúdo de txt-input/nfe-emissao-normal.mq_series.txt>,
  mapperId: "MAP_f31a6758-69c9-4cf6-92d2-24f0e27a1ab5",
  package: "938f9978-836f-48c1-9c0f-c2898caf4b20",
  fileName: "QMWNFe1_QMWNFE1.SAPiens_MRB.INBOX_07-11-2025.mq_series.txt"
}
```
(`mapperName`, `globalFolder`, `sysmiddleDir` ficam de fora — `mapperId` já é suficiente e
`globalFolder` não é a variável relevante, ver acima.)

Asserções sugeridas, em ordem:
1. HTTP 200, `success === true`.
2. `transformedXml` presente, string não vazia, XML bem-formado.
3. Asserção anti-armadilha do mapper Marelli: `transformedXml` **contém** `<total>`, `<ICMSTot>`,
   `<transp>`, `<cobr>`, `<pag>`, `<compra>` e **NÃO contém** `<B2B>`, `<comb>`, `<descANP>` —
   falha aqui deve ter mensagem explícita ("mapper errado (Marelli?), não regressão fiscal") para
   não confundir debugging futuro.
4. Envio a `cy.enviarNFeParaPolux(transformedXml)` → `cStat === "100"` (mesmo critério do gate
   atual).

### Payload exato — `it()` `[tcl-xsl]`

Reaproveita o par já existente e testado, sem mudanças:

```
POST {layoutParserApiUrl}/api/AutoTransformation/generate-for-layout
Body: { layoutGuid: "ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c", layoutName: "LAY_TXT_MQSERIES_ENVNFE_4.00_NFe" }
```
seguido de
```
POST {layoutParserApiUrl}/api/transformation-execution/execute
Body: {
  inputContent: <mesmo TXT>,
  layoutName: "LAY_TXT_MQSERIES_ENVNFE_4.00_NFe",
  targetDocumentType: "NFe",
  validate: false,
  fileName: "QMWNFe1_QMWNFE1.SAPiens_MRB.INBOX_07-11-2025.mq_series.txt"
}
```
Asserções: as mesmas já usadas em `nfe-emissao-normal.cy.js` (success=true na geração, arquivos
`.tcl`/`.xsl` gerados, `transformedXml` presente) + `cy.enviarNFeParaPolux` → `cStat === "100"`.

### Estrutura sugerida da spec (para @qa-cypress, não implementada aqui)

Um `describe` por cliente (mantendo o array `casos` já existente em `nfe-emissao-normal.cy.js`,
ou uma nova spec dedicada), com dois `it()` irmãos:
- `"${cliente} [sysmiddle] — execute-lowcode → Pollux"`
- `"${cliente} [tcl-xsl] — generate-for-layout + execute → Pollux"` (idêntico ao teste atual,
  só renomeado/rotulado para deixar claro que é um dos dois caminhos, não o único)

Nenhum dos dois precisa de skip — ambos os endpoints existem e têm dados/credenciais completos
para rodar. Não há evidência de que o caminho TCL/XSL esteja "não pronto"; ao contrário, é o
caminho já validado pela spec atual.

### Pendências reais restantes (nenhuma bloqueia a implementação)
- Confirmação byte-a-byte do gabarito de 4245 bytes citado por `@lp-backend-dev` não é
  necessária para fechar o desenho — a asserção estrutural (presença/ausência de elementos) já
  cobre a armadilha do mapper Marelli sem depender de comparação exata de bytes.
- Dúvida de contrato UI (`execute-candidates` vs. `generate-for-layout`+`execute`), da seção
  anterior deste documento, continua em aberto mas é ortogonal a este cenário (que roda via API
  direta, sem UI) — não bloqueia a implementação dos dois `it()`s acima.

## Nota Redis

Confirmado em `LayoutParserApi/Services/Transformation/LowCode/LowCodeTransformationService.cs`
(`TransformAsync`, chamado por `execute-lowcode`): o `mapperId`/`mapperName` recebido no payload
vai **direto como argumento de linha de comando** (`--mapperId`/`--mapperName`) para o processo
externo `LowCodeRunner.exe` — não passa por `MapperCacheService`/Redis (`mappers:search:all`)
nesse caminho. É o mesmo shape do comando manual documentado por `@lp-backend-dev`. O
`MapperCacheService`/Redis é usado em outro lugar (busca/listagem de mapeadores, ex.
`MapperDatabaseController`), não na execução do `execute-lowcode`.

**Implicação:** o `it()` `[sysmiddle]` NÃO depende do warmup do Redis para rodar — não há risco
de falha transitória pós-deploy por `mappers:search:all` ainda não populado nesse caminho
específico. Não é necessária nenhuma nota de resiliência/retry para este cenário. (Se um cenário
futuro passar a resolver `mapperId` via busca/listagem de mapeadores em vez de recebê-lo
hardcoded, aí sim valeria revisitar essa nota.)

## Referências de arquivo (só leitura, não copiar sensível)
- Layout: `LayoutParserApi/.claude/temp/teste/LAY_ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c.xml`
- TXT real (sensível, não commitar): `LayoutParserApi/.claude/temp/teste/QMWNFe1_QMWNFE1.SAPiens_MRB.INBOX_07-11-2025.mq_series.txt`
- UI: `LayoutParserReact/src/components/layout/LayoutParserPage.tsx`,
  `src/components/upload/LayoutCombobox.tsx`, `src/services/api/layoutService.ts`,
  `src/services/api/transformationService.ts` (rota `execute-candidates`)
- Gate atual (API direta): `cypress/e2e/nfe-emissao-normal.cy.js`, `cypress.mapper.config.js`,
  `cypress/support/commands.js` (`enviarNFeParaPolux`)
