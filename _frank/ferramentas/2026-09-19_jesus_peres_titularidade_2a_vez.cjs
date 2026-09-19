/**
 * #314 — A FUSE EXPLODIU. Segundo reparo da MESMA titularidade, 11 dias depois.
 *
 * O QUE O CARD PREVIU E O QUE REALMENTE ACONTECEU (medido em 19/09/2026 ~15h40Z)
 * O #314 foi aberto em 08/09 dizendo, com todas as letras: "o meu proprio reparo
 * tem prazo de validade — 18/09. Quem pegar este card depois de 18/09 tem que
 * CONFERIR o Jesus antes de qualquer outra coisa."
 * Conferi. A titularidade ja tinha virado — e NAO foi na renovacao de 18/09:
 *   payment_events 8638e6c3 · PURCHASE_COMPLETE · iehudaperes@grupoperes.com.br
 *   recebido 2026-09-16 11:18:07.419Z · processado 11:18:08.608Z · error NULL
 *   entitlements.A1ZH3SEI.updated_at = 2026-09-16 11:18:07.805Z
 *   user_id 347eccc3 (conta que ele USA) -> 4656e845 (conta que ele NUNCA abriu)
 * O card vigiava a data da renovacao; quem armou o gatilho foi um PURCHASE_COMPLETE
 * dois dias ANTES. Qualquer evento da Hotmart naquela assinatura serve — a data
 * escrita no card deu falsa sensacao de prazo.
 *
 * DINHEIRO: NAO houve. O evento de 16/09 nao gerou lancamento nenhum
 * (credit_transactions dos dois perfis nao tem linha depois de 08/09). Os 111.650
 * seguem na conta que ele usa. Este reparo NAO move credito, NAO estorna e NAO
 * concede — ao contrario do reparo de 08/09, que precisou mover 100.000.
 * Por isso NAO se pode reexecutar o script de 08/09: o passo 4 dele lancaria
 * -100.000 numa conta que hoje ja esta zerada, criando saldo negativo do nada.
 *
 * POR QUE RELIGAR AINDA ASSIM, SE O CODIGO SEGUE O MESMO
 * Religar sozinho nao segura: `grantAccess` (entitlements.ts:63-72) regrava
 * `user_id = findUserIdByEmail(buyer_email)` a CADA evento, e o perfil do
 * iehudaperes@ existe — entao o proximo evento vira o dono de novo. O que torna
 * este religamento necessario e o conserto do codigo: a regra do conserto
 * (PR desta ronda) e "o lookup por e-mail so ADICIONA dono, nunca TROCA", ou
 * seja, ela PRESERVA quem esta gravado na linha. Se o conserto subir com a linha
 * apontando pra conta fantasma, ele CONGELA O DANO. A ordem importa: religar
 * primeiro, consertar depois.
 *
 * O QUE ESTE SCRIPT FAZ (sem --confirmar, so ENSAIA)
 *  1. devolve A1ZH3SEI para 347eccc3 (UPDATE guardado pelo dono atual);
 *  2. devolve o perfil fantasma para free/sem acesso — o evento de 16/09 o
 *     deixou plan=pro/access_until 18/09, desfazendo o reparo de 08/09.
 *
 * O QUE ELE NAO FAZ, DE PROPOSITO
 *  - NAO toca no perfil da conta real. Ela esta com plan=pro e access_until
 *    2026-09-18 12:00:00Z, data JA VENCIDA — ou seja, cache velho que nao
 *    concede nada. A rec#3 esta OVERDUE na Hotmart (conferido em
 *    pagou_de_verdade.cjs): o periodo pago dele terminou mesmo em 18/09.
 *    Escrever plan='free' ali seria eu executar na mao um vencimento que o
 *    sistema nao executou, num aluno que pagou R$ 849,45 + R$ 97. Quem vence
 *    acesso e o produto, nao a ronda. E o gate das telas e por CREDITO
 *    (ordem de 18/08), e os 111.650 estao na conta certa: ele continua
 *    entrando e gastando o que e dele.
 *  - NAO cobra, NAO gasta GPU, NAO estorna, NAO concede credito, NAO apaga
 *    linha de extrato, NAO manda e-mail, NAO mexe em migration.
 */
const { supa } = require("./_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");

const ENT = "A1ZH3SEI";
const GHOST = "4656e845-5831-4a05-9c4b-aa62e61b6fc7"; // iehudaperes@ (nunca logou)
const REAL = "347eccc3-6bdd-4c23-9522-f99c26a918c5"; // diretoria@ (a que ele usa)

const p = (...a) => console.log(...a);

(async () => {
  const db = supa();

  // ── 1. PRE-CONDICOES. Qualquer divergencia ABORTA (nada de UPDATE as cegas)
  p("=== PRE-CONDICOES (o banco tem que estar exatamente como eu medi) ===");
  const falhas = [];
  const exigir = (ok, o_que, achado) => {
    p(`  ${ok ? "OK  " : "NAO "} ${o_que} -> ${achado}`);
    if (!ok) falhas.push(o_que);
  };

  const { data: ent } = await db
    .from("entitlements")
    .select("id,user_id,status,access_until,buyer_email,updated_at")
    .eq("external_id", ENT)
    .maybeSingle();
  exigir(!!ent, `entitlement ${ENT} existe`, ent ? ent.id : "NAO ACHEI");
  exigir(ent?.user_id === GHOST, "dono atual = conta fantasma (a fuse explodiu)", ent?.user_id ?? "null");
  exigir(ent?.buyer_email === "iehudaperes@grupoperes.com.br", "buyer_email = e-mail da compra", ent?.buyer_email);

  // A trava mais importante: se ele JA ENTROU na conta nova, a decisao "a conta
  // dele e a diretoria@" deixa de ser obvia e quem decide passa a ser ELE.
  const { data: fantasma } = await db
    .from("profiles")
    .select("id,email,plan,credits_subscription,credits_extra,access_until,last_seen_at")
    .eq("id", GHOST)
    .maybeSingle();
  exigir(fantasma?.last_seen_at === null, "fantasma NUNCA foi usada (last_seen null)", String(fantasma?.last_seen_at));
  exigir(fantasma?.credits_subscription === 0, "fantasma com 0 de assinatura (nada a mover)", fantasma?.credits_subscription);
  exigir(fantasma?.credits_extra === 0, "fantasma com 0 de extra (nada a mover)", fantasma?.credits_extra);

  const { data: real } = await db
    .from("profiles")
    .select("id,email,plan,credits_subscription,credits_extra,access_until,last_seen_at")
    .eq("id", REAL)
    .maybeSingle();
  exigir(!!real, "conta real existe", real?.email);
  exigir(real?.last_seen_at !== null, "conta real E a que ele usa (tem last_seen)", String(real?.last_seen_at));
  exigir(
    real?.credits_subscription + real?.credits_extra === 111650,
    "conta real com os 111.650 do reparo de 08/09",
    `${real?.credits_subscription} + ${real?.credits_extra}`,
  );

  // Controle: o evento de 16/09 NAO pode ter mexido em credito. Se mexeu, este
  // script esta errado de premissa e tem que abortar.
  const { data: txDepois } = await db
    .from("credit_transactions")
    .select("id,user_id,kind,amount,created_at")
    .in("user_id", [REAL, GHOST])
    .gt("created_at", "2026-09-09T00:00:00Z");
  exigir(
    (txDepois ?? []).length === 0,
    "nenhum lancamento nos 2 perfis depois de 08/09 (o evento de 16/09 nao mexeu em dinheiro)",
    `${(txDepois ?? []).length} linha(s)`,
  );

  if (falhas.length) {
    p(`\nABORTADO: ${falhas.length} pre-condicao(oes) nao batem. O banco mudou desde a medicao.`);
    process.exit(1);
  }

  p("\n=== O QUE VAI ACONTECER ===");
  p(`  1) entitlements.${ENT}.user_id : ${GHOST} -> ${REAL}`);
  p(`  2) profiles ${fantasma.email} : plan=${fantasma.plan} -> free, access_until=${fantasma.access_until} -> NULL`);
  p(`  (nada de credito: os dois perfis ficam com o saldo que ja tem)`);

  if (!CONFIRMAR) {
    p("\nENSAIO. Nada foi gravado. Rode com --confirmar para executar.");
    return;
  }

  p("\n=== EXECUTANDO ===");

  const { data: mov, error: e1 } = await db
    .from("entitlements")
    .update({ user_id: REAL, updated_at: new Date().toISOString() })
    .eq("external_id", ENT)
    .eq("user_id", GHOST)
    .select("id,user_id");
  if (e1) throw new Error(`1) ${e1.message}`);
  p(`  1) entitlement: ${mov.length} linha(s) -> dono ${mov[0]?.user_id}`);
  if (mov.length !== 1) throw new Error("1) esperava exatamente 1 linha");

  const { data: zer, error: e2 } = await db
    .from("profiles")
    .update({
      plan: "free",
      access_source: null,
      access_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", GHOST)
    .eq("credits_subscription", 0)
    .select("id,plan,access_until");
  if (e2) throw new Error(`2) ${e2.message}`);
  p(`  2) fantasma: ${zer.length} linha(s) -> plan=${zer[0]?.plan} acesso=${zer[0]?.access_until}`);
  if (zer.length !== 1) throw new Error("2) esperava exatamente 1 linha");

  // ── RELEITURA: o que o BANCO diz DEPOIS de gravar (nao o que eu planejei)
  p("\n=== RELEITURA DO BANCO (a prova) ===");
  const { data: entD } = await db
    .from("entitlements")
    .select("external_id,user_id,status,access_until,buyer_email")
    .eq("external_id", ENT)
    .maybeSingle();
  p(`  ${entD.external_id}: dono=${entD.user_id} status=${entD.status} ate=${entD.access_until}`);
  p(`  ${entD.user_id === REAL ? "OK  " : "NAO "} dono e a conta que o aluno usa`);

  const { data: pf } = await db
    .from("profiles")
    .select("id,email,plan,access_until,credits_subscription,credits_extra")
    .in("id", [REAL, GHOST]);
  for (const r of pf ?? []) {
    p(
      `  ${r.email}: plan=${r.plan} ate=${r.access_until} saldo=${r.credits_subscription + r.credits_extra}`,
    );
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
