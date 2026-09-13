const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
(async () => {
  for (const id of ['7578c587-d5be-45e0-814b-a13fe7b4b061','81438b60-b4a8-4b70-b4f2-747eebf62797']) {
    const { data: i } = await sb.from('incidents').select('numero,status,agent_notes').eq('id', id).maybeSingle();
    const notas = Array.isArray(i.agent_notes) ? i.agent_notes : [];
    console.log(`\n===== #${i.numero} [${i.status}] — ${notas.length} notas; ultimas 2:`);
    notas.slice(-2).forEach(n => console.log('  *', JSON.stringify(n).slice(0, 900)));
  }
})().catch(e=>console.log('FATAL',e.message));
