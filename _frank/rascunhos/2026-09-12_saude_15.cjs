const { supa } = require("../ferramentas/_comum.cjs");
const pag = async (db, tab, sel, tune) => {
  const out = []; for (let off=0;;off+=1000) {
    let q = db.from(tab).select(sel).range(off,off+999); q = tune(q);
    const { data, error } = await q; if (error) throw new Error(tab+": "+error.message);
    out.push(...data); if (data.length<1000) break;
  } return out;
};
(async () => {
  const db = supa();
  // 1) ocorrencias novas de executionTimeout
  const falhas = await pag(db,"generations","id,user_id,status,error_message,created_at,elapsed_seconds",
    q=>q.eq("status","failed").gte("created_at","2026-09-04T00:00:00Z").order("created_at"));
  const to = falhas.filter(f => /executionTimeout/i.test(String(f.error_message||"")));
  console.log("FALHAS desde 04/09:", falhas.length, "| executionTimeout:", to.length);
  for (const f of to) console.log(`  ${f.created_at} · ${f.id.slice(0,8)} · elapsed=${f.elapsed_seconds} · ${String(f.error_message).slice(0,90)}`);
  console.log("ULTIMA ocorrencia executionTimeout:", to.length ? to[to.length-1].created_at : "(nenhuma na janela)");

  // 2) buraco do qa.setup_s nas prontas desde 05/09
  const prontas = await pag(db,"generations","id,created_at,elapsed_seconds,qa",
    q=>q.eq("status","ready").gte("created_at","2026-09-05T00:00:00Z").order("created_at"));
  const porDia = {};
  for (const g of prontas) {
    const d = g.created_at.slice(0,10);
    porDia[d] ??= {tot:0, com:0};
    porDia[d].tot++;
    const s = g.qa && (g.qa.setup_s ?? g.qa.setupS);
    if (typeof s === "number") porDia[d].com++;
  }
  console.log("\n=== qa.setup_s POR DIA (prontas) ===");
  let T=0,C=0;
  for (const [d,v] of Object.entries(porDia).sort()) { T+=v.tot; C+=v.com;
    console.log(`  ${d}  ${String(v.com).padStart(4)}/${String(v.tot).padStart(4)} = ${(100*v.com/v.tot).toFixed(1)}%`); }
  console.log(`  TOTAL ${C}/${T} = ${(100*C/T).toFixed(1)}%  (buraco ${(100-100*C/T).toFixed(1)}%)`);
})();
