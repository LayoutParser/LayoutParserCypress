#!/usr/bin/env node
/**
 * git-push-advisory — PreToolUse (Bash) hook NÃO-BLOQUEANTE.
 *
 * Quando um comando `git push` é detectado, imprime um lembrete sobre a regra de
 * autoridade (apenas @cy-devops publica) e a exigência de suíte rodada de verdade.
 * NUNCA bloqueia: sempre exit 0.
 *
 * Para DESATIVAR: remova o bloco PreToolUse correspondente em .claude/settings.json.
 */
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw || "{}");
    const cmd = payload?.tool_input?.command ?? "";
    if (/\bgit\s+push\b/.test(cmd)) {
      const force = /--force\b|--force-with-lease\b|-f\b/.test(cmd);
      process.stderr.write(
        "[harness] git push detectado. Lembrete:\n" +
          "  • Autoridade de push é exclusiva do @cy-devops (ver .claude/rules/agent-authority.md).\n" +
          "  • Confirme que a suíte relevante RODOU de verdade (não só que a spec compila).\n" +
          "  • Nunca commitou cypress.env.json real ou dado de cliente real? Confirme.\n" +
          (force ? "  • ⚠️ PUSH FORÇADO: confirme intenção e tenha plano de rollback.\n" : "")
      );
    }
  } catch {
    /* payload inválido: ignore, nunca bloqueie */
  }
  process.exit(0);
});
