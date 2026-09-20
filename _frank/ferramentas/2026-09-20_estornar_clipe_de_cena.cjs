/**
 * 2026-09-20_estornar_clipe_de_cena.cjs — o backfill do #485.
 *
 * O QUE ELE DEVOLVE, E POR QUE NÃO É "O CUSTO DAS CENAS FALHADAS".
 *
 * O cartão do Vigia somou o RÓTULO (`video_scenes.video_credits_cost` das
 * linhas hoje `failed`) e chegou em 56.760, declarando no próprio texto que o
 * número aponta pra MENOS e que quem for estornar tem que ir no extrato. Ele
 * estava certo: o lote REUSA a mesma linha de cena a cada redespacho, então
 * quem pagou 3× pelas mesmas 10 cenas aparece no rótulo uma vez só. Medido:
 * `atendimento@bibibrindes.com` tem rótulo 13.200 e extrato 39.600 (três lotes
 * de 10 cenas em 03–04/08, todos falhados).
 *
 * Então a conta aqui é por PROJETO, lida do extrato:
 *
 *     devido = (soma dos débitos `video_clips` do projeto)
 *            + (soma dos débitos `video_clip_regen` das cenas do projeto)
 *            - (valor das cenas que HOJE estão `ready`)
 *            - (o que já foi estornado antes)
 *
 * Subtrair o entregue é o que impede o estorno a maior: a Priscilla pagou
 * 33.000, recebeu 19 cenas (25.080) e só está devendo 7.920.
 *
 * ⚠️ CONTROLE POSITIVO, e ele ABORTA se zerar. O instrumento tem que
 * reencontrar os dois casos auditados linha a linha (hercules = 22.440,
 * bibibrindes = 39.600). "Zero" vindo de consulta cega já fez esta casa
 * reportar saúde onde havia gente sem acesso — aqui, zero sem controle é bug
 * do script, não ausência de dívida.
 *
 * ⚠️ NÃO confunde com o conserto de produção (commit dc3a6be3). Aquele estorna
 * a tentativa NOVA, por cena, com ref_type `video_clip_refund`. Este aqui paga
 * o passivo velho, por PROJETO, com ref_type `video_clip_refund_backfill` — e
 * as duas coisas não se cruzam, porque produção só estorna quem ganha o claim
 * (cena em `pending`/`generating`) e todas estas já estão `failed` há tempo.
 *
 * Uso:
 *   node 2026-09-20_estornar_clipe_de_cena.cjs              # ENSAIO (não escreve)
 *   node 2026-09-20_estornar_clipe_de_cena.cjs --confirmar  # vale
 *   node 2026-09-20_estornar_clipe_de_cena.cjs --confirmar --aluno <email>
 *
 * Sem `--confirmar` ele SÓ LÊ. Com `--confirmar` ele chama `add_extra_credits`
 * (RPC), nunca UPDATE na mão em saldo (regra do 02_ACESSOS).
 */
const path = require("node:path");
const raiz = path.join(__dirname, "..", "..", "frontend");
require(path.join(raiz, "node_modules", "dotenv")).config({ path: path.join(raiz, ".env.local") });
const { createClient } = require(path.join(raiz, "node_modules", "@supabase/supabase-js"));

const TETO_POR_CASO = 20000; // regra 9-B: acima disso, para e chama o Johnny
const TETO_DIARIO = 100000; // regra 9-B: soma de TODAS as devoluções do dia
const REF_TYPE = "video_clip_refund_backfill";

// Controle positivo: os dois casos conferidos linha a linha em 20/09.
const CONTROLE = { "hercules.contador@gmail.com": 22440, "atendimento@bibibrindes.com": 39600 };

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const brl = (n) => n.toLocaleString("pt-BR");

/**
 * A apuração roda em SQL, no servidor, e NÃO pelo cliente PostgREST.
 *
 * POR QUE (custou uma versão inteira deste script, em 20/09): `.select()` sem
 * range traz no máximo **1.000 linhas**, calado. A tabela tem 3.716 cenas,
 * então a primeira versão agregava um TERÇO do banco e achava que tinha lido
 * tudo — o Hercules, que é de 19/09, simplesmente não vinha na página. O
 * controle positivo abortou e foi só por isso que o erro não virou estorno a
 * menos. É a armadilha do `03_ROTINA.md` ("consulta que erra volta VAZIA") na
 * sua forma mais cara: aqui ela não volta vazia, volta PELA METADE.
 */
async function consultar(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente");
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF || "yizerthyrgrajivlotcw"}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    },
  );
  const txt = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

async function apurar() {
  const linhas = await consultar(`
    with proj as (
      select distinct video_project_id, user_id from video_scenes
       where video_status = 'failed' and coalesce(video_credits_cost, 0) > 0
    ),
    cena as (
      select s.id, s.video_project_id, s.video_status, coalesce(s.video_credits_cost,0) as custo
        from video_scenes s where s.video_project_id in (select video_project_id from proj)
    ),
    -- O ref_type e filtrado nas DUAS pernas, e isso nao e zelo: a cena tambem
    -- e cobrada pela IMAGEM dela (image_credits_cost), com ref_id = a mesma
    -- cena. Sem o filtro do lado do video_clip_regen, o custo da imagem
    -- entrava como se fosse clipe e a bibibrindes ia de 39.600 pra 42.231:
    -- 2.631 de estorno a MAIOR, pego pelo controle positivo.
    pago as (
      select p.video_project_id,
             coalesce(sum(abs(t.amount)) filter (
               where t.amount < 0 and (
                 (t.ref_id = p.video_project_id::text and t.ref_type = 'video_clips')
                 or (t.ref_id <> p.video_project_id::text and t.ref_type = 'video_clip_regen')
               )), 0) as pago,
             coalesce(sum(t.amount) filter (
               where t.amount > 0
                 and t.ref_type in ('video_clip_refund','video_clip_refund_backfill')
             ), 0) as estornado
        from proj p
        left join credit_transactions t
          on t.ref_id = p.video_project_id::text
          or t.ref_id in (select id::text from cena c where c.video_project_id = p.video_project_id)
       group by 1
    ),
    entrega as (
      select video_project_id,
             coalesce(sum(custo) filter (where video_status = 'ready'), 0) as entregue,
             count(*) filter (where video_status = 'failed' and custo > 0) as falhas
        from cena group by 1
    )
    select pr.video_project_id as projeto, pr.user_id as "userId", pf.email,
           pg.pago, pg.estornado, en.entregue, en.falhas,
           (pg.pago - en.entregue - pg.estornado) as devido
      from proj pr
      join pago pg on pg.video_project_id = pr.video_project_id
      join entrega en on en.video_project_id = pr.video_project_id
      left join profiles pf on pf.id = pr.user_id
     where (pg.pago - en.entregue - pg.estornado) > 0
     order by devido desc
  `);
  if (!Array.isArray(linhas) || linhas.length === 0)
    throw new Error("ABORTADO: apuração voltou vazia — instrumento cego, não é ausência de dívida");
  return linhas.map((l) => ({ ...l, email: l.email ?? "(sem e-mail)" }));
}

(async () => {
  const args = process.argv.slice(2);
  const confirmar = args.includes("--confirmar");
  const i = args.indexOf("--aluno");
  const sóEsse = i >= 0 ? args[i + 1] : null;

  let linhas = await apurar();

  // Controle positivo ANTES de qualquer decisão.
  for (const [email, esperado] of Object.entries(CONTROLE)) {
    const achou = linhas.find((l) => l.email === email);
    if (!achou || achou.devido !== esperado) {
      throw new Error(
        `ABORTADO — controle positivo falhou: ${email} devia dar ${brl(esperado)} e deu ` +
          `${achou ? brl(achou.devido) : "NADA"}. O instrumento está cego; não estorne por ele.`,
      );
    }
  }
  console.log("controle positivo OK (hercules 22.440 e bibibrindes 39.600 reencontrados)\n");

  const total = linhas.reduce((s, l) => s + l.devido, 0);
  console.log(`APURADO: ${linhas.length} projetos, ${brl(total)} créditos devidos\n`);

  const acima = linhas.filter((l) => l.devido > TETO_POR_CASO);
  const podeAgora = linhas.filter((l) => l.devido <= TETO_POR_CASO);

  for (const l of linhas) {
    const marca = l.devido > TETO_POR_CASO ? "🔴 JOHNNY" : "✅ pode";
    console.log(
      `${marca}  ${l.email.padEnd(38)} devido ${brl(l.devido).padStart(7)}  ` +
        `(pago ${brl(l.pago)} − entregue ${brl(l.entregue)} − estornado ${brl(l.estornado)}, ` +
        `${l.falhas} cenas falhadas)`,
    );
  }

  console.log(
    `\n🔴 acima do teto de ${brl(TETO_POR_CASO)}/caso (regra 9-B, NÃO estorno sozinho): ` +
      `${acima.length} casos, ${brl(acima.reduce((s, l) => s + l.devido, 0))} cr`,
  );
  const somaPode = podeAgora.reduce((s, l) => s + l.devido, 0);
  console.log(`✅ dentro da minha alçada: ${podeAgora.length} casos, ${brl(somaPode)} cr`);

  // Teto diário conta o DIA INTEIRO, não esta rodada (regra 9-B).
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: hojeTx } = await admin
    .from("credit_transactions")
    .select("amount, ref_type")
    .gt("amount", 0)
    .gte("created_at", `${hoje}T00:00:00Z`);
  const devolvidoHoje = (hojeTx ?? [])
    .filter((t) => /refund|estorn/i.test(t.ref_type ?? ""))
    .reduce((s, t) => s + t.amount, 0);
  console.log(`devoluções já feitas hoje: ${brl(devolvidoHoje)} cr (teto ${brl(TETO_DIARIO)})`);
  if (devolvidoHoje + somaPode > TETO_DIARIO) {
    console.log("\n🔴 TETO DIÁRIO ESTOURA — congela e chama o Johnny (regra 9-B). Nada foi feito.");
    return;
  }

  let fila = podeAgora;
  if (sóEsse) fila = fila.filter((l) => l.email === sóEsse);

  if (!confirmar) {
    console.log(`\n[ENSAIO] nada foi escrito. ${fila.length} estornos sairiam com --confirmar.`);
    return;
  }

  console.log(`\n[VALENDO] aplicando ${fila.length} estornos...`);
  for (const l of fila) {
    const { data, error } = await admin.rpc("add_extra_credits", {
      p_user_id: l.userId,
      p_amount: l.devido,
      p_ref_type: REF_TYPE,
      p_ref_id: l.projeto,
    });
    const ok = !error && data?.ok;
    console.log(
      `  ${ok ? "OK " : "FALHOU"} ${l.email} +${brl(l.devido)}` +
        `${ok ? ` (saldo ${brl(data.balance)})` : ` — ${error?.message ?? data?.reason}`}`,
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
