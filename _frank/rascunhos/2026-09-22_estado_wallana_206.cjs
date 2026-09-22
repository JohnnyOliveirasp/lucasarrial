/** #206 Wallana — estado ATUAL antes de qualquer carta. SOMENTE LEITURA. */
const { supa } = require("../ferramentas/_comum.cjs");
const EMAIL = "wallanadaphiny@icloud.com";
function exigir(r, e){ if(e){ console.error(`❌ CONSULTA FALHOU (${r}): ${e.message}`); process.exit(1);} }
(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db.from("profiles").select("*").eq("email", EMAIL);
  exigir("profiles", ep);
  if (!profs.length) { console.log("NENHUM perfil com esse e-mail"); return; }
  const p = profs[0];
  console.log("=== PERFIL ===");
  for (const k of ["id","email","display_name","credits_subscription","credits_extra","access_until","plan","created_at","last_sign_in_at","updated_at"]) {
    if (k in p) console.log(`  ${k}: ${JSON.stringify(p[k])}`);
  }
  console.log("  (todas as colunas:", Object.keys(p).join(", "), ")");

  const { data: sgp, error: es } = await db.from("sgp_pedidos").select("*").eq("email", EMAIL).order("criado_em", { ascending: false });
  exigir("sgp_pedidos", es);
  console.log(`\n=== SGP PEDIDOS: ${sgp.length} ===`);
  for (const s of sgp) {
    const fotos = Array.isArray(s.fotos) ? s.fotos.length : s.fotos;
    const audios = Array.isArray(s.audios) ? s.audios.length : s.audios;
    console.log(`  ${s.id} · criado ${s.criado_em} · status ${s.status} · fotos ${fotos} · audios ${audios} · processado ${s.processado_em ?? "-"}`);
    if (Array.isArray(s.audios)) for (const a of s.audios) console.log(`      audio: ${JSON.stringify(a).slice(0,200)}`);
  }

  const { data: vz, error: ev } = await db.from("voices").select("id,name,status,created_at,updated_at,raw_audio_paths").eq("user_id", p.id);
  exigir("voices", ev);
  console.log(`\n=== VOZES: ${vz.length} ===`);
  for (const v of vz) console.log(`  ${v.id} · ${v.name} · ${v.status} · criada ${v.created_at} · arquivos ${Array.isArray(v.raw_audio_paths)?v.raw_audio_paths.length:"?"} `);

  const { data: ob, error: eo } = await db.from("onboarding_runs").select("id,ok,etapa_falha,motivo,criado_em").eq("email", EMAIL).order("criado_em",{ascending:false}).limit(10);
  if (eo) console.log("\n(onboarding_runs:", eo.message, ")"); else {
    console.log(`\n=== ONBOARDING RUNS: ${ob.length} ===`);
    for (const o of ob) console.log(`  ${o.id} · ok=${o.ok} · ${o.etapa_falha ?? "-"} · ${String(o.motivo??"").slice(0,120)} · ${o.criado_em}`);
  }

  const { data: pay, error: epay } = await db.from("payment_events").select("event_type,status,value,created_at,product_id").eq("email", EMAIL).order("created_at",{ascending:false}).limit(20);
  if (epay) console.log("\n(payment_events:", epay.message, ")"); else {
    console.log(`\n=== PAYMENT EVENTS: ${pay.length} ===`);
    for (const x of pay) console.log(`  ${x.created_at} · ${x.event_type} · ${x.status} · valor ${x.value} · prod ${x.product_id}`);
  }

  const { data: em, error: eem } = await db.from("emails_enviados").select("chave,assunto,enviado_em,origem").eq("para", EMAIL).order("enviado_em",{ascending:false});
  if (eem) console.log("\n(emails_enviados:", eem.message, ")"); else {
    console.log(`\n=== EMAILS REGISTRADOS (só cobre desde 14/09 14:06Z): ${em.length} ===`);
    for (const e of em) console.log(`  ${e.enviado_em} · ${e.chave} · ${e.assunto} · ${e.origem}`);
  }
})();
