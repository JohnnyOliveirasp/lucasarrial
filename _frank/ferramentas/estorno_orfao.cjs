/**
 * DETECTOR CANÔNICO DE ESTORNO ÓRFÃO — substitui o casamento ad-hoc por ref_id
 * que as rondas refaziam a cada dia (e que levantou o MESMO não-bug 3x:
 * incidentes 902a1c85 e 88eef8aa).
 *
 * O PADRÃO CONHECIDO (não é achado): o DELETE do histórico
 * (frontend/src/app/api/v1/generations/route.ts) apaga a linha em `generations`
 * e o objeto no R2, mas as transações ficam — o ref_id do estorno aponta pro
 * nada. Isso é o comportamento NORMAL enquanto não houver soft-delete.
 *
 * O QUE CONTINUA ALARMANDO (bug real): ref órfão cujo ledger NÃO reconcilia.
 * Reconciliar = as TRÊS provas juntas:
 *   1. débito casado: existe tx ref_type='generation' com o MESMO ref_id e
 *      amount igual ao estorno com sinal trocado (gerou → cobrou → estornou);
 *   2. soma de TODAS as transações do usuário == saldo real do profile
 *      (credits_subscription + credits_extra);
 *   3. cadeia balance_after íntegra (cada tx: anterior + amount == atual).
 * Falhou QUALQUER uma → ALARME, com o motivo impresso.
 *
 * REGRA INVIOLÁVEL: estorno se confere por ref_type='generation_refund',
 * NUNCA por kind — o estorno grava kind='extra_purchase'. Conferir por kind
 * já quase pagou 13 alunos em dobro.
 *
 * SÓ LEITURA. Nunca credita, estorna ou apaga nada.
 *
 * Uso:
 *   node _frank/ferramentas/estorno_orfao.cjs [--desde 2026-08-01] [--selftest] [--injetar-teste]
 *
 * --selftest      valida o classificador puro com 4 casos construidos (sem banco).
 * --injetar-teste roda o pipeline REAL e injeta EM MEMORIA (nunca no banco) um
 *                 estorno orfao de ledger que nao reconcilia — prova que o
 *                 caminho completo ainda alarma (exit 2). Use para auditar que
 *                 o detector nao foi silenciado demais.
 *
 * Saída sempre com DENOMINADOR (regra do zero mentiroso): quantos estornos
 * examinados, quantos órfãos, quantos padrão-conhecido, quantos ALARMES.
 * Exit code: 0 = nenhum alarme; 2 = tem alarme; 1 = falha de execução.
 */
const { supa } = require(__dirname + "/_comum.cjs");

/**
 * Classificador PURO (testável sem banco).
 * @param {object} caso
 * @param {boolean} caso.temDebitoCasado  tx ref_type='generation' mesmo ref_id, amount = -estorno
 * @param {number}  caso.somaLedger       soma de todas as tx do usuário
 * @param {number}  caso.saldoProfile     credits_subscription + credits_extra
 * @param {number}  caso.quebrasCadeia    nº de quebras na cadeia balance_after
 * @returns {{alarme: boolean, rotulo: string, motivos: string[]}}
 */
function classificar({ temDebitoCasado, somaLedger, saldoProfile, quebrasCadeia }) {
  const motivos = [];
  if (!temDebitoCasado) motivos.push("SEM debito casado (estorno sem cobranca correspondente)");
  if (somaLedger !== saldoProfile)
    motivos.push(`soma das tx (${somaLedger}) != saldo do profile (${saldoProfile}), dif ${saldoProfile - somaLedger}`);
  if (quebrasCadeia > 0) motivos.push(`cadeia balance_after com ${quebrasCadeia} quebra(s)`);
  if (motivos.length === 0) {
    return {
      alarme: false,
      rotulo: "PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO",
      motivos: [],
    };
  }
  return { alarme: true, rotulo: "ALARME: ref orfao com ledger que NAO reconcilia", motivos };
}

function selftest() {
  // caso 1: o padrão conhecido — DEVE passar calado
  const ok = classificar({ temDebitoCasado: true, somaLedger: 16964, saldoProfile: 16964, quebrasCadeia: 0 });
  // caso 2: ledger que não reconcilia — DEVE alarmar
  const ruim = classificar({ temDebitoCasado: true, somaLedger: 16964, saldoProfile: 15000, quebrasCadeia: 0 });
  // caso 3: estorno sem débito casado — DEVE alarmar mesmo com soma batendo
  const semDeb = classificar({ temDebitoCasado: false, somaLedger: 500, saldoProfile: 500, quebrasCadeia: 0 });
  // caso 4: cadeia quebrada — DEVE alarmar
  const cadeia = classificar({ temDebitoCasado: true, somaLedger: 500, saldoProfile: 500, quebrasCadeia: 2 });
  const provas = [
    ["padrao conhecido NAO alarma", ok.alarme === false && ok.rotulo.includes("PADRAO CONHECIDO")],
    ["soma != saldo ALARMA", ruim.alarme === true],
    ["estorno sem debito casado ALARMA", semDeb.alarme === true],
    ["cadeia balance_after quebrada ALARMA", cadeia.alarme === true],
  ];
  let falhas = 0;
  console.log("=== SELFTEST do classificador (4 casos construidos, sem banco) ===");
  for (const [nome, passou] of provas) {
    console.log(`  ${passou ? "OK " : "FALHOU"}  ${nome}`);
    if (!passou) falhas++;
  }
  console.log(`selftest: ${provas.length - falhas}/${provas.length} passaram`);
  process.exit(falhas ? 1 : 0);
}

async function paginado(query) {
  let tudo = [], from = 0;
  for (;;) {
    const { data, error } = await query.range(from, from + 999);
    if (error) throw new Error(JSON.stringify(error));
    tudo = tudo.concat(data || []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return tudo;
}

async function main() {
  const argDesde = process.argv.indexOf("--desde");
  const desde =
    argDesde > -1 && process.argv[argDesde + 1]
      ? process.argv[argDesde + 1] + "T00:00:00Z"
      : new Date(Date.now() - 30 * 24 * 3600e3).toISOString();
  const db = supa();

  // 1. todos os estornos de geração na janela (por ref_type, NUNCA por kind)
  const estornos = await paginado(
    db.from("credit_transactions")
      .select("id,user_id,kind,amount,balance_after,ref_type,ref_id,note,created_at")
      .eq("ref_type", "generation_refund")
      .gte("created_at", desde)
      .order("created_at")
  );
  console.log(`janela desde ${desde.slice(0, 10)} | estornos generation_refund examinados: ${estornos.length}`);

  // 2. quais ref_id ainda existem em generations
  const refs = [...new Set(estornos.map((t) => t.ref_id).filter(Boolean))];
  const existe = new Set();
  for (let i = 0; i < refs.length; i += 100) {
    const { data, error } = await db.from("generations").select("id").in("id", refs.slice(i, i + 100));
    if (error) throw new Error("generations: " + JSON.stringify(error));
    for (const g of data || []) existe.add(g.id);
  }
  const orfaos = estornos.filter((t) => t.ref_id && !existe.has(t.ref_id));
  const semRef = estornos.filter((t) => !t.ref_id);

  // 2b. caso construído (SÓ EM MEMÓRIA, nada é gravado): estorno órfão cujo
  // ledger não reconcilia. Serve pra provar que o detector não foi cegado.
  const ledgerCache = new Map(); // user_id -> {soma, saldo, quebras, email, nTx}
  if (process.argv.includes("--injetar-teste")) {
    const FAKE_USER = "99999999-9999-4999-8999-999999999999";
    orfaos.push({
      id: "00000000-0000-4000-8000-000000000001",
      user_id: FAKE_USER,
      kind: "extra_purchase",
      amount: 999,
      ref_type: "generation_refund",
      ref_id: "99999999-9999-4999-8999-000000000042", // não existe em generations
      created_at: "2026-01-01T00:00:00.000Z",
    });
    ledgerCache.set(FAKE_USER, { soma: 5000, saldo: 4001, quebras: 1, email: "CASO-CONSTRUIDO@teste.local", nTx: 3 });
    console.log("(--injetar-teste: 1 orfao sintetico com ledger que NAO reconcilia foi injetado em memoria)");
  }
  console.log(`refs distintos: ${refs.length} | existentes: ${existe.size} | ORFAOS: ${orfaos.length} | estorno sem ref_id nenhum: ${semRef.length}`);
  if (semRef.length) for (const t of semRef) console.log(`  ATENCAO estorno sem ref_id: tx ${t.id} user ${t.user_id} amount ${t.amount} em ${t.created_at}`);

  // 3. classificar cada órfão
  let conhecidos = 0, alarmes = 0;
  for (const o of orfaos) {
    // débito casado com o mesmo ref_id
    const { data: irm, error: ei } = await db
      .from("credit_transactions")
      .select("amount,ref_type")
      .eq("ref_id", o.ref_id);
    if (ei) throw new Error("tx por ref: " + JSON.stringify(ei));
    const temDebitoCasado = (irm || []).some((d) => d.ref_type === "generation" && d.amount === -o.amount);

    // ledger do usuário (cacheado por usuário)
    if (!ledgerCache.has(o.user_id)) {
      const all = await paginado(
        db.from("credit_transactions")
          .select("amount,balance_after,created_at")
          .eq("user_id", o.user_id)
          .order("created_at")
      );
      const soma = all.reduce((a, b) => a + b.amount, 0);
      let quebras = 0;
      for (let i = 1; i < all.length; i++) {
        if (
          all[i].balance_after !== null &&
          all[i - 1].balance_after !== null &&
          all[i].balance_after !== all[i - 1].balance_after + all[i].amount
        )
          quebras++;
      }
      const { data: prof, error: ep } = await db
        .from("profiles")
        .select("email,credits_subscription,credits_extra")
        .eq("id", o.user_id)
        .maybeSingle();
      if (ep) throw new Error("profiles: " + JSON.stringify(ep));
      ledgerCache.set(o.user_id, {
        soma,
        saldo: (prof?.credits_subscription || 0) + (prof?.credits_extra || 0),
        quebras,
        email: prof?.email || o.user_id,
        nTx: all.length,
      });
    }
    const L = ledgerCache.get(o.user_id);
    const v = classificar({
      temDebitoCasado,
      somaLedger: L.soma,
      saldoProfile: L.saldo,
      quebrasCadeia: L.quebras,
    });
    if (v.alarme) alarmes++;
    else conhecidos++;
    const linha = `${o.created_at.slice(0, 16)} ${L.email} ref=${o.ref_id} +${o.amount}`;
    if (v.alarme) {
      console.log(`\n🔴 ${v.rotulo}\n   ${linha}`);
      for (const m of v.motivos) console.log(`   motivo: ${m}`);
      console.log(`   (ledger: ${L.nTx} tx, soma ${L.soma}, saldo ${L.saldo}, quebras ${L.quebras})`);
    } else {
      console.log(`  · ${v.rotulo} | ${linha} (ledger ${L.nTx} tx reconcilia em ${L.saldo})`);
    }
  }

  console.log(
    `\n>>> RESUMO: ${estornos.length} estornos examinados | ${orfaos.length} orfaos | ` +
      `${conhecidos} padrao-conhecido (nao sao achado) | ${alarmes} ALARME(S)`
  );
  if (alarmes === 0) console.log(">>> nenhum alarme — os orfaos encontrados sao todos DELETE de historico com ledger reconciliado.");
  process.exit(alarmes ? 2 : 0);
}

if (process.argv.includes("--selftest")) selftest();
else main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });

module.exports = { classificar };
