/**
 * REARMAR uma voz `failed` para `awaiting_training`, quando a morte foi
 * INFRAESTRUTURA NOSSA — o passo que falta antes de
 * `2026-09-15_retreinar_sgp.cjs` conseguir disparar.
 *
 * ── Por que esta ferramenta existe ────────────────────────────────────────
 * O retreinador do SGP (#420, 15/09) aborta com
 *   "status 'failed' != awaiting_training (a produção recusa)"
 * porque `dispararTreinoOnboarding` só aceita voz em `awaiting_training`. Na
 * ronda de 15/09 alguém rearmou a voz do Ricardo À MÃO e isso não ficou em
 * lugar nenhum: em 17/09 o mesmo vão reapareceu no Alberto (`0bf47f6a`) e eu
 * tive de redescobrir o passo. Agora é ferramenta, com as travas escritas.
 *
 * ── O que ela NÃO faz, de propósito ───────────────────────────────────────
 * Ela **não dispara treino** e **não mexe em crédito**. Só rearma o estado.
 * Quem dispara é a ferramenta do SGP, que carrega a receita de PRODUÇÃO.
 *
 * ── ⚠️ 18/09: a trava 2 tinha um FALSO NEGATIVO que travou um aluno ───────
 * Nasci lendo a prova de infra SÓ em `trainer_stderr`. Medido no #32
 * (`9119254c`, disco cheio, 39 dias) em 18/09: a falha tem DUAS formas, e a
 * minha leitura só enxergava uma.
 *
 *   forma A — o trainer RODOU e morreu no meio: `trainer_returncode=1`,
 *     `trainer_stderr` tem a marca, e `error_message` é o genérico
 *     "trainer failed". Ex.: `bbf4b050` (Alberto, 17/09).
 *   forma B — a coisa morreu ANTES do trainer subir (download/descompactação):
 *     `started_at`, `trainer_returncode`, `trainer_stderr` e `trainer_stdout`
 *     TODOS nulos, e a marca está em `error_message`, crua:
 *     "[Errno 28] No space left on device". Ex.: `b76f9ec0` (Alexandre
 *     Scalzitti, 18/09 09:17Z) e `76cdefc2` (10/08) — as DUAS ocorrências do
 *     #32, ou seja, justamente a classe pra que esta ferramenta serve.
 *
 * Na forma B eu recusava com "causa CEGA, não rearmo às cegas". A causa não
 * era cega: estava escrita, em outra coluna. E o preço do falso negativo é
 * concreto — o pedido SGP `251b2b1e` do Alexandre ficou em `falhou`, estado
 * sem saída, enquanto a tela dele prometia "o retreino é por nossa conta".
 *
 * A trava agora procura a marca em `trainer_stderr` **e** em `error_message`,
 * pela MESMA lista fechada. O que NÃO mudou: sem marca da lista nas duas
 * colunas, a recusa continua. Mensagem genérica ("trainer failed", "unknown")
 * não passa, e material do aluno nunca passou.
 *
 * ── As travas (todas medidas, nenhuma suposta) ────────────────────────────
 * 1. A voz tem de estar `failed`. Rearmar voz `ready` apagaria entrega boa.
 * 2. O ÚLTIMO training_job dela tem de ter morrido por causa de INFRA NOSSA,
 *    provada por uma marca da lista fechada em `trainer_stderr` OU em
 *    `error_message` (disco cheio / OOM de GPU). Se nenhuma das duas colunas
 *    carrega marca, a ferramenta RECUSA — rearmar às cegas gasta GPU da casa
 *    pra morrer igual.
 * 3. `raw_audio_paths` tem de ter arquivo. Sem áudio não há o que treinar.
 * 4. Ela imprime o extrato por `ref_id` ANTES e não segue se houver débito
 *    pendente pra essa voz sem estorno — o aluno não paga falha nossa.
 * 5. Sem `--confirmar` não grava nada. Com `--confirmar`, RELÊ o banco depois
 *    e imprime o que o banco diz, não o que o script planejava (ensaio não é
 *    entrega; update por id inexistente afeta 0 linhas em silêncio).
 *
 * ── Uso ───────────────────────────────────────────────────────────────────
 *   node 2026-09-17_rearmar_voz_para_retreino.cjs <voiceId>              # simula
 *   node 2026-09-17_rearmar_voz_para_retreino.cjs <voiceId> --confirmar  # grava
 */
const path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
const { supa } = require(path.join(RAIZ, "_frank/ferramentas/_comum.cjs"));

/** Marcas de INFRA NOSSA. Lista fechada, de propósito. */
const INFRA = [
  { marca: "No space left on device", causa: "disco cheio no worker" },
  { marca: "torch.OutOfMemoryError", causa: "OOM de GPU" },
  { marca: "CUDA out of memory", causa: "OOM de GPU" },
];

/**
 * Procura a marca de infra nas DUAS colunas onde ela pode aparecer, e diz em
 * QUAL delas achou — porque "não achei" e "achei no lugar que eu não olhava"
 * são diagnósticos diferentes, e foi a confusão entre os dois que travou o
 * Alexandre (ver cabeçalho, 18/09).
 *
 * Caixa ignorada de propósito: a mesma falha sai "No space left on device" do
 * runtime Python e "no space left on device" de camadas em C.
 */
function acharInfra(job) {
  const colunas = [
    ["trainer_stderr", job?.trainer_stderr || ""],
    ["error_message", job?.error_message || ""],
  ];
  for (const [coluna, texto] of colunas) {
    const achado = INFRA.find((i) => texto.toLowerCase().includes(i.marca.toLowerCase()));
    if (achado) return { ...achado, coluna, texto };
  }
  return null;
}

module.exports = { INFRA, acharInfra };

async function main() {
  const voiceId = process.argv[2];
  const confirmar = process.argv.includes("--confirmar");
  if (!voiceId) {
    console.error("uso: node 2026-09-17_rearmar_voz_para_retreino.cjs <voiceId> [--confirmar]");
    process.exit(2);
  }
  const db = supa();

  const { data: voice, error: eV } = await db
    .from("voices")
    .select("id, user_id, status, raw_audio_paths, duration_seconds, runpod_job_id, error_message, trained_at")
    .eq("id", voiceId)
    .maybeSingle();
  if (eV) throw new Error(`voices: ${eV.message}`);
  if (!voice) throw new Error(`voz ${voiceId} não existe`);

  const { data: prof } = await db
    .from("profiles").select("id, email, display_name").eq("id", voice.user_id).maybeSingle();

  const { data: jobs, error: eJ } = await db
    .from("training_jobs")
    .select("id, status, error_message, trainer_returncode, trainer_stderr, trainer_stdout, started_at, elapsed_seconds, created_at")
    .eq("voice_id", voiceId);
  if (eJ) throw new Error(`training_jobs: ${eJ.message}`);
  jobs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const ultimo = jobs[jobs.length - 1];

  const { data: tx, error: eT } = await db
    .from("credit_transactions").select("id, kind, amount, ref_type, ref_id, created_at").eq("ref_id", voiceId);
  if (eT) throw new Error(`credit_transactions: ${eT.message}`);
  const soma = (tx || []).reduce((s, t) => s + Number(t.amount || 0), 0);

  const stderr = ultimo?.trainer_stderr || "";
  const achado = acharInfra(ultimo);

  console.log("── ALVO ────────────────────────────────────────────────");
  console.log("  voz        :", voice.id);
  console.log("  aluno      :", prof?.email, `(${prof?.display_name ?? "?"})`);
  console.log("  status voz :", voice.status);
  console.log("  áudios     :", (voice.raw_audio_paths || []).length, "arquivo(s)", `(${voice.duration_seconds}s)`);
  console.log("── ÚLTIMO TREINO ───────────────────────────────────────");
  console.log("  job        :", ultimo?.id, ultimo?.status, `rc=${ultimo?.trainer_returncode}`, `el=${ultimo?.elapsed_seconds}s`);
  console.log("  stderr     :", stderr ? `${stderr.length} chars` : "AUSENTE");
  console.log("  error_msg  :", ultimo?.error_message || "AUSENTE");
  console.log(
    "  forma      :",
    ultimo?.trainer_stderr || ultimo?.trainer_returncode !== null
      ? "A (o trainer subiu e morreu)"
      : "B (morreu ANTES do trainer — stderr não existe por desenho)",
  );
  console.log(
    "  causa infra:",
    achado ? `SIM — ${achado.causa} ("${achado.marca}", achada em ${achado.coluna})` : "NÃO RECONHECIDA",
  );
  console.log("── DINHEIRO (por ref_id, nunca por kind) ───────────────");
  console.log("  linhas p/ esta voz:", (tx || []).length, "| soma do sinal:", soma);
  for (const t of tx || []) console.log("    ", t.ref_type, t.kind, t.amount, t.created_at);

  const problemas = [];
  if (voice.status !== "failed") problemas.push(`status '${voice.status}' != failed (só rearmo voz morta)`);
  if (!Array.isArray(voice.raw_audio_paths) || voice.raw_audio_paths.length === 0)
    problemas.push("sem áudios em raw_audio_paths — não há o que treinar");
  if (!ultimo) problemas.push("nenhum training_job para esta voz");
  else if (!achado)
    problemas.push(
      "nem trainer_stderr nem error_message batem com marca de infra nossa — causa CEGA ou material do aluno, não rearmo às cegas",
    );
  if (soma < 0) problemas.push(`extrato com débito pendente (soma ${soma}) — estorne ANTES de rearmar`);

  if (problemas.length) {
    console.log("\n❌ NÃO REARMO:");
    for (const p of problemas) console.log("   -", p);
    process.exit(1);
  }

  if (!confirmar) {
    console.log("\n🔎 SIMULAÇÃO — nada gravado.");
    console.log("   Com --confirmar: status -> awaiting_training, error_message -> null.");
    console.log("   Depois disso, dispare com 2026-09-15_retreinar_sgp.cjs <voiceId> --confirmar");
    return;
  }

  const { data: gravado, error: eU } = await db
    .from("voices")
    .update({ status: "awaiting_training", error_message: null })
    .eq("id", voiceId)
    .eq("status", "failed")            // trava de corrida: só se ainda estiver failed
    .select("id, status, error_message, updated_at");
  if (eU) throw new Error(`update voices: ${eU.message}`);
  console.log("\n── LINHAS AFETADAS PELO UPDATE:", (gravado || []).length);
  if ((gravado || []).length !== 1) {
    console.log("⚠️  esperava 1 linha. NÃO afirme que rearmou — confira antes de seguir.");
    process.exit(1);
  }

  const { data: depois } = await db
    .from("voices").select("id, status, error_message, updated_at").eq("id", voiceId).maybeSingle();
  console.log("── O QUE O BANCO DIZ AGORA ────────────────────────────");
  console.log("  status     :", depois?.status);
  console.log("  error_msg  :", depois?.error_message);
  console.log("  updated_at :", depois?.updated_at);
  console.log("\n➡️  agora: node 2026-09-15_retreinar_sgp.cjs", voiceId, "--confirmar");
}

// Só roda quando chamado pela linha de comando. Sem esta guarda o teste que
// dá `require` no módulo dispararia uma varredura de banco.
if (require.main === module) {
  main().catch((e) => {
    console.error("FALHOU:", e.message);
    process.exit(1);
  });
}
