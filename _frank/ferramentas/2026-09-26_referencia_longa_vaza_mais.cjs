#!/usr/bin/env node
/**
 * A REFERÊNCIA LONGA VAZA MAIS? — testa a hipótese de CAUSA do `#530`, em vez
 * de só medir o sintoma.
 *
 * ── DE ONDE VEIO A HIPÓTESE (ronda de 26/09, ~14h50Z) ─────────────────────
 * Depois de estornar as duas gerações do `#530`, fui ver POR QUE o eco da
 * referência se concentra tanto nesse aluno (3 das 4 piores da frota em 14
 * dias). A referência da voz dele (`auto.wav`, voz `4e3fe6b6`) tem **485 chars**
 * de transcrição e é um **pedaço do meio de um documento**: começa em
 * *"2. Preservação do patrimônio."* e termina **cortada no meio da palavra**
 * (*"...mesmo s"*).
 *
 * Duas coisas juntas, e as duas já estão escritas no manual da casa:
 *
 * 1. **Referência cortada no meio da palavra** é um defeito CONHECIDO e ABERTO
 *    (ordem de 20/08, item 2: *"3-4 de 14 vozes com o defeito da Katia. Cura
 *    manual provada. Automatizar exige TIMESTAMPS DE PALAVRA"*). Ninguém tinha
 *    ligado esse item ao `#530`.
 * 2. Quanto MAIS texto a referência carrega, mais material o continuation do
 *    VoxCPM tem pra vazar (`echo_leak_count`, `tts_qa/metrics.py:127`).
 *
 * Se a hipótese valer, o conserto pro aluno não é só o gate (que reprova e
 * estorna): é **refazer a referência dele**, o que a casa já sabe fazer à mão.
 *
 * ── O QUE ESTE SCRIPT FAZ ─────────────────────────────────────────────────
 * Para a população comparável (gerações `ready` com `echo_checked > 0` na
 * janela), cruza o TAMANHO da transcrição da referência com a FRAÇÃO de eco, e
 * marca as referências que terminam em palavra cortada. Imprime a distribuição
 * por faixa de tamanho — não um coeficiente, porque com 4 casos severos
 * qualquer correlação numérica seria teatro.
 *
 * NÃO escreve no banco. NÃO decide nada.
 *
 * ARMADILHAS RESPEITADAS:
 *   - PAGINA e MORRE se o total lido não bater com o `count` exato (o corte de
 *     1000 linhas já produziu 27 falsos positivos nesta mesma manhã);
 *   - população declarada e denominador impresso;
 *   - reporta `echo_checked` junto da fração (fração alta com 3 pedaços é
 *     ruído — erro de método registrado hoje);
 *   - "termina em palavra cortada" é HEURÍSTICA declarada: última palavra sem
 *     pontuação final e com <= 2 letras, OU transcrição que não termina em
 *     pontuação. Não é veredito de áudio — é pista pra quem for ouvir.
 *
 * USO: node _frank/ferramentas/2026-09-26_referencia_longa_vaza_mais.cjs [dias]
 */
const { supa } = require("./_comum.cjs");

const DIAS = Number(process.argv[2] || 14);
const ALUNO_DO_CASO = "a98f8173-c02b-423e-b1ff-745443c4c28f"; // #530

/** Heurística DECLARADA de "referência cortada" — pista, não veredito. */
function cortada(t) {
  if (!t) return null;
  const s = t.trim();
  if (!s) return null;
  if (/[.!?…]"?$/.test(s)) return false;
  const ultima = s.split(/\s+/).pop() ?? "";
  return { sem_pontuacao_final: true, ultima_palavra: ultima, curta: ultima.length <= 2 };
}

(async () => {
  const db = supa();
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString();

  const { count, error: ec } = await db
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready")
    .gte("created_at", desde);
  if (ec) { console.error("ERRO count:", ec.message); process.exit(1); }

  const PAG = 500;
  const linhas = [];
  for (let de = 0; de < count; de += PAG) {
    const { data, error } = await db
      .from("generations")
      .select("id,user_id,voice_id,created_at,qa,reference_transcript")
      .eq("status", "ready")
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .range(de, de + PAG - 1);
    if (error) { console.error("ERRO página", de, error.message); process.exit(1); }
    linhas.push(...data);
  }
  if (linhas.length !== count) {
    console.error(`LI ${linhas.length} de ${count} — paginação furou. PARE.`);
    process.exit(1);
  }

  const pop = linhas
    .map((g) => {
      const qa = g.qa ?? {};
      const ch = qa.echo_checked ?? 0;
      if (!(ch > 0)) return null;
      const t = g.reference_transcript ?? "";
      return {
        id: g.id, user_id: g.user_id, voice_id: g.voice_id, created_at: g.created_at,
        ch, fl: qa.echo_flagged ?? 0, frac: (qa.echo_flagged ?? 0) / ch,
        ref_chars: t.length, corte: cortada(t),
      };
    })
    .filter(Boolean);

  console.log(`população: ready + echo_checked>0, desde ${desde} (${DIAS}d)`);
  console.log(`lidas ${linhas.length}/${count} (paginado, conferido) · comparáveis ${pop.length}\n`);

  const semRef = pop.filter((x) => x.ref_chars === 0).length;
  console.log(`sem transcrição de referência gravada: ${semRef} (ficam de fora das faixas)\n`);

  const faixas = [
    ["0 (sem ref)", (x) => x.ref_chars === 0],
    ["1–99", (x) => x.ref_chars >= 1 && x.ref_chars < 100],
    ["100–199", (x) => x.ref_chars >= 100 && x.ref_chars < 200],
    ["200–299", (x) => x.ref_chars >= 200 && x.ref_chars < 300],
    ["300–399", (x) => x.ref_chars >= 300 && x.ref_chars < 400],
    ["400+", (x) => x.ref_chars >= 400],
  ];
  console.log("FRAÇÃO DE ECO POR TAMANHO DA TRANSCRIÇÃO DA REFERÊNCIA");
  console.log("faixa         n     eco médio   severos(>=0,8 e ch>=5)");
  for (const [rot, f] of faixas) {
    const g = pop.filter(f);
    if (!g.length) { console.log(`  ${rot.padEnd(12)} ${String(0).padStart(4)}          —            —`); continue; }
    const medio = g.reduce((a, x) => a + x.frac, 0) / g.length;
    const sev = g.filter((x) => x.frac >= 0.8 && x.ch >= 5).length;
    console.log(`  ${rot.padEnd(12)} ${String(g.length).padStart(4)}     ${medio.toFixed(4)}        ${sev}`);
  }

  const severos = pop.filter((x) => x.frac >= 0.8 && x.ch >= 5).sort((a, b) => b.frac - a.frac);
  console.log(`\nOS SEVEROS, com o tamanho da referência e a pista de corte (${severos.length}):`);
  const ids = [...new Set(severos.map((x) => x.user_id))];
  const emails = new Map();
  if (ids.length) {
    const { data: ps } = await db.from("profiles").select("id,email").in("id", ids);
    for (const p of ps ?? []) emails.set(p.id, p.email);
  }
  for (const x of severos) {
    const c = x.corte;
    const pista = c === null ? "sem ref" : c === false ? "termina em pontuação" : `CORTADA? última="${c.ultima_palavra}"${c.curta ? " (<=2 letras)" : ""}`;
    console.log(`  ${x.id.slice(0, 8)} ${x.created_at.slice(0, 16)} eco ${x.fl}/${x.ch}=${x.frac.toFixed(3)} · ref ${String(x.ref_chars).padStart(4)} ch · ${pista}`);
    console.log(`     voz ${(x.voice_id ?? "").slice(0, 8)} · ${emails.get(x.user_id) ?? x.user_id.slice(0, 8)}${x.user_id === ALUNO_DO_CASO ? "  <<< #530" : ""}`);
  }

  // Quantas referências da frota terminam sem pontuação (pista do corte)?
  const comRef = pop.filter((x) => x.ref_chars > 0);
  const porVoz = new Map();
  for (const x of comRef) if (x.voice_id) porVoz.set(x.voice_id, x);
  const cortadas = [...porVoz.values()].filter((x) => x.corte && x.corte !== false);
  console.log(`\nVOZES DISTINTAS na janela: ${porVoz.size} · com referência que NÃO termina em pontuação: ${cortadas.length}`);
  console.log("(a ordem de 20/08 item 2 diz '3-4 de 14 vozes com o defeito da Katia' — esta é a mesma família)");

  console.log("\n⚠️  LIMITE: 'não termina em pontuação' é PISTA, não veredito — transcrição");
  console.log("    do whisper pode omitir o ponto final de uma frase inteira. E com poucos");
  console.log("    casos severos, faixa com n pequeno NÃO sustenta correlação: o que este");
  console.log("    script entrega é ONDE OUVIR, não uma lei.");
})();
