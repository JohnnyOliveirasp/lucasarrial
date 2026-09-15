#!/usr/bin/env node
/**
 * #324 — corrige o estado das 2 transacoes DEPOIS do reparo.
 *
 * O e-mail de boas-vindas foi enviado na mao em 09/09 (uid 1443 e 1444 na
 * pasta de enviados). O `agent_state` ainda diz `canais: []`, que agora e
 * MENTIRA — e e exatamente o campo que o detector de vitimas usa.
 *
 * Grava `canais: ["email"]` (verdade: o e-mail saiu) e carimba
 * `reparado_manualmente_em` pra que o historico NAO se perca: quem ler o
 * registro precisa saber que o envio original falhou e que quem entregou foi
 * gente, nao o webhook.
 *
 * Sem --confirmar, ensaia.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const CHAVE_ESTADO = "sgp_boas_vindas";
const CONFIRMAR = process.argv.includes("--confirmar");
const REPARO = {
  HP0150302636: { email: "jcesaram@gmail.com", uid: 1443 },
  HP1390733090: { email: "patricia.bp170@gmail.com", uid: 1444 },
};

(async () => {
  const db = supa();
  const { data: est, error } = await db
    .from("agent_state")
    .select("value")
    .eq("key", CHAVE_ESTADO)
    .maybeSingle();
  if (error) throw new Error(`leitura: ${error.message}`);
  const valor = { ...(est?.value ?? {}) };

  for (const [tx, info] of Object.entries(REPARO)) {
    const atual = valor[tx];
    if (!atual) {
      console.log(`  ${tx}: NAO EXISTE no estado — nao vou inventar. Pulando.`);
      continue;
    }
    if (String(atual.buyerEmail).toLowerCase() !== info.email) {
      console.log(`  ${tx}: e-mail nao confere (${atual.buyerEmail} != ${info.email}). Pulando.`);
      continue;
    }
    console.log(`  ${tx} (${info.email})`);
    console.log(`    antes:  ${JSON.stringify(atual)}`);
    valor[tx] = {
      ...atual,
      canais: ["email"],
      reparado_manualmente_em: "2026-09-09",
      reparo_nota: `#324: envio original falhou (canais: []); e-mail de boas-vindas reenviado na mao por frank, copia em enviados uid ${info.uid}`,
    };
    console.log(`    depois: ${JSON.stringify(valor[tx])}`);
  }

  if (!CONFIRMAR) {
    console.log("\nENSAIO — nada gravado. Rode com --confirmar.");
    return;
  }

  const { data: gravado, error: erroGravar } = await db
    .from("agent_state")
    .upsert({ key: CHAVE_ESTADO, value: valor, updated_at: new Date().toISOString() })
    .select();
  if (erroGravar) throw new Error(`gravacao: ${erroGravar.message}`);
  // Update por id inexistente afeta 0 linhas EM SILENCIO — confira.
  console.log(`\nlinhas afetadas: ${gravado?.length ?? 0}`);
  if (!gravado?.length) throw new Error("upsert afetou 0 linhas — NAO gravou");

  // Reler do banco: so o que o banco devolve conta como feito.
  const { data: conf } = await db
    .from("agent_state")
    .select("value")
    .eq("key", CHAVE_ESTADO)
    .maybeSingle();
  for (const tx of Object.keys(REPARO)) {
    console.log(`  conferido ${tx}: ${JSON.stringify(conf?.value?.[tx])}`);
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
