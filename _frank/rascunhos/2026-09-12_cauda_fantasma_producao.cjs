/**
 * READ-ONLY. O portao de cura (train_reference.py:170-181) so rejeita por
 * cobertura UNIDIRECIONAL (previsto ⊆ real), e a poda de cauda fantasma
 * (:184-198) so casa IGUALDADE EXATA nos <=8 tokens FINAIS. Pergunta desta
 * medicao: isso ESTA acontecendo em producao, ou e' so uma cegueira teorica?
 * Conta transcripts de referencia que contem frase-fantasma conhecida FORA da
 * posicao final exata (= escapou da poda e passou pelo portao).
 */
const { supa } = require("../ferramentas/_comum.cjs");

const ACENTOS = { á:"a",à:"a",ã:"a",â:"a",é:"e",ê:"e",í:"i",ó:"o",ô:"o",õ:"o",ú:"u",ü:"u",ç:"c" };
const norm = (t) => (t || "").toLowerCase().replace(/[áàãâéêíóôõúüç]/g, (c) => ACENTOS[c] || c)
  .replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);

const CAUDAS = ["obrigado por assistir","obrigada por assistir","obrigado por assistirem",
  "legendas pela comunidade amara org","legendado pela comunidade amara org","legendas pela comunidade",
  "thanks for watching","subtitles by the amara org community","musica","aplausos","risos"];

(async () => {
  const db = supa();
  let de = 0, todas = [];
  for (;;) {
    const { data, error } = await db.from("voices")
      .select("id,name,user_id,reference_transcript,trained_at,status")
      .not("reference_transcript", "is", null)
      .order("trained_at", { ascending: true }).order("id", { ascending: true })
      .range(de, de + 999);
    if (error) throw error;
    todas = todas.concat(data);
    if (data.length < 1000) break;
    de += 1000;
  }
  console.log("vozes com reference_transcript:", todas.length);

  const achados = [];
  for (const v of todas) {
    const p = norm(v.reference_transcript);
    const texto = p.join(" ");
    for (const c of CAUDAS) {
      if (!texto.includes(c)) continue;
      const nc = c.split(" ").length;
      const noFim = p.slice(-nc).join(" ") === c;
      achados.push({ id: v.id, name: v.name, user_id: v.user_id, cauda: c, noFim,
        palavras: p.length, trecho: texto.slice(Math.max(0, texto.indexOf(c) - 45), texto.indexOf(c) + c.length + 25) });
      break;
    }
  }
  const fora = achados.filter((a) => !a.noFim);
  console.log("com frase-fantasma em qualquer posicao:", achados.length);
  console.log("FORA da posicao final exata (escapou da poda):", fora.length);
  for (const a of fora.slice(0, 25)) {
    console.log(`  ${a.id.slice(0,8)} "${a.name}" (${a.palavras} palavras) cauda="${a.cauda}"`);
    console.log(`     …${a.trecho}…`);
  }
})().catch((e) => { console.error("ERRO", e.message); process.exit(1); });
