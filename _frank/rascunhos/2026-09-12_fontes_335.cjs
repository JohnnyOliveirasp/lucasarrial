const { supa } = require('../ferramentas/_comum.cjs');
(async () => {
  const s = supa();
  const { data: prof } = await s.from('profiles').select('id,email').ilike('email','%mastroianni%');
  console.log('perfis:', JSON.stringify(prof));
  if (!prof || !prof.length) return;
  for (const p of prof) {
    const { data: cl } = await s.from('video_clones').select('id,status,tier,image_path,credits_cost,created_at').eq('user_id', p.id).order('created_at');
    console.log(`\n=== clones de ${p.email} (${cl?.length||0}) ===`);
    (cl||[]).forEach(c=>console.log(`${c.created_at} ${c.status} ${c.tier} cr=${c.credits_cost} img=${c.image_path}`));
  }
})();
