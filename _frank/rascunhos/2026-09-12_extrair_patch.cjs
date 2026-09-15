const { supa } = require('../ferramentas/_comum.cjs');
const fs=require('fs');
(async () => {
  const { data } = await supa().from('agent_state').select('value').eq('key','patch_81438b60');
  const v = typeof data[0].value==='string'?JSON.parse(data[0].value):data[0].value;
  fs.writeFileSync('/tmp/patch_335.patch', v.patch);
  console.log('gravado /tmp/patch_335.patch bytes=', v.patch.length);
})();
