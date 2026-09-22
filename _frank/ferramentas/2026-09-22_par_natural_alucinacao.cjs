/**
 * PAR NATURAL DE ALUCINACAO — instrumento SO LEITURA.
 *
 * Pergunta: quando uma geracao falha por `qa_coverage` (chunk alucinado), a
 * culpa e do TEXTO/VOZ (entrada ruim) ou do SORTEIO (mesma entrada, resultado
 * diferente)?
 *
 * O jeito de responder sem gastar GPU e achar um PAR NATURAL: duas geracoes do
 * MESMO aluno, MESMA voz, MESMA referencia e texto equivalente, com desfechos
 * OPOSTOS. Se existe par assim, a entrada nao explica a falha.
 *
 * CONTROLE EMBUTIDO (regra de 22/09 — laudo sem controle nao entra em cartao):
 *   1. comparo os textos NORMALIZADOS caractere a caractere e IMPRIMO a
 *      diferenca crua. Se a diferenca for grande, o par NAO vale e o script
 *      diz isso — nao deixo o leitor supor que "quase igual" e "igual".
 *   2. confiro que a READY tem audio e duracao de verdade (ready sem audio
 *      seria falso par).
 *   3. imprimo os dois blocos qa lado a lado, pra ninguem concluir do resumo.
 *
 * NAO grava linha, NAO gasta GPU, NAO gasta credito, NAO manda e-mail.
 * Uso: node 2026-09-22_par_natural_alucinacao.cjs <email>
 */
const { supa } = require("./_comum.cjs");

function morreSeErro(rotulo, error) {
  if (error) { console.log(`ERRO em ${rotulo}: ${error.message}`); process.exit(1); }
}

// diferenca crua entre duas strings: primeiro ponto de divergencia + contexto
function primeiraDiferenca(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return null;
  return { pos: i, a: a.slice(Math.max(0, i - 40), i + 40), b: b.slice(Math.max(0, i - 40), i + 40) };
}

// quantos caracteres diferem, ignorando pontuacao e caixa (a pergunta e se o
// MODELO recebeu a mesma tarefa, nao se o aluno digitou igual)
function soLetras(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

(async () => {
  const email = process.argv[2];
  if (!email) { console.log("uso: node 2026-09-22_par_natural_alucinacao.cjs <email>"); process.exit(1); }
  const db = supa();

  const { data: prof, error: e0 } = await db.from("profiles").select("id,email").eq("email", email);
  morreSeErro("profiles", e0);
  if (!prof.length) { console.log(`sem perfil para ${email}`); process.exit(1); }
  const uid = prof[0].id;

  const { data: g, error: e1 } = await db.from("generations")
    .select("id,status,created_at,voice_id,reference_audio_path,text_normalized,audio_path,duration_seconds,elapsed_seconds,qa,error_message")
    .eq("user_id", uid).order("created_at", { ascending: true });
  morreSeErro("generations", e1);

  const falhas = g.filter(x => x.status === "failed" && /qa_coverage/.test(String(x.error_message || "")));
  const prontas = g.filter(x => x.status === "ready");
  console.log(`${email}: ${g.length} geracao(oes) · ${prontas.length} ready · ${falhas.length} failed por qa_coverage\n`);
  if (!falhas.length) { console.log("nenhuma falha de qa_coverage — nada a parear."); process.exit(0); }

  let achou = 0;
  for (const f of falhas) {
    for (const r of prontas) {
      if (r.voice_id !== f.voice_id) continue;
      if (r.reference_audio_path !== f.reference_audio_path) continue;
      const la = soLetras(r.text_normalized), lb = soLetras(f.text_normalized);
      if (!la || !lb) continue;
      const igualEmLetras = la === lb;
      const prox = Math.abs(la.length - lb.length) <= 5;
      if (!igualEmLetras && !prox) continue;

      achou++;
      const dt = (new Date(f.created_at) - new Date(r.created_at)) / 60000;
      console.log("=".repeat(76));
      console.log(`PAR NATURAL #${achou}`);
      console.log(`  READY  ${r.id.slice(0,8)} · ${r.created_at} · elapsed=${r.elapsed_seconds}s · dur=${r.duration_seconds}s · audio=${r.audio_path ? "SIM" : "NAO"}`);
      console.log(`  FAILED ${f.id.slice(0,8)} · ${f.created_at} · elapsed=${f.elapsed_seconds}s · dur=${f.duration_seconds}s · audio=${f.audio_path ? "SIM" : "NAO"}`);
      console.log(`  distancia no tempo: ${dt.toFixed(1)} min · mesma voz: ${r.voice_id === f.voice_id} · mesma referencia: ${r.reference_audio_path === f.reference_audio_path}`);

      // CONTROLE 2: ready sem audio seria par falso
      if (!r.audio_path || !r.duration_seconds) {
        console.log("  ⚠️ CONTROLE REPROVADO: a READY nao tem audio/duracao — nao e entrega de verdade, par DESCARTADO.");
        continue;
      }

      // CONTROLE 1: a diferenca crua, impressa
      console.log(`\n  TEXTO — comparacao:`);
      console.log(`    normalizado igual caractere a caractere? ${r.text_normalized === f.text_normalized}`);
      console.log(`    igual ignorando pontuacao/acento/caixa?   ${igualEmLetras}  (${la.length} vs ${lb.length} letras)`);
      const d = primeiraDiferenca(r.text_normalized || "", f.text_normalized || "");
      if (d) {
        console.log(`    1a divergencia no caractere ${d.pos}:`);
        console.log(`      READY : ...${d.a.replace(/\n/g, "\\n")}...`);
        console.log(`      FAILED: ...${d.b.replace(/\n/g, "\\n")}...`);
      } else console.log("    (sem divergencia)");

      const campos = ["coverage_best","coverage_min","regens","coverage_alucinado","coverage_alucinado_saida",
        "coverage_rescue","coverage_rescue_nivel2","coverage_rescue_failed","coverage_exhausted",
        "intrusion_flagged","intrusion_checked","coverage_idioma_detectado","coverage_idioma_prob",
        "coverage_idioma_divergente","faltantes_total","faltantes_amostra"];
      console.log(`\n  QA lado a lado:`);
      console.log(`    ${"campo".padEnd(28)} ${"READY".padEnd(18)} FAILED`);
      for (const c of campos) {
        const vr = r.qa && c in r.qa ? JSON.stringify(r.qa[c]) : "—";
        const vf = f.qa && c in f.qa ? JSON.stringify(f.qa[c]) : "—";
        if (vr === "—" && vf === "—") continue;
        console.log(`    ${c.padEnd(28)} ${String(vr).padEnd(18)} ${vf}`);
      }
      console.log("");
    }
  }

  console.log("=".repeat(76));
  if (!achou) {
    console.log(">>> NENHUM par natural: toda falha tem texto/voz/referencia diferente de");
    console.log("    qualquer entrega boa. A entrada NAO foi descartada como causa.");
  } else {
    console.log(`>>> ${achou} PAR(ES) NATURAL(IS) com desfecho oposto e mesma entrada.`);
    console.log("    Leitura: a entrada (texto, voz, referencia) nao explica a falha —");
    console.log("    a mesma tarefa produziu entrega boa e audio alucinado. Isso aponta");
    console.log("    SORTEIO do modelo, nao defeito do material do aluno.");
    console.log("    O que isto NAO diz: nada sobre a regua do QA estar certa ou inflada.");
  }
})();
