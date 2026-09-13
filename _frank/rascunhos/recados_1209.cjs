const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
const h = t => ((Date.now() - new Date(t)) / 3.6e6);
(async () => {
  const { data, error } = await sb.from('agent_state').select('key,updated_at,value').order('updated_at');
  if (error) return console.log('ERRO', error.message);
  const rec = data.filter(r => r.key.startsWith('para_frank_'));
  const pat = data.filter(r => r.key.startsWith('patch_'));
  const outras = data.filter(r => !r.key.startsWith('para_frank_') && !r.key.startsWith('patch_'));
  console.log(`RECADOS=${rec.length} PATCHES=${pat.length} OUTRAS=${outras.length}`);
  const porAssunto = {};
  rec.forEach(r => {
    const v = typeof r.value === 'string' ? (()=>{try{return JSON.parse(r.value)}catch{return{}}})() : (r.value||{});
    const a = String(v.subject || v.assunto || '(sem assunto)').slice(0, 62);
    (porAssunto[a] = porAssunto[a] || []).push(h(r.updated_at));
  });
  console.log('\nRECADOS POR ASSUNTO:');
  Object.entries(porAssunto).sort((a,b)=>b[1].length-a[1].length).forEach(([a,hs]) =>
    console.log(`  ${String(hs.length).padStart(3)}x  mais velho ${Math.max(...hs).toFixed(0)}h  ${a}`));
  console.log('\nFAIXA DE IDADE:', `>168h: ${rec.filter(r=>h(r.updated_at)>168).length} | 48-168h: ${rec.filter(r=>h(r.updated_at)>48&&h(r.updated_at)<=168).length} | <48h: ${rec.filter(r=>h(r.updated_at)<=48).length}`);
  console.log('\nPATCHES:');
  pat.forEach(p => {
    const v = typeof p.value === 'string' ? (()=>{try{return JSON.parse(p.value)}catch{return{}}})() : (p.value||{});
    console.log(`  ${p.key} ha ${h(p.updated_at).toFixed(0)}h incidente=${v.incident_id||'?'} assunto=${String(v.assunto||v.subject||'').slice(0,110)}`);
  });
  console.log('\nOUTRAS CHAVES:', outras.map(o=>o.key).join(', ').slice(0,600));
})().catch(e => console.log('FATAL', e.message));
