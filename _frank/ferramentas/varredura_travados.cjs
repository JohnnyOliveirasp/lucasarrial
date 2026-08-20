/**
 * VARREDURA DIÁRIA — acha tudo que está parado num estado intermediário,
 * do mais antigo pro mais novo. Só leitura: não muda nada.
 *
 *   node _frank/ferramentas/varredura_travados.cjs
 *   node _frank/ferramentas/varredura_travados.cjs --horas 2
 */
const { supa, listar, BUCKETS, minutos, idadeHoras } = require("./_comum.cjs");

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? Number(process.argv[i + 1]) : padrao;
};
const HORAS = arg("horas", 1);

/**
 * tabela, estados suspeitos, "demais" (horas), campo de nome, coluna de data,
 * modo (opcional): "aviso" = estado LEGÍTIMO de espera — lista à parte
 * ("AGUARDANDO AÇÃO DO ALUNO"), NÃO conta como preso; só o recorte
 * pagante parado (regra 3 do _frank/03_ROTINA.md) ganha 🚩 e conta.
 * ⚠️ `react_jobs` é a única em português: a data é `criado_em`.
 */
const ALVOS = [
  ["voices", ["uploading", "validating"], 0.5, "name", "created_at"],
  ["voices", ["training"], 1.5, "name", "created_at"],
  // awaiting_training = esperando o aluno acionar o treino (crédito é o único
  // gate — treino.ts:10 / start-training/route.ts:93). Voz de quem não pagou
  // fica aqui DE PROPÓSITO; só é problema se for pagante com crédito, áudio
  // no R2 e ZERO voz ready. Antes de 20/08 esse estado era invisível (27
  // vozes, algumas há 36 dias, e a varredura dizia "0 presos").
  ["voices", ["awaiting_training"], 24, "name", "created_at", "aviso"],
  ["training_jobs", ["queued", "running"], 1.5, null, "created_at"],
  ["generations", ["pending", "processing"], 0.5, null, "created_at"],
  ["image_generations", ["pending"], 0.5, "name", "created_at"],
  ["video_clones", ["pending", "generating"], 1, null, "created_at"],
  ["react_jobs", ["fila", "baixando", "clonando", "montando"], 1, null, "criado_em"],
];

/** Mesmo custo do app (frontend/src/lib/credits/config.ts TRAINING_CREDIT_COST). */
const CUSTO_TREINO = 10_000;

(async () => {
  const db = supa();
  const corte = new Date(Date.now() - HORAS * 3600000).toISOString();
  let total = 0;

  for (const [tabela, estados, limiteHoras, campoNome, colData, modo] of ALVOS) {
    const cols = ["id", "user_id", "status", colData, campoNome].filter(Boolean).join(", ");
    const { data, error, count } = await db
      .from(tabela)
      .select(cols, { count: "exact" })
      .in("status", estados)
      .lt(colData, corte)
      .order(colData, { ascending: true })
      .limit(modo === "aviso" ? 200 : 50);
    if (error) {
      console.log(`⚠️  ${tabela}: ${error.message}`);
      continue;
    }

    // Estado de espera legítima: seção informativa, sem alarme falso.
    if (modo === "aviso") {
      const velhos = (data ?? []).filter((r) => idadeHoras(r[colData]) > limiteHoras);
      if (velhos.length === 0) continue;
      console.log(
        `\n🕗 AGUARDANDO AÇÃO DO ALUNO — ${tabela}: ${count ?? (data ?? []).length} em ` +
          `[${estados.join("/")}], listando ${velhos.length} com mais de ${limiteHoras}h ` +
          `(espera legítima: o treino só dispara quando o aluno aciona E tem crédito)`,
      );
      if ((count ?? 0) > (data ?? []).length) {
        console.log(`   ⚠️ listagem cortada: ${count} no total, mostrando ${(data ?? []).length}`);
      }
      let suspeitos = 0;
      for (const r of velhos) {
        const { data: p } = await db
          .from("profiles")
          .select("email, access_until, credits_subscription, credits_extra")
          .eq("id", r.user_id)
          .maybeSingle();
        const ativo = p?.access_until && new Date(p.access_until) > new Date();
        const saldo = (p?.credits_subscription ?? 0) + (p?.credits_extra ?? 0);
        // Pagante parado (regra 3): acesso ativo + crédito pro treino +
        // áudio no R2 + NENHUMA voz ready. Esse merece 🚩 e conta como preso.
        let flag = "";
        if (ativo && saldo >= CUSTO_TREINO) {
          const { count: prontas, error: eReady } = await db
            .from("voices")
            .select("id", { count: "exact", head: true })
            .eq("user_id", r.user_id)
            .eq("status", "ready");
          if (!eReady && (prontas ?? 0) === 0) {
            const audio = await listar(BUCKETS.vozes(), `${r.user_id}/${r.id}/`);
            if (audio.length > 0) {
              flag = " 🚩 PAGANTE PARADO — acesso ativo, crédito e áudio no R2, zero voz ready";
              suspeitos++;
              total++;
            }
          }
        }
        console.log(
          `   ${String(r[colData]).slice(0, 16)} (${(idadeHoras(r[colData]) / 24).toFixed(1)}d) ` +
            `${p?.email ?? r.user_id} ${r[campoNome] ? `"${r[campoNome]}"` : ""}` +
            (ativo ? " · ATIVO" : "") + ` · saldo ${saldo}` + flag,
        );
      }
      console.log(
        suspeitos === 0
          ? `   ✔ nenhum pagante parado nesse grupo (todos sem acesso/sem crédito, ou já têm voz ready)`
          : `   🚩 ${suspeitos} pagante(s) parado(s) de verdade — investigue (regra 3 do 03_ROTINA)`,
      );
      continue;
    }

    const presos = (data ?? []).filter((r) => idadeHoras(r[colData]) > limiteHoras);
    if (presos.length === 0) continue;

    console.log(`\n🔴 ${tabela} — ${presos.length} parado(s) [${estados.join("/")}]`);
    for (const r of presos.slice(0, 15)) {
      const { data: p } = await db
        .from("profiles")
        .select("email, access_until")
        .eq("id", r.user_id)
        .maybeSingle();
      const pagante = p?.access_until && new Date(p.access_until) > new Date();
      console.log(
        `   ${String(r[colData]).slice(0, 16)} (${idadeHoras(r[colData]).toFixed(1)}h) ` +
          `${p?.email ?? r.user_id} ${r[campoNome] ? `"${r[campoNome]}"` : ""} [${r.status}]` +
          (pagante ? " · PAGANTE" : ""),
      );
      total++;
    }
    if (presos.length > 15) console.log(`   … e mais ${presos.length - 15}`);
  }

  // Vozes paradas COM áudio no R2 = resgate na certa (o sweep resolve; se
  // aparecer aqui é porque o sweep não está rodando).
  const { data: uploads } = await db
    .from("voices")
    .select("id, user_id, name, created_at")
    .eq("status", "uploading")
    .lt("created_at", new Date(Date.now() - 1800000).toISOString())
    .limit(20);
  let comAudio = 0;
  for (const v of uploads ?? []) {
    const arquivos = await listar(BUCKETS.vozes(), `${v.user_id}/${v.id}/`);
    if (arquivos.length > 0) comAudio++;
  }
  if (comAudio > 0) {
    console.log(
      `\n🚨 ${comAudio} voz(es) com ÁUDIO no R2 esperando resgate — ` +
        `o sweep de 5min devia ter pego. Rode o sweep e investigue (playbook A).`,
    );
  }

  // Incidentes abertos
  const { data: inc } = await db
    .from("incidents")
    .select("status, title, occurrences, last_seen_at")
    .in("status", ["open", "investigating"])
    .order("last_seen_at", { ascending: false })
    .limit(15);
  if (inc?.length) {
    console.log(`\n📋 INCIDENTES ABERTOS: ${inc.length}`);
    for (const i of inc) {
      console.log(`   [${i.status}] ${i.title} (${i.occurrences}x, ${i.last_seen_at.slice(0, 16)})`);
    }
  }

  console.log(
    total === 0 && comAudio === 0 && !inc?.length
      ? "\n✅ Nada preso, nada aberto."
      : `\n➡️  ${total} item(ns) preso(s). Vá pelo mais antigo — playbooks em _frank/04.`,
  );
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
