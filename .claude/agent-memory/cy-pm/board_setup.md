---
name: board_setup
description: Criação e IDs do GitHub Project deste repo (LayoutParserCypress — Backlog)
metadata:
  type: project
---

`gh project list --owner LayoutParser` não listava projeto deste repo até 2026-08-29
(existiam só `LayoutParserApi — Backlog` #2 e `LayoutParserReact — Backlog` #3). Criado:

- **LayoutParserCypress — Backlog** — número **4**, id `PVT_kwDODnBfYs4Bh1dg`, owner
  `LayoutParser`, status `open`.

**Why:** cada repo do ecossistema LayoutParser tem seu próprio Project de backlog; este
repo não tinha o dele ainda.
**How to apply:** ao criar issue relevante para o backlog deste repo, sempre usar
`gh project item-add --project-id PVT_kwDODnBfYs4Bh1dg` (ou número 4) para linkar.
