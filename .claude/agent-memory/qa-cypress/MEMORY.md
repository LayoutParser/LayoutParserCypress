# Memória — @qa-cypress

## Amostras de dado disponíveis para desenho de cenário (2026-08-29)

Encontrados em `../LayoutParserApi/.claude/temp/teste/` (repo irmão, fora deste repo):
- `LAY_ad4fb6f4-9ff5-44fd-988b-3da5ed56b22c.xml` — layout FIAT (mesmo GUID já citado no
  CLAUDE.md deste repo, `LAY_TXT_MQSERIES_ENVNFE_4.00_NFe`).
- `QMWNFe1_QMWNFE1.SAPiens_MRB.INBOX_07-11-2025.mq_series.txt` — TXT posicional MQSeries de
  exemplo para esse layout.

Esses arquivos são de um repo irmão e podem conter dado real de cliente — **não copiar para
dentro deste repo** sem anonimizar antes (ver `.claude/rules/security.md`). Servem só de
referência para desenhar o primeiro cenário e2e completo (UI+API/Ollama+Pollux) do FIAT.

## LayoutParserApi acessível do WSL + resultado da 1ª execução real (2026-08-29)

- [run-2026-08-29-nfe-emissao-normal](run-2026-08-29-nfe-emissao-normal.md) — `test:mappers`
  rodou de verdade contra `http://172.19.176.1:5100` (IP do gateway WSL→host Windows, porta
  5100; pode mudar entre reboots, reconfirmar com `ip route`), 2 failing/0 passing por causas
  de infra/config da API (401 em `execute-lowcode`, `layoutType` não suportado em
  `generate-for-layout`), não por bug no spec. Spec NÃO commitado (regra: só commitar se ambos
  os it() passarem).
