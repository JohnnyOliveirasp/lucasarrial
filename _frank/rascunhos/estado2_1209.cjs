const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
(async () => {
  const { data: one } = await sb.from('incidents').select('*').limit(1);
  console.log('COLUNAS incidents:', Object.keys(one[0]).join(', '));
  const hoje = '2026-09-12T00:00:00Z';
  for (const col of ['resolved_at','closed_at','last_seen_at','created_at']) {
    if (!Object.keys(one[0]).includes(col)) continue;
    const { data, error } = await sb.from('incidents').select('id,status,title,'+col).gte(col, hoje).not('status','in','(open,investigating)');
    if (error) { console.log(`ERRO ${col}:`, error.message); continue; }
    console.log(`\nFECHADOS com ${col} >= hoje: ${data.length}`);
    data.slice(0,25).forEach(i => console.log(`  #${i.id} [${i.status}] ${String(i.title).slice(0,100)}`));
  }
})().catch(e => console.log('FATAL', e.message));
