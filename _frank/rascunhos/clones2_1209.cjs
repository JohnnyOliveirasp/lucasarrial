const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
(async () => {
  const { data: one } = await sb.from('video_clones').select('*').limit(1);
  console.log('COLUNAS:', Object.keys(one[0]).join(','));
  const { data, error } = await sb.from('video_clones').select('*')
    .in('status',['pending','generating','clonando','montando']).order('created_at');
  if (error) return console.log('ERRO', error.message);
  console.log(`\nPRESOS: ${data.length}`);
  for (const c of data) {
    console.log(`\n- id=${c.id.slice(0,8)} status=${c.status} ha=${((Date.now()-new Date(c.created_at))/3.6e6).toFixed(1)}h job=${c.job_id||c.runpod_job_id||'?'} user=${c.user_id?c.user_id.slice(0,8):'?'}`);
    const campos = ['credits_cost','credits','cost','duration','duration_seconds','error','error_message','updated_at','mode','output_url','video_url'];
    campos.filter(k=>k in c && c[k]!=null).forEach(k=>console.log(`    ${k}=${String(c[k]).slice(0,90)}`));
    if (c.user_id) {
      const { data: p } = await sb.from('profiles').select('email,credits,access_until').eq('id', c.user_id).single();
      if (p) console.log(`    ALUNO ${p.email} creditos=${p.credits} acesso_ate=${p.access_until}`);
    }
  }
})().catch(e=>console.log('FATAL',e.message));
