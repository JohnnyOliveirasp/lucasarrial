const { supa } = require('../ferramentas/_comum.cjs');
(async () => {
  const { data, error } = await supa().from('incidents').select('id,status,title,occurrences,first_seen_at,affected_emails');
  if (error) { console.error(error); process.exit(1); }
  const q = (process.argv[2]||'').toUpperCase();
  data.filter(r=>(r.title||'').toUpperCase().includes(q)).forEach(r=>{
    console.log(`${r.id.slice(0,8)} [${r.status}] ${r.occurrences}x fs=${r.first_seen_at} mails=${JSON.stringify(r.affected_emails)}`);
    console.log(`   ${(r.title||'').slice(0,160)}`);
  });
})();
