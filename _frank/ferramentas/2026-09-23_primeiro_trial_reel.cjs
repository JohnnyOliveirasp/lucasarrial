#!/usr/bin/env node
/**
 * O PRIMEIRO Trial Reel de verdade da casa — conta johnny.oliveira.ai.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 * O caminho do Reel de teste esta inteiro em producao desde 23/09 (container
 * com trial_params, seletor na tela, e os guardrails do PR #420), mas NUNCA
 * foi exercitado contra a Meta. Zero Reels publicados na historia da tabela
 * `publications` — o unico registro e uma imagem de 27/08. Codigo provado em
 * teste nao e caminho provado: este script existe pra tirar essa duvida.
 *
 * ⚠️ AUTORIZACAO: Johnny, 23/09, "faz isso nessa ordem o mais rapido possivel",
 * respondendo a proposta de (1) guardrails e (2) primeiro Reel de teste real.
 * Os guardrails subiram primeiro e foram conferidos em producao (literais das
 * 4 regras presentes em .next/server/chunks/9520.js, pm2 reiniciado 20:10Z).
 *
 * ── Escolhas deliberadas, e o porque de cada uma ──────────────────────────
 * CONTA: johnny.oliveira.ai, do proprio Johnny. Ha 8 contas conectadas, 6 de
 * ALUNO e uma do Lucas. Estrear recurso novo em conta de aluno seria usar o
 * publico dele como cobaia — o risco da estreia e da casa.
 *
 * VIDEO: video_clone 032a3303 (29/08). NAO escolhi no escuro: baixei do R2,
 * conferi o formato (480x832 vertical, 61,5s, com faixa de audio — cabe em
 * Reels), OLHEI os quadros e TRANSCREVI o audio. E o video instrucional que
 * ensina o aluno a gravar o audio da clonagem. Publicar no perfil publico do
 * Johnny um video que eu nao tinha visto seria descuido, nao velocidade.
 *
 * TRIAL: `graduation_strategy: MANUAL` de proposito. Na estrategia automatica
 * o Reel VIRA post normal sozinho se for bem — e a estreia nao pode decidir
 * isso pelo dono do perfil. Com MANUAL, ele fica so entre nao-seguidores ate
 * alguem mandar o contrario.
 *
 * ⚠️ POR QUE INSERIR A LINHA em vez de chamar a rota: a rota exige a SESSAO do
 * Johnny, que eu nao tenho. A linha entra no mesmo estado que a rota criaria,
 * e quem publica e o sweep do Hetzner chamando `startPublication` — ou seja, o
 * caminho de envio exercitado e o REAL, guardrails inclusive. O unico passo
 * pulado e a resolucao de dono da rota, que existe pra impedir cliente nao
 * confiavel de publicar arquivo alheio; aqui o dono foi conferido no banco
 * antes de gravar (a conta E o video tem que ser do MESMO usuario, ou aborta).
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-23_primeiro_trial_reel.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");

const EMAIL = "johnny.oliveirasp@gmail.com";
const CONTA = "eb47e610-870f-4df9-97cc-92533c68fba9"; // @johnny.oliveira.ai
const CLONE = "032a3303-5851-44de-8a02-94d01bb77ce6";
const BUCKET = "voices-clone-ai-verse";
const CONFIRMAR = process.argv.includes("--confirmar");

const LEGENDA = `Se você vai clonar a sua voz, o que decide o resultado não é o microfone. É o ambiente.

Sem eco, sem barulho de fundo, sem ninguém falando junto. 20 minutos de fala limpa valem mais que 60 de áudio sujo.

E não precisa gravar tudo de uma vez: mande vários arquivos que a plataforma vai somando os minutos.

#clonedevoz #inteligenciaartificial #criadordeconteudo #vozia #conteudodigital #marketingdigital`;

(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db.from("profiles").select("id,email").eq("email", EMAIL);
  if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
  if (profs.length !== 1) { console.error("perfil nao encontrado — PARE."); process.exit(1); }
  const dono = profs[0].id;

  // A CONTA e do dono?
  const { data: contas, error: ec } = await db.from("social_accounts")
    .select("id,user_id,platform,username,status").eq("id", CONTA);
  if (ec) { console.error("ERRO social_accounts:", ec.message); process.exit(1); }
  if (contas.length !== 1) { console.error("conta nao encontrada — PARE."); process.exit(1); }
  const conta = contas[0];
  if (conta.user_id !== dono) { console.error("a conta NAO e do dono — PARE."); process.exit(1); }
  if (conta.status !== "active") { console.error(`conta status=${conta.status}, nao 'active' — PARE.`); process.exit(1); }
  console.log(`conta @${conta.username} (${conta.platform}) · ativa · dono confere`);

  // O VIDEO e do MESMO dono? (senao publicaria arquivo de outro)
  const { data: clones, error: ev } = await db.from("video_clones")
    .select("id,user_id,status,video_path,duration_seconds").eq("id", CLONE);
  if (ev) { console.error("ERRO video_clones:", ev.message); process.exit(1); }
  if (clones.length !== 1) { console.error("clone nao encontrado — PARE."); process.exit(1); }
  const clone = clones[0];
  if (clone.user_id !== dono) { console.error("o video NAO e do mesmo dono — PARE."); process.exit(1); }
  if (clone.status !== "ready") { console.error(`clone status=${clone.status} — PARE.`); process.exit(1); }
  if (!clone.video_path) { console.error("clone sem video_path — PARE."); process.exit(1); }
  const mediaUrl = `r2://${BUCKET}/${clone.video_path}`;
  console.log(`video ${CLONE.slice(0, 8)} · ${clone.duration_seconds}s · ${mediaUrl.slice(0, 70)}…`);

  // JA EXISTE trial nesta conta? (nao duplicar a estreia)
  const { data: jaTem, error: ej } = await db.from("publications")
    .select("id,status,created_at").eq("account_id", CONTA).eq("media_url", mediaUrl);
  if (ej) { console.error("ERRO publications:", ej.message); process.exit(1); }
  if (jaTem.length) {
    console.log(`JA EXISTE ${jaTem.length} publicacao deste video nesta conta — PULO (o dedupe barraria de qualquer jeito).`);
    for (const p of jaTem) console.log(`  ${p.id.slice(0, 8)} ${p.status} ${p.created_at}`);
    return;
  }

  console.log(`\nPLANO: criar publicacao REEL DE TESTE (graduation_strategy MANUAL)`);
  console.log(`  legenda (${LEGENDA.length} chars): ${LEGENDA.split("\n")[0]}…`);
  if (!CONFIRMAR) { console.log("\n(ENSAIO — nada gravado. Repita com --confirmar.)"); return; }

  const { data: criada, error: e2 } = await db.from("publications").insert({
    user_id: dono,
    account_id: CONTA,
    platform: "instagram",
    media_type: "reel",
    media_url: mediaUrl,
    caption: LEGENDA,
    status: "ready",
    platform_options: { is_trial: true, graduation_strategy: "MANUAL" },
  }).select("*").single();
  if (e2 || !criada) { console.error("INSERT FALHOU:", e2?.message); process.exit(1); }

  console.log(`\nCRIADA ${criada.id}`);
  console.log(`  status=${criada.status} · is_trial=${criada.platform_options?.is_trial} · estrategia=${criada.platform_options?.graduation_strategy}`);
  console.log(`  o sweep do Hetzner (1-5 min) publica. NAO diga que foi publicado ate ver platform_post_id.`);
})();
