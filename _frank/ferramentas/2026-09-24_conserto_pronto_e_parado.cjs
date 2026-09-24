/**
 * CONSERTO PRONTO E PARADO — a fila que ninguém contava.
 *
 *   node _frank/ferramentas/2026-09-24_conserto_pronto_e_parado.cjs
 *   node _frank/ferramentas/2026-09-24_conserto_pronto_e_parado.cjs --json
 *
 * SÓ LEITURA. Não mergeia, não fecha, não escreve. Só conta e classifica.
 *
 * ── POR QUE NASCEU (ronda de 24/09 ~13hZ) ────────────────────────────────
 *
 * O item serial da ronda era o `ff95507f` (aluna Leonice, 16,7 dias). O
 * conserto do defeito dela **já estava escrito, testado e revisado** — no
 * PR #357, aberto em 19/09 e **parado havia 5 dias**. O cartão do Mission
 * Board dizia `completed` desde 19/09 às 17:48.
 *
 * Isso é o buraco: a casa mede a fila de INCIDENTES toda ronda (118 abertos,
 * 69 com 7d+) e **não mede a fila de CONSERTOS PRONTOS**. Um incidente cujo
 * fix está num PR parado aparece em toda contagem como `investigating` — ou
 * seja, indistinguível de "ainda estou apurando", quando na verdade o
 * trabalho acabou e só falta alguém apertar o botão.
 *
 * É a mesma família do `percepcao_travada` (41 falsos em 17/09) e do
 * `dump_enviada` ("0 cartas" por base64, 18/09): **não é falta de esforço, é
 * falta de instrumento.** Ninguém some com um fix de propósito; ele some
 * porque nenhuma contagem olha pra lá.
 *
 * ── O NÚMERO QUE ESTE SCRIPT EXISTE PRA DAR (medido em 24/09 13hZ) ───────
 *
 *   58 PRs abertos.  38 MERGEABLE+CLEAN.  20 CONFLICTING+DIRTY.
 *
 *   PRs com  9 dias ou mais : 15 → 15 conflitados = 100%
 *   PRs com  8 dias ou menos: 43 → 38 mergeáveis  =  88%
 *
 *   mediana MERGEABLE   =  4d (máx  8d)
 *   mediana CONFLICTING = 15d (máx 35d)
 *
 * A leitura, e ela é dura: **um PR nesta casa tem validade de ~8 dias.**
 * Nenhum PR com 9 dias ou mais continua mergeável — todos apodreceram em
 * conflito, e conflito quer dizer retrabalho de alguém. O #357 foi merjado
 * no 5º dia, ainda dentro da janela. Mais três dias e o conserto da Leonice
 * precisaria de rebase; mais duas semanas e entraria no cemitério dos 35d.
 *
 * Não é "o PR está velho", é **"o conserto está apodrecendo"**. O que morre
 * junto é sempre um aluno nomeado: #42 (Fast lê anexo > 2MB) está há 31 dias,
 * #189 (estorno não ressuscita entitlement contestado) há 18.
 *
 * ── ARMADILHA MEDIDA, e é o motivo de o script fazer N chamadas ──────────
 *
 * ⚠️ `gh pr list --json mergeable` devolve **UNKNOWN para os 58**. O GitHub
 * só calcula mergeabilidade sob demanda, no `pr view` de cada PR. Quem
 * confiar no `list` mede assim:
 *
 *     MERGEABLE: 0   CONFLICTING: 0   UNKNOWN: 58
 *
 * e conclui "nenhum PR entra hoje" — exatamente ao contrário da verdade, que
 * é 38. Eu tomei esse zero na cara nesta ronda e só escapei porque olhei a
 * DISTRIBUIÇÃO em vez do número: 58 UNKNOWN não é resposta, é o instrumento
 * dizendo que não sabe. **Zero de instrumento cego não é zero medido.**
 * Por isso aqui é um `pr view` por PR, mesmo custando ~58 chamadas.
 *
 * O script MORRE se a contagem não fechar ou se sobrar UNKNOWN — em vez de
 * imprimir número torto com cara de medição.
 */
const { execFileSync } = require("node:child_process");

const RAIZ = require("node:path").resolve(__dirname, "..", "..");
const JSON_OUT = process.argv.includes("--json");
const AGORA = Date.now();
const dias = (iso) => Math.floor((AGORA - new Date(iso).getTime()) / 86400000);

function gh(args) {
  return execFileSync("gh", args, { cwd: RAIZ, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

function morrer(msg) {
  console.error(`\n❌ ${msg}`);
  console.error("   Não acredite em nenhum número desta rodada.");
  process.exit(1);
}

let numeros;
try {
  numeros = JSON.parse(gh(["pr", "list", "--state", "open", "--limit", "200", "--json", "number"]))
    .map((p) => p.number);
} catch (e) {
  morrer(`não consegui listar os PRs abertos: ${e.message}`);
}
if (numeros.length === 0) morrer("zero PR aberto — improvável nesta casa; trate como falha de leitura.");

// Um `pr view` por PR: é o ÚNICO jeito de o GitHub calcular mergeable.
// (ver "ARMADILHA MEDIDA" no cabeçalho — o `list` devolve UNKNOWN pra todos)
const prs = [];
for (const n of numeros) {
  try {
    const p = JSON.parse(
      gh(["pr", "view", String(n), "--json", "number,title,createdAt,mergeable,mergeStateStatus,isDraft,headRefName"]),
    );
    prs.push({ ...p, idade: dias(p.createdAt) });
  } catch (e) {
    morrer(`PR #${n} não respondeu (${e.message.split("\n")[0]}). Contagem parcial não vale.`);
  }
}

if (prs.length !== numeros.length) morrer(`li ${prs.length} de ${numeros.length} PRs.`);

const limpos = prs.filter((p) => p.mergeable === "MERGEABLE" && p.mergeStateStatus === "CLEAN");
const podres = prs.filter((p) => p.mergeable === "CONFLICTING");
const cegos = prs.filter((p) => p.mergeable === "UNKNOWN");

// Trava contra o zero cego: se o GitHub não calculou, isto NÃO é medição.
if (cegos.length > 0) {
  morrer(
    `${cegos.length} PR(s) voltaram UNKNOWN (o GitHub não calculou a mergeabilidade).\n` +
      `   Isso é o instrumento dizendo "não sei", não é "não dá pra mergear".\n` +
      `   PRs: ${cegos.map((p) => "#" + p.number).join(", ")}`,
  );
}
if (limpos.length + podres.length !== prs.length) {
  morrer(`${prs.length} PRs mas ${limpos.length} limpos + ${podres.length} podres não fecham a conta.`);
}

const mediana = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};
const velhos = prs.filter((p) => p.idade >= 9);
const novos = prs.filter((p) => p.idade <= 8);
const velhosPodres = velhos.filter((p) => p.mergeable === "CONFLICTING").length;
const novosLimpos = novos.filter((p) => p.mergeable === "MERGEABLE").length;

const parados = limpos.filter((p) => p.idade >= 3).sort((a, b) => b.idade - a.idade);

if (JSON_OUT) {
  console.log(JSON.stringify({ total: prs.length, limpos: limpos.length, podres: podres.length, parados, prs }, null, 2));
  process.exit(0);
}

console.log(`\n🔧 CONSERTOS ABERTOS (PRs): ${prs.length}\n`);
console.log(`   ✅ MERGEABLE+CLEAN (entram hoje) : ${limpos.length}  · mediana ${mediana(limpos.map((p) => p.idade))}d · máx ${Math.max(...limpos.map((p) => p.idade))}d`);
console.log(`   💀 CONFLITADOS (apodreceram)     : ${podres.length}  · mediana ${mediana(podres.map((p) => p.idade))}d · máx ${Math.max(...podres.map((p) => p.idade))}d`);

console.log(`\n── VALIDADE DO CONSERTO (o corte, medido) ──`);
console.log(`   PRs com 9d ou mais : ${velhos.length} → ${velhosPodres} conflitados (${velhos.length ? Math.round((velhosPodres * 100) / velhos.length) : 0}%)`);
console.log(`   PRs com 8d ou menos: ${novos.length} → ${novosLimpos} mergeáveis (${novos.length ? Math.round((novosLimpos * 100) / novos.length) : 0}%)`);
console.log(`   Leitura: passou de ~8 dias, o conserto não é mergeado — é RETRABALHADO.`);

console.log(`\n── PRONTOS E PARADOS HÁ 3 DIAS OU MAIS: ${parados.length} ──`);
for (const p of parados) console.log(`   ${String(p.idade).padStart(2)}d | #${p.number} | ${p.title.slice(0, 66)}`);

console.log(`\n── JÁ PODRES (precisam de rebase antes de qualquer merge) ──`);
for (const p of podres.sort((a, b) => b.idade - a.idade)) {
  console.log(`   ${String(p.idade).padStart(2)}d | #${p.number} | ${p.title.slice(0, 66)}`);
}

console.log(`\n>>> NÚMERO PRO RELATÓRIO: ${limpos.length} conserto(s) pronto(s) sem merge · ${parados.length} parado(s) há 3d+ · ${podres.length} já apodrecido(s) · mais velho ${Math.max(...prs.map((p) => p.idade))}d`);
console.log(`    ⚠️ PR aberto NÃO é fix entregue. Cartão "completed" no Mission Board também não.`);
console.log(`    Só a main deploya — e um incidente cujo fix está num PR parado aparece`);
console.log(`    em toda contagem como "investigating", igualzinho a um que ninguém olhou.\n`);
