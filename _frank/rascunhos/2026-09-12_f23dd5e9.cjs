const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  for (const p of ["f23dd5e9","f7a0420c"]) {
    const { data } = await db.from("generations").select("id,name,status,created_at,elapsed_seconds,qa,runpod_job_id,text_raw,request_attempts").like("id", p+"%");
    for (const g of (data||[])) {
      const chars = (g.text_raw||"").length;
      const chunks = Math.max(1, Math.ceil(chars/160));
      const teto = Math.max(480, 360 + chunks*40);
      const setup = g.qa?.setup_s;
      const total = (setup||0) + (g.elapsed_seconds||0);
      console.log(`\n#${g.id.slice(0,8)} ${g.created_at} | name="${g.name}" | job=${g.runpod_job_id? "SIM":"NULL"} | tentativas=${g.request_attempts}`);
      console.log(`  chars=${chars} chunks=${chunks} teto=${teto}s`);
      console.log(`  setup=${setup}s + elapsed=${g.elapsed_seconds}s = ${total.toFixed(1)}s -> ${(100*total/teto).toFixed(1)}% do teto | folga ${(teto-total).toFixed(1)}s`);
      console.log(`  qa=${JSON.stringify(g.qa).slice(0,260)}`);
      console.log(`  texto: ${JSON.stringify((g.text_raw||"").slice(0,120))}`);
    }
  }
})();
