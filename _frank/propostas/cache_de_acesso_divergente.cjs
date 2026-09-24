const path=require("node:path"); const RAIZ="/mnt/Data/Projetos/PlatformLucasArrial";
const {supa}=require(path.join(RAIZ,"_frank/ferramentas/_comum.cjs"));
const vale=(e,a)=>{ if(e.status==="active") return e.access_until===null||e.access_until>a;
  if(e.status==="canceled") return e.access_until!==null&&e.access_until>a; return false; };
function melhor(l,a){ return l.filter(e=>vale(e,a)).sort((x,y)=>{ if(x.status!==y.status)return x.status==="active"?-1:1;
  const vx=x.access_until===null?Infinity:new Date(x.access_until).getTime();
  const vy=y.access_until===null?Infinity:new Date(y.access_until).getTime(); return vy-vx;})[0]; }
(async()=>{ const db=supa(); const agora=new Date().toISOString();
  let ents=[],pag=0;
  for(;;){ const {data,error}=await db.from("entitlements")
      .select("user_id,provider,status,access_until,product_code,external_id").not("user_id","is",null).range(pag*1000,pag*1000+999);
    if(error)throw new Error(error.message); ents=ents.concat(data); if(data.length<1000)break; pag++; }
  const porUser=new Map(); for(const e of ents){ if(!porUser.has(e.user_id))porUser.set(e.user_id,[]); porUser.get(e.user_id).push(e); }
  const ids=[...porUser.keys()]; let perfis=[];
  for(let i=0;i<ids.length;i+=200){ const {data,error}=await db.from("profiles")
      .select("id,email,plan,access_until,access_source").in("id",ids.slice(i,i+200));
    if(error)throw new Error(error.message); perfis=perfis.concat(data); }
  const curto=[],longo=[],planoErrado=[];
  for(const p of perfis){ const m=melhor(porUser.get(p.id)??[],agora); if(!m) continue;
    const esp=m.access_until??null, tem=p.access_until??null;
    if(esp!==tem){ const te=esp?new Date(esp).getTime():Infinity; const tt=tem?new Date(tem).getTime():Infinity;
      if(tt<te) curto.push({p,m,esp}); else longo.push({p,m,esp}); }
    else if(p.plan!=="pro") planoErrado.push({p,m}); }
  const L=t=>console.log("\n"+"=".repeat(76)+"\n"+t+"\n"+"=".repeat(76));
  L("🔴 CACHE CURTO — paga ate DEPOIS do que o cache diz (vai trancar cedo): "+curto.length);
  for(const c of curto) console.log(`  ${c.p.email}\n     cache ate ${c.p.access_until} (plan=${c.p.plan}) | PAGO ate ${c.esp} | ent ${c.m.external_id} prod=${c.m.product_code}`);
  L("🟠 CACHE LONGO — cache da MAIS acesso do que o entitlement: "+longo.length);
  for(const c of longo.slice(0,20)) console.log(`  ${c.p.email} | cache ate ${c.p.access_until} | ent ate ${c.esp} | prod=${c.m.product_code}`);
  L("🟡 DATA CERTA MAS plan != pro: "+planoErrado.length);
  for(const c of planoErrado.slice(0,20)) console.log(`  ${c.p.email} | plan=${c.p.plan} | until=${c.p.access_until}`);
})().catch(e=>{console.error("FALHOU:",e.message);process.exit(1);});
