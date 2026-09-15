const { supa } = require("../ferramentas/_comum.cjs");
const EMAILS = ["igorfigaro.nunes@hotmail.com","leraqorganicos@gmail.com","pablomikael67@gmail.com","fabiosaadi@icloud.com","jgmlusvarghi@gmail.com","orthobor@gmail.com","catiagargan@gmail.com","brunodamasceno@hotmail.com","ak@aknetzwork.com","mariannamagri@hotmail.com","lorenadutra84@gmail.com","victor.inscriptio@gmail.com","leticia@contabilidadeatlanta.com.br","carolineacaldeira@gmail.com","lucijoneslopescosta@gmail.com","jeffersonjalles@gmail.com","karina.borges@icloud.com","alexandre_vita@hotmail.com","deivididaa@gmail.com"];
const chave = e => { const [u,d]=String(e).toLowerCase().trim().split("@"); return (d==="gmail.com"||d==="googlemail.com" ? u.split("+")[0].replace(/\./g,"") : u.split("+")[0]) + "@" + d; };
(async () => {
  const db = supa();
  // perfis (paginado, comparando por chave normalizada)
  const perfis = [];
  for (let off=0; ; off+=1000) {
    const { data, error } = await db.from("profiles").select("id,email,created_at,access_until,credits_subscription,plan").range(off, off+999);
    if (error) { console.log("ERRO profiles:", error.message); process.exit(1); }
    perfis.push(...data); if (data.length < 1000) break;
  }
  const porChave = new Map(perfis.map(p => [chave(p.email||""), p]));
  const { data: peds, error: e2 } = await db.from("sgp_pedidos").select("id,email,user_id,status");
  if (e2) { console.log("ERRO sgp_pedidos:", e2.message); process.exit(1); }
  const pedPorChave = new Map(); for (const p of peds) { const k=chave(p.email||""); if(!pedPorChave.has(k)) pedPorChave.set(k,[]); pedPorChave.get(k).push(p); }
  console.log("perfis lidos:", perfis.length, "| pedidos sgp lidos:", peds.length);
  console.log("\n=== ESTADO DOS 19 EM " + new Date().toISOString() + " ===");
  let comConta=0, comPedido=0;
  for (const e of EMAILS) {
    const k = chave(e);
    const p = porChave.get(k); const pd = pedPorChave.get(k) || [];
    if (p) comConta++; if (pd.length) comPedido++;
    console.log(`${e.padEnd(38)} perfil=${p ? "SIM("+p.created_at.slice(0,10)+" acesso="+(p.access_until||"-")+" cr="+p.credits_subscription+")" : "NAO"} pedidos=${pd.length ? pd.map(x=>x.status).join(",") : "0"}`);
  }
  console.log(`\nRESUMO: com conta ${comConta}/19 | com pedido no portal ${comPedido}/19`);
})();
