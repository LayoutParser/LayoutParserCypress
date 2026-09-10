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

**Ressalva de PR/branch:** ao repassar resposta de outro time citando PR/branch como
evidência, sempre confirmar contra o checkout real antes de tratar como fato — já aconteceu
divergência (#360/#361 citados errado, número real era #305/#316).

**Padrão dos prompts formais:** sempre progresso primeiro (o que já foi corrigido e
confirmado), depois o novo bloqueio com payload/erro exato, depois duas opções de correção
com trade-offs (nunca decidir qual é a certa), fechando com pergunta objetiva e oferta do
clone limpo `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste` para reteste
imediato assim que aplicarem.
