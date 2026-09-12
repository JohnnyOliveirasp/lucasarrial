/**
 * Resgate de voz parada em "uploading" com o áudio JÁ no R2. Server-only.
 *
 * 🐛 POR QUE EXISTE (achado 18/08, caso Fabio — 15 dias travado): o envio é
 * browser → R2 direto e só DEPOIS o browser chama `uploads-complete`, que é
 * quem grava raw_audio_paths e muda o status. Se a aba fecha, a rede cai ou o
 * celular dorme entre uma coisa e outra, os arquivos ficam no R2 e a voz fica
 * em "uploading" PARA SEMPRE — ninguém no servidor sabe que aquilo existe.
 * O aluno vê uma voz morta e some. Em 18/08 eram 26 vozes assim (13 alunos
 * sem nenhuma voz utilizável, 7 deles pagando).
 *
 * Aqui o servidor faz o que o browser não conseguiu: acha o áudio no R2 e
 * aplica a MESMA regra do uploads-complete (20min brutos = awaiting_training;
 * menos = rejected_too_short com o motivo). NÃO dispara treino e NÃO cobra —
 * quem decide treinar é o aluno, clicando.
 */
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getAdmin } from "@/lib/db/admin";
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { estimateSpeechSeconds } from "@/lib/audio/speech-estimate";
import type { VoiceStatus } from "@/lib/db/types";
import {
  MIN_TOTAL_SECONDS,
  RX_EXT_AUDIO,
  contarSlotsDoEnvio,
  deveAbrirChamadoEnvioPerdido,
  mensagemCurtoDemais,
  mensagemEnvioIncompleto,
} from "@/lib/voices/regua-audio";

/** Só olha o que está parado há bastante tempo — upload grande demora. */
const STUCK_AFTER_MS = 30 * 60 * 1000;
/**
 * Linha sem NENHUM áudio no R2 e velha: o envio nunca começou. Apagar é o que
 * o POST /voices também faz (84f3197) — e é obrigatório aqui, senão essas
 * linhas voltam pra fila toda rodada e comem o teto, deixando quem TEM áudio
 * esperando pra sempre (foi o que aconteceu na 1ª limpeza, 18/08).
 */
const GHOST_AFTER_MS = 45 * 60 * 1000;
/** Teto por rodada: medir áudio custa CPU; o cron roda a cada 5min. */
const MAX_POR_RODADA = 3;
const MIN_BYTES = 10_000;
/**
 * A lista de extensões mora na régua (`RX_EXT_AUDIO`) e é importada, não
 * copiada: a `contarSlotsDoEnvio` decide o que é "slot ignorado de propósito"
 * por essa mesma regex, e duas cópias divergentes fariam o filtro daqui
 * discordar da contagem de lá.
 */
const EXT_AUDIO = RX_EXT_AUDIO;

export type RescueSummary = {
  checked: number;
  rescued: number;
  rejected: number;
  no_audio: number;
  /** linhas mortas (sem áudio nenhum) apagadas pra não entulhar a tela/fila */
  cleaned: number;
  errors: number;
};

/**
 * O que existe no R2 pra esta voz.
 *
 * Devolve as DUAS listas de propósito: `utilizaveis` (o que vira treino) e
 * `todas` (tudo que está no prefixo, inclusive o que o filtro descartou).
 * A diferença é o que separa "o arquivo nunca chegou" de "o arquivo chegou
 * truncado e foi descartado por tamanho" — os dois viram buraco na
 * numeração, mas não são o mesmo defeito.
 */
async function audiosNoR2(
  userId: string,
  voiceId: string,
): Promise<{ utilizaveis: string[]; todas: string[] }> {
  const out = await r2.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKETS.voices,
      Prefix: `${userId}/${voiceId}/`,
    }),
  );
  const contents = out.Contents ?? [];
  return {
    utilizaveis: contents
      .filter((o) => (o.Size ?? 0) > MIN_BYTES && EXT_AUDIO.test(o.Key ?? ""))
      .map((o) => o.Key as string)
      .sort(),
    todas: contents.map((o) => o.Key as string).sort(),
  };
}

/**
 * 🐛 POR QUE EXISTE (12/09, caso Hellen — 5 dias calada): a recusa por ENVIO
 * PERDIDO é falha NOSSA e, até aqui, morria na tela do aluno. O `console.warn`
 * lá em cima era o único registro, e ninguém lê log. A Hellen, pagante de
 * 05/09 (GBP 47,94 + R$ 597,00), perdeu 5 dos 7 arquivos em 06/09, leu a
 * recusa, nunca mais voltou ao app — e ficou 5 dias sem UMA linha nossa: zero
 * chamado, zero e-mail. O sintoma ("acesso vivo, com crédito e sem nenhuma voz
 * pronta") só aparecia pra quem cruzasse a lista de travados na mão.
 *
 * O conserto de 21/08 (#72) arrumou a MENSAGEM — o aluno deixou de levar a
 * culpa de "áudio curto". Arrumar a mensagem não põe ninguém na fila. Agora a
 * recusa abre chamado TÉCNICO, porque existe ação nossa que resolve
 * (reprocessar o material, falar com ele). Mesmo raciocínio do convite de
 * compra órfã: quem desiste em silêncio precisa ficar visível.
 *
 * ⚠️ NÃO manda e-mail pro aluno de propósito. O contato continua sendo decisão
 * de gente; disparar texto automático em cima de quem acabou de levar uma
 * recusa é o tipo de coisa que se faz uma vez e se lamenta depois. Isto
 * entrega a metade segura — a VISIBILIDADE.
 *
 * Idempotente pela assinatura (uma por voz): se o cron reencostar na mesma
 * linha, `abrirChamadoReportado` soma ocorrência em vez de abrir outro.
 */
async function abrirChamadoEnvioPerdido(
  admin: ReturnType<typeof getAdmin>,
  voz: { id: string; user_id: string },
  envio: { chegaram: number; esperados: number; faltando: number; ignorados: number },
  totalSegundos: number,
  mensagemAoAluno: string | null,
): Promise<void> {
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("email")
      .eq("id", voz.user_id)
      .maybeSingle();
    const email = prof?.email ?? null;
    const minutos = Math.round(totalSegundos / 60);
    await abrirChamadoReportado({
      signature: `voz:envio-incompleto:${voz.id}`,
      title:
        `Voz recusada por envio perdido (falha nossa): chegaram ${envio.chegaram} de ` +
        `${envio.esperados} arquivos${email ? ` — ${email}` : ""}`,
      description:
        `O aluno enviou ${envio.esperados} arquivos de áudio e só ${envio.chegaram} ` +
        `chegaram até nós (${envio.faltando} perdido(s) no caminho; ${envio.ignorados} ` +
        `slot(s) não-áudio ignorados). O que chegou soma ~${minutos}min, abaixo do ` +
        `mínimo, então a voz caiu em "rejected_too_short".\n\n` +
        `A perda foi NOSSA (envio browser → R2 interrompido no meio), não gravação ` +
        `curta dele. Nada foi cobrado: este caminho não dispara treino.\n\n` +
        `voice_id: ${voz.id}\n` +
        `user_id: ${voz.user_id}\n` +
        `e-mail: ${email ?? "(não encontrado em profiles)"}\n\n` +
        `O QUE O ALUNO LEU NA TELA:\n${mensagemAoAluno ?? "(sem mensagem)"}\n\n` +
        `AÇÃO: falar com ele antes que desista em silêncio — foi exatamente isso ` +
        `que aconteceu no caso que originou este conserto. NENHUM e-mail ` +
        `automático foi disparado por aqui.`,
      reportedBy: "rescue-uploads",
      affectedEmails: email ? [email] : [],
      sampleError: mensagemAoAluno,
      categoria: "tecnico",
    });
  } catch (e) {
    // O chamado é REGISTRO, não o resgate. O resgate já foi gravado antes
    // desta chamada; falhar aqui não pode virar `errors` nem derrubar a
    // rodada do cron pras vozes seguintes.
    console.error(
      "[rescue-uploads] abrir chamado de envio perdido falhou:",
      voz.id,
      e instanceof Error ? e.message : e,
    );
  }
}

export async function rescueStuckVoiceUploads(): Promise<RescueSummary> {
  const admin = getAdmin();
  const resumo: RescueSummary = {
    checked: 0, rescued: 0, rejected: 0, no_audio: 0, cleaned: 0, errors: 0,
  };

  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data: paradas } = await admin
    .from("voices")
    .select("id, user_id, created_at")
    .eq("status", "uploading")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_POR_RODADA);

  for (const voz of (paradas ?? []) as {
    id: string;
    user_id: string;
    created_at: string;
  }[]) {
    resumo.checked += 1;
    try {
      const { utilizaveis: chaves, todas } = await audiosNoR2(
        voz.user_id,
        voz.id,
      );
      if (chaves.length === 0) {
        // O aluno nunca chegou a subir nada — não há o que resgatar. Velha o
        // bastante = apaga (senão volta pra fila pra sempre e trava o teto).
        resumo.no_audio += 1;
        if (Date.now() - new Date(voz.created_at).getTime() > GHOST_AFTER_MS) {
          const { error } = await admin
            .from("voices")
            .delete()
            .eq("id", voz.id)
            .eq("status", "uploading");
          if (!error) resumo.cleaned += 1;
        }
        continue;
      }

      const urls = await Promise.all(
        chaves.map((k) => createPresignedGet(R2_BUCKETS.voices, k, 3600)),
      );
      const est = await estimateSpeechSeconds(urls);
      const total = est.reliable ? est.totalSeconds : 0;

      // O envio pode ter chegado pela metade: aqui a gente grava o que ACHOU
      // no bucket, então um arquivo que não subiu vira silenciosamente "menos
      // áudio" e o aluno leva a culpa. O índice do slot está na chave, então
      // dá pra saber quantos foram emitidos sem persistir contagem nenhuma.
      const envio = contarSlotsDoEnvio(chaves, todas);

      let status: VoiceStatus;
      let erro: string | null = null;
      if (!est.reliable) {
        // Medição falhou: não bloqueia ninguém — o start-training re-mede.
        status = "awaiting_training";
      } else if (total < MIN_TOTAL_SECONDS) {
        status = "rejected_too_short";
        // Faltou arquivo E o total não fecha a porta: a causa provável é o
        // nosso envio, não a gravação dele. Dizer "grave mais" aqui é mandar
        // o aluno repetir o que já fez.
        erro =
          envio.faltando > 0
            ? mensagemEnvioIncompleto(total, envio.chegaram, envio.esperados)
            : mensagemCurtoDemais(total);
      } else {
        status = "awaiting_training";
      }

      // Buraco na numeração é defeito NOSSO mesmo quando o aluno passa na
      // porta assim mesmo — sem este log ele só aparece se alguém for medir
      // a numeração à mão, que foi como o 2c5bab42 ficou 1 mês invisível.
      if (envio.faltando > 0) {
        console.warn(
          `[rescue-uploads] ENVIO INCOMPLETO voz ${voz.id}: chegaram ${envio.chegaram} de ${envio.esperados} slots de áudio (faltam ${envio.faltando}; ${envio.ignorados} slot(s) não-áudio ignorados) → ${status}`,
        );
      }

      const { data: aplicadas, error } = await admin
        .from("voices")
        .update({
          raw_audio_paths: chaves,
          duration_seconds: total > 0 ? Math.round(total) : null,
          status,
          error_message: erro,
        })
        .eq("id", voz.id)
        .eq("status", "uploading") // corrida com o browser: quem chegar primeiro
        .select("id");
      if (error) throw new Error(error.message);

      if (status === "awaiting_training") resumo.rescued += 1;
      else resumo.rejected += 1;
      console.log(
        `[rescue-uploads] voz ${voz.id} (${chaves.length} áudios, ${Math.round(total / 60)}min) → ${status}`,
      );

      // A decisão mora na régua (`deveAbrirChamadoEnvioPerdido`), que é pura e
      // tem teste. As três condições e o porquê de cada uma estão lá; aqui
      // ficou só a chamada, pra não existirem duas versões da mesma regra.
      if (
        deveAbrirChamadoEnvioPerdido({
          status,
          faltando: envio.faltando,
          linhasAplicadas: aplicadas?.length ?? 0,
        })
      ) {
        await abrirChamadoEnvioPerdido(admin, voz, envio, total, erro);
      }
    } catch (e) {
      resumo.errors += 1;
      console.error("[rescue-uploads]", voz.id, e instanceof Error ? e.message : e);
    }
  }
  return resumo;
}
