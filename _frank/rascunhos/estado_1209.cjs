const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
const h = t => ((Date.now() - new Date(t)) / 3.6e6).toFixed(0);
(async () => {
  const { data: st, error: e1 } = await sb.from('agent_state').select('key,updated_at').order('updated_at', { ascending: true });
  if (e1) console.log('ERRO agent_state', e1.message);
  else {
    const pat = st.filter(r => r.key.startsWith('patch_'));
    const rec = st.filter(r => r.key.startsWith('para_frank_'));
    console.log(`AGENT_STATE total=${st.length} patches=${pat.length} recados=${rec.length}`);
    if (rec.length) console.log(`  recado mais velho ha ${h(rec[0].updated_at)}h | mais novo ha ${h(rec[rec.length-1].updated_at)}h`);
    pat.forEach(p => console.log(`  PATCH ${p.key} ha ${h(p.updated_at)}h`));
  }
  const hoje = '2026-09-12T00:00:00Z';
  const { data: fc, error: e2 } = await sb.from('incidents').select('id,status,title,updated_at').gte('updated_at', hoje).not('status','in','(open,investigating)');
  if (e2) console.log('ERRO fechados', e2.message);
  else {
    console.log(`\nMUDARAM DE ESTADO DESDE 12/09 00hZ: ${fc.length}`);
    fc.forEach(i => console.log(`  #${i.id} [${i.status}] ${String(i.title).slice(0,110)}`));
  }
  const { data: ab, error: e3 } = await sb.from('incidents').select('status').in('status', ['open','investigating']);
  if (e3) console.log('ERRO abertos', e3.message);
  else { const c = {}; ab.forEach(r => c[r.status] = (c[r.status]||0)+1); console.log('\nABERTOS:', JSON.stringify(c)); }
  const { data: nv, error: e4 } = await sb.from('incidents').select('id,title,created_at').gte('created_at', hoje);
  if (e4) console.log('ERRO novos', e4.message); else console.log(`NOVOS HOJE: ${nv.length}`);
})().catch(e => console.log('FATAL', e.message));
