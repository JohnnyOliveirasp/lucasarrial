const { supa } = require('../ferramentas/_comum.cjs');
(async () => {
  const pref = process.argv[2];
  const { data, error } = await supa().from('incidents').select('*');
  if (error) { console.error('ERRO', error); process.exit(1); }
  const hit = data.filter(r => r.id.startsWith(pref));
  if (hit.length !== 1) { console.error('prefixo ambiguo/inexistente:', hit.length); process.exit(1); }
  const r = hit[0];
  for (const k of Object.keys(r)) {
    if (k === 'agent_notes') continue;
    console.log(`--- ${k}: ${typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]}`);
  }
  console.log('\n=== AGENT_NOTES ===');
  const n = r.agent_notes;
  if (Array.isArray(n)) n.forEach((x,i)=>console.log(`\n[${i}] ${typeof x==='object'?JSON.stringify(x,null,1):x}`));
  else console.log(typeof n === 'object' ? JSON.stringify(n,null,1) : n);
})();
