# Memória — @cy-pm (Pia-e2e)

- [Board setup](board_setup.md) — Project #4 `LayoutParserCypress — Backlog`, id `PVT_kwDODnBfYs4Bh1dg`.
- [Índice de issues](issues_index.md) — #3 a #15, o que cada uma cobre, o que evoluiu de quê.
- [Saga de auth M2M](m2m_auth_saga.md) — histórico completo #9→#13→#15, resposta do time API, ressalva de PR/branch.

## Padrões de trabalho consolidados

- Lote >1 item ou item ambíguo → rascunhar e devolver ao dono antes de criar issue; item
  único e inequívoco pode criar direto.
- Reteste que confirma o mesmo sintoma mas com causa ambiental nova → comentar na issue
  existente, não abrir nova. Issue nova só quando sintoma/escopo muda de fato.
- Ao repassar resposta de outro time que cita evidência verificável (PR/branch/commit) em
  repo irmão, verificar o checkout real antes de tratar como fato; registrar divergência
  como ressalva, sem tomar partido.
- Prompt formal pedido pelo usuário para outro time → salvar em `docs/`, não só devolver no
  chat (ex.: `docs/comunicacao-layoutparserapi-2026-09-10.md`).
- Nunca fechar issue sozinha quando o veredito vem de outro time — comentar e sinalizar,
  deixar o fechamento para o dono do repo/autoridade.
- Toda entrega relevante também vira seção em `docs/e2e-fiat-sysmiddle-tcl-xsl.md` (doc
  persistente, distinta do handoff efêmero entre agentes).
- Autoridade: nunca `git push`/`gh pr`, nunca editar CI/segredos (exclusivo `@cy-devops`);
  nunca escrever spec `.cy.js` (exclusivo `@qa-cypress`/`@cy-ai-flow`). Commits locais de
  documentação são permitidos, sem push.
