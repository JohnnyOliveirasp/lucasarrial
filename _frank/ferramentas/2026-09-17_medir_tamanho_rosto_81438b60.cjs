/**
 * SOMENTE LEITURA — incidente 81438b60.
 * Pergunta 3: existe alguma medida de tamanho/bbox de rosto gravada nos
 * uploads dos ultimos 30 dias? Se nao, o que EXISTE que sirva de proxy?
 */
const { supa } = require("./_comum.cjs");

(async () => {
  const db = supa();
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();

  // 1) SGP: fotos jsonb por pedido
  const { data: peds, error: e1 } = await db
    .from("sgp_pedidos")
    .select("sessao, criado_em, fotos")
    .gte("criado_em", desde);
  if (e1) { console.log("ERRO sgp_pedidos:", e1.message); }

  let nFotos = 0, nPedidosComFoto = 0;
  const porTipo = {}, chaves = new Set();
  let perfilTrue = 0, perfilFalse = 0, perfilAusente = 0;
  const lotes = []; // por pedido: {n, tipos, perfis}

  for (const p of peds ?? []) {
    const fs = Array.isArray(p.fotos) ? p.fotos : [];
    if (!fs.length) continue;
    nPedidosComFoto++;
    const tipos = [], perfis = [];
    for (const f of fs) {
      nFotos++;
      Object.keys(f || {}).forEach((k) => chaves.add(k));
      const t = f?.tipo ?? "(ausente)";
      porTipo[t] = (porTipo[t] || 0) + 1;
      tipos.push(t);
      if (f?.perfil === true) { perfilTrue++; perfis.push(true); }
      else if (f?.perfil === false) { perfilFalse++; perfis.push(false); }
      else { perfilAusente++; perfis.push(null); }
    }
    lotes.push({ n: fs.length, tipos, perfis });
  }

  console.log("=== SGP sgp_pedidos, ultimos 30 dias ===");
  console.log("pedidos com >=1 foto:", nPedidosComFoto, "| fotos:", nFotos);
  console.log("CAMPOS que existem por foto:", [...chaves].sort().join(", ") || "(nenhum)");
  console.log("distribuicao de `tipo`:", JSON.stringify(porTipo));
  console.log("perfil: true=", perfilTrue, "false=", perfilFalse, "ausente=", perfilAusente);

  // 2) Lote monotono: todas as fotos do pedido com o MESMO tipo
  const monoTipo = lotes.filter((l) => l.n >= 3 && new Set(l.tipos).size === 1).length;
  const lotes3 = lotes.filter((l) => l.n >= 3).length;
  console.log("lotes com >=3 fotos:", lotes3, "| desses, TODAS do mesmo `tipo`:", monoTipo);

  // 3) Lote sem nenhuma frontal
  const semFrontal = lotes.filter((l) => l.n >= 3 && !l.tipos.includes("rosto_frente")).length;
  const umaFrontal = lotes.filter((l) => l.n >= 3 && l.tipos.filter((t) => t === "rosto_frente").length === 1).length;
  console.log("lotes >=3 SEM nenhuma rosto_frente:", semFrontal, "| com exatamente UMA:", umaFrontal);

  // 4) face_gate_recusas (video-clone)
  const { data: rec, error: e2 } = await db
    .from("face_gate_recusas")
    .select("resultado, motivo, created_at")
    .gte("created_at", desde);
  if (e2) console.log("ERRO face_gate_recusas:", e2.message);
  else {
    const porRes = {};
    for (const r of rec ?? []) porRes[r.resultado] = (porRes[r.resultado] || 0) + 1;
    console.log("\n=== face_gate_recusas, 30 dias ===");
    console.log("linhas:", (rec ?? []).length, JSON.stringify(porRes));
    console.log("NOTA: aprovacao olhada NAO grava linha — o denominador do gate nao esta no banco.");
  }

  // 5) Existe QUALQUER coluna de bbox/tamanho em algum lugar?
  console.log("\n=== busca por medida de bbox/tamanho ===");
  for (const [tab, cols] of [["image_generations", "id"], ["video_clones", "id"]]) {
    const { error } = await db.from(tab).select(cols).limit(1);
    console.log(tab, error ? "erro: " + error.message : "existe (sem coluna de bbox no schema — ver .sql)");
  }
})();
