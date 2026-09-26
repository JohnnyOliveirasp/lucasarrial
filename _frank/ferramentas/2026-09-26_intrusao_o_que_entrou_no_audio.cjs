#!/usr/bin/env node
/**
 * O QUE, LITERALMENTE, ENTROU NO ÁUDIO DO ALUNO — leitura crua do `qa` das
 * gerações do `#530` (dnoronhajr@gmail.com), sem intermediário.
 *
 * ── POR QUE ESTE INSTRUMENTO EXISTE ──────────────────────────────────────
 * O `#530` acumulou 4 contatos do aluno e duas rondas de telemetria dizendo
 * "intrusão 18/18" e "26/27". Isso é CONTAGEM: diz quantos pedaços acusaram
 * conteúdo fora do texto, não O QUE entrou. E o detector de percepção levantou
 * o cartão com `[nao ouco]`, ou seja: a fila sabia que faltava OUVIR.
 *
 * A ordem de 17/09 manda despachar percepção, não declará-la como parada. O
 * despacho pro `olho` falhou hoje às 07:45Z (card 05c59ff0, mesma natureza de
 * tarefa). Então antes de gerar um segundo card falho, este script pergunta ao
 * BANCO se a evidência de escuta já existe lá dentro: o pipeline de QA compara
 * o áudio transcrito pelo whisper com o texto pedido, e quando acha frase
 * intrusa ele pode ter GUARDADO a amostra. Se guardou, a prova está escrita e
 * ninguém precisa ouvir pra saber o que o aluno ouviu.
 *
 * Ele NÃO decide nada e NÃO escreve no banco. Imprime o `qa` INTEIRO (cru,
 * JSON, sem escolher campo), porque escolher campo é exatamente como se perde
 * a amostra que interessa — a ronda de hoje já apanhou disso ao medir "100%
 * sinalizado" e deixar passar a geração de 96,3%.
 *
 * ARMADILHAS RESPEITADAS:
 *   - imprime o `qa` cru ANTES de qualquer interpretação (o briefing manda
 *     imprimir o campo cru antes de acreditar em zero);
 *   - ledger pareado por `ref_id` + `ref_type`, NUNCA por `kind` nem por valor;
 *   - confere que cada geração é DO ALUNO antes de falar dela;
 *   - se o `qa` não tiver amostra de intrusão, diz "NÃO TEM" com essas
 *     palavras — ausência de amostra não vira "não houve intrusão".
 *
 * USO: node _frank/ferramentas/2026-09-26_intrusao_o_que_entrou_no_audio.cjs
 */
const { supa } = require("./_comum.cjs");

const EMAIL = "dnoronhajr@gmail.com";
const GERACOES = [
  "65f26a72", // 23/09 — 684 ch, 18/18, JÁ ESTORNADA pela casa às 15:27Z
  "f1d1b4a4", // 25/09 — 721 ch, 18/18, não estornada
  "ba4a829e", // 26/09 — 730 ch, 26/27, não estornada
];

(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db
    .from("profiles")
    .select("id,email,credits_subscription,credits_extra,access_until,plan")
    .eq("email", EMAIL);
  if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
  if (profs.length !== 1) { console.error(`esperava 1 perfil, achei ${profs.length} — PARE.`); process.exit(1); }
  const p = profs[0];
  console.log(`aluno ${p.email} · perfil ${p.id.slice(0, 8)}`);
  console.log(`  plano=${p.plan} · acesso até ${p.access_until} · saldo=${(p.credits_subscription ?? 0) + (p.credits_extra ?? 0)}`);
  console.log("");

  for (const curto of GERACOES) {
    // `id` é uuid: `like` não existe pra uuid no Postgres ("operator does not
    // exist: uuid ~~ unknown"). Então filtro em JS sobre as gerações DELE, e
    // EXIJO que o prefixo case exatamente 1 — prefixo ambíguo pararia o script.
    const { data: todas, error: eg } = await db
      .from("generations")
      .select("id,user_id,status,created_at,duration_seconds,text_raw,qa,audio_path,error_message")
      .eq("user_id", p.id);
    if (eg) { console.error(`ERRO generations ${curto}:`, eg.message); process.exit(1); }
    const gs = (todas ?? []).filter((x) => x.id.startsWith(curto));
    if (gs.length !== 1) { console.error(`${curto}: esperava 1 geração, achei ${gs.length} — PARE.`); process.exit(1); }
    const g = gs[0];
    const meu = g.user_id === p.id;

    console.log("═".repeat(78));
    console.log(`GERAÇÃO ${g.id}`);
    console.log(`  do aluno? ${meu ? "SIM" : "*** NÃO — não falo dela ***"}`);
    if (!meu) { console.log(""); continue; }
    console.log(`  status=${g.status} · ${g.created_at} · ${g.duration_seconds}s`);
    console.log(`  texto pedido: ${(g.text_raw ?? "").length} chars`);
    console.log(`  erro: ${g.error_message ?? "(nenhum)"}`);
    console.log(`  arquivo: ${g.audio_path ?? "(sem path)"}`);

    // qa CRU primeiro, antes de qualquer leitura minha.
    console.log("  ── qa CRU (JSON inteiro, sem escolher campo) ──");
    console.log(JSON.stringify(g.qa ?? null, null, 2).split("\n").map((l) => "  " + l).join("\n"));

    // Só DEPOIS, procuro amostra de intrusão sem inventar nome de campo:
    const qa = g.qa ?? {};
    const chavesIntrusao = Object.keys(qa).filter((k) => /intrus/i.test(k));
    console.log(`  ── chaves com "intrus" no nome: ${chavesIntrusao.length ? chavesIntrusao.join(", ") : "NENHUMA"}`);
    const comTexto = chavesIntrusao.filter((k) => {
      const v = qa[k];
      return typeof v === "string" || Array.isArray(v) || (v && typeof v === "object");
    });
    if (!comTexto.length) {
      console.log("  ⚠️  NÃO TEM AMOSTRA DO TEXTO INTRUSO no qa — só contagem.");
      console.log("      Isto NÃO significa 'não houve intrusão': significa que a prova de");
      console.log("      ESCUTA não está no banco e só sai ouvindo o arquivo.");
    } else {
      for (const k of comTexto) console.log(`  ${k} = ${JSON.stringify(qa[k])}`);
    }

    // Ledger deste ref_id — pareado por ref_id, nunca por kind.
    const { data: linhas, error: el } = await db
      .from("credit_transactions")
      .select("amount,kind,ref_type,ref_id,created_at,balance_after")
      .eq("ref_id", g.id)
      .order("created_at");
    if (el) { console.error("ERRO ledger:", el.message); process.exit(1); }
    const deb = linhas.filter((t) => t.amount < 0);
    const est = linhas.filter((t) => t.amount > 0);
    console.log(`  ── ledger (por ref_id): ${deb.length} débito(s) · ${est.length} estorno(s)`);
    for (const t of linhas) {
      console.log(`     ${t.amount > 0 ? "+" : ""}${t.amount}  kind=${t.kind}  ref_type=${t.ref_type}  ${t.created_at}`);
    }
    const estornoGeracao = est.filter((t) => t.ref_type === "generation_refund");
    console.log(`  VEREDITO DE CRÉDITO: ${estornoGeracao.length ? "ESTORNADO (generation_refund presente)" : "*** NÃO ESTORNADO ***"}`);
    console.log("");
  }

  // Trecho do texto pedido da última, pra dar pra comparar com o que o aluno diz
  // ("repete o começo do parágrafo do áudio anterior").
  const { data: duas } = await db
    .from("generations")
    .select("id,created_at,text_raw")
    .eq("user_id", p.id)
    .order("created_at", { ascending: false })
    .limit(4);
  console.log("═".repeat(78));
  console.log("PRIMEIROS 160 CHARS DO TEXTO PEDIDO NAS ÚLTIMAS GERAÇÕES");
  console.log("(a queixa dele é 'repete sempre o começo do parágrafo do áudio ANTERIOR' —");
  console.log(" então o começo de uma é o que deveria aparecer, indevidamente, na outra)");
  for (const g of duas ?? []) {
    console.log(`\n  ${g.id.slice(0, 8)} ${g.created_at}`);
    console.log(`    "${(g.text_raw ?? "").slice(0, 160).replace(/\s+/g, " ")}..."`);
  }
})();
