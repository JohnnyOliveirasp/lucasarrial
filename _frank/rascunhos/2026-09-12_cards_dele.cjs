const { supa } = require('../ferramentas/_comum.cjs');
(async () => {
  const { data } = await supa().from('incidents').select('id,status,title,occurrences,created_at,resolution_note,affected_emails');
  data.filter(r=>JSON.stringify(r.affected_emails||[]).includes('mastroianni')).forEach(r=>{
    console.log(`\n${r.id.slice(0,8)} [${r.status}] ${r.occurrences}x ${r.created_at}`);
    console.log(`  T: ${(r.title||'').slice(0,200)}`);
    console.log(`  R: ${(r.resolution_note||'(sem resolution_note)').slice(0,400)}`);
  });
})();
