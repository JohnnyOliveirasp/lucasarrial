/**
 * "O e-mail do aluno nao existe. Tem OUTRO jeito de falar com ele?"  — TEM.
 *
 * POR QUE EXISTE (20/09, chamado #249). O #249 ficou 15 dias parado com a
 * conclusao "nao ha segundo canal": glaubermed@ig.com.br devolve 550 5.1.1
 * permanente, `profiles.whatsapp` e NULL, nunca logou, nenhum chat vinculado.
 * Tudo isso e verdade — sobre o NOSSO banco. E o nosso banco nao e o unico
 * lugar onde essa pessoa existe.
 *
 * Quem vendeu guarda telefone. O endpoint `/sales/users?transaction=<id>` da
 * Hotmart devolve, pro papel BUYER: nome, e-mail, **phone**, **cellphone**,
 * documento (CPF) e endereco. Medido em 20/09 na transacao HP0751413476 (SGP,
 * R$ 397, COMPLETE): telefone do Glauber presente e preenchido. O aluno que a
 * casa classificou como incontactavel tinha telefone guardado o tempo todo, a
 * uma chamada de distancia, desde 15/08.
 *
 * Isso vale pros 309 do #426 e pra QUALQUER ficha de bounce: antes de escrever
 * "sem segundo canal", pergunte aqui. "Nao temos" e diferente de "nao existe".
 *
 * COMO CHEGAR NA TRANSACAO: `pagou_de_verdade.cjs <email>` ou
 * `2026-09-20_achar_compra_por_nome.cjs "<nome>"` imprimem o codigo HP....
 *
 * ⚠️ DADO PESSOAL. Somente leitura, e o resultado NAO vai pro Telegram nem pro
 * grupo (regra de canal: nunca dado que identifique aluno sem necessidade).
 * Serve pra alguem da casa ligar/mandar mensagem — nao pra circular em log.
 *
 * ⚠️ TELEFONE NAO AUTORIZA NADA ALEM DE FALAR. Vincular compra a conta, dar
 * credito ou liberar acesso continua sendo decisao humana/comercial.
 *
 * Uso:  node _frank/ferramentas/2026-09-20_contato_do_comprador.cjs HP0751413476
 */
const fs = require("fs"), path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
for (const l of fs.readFileSync(path.join(RAIZ, "frontend", ".env.local"), "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0) {
    const k = l.slice(0, i).trim();
    const v = l.slice(i + 1).replace(/[\r\n]+$/g, "").replace(/^["']|["']$/g, "");
    if (/^[A-Za-z0-9_]+$/.test(k)) process.env[k] = v;
  }
}
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const t = JSON.parse(await r.text()).access_token;
  if (!t) throw new Error(`sem access_token (HTTP ${r.status})`);
  return t;
}

(async () => {
  const tx = process.argv.slice(2).filter((x) => !x.startsWith("--"))[0];
  if (!tx) {
    console.log("uso: node 2026-09-20_contato_do_comprador.cjs HP0751413476");
    process.exit(1);
  }
  const H = { Authorization: `Bearer ${await token()}` };
  const r = await fetch(`${BASE}/sales/users?transaction=${encodeURIComponent(tx)}`, { headers: H });
  const raw = await r.text();
  if (!r.ok) {
    // Corpo cru antes de qualquer conclusao: 4xx nao e "nao tem contato".
    console.log(`❌ /sales/users HTTP ${r.status}. ISTO NAO E "SEM CONTATO" — e o instrumento`);
    console.log(`   falhando. Corpo cru:\n   ${raw.slice(0, 400)}`);
    process.exit(1);
  }
  let itens;
  try { itens = (JSON.parse(raw).items) || []; }
  catch { console.log(`❌ resposta nao-JSON (HTTP ${r.status}):\n${raw.slice(0, 400)}`); process.exit(1); }

  if (!itens.length) return console.log(`sem registro pra transacao ${tx}. (Nao e "sem contato": confira o codigo.)`);

  for (const it of itens) {
    console.log(`\n📄 ${it.transaction ?? tx} · ${it.product && it.product.name}`);
    for (const u of it.users || []) {
      if (u.role !== "BUYER") continue;   // so o COMPRADOR; produtor nao interessa
      const x = u.user || {};
      const doc = (x.documents || []).map((d) => `${d.type} ${d.value}`).join(", ");
      const a = x.address || {};
      console.log(`   COMPRADOR : ${x.name ?? "?"}`);
      console.log(`   e-mail    : ${x.email ?? "?"}`);
      console.log(`   📞 celular : ${x.cellphone || "(vazio)"}`);
      console.log(`   📞 fixo    : ${x.phone || "(vazio)"}`);
      console.log(`   documento : ${doc || "(vazio)"}`);
      console.log(`   cidade/UF : ${[a.city, a.state, a.country].filter(Boolean).join(" / ") || "(vazio)"}`);
      if (!x.cellphone && !x.phone) {
        console.log(`   ⚠️  sem telefone NESTA compra — tente as OUTRAS transacoes da mesma pessoa`);
        console.log(`       antes de concluir que nao ha canal.`);
      }
    }
  }
  console.log(`\n⚠️ Dado pessoal: nao cole isto no Telegram/grupo. Ligar/escrever e acao humana.`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
