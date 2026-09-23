/**
 * O desfecho do `uploads-complete` — a decisão PURA de qual veredito o envio
 * recebe, DEPOIS de conferir no R2 o que realmente chegou.
 *
 * Por que existe (caso Hellen Grasso #526, medido em 23/09): ela pagou em
 * 05/09, escolheu SETE arquivos em 06/09, o browser deu o envio inteiro por
 * bem-sucedido — e só DOIS objetos existiam no R2 (slots 001 e 006, 415s
 * somados). O `uploads-complete` confiava cegamente na lista que o browser
 * alegava ter subido: somava as durações medidas na TELA (dos 7 arquivos que
 * o aluno escolheu, não dos que chegaram) e comparava com a régua de 20min.
 * Quando a conta não fechava, carimbava `rejected_too_short` — acusando o
 * áudio DELA de ser curto quando foi o NOSSO caminho de envio que perdeu 5
 * dos 7 arquivos em silêncio. Ela leu a recusa, desistiu, e ficou 16 dias
 * sem uma linha nossa.
 *
 * As regras que este módulo trava por teste:
 *
 *  1. Chegou MENOS arquivo do que o browser enviou → ENVIO INCOMPLETO, nunca
 *     `curto_demais`. A perda é nossa; a mensagem nomeia O QUE faltou e a
 *     saída é reenviar só esses — não "grave mais", que manda o aluno repetir
 *     o que já fez.
 *  2. A recusa por duração (`curto_demais`) SÓ vale quando TODOS os arquivos
 *     chegaram. Régua de 20min medindo um envio pela metade dá o número certo
 *     do problema errado — e o sinal aponta pro aluno.
 *  3. A régua de duração NÃO some: com tudo chegado e fala < 20min, a recusa
 *     por duração continua exatamente como era (é a `mensagemCurtoDemais` da
 *     régua, não uma cópia — duas réguas divergentes já causaram o 07745f61).
 *
 * Quem decide o que É "chegou": objeto presente no bucket com mais de
 * `MIN_BYTES_AUDIO`. PUT cortado no meio deixa um toco de poucos bytes — pro
 * aluno o efeito é idêntico a não ter chegado, e reenviar resolve os dois.
 *
 * Parente próximo: `voices/regua-audio.ts` já cobre a MESMA classe no caminho
 * do RESGATE (voz abandonada em `uploading`, varrida pelo cron) via
 * `contarSlotsDoEnvio`/`mensagemEnvioIncompleto`. Aqui é o caminho VIVO — o
 * aluno está com a tela aberta, então em vez de rejeitar a voz a resposta é
 * "faltaram estes, reenvie só eles" e a voz continua em `uploading`. Se ele
 * fechar a aba, o resgate continua sendo a rede de segurança.
 */
import { MIN_TOTAL_SECONDS, mensagemCurtoDemais } from "../voices/regua-audio.ts";

/**
 * Piso de bytes pra contar um objeto do R2 como arquivo que chegou de
 * verdade. Espelha o `MIN_BYTES` do `rescue-stuck-uploads.ts` — os dois
 * caminhos têm que discordar de ZERO arquivos sobre o que existe.
 */
export const MIN_BYTES_AUDIO = 10_000;

export type DesfechoEnvio =
  | {
      tipo: "envio_incompleto";
      esperados: number;
      chegaram: number;
      /** Chaves R2 que o browser alegou ter subido e NÃO estão no bucket. */
      chavesFaltando: string[];
      /** Nome legível de cada faltante (sem caminho, sem prefixo de slot). */
      nomesFaltando: string[];
      mensagem: string;
    }
  | { tipo: "curto_demais"; mensagem: string }
  /** Sem medição do browser: segue pra `validating` (o worker re-mede). */
  | { tipo: "sem_medicao" }
  | { tipo: "ok" };

/**
 * `userId/voiceId/raw/003_minha_gravacao.mp3` → `minha_gravacao.mp3`.
 * É o nome que o aluno reconhece — o prefixo de slot é detalhe nosso.
 */
export function nomeLegivelDaChave(chave: string): string {
  const ultimo = chave.split("/").pop() ?? chave;
  return ultimo.replace(/^\d{3}_/, "");
}

export function decidirDesfechoEnvio(e: {
  /** Todas as chaves de slot que o browser diz ter subido (uploaded_keys). */
  chavesEsperadas: string[];
  /**
   * O que a listagem do prefixo da voz no R2 devolveu — chave + tamanho.
   * `null` = a conferência FALHOU (R2 fora do ar): sem prova de perda não se
   * acusa perda, então cai na régua de duração como o código sempre caiu.
   * É o comportamento antigo, de propósito: bloquear todo mundo porque uma
   * listagem transiente falhou seria pior que o status quo.
   */
  objetosNoR2: Array<{ key: string; size: number }> | null;
  /** Soma das durações medidas no browser (segundos). */
  totalSegundos: number;
  /** `false` quando o browser não mediu nada (client_durations vazio). */
  temMedicao: boolean;
}): DesfechoEnvio {
  // ── A COMPARAÇÃO enviados × chegados vem ANTES de qualquer régua de
  // duração: é ela que separa "gravou pouco" (culpa que a mensagem de
  // duração atribui ao aluno) de "a gente perdeu arquivo no caminho" (culpa
  // nossa). Sem este bloco, o caso da Hellen (2 de 7 no bucket) cai direto
  // na frase "áudio muito curto" — o bug que este módulo existe pra matar.
  if (e.objetosNoR2 !== null) {
    const noBucket = new Set(
      e.objetosNoR2
        .filter((o) => o.size > MIN_BYTES_AUDIO)
        .map((o) => o.key),
    );
    const chavesFaltando = e.chavesEsperadas.filter((k) => !noBucket.has(k));
    if (chavesFaltando.length > 0) {
      const esperados = e.chavesEsperadas.length;
      const chegaram = esperados - chavesFaltando.length;
      const nomesFaltando = chavesFaltando.map(nomeLegivelDaChave);
      // Concordância no singular de propósito — mesma lição da régua
      // (voz 99379e28: "1 não chegaram" soa automático na frase em que a
      // casa admite a própria falha).
      const um = chavesFaltando.length === 1;
      const mensagem =
        `Recebemos apenas ${chegaram} dos ${esperados} arquivos — ` +
        `${chavesFaltando.length} ${um ? "não chegou" : "não chegaram"} até nós: ` +
        `${nomesFaltando.join(", ")}. ` +
        `A falha foi do envio, não da sua gravação, e nada foi cobrado. ` +
        `Reenvie ${um ? "apenas esse arquivo" : "apenas esses arquivos"} — ` +
        `não precisa gravar nada de novo.`;
      return {
        tipo: "envio_incompleto",
        esperados,
        chegaram,
        chavesFaltando,
        nomesFaltando,
        mensagem,
      };
    }
  }

  if (!e.temMedicao) return { tipo: "sem_medicao" };

  // Só aqui — com TODOS os arquivos confirmados no bucket — a régua de
  // duração tem licença pra falar. A mensagem é a da régua, não uma cópia.
  if (e.totalSegundos < MIN_TOTAL_SECONDS) {
    return { tipo: "curto_demais", mensagem: mensagemCurtoDemais(e.totalSegundos) };
  }

  return { tipo: "ok" };
}
