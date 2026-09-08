/**
 * Rodada 08/09 — armadilha do #222: "sem conta" achado por e-mail IGUAL nao e
 * prova. A pessoa pode ter conta com OUTRO e-mail. Busca por nome, por dominio
 * e por pedacos do e-mail antes de concluir que nao existe conta.
 *
 * ⚠️ A primeira versao disto buscou em `profiles.full_name`, coluna que NAO
 * EXISTE — o supabase-js devolveu erro, o script ignorou o erro e imprimiu
 * "0 conta(s)". Zero por erro parecendo zero por ausencia: e a propria
 * armadilha que a rotina manda evitar. Aqui a coluna certa e `display_name`
 * e TODO erro de consulta e impresso e conta como falha.
 *
 * SOMENTE LEITURA.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const ALVOS = [
  { email: "viniciusjc1903@gmail.com", nome: "VINICIUS JULIO CAMARGO", termos: ["viniciusjc", "vinicius", "camargo", "julio"] },
  { email: "rodrigo.limas.1978@gmail.com", nome: "JORGE RODRIGO LIMA MIRANDA", termos: ["rodrigo.limas", "limas", "rodrigo", "miranda", "jorge"] },
];

let falhou = false;

async function busca(db, coluna, termo) {
  const { data, error } = await db.from("profiles")
    .select("email,display_name,created_at,credits_subscription,credits_extra")
    .ilike(coluna, `%${termo}%`).limit(30);
  if (error) { falhou = true; console.log(`      !! ERRO em ${coluna} ILIKE %${termo}%: ${error.message}`); return []; }
  return data || [];
}

(async () => {
  const db = supa();

  const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true });
  if (error) { console.error("ERRO lendo profiles:", error.message); process.exit(1); }
  console.log(`CONTRAPROVA 1: profiles responde e tem ${count} contas.`);

  // CONTRAPROVA 2: a busca por NOME acha alguem que eu SEI que existe?
  const amostra = await busca(db, "display_name", "a");
  console.log(`CONTRAPROVA 2: display_name ILIKE %a% -> ${amostra.length} conta(s) (se der 0, o instrumento esta cego)`);
  if (amostra.length) console.log(`   exemplo: ${amostra[0].email} | ${amostra[0].display_name}`);
  console.log("");

  for (const a of ALVOS) {
    console.log("=".repeat(70));
    console.log(`${a.email}  (${a.nome})`);

    const { data: exato, error: e1 } = await db.from("profiles")
      .select("id,email,display_name,created_at,credits_subscription,credits_extra,access_until")
      .ilike("email", a.email);
    if (e1) { falhou = true; console.log(`  !! ERRO no e-mail exato: ${e1.message}`); }
    console.log(`  e-mail exato -> ${(exato || []).length} conta(s)`);
    for (const u of exato || []) console.log(`     ${u.email} | ${u.display_name} | sub=${u.credits_subscription} extra=${u.credits_extra}`);

    for (const t of a.termos) {
      const uniq = [...new Map([
        ...(await busca(db, "email", t)),
        ...(await busca(db, "display_name", t)),
      ].map((x) => [x.email, x])).values()];
      console.log(`  termo "${t}" -> ${uniq.length} conta(s)`);
      for (const u of uniq) {
        console.log(`     ${u.email} | ${u.display_name} | criada ${String(u.created_at).slice(0, 10)} | sub=${u.credits_subscription} extra=${u.credits_extra}`);
      }
    }
    console.log("");
  }

  console.log(falhou ? "!! ALGUMA CONSULTA FALHOU — o resultado acima NAO vale como prova."
    : "Nenhuma consulta falhou: os zeros acima sao ausencia de verdade.");
})();
