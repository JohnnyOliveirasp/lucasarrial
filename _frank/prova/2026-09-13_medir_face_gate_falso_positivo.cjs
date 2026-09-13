#!/usr/bin/env node
/**
 * medir_face_gate_falso_positivo.cjs — o gate de rosto do Video Clone REJEITA
 * as imagens que a NOSSA PROPRIA plataforma gerou?
 *
 * POR QUE EXISTE: o cartao #371 (12/09 23:57Z) traz uma aluna dizendo que "nao
 * consegue usar NENHUMA foto no Video Clone, nem as geradas pela propria
 * plataforma". O bloqueio acontece em `video-clone/route.ts:155`, ANTES de
 * criar a linha em `video_clones` e ANTES de cobrar — entao a recusa NAO deixa
 * rastro nenhum no banco (so um `console.log` que vai pro stdout do pm2).
 * Sem medir, o caso e indistinguivel de "a aluna nao entendeu a tela".
 *
 * O QUE ELE FAZ: pega as imagens `ready` da propria aluna, assina a URL do R2
 * igual a producao (`createPresignedGet`, 600s) e roda o MESMO julgamento —
 * as constantes MODEL e SYSTEM sao LIDAS DO ARQUIVO DE PRODUCAO em tempo de
 * execucao (nao copiadas), pra medicao e codigo nao poderem divergir.
 *
 * LEITURA PURA: nao escreve no banco, nao cria video_clone, nao cobra, nao
 * toca em credito. So le e pergunta pro Haiku.
 *
 * uso: node 2026-09-13_medir_face_gate_falso_positivo.cjs <email> [--n 6] [--repetir 2]
 */
const path = require("node:path");
const fs = require("node:fs");
const { supa, BUCKETS, urlAssinada, RAIZ } = require(path.join(__dirname, "..", "ferramentas", "_comum.cjs"));

const FONTE = path.join(RAIZ, "frontend", "src", "lib", "video-clone", "face-gate.ts");

// --- constantes LIDAS do arquivo de producao (nao copiadas) ---
function constantesDeProducao() {
  const src = fs.readFileSync(FONTE, "utf8");
  const mModel = src.match(/const MODEL = "([^"]+)"/);
  const mSystem = src.match(/const SYSTEM = `([\s\S]*?)`;/);
  if (!mModel || !mSystem) {
    throw new Error(
      `nao consegui extrair MODEL/SYSTEM de ${FONTE}. O arquivo mudou de forma: ` +
        "PARE e confira antes de medir — medir com constante errada e pior que nao medir.",
    );
  }
  return { MODEL: mModel[1], SYSTEM: mSystem[1] };
}

// mesma decisao do face-gate.ts: so passa se frontal===true E mouth_visible===true
async function julgar(imageUrl, { MODEL, SYSTEM }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente — sem ela a producao faz FAIL-OPEN e nada e bloqueado");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 150,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: "Inspect this photo. JSON only." },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content ?? []).find((b) => b.type === "text")?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("sem JSON na resposta");
  const p = JSON.parse(m[0]);
  const passa = p.frontal === true && p.mouth_visible === true;
  return { passa, frontal: p.frontal, boca: p.mouth_visible, motivo: (p.reason ?? "").trim() };
}

(async () => {
  const argv = process.argv.slice(2);
  const email = argv.find((a) => !a.startsWith("--"));
  if (!email) throw new Error("uso: node ... <email> [--n 6] [--repetir 2]");
  const n = Number(argv[argv.indexOf("--n") + 1]) || 6;
  const repetir = Number(argv[argv.indexOf("--repetir") + 1]) || 1;

  const K = constantesDeProducao();
  console.log(`# gate de producao lido de ${path.relative(RAIZ, FONTE)}`);
  console.log(`  MODEL = ${K.MODEL} · SYSTEM = ${K.SYSTEM.length} chars\n`);

  const db = supa();
  const { data: prof } = await db.from("profiles").select("id, email").eq("email", email).maybeSingle();
  if (!prof) throw new Error(`sem perfil para ${email}`);

  const { data: imgs, error } = await db
    .from("image_generations")
    .select("id, status, image_path, created_at")
    .eq("user_id", prof.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(n);
  if (error) throw new Error(error.message);

  console.log(`# ${imgs.length} imagens 'ready' de ${email} (as ${n} mais novas)\n`);
  const bucket = BUCKETS.imagens();
  let bloqueadas = 0;
  const linhas = [];

  for (const img of imgs) {
    if (!img.image_path) { console.log(`- ${img.id} SEM image_path — pulada`); continue; }
    const url = await urlAssinada(bucket, img.image_path, 600);
    const passadas = [];
    for (let i = 0; i < repetir; i++) {
      try { passadas.push(await julgar(url, K)); }
      catch (e) { passadas.push({ erro: e.message }); }
    }
    const algumBloqueio = passadas.some((p) => p.passa === false);
    if (algumBloqueio) bloqueadas++;
    const resumo = passadas
      .map((p) => (p.erro ? `ERRO(${p.erro})` : p.passa ? "PASSA" : `BLOQUEIA[frontal=${p.frontal} boca=${p.boca}] "${p.motivo}"`))
      .join("  |  ");
    const inst = passadas.every((p) => p.erro || p.passa) || passadas.every((p) => p.erro || p.passa === false)
      ? "" : "   ⚠️ INSTAVEL (a mesma imagem muda de veredito entre passadas)";
    console.log(`- ${img.created_at}  ${img.id}\n    ${resumo}${inst}`);
    linhas.push({ id: img.id, created_at: img.created_at, passadas });
  }

  console.log(`\n## PLACAR: ${bloqueadas}/${imgs.length} imagens da PROPRIA plataforma seriam BLOQUEADAS no Video Clone`);
  console.log(`   (repeticoes por imagem: ${repetir})`);
  console.log("   Recorte: so as imagens 'ready' mais novas desta aluna. NAO e amostra da base inteira.");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
