/**
 * REMÉDIO OBSOLETO — o conserto pronto cujo defeito já morreu por outro caminho.
 *
 *   node _frank/ferramentas/2026-09-24_remedio_obsoleto.cjs
 *   node _frank/ferramentas/2026-09-24_remedio_obsoleto.cjs --json
 *
 * SÓ LEITURA. Não mergeia, não fecha PR, não escreve nada.
 *
 * ── POR QUE NASCEU (ronda de 24/09 ~23hZ) ────────────────────────────────
 *
 * O `2026-09-24_conserto_pronto_e_parado.cjs` mede a fila de consertos e
 * separa em "✅ MERGEABLE+CLEAN (entram hoje)" × "💀 CONFLITADOS". Nesta
 * ronda ele contou **46 entram hoje**. Abri dois deles e os DOIS não deviam
 * entrar — não por conflito, e não por deriva de branch:
 *
 *   #323 (ponte pro webhook de estorno não quebrar sem a função no banco)
 *        → a migration 111 foi APLICADA em 22/09. `pg_proc` tem a função,
 *          `payment_events` com `processed_at` NULL = 0. A ponte protege de
 *          um defeito que não existe mais.
 *   #324 (reabrir o passo de ÁUDIO do SGP pra Janice mandar material novo)
 *        → ela resolveu SOZINHA em 18/09 08:31Z: voz 9e94f1f6 `ready`,
 *          `language=en`, e os 10.000 cobrados foram estornados. A ferramenta
 *          é hard-coded no pedido dela e hoje só faria dano gratuito: o que
 *          ela ESCREVE (medido no próprio script, não inferido) é
 *          `status='audio'`, `audios=[]`, `enviado_em/voz_pronta_em/voice_id
 *          = null` num pedido de aluna cujo caso já está materialmente
 *          resolvido. Escrita sem benefício nenhum em dado de aluna pagante.
 *          ⚠️ O que eu NÃO medi: se `estadoDasEtapas` recarimbaria o pedido
 *          de volta pra `pronto` na 1ª leitura (hoje ela TEM voz `ready` sob
 *          o `user_id`, o que não era verdade em 17/09, quando o script foi
 *          escrito). Ou seja: o estrago pode se curar sozinho. Não afirmo que
 *          mergear + rodar a destruiria — afirmo que a escrita não serve mais
 *          pra nada, e que ninguém deve rodar script hard-coded em aluno pra
 *          descobrir qual das duas coisas acontece.
 *
 * É uma classe NOVA, e é o ponto desta ferramenta. A casa já documentou 6
 * vezes o branch STALE (`feat/onedrive-401`, `feat/fix-image-upload-retry`,
 * as 2 da cura de referência, `fix/trava-foto-nova-8379549c`,
 * `fix/ritmo-da-referencia-porta-73a60bb`, `fix/estorno-treino-por-saldo-pendente`)
 * — mas naqueles o defeito era DERIVA: a main andou por cima do arquivo e o
 * merge derrubaria o que está no ar. Aqui o arquivo não derivou e o
 * `mergeStateStatus` é **CLEAN**: o que morreu foi o DEFEITO. O remédio
 * sobreviveu ao doente.
 *
 * Por que isso é pior que o STALE e não melhor: o STALE se anuncia (CONFLICTING,
 * branch atrás, arquivo movido). O obsoleto-por-cura entra na coluna
 * "entram hoje" e o instrumento da casa **recomenda** mergear.
 *
 * ── COMO ELE ACHA, E POR QUE ELE NÃO DECIDE ──────────────────────────────
 *
 * Sinal: o PR cita `#NNN` (título ou corpo) e o incidente de `numero = NNN`
 * já está `fixed`/`ignored`. Conserto pronto pra chamado fechado é CANDIDATO
 * a remédio obsoleto.
 *
 * O sinal é BARATO e AMBÍGUO de propósito: `#NNN` num corpo de PR também é
 * número de PR, de issue e de cartão do Mission Board. Então esta ferramenta
 * **surface o candidato, humano decide** — mesma doutrina do `NOTA_NEUTRA` do
 * `esperando_johnny.cjs` (24/09): lista escrita à mão envelhece, e varrer a
 * pilha inteira calado foi o que produziu 41 falsos em 17/09.
 *
 * O que NUNCA é conclusão desta ferramenta: "pode fechar o PR". Fechar exige
 * abrir o caso e medir se o defeito morreu MESMO — foi assim que o #323 e o
 * #324 foram condenados, com consulta no banco vivo, não por este sinal.
 *
 * LIMITE DECLARADO: PR que não cita `#NNN` nenhum sai em "SEM REFERÊNCIA" e
 * NÃO é inocentado — só não tem por onde este sinal pegar. O #324 é
 * exatamente desse tipo (cita o pedido `09646e28`, não um `#NNN`), e foi
 * achado à mão. Ou seja: a ferramenta teria perdido metade dos dois casos que
 * a fizeram nascer. Ela é um piso, não uma peneira.
 */
const { execFileSync } = require("node:child_process");
const { supa } = require("./_comum.cjs");

const FECHADO = new Set(["fixed", "ignored"]);

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

(async () => {
  const comoJson = process.argv.includes("--json");

  const prs = JSON.parse(
    gh([
      "pr", "list", "--state", "open", "--limit", "300",
      "--json", "number,title,body,mergeable,mergeStateStatus,createdAt,headRefName",
    ]),
  );

  // Só o que o conserto_pronto_e_parado classifica como "entra hoje".
  const limpos = prs.filter((p) => p.mergeable === "MERGEABLE" && p.mergeStateStatus === "CLEAN");
  const naoCalculados = prs.filter((p) => p.mergeable === "UNKNOWN");

  if (naoCalculados.length) {
    console.log(`⚠️  ${naoCalculados.length} PR(s) voltaram UNKNOWN (o GitHub não calculou a mergeabilidade).`);
    console.log(`   Eles ficaram FORA desta conta — não são inocentados, são não-medidos.`);
    console.log(`   Rode de novo: a 1ª chamada é o que faz o GitHub calcular.\n`);
  }

  const db = supa();
  const { data: incs, error } = await db
    .from("incidents")
    .select("numero,id,status,title,affected_emails")
    .limit(5000);
  if (error) { console.log("ERRO lendo incidents:", error.message); process.exit(1); }
  const porNumero = new Map((incs || []).filter((i) => i.numero != null).map((i) => [Number(i.numero), i]));

  const candidatos = [];
  const semReferencia = [];
  const comAberto = [];

  for (const p of limpos) {
    const texto = `${p.title}\n${p.body || ""}`;
    const nums = [...new Set([...texto.matchAll(/#(\d{1,4})\b/g)].map((m) => Number(m[1])))];
    const casados = nums.map((n) => porNumero.get(n)).filter(Boolean);

    if (!casados.length) { semReferencia.push(p); continue; }

    const fechados = casados.filter((i) => FECHADO.has(i.status));
    const abertos = casados.filter((i) => !FECHADO.has(i.status));

    if (abertos.length === 0) candidatos.push({ pr: p, fechados });
    else comAberto.push({ pr: p, abertos, fechados });
  }

  const dias = (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000);

  if (comoJson) {
    console.log(JSON.stringify({ candidatos, semReferencia, comAberto, naoCalculados: naoCalculados.map((p) => p.number) }, null, 2));
    return;
  }

  console.log(`🧪 PRs MERGEABLE+CLEAN examinados: ${limpos.length}\n`);

  console.log("=".repeat(70));
  console.log(`🪦 CANDIDATOS A REMÉDIO OBSOLETO: ${candidatos.length}`);
  console.log("   (todo #NNN que o PR cita e que casa com incidente está FECHADO)");
  console.log("=".repeat(70));
  for (const c of candidatos.sort((a, b) => dias(b.pr.createdAt) - dias(a.pr.createdAt))) {
    console.log(`  ${String(dias(c.pr.createdAt)).padStart(3)}d | #${c.pr.number} | ${c.pr.title.slice(0, 68)}`);
    for (const i of c.fechados) {
      console.log(`         ↳ inc #${i.numero} [${i.status}] ${String(i.id).slice(0, 8)} · ${(i.title || "").slice(0, 56)}`);
    }
  }

  console.log(`\n── SEM REFERÊNCIA a incidente (este sinal não alcança): ${semReferencia.length} ──`);
  console.log(`   NÃO é inocência. O #324 caiu aqui e era obsoleto.`);
  for (const p of semReferencia.sort((a, b) => dias(b.createdAt) - dias(a.createdAt)).slice(0, 15)) {
    console.log(`  ${String(dias(p.createdAt)).padStart(3)}d | #${p.number} | ${p.title.slice(0, 68)}`);
  }
  if (semReferencia.length > 15) console.log(`  ... e ${semReferencia.length - 15} outro(s)`);

  console.log(`\n── com incidente AINDA ABERTO (o remédio ainda tem doente): ${comAberto.length} ──`);

  console.log(`\n>>> NÚMERO PRO RELATÓRIO: ${candidatos.length} candidato(s) a remédio obsoleto`);
  console.log(`    entre ${limpos.length} PR(s) que o conserto_pronto_e_parado conta como "entram hoje".`);
  console.log(`    ⚠️  CANDIDATO NÃO É VEREDITO. Fechar PR exige medir no banco vivo que o`);
  console.log(`       defeito morreu — como foi feito no #323 (pg_proc + processed_at) e no`);
  console.log(`       #324 (voz ready + estorno). Sem essa medição, não feche nada.`);
})();
