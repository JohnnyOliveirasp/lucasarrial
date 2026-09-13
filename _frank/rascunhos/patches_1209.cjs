const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
(async () => {
  for (const id of ['7578c587-d5be-45e0-814b-a13fe7b4b061','81438b60-b4a8-4b70-b4f2-747eebf62797']) {
    const { data: i, error } = await sb.from('incidents').select('numero,status,title,agent_notes,resolution_note,last_seen_at').eq('id', id).maybeSingle();
    if (error) { console.log('ERRO', error.message); continue; }
    console.log(`\n=== #${i.numero} [${i.status}] visto ${i.last_seen_at}`);
    console.log('TITULO:', String(i.title).slice(0,200));
    const n = String(i.agent_notes || '');
    console.log('ULTIMA NOTA (cauda):', n.slice(-800));
  }
})().catch(e=>console.log('FATAL',e.message));
