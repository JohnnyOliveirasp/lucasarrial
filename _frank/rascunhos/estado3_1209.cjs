const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
(async () => {
  const { data, error } = await sb.from('incidents')
    .select('id,numero,status,title,resolved_at,resolved_commit,resolution_note,affected_emails,resolved_by')
    .gte('resolved_at','2026-09-12T00:00:00Z').order('resolved_at');
  if (error) return console.log('ERRO', error.message);
  data.forEach(i => {
    console.log(`\n=== #${i.numero||i.id.slice(0,8)} [${i.status}] ${i.resolved_at} por ${i.resolved_by||'?'}`);
    console.log('TITULO:', String(i.title).slice(0,260));
    console.log('COMMIT:', i.resolved_commit||'(nenhum)');
    console.log('AFETADOS:', JSON.stringify(i.affected_emails||[]));
    console.log('NOTA:', String(i.resolution_note||'').slice(0,700));
  });
})().catch(e=>console.log('FATAL',e.message));
