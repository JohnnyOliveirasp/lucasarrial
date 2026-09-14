#!/usr/bin/env node
/**
 * Estado REAL das compras órfãs que estão na fila de recados (`para_frank_orfa_*`).
 *
 * Para cada e-mail alertado responde três coisas, cada uma de uma fonte
 * independente:
 *   1. tem PERFIL hoje?            -> profiles (o alerta pode ter envelhecido)
 *   2. recebeu CONVITE automático? -> agent_state['orphan_invites'] (dedupe do sweep)
 *   3. o pagamento é real?         -> deixado para o pagou_de_verdade.cjs, aqui só
 *                                     ecoa o que o recado gravou (transação/produto)
 *
 * Não altera nada. Só mede.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const supabase = supa();

async function main() {
  const { data: recados, error: e1 } = await supabase
    .from("agent_state")
    .select("key, updated_at, value")
    .like("key", "para_frank_orfa_%");
  if (e1) throw new Error("agent_state (recados): " + JSON.stringify(e1));

  const { data: st, error: e2 } = await supabase
    .from("agent_state")
    .select("value")
    .eq("key", "orphan_invites")
    .maybeSingle();
  if (e2) throw new Error("agent_state (orphan_invites): " + JSON.stringify(e2));
  const convites = (st && st.value) || {};

  const linhas = recados.map((r) => {
    const m = String(r.value?.message || "");
    const email = (r.value?.subject || "").split(":").pop().trim().toLowerCase();
    const pega = (rot) => {
      const mm = m.match(new RegExp(rot + ":\\s*(.+)"));
      return mm ? mm[1].trim() : "";
    };
    return {
      key: r.key,
      alerta_em: r.updated_at,
      email,
      nome: pega("Comprador"),
      produto: pega("Produto"),
      transacao: pega("Transa..o"),
    };
  });

  const emails = linhas.map((l) => l.email);
  const { data: perfis, error: e3 } = await supabase
    .from("profiles")
    .select("email, created_at, last_seen_at, credits_subscription, credits_extra, access_until")
    .in("email", emails);
  if (e3) throw new Error("profiles: " + JSON.stringify(e3));
  const porEmail = new Map(perfis.map((p) => [String(p.email).toLowerCase(), p]));

  const agora = Date.now();
  const semConta = [];
  console.log("estado das compras orfas na fila de recados\n");
  for (const l of linhas.sort((a, b) => a.alerta_em.localeCompare(b.alerta_em))) {
    const p = porEmail.get(l.email);
    const c = convites[l.email];
    const dias = ((agora - Date.parse(l.alerta_em)) / 86400000).toFixed(1);
    if (p) {
      console.log(
        `RESOLVIDO SOZINHO  ${l.email} (alerta ha ${dias}d)\n` +
          `   conta criada ${p.created_at} | ultimo acesso ${p.last_seen_at || "NUNCA"} | ` +
          `${p.credits_subscription} cr | acesso ate ${p.access_until}`,
      );
    } else {
      semConta.push({ ...l, dias, convite: c || null });
      console.log(
        `SEM CONTA          ${l.email} (alerta ha ${dias}d) — ${l.nome} — ${l.produto} — ${l.transacao}\n` +
          `   convite automatico: ${c ? `1o ${c.first} | lembrete ${c.reminder || "NAO"}` : "NUNCA ENVIADO"}`,
      );
    }
  }
  console.log(
    `\nresumo: ${linhas.length} alertados · ${linhas.length - semConta.length} ja tem conta · ` +
      `${semConta.length} seguem SEM CONTA`,
  );
  const nuncaConvidado = semConta.filter((s) => !s.convite);
  console.log(
    `dos sem conta: ${semConta.length - nuncaConvidado.length} receberam convite automatico, ` +
      `${nuncaConvidado.length} NUNCA foram procurados` +
      (nuncaConvidado.length ? ` -> ${nuncaConvidado.map((s) => s.email).join(", ")}` : ""),
  );
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
