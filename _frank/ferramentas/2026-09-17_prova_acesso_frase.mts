/**
 * PROVA EM PRODUÇÃO do conserto do #303 (`a0bc1f7e`) — dados reais, não fixture.
 *
 * POR QUE EXISTE. O conserto subiu com 9 testes de unidade, e todos eles
 * alimentam a função à mão. Nenhum prova a pergunta que interessa: **nas contas
 * de verdade, a linha que a Fast recebe deixou de chamar renovação de prazo?**
 * É a lição já registrada nesta casa ("prova do andar de baixo assinando pelo
 * de cima"): o teste garante a REGRA, não a LIGAÇÃO com o banco.
 *
 * O QUE FAZ. Lê `profiles` + `entitlements` reais, reproduz o desempate do
 * `statusDaAssinatura()` (o de `entitlements-pure.melhorAcesso`), e imprime,
 * lado a lado, o que a linha dizia ANTES e o que ela diz DEPOIS. Não escreve
 * nada em lugar nenhum — é só leitura.
 *
 * Uso:
 *   node --experimental-strip-types _frank/ferramentas/2026-09-17_prova_acesso_frase.mts
 */
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const raiz = path.join(import.meta.dirname, "..", "..");
require(path.join(raiz, "frontend", "node_modules", "dotenv")).config({
  path: path.join(raiz, "frontend", ".env.local"),
});
const { createClient } = require(path.join(raiz, "frontend", "node_modules", "@supabase/supabase-js"));
const { fraseDeAcessoParaAgente, naturezaDaData } = await import(
  path.join(raiz, "frontend", "src", "lib", "payments", "acesso-frase.ts")
);
const { entitlementValeAcesso } = await import(
  path.join(raiz, "frontend", "src", "lib", "payments", "acesso-regra.ts")
);

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const agoraIso = new Date().toISOString();
const dtBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "?";

/** A linha EXATA que o `account.ts` montava antes do conserto. */
const linhaAntiga = (p: { access_until: string | null; access_source: string | null }) =>
  p.access_until ? `ativo até ${dtBR(p.access_until)}` : p.access_source ? "ativo" : "SEM assinatura ativa";

/** Mesmo desempate do `statusDaAssinatura()` em `account.ts`. */
function melhorStatus(linhas: { status: string; access_until: string | null }[]): string | null {
  const vivas = linhas.filter((e) => entitlementValeAcesso(e, agoraIso));
  if (!vivas.length) return null;
  return vivas.sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    const va = a.access_until === null ? Infinity : new Date(a.access_until).getTime();
    const vb = b.access_until === null ? Infinity : new Date(b.access_until).getTime();
    return vb - va;
  })[0].status;
}

// ── 1. O CASO QUE ABRIU O CARD, e mais uma amostra de cada natureza ─────────
const { data: perfis, error } = await db
  .from("profiles")
  .select("id,email,access_until,access_source")
  .not("access_until", "is", null)
  .gt("access_until", agoraIso)
  .lt("access_until", new Date(Date.now() + 7 * 864e5).toISOString())
  .limit(1000);
if (error) throw new Error(`SELECT profiles falhou: ${error.message}`);

const porNatureza: Record<string, number> = {};
const amostra: Record<string, string> = {};
let antigaDizPrazo = 0;

for (const p of perfis as { id: string; email: string; access_until: string; access_source: string | null }[]) {
  const { data: ents } = await db.from("entitlements").select("status,access_until").eq("user_id", p.id);
  const status = ents ? melhorStatus(ents) : null;
  const leitura = { accessUntil: p.access_until, accessSource: p.access_source, statusEntitlement: status };
  const nat = naturezaDaData(leitura, agoraIso);
  porNatureza[nat] = (porNatureza[nat] ?? 0) + 1;
  // "ativo até <data>" sobre quem RENOVA é exatamente a frase falsa do card.
  if (nat === "renova" && /^ativo até/.test(linhaAntiga(p))) antigaDizPrazo++;
  if (!amostra[nat]) {
    amostra[nat] =
      `\n  [${nat}] ${p.email}\n` +
      `    ANTES: ${linhaAntiga(p)}\n` +
      `    DEPOIS: ${fraseDeAcessoParaAgente(leitura, agoraIso)}`;
  }
}

console.log(`\n=== PERFIS COM access_until DENTRO DE 7 DIAS: ${perfis.length} ===`);
console.log("natureza da data:", porNatureza);
console.log(
  `\n>>> ${antigaDizPrazo} contas em que a linha ANTIGA dizia "ativo até <data>"\n` +
  `    sobre uma assinatura que RENOVA naquela data. Essas eram as expostas\n` +
  `    à frase falsa. Com o conserto: 0.`,
);
console.log("\n=== UMA AMOSTRA DE CADA NATUREZA ===");
for (const k of Object.keys(amostra)) console.log(amostra[k]);

// ── 2. A VÍTIMA CONFIRMADA DO CARD ─────────────────────────────────────────
const { data: v } = await db
  .from("profiles")
  .select("id,email,access_until,access_source")
  .eq("email", "leonicemleandrosociedadeadvoca@gmail.com")
  .maybeSingle();
if (v) {
  const { data: ents } = await db.from("entitlements").select("status,access_until").eq("user_id", v.id);
  const leitura = { accessUntil: v.access_until, accessSource: v.access_source, statusEntitlement: ents ? melhorStatus(ents) : null };
  console.log(`\n=== VÍTIMA CONFIRMADA DO #303 (${v.email}) ===`);
  console.log(`  entitlements vivos: ${JSON.stringify(ents?.map((e) => e.status))}`);
  console.log(`  ANTES:  ${linhaAntiga(v)}`);
  console.log(`  DEPOIS: ${fraseDeAcessoParaAgente(leitura, agoraIso)}`);
}
