/**
 * SGP — "Confirmar e Enviar" (tela 4). **É AQUI que a conta nasce**
 * (Johnny 29/08: "este cadastro só acontecerá na etapa final, depois da
 * revisão"). Até este ponto o aluno era só uma sessão com material no R2.
 *
 * Ordem:
 *  1. cria a conta (ou usa a existente, se o e-mail já era do FastCloner) e
 *     grava nome/WhatsApp no perfil — **zero crédito**: quem manda é o
 *     pagamento (`claimPurchasesOnLogin` religa compra dele, se houver)
 *  2. copia as fotos aprovadas pra `{user}/refs/` e define a referência padrão
 *  3. cria a voz e copia os áudios aprovados pra `{user}/{voice}/raw/`
 *  4. e-mail "começamos" · "processando imagens" + clone de FOTO (Kie, 525 cr)
 *     · "processando áudio" + TREINO (10k cr)
 *     — o débito deixa o saldo NEGATIVO de propósito (mig 88): o aluno só usa
 *     a plataforma depois de assinar.
 */
import { randomUUID } from "node:crypto";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { getAdmin } from "@/lib/db/admin";
import { AVATAR_SOCIAL, gerarAvatares } from "@/lib/onboarding/avatares";
import { avisoComecamos, avisoProcessandoAudio, avisoProcessandoImagens } from "@/lib/onboarding/avisos";
import { ONBOARDING_VOICE_NAME } from "@/lib/onboarding/import";
import { dispararTreinoOnboarding } from "@/lib/onboarding/treino";
import { claimPurchasesOnLogin } from "@/lib/payments/claim";
import { imagesBucket, r2, R2_BUCKETS } from "@/lib/r2/client";
import { buildRawAudioKey } from "@/lib/r2/presigned";
import { atualizarSessao } from "./sessao";
import { SGP_AUDIO_MIN_SEGUNDOS, SGP_FOTOS_MIN, type SgpPedidoRow } from "./types";

export type EnvioResultado = { ok: boolean; erros: string[]; contaCriada: boolean; email: string };

/** Cópia server-side no R2 (não baixa nada). Nome com acento quebra sem encode. */
async function copiar(bucket: string, de: string, para: string): Promise<void> {
  await r2.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${de.split("/").map(encodeURIComponent).join("/")}`,
      Key: para,
    }),
  );
}

async function acharUsuarioPorEmail(email: string): Promise<string | null> {
  const admin = getAdmin();
  const { data } = await admin.from("profiles" as never).select("id").ilike("email", email).maybeSingle();
  if (data) return (data as { id: string }).id;
  for (let page = 1; page <= 5; page++) {
    const { data: lista } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const achado = lista?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (achado) return achado.id;
    if (!lista?.users?.length || lista.users.length < 1000) break;
  }
  return null;
}

/**
 * PARTE RÁPIDA — o aluno espera por isto na tela (segundos): valida, cria a
 * conta e marca o pedido como `processando`. O resto (cópias no R2, Kie,
 * treino) roda depois, em background, senão o botão fica "Enviando…" eterno
 * (Johnny 29/08).
 */
export async function enviarPedido(pedido: SgpPedidoRow, senha: string | null): Promise<EnvioResultado> {
  const admin = getAdmin();
  const email = (pedido.email ?? "").toLowerCase();
  if (!pedido.email_verificado_at || !email) throw new Error("Confirme o seu e-mail na primeira tela.");

  const fotos = (pedido.fotos ?? []).filter((f) => f.status === "aprovada");
  const audios = (pedido.audios ?? []).filter((a) => a.status === "aprovado");
  const totalFala = audios.reduce((s, a) => s + a.segundos, 0);
  if (fotos.length < SGP_FOTOS_MIN) throw new Error("Faltam fotos aprovadas.");
  if (totalFala < SGP_AUDIO_MIN_SEGUNDOS) throw new Error("Falta áudio aprovado.");

  // 1. CONTA
  let userId = await acharUsuarioPorEmail(email);
  const contaCriada = !userId;
  if (!userId) {
    if (!senha || senha.length < 8) throw new Error("Crie uma senha de pelo menos 8 caracteres.");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // o código de 6 dígitos já provou o e-mail
      user_metadata: { full_name: pedido.nome ?? "", whatsapp: pedido.whatsapp ?? "", onboarding_source: "sgp" },
    });
    if (error || !data.user) throw new Error(error?.message ?? "não consegui criar a sua conta");
    userId = data.user.id;
  }
  const { error: perfilErr } = await admin
    .from("profiles" as never)
    .upsert(
      { id: userId, email, display_name: pedido.nome, whatsapp: pedido.whatsapp } as never,
      { onConflict: "id" },
    );
  if (perfilErr) throw new Error(perfilErr.message);
  await claimPurchasesOnLogin(userId, email).catch(() => {});

  const agora = new Date().toISOString();
  await atualizarSessao(pedido.sessao, {
    user_id: userId,
    status: "processando",
    enviado_em: agora,
    aceite_lgpd_at: agora,
    erro: null,
  });

  // O pesado continua sozinho; a tela vai acompanhar pelo /sgp/status.
  void processarMaterial(pedido, userId, email).catch((e) => {
    console.error("[sgp/processar] material:", e instanceof Error ? e.message : e);
  });

  return { ok: true, erros: [], contaCriada, email };
}

/** PARTE LENTA — cópias no R2, clone de foto (Kie) e treino da voz. */
async function processarMaterial(pedido: SgpPedidoRow, userId: string, email: string): Promise<void> {
  const admin = getAdmin();
  const fotos = (pedido.fotos ?? []).filter((f) => f.status === "aprovada");
  const audios = (pedido.audios ?? []).filter((a) => a.status === "aprovado");
  const totalFala = audios.reduce((s, a) => s + a.segundos, 0);
  const erros: string[] = [];

  // 2. FOTOS → Imagens de Referência + referência padrão
  const bucketImg = imagesBucket();
  const refs: string[] = [];
  let padrao: string | null = null;
  const preferida =
    fotos.find((f) => f.rosto_visivel !== false && f.perfil !== true && f.tipo === "rosto_frente") ??
    fotos.find((f) => f.rosto_visivel !== false && f.perfil !== true) ??
    fotos.find((f) => f.rosto_visivel !== false);
  for (const foto of fotos) {
    try {
      const nome = (foto.key.split("/").pop() ?? "foto.jpg").slice(-80);
      const destino = `${userId}/refs/${randomUUID().slice(0, 8)}_${nome}`;
      await copiar(bucketImg, foto.key, destino);
      refs.push(destino);
      if (foto.key === preferida?.key) padrao = destino;
    } catch (e) {
      erros.push(`foto: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (padrao) {
    await admin.from("profiles" as never).update({ image_ref_key: padrao } as never).eq("id", userId);
  }

  // 3. VOZ → arquivos aprovados em {user}/{voice}/raw/
  let voiceId: string | null = null;
  try {
    const { data, error } = await admin
      .from("voices")
      .insert({ user_id: userId, name: ONBOARDING_VOICE_NAME, status: "uploading" })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "não criou a voz");
    voiceId = (data as { id: string }).id;

    const chaves: string[] = [];
    for (let i = 0; i < audios.length; i++) {
      const nome = (audios[i].key.split("/").pop() ?? `audio-${i}.mp3`).slice(-80);
      const destino = buildRawAudioKey(userId, voiceId, i, nome);
      await copiar(R2_BUCKETS.voices, audios[i].key, destino);
      chaves.push(destino);
    }
    const { error: updErr } = await admin
      .from("voices")
      .update({
        raw_audio_paths: chaves,
        duration_seconds: totalFala,
        status: "awaiting_training",
        error_message: null,
      })
      .eq("id", voiceId);
    if (updErr) throw new Error(updErr.message);
    await atualizarSessao(pedido.sessao, { voice_id: voiceId });
  } catch (e) {
    erros.push(`voz: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 4. AVISO + CLONE DE FOTO + TREINO
  //
  // A RÉGUA DE 4 AVISOS (Johnny 29/08): "processando foto" → "foto concluída" →
  // "processando áudio" → "áudio concluído". O /sgp só mandava TRÊS: os dois
  // "processando" existiam escritos em lib/onboarding/avisos.ts mas só eram
  // chamados de app/api/v1/onboarding/import/route.ts — a rota da PLANILHA,
  // desligada por ordem de 29/08. Morreram junto com ela e ninguém percebeu.
  // Aqui eles voltam, no ponto EQUIVALENTE do fluxo novo: o instante em que
  // cada coisa COMEÇA (o Kie é chamado / o treino é submetido ao RunPod).
  //
  // "UMA VEZ SÓ" vem do lugar, não de carimbo novo: `processarMaterial` roda
  // uma vez por pedido (o POST /sgp/enviar recusa quem já está em
  // `processando`/`pronto`), e NÃO está no caminho do polling — que é onde o
  // risco de repetir a cada 8s existiria. Mesma garantia do `avisoComecamos`
  // logo abaixo, sem coluna nova (e portanto sem migration).
  await avisoComecamos(email, pedido.nome).catch(() => {});
  if (refs.length) {
    await avisoProcessandoImagens(email).catch(() => {});
    const foto = await gerarAvatares(admin, userId, refs, [AVATAR_SOCIAL]);
    for (const f of foto.failed) erros.push(`clone de foto: ${f.error}`);
  }
  if (voiceId) {
    await avisoProcessandoAudio(email).catch(() => {});
    try {
      const t = await dispararTreinoOnboarding(admin, userId, voiceId);
      if (!t.ok) erros.push(`treino da voz: ${t.reason}`);
    } catch (e) {
      erros.push(`treino da voz: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (erros.length) await atualizarSessao(pedido.sessao, { erro: erros.join(" · ") });
}
