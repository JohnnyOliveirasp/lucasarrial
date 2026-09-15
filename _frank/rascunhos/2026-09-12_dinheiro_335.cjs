const { supa } = require('../ferramentas/_comum.cjs');
const UID='89cfc1d1-5d6d-40d6-a0cc-9d23ed115aca';
(async () => {
  const s = supa();
  // todos os clones, paginado, procurando os ids de imagem do cartao
  const alvos=['b832ef36','8f1e389c','f3cd2b0e','c72b6615','4304d732','ba81cc49','6fc07888'];
  let all=[],from=0;
  for(;;){const {data,error}=await s.from('video_clones').select('id,user_id,status,tier,image_path,credits_cost,created_at').range(from,from+999);
    if(error){console.error(error);break} all=all.concat(data); if(data.length<1000)break; from+=1000;}
  console.log('total video_clones na base:', all.length);
  const dele=all.filter(c=>c.user_id===UID);
  console.log('clones deste user:', dele.length);
  alvos.forEach(a=>{const h=all.filter(c=>(c.image_path||'').includes(a));
    console.log(`  img ${a}: ${h.length} linha(s)` + h.map(c=>` [${c.created_at} ${c.status} cr=${c.credits_cost} user=${c.user_id.slice(0,8)}]`).join(''));});
  // extrato
  let tx=[],f2=0;
  for(;;){const {data,error}=await s.from('credit_transactions').select('*').eq('user_id',UID).range(f2,f2+999);
    if(error){console.error(error);break} tx=tx.concat(data); if(data.length<1000)break; f2+=1000;}
  console.log('\n=== EXTRATO (%d linhas) ===', tx.length);
  let soma=0;
  tx.sort((a,b)=>a.created_at<b.created_at?-1:1).forEach(t=>{soma+=Number(t.amount)||0;
    console.log(`${t.created_at} ${String(t.amount).padStart(8)} kind=${t.kind} ref_type=${t.ref_type} ref=${String(t.ref_id||'').slice(0,8)}`);});
  console.log('SALDO SOMADO:', soma);
  const {data:p}=await s.from('profiles').select('credits,access_until,created_at,last_sign_in_at').eq('id',UID);
  console.log('perfil:', JSON.stringify(p));
})();
