/**
 * REABRIR o passo de ÁUDIO de um pedido do SGP — o aluno precisa mandar
 * material NOVO, e o pedido fechado não deixa. Caso real: Janice Silva
 * (`official.successwithnice@gmail.com`, pedido `09646e28`, 17/09/2026).
 *
 * ── O caso que abriu esta ferramenta ───────────────────────────────────────
 * Ela mandou 10:08 de PORTUGUÊS + 14:44 e 2:37 de INGLÊS no MESMO treino. O
 * pipeline treina UM idioma só, então 2/3 do material entrou com texto errado.
 * O medidor até percebeu — os dois arquivos em inglês têm
 * `avisos: ["volume baixo", "a fala parece não estar em português (english)"]`
 * gravados no próprio pedido — mas AVISO não barra: `status` ficou `aprovado`
 * nos três (`audio/route.ts:53`, o status sai de `m.aprovado`, que não olha o
 * idioma). Ela recebeu a voz, viu que não prestava e APAGOU a voz.
 *
 * Medido no banco em 17/09: `voices` do aluno = **0 linhas**; o CASCADE de
 * `training_jobs.voice_id` e `generations.voice_id` levou treino e gerações
 * junto (`generations` do aluno = 0). Ou seja **não há o que retreinar** — a
 * `2026-09-15_retreinar_sgp.cjs` aborta de propósito (`voz <id> não existe`) e
 * ela é a ferramenta errada aqui: aquela redispara o áudio ANTIGO, e o áudio
 * antigo é justamente o problema. Este caso é de RECEBER MATERIAL NOVO.
 *
 * ── Por que ela não consegue sozinha (conferido em código, 17/09) ─────────
 *   1. `/sgp` (entrada do wizard) roteia por status: o mapa `PROXIMA`
 *      (`app/[locale]/sgp/page.tsx:15-22`) manda `pronto` → `/app/sgp`. Ela
 *      NUNCA chega na tela 3.
 *   2. `/sgp/revisao` (`page.tsx:28`) desvia `enviado|processando|pronto|
 *      falhou` pra `/app/sgp`.
 *   3. `POST /api/v1/sgp/enviar` — a régua é `portaDoEnvio()`
 *      (`lib/sgp/porta-envio.ts:83-95`) e **só `revisao` devolve
 *      `{acao:"enviar"}`** (linha 84). `pronto` está em `JA_SAIU` (linha 57),
 *      então ela leva `200 jaEnviado` e é mandada pro `/sgp/acompanhar`.
 *   4. `POST /api/v1/voices/[id]/start-training` — existe, e HOJE ela até
 *      passaria no saldo (assinatura renovada, 100.000 créditos). **NÃO SE USA
 *      ESSE CAMINHO**: seria COBRAR do aluno a entrega do SGP que ele já
 *      pagou — `deveCobrarOnboarding({origem:"sgp"})` é `false` por regra da
 *      casa (`lib/credits/onboarding-cobranca.ts`), e foi essa cobrança que
 *      levou 12 perfis a -10.525 em 09/09.
 *
 * ── A transição CERTA (e por que é `audio`, não `revisao`) ────────────────
 * O destino é **`status = 'audio'`**, não `revisao`, porque só `audio` fecha as
 * DUAS pontas de que ela precisa:
 *   (a) TROCAR os arquivos — `/sgp/audio` (`page.tsx`) não olha status, só
 *       `email_verificado_at`; o botão "remover" existe
 *       (`step-audio-form.tsx:209` → `DELETE /api/v1/sgp/audio?key=`), e o
 *       `PROXIMA` do `/sgp` leva `audio` → `/sgp/audio` direto.
 *   (b) REENVIAR — `POST /api/v1/sgp/audio/concluir` promove
 *       `audio` → `revisao` e **só a partir de `audio`**:
 *       `status: pedido.status === "audio" ? "revisao" : pedido.status`
 *       (`audio/concluir/route.ts:38`). Deixar em `revisao` puláva a troca;
 *       deixar em qualquer outro status faria o `concluir` ser um no-op e ela
 *       voltaria a bater na porta fechada.
 *   Daí em diante quem anda é a produção, sem mais nada na mão:
 *   `audio` --concluir--> `revisao` --enviar--> `processando`.
 *
 * ── Por que `enviado_em` PRECISA ser limpo (não é cosmético) ──────────────
 * `estadoDasEtapas` (`lib/sgp/etapas.ts:49`) **reescreve o `status`**: calcula
 * `s.pronto ? "pronto" : s.falhou ? "falhou" : "processando"` (`etapas.ts:93`) a
 * partir de `statusOnboarding(user_id)` e grava por `carimbarStatus`. Com a
 * voz apagada, `desfechoOnboarding` devolve HOJE `{pronto:false, falhou:false}`
 * (voz `null` não é `ready` e não é `vozMorta`) ⇒ `"processando"`. Quer dizer:
 *   • o `pronto` que está no banco JÁ É MENTIRA — a primeira leitura o vira em
 *     `processando` pra sempre, porque não existe voz que possa ficar `ready`;
 *   • e se eu puser `audio` sem desarmar isso, a primeira leitura devolve ela
 *     pro limbo e o conserto some.
 * Os três chamadores são desarmados por `enviado_em = null`:
 *   • webhooks Kie/RunPod → `avancarEtapasDoUsuario` → `if (!pedido?.enviado_em)
 *     return` (`etapas.ts:42`);
 *   • página `/sgp/acompanhar` → `if (!pedido?.enviado_em) redirect`
 *     (`acompanhar/page.tsx:20`);
 *   • `GET /api/v1/sgp/status` — não tem guarda própria, mas o único que o
 *     chama é `sgp-acompanhar.tsx:45`, que só monta naquela página.
 * `enviarPedido` recarimba `enviado_em` no reenvio (`processar.ts:159`), então
 * limpar aqui não perde nada permanente. O valor velho vai pra prova.
 *
 * ── O que NÃO se toca, e por quê ──────────────────────────────────────────
 *   • `foto_pronta_em` — as fotos NÃO estão em questão (6 aprovadas, avatar
 *     `ready`). É o cadeado do "uma vez só" do e-mail de foto
 *     (`etapas.ts:71-79`); limpar mandaria pra ela um "sua foto está pronta"
 *     repetido, de uma etapa que não mudou.
 *   • `fotos`, `ciencia_foto`, `ciencia_foto_at` — mesmo motivo.
 *   • `user_id` — ela já é cliente; é o que liga o pedido ao perfil no
 *     `/admin/sgp`. `enviarPedido` reacha a conta pelo e-mail de qualquer
 *     jeito (`processar.ts` › `acharUsuarioPorEmail`).
 *   • `ciencia_audio` / `ciencia_audio_at` — o `concluir` regrava os dois.
 *   • `aceite_lgpd_at` — recarimbado no envio (`processar.ts:160`).
 *   • `profiles.onboarding_ready_email_at` — é de OUTRA tabela e é o cadeado do
 *     "Sua plataforma está pronta". Fica como está de propósito: mexer nele é
 *     mexer no onboarding do aluno inteiro, não neste pedido. CONSEQUÊNCIA
 *     ASSUMIDA: ela não receberá de novo aquele e-mail final quando a voz nova
 *     ficar pronta — receberá os de etapa. Quem quiser o contrário decide fora
 *     desta ferramenta.
 *   • os objetos no R2 — os `sgp/<sessao>/audio/*.m4a` antigos NÃO são
 *     apagados. Some do pedido, continua no bucket: evidência não se destrói.
 *
 * ── O que ESTA ferramenta não resolve (dito na cara) ───────────────────────
 *   • **O cookie.** O dono do pedido é `sgp_sessao`, httpOnly, 30 dias a
 *     partir da criação da linha (`lib/sgp/sessao.ts:13` + `36-44`). Nenhuma
 *     ferramenta enxerga o navegador dela. Isto aqui abre a porta; se o cookie
 *     tiver morrido/sido limpo, ou se ela usar outro aparelho, ela cai num
 *     pedido NOVO e este continua reaberto e parado. A ferramenta imprime a
 *     janela do cookie pra isso ser decidido com número, não com torcida.
 *   • **O reenvio refaz a FOTO junto.** `processarMaterial` (`processar.ts`)
 *     recopia as fotos aprovadas pra `refs/` e chama `gerarAvatares` de novo.
 *     Não cobra nada (`origem:"sgp"`), mas gasta Kie da casa e duplica
 *     referência na conta dela. Consertar isso é mexer na produção — fora
 *     deste cartão, fica REGISTRADO.
 *   • **A causa raiz.** Nada aqui impede o próximo aluno de misturar idiomas:
 *     o medidor marca `avisos` e aprova assim mesmo. Cartão separado.
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *   node 2026-09-17_reabrir_audio_sgp.cjs <pedidoId>              # SIMULA
 *   node 2026-09-17_reabrir_audio_sgp.cjs <pedidoId> --confirmar  # grava
 *
 * Sem `--confirmar` NÃO grava nada — só confere e diz o que faria. Com
 * `--confirmar`, grava a prova em `_frank/prova/`, aplica, RELÊ o banco e
 * imprime o que o BANCO confirma (ensaio não é entrega).
 */
const fs = require("node:fs");
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
const { supa } = require(path.join(RAIZ, "_frank/ferramentas/_comum.cjs"));

// A régua do envio vem de PRODUÇÃO, não copiada: se `porta-envio.ts` mudar,
// esta ferramenta muda junto sozinha. Mesma decisão da 2026-09-15_retreinar_sgp.
const createJiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"));
const jiti = (createJiti.default || createJiti)(path.join(RAIZ, "frontend", "noop.js"), {
  alias: { "@": path.join(RAIZ, "frontend", "src") },
  interopDefault: true,
});

const { portaDoEnvio } = jiti(path.join(RAIZ, "frontend", "src", "lib", "sgp", "porta-envio.ts"));
if (typeof portaDoEnvio !== "function") {
  throw new Error(
    "porta-envio.ts não exporta portaDoEnvio() — ferramenta abortada (não vou adivinhar a régua do envio)",
  );
}
const { SGP_AUDIO_MIN_SEGUNDOS, SGP_AUDIO_MAX_SEGUNDOS, SGP_AUDIO_MAX_ARQUIVOS } = jiti(
  path.join(RAIZ, "frontend", "src", "lib", "sgp", "types.ts"),
);

/** O passo pra onde o pedido volta. Ver o cabeçalho: `audio`, não `revisao`. */
const DESTINO = "audio";
/** Só faz sentido reabrir quem JÁ passou do wizard. */
const REABRIVEIS = ["enviado", "processando", "pronto", "falhou"];
/** `sessao.ts:13` — `MAX_IDADE` do cookie `sgp_sessao`. */
const COOKIE_DIAS = 30;

const CAMPOS =
  "id, sessao, nome, email, whatsapp, status, user_id, voice_id, criado_em, atualizado_em, " +
  "enviado_em, foto_pronta_em, voz_pronta_em, email_verificado_at, aceite_lgpd_at, " +
  "conta_existente, erro, fotos, audios, ciencia_audio, ciencia_audio_at, ciencia_foto_at";

const min = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function main() {
  const pedidoId = process.argv[2];
  const confirmar = process.argv.includes("--confirmar");
  if (!pedidoId) {
    console.error("uso: node 2026-09-17_reabrir_audio_sgp.cjs <pedidoId> [--confirmar]");
    process.exit(2);
  }

  const db = supa();

  const { data: ped, error: eP } = await db
    .from("sgp_pedidos")
    .select(CAMPOS)
    .eq("id", pedidoId)
    .maybeSingle();
  // `data:null` com `error` é "não sei", não "não existe" — não se decide em
  // cima de erro engolido (lição do #222).
  if (eP) throw new Error(`sgp_pedidos: ${eP.message}`);
  if (!ped) throw new Error(`pedido ${pedidoId} não existe`);

  const audios = Array.isArray(ped.audios) ? ped.audios : [];
  const aprovados = audios.filter((a) => a.status === "aprovado");
  const falaTotal = aprovados.reduce((s, a) => s + (a.segundos || 0), 0);
  const fotosAprovadas = (Array.isArray(ped.fotos) ? ped.fotos : []).filter(
    (f) => f.status === "aprovada",
  );

  console.log("── ALVO ────────────────────────────────────────────────");
  console.log("  pedido       :", ped.id);
  console.log("  aluno        :", ped.email, `(${ped.nome ?? "?"})`);
  console.log("  status       :", ped.status);
  console.log("  user_id      :", ped.user_id);
  console.log("  voice_id     :", ped.voice_id);
  console.log("  criado_em    :", ped.criado_em);
  console.log("  enviado_em   :", ped.enviado_em);
  console.log("  foto_pronta  :", ped.foto_pronta_em);
  console.log("  voz_pronta   :", ped.voz_pronta_em);
  console.log("  erro         :", ped.erro);
  console.log("  fotos        :", fotosAprovadas.length, "aprovada(s)");

  console.log("── ÁUDIOS DE HOJE (o que sai do pedido) ────────────────");
  for (const a of audios) {
    console.log(
      `   ${a.status === "aprovado" ? "✅" : "❌"} ${min(a.segundos || 0).padStart(6)} ${String(a.nome ?? "?").slice(0, 34).padEnd(36)}`,
    );
    for (const av of a.avisos ?? []) console.log(`        ⚠️  ${av}`);
    for (const mo of a.motivos ?? []) console.log(`        ⛔ ${mo}`);
    console.log(`        key: ${a.key}`);
  }
  console.log(
    "  fala aprovada:",
    min(falaTotal),
    `(${falaTotal}s) — a régua do "Continuar" é ${SGP_AUDIO_MIN_SEGUNDOS / 60}–${SGP_AUDIO_MAX_SEGUNDOS / 60} min`,
  );
  console.log("  teto de arquivos:", SGP_AUDIO_MAX_ARQUIVOS);

  // ── a VOZ: existe mesmo? ────────────────────────────────────────────────
  let vozDoPedido = null;
  if (ped.voice_id) {
    const { data, error } = await db
      .from("voices")
      .select("id, status, created_at, trained_at")
      .eq("id", ped.voice_id)
      .maybeSingle();
    if (error) throw new Error(`voices: ${error.message}`);
    vozDoPedido = data ?? null;
  }
  let vozesDoAluno = [];
  if (ped.user_id) {
    const { data, error } = await db
      .from("voices")
      .select("id, name, status, created_at")
      .eq("user_id", ped.user_id)
      .order("created_at");
    if (error) throw new Error(`voices do aluno: ${error.message}`);
    vozesDoAluno = data ?? [];
  }
  console.log("── VOZ ─────────────────────────────────────────────────");
  console.log(
    "  voz do pedido:",
    !ped.voice_id
      ? "(pedido sem voice_id)"
      : vozDoPedido
        ? `${vozDoPedido.id} status=${vozDoPedido.status}`
        : `⚠️ ${ped.voice_id} NÃO EXISTE MAIS (referência pendurada)`,
  );
  console.log("  vozes do aluno:", vozesDoAluno.length);
  for (const v of vozesDoAluno) console.log("   ", v.id, v.status, v.created_at);

  // ── a PORTA do envio, pela régua da própria produção ────────────────────
  const portaHoje = portaDoEnvio(ped.status, ped.erro ?? null);
  const portaDestino = portaDoEnvio(DESTINO, null);
  const portaDepoisDoConcluir = portaDoEnvio("revisao", null);
  console.log("── A PORTA (lib/sgp/porta-envio.ts, carregada de produção) ─");
  console.log(`  hoje      '${ped.status}' → ${JSON.stringify(portaHoje)}`);
  console.log(`  destino   '${DESTINO}' → ${JSON.stringify(portaDestino)}`);
  console.log(`  concluir  'revisao' → ${JSON.stringify(portaDepoisDoConcluir)}`);
  if (portaDepoisDoConcluir.acao !== "enviar") {
    throw new Error(
      "a produção não aceita mais 'revisao' no envio — a régua mudou; releia porta-envio.ts antes de usar esta ferramenta",
    );
  }

  // ── o cookie: a única porta que esta ferramenta NÃO abre ────────────────
  const venceCookie = new Date(new Date(ped.criado_em).getTime() + COOKIE_DIAS * 86400_000);
  const diasRestantes = (venceCookie - Date.now()) / 86400_000;
  console.log("── O COOKIE (sgp_sessao — fora do alcance daqui) ───────");
  console.log("  sessão       :", ped.sessao);
  console.log("  vence em     :", venceCookie.toISOString(), `(${diasRestantes.toFixed(1)} dia(s))`);
  console.log(
    diasRestantes > 0
      ? "  ✅ a janela do cookie ainda está aberta — MAS só o navegador dela sabe se o\n" +
          "     cookie continua lá. Se ela trocou de aparelho ou limpou os cookies, ela cai\n" +
          "     num pedido NOVO e este fica reaberto e parado. Confirme com ela."
      : "  ⛔ a janela de 30 dias do cookie JÁ VENCEU: mesmo reaberto, ela não volta\n" +
          "     neste pedido. Reabrir aqui não resolve — escale.",
  );

  // ── pré-condições ───────────────────────────────────────────────────────
  const problemas = [];
  if (ped.status === DESTINO) problemas.push(`o pedido JÁ está em '${DESTINO}' — nada a reabrir`);
  else if (!REABRIVEIS.includes(ped.status))
    problemas.push(
      `status '${ped.status}' ainda é do wizard (a bola está com o aluno) — não é caso de reabrir`,
    );
  if (!ped.email_verificado_at)
    problemas.push(
      "sem `email_verificado_at`: `/sgp/audio` (page.tsx) devolve ela pra `/sgp` — reabrir não adiantaria",
    );
  if (fotosAprovadas.length === 0)
    problemas.push("nenhuma foto aprovada — o reenvio falharia em `enviarPedido` (Faltam fotos aprovadas)");

  if (problemas.length) {
    console.log("\n❌ NÃO DÁ PRA REABRIR:");
    for (const p of problemas) console.log("   -", p);
    process.exit(1);
  }

  // ── o patch ─────────────────────────────────────────────────────────────
  const patch = {
    status: DESTINO,
    // ⚠️ o array some do PEDIDO; os arquivos continuam no R2 e o conteúdo vai
    // pra prova. Some de propósito: com 27:29 de fala já aprovada ela poderia
    // simplesmente ACRESCENTAR material novo, bater o mínimo de 20 min com a
    // mistura velha ainda dentro e o defeito voltaria idêntico, com um clique.
    audios: [],
    enviado_em: null,
    voz_pronta_em: null,
    voice_id: null,
    erro: null,
  };
  console.log("── O QUE SERIA GRAVADO ─────────────────────────────────");
  for (const [k, v] of Object.entries(patch)) {
    console.log(`   ${k.padEnd(14)} ${JSON.stringify(ped[k])}  →  ${JSON.stringify(v)}`);
  }
  console.log("   (intocados: foto_pronta_em, fotos, ciencia_foto*, user_id, ciencia_audio*,");
  console.log("    aceite_lgpd_at, profiles.onboarding_ready_email_at, e os objetos no R2)");
  console.log("── O CAMINHO QUE ISTO ABRE ─────────────────────────────");
  console.log("   /sgp → (PROXIMA['audio']) → /sgp/audio → sobe o material novo");
  console.log("   → POST /audio/concluir  (audio → revisao)");
  console.log("   → POST /sgp/enviar      (revisao → processando)  ← sem cobrar nada dela");

  if (!confirmar) {
    console.log("\n🔎 SIMULAÇÃO — NADA foi gravado.");
    console.log("   Rode com --confirmar para aplicar.");
    return;
  }

  // ── prova ANTES de escrever (regra 19: não se apaga evidência) ──────────
  const provaDir = path.join(RAIZ, "_frank", "prova");
  fs.mkdirSync(provaDir, { recursive: true });
  const prova = path.join(provaDir, `2026-09-17_reabertura_audio_${ped.id}.json`);
  fs.writeFileSync(
    prova,
    JSON.stringify(
      {
        motivo:
          "aluno enviou português + inglês no mesmo treino e apagou a voz; reaberto o passo de áudio para material novo",
        gravado_em: new Date().toISOString(),
        pedido_antes: ped,
        voz_do_pedido_existia: !!vozDoPedido,
        vozes_do_aluno: vozesDoAluno,
        patch,
      },
      null,
      2,
    ),
  );
  console.log("\n🧾 prova gravada:", prova);

  console.log("✍️  gravando…");
  const { error: eU } = await db.from("sgp_pedidos").update(patch).eq("id", ped.id);
  if (eU) throw new Error(`update: ${eU.message}`);

  // ── o que o BANCO confirma DEPOIS ───────────────────────────────────────
  const { data: depois, error: eD } = await db
    .from("sgp_pedidos")
    .select(CAMPOS)
    .eq("id", ped.id)
    .maybeSingle();
  if (eD) throw new Error(`releitura: ${eD.message}`);
  if (!depois) throw new Error("releitura não achou o pedido — CONFERIR À MÃO");

  console.log("── O QUE O BANCO DIZ AGORA ─────────────────────────────");
  const divergiu = [];
  for (const [k, v] of Object.entries(patch)) {
    const atual = depois[k];
    const bate = JSON.stringify(atual) === JSON.stringify(v);
    if (!bate) divergiu.push(k);
    console.log(`   ${bate ? "✅" : "❌"} ${k.padEnd(14)} ${JSON.stringify(atual)}`);
  }
  console.log("   —— intocados ——");
  console.log("   foto_pronta_em:", depois.foto_pronta_em);
  console.log("   user_id       :", depois.user_id);
  console.log("   fotos         :", (depois.fotos ?? []).length);
  console.log("   atualizado_em :", depois.atualizado_em);
  console.log(
    "   porta do envio agora:",
    JSON.stringify(portaDoEnvio(depois.status, depois.erro ?? null)),
  );

  if (divergiu.length) {
    console.log("\n❌ O BANCO NÃO CONFIRMA:", divergiu.join(", "), "— CONFERIR À MÃO");
    process.exit(1);
  }
  console.log("\n✅ reaberto. Agora avise a aluna: entrar em fastcloner.com/sgp NO MESMO");
  console.log("   navegador de antes e mandar o áudio NOVO em UM idioma só");
  console.log(`   (${SGP_AUDIO_MIN_SEGUNDOS / 60}–${SGP_AUDIO_MAX_SEGUNDOS / 60} min de fala).`);
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
