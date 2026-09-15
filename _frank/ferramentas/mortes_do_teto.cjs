#!/usr/bin/env node
/**
 * MORTES DO TETO — conta as mortes por `executionTimeout` do Vídeo Clone
 * INCLUINDO as que sumiram da tabela, e mede o tamanho do vão.
 *
 * ── POR QUE EXISTE (incidente #404, medido na ronda de 15/09 21hZ) ─────────
 * Todo instrumento do #404 até hoje contou morte lendo `video_clones`. Mas
 * `video_clones` PERDE LINHA: apagar do histórico faz DELETE duro (não há
 * coluna de soft-delete no schema — conferido em 15/09), e o débito fica órfão
 * no extrato. Isso já era conhecido e estava catalogado como inofensivo
 * ("débito órfão no extrato é NORMAL"). Não é inofensivo para CONTAR MORTE.
 *
 * O que foi medido em 15/09, janela desde 01/08:
 *   - 381 de 3.228 refs de `video_clone` (11,8%) não têm mais linha;
 *   - 18,1% dos órfãos têm estorno, contra 2,7% dos que ainda têm linha.
 * Apagar não é sorteio: quem apaga apaga o que DEU ERRADO, 6,7× mais. Então
 * contar morte por `video_clones` é contar com uma peneira que deixa passar
 * preferencialmente aquilo que a gente quer contar.
 *
 * A prova de que o estrago já aconteceu: o próprio cartão #404 registrou
 * "7 gerações em 14/09". Em 15/09 a mesma consulta na mesma tabela devolve 5 —
 * as duas do `welrisson` viraram órfãs no meio do caminho. O número do cartão
 * não é mais reprodutível a partir da tabela de onde ele saiu. A evidência
 * apodrece sozinha, e em silêncio.
 *
 * ── COMO ELE ACHA O QUE NÃO TEM MAIS LINHA ────────────────────────────────
 * Pelo dinheiro, que não é apagado: cobrança (`ref_type='video_clone'`) casada
 * com estorno (`ref_type='video_clone_refund'`) e SEM linha em `video_clones`.
 * O atraso entre cobrar e estornar é o relógio do job.
 *
 * ⚠️ Casamento por `ref_type`, NUNCA por `kind`: todo estorno grava
 * `kind='extra_purchase'`. Filtrar por `kind` faz o estornado parecer não
 * estornado — foi o que quase pagou 13 alunos duas vezes em 20/08.
 *
 * ── CONTROLE POSITIVO, E POR QUE ABORTA ───────────────────────────────────
 * O atraso do estorno só serve de relógio se ele de fato acompanhar o job. Nas
 * 9 mortes VISÍVEIS de 14–15/09 isso foi medido: `atraso − elapsed_seconds`
 * ficou entre **+6,3s e +117,9s** — o estorno cai logo depois da morte, nunca
 * antes, nunca muito depois.
 *
 * Toda rodada revalida isso nas mortes visíveis da janela. Se a relação
 * quebrar (estorno ANTES do fim, ou muito depois), o relógio não é mais
 * relógio e a ferramenta ABORTA em vez de devolver número. Instrumento cego
 * devolvendo zero foi o que já fez a casa relatar "pagante sem acesso: 0".
 *
 * ── O QUE ELE NÃO FAZ ─────────────────────────────────────────────────────
 * Não escreve, não estorna, não manda e-mail, não fecha cartão. Só lê.
 *
 * E não jura que órfão estornado É timeout: sem a linha, ninguém pode. Ele
 * separa em TRÊS baldes e nunca soma os dois primeiros num número só sem
 * dizer:
 *   CONFIRMADA  — linha existe, status failed, mensagem de timeout;
 *   COMPATÍVEL  — sem linha, estornada, relógio no patamar de timeout;
 *   NÃO CLASSIFICADA — sem linha, estornada, relógio curto (classe do
 *                      apagão de 05/09: 1s a 64s, que é crash, não teto).
 * O piso que separa os dois últimos sai da MENOR morte visível da janela, não
 * de constante escolhida a dedo. Sem morte visível na janela não há piso
 * medido: ele cai para o piso histórico e DIZ que caiu.
 *
 *   node _frank/ferramentas/mortes_do_teto.cjs            # desde 14/09
 *   node _frank/ferramentas/mortes_do_teto.cjs 2026-09-01 # desde outra data
 */
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const PROJECT = "yizerthyrgrajivlotcw";

// Piso histórico, usado SÓ quando a janela não tem morte visível pra medir.
// Vem da separação medida em 15/09: crash morre entre 1s e 64s; a menor morte
// de teto conhecida levou 1.654,7s. Não existe nada no meio.
const PISO_HISTORICO = 1200;

async function sql(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente");
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  const txt = await r.text();
  if (!r.ok) throw new Error(`SQL falhou: ${txt}`);
  return JSON.parse(txt);
}

const fmt = (s) => {
  const n = Number(s);
  return `${Math.floor(n / 60)}min${String(Math.round(n % 60)).padStart(2, "0")}s`;
};

(async () => {
  const desde = process.argv[2] || "2026-09-14";
  console.log(`\n🎯 MORTES DO TETO — Vídeo Clone, desde ${desde}\n${"=".repeat(70)}`);

  // O join roda no servidor de propósito: a consulta REST corta em 1000 linhas
  // EM SILÊNCIO, e este cruzamento passa de 3.000 refs.
  const visiveis = await sql(`
    with c as (select ref_id, min(created_at) as cobrado from credit_transactions where ref_type='video_clone' group by ref_id),
         e as (select ref_id, min(created_at) as estornado from credit_transactions where ref_type='video_clone_refund' group by ref_id)
    select vc.id::text as id, p.email, vc.created_at, vc.tier, vc.duration_seconds,
           vc.elapsed_seconds, vc.credits_cost,
           extract(epoch from (e.estornado - c.cobrado)) as atraso,
           (e.ref_id is not null) as estornado
    from video_clones vc
    left join profiles p on p.id = vc.user_id
    left join c on c.ref_id = vc.id::text
    left join e on e.ref_id = vc.id::text
    where vc.status='failed' and vc.error_message like '%demorou demais%'
      and vc.created_at >= '${desde}'
    order by vc.created_at`);

  // ── CONTROLE POSITIVO ───────────────────────────────────────────────────
  const comAtraso = visiveis.filter((v) => v.atraso != null && v.elapsed_seconds != null);
  if (comAtraso.length) {
    const difs = comAtraso.map((v) => Number(v.atraso) - Number(v.elapsed_seconds));
    const min = Math.min(...difs), max = Math.max(...difs);
    console.log(`\n🔬 Controle positivo: ${comAtraso.length} morte(s) visível(is) com estorno.`);
    console.log(`   atraso − elapsed: ${min.toFixed(1)}s a ${max.toFixed(1)}s (esperado: +0s a +600s)`);
    if (min < 0 || max > 600) {
      console.error(`\n❌ ABORTADO: o estorno deixou de acompanhar o fim do job.`);
      console.error(`   O atraso não é mais relógio confiável, então qualquer número`);
      console.error(`   sobre os órfãos seria invenção. Reveja o caminho de estorno.`);
      process.exit(1);
    }
    console.log(`   ✅ relógio válido.`);
  } else {
    console.log(`\n⚠️  Nenhuma morte visível com estorno na janela: controle positivo NÃO rodou.`);
  }

  const pisoMedido = comAtraso.length
    ? Math.min(...comAtraso.map((v) => Number(v.elapsed_seconds)))
    : null;
  const piso = pisoMedido ?? PISO_HISTORICO;
  console.log(
    pisoMedido
      ? `   piso de classificação: ${piso.toFixed(1)}s (menor morte visível da janela)`
      : `   piso de classificação: ${piso}s (PISO HISTÓRICO — a janela não tem morte visível pra medir)`,
  );

  // ── ÓRFÃOS ──────────────────────────────────────────────────────────────
  const orfaos = await sql(`
    with c as (select ref_id, min(created_at) as cobrado, min(user_id::text) as uid, max(abs(amount)) as cr
               from credit_transactions where ref_type='video_clone' group by ref_id),
         e as (select ref_id, min(created_at) as estornado from credit_transactions where ref_type='video_clone_refund' group by ref_id)
    select c.ref_id, c.cobrado, c.cr, p.email,
           extract(epoch from (e.estornado - c.cobrado)) as atraso
    from c join e on e.ref_id = c.ref_id
    left join video_clones vc on vc.id::text = c.ref_id
    left join profiles p on p.id::text = c.uid
    where vc.id is null and c.cobrado >= '${desde}'
    order by c.cobrado`);

  const compat = orfaos.filter((o) => Number(o.atraso) >= piso);
  const naoClass = orfaos.filter((o) => Number(o.atraso) < piso);

  console.log(`\n🔴 CONFIRMADAS (linha existe, status failed, mensagem de timeout): ${visiveis.length}`);
  for (const v of visiveis) {
    console.log(`   ${String(v.created_at).slice(0, 16)} · ${v.email ?? "?"} · ${v.tier} · áudio ${v.duration_seconds}s · morreu ${fmt(v.elapsed_seconds)} · ${v.credits_cost} cr${v.estornado ? " · estornado" : " · ⚠️ SEM ESTORNO"}`);
  }

  console.log(`\n🟠 COMPATÍVEIS COM TIMEOUT (linha apagada; relógio ≥ piso): ${compat.length}`);
  for (const o of compat) {
    console.log(`   ${String(o.cobrado).slice(0, 16)} · ${o.email ?? "?"} · esperou ${fmt(o.atraso)} · ${o.cr} cr · estornado`);
  }
  if (compat.length) {
    console.log(`   ⚠️  "compatível" não é "confirmada": sem a linha ninguém prova.`);
    console.log(`      Mas o aluno esperou e não recebeu — pra ELE a diferença não existe.`);
  }

  if (naoClass.length) {
    console.log(`\n⬜ NÃO CLASSIFICADAS (linha apagada; relógio < piso — provável crash): ${naoClass.length}`);
    for (const o of naoClass) {
      console.log(`   ${String(o.cobrado).slice(0, 16)} · ${o.email ?? "?"} · esperou ${fmt(o.atraso)} · ${o.cr} cr`);
    }
  }

  // ── O TAMANHO DO VÃO ────────────────────────────────────────────────────
  const vao = await sql(`
    with c as (select distinct ref_id from credit_transactions where ref_type='video_clone' and created_at >= '${desde}'),
         e as (select distinct ref_id from credit_transactions where ref_type='video_clone_refund')
    select count(*) filter (where vc.id is null) as orfao,
           count(*) as total,
           count(*) filter (where vc.id is null and e.ref_id is not null) as orfao_estornado,
           count(*) filter (where vc.id is not null and e.ref_id is not null) as comlinha_estornado,
           count(*) filter (where vc.id is not null) as comlinha
    from c left join video_clones vc on vc.id::text = c.ref_id
           left join e on e.ref_id = c.ref_id`);
  const v = vao[0];
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : "—");
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📉 O VÃO: ${v.orfao} de ${v.total} refs sem linha (${pct(v.orfao, v.total)}%).`);
  console.log(`   estorno entre os SEM linha: ${pct(v.orfao_estornado, v.orfao)}%  ·  entre os COM linha: ${pct(v.comlinha_estornado, v.comlinha)}%`);
  console.log(`   Se o primeiro for muito maior que o segundo, apagar está`);
  console.log(`   correlacionado a ter dado errado, e contar morte só por`);
  console.log(`   video_clones subestima — que é a razão desta ferramenta.`);

  const total = visiveis.length + compat.length;
  console.log(`\n🧮 PLACAR: ${visiveis.length} confirmada(s) + ${compat.length} compatível(is) = até ${total} morte(s) desde ${desde}.`);
  console.log(`   Lendo só video_clones você teria visto ${visiveis.length}.\n`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
