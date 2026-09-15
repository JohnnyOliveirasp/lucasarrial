/**
 * RETREINAR uma voz do SGP que morreu por falha NOSSA — #420 (Ricardo Olito).
 *
 * ── O vão que esta ferramenta cobre (medido 15/09/2026, ronda das 22h40Z) ──
 * O treino do `f58a158a` morreu por **CUDA out of memory** (disputa de GPU,
 * transitória, não é o áudio do aluno). A ronda anterior devolveu a voz para
 * `awaiting_training` e escreveu no pedido que *"o retreino está disponível"*.
 *
 * **Não está.** Conferido em código, os TRÊS caminhos possíveis estão fechados
 * para este aluno:
 *
 * 1. `POST /api/v1/sgp/enviar` — `route.ts:29` exige `status === "revisao"`.
 *    O pedido está `falhou`, então o aluno leva `400 "Complete as etapas
 *    anteriores antes de enviar."` — uma mensagem falsa: ele completou tudo.
 * 2. `POST /api/v1/voices/[id]/start-training` — `route.ts:104` exige
 *    `bal.total >= TRAINING_CREDIT_COST` (10.000). O comprador do SGP tem
 *    **0 créditos por desenho** (comprar o SGP não concede crédito — ver
 *    `lib/credits/onboarding-cobranca.ts`), então leva `402
 *    insufficient_credits`. E mesmo que passasse, **cobrar seria errado**: o
 *    clone é entrega do produto que ele já pagou.
 * 3. `/admin/sgp/[id]/erro` e `/conclusao` — as duas rotas dizem, no próprio
 *    cabeçalho, que **NÃO mexem no `status`** de propósito (a máquina de
 *    estados é da produção). São anotação de suporte. Não existe rota de
 *    retreino/reprocessamento em lugar nenhum do `/admin`.
 *
 * Ou seja: o incidente estava em `aguardando_aluno` esperando uma ação que o
 * aluno **não tem como executar**, e que ele **não deveria** ter de executar.
 *
 * ── Por que a casa paga a GPU e o aluno não paga nada ─────────────────────
 * `deveCobrarOnboarding({origem:"sgp"})` é `false` por regra da casa (defeito
 * medido em 09/09: o SGP debitava 10.525 de carteira vazia e levava 12 perfis
 * a -126.300). Aqui o retreino sai por `origem: "sgp"`, então **não há débito
 * nenhum** — nem dívida, nem crédito concedido. O custo de GPU é da casa, que
 * é o certo: a falha foi nossa.
 *
 * ── Não copia a receita ────────────────────────────────────────────────────
 * Carrega `dispararTreinoOnboarding` de PRODUÇÃO por jiti e aborta se o export
 * sumir. Não existe cópia do disparo aqui — foi a CÓPIA da regra de MIME que
 * criou o vão do #351. Se a receita mudar lá (max_steps, timeout, chaves),
 * esta ferramenta muda junto sozinha.
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *   node 2026-09-15_retreinar_sgp.cjs <voiceId>              # SIMULA
 *   node 2026-09-15_retreinar_sgp.cjs <voiceId> --confirmar  # dispara
 *
 * Sem `--confirmar` ele NÃO despacha nada: só confere as pré-condições e diz o
 * que faria. Com `--confirmar`, relê o banco DEPOIS de gravar e imprime o que o
 * BANCO confirma — não o que o script planejava fazer (ensaio não é entrega).
 */
const path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
const { supa } = require(path.join(RAIZ, "_frank/ferramentas/_comum.cjs"));

const createJiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"));
const jiti = (createJiti.default || createJiti)(path.join(RAIZ, "frontend", "noop.js"), {
  alias: { "@": path.join(RAIZ, "frontend", "src") },
  interopDefault: true,
});

const { dispararTreinoOnboarding } = jiti(
  path.join(RAIZ, "frontend", "src", "lib", "onboarding", "treino.ts"),
);
if (typeof dispararTreinoOnboarding !== "function") {
  throw new Error(
    "treino.ts não exporta dispararTreinoOnboarding() — ferramenta abortada (não vou adivinhar o disparo)",
  );
}
const { deveCobrarOnboarding } = jiti(
  path.join(RAIZ, "frontend", "src", "lib", "credits", "onboarding-cobranca.ts"),
);
if (typeof deveCobrarOnboarding !== "function") {
  throw new Error("onboarding-cobranca.ts não exporta deveCobrarOnboarding() — abortado");
}

async function main() {
  const voiceId = process.argv[2];
  const confirmar = process.argv.includes("--confirmar");
  if (!voiceId) {
    console.error("uso: node 2026-09-15_retreinar_sgp.cjs <voiceId> [--confirmar]");
    process.exit(2);
  }

  const db = supa();

  const { data: voice, error: eV } = await db
    .from("voices")
    .select("id, user_id, status, raw_audio_paths, duration_seconds, runpod_job_id, trained_at")
    .eq("id", voiceId)
    .maybeSingle();
  if (eV) throw new Error(`voices: ${eV.message}`);
  if (!voice) throw new Error(`voz ${voiceId} não existe`);

  const { data: prof } = await db
    .from("profiles")
    .select("id, email, display_name, credits_subscription, credits_extra")
    .eq("id", voice.user_id)
    .maybeSingle();

  const { data: ped } = await db
    .from("sgp_pedidos")
    .select("id, status, nome, email, erro")
    .eq("voice_id", voiceId)
    .maybeSingle();

  // Débito que EXISTE hoje (por ref_id — nunca por kind; armadilha de 20/08).
  const { data: tx } = await db
    .from("credit_transactions")
    .select("id, kind, amount, ref_type, ref_id, created_at")
    .eq("ref_id", voiceId);

  const saldo = (prof?.credits_subscription ?? 0) + (prof?.credits_extra ?? 0);
  const cobraria = deveCobrarOnboarding({ origem: "sgp", bypass: false });

  console.log("── ALVO ────────────────────────────────────────────────");
  console.log("  voz        :", voice.id);
  console.log("  aluno      :", prof?.email, `(${prof?.display_name ?? "?"})`);
  console.log("  pedido SGP :", ped?.id, "status:", ped?.status);
  console.log("  status voz :", voice.status);
  console.log("  áudios     :", (voice.raw_audio_paths || []).length, "arquivo(s)");
  console.log("  duração    :", voice.duration_seconds, "s");
  console.log("  job antigo :", voice.runpod_job_id);
  console.log("── DINHEIRO (por ref_id, nunca por kind) ───────────────");
  console.log("  saldo do aluno       :", saldo);
  console.log("  linhas em credit_transactions p/ esta voz:", (tx || []).length);
  for (const t of tx || []) console.log("    ", t.ref_type, t.kind, t.amount, t.created_at);
  console.log("  origem 'sgp' COBRA?  :", cobraria ? "SIM" : "NÃO (entrega do produto já pago)");

  // ── pré-condições da própria produção, conferidas antes ────────────────
  const problemas = [];
  if (voice.status !== "awaiting_training")
    problemas.push(`status '${voice.status}' != awaiting_training (a produção recusa)`);
  if (!Array.isArray(voice.raw_audio_paths) || voice.raw_audio_paths.length === 0)
    problemas.push("sem áudios em raw_audio_paths");
  if (cobraria) problemas.push("origem 'sgp' estaria COBRANDO — abortado, o aluno não pode pagar por falha nossa");

  if (problemas.length) {
    console.log("\n❌ NÃO DÁ PRA DISPARAR:");
    for (const p of problemas) console.log("   -", p);
    process.exit(1);
  }

  if (!confirmar) {
    console.log("\n🔎 SIMULAÇÃO — nada foi despachado.");
    console.log("   Rode com --confirmar para disparar o treino (GPU por conta da casa, aluno não é cobrado).");
    return;
  }

  console.log("\n🚀 disparando dispararTreinoOnboarding(..., origem='sgp') ...");
  const r = await dispararTreinoOnboarding(db, voice.user_id, voice.id, "sgp");
  console.log("   retorno da produção:", JSON.stringify(r));

  // ── o que o BANCO confirma DEPOIS de gravar ────────────────────────────
  const { data: depois } = await db
    .from("voices")
    .select("id, status, runpod_job_id, error_message, updated_at, trained_at")
    .eq("id", voiceId)
    .maybeSingle();
  const { data: txDepois } = await db
    .from("credit_transactions")
    .select("id, kind, amount, ref_type, created_at")
    .eq("ref_id", voiceId);

  console.log("\n── O QUE O BANCO DIZ AGORA ────────────────────────────");
  console.log("  status     :", depois?.status);
  console.log("  job novo   :", depois?.runpod_job_id, depois?.runpod_job_id === voice.runpod_job_id ? "(⚠️ IGUAL ao antigo)" : "(novo)");
  console.log("  error_msg  :", depois?.error_message);
  console.log("  updated_at :", depois?.updated_at);
  console.log("  linhas de crédito p/ esta voz:", (txDepois || []).length, "(era", (tx || []).length + ")");
  if ((txDepois || []).length !== (tx || []).length) {
    console.log("  ⚠️ APARECEU LINHA DE CRÉDITO — conferir, o SGP não deveria cobrar:");
    for (const t of txDepois || []) console.log("    ", t.ref_type, t.kind, t.amount, t.created_at);
  }
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
