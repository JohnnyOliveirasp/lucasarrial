/**
 * Confere estorno CASANDO ref_id com a geração que falhou.
 *
 * Por que existe: `_Bugs/2026-08-19_dinheiro_pendurado.cjs` procura estorno
 * com regex no JSON inteiro da transação (/estorn|refund|devolu/). Isso:
 *   1. não amarra o estorno à geração — 1 estorno "cobre" 3 falhas na tela;
 *   2. pode casar por acaso com qualquer nota que cite a palavra.
 * A regra medida em 19/08: estorno é ref_type='generation_refund' e o
 * ref_id aponta pra generation. NUNCA se confere por `kind`
 * (o estorno grava kind='extra_purchase').
 * Só leitura.
 */
const { supa } = require("/mnt/Data/Projetos/PlatformLucasArrial/_frank/ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const desde = "2026-08-18T00:00:00Z";
  const { data: gs, error: eg } = await db.from("generations")
    .select("id,user_id,status,created_at").eq("status","failed").gte("created_at",desde).order("created_at");
  if (eg) throw new Error("generations: "+eg.message);
  console.log(`falhas desde ${desde.slice(0,10)}: ${gs.length}`);

  const ids=[...new Set(gs.map(g=>g.user_id))];
  const emailDe=new Map();
  for(let i=0;i<ids.length;i+=100){
    const {data,error}=await db.from("profiles").select("id,email").in("id",ids.slice(i,i+100));
    if(error) throw new Error("profiles: "+error.message);
    for(const p of data) emailDe.set(p.id,p.email);
  }

  const { data: tx, error: et } = await db.from("credit_transactions")
    .select("user_id,kind,amount,ref_type,ref_id,created_at")
    .eq("ref_type","generation_refund").gte("created_at",desde);
  if (et) throw new Error("credit_transactions: "+et.message);
  console.log(`estornos (ref_type=generation_refund): ${tx.length}`);
  const estornoDe=new Map();
  for(const t of tx) estornoDe.set(String(t.ref_id), t);

  let semEstorno=[];
  for(const g of gs){
    const e=estornoDe.get(String(g.id));
    const email=emailDe.get(g.user_id)??g.user_id;
    console.log(`  ${g.created_at.slice(0,16)} ${email.padEnd(34)} ${e?`OK estorno +${e.amount}`:"SEM ESTORNO casado"}`);
    if(!e) semEstorno.push({email,g});
  }
  console.log(`\n>>> SEM ESTORNO CASADO: ${semEstorno.length}`);
  for(const s of semEstorno) console.log(`   ${s.email} | generation ${s.g.id} | ${s.g.created_at}`);
})().catch(e=>{console.error("FALHOU:",e.message);process.exit(1)});
