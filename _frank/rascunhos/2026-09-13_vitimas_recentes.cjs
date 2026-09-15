const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  for (const email of ["goudardexecutivo@gmail.com","gabriel.reis2212.pt@gmail.com"]) {
    const { data: p } = await db.from("profiles").select("id,email,credits_extra,access_until,created_at").eq("email",email);
    if (!p?.length) { console.log(`\n### ${email}: SEM PERFIL`); continue; }
    const u = p[0];
    console.log(`\n########## ${email}`);
    console.log(`  user=${u.id.slice(0,8)} creditos=${u.credits_extra} acesso_ate=${u.access_until}`);
    const { data: g } = await db.from("generations")
      .select("id,status,created_at,error_message,duration_seconds,audio_path")
      .eq("user_id",u.id).order("created_at",{ascending:false}).limit(12);
    console.log(`  ULTIMAS ${g.length} GERACOES:`);
    for (const x of g) console.log(`    ${x.created_at} · ${x.id.slice(0,8)} · ${String(x.status).padEnd(9)} · dur=${x.duration_seconds ?? "-"} · ${String(x.error_message||"").slice(0,60)}`);
    const { data: v } = await db.from("voices").select("id,status,created_at").eq("user_id",u.id).order("created_at",{ascending:false}).limit(5);
    console.log(`  VOZES: ${(v||[]).map(x=>`${x.id.slice(0,8)}:${x.status}`).join(", ")||"nenhuma"}`);
  }
})();
