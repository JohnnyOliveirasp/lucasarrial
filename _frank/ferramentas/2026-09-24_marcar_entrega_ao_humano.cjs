/**
 * RETROFIT DA TRAVA DO HUMANO (#415) — põe a marca nos cartões VIVOS que foram
 * entregues ao time ANTES do PR #295.
 *
 *   node _frank/ferramentas/2026-09-24_marcar_entrega_ao_humano.cjs              # ENSAIO
 *   node _frank/ferramentas/2026-09-24_marcar_entrega_ao_humano.cjs --confirmar  # grava
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O QUE ISTO É, E O QUE NÃO É
 *
 * NÃO é decisão nova. A casa já decidiu e já mergeou (PR #295, 15/09 22:30Z):
 * caso que está na mão de gente → a Fast cala. Cartão entregue DEPOIS do merge
 * nasce com a marca e é calado automaticamente, sem ninguém escalar nada. Os
 * 21 cartões vivos daqui ficaram de fora por ACIDENTE DE DATA, não por uma
 * política diferente. Isto aqui só faz a produção corresponder à decisão que
 * já foi tomada — é execução, não deliberação.
 *
 * Medido em 24/09 (`2026-09-24_trava_do_humano_sem_marca.cjs`):
 *   46 cartões vivos já entregues ao time
 *   25 COM a marca  → a Fast cala
 *   21 SEM a marca  → a Fast ainda responde por cima de gente (20 alunos)
 *
 * E ele MORDE, com controle: desde o merge, `origem='fast-resposta'` saiu
 * 2x para aluno DESCOBERTO (Ellen #348 em 20/09, grupoavip #413 em 23/09) e
 * 0x para aluno COBERTO, apesar de 22 cartas terem ido ao grupo coberto na
 * mesma janela. O grupo coberto é o controle e ele fecha em zero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE CALAR NÃO ENGOLE O ALUNO (a premissa que eu conferi antes de gravar)
 *
 * Calar seria o defeito mais caro deste repositório (#95: resposta de aluno
 * caindo no vazio) se a mensagem sumisse. Ela não some: `anotarQueOAlunoFalou`
 * (humano-io.ts) grava o que ele escreveu como nota E dá
 * `last_seen_at: agora` — conferido no conteúdo da `origin/main`, linha
 * `.update({ last_seen_at: agora, agent_notes: [...atuais, nota] })`. O cartão
 * SOBE na fila em vez de envelhecer. E a trava se solta sozinha quando alguém
 * fecha o chamado, porque `travadoPorHumano` exige `casoAtivo`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COMO GRAVA, e por que deste jeito
 *
 * Põe `tipo` na NOTA DE ENTREGA MAIS RECENTE do cartão — é ela que representa
 * a entrega viva, e assim `at`/`by`/`note` originais ficam intactos (a marca é
 * exatamente o que `notaEntregueAoHumano` teria posto se o código de hoje
 * existisse naquele dia). E ANEXA uma nota curta de auditoria, porque marca
 * posta à mão sem rastro é história reescrita em silêncio.
 *
 * ARMADILHA (03_ROTINA): update do Supabase por id inexistente afeta 0 linhas
 * EM SILÊNCIO. Todo update aqui volta com `.select()` e o script CONTA as
 * linhas afetadas; no fim ele RELÊ do banco e só declara sucesso pelo que a
 * releitura mostrar. Ensaio não é entrega.
 */
const { supa: _supaFn } = require("./_comum.cjs");
const supa = _supaFn();

const CONFIRMAR = process.argv.includes("--confirmar");
const TIPO = "entregue_humano";
const TEXTO_DA_ENTREGA = "time avisado no grupo do whatsapp";
const ENCERRADOS = new Set(["fixed", "ignored"]);
const MERGE = new Date("2026-09-15T22:30:26Z");

const NOTA_AUDITORIA = [
  "RETROFIT DA TRAVA DO HUMANO (#415) — marca posta à mão pela ronda de 24/09.",
  "",
  "O QUE MUDOU NESTE CARTÃO: a nota de entrega ao time ganhou `tipo=\"entregue_humano\"`.",
  "NADA MAIS foi tocado — nem status, nem crédito, nem acesso, nem texto de nota.",
  "",
  "POR QUÊ: o PR #295 ('a Fast cala quando o caso já está com gente') está em",
  "produção desde 15/09 22:30Z, mas casa por essa marca, e a marca só nasce em",
  "entrega feita DEPOIS do merge. Este cartão foi entregue ANTES, então a Fast",
  "continuava respondendo automaticamente por cima de quem está com o caso —",
  "foi o que produziu as 9 mensagens da tuquinha36 e o telefone inventado (#414).",
  "Medido em 24/09: 21 cartões vivos nesta condição, 20 alunos nomeados.",
  "",
  "EFEITO PRÁTICO: se este aluno escrever de novo, a Fast NÃO responde sozinha —",
  "ela grava aqui o que ele disse e sobe o cartão na fila (last_seen_at). Quem",
  "está com o caso responde pelo suporte@ e FECHA o chamado; fechar destrava a",
  "Fast automaticamente (a trava exige caso ativo). Não há mudo permanente.",
].join("\n");

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ FALHOU (${rotulo}): ${error.message}`);
    process.exit(1);
  }
}

const notasDe = (i) => (Array.isArray(i.agent_notes) ? i.agent_notes : []);
const ehEntrega = (n) =>
  String((n && n.note) || "").toLowerCase().includes(TEXTO_DA_ENTREGA);
const temMarca = (i) => notasDe(i).some((n) => n && n.tipo === TIPO);
const ativo = (i) => !ENCERRADOS.has(String(i.status || "").trim());

async function lerTudo() {
  let todos = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supa
      .from("incidents")
      .select("id,numero,created_at,status,title,affected_emails,agent_notes")
      .range(p * 500, p * 500 + 499);
    exigir(`leitura página ${p}`, error);
    todos = todos.concat(data);
    if (data.length < 500) break;
  }
  return todos;
}

(async () => {
  const todos = await lerTudo();
  console.log(`acervo: ${todos.length} incidentes\n`);

  // CONTROLE POSITIVO: o conserto está no ar, então tem que haver cartão já
  // marcado pelo próprio código. Se não houver, eu estou lendo a chave errada
  // e gravar seria espalhar o meu erro por 21 cartões.
  const jaMarcados = todos.filter(temMarca);
  if (jaMarcados.length === 0) {
    console.error("❌ CONTROLE POSITIVO FALHOU: nenhum cartão tem a marca hoje.");
    console.error("   Ou a chave está errada, ou `entregarAoTime` não grava.");
    console.error("   NÃO vou gravar nada — seria espalhar um erro meu.");
    process.exit(2);
  }
  console.log(`✔ controle positivo: ${jaMarcados.length} cartão(ões) já marcados pelo próprio código`);

  const alvos = todos.filter((i) => ativo(i) && notasDe(i).some(ehEntrega) && !temMarca(i));
  alvos.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  console.log(`\nALVOS: ${alvos.length} cartão(ões) vivo(s), entregue(s) ao time, SEM marca`);
  for (const i of alvos) {
    const d = ((Date.now() - new Date(i.created_at)) / 86400000).toFixed(1);
    console.log(
      `   #${String(i.numero).padEnd(4)} ${i.id.slice(0, 8)} · ${d.padStart(5)}d · ${String(i.status).padEnd(16)} · ${(i.affected_emails || []).join(",").slice(0, 36)}`,
    );
  }

  if (!CONFIRMAR) {
    console.log(`\n🔎 ENSAIO. Nada foi gravado. Rode com --confirmar para valer.`);
    return;
  }

  console.log(`\n✍️  GRAVANDO…`);
  let afetadas = 0;
  const falhas = [];
  for (const inc of alvos) {
    const notas = notasDe(inc).slice();
    // A entrega MAIS RECENTE é a que representa a entrega viva.
    let idx = -1;
    for (let k = 0; k < notas.length; k++) if (ehEntrega(notas[k])) idx = k;
    if (idx < 0) {
      falhas.push({ numero: inc.numero, motivo: "nota de entrega sumiu entre a leitura e a escrita" });
      continue;
    }
    notas[idx] = { ...notas[idx], tipo: TIPO };
    notas.push({ at: new Date().toISOString(), by: "frank", note: NOTA_AUDITORIA });

    const { data, error } = await supa
      .from("incidents")
      .update({ agent_notes: notas })
      .eq("id", inc.id)
      .select("id");
    if (error) {
      falhas.push({ numero: inc.numero, motivo: error.message });
      continue;
    }
    // Update por id inexistente afeta 0 linhas EM SILÊNCIO — por isso conto.
    if (!data || data.length !== 1) {
      falhas.push({ numero: inc.numero, motivo: `update afetou ${data ? data.length : 0} linha(s)` });
      continue;
    }
    afetadas++;
  }
  console.log(`   ${afetadas} update(s) com 1 linha afetada · ${falhas.length} falha(s)`);
  for (const f of falhas) console.log(`   ⚠ #${f.numero}: ${f.motivo}`);

  // ── RELEITURA INDEPENDENTE: só o banco decide se deu certo ──────────────
  console.log(`\n🔁 RELENDO DO BANCO (o que o script planejou não vale; vale o que gravou)…`);
  const depois = await lerTudo();
  const aindaSem = depois.filter((i) => ativo(i) && notasDe(i).some(ehEntrega) && !temMarca(i));
  const idsAlvo = new Set(alvos.map((a) => a.id));
  const confirmados = depois.filter((i) => idsAlvo.has(i.id) && temMarca(i));

  console.log(`   alvos confirmados COM a marca na releitura: ${confirmados.length}/${alvos.length}`);
  console.log(`   cartões vivos entregues AINDA sem marca:     ${aindaSem.length}`);
  for (const i of aindaSem) console.log(`      ⚠ #${i.numero} ${i.id.slice(0, 8)} (${i.status})`);

  if (confirmados.length === alvos.length && aindaSem.length === 0) {
    console.log(`\n✅ FECHADO: os ${alvos.length} cartões estão cobertos pela trava, conferido na releitura.`);
  } else {
    console.log(`\n⚠️  NÃO declare pronto: a releitura não bate com o planejado.`);
    process.exitCode = 3;
  }
})();
