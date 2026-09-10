---
name: m2m_auth_saga
description: Histórico da saga de auth M2M (execute-lowcode 401) — #9→#13, #15, resposta do time API
metadata:
  type: project
---

Linha do tempo do bloqueio de autenticação M2M entre LayoutParserCypress e LayoutParserApi:

1. **2026-08-29** — descoberto que `execute-lowcode` exige OAuth, sem mecanismo de
   auth de serviço para clientes automatizados. Issue **#9** aberta.
2. **2026-09-07** — `@qa-cypress` revalida pós PRs de auth M2M na API; token M2M via Entra
   passa a ser obtido, mas `execute-lowcode` segue 401. Issue **#13** aberta (sintoma
   evoluído de #9).
3. **2026-09-09/10** — reteste pedido pelo time API após correção de timing de deploy
   (2026-09-08): 401 persiste, sem `WWW-Authenticate`, contra `172.19.176.1:5100` (instância
   local, `health/ready` = `Unhealthy`/SQL indisponível — não é o "servidor real" que a API
   corrigiu). Comentado em #13.
4. **2026-09-10** — reteste em dois ambientes por pedido do usuário: local (mesmo sintoma
   401 seco) vs. `layoutparser.duckdns.org` (401 **com** body `"Autenticação obrigatória"`,
   afetando até endpoint sem `[Authorize]`). Issue **#15** aberta para o sintoma novo.
   Prompt formal escrito em `docs/comunicacao-layoutparserapi-2026-09-10.md` (artefato
   persistente, não só chat — repetir esse padrão quando usuário pede prompt formal pra
   outro time).
5. **2026-09-10 (resposta)** — time LayoutParserApi respondeu: `duckdns` = BFF (Fastify/Entra
   OIDC) rejeitando token M2M antes de chegar na API, "não é bug, ambiente incorreto por
   design" → pedem fechar #15. Ambiente local = scheme M2M não ativo em runtime (checkout/
   binário anterior ao merge do scheme), citam PRs #360/#361 mergeadas em `master`. Pedem
   checklist (`git pull` master + restart + reconferir).

   **Verificação feita antes de repassar como fato:** checkout irmão
   `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi` estava em
   `feat/xml-layout-sample-generator-356` (não `master`), working tree sujo, `git log`
   sem PR #361 e PR #360 sem relação óbvia com M2M. Registrada como ressalva em #13 e na
   doc — **não confirmamos** que o merge do scheme M2M esteja realmente em `master`.
   Checklist deles **não foi executado** (fora do escopo `@cy-pm`; depende de decisão do
   usuário sobre qual checkout usar).

6. **2026-09-10 (correção da resposta)** — time da API reconheceu que #360/#361 estavam
   erradas (assunto diferente: `ILlmProvider`/`generate-sample`). Números corretos: scheme
   M2M → commit `bb458fa`/PR #305 (2026-09-04); Authority/Audience reais → commit
   `39d9cbd`/PR #316 (2026-09-06). Ambos ancestrais confirmados de `origin/master`. Causa da
   divergência anterior: nosso checkout preso em `feat/xml-layout-sample-generator-356`,
   cortada de `develop` antes dessas promoções — não era problema real. Recomendam clone
   limpo separado (não mexer no checkout sujo com trabalho em andamento) para rodar o
   checklist técnico (subir API de `master`, checar warning ServiceClient, retestar
   `execute-lowcode`). **Checklist ainda não executado** — depende de decisão do usuário
   (quem sobe o clone, precisa dotnet runtime e possivelmente `Database__Password`).
   Comentado em #13.

7. **2026-09-10 (noite) — causa raiz real encontrada.** Checklist técnico executado de
   verdade (clone limpo de `master`, config M2M confirmada carregada — ausência do warning
   ServiceClient). `execute-lowcode` continua 401, mas o log revelou `IDX10205: Issuer
   validation failed` — mismatch de formato de issuer v1 (`sts.windows.net`) vs v2
   (`login.microsoftonline.com/.../v2.0`) do Entra. Causa: `accessTokenAcceptedVersion` do
   App Registration recurso não está setado para 2. Duas correções possíveis (mexer no
   manifesto Entra vs. aceitar `ValidIssuers` múltiplos no `Program.cs`) — pergunta
   devolvida ao time da API sobre qual preferem, não decidido por `@cy-pm`. Comentado em
   #13, doc seção 16.

8. **2026-09-10 (madrugada)** — dono do repo confirmou o veredito do time da API sobre #15
   ("ambiente incorreto por design, BFF rejeita audience da API antes de repassar") →
   comentário publicado e **issue #15 fechada** (`gh issue close`). Prompt formal escrito
   pedindo ao time da API qual das duas correções do mismatch de issuer v1/v2 (seção 16 do
   doc) preferem aplicar: (a) manifesto Entra `accessTokenAcceptedVersion=2` vs. (b)
   `ValidIssuers` múltiplos no `Program.cs`, ou as duas. Adendo em
   `docs/comunicacao-layoutparserapi-2026-09-10.md`, seção 17 do doc principal.

9. **2026-09-10 (decisão do time API)** — responderam ao prompt formal (seção 17 do doc):
   escolheram opção (a) — `accessTokenAcceptedVersion: 2` no Manifest do App Registration
   "LayoutParserApi" (`f76c2598-4759-48a9-8145-8a967ec7ac96`) via Portal Azure; não farão a
   opção (b) (`ValidIssuers` no código) nem PR. Pedem reteste (token novo → conferir `iss`
   v2 → `execute-lowcode` no clone limpo de `master`) depois do manifest propagar.
   Comentado em #13. **Bloqueio real:** sem Azure CLI instalado/autenticado nesta máquina, e
   a mudança exige acesso admin Entra (Application/Cloud Application Administrator) — fora
   do alcance de qualquer agente/ferramenta desta sessão. Próximo passo prático cabe ao
   usuário: aplicar no Portal Azure e avisar para reteste em
   `/mnt/c/Users/elson.lopes/source/repos/LayoutParserApi-reteste`. Doc seção 18.

Comentários: [#13](https://github.com/LayoutParser/LayoutParserCypress/issues/13),
[#15](https://github.com/LayoutParser/LayoutParserCypress/issues/15) (fechada 2026-09-10).
Doc persistente: `docs/e2e-fiat-sysmiddle-tcl-xsl.md` seções 11-18.

**Why:** essa saga já passou por 3 issues e múltiplos ambientes — fácil perder o fio sem um
histórico condensado.
**How to apply:** antes de comentar de novo em #13/#15 ou abrir issue nova sobre auth M2M,
ler este arquivo inteiro primeiro para não duplicar ou contradizer o que já foi registrado.

### Padrão a repetir
- Reteste que confirma o mesmo sintoma mas descobre causa ambiental nova (URL/instância
  errada) → comentar na issue existente, não abrir nova. Reservar issue nova só quando o
  sintoma/escopo muda de fato (#9→#13, #10→#14, #13→#15).
- Quando outro time responde citando evidência verificável (nº de PR, branch, commit) num
  repo irmão, **verificar o checkout real antes de repassar como fato** — não assumir que a
  alegação está correta. Se houver divergência, registrar como ressalva no mesmo
  comentário/doc, sem decidir sozinha quem está certo.
