/**
 * backfill_envios_da_ronda.cjs — reconstrói em `emails_enviados` as cartas que
 * a RONDA mandou ANTES do conserto do #101, usando o ledger local como fonte.
 *
 * POR QUE EXISTE. O PR #311 (`366e1cd8`, merge 16/09 11:26Z) fez o
 * `enviar_email.cjs` gravar cada carta em `emails_enviados`. Ele vale pra
 * frente. O PASSIVO ficou, e o Vigia cobrou isso em 16/09 18:17Z: a ficha de
 * contato (`contato-ficha.ts` → `contato-tentativas.ts`) lê ESTA tabela, então
 * aluno que recebeu carta da ronda antes do conserto aparece com
 * "0 tentativas" — e o cabeçalho do `contato-tentativas.ts:32` diz, com todas
 * as letras, que esse zero cego é o PIOR desfecho do módulo: ele existe pra
 * MATAR a ordem de reenvio e acaba assinando embaixo dela.
 *
 * A FONTE É O LEDGER, NÃO A PASTA ENVIADOS. `_frank/prova/envios_ledger.jsonl`
 * é escrito pelo `_envios.cjs` no instante do envio e carrega exatamente os 4
 * campos que a linha precisa (`at`, `para`, `assunto`, `message_id`). A pasta
 * Enviados também teria as cartas, mas o Message-ID lá sai de cabeçalho
 * decodificado — e é o Message-ID que casa o bounce. Reconstruir a chave de
 * casamento a partir de parse de cabeçalho seria apostar a prova no parser.
 *
 * ⚠️ `enviado_em` É CARIMBADO À MÃO, e esse é o ponto mais perigoso do script.
 * A coluna tem `default now()`. Inserir sem informar a data gravaria as 21
 * cartas velhas como se tivessem saído HOJE — o que é PIOR que a ausência:
 * a ficha passaria a dizer "a casa escreveu hoje" pra quem não recebe nada há
 * dias, e mataria a ordem de reenvio pelo motivo errado. Por isso o `at` do
 * ledger é obrigatório e a linha é RECUSADA se ele não existir ou não parsear.
 *
 * ⚠️ `origem = 'ronda-manual-retroativo'`, não `'ronda-manual'`. Linha
 * reconstruída por escrituração não pode se passar por registro feito na hora:
 * quem ler a ficha tem que conseguir separar o que foi observado do que foi
 * remontado. A coluna é TEXT livre (conferido no information_schema) e nada em
 * produção filtra por `origem` — só exibe (`contato-tentativas.ts:127`).
 *
 * ⚠️ NÃO inventa bounce. `bounce_em`/`bounce_classe` ficam NULOS. O ledger não
 * sabe se a carta chegou, e "sem bounce" NUNCA é dito como "entregue" (mesma
 * doutrina do `mail-envio.ts`, que se recusa a ter coluna `entregue`).
 *
 * SEM `--confirmar` ele SIMULA. Com `--confirmar` grava e RELÊ do banco pra
 * conferir quantas linhas existem de fato — update/insert que afeta 0 linhas
 * em silêncio já fez ronda reportar trabalho que não aconteceu (armadilha de
 * 20/08).
 *
 * USO:
 *   node _frank/ferramentas/2026-09-18_backfill_envios_da_ronda.cjs
 *   node _frank/ferramentas/2026-09-18_backfill_envios_da_ronda.cjs --confirmar
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});
const { supa } = require(path.join(__dirname, "_comum.cjs"));

const LEDGER = path.join(RAIZ, "_frank", "prova", "envios_ledger.jsonl");
const ORIGEM = "ronda-manual-retroativo";

function normId(v) {
  return (v || "").replace(/[<>\s]/g, "").toLowerCase() || null;
}

(async () => {
  const confirmar = process.argv.includes("--confirmar");
  const db = supa();

  if (!fs.existsSync(LEDGER)) throw new Error(`ledger não encontrado: ${LEDGER}`);
  const entradas = fs
    .readFileSync(LEDGER, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  console.log(`ledger: ${entradas.length} envio(s) registrados pela ronda`);

  // tabela inteira (pagina de 1000 — consulta corta em silêncio, armadilha 20/08)
  const jaTem = new Set();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("emails_enviados")
      .select("message_id")
      .order("enviado_em", { ascending: true })
      .range(de, de + 999);
    if (error) throw new Error(`emails_enviados: ${error.message}`);
    for (const r of data || []) if (normId(r.message_id)) jaTem.add(normId(r.message_id));
    if (!data || data.length < 1000) break;
  }
  console.log(`tabela: ${jaTem.size} Message-ID(s) já registrados\n`);

  const faltando = [];
  const recusadas = [];
  for (const e of entradas) {
    const mid = normId(e.message_id);
    if (!mid) {
      recusadas.push({ e, motivo: "sem Message-ID — não haveria como casar bounce" });
      continue;
    }
    if (jaTem.has(mid)) continue;
    const quando = e.at ? new Date(e.at) : null;
    if (!quando || Number.isNaN(quando.getTime())) {
      recusadas.push({ e, motivo: "sem data legível — gravaria como enviada HOJE" });
      continue;
    }
    faltando.push({ mid, quando, para: (e.para || "").trim().toLowerCase(), assunto: e.assunto || null });
  }

  console.log(`⤷ ${faltando.length} carta(s) da ronda SEM linha na tabela`);
  if (recusadas.length) {
    console.log(`⤷ ${recusadas.length} RECUSADA(s) de propósito:`);
    for (const r of recusadas) console.log(`   ${r.e.at || "?"} ${r.e.para || "?"} — ${r.motivo}`);
  }
  if (!faltando.length) {
    console.log("\nnada a fazer.");
    return;
  }

  console.log("");
  for (const f of faltando) {
    console.log(`   ${f.quando.toISOString().slice(0, 19)}Z · ${f.para}`);
    console.log(`      "${(f.assunto || "(sem assunto)").slice(0, 74)}"`);
  }

  if (!confirmar) {
    console.log(`\n🧪 SIMULAÇÃO — nada gravado. Rode com --confirmar pra valer.`);
    return;
  }

  // user_id é conveniência de consulta; ausência não invalida a linha (a chave
  // que casa o bounce é o Message-ID). Lead/typo fica nulo e a linha vale igual.
  const emails = [...new Set(faltando.map((f) => f.para))];
  const perfis = new Map();
  for (let i = 0; i < emails.length; i += 50) {
    const { data } = await db.from("profiles").select("id, email").in("email", emails.slice(i, i + 50));
    for (const p of data || []) perfis.set((p.email || "").toLowerCase(), p.id);
  }

  const linhas = faltando.map((f) => ({
    message_id: `<${f.mid}>`,
    to_email: f.para,
    assunto: f.assunto ? f.assunto.slice(0, 300) : null,
    origem: ORIGEM,
    enviado_em: f.quando.toISOString(), // NUNCA deixar o default now() pegar
    user_id: perfis.get(f.para) ?? null,
  }));

  const { data: inseridas, error } = await db.from("emails_enviados").insert(linhas).select("id, message_id");
  if (error) throw new Error(`INSERT falhou: ${error.message}`);
  console.log(`\n✅ INSERT devolveu ${inseridas?.length ?? 0} linha(s)`);

  // RELEITURA: o que o banco confirma, não o que o script planejou.
  const { data: conferencia, error: e2 } = await db
    .from("emails_enviados")
    .select("id, enviado_em, to_email, origem")
    .eq("origem", ORIGEM);
  if (e2) throw new Error(`releitura falhou: ${e2.message}`);
  console.log(`📒 CONFERIDO NO BANCO: ${conferencia.length} linha(s) com origem='${ORIGEM}'`);
  const fora = conferencia.filter((c) => new Date(c.enviado_em) > new Date(Date.now() - 60_000));
  if (fora.length) {
    console.log(`⚠️  ${fora.length} linha(s) com enviado_em de AGORA — o carimbo histórico falhou, confira à mão`);
  } else {
    console.log(`   nenhuma com data de hoje: o carimbo histórico pegou`);
  }
})().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
