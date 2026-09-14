const { supa } = require('../ferramentas/_comum.cjs');
(async () => {
  const { data, error } = await supa().from('agent_state').select('*').eq('key', process.argv[2]);
  if (error) { console.error(error); process.exit(1); }
  if (!data.length) { console.error('sem chave'); process.exit(1); }
  const v = data[0];
  console.log('key:', v.key, '| updated:', v.updated_at);
  const val = typeof v.value === 'string' ? v.value : JSON.stringify(v.value, null, 1);
  console.log(val);
})();
