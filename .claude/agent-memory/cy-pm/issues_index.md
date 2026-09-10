---
name: issues_index
description: Índice de issues abertas/criadas neste repo e o que cada uma cobre
metadata:
  type: project
---

Todas adicionadas ao Project #4 (`LayoutParserCypress — Backlog`, [[board_setup]]).

- **#3** — story: harness de agentes (espelha LayoutParserApi/LayoutParserReact).
- **#4** — story: cenário e2e FIAT — Sysmiddle e TCL/XSL validados contra Pollux.
- **#5** — blocked: validação e2e FIAT sysmiddle/tcl-xsl não rodou. Evoluiu de "API fora do
  ar" → causa real era 401 em `execute-lowcode` (sem M2M) + `generate-for-layout` sem suporte
  ao layoutType FIAT — ver #9/#10. Segue aberta (não resolvida).
- **#6** — story: desenhar fluxo e2e via UI (React) — bloqueado por divergência de contrato
  `execute-candidates` vs. `generate-for-layout`+`execute`. Não confundir com #13/#15 (auth).
- **#7** — story: preencher secrets/vars reais nos Environments development/production
  (só o usuário preenche pela UI do GitHub).
- **#8** — blocked: acesso de rede WSL↔Windows para rodar a suíte localmente.
- **#9** — blocked: falta mecanismo de auth de serviço/M2M na LayoutParserApi para clientes
  automatizados (Cypress). Evoluiu para #13 (sintoma de 401 persistente pós "correção").
- **#10** — blocked: confirmar status TCL/XSL do layoutType FIAT (`generate-for-layout`
  retornava "Tipo de layout não suportado: 2").
- **#13** — blocked: `execute-lowcode` 401 mesmo com token M2M válido. Ver [[m2m_auth_saga]]
  para histórico completo de retestes e resposta do time LayoutParserApi.
- **#15** — blocked: 401 "Autenticação obrigatória" em todos os endpoints no ambiente
  `duckdns` (inclusive sem `[Authorize]`). Time API classificou como "ambiente incorreto por
  design" (passa por BFF) — aguardando confirmação do dono do repo para fechar (ver
  [[m2m_auth_saga]]). **Não fechei eu mesma.**

**Why manter este índice:** evita duplicar issue já aberta ao receber novo pedido/achado.
**How to apply:** antes de criar issue nova, checar esta lista + `gh issue list` atual.
