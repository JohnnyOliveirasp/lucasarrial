#!/usr/bin/env node
/**
 * backfill_tipo_manutencao_554.cjs — marca com `tipo:"manutencao"` as 21 notas
 * que o RETROFIT DA TRAVA DO HUMANO (#415) gravou em 24/09 17:48Z.
 *
 * POR QUE: o retrofit escreveu a MESMA nota em 21 cartoes vivos e ela virou a
 * ULTIMA nota de todos. A varredura da fila do Johnny (esperando_johnny.cjs)
 * le a ultima nota substantiva — sem o campo `tipo`, essas notas so sao
 * reconhecidas pela PONTE de texto (/^RETROFIT DA TRAVA DO HUMANO/i). Este
 * backfill grava o campo que deveria ter nascido junto, pra deteccao nao
 * depender de assinatura de texto pra sempre. (Incidente #554 / e693222b.)
 *
 * COMO ESCREVE (as regras do anotar_incidente.cjs, aplicadas a EDICAO):
 *   - agent_notes e ARRAY jsonb. NUNCA concatena string (21 notas ja foram
 *     destruidas assim em 21/08). Le o array, altera SO o objeto da nota do
 *     retrofit (acrescenta `tipo`), grava o array inteiro de volta.
 *   - UPDATE confere `.select()`: 1 linha afetada, senao aborta.
 *   - Depois de gravar, RELE e confere: mesmo numero de notas, a nota alvo
 *     com `tipo:"manutencao"`, e TODAS as outras notas byte-identicas.
 *   - Sem `--confirmar` so ENSAIA (mostra o que faria).
 *
 * CONTROLE POSITIVO POR LISTA (nao por contagem): os 21 cartoes medidos em
 * 24/09 estao hardcoded abaixo. Se a varredura achar um conjunto DIFERENTE
 * (faltando ou sobrando), aborta NOMEANDO a diferenca — controle que so
 * aborta no zero deixa perda parcial passar como sucesso.
 *
 * A nota do e693222b (#554) CITA a frase do retrofit no MEIO do texto e NAO
 * pode entrar: a ponte e ancorada no inicio, e o controle por lista abortaria
 * se ele aparecesse.
 */
const { supa } = require("./_comum.cjs");

const PONTE = /^\s*RETROFIT DA TRAVA DO HUMANO/i;
const JANELA_INI = "2026-09-24T17:48:00";
const JANELA_FIM = "2026-09-24T17:50:00";

// Medido em 24/09 (duas medicoes independentes: por assinatura de texto e por
// janela de timestamp — convergiram). O retrofit disse "21 cartões vivos" na
// propria nota. O recado do #554 falou em 24; o numero verdadeiro e 21.
const ESPERADOS = [
  "8b8fc4c8", "52b22304", "5c68eb33", "df008dcf", "7578c587", "09a26f8b",
  "ae6b4bd1", "d14b2f26", "f1025570", "f6d5f20c", "4ce9f365", "94843173",
  "23f8123d", "a38003a0", "fcd379d2", "db275aef", "6f1d9041", "b03f0823",
  "9382c951", "9eeb46dd", "bc85f6f2",
];

const confirmar = process.argv.includes("--confirmar");

(async () => {
  const db = supa();
  const { data, error } = await db.from("incidents").select("id,agent_notes");
  if (error) {
    console.error(`❌ CONSULTA FALHOU: ${error.message}`);
    process.exit(1);
  }

  // Acha, em cada cartao, as notas do retrofit (ponte no inicio + janela).
  const alvos = [];
  for (const r of data) {
    const notas = Array.isArray(r.agent_notes) ? r.agent_notes : null;
    if (!notas) continue;
    const idx = [];
    for (let i = 0; i < notas.length; i++) {
      const n = notas[i];
      if (!n || typeof n !== "object") continue;
      if (!PONTE.test(String(n.note || ""))) continue;
      const at = String(n.at || "");
      if (at < JANELA_INI || at > JANELA_FIM) {
        console.error(`❌ ${String(r.id).slice(0, 8)}: nota casa a ponte mas esta FORA da janela (${at}). Nao era esperado — pare e meça.`);
        process.exit(1);
      }
      idx.push(i);
    }
    if (idx.length) alvos.push({ row: r, idx });
  }

  // ---- CONTROLE POSITIVO POR LISTA: conjunto achado == conjunto esperado ----
  const achados = new Set(alvos.map((a) => String(a.row.id).slice(0, 8)));
  const faltam = ESPERADOS.filter((p) => !achados.has(p));
  const sobram = [...achados].filter((p) => !ESPERADOS.includes(p));
  if (faltam.length || sobram.length) {
    console.error("❌ CONTROLE POSITIVO FALHOU — o conjunto achado difere do medido em 24/09.");
    if (faltam.length) console.error(`   FALTAM (${faltam.length}): ${faltam.join(" ")}`);
    if (sobram.length) console.error(`   SOBRAM (${sobram.length}): ${sobram.join(" ")}`);
    console.error("   Nada foi gravado. Se um cartao ja foi corrigido/apagado de proposito,");
    console.error("   reescreva a lista ESPERADOS com o motivo, por escrito.");
    process.exit(1);
  }
  console.log(`controle positivo OK: ${achados.size}/${ESPERADOS.length} cartoes, conjunto identico ao medido`);

  let gravados = 0;
  let jaTinham = 0;
  for (const { row, idx } of alvos) {
    const curto = String(row.id).slice(0, 8);
    const pendentes = idx.filter((i) => row.agent_notes[i].tipo !== "manutencao");
    if (!pendentes.length) {
      console.log(`  ${curto}: nota(s) [${idx.join(",")}] ja com tipo=manutencao — nada a fazer (idempotente)`);
      jaTinham++;
      continue;
    }
    // Copia rasa do array + copia do objeto alvo: NUNCA mexe no resto.
    const novas = row.agent_notes.map((n, i) =>
      pendentes.includes(i) ? { ...n, tipo: "manutencao" } : n
    );
    console.log(`  ${curto}: nota(s) [${pendentes.join(",")}] de ${novas.length} ganham tipo="manutencao"`);
    if (!confirmar) continue;

    const { data: dep, error: e1 } = await db
      .from("incidents")
      .update({ agent_notes: novas })
      .eq("id", row.id)
      .select("id,agent_notes");
    if (e1) {
      console.error(`❌ ${curto}: ERRO CRU na escrita: ${e1.message} — PARANDO (${gravados} ja gravados)`);
      process.exit(1);
    }
    if (!dep || dep.length !== 1) {
      console.error(`❌ ${curto}: UPDATE afetou ${dep ? dep.length : 0} linhas, esperava 1 — PARANDO`);
      process.exit(1);
    }
    // Releitura: mesmo tamanho, alvo marcado, resto intacto.
    const relido = dep[0].agent_notes;
    if (!Array.isArray(relido) || relido.length !== row.agent_notes.length) {
      console.error(`❌ ${curto}: releitura com ${relido && relido.length} notas, esperava ${row.agent_notes.length} — CONFIRA A MAO AGORA`);
      process.exit(1);
    }
    for (let i = 0; i < relido.length; i++) {
      const esperado = pendentes.includes(i) ? { ...row.agent_notes[i], tipo: "manutencao" } : row.agent_notes[i];
      if (JSON.stringify(relido[i]) !== JSON.stringify(esperado)) {
        console.error(`❌ ${curto}: nota [${i}] diferente do esperado apos a escrita — CONFIRA A MAO AGORA`);
        process.exit(1);
      }
    }
    gravados++;
  }

  if (!confirmar) {
    console.log(`\n🔎 ENSAIO — nada gravado (${alvos.length} cartoes, ${jaTinham} ja marcados). Repita com --confirmar.`);
    return;
  }
  console.log(`\n✅ ${gravados} cartao(oes) gravado(s) e conferido(s) na releitura; ${jaTinham} ja estavam marcados.`);
})();
