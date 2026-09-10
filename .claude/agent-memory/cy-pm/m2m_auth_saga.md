---
name: m2m-auth-saga
description: Histórico completo da saga de autenticação M2M (issues #9→#13→#15) e prompts formais enviados ao time LayoutParserApi
metadata:
  type: project
---

Saga de autenticação M2M entre LayoutParserCypress e LayoutParserApi, rastreada nas issues
#9→#13→#15 (ver [[issues_index]]).

Sequência de bloqueios encontrados e resolvidos, cada um virando um prompt formal em
`docs/comunicacao-layoutparserapi-2026-09-10.md` (documento cumulativo, todos os adendos
preservados em ordem cronológica):

1. Config M2M ausente/divergência de PR/branch (esclarecida — checkout local desatualizado,
   não era divergência real entre times).
2. Ambiente `duckdns` rejeitando token M2M mesmo em endpoint sem `[Authorize]` → veredito do
   time: BFF na frente da API valida contra outro audience OIDC e barra antes de chegar na
   API real. Issue #15 fechada com esse veredito.
3. Issuer mismatch v1 vs v2 (`IDX10205`) → corrigido pelo time via
   `accessTokenAcceptedVersion: 2` no manifest do App Registration.
4. Audience mismatch pós-fix do issuer (`IDX10214`, GUID puro vs formato URI) → prompt
   formal enviado 2026-09-10 (noite), aguardando decisão do time entre mudar
   `Authentication:ServiceClient:Audience` para GUID puro vs aceitar ambos os formatos via
   `ValidAudiences`.
5. **RESOLVIDO (2026-09-10, noite):** time aplicou GUID puro em
   `Authentication:ServiceClient:Audience` (commit `6fba6a6` / PR #372). Reteste no clone
   limpo `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste` com token M2M novo
   confirmou: 401/IDX10205/IDX10214 sumiram por completo, autenticação M2M funcionando de
   ponta a ponta. Request passou a falhar com 500 por motivo ambiental não relacionado a
   auth (`LayoutParserLowCodeRunner.exe` não publicado no host de teste). **Issue #13
   fechada** — saga M2M encerrada. Próximo bloqueio real do gate padrão FIAT passa a ser só
   a #14 (mapper Sysmiddle ausente). Detalhe completo em `docs/e2e-fiat-sysmiddle-tcl-xsl.md`
   seção 20.

6. **Novo capítulo pós-saga M2M (2026-09-10, madrugada 2):** com auth 100% resolvida, o
   próximo bloqueio do caminho `sysmiddle` é ambiental, não de auth: `LowCode:RunnerPath`
   aponta para caminho de produção/IIS inexistente no host de dev. Já existe issue no
   LayoutParserApi cobrindo a causa raiz (`LayoutParserApi#373`) — não abrimos issue nova,
   só prompt formal perguntando fonte+build / path configurável / binário pré-buildado
   (sem tomar partido). Detalhe em `docs/e2e-fiat-sysmiddle-tcl-xsl.md` seção 21 e adendo
   "madrugada 2" em `docs/comunicacao-layoutparserapi-2026-09-10.md`.

**Ressalva de PR/branch:** ao repassar resposta de outro time citando PR/branch como
evidência, sempre confirmar contra o checkout real antes de tratar como fato — já aconteceu
divergência (#360/#361 citados errado, número real era #305/#316).

7. **Confirmação de ambiente (2026-09-10, noite 3):** time da API perguntou contra qual
   instância o gate E2E roda, após um 504 relatado pelo LayoutParserReact (fluxo deles, fora
   do nosso Cypress) em `execute-candidates`. Confirmamos: ambiente é sempre o clone
   `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste` (orientação da própria API
   na #373) — bate com a hipótese do bug de log4net (#391, fix PR #392). Achado ao verificar:
   #392 já foi promovida para `master` via PR #393 (2026-09-10T22:47:18Z) — promoção já
   concluída, não mais "em andamento". Próximo passo (não executado): `git pull` no clone e
   retestar `execute-lowcode`/`execute-candidates`. Comentário em
   `LayoutParserApi#391`, detalhe em `docs/e2e-fiat-sysmiddle-tcl-xsl.md` seção 23.

**Padrão dos prompts formais:** sempre progresso primeiro (o que já foi corrigido e
confirmado), depois o novo bloqueio com payload/erro exato, depois duas opções de correção
com trade-offs (nunca decidir qual é a certa), fechando com pergunta objetiva e oferta do
clone limpo `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste` para reteste
imediato assim que aplicarem.
