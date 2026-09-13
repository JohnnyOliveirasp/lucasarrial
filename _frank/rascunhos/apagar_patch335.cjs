// #335: o patch do Vigia foi REFUTADO por medicao e a objecao esta escrita no
// incidente (nota do frank, 12/09 21hZ). Rotina 1-B passo 6: aplicado OU
// recusado, a chave sai com DELETE — senao ela volta em toda ronda.
const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
(async () => {
  const { error } = await sb.from("agent_state").delete().eq("key", "patch_81438b60");
  console.log(error ? "FALHOU: " + error.message : "apagada patch_81438b60 (refutada, objecao no #335)");
  const { data } = await sb.from("agent_state").select("key");
  console.log(
    "SOBRANDO patches=", data.filter(x => x.key.startsWith("patch_")).length,
    "recados=", data.filter(x => x.key.startsWith("para_frank_")).length
  );
})().catch(e => console.log("FATAL", e.message));
