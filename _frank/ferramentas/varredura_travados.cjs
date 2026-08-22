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
 * tabela, estados suspeitos, "demais" (horas), campo de nome, coluna de data.
 * ⚠️ `react_jobs` é a única em português: a data é `criado_em`.
 */
const ALVOS = [
  ["voices", ["uploading", "validating"], 0.5, "name", "created_at"],
  ["voices", ["training"], 1.5, "name", "created_at"],
  ["training_jobs", ["queued", "running"], 1.5, null, "created_at"],
  ["generations", ["pending", "processing"], 0.5, null, "created_at"],
  // `generating` entrou em 22/08 (incidente 69f0aec5): a varredura só olhava
  // `pending` e por isso ficou 28 dias cega pra 96b2f27a e 6 dias pra 1d9109a3,
  // ambas presas em `generating`. Mesma lição do b9c5a0d1 — enumerar estado
  // ruim erra por omissão.
  ["image_generations", ["pending", "generating"], 0.5, "name", "created_at"],
  ["video_clones", ["pending", "generating"], 1, null, "created_at"],
  ["react_jobs", ["fila", "baixando", "clonando", "montando"], 1, null, "criado_em"],
];

(async () => {
  const db = supa();
  const corte = new Date(Date.now() - HORAS * 3600000).toISOString();
  let total = 0;

  for (const [tabela, estados, limiteHoras, campoNome, colData] of ALVOS) {
    const cols = ["id", "user_id", "status", colData, campoNome].filter(Boolean).join(", ");
    const { data, error } = await db
      .from(tabela)
      .select(cols)
      .in("status", estados)
      .lt(colData, corte)
      .order(colData, { ascending: true })
      .limit(50);
    if (error) {
      console.log(`⚠️  ${tabela}: ${error.message}`);
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

  // ── PONTO CEGO FECHADO EM 21/08 ────────────────────────────────────────────
  // PAGANTE QUE TENTOU E NÃO TEM NENHUMA VOZ PRONTA.
  //
  // Por que esta seção existe, e por que ela NÃO lista estados ruins:
  // até hoje a classe "pagante sem voz" só era medida com `status='failed'`
  // (foi assim que nasceu o incidente 5c3f1f8b, com 3 alunos). Na ronda das
  // 02h de 21/08 a mesma pergunta feita sem filtro de status devolveu **5**:
  // os 2 que faltavam estavam em `rejected_too_short`, um estado terminal que
  // não é `failed` e que **nenhum detector olhava** — `jrfengenhariadf`
  // (100.000 créditos) e `leandro.fitoway` (97.620), parados desde julho, sem
  // nunca terem sido contatados.
  //
  // A lição é a regra desta seção: **não enumere os estados ruins, afirme o
  // estado bom.** Enumerar exige adivinhar a lista completa e vai cega no dia
  // em que alguém cria um status novo. Aqui a pergunta é sempre a mesma —
  // "esse pagante tem produto?" — e ela sobrevive a status que ainda nem
  // existem.
  //
  // Ficam de fora de propósito: quem nunca subiu voz (não é vítima, é quem não
  // tentou) e quem não tem crédito para treinar (aí o gate é o crédito, não um
  // defeito nosso). `awaiting_training` também não entra em ALVOS lá em cima:
  // é espera legítima pelo clique do aluno (`lib/onboarding/treino.ts`), e
  // jogar os 28 de hoje na varredura a entupiria de falso positivo todo dia.
  const CUSTO_TREINO = 10000; // = TRAINING_CREDIT_COST em lib/credits/config.ts
  let semVoz = 0;
  {
    const pagina = async (tabela, cols) => {
      let acc = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await db.from(tabela).select(cols).range(de, de + 999);
        if (error) throw new Error(`${tabela}: ${error.message}`);
        acc = acc.concat(data);
        if (data.length < 1000) return acc; // ⚠️ PostgREST corta em 1000: sem paginar, some gente
      }
    };
    try {
      const vozes = await pagina(
        "voices",
        "id, user_id, status, created_at, updated_at, error_message",
      );
      const perfis = await pagina(
        "profiles",
        "id, email, access_until, credits_subscription, credits_extra",
      );
      const porDono = new Map();
      for (const v of vozes) {
        if (!porDono.has(v.user_id)) porDono.set(v.user_id, []);
        porDono.get(v.user_id).push(v);
      }
      const vitimas = [];
      for (const p of perfis) {
        if (!(p.access_until && new Date(p.access_until) > new Date())) continue;
        if ((p.credits_subscription ?? 0) + (p.credits_extra ?? 0) < CUSTO_TREINO) continue;
        const minhas = porDono.get(p.id) ?? [];
        if (minhas.length === 0) continue; // nunca tentou
        if (minhas.some((v) => v.status === "ready")) continue; // tem produto
        // ⚠️ a espera se conta pela PRIMEIRA tentativa (`created_at`), não pelo
        // `updated_at`: uma varredura em lote reescreve o `updated_at` de todo
        // mundo e faz 3 semanas de espera parecerem 63h (aconteceu em 18/08).
        const maisVelha = minhas
          .slice()
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
        vitimas.push({ p, minhas, maisVelha });
      }
      vitimas.sort((a, b) => new Date(a.maisVelha.created_at) - new Date(b.maisVelha.created_at));
      if (vitimas.length) {
        console.log(`\n🚨 PAGANTE COM CRÉDITO E SEM NENHUMA VOZ PRONTA: ${vitimas.length}`);
        for (const { p, minhas, maisVelha } of vitimas) {
          const credito = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
          console.log(
            `   ${p.email} · ${credito} créditos · sem voz desde ` +
              `${String(maisVelha.created_at).slice(0, 10)} (${(idadeHoras(maisVelha.created_at) / 24).toFixed(0)} dias)` +
              ` · acesso até ${String(p.access_until).slice(0, 10)}`,
          );
          for (const v of minhas) {
            console.log(
              `      voz ${v.id.slice(0, 8)} [${v.status}] "${(v.error_message ?? "").slice(0, 80)}"`,
            );
          }
          semVoz++;
        }
      }
    } catch (e) {
      // erro cru na cara: zero silencioso aqui já custou 2 alunos esquecidos
      console.log(`⚠️  detector "pagante sem voz" FALHOU: ${e.message}`);
    }
  }
  total += semVoz;

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
