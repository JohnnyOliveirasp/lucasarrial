const path=require('node:path');
require('../ferramentas/_comum.cjs');
const K = process.env.RUNPOD_API_KEY;
const IT = process.env.RUNPOD_ENDPOINT_INFINITETALK_ID || '9get7wv7trn3wg';
const TR = process.env.RUNPOD_ENDPOINT_TRAIN_ID || '2jcta960kzc2m4';
const jobs = ['97b0271e-a348-4ad5-8edd-8e0e7225e9a3-e2','7dc2a838-059a-4595-8455-a215304e0847-e1','4eed6980-e4c7-4775-8adf-b6e540d40c11-e1'];
(async()=>{
  for (const [nome,id] of [['video(InfiniteTalk)',IT],['voz(train)',TR],['voxbr','0qd28qwo9ptcp4']]) {
    const r = await fetch(`https://api.runpod.ai/v2/${id}/health`,{headers:{Authorization:`Bearer ${K}`}});
    console.log(nome, r.status, JSON.stringify(await r.json()));
  }
  console.log('\nJOBS DOS CLONES PRESOS:');
  for (const j of jobs) {
    const r = await fetch(`https://api.runpod.ai/v2/${IT}/status/${j}`,{headers:{Authorization:`Bearer ${K}`}});
    const b = await r.json();
    console.log(` ${j.slice(0,8)} -> status=${b.status||'?'} delayTime=${b.delayTime||'-'} executionTime=${b.executionTime||'-'} ${b.error?('ERRO:'+String(b.error).slice(0,120)):''}`);
  }
})().catch(e=>console.log('FATAL',e.message));
