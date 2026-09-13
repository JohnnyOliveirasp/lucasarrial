// Varre agent_state (patch_* e para_frank_*) e cruza com o estado do incidente citado.
// --apagar executa o DELETE (routine 1-B/1-C); sem flag e so leitura.
const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
const APAGAR = process.argv.includes('--apagar');
const h = t => ((Date.now() - new Date(t)) / 3.6e6);
const parse = v => typeof v === 'string' ? (()=>{try{return JSON.parse(v)}catch{return{}}})() : (v||{});
(async () => {
  const { data, error } = await sb.from('agent_state').select('key,updated_at,value').order('updated_at');
  if (error) return console.log('ERRO agent_state:', error.message);
  const fila = data.filter(r => r.key.startsWith('para_frank_') || r.key.startsWith('patch_'));
  const podeApagar = [], fica = [];
  for (const r of fila) {
    const v = parse(r.value);
    const inc = v.incident_id || null;
    let st = null, titulo = null;
    if (inc) {
      const { data: i, error: e } = await sb.from('incidents').select('numero,status,title,resolved_at').eq('id', inc).maybeSingle();
      if (e) { console.log(`  (erro lendo incidente ${inc}: ${e.message})`); continue; }
      if (i) { st = i.status; titulo = `#${i.numero||inc.slice(0,8)}`; }
      else st = 'INEXISTENTE';
    }
    const linha = { key: r.key, horas: h(r.updated_at).toFixed(0), inc: titulo || (inc ? inc.slice(0,8) : 'sem-incidente'), st: st || '-', assunto: String(v.subject||v.assunto||'').slice(0,70) };
    if (st && ['fixed','ignored','resolved','closed'].includes(st)) podeApagar.push(linha); else fica.push(linha);
  }
  console.log(`\n== JA RESOLVIDOS, A CHAVE SO ESTA ENTULHANDO: ${podeApagar.length} ==`);
  podeApagar.forEach(l => console.log(`  ${l.key} (${l.horas}h) ${l.inc} [${l.st}] ${l.assunto}`));
  console.log(`\n== AINDA VIVOS / SEM INCIDENTE: ${fica.length} ==`);
  console.log(`   sem incidente citado: ${fica.filter(f=>f.inc==='sem-incidente').length} | com incidente aberto: ${fica.filter(f=>f.inc!=='sem-incidente').length}`);
  fica.filter(f=>+f.horas>168).forEach(l => console.log(`  +7d: ${l.key} (${l.horas}h) ${l.inc} [${l.st}] ${l.assunto}`));
  if (APAGAR && podeApagar.length) {
    let ok = 0;
    for (const l of podeApagar) {
      const { error: e } = await sb.from('agent_state').delete().eq('key', l.key);
      if (e) console.log(`  FALHOU apagar ${l.key}: ${e.message}`); else ok++;
    }
    const { data: dep } = await sb.from('agent_state').select('key');
    const r2 = dep.filter(x=>x.key.startsWith('para_frank_')).length, p2 = dep.filter(x=>x.key.startsWith('patch_')).length;
    console.log(`\nAPAGADAS ${ok}/${podeApagar.length}. SOBRANDO: recados=${r2} patches=${p2}`);
  }
})().catch(e => console.log('FATAL', e.message));
