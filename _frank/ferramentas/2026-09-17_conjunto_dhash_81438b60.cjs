/** SOMENTE LEITURA — o aviso de CONJUNTO e viavel com o dhash ja gravado? */
const { supa } = require("./_comum.cjs");

function distancia(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { n += x & 1; x >>= 1; }
  }
  return n;
}
const mediana = (v) => { const s=[...v].sort((a,b)=>a-b); const m=s.length>>1;
  return s.length%2 ? s[m] : Math.round((s[m-1]+s[m])/2); };

(async () => {
  const db = supa();
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await db.from("sgp_pedidos").select("sessao, email, fotos").gte("criado_em", desde);

  const lotes = [];
  for (const p of data ?? []) {
    const fs = (Array.isArray(p.fotos) ? p.fotos : []).filter((f) => f?.dhash && f.dhash.length === 64);
    if (fs.length < 3) continue;
    const d = [];
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const x = distancia(fs[i].dhash, fs[j].dhash);
      if (x !== null) d.push(x);
    }
    if (!d.length) continue;
    const tipos = fs.map((f) => f.tipo);
    lotes.push({
      email: p.email, n: fs.length,
      min: Math.min(...d), med: mediana(d), max: Math.max(...d),
      monoTipo: new Set(tipos).size === 1,
      frontais: tipos.filter((t) => t === "rosto_frente").length,
      perfis: fs.filter((f) => f.perfil === true).length,
    });
  }

  console.log("lotes com >=3 fotos com dhash novo:", lotes.length);
  const meds = lotes.map((l) => l.med).sort((a, b) => a - b);
  const q = (p) => meds[Math.floor(meds.length * p)];
  console.log("mediana da distancia INTRA-lote — p10:", q(0.1), "p25:", q(0.25), "p50:", q(0.5), "p75:", q(0.75), "p90:", q(0.9));
  console.log("(DHASH_LIMITE=12 = 'foto repetida'; par distinto mais proximo medido em 11/09 = 23)");

  for (const lim of [24, 28, 32, 36]) {
    const n = lotes.filter((l) => l.med <= lim).length;
    console.log(`  lotes com mediana <= ${lim}: ${n} (${(100*n/lotes.length).toFixed(1)}%)`);
  }

  const iran = lotes.find((l) => (l.email || "").includes("iran"));
  console.log("\ncaso IRAN:", iran ? JSON.stringify({ ...iran, email: "iran@..." }) : "nao esta nos 30 dias / sem dhash novo");

  const piores = [...lotes].sort((a, b) => a.med - b.med).slice(0, 8);
  console.log("\n8 lotes mais monotonos (os que o aviso pegaria primeiro):");
  for (const l of piores) console.log(`  n=${l.n} min=${l.min} med=${l.med} max=${l.max} monoTipo=${l.monoTipo} frontais=${l.frontais} perfis=${l.perfis}`);
})();
