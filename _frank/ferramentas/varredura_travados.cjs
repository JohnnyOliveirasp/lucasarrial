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
    // `voice_id` só existe em training_jobs, e é ele que diz se o aluno já
    // recebeu o produto apesar do job não ter fechado (ver "linha obsoleta").
    const cols = ["id", "user_id", "status", colData, campoNome]
      .concat(tabela === "training_jobs" ? ["voice_id"] : [])
      .filter(Boolean)
      .join(", ");
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
    let presos = (data ?? []).filter((r) => idadeHoras(r[colData]) > limiteHoras);

    /**
     * LINHA OBSOLETA ≠ ALUNO PARADO (medido em 25/08, caso draellenca).
     *
     * O job `ebf5cc56` ficou `queued` pra sempre, mas a voz dele (`f4b9b0f2`,
     * "Ellen 3") está `ready` desde 25/08 03:20 e a aluna vinha gerando áudio
     * no mesmo dia. A varredura gritava "13.3h · PAGANTE" pra quem já tinha o
     * produto na mão: o job é escrituração que não fechou, não gente esperando.
     *
     * Por que isso importa e não é firula: alarme vermelho falso repetido todo
     * dia é como a ronda seguinte aprende a ignorar a linha vermelha — e o dia
     * em que houver um treino REALMENTE pendurado ele chega no meio do ruído.
     *
     * Não sumir com a linha, porém: ela vai pra um bloco à parte. Zero
     * silencioso é o acidente de 18/08, e a regra da casa é que o que sai da
     * conta apareça dizendo por que saiu.
     */
    const obsoletos = [];
    if (tabela === "training_jobs" && presos.length) {
      const vivos = [];
      for (const r of presos) {
        const { data: v } = await db
          .from("voices")
          .select("id, status")
          .eq("id", r.voice_id)
          .maybeSingle();
        if (v && v.status === "ready") obsoletos.push({ job: r, voz: v });
        else vivos.push(r);
      }
      presos = vivos;
    }
    if (obsoletos.length) {
      console.log(
        `\n🧾 training_jobs — ${obsoletos.length} linha(s) obsoleta(s): ` +
          `job nunca saiu de queued/running, mas a VOZ já está ready ` +
          `(escrituração pendente, ninguém esperando)`,
      );
      for (const o of obsoletos) {
        console.log(`   job ${o.job.id.slice(0, 8)} → voz ${o.voz.id.slice(0, 8)} [ready]`);
      }
    }

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
        // ⚠️ ESTE FILTRO É `access_until` VIVO — e acesso vivo NÃO é pagamento.
        // Trial R$0 tem acesso vivo igual a assinante. Enquanto a linha 206
        // imprimia a palavra "PAGANTE", 4 dos 5 nomes da lista de 25/08 NUNCA
        // tinham pago (incidente 138): ycarlosk, definidameta, oliver_humberto
        // e leandro.fitoway — este último com uma cobrança de R$97 **OVERDUE**,
        // que é a mais traiçoeira, porque "existe R$97" lê como assinante.
        // É o mesmo modo de falha que fez o índice de ordens SUSPENDER a
        // `2026-08-18_migration_ja_pagou.md`, só que na direção oposta: lá a
        // coluna dizia "nunca pagou" pra todo mundo e negaria crédito a quem
        // pagou; aqui a lista dizia "pagante" pra quem nunca pagou e daria
        // proteção de assinante a trial R$0. A REGRA FINAL DE CRÉDITO separa
        // exatamente essas duas populações.
        // Quem for DECIDIR CRÉDITO a partir desta lista tem que cruzar com
        // `pagou_de_verdade.cjs` (Hotmart viva: value > 0 E COMPLETE/APPROVED —
        // OVERDUE não é pagamento). O rótulo aqui diz só o que o filtro mede.
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
        console.log(
          `\n🚨 ACESSO VIVO, COM CRÉDITO E SEM NENHUMA VOZ PRONTA: ${vitimas.length}` +
            `\n   (acesso vivo ≠ pagou — inclui trial R$0. Antes de decidir crédito,` +
            ` cruze com pagou_de_verdade.cjs — incidente 138)`,
        );
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
  //
  // ⚠️ Dois zeros silenciosos moravam aqui (medido em 23/08):
  //  1. `.limit(15)` cortava a lista E o cabeçalho imprimia `inc.length`, ou
  //     seja, "INCIDENTES ABERTOS: 15" com 20 abertos no banco. O número que
  //     eu levava pro relatório era o teto do limit, não a realidade — e o
  //     relatório noturno é justamente o lugar onde silêncio vira "saúde".
  //  2. O `error` da consulta era descartado. Consulta que erra volta com
  //     `data: null`, o `if (inc?.length)` não entra, e o script fecha com
  //     "✅ Nada preso, nada aberto" — o mesmo acidente de 18/08.
  // Agora: contagem exata separada da lista, e erro na cara.
  const {
    data: inc,
    error: errInc,
    count: totalInc,
  } = await db
    .from("incidents")
    .select("status, title, occurrences, last_seen_at", { count: "exact" })
    .in("status", ["open", "investigating"])
    .order("last_seen_at", { ascending: false })
    .limit(50);
  if (errInc) {
    // nunca deixe isso virar zero: zero aqui é indistinguível de saúde
    console.log(`\n⚠️  consulta de INCIDENTES FALHOU: ${errInc.message}`);
    console.log("    NÃO trate esta rodada como limpa — o número de abertos é DESCONHECIDO.");
  } else if (totalInc) {
    const mostrados = inc?.length ?? 0;
    const corte = mostrados < totalInc ? ` (mostrando ${mostrados})` : "";
    console.log(`\n📋 INCIDENTES ABERTOS: ${totalInc}${corte}`);
    for (const i of inc ?? []) {
      console.log(`   [${i.status}] ${i.title} (${i.occurrences}x, ${i.last_seen_at.slice(0, 16)})`);
    }
  }

  /**
   * `aguardando_aluno` NÃO é "fechado", e some do filtro de abertos.
   *
   * Objeção do Vigia em 25/08 14h, e ela estava certa: o placar dizia "5
   * abertos" enquanto havia 8 com gente esperando. Os 3 invisíveis eram o
   * `65` (3 pagantes, 363h), o `120` (Sandra, pré-venda) e o `124`.
   *
   * O status é honesto — a bola está com o aluno, não comigo — mas honesto
   * não pode significar INVISÍVEL: aluno que não responde em uma semana
   * precisa de segunda tentativa, e ninguém dá segunda tentativa no que não
   * aparece na varredura do dia. Vai em bloco PRÓPRIO, separado dos abertos,
   * pra não inflar o número de "abertos" (que é o que eu tenho que atacar)
   * nem sumir com quem está esperando.
   */
  // ⚠️ `incidents` NÃO tem `updated_at` (conferido no information_schema em
  // 25/08 — a 1ª versão desta consulta pediu a coluna e quebrou). O que
  // interessaria aqui é "desde quando o aluno não responde", e isso não é
  // coluna nenhuma: mora nas `agent_notes`. Então mostro a IDADE do chamado,
  // que existe, e chamo pelo nome certo — "aberto há", não "parado há".
  const { data: espera, error: errEsp, count: totalEsp } = await db
    .from("incidents")
    .select("numero, title, affected_emails, created_at", { count: "exact" })
    .eq("status", "aguardando_aluno")
    .order("created_at", { ascending: true })
    .limit(50);
  if (errEsp) {
    console.log(`\n⚠️  consulta de AGUARDANDO ALUNO FALHOU: ${errEsp.message}`);
    console.log("    NÃO trate esta rodada como limpa — pode haver aluno esperando sem aparecer.");
  } else if (totalEsp) {
    console.log(`\n⏳ AGUARDANDO ALUNO: ${totalEsp} (não é fechado — a bola está com ele)`);
    for (const i of espera ?? []) {
      const dias = Math.floor(
        (Date.now() - new Date(i.created_at).getTime()) / 86400000,
      );
      const quem = (i.affected_emails ?? []).length;
      console.log(
        `   #${i.numero} aberto há ${dias}d · ${quem} aluno(s) · ${i.title.slice(0, 80)}`,
      );
    }
    console.log("   ⚠️  parado há 7d+ sem resposta pede SEGUNDA tentativa, não silêncio.");
  }

  /**
   * FECHADO EM CIMA DO PRÓPRIO DISPARO, e ninguém humano voltou (incidente #153).
   *
   * O e-mail do aluno re-dispara o chamado e `entregarAoTime` o re-fecha 0,8s a
   * 1,6s depois, assinando "carol (entregue ao time)". O contador de ocorrências
   * sobe, o chamado nunca fica aberto, e quem olha a fila vê ZERO — enquanto o
   * aluno está escrevendo. Medido no #153: 6 casos; no #154 (Marlon) o aluno
   * abriu CONTESTAÇÃO NO CARTÃO de R$97 22 minutos depois do fechamento, sem
   * nenhuma pessoa ter falado com ele.
   *
   * ⚠️ Isto NÃO julga o fechamento. A regra do Johnny de 24/08 ("chamado não
   * fica aberto no limbo") segue intacta e o chamado continua fechando — este
   * bloco é RÉGUA, não comportamento, e é o mesmo argumento que criou o bloco
   * `aguardando_aluno` acima: honesto não pode significar INVISÍVEL.
   *
   * ⚠️ Por que existe o filtro "ninguém voltou": sem ele o bloco reimprime todo
   * dia casos JÁ atendidos (#126, #154) e vira alarme que se aprende a ignorar.
   * O sinal de que a bola voltou do lado humano é uma nota posterior ao
   * fechamento assinada por alguém que não é a `carol` — que é exatamente o
   * retorno que o #153 mediu não existir (5 de 5 entregas do #126 sem resposta).
   *
   * O detector completo, com as duas famílias, é
   * `2026-08-20_fechados_que_disparam.cjs`. Aqui fica só o recorte que dói,
   * porque detector que ninguém roda não vigia nada: medido em 28/08, aquele
   * script não é chamado por rotina nenhuma — só por quem lembra dele.
   */
  const JANELA_EM_CIMA_MS = 300 * 1000;
  const desde7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: fech, error: errFech } = await db
    .from("incidents")
    .select(
      "numero, title, status, resolved_at, resolved_by, last_seen_at, occurrences, affected_emails, agent_notes",
    )
    .in("status", ["fixed", "ignored"])
    .gte("last_seen_at", desde7d)
    .gt("occurrences", 1)
    .not("resolved_at", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(200);

  let orfaos = [];
  if (errFech) {
    // mesmo motivo dos outros dois: zero aqui é indistinguível de saúde
    console.log(`\n⚠️  consulta de FECHADO EM CIMA DO DISPARO FALHOU: ${errFech.message}`);
    console.log("    NÃO trate esta rodada como limpa — pode haver aluno sem resposta fora da fila.");
  } else {
    orfaos = (fech ?? []).filter((i) => {
      const delta = new Date(i.resolved_at).getTime() - new Date(i.last_seen_at).getTime();
      if (delta < 0 || delta > JANELA_EM_CIMA_MS) return false;
      if (!(i.affected_emails ?? []).length) return false;
      // `agent_notes` já apareceu corrompido em string nesta base — não confie no tipo
      const notas = Array.isArray(i.agent_notes) ? i.agent_notes : [];
      const humanoVoltou = notas.some(
        (n) =>
          n?.at &&
          new Date(n.at).getTime() > new Date(i.resolved_at).getTime() &&
          !/^carol/i.test(String(n.by ?? "")),
      );
      return !humanoVoltou;
    });
    if (orfaos.length) {
      console.log(
        `\n🕳️  FECHADO EM CIMA DO PRÓPRIO DISPARO E NINGUÉM VOLTOU: ${orfaos.length}` +
          ` (não conta como aberto — o aluno escreveu de novo e o chamado re-fechou)`,
      );
      for (const i of orfaos) {
        const delta =
          (new Date(i.resolved_at).getTime() - new Date(i.last_seen_at).getTime()) / 1000;
        const h = Math.round((Date.now() - new Date(i.last_seen_at).getTime()) / 3600000);
        console.log(
          `   #${i.numero} fechou ${delta.toFixed(3)}s depois do disparo · ${i.occurrences}x ·` +
            ` última há ${h}h · ${(i.affected_emails ?? []).join(", ")}`,
        );
        console.log(`      por "${i.resolved_by}" · ${i.title.slice(0, 80)}`);
      }
      console.log("   ⚠️  entrega ao time SEM retorno humano. Trate como aluno esperando.");
    }
  }

  const nadaAberto = !errInc && !totalInc && !errEsp && !totalEsp && !errFech && !orfaos.length;
  console.log(
    total === 0 && comAudio === 0 && nadaAberto
      ? "\n✅ Nada preso, nada aberto."
      : `\n➡️  ${total} item(ns) preso(s) · ${errInc ? "?" : (totalInc ?? 0)} incidente(s) aberto(s)` +
          ` · ${errEsp ? "?" : (totalEsp ?? 0)} aguardando aluno` +
          ` · ${errFech ? "?" : orfaos.length} fechado(s) sem retorno humano.` +
          ` Vá pelo mais antigo — playbooks em _frank/04.`,
  );
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
