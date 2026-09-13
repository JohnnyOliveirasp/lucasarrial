const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
(async () => {
  const { data, error } = await sb.from("agent_state").select("key,updated_at,value")
    .in("key", ["para_frank_702cc916", "para_frank_52b22304", "para_frank_f1ada07e"]);
  if (error) return console.log("ERRO", error.message);
  data.forEach(r => {
    const v = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
    console.log(`\n===== ${r.key} (${((Date.now() - new Date(r.updated_at)) / 3.6e6).toFixed(0)}h)`);
    console.log("ASSUNTO:", v.subject || v.assunto);
    console.log("RECADO:", String(v.message || v.recado || "").slice(0, 1500));
  });
})().catch(e => console.log("FATAL", e.message));
