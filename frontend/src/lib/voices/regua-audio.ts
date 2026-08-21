/**
 * A régua de áudio do treino, em UM lugar só — e a mensagem que o aluno lê.
 *
 * Por que existe (incidente 07745f61, medido em 21/08):
 *
 * São DOIS mínimos diferentes e o aluno só conhecia o errado:
 *   - PORTA (aqui): 20min BRUTOS somados. É o que deixa o áudio ENTRAR.
 *   - TREINO (worker): 10min de fala LIMPA, pós Demucs+VAD. É o que faz o
 *     treino PASSAR.
 * 20 brutos ≈ 10 limpos é a folga que cobre pausa, respiração e ruído.
 *
 * O estrago: nossas mensagens de falha citavam só o mínimo do TREINO ("10min
 * de fala limpa") e mandavam "tente de novo com essa gravação nova". Quem
 * obedecia gravava 12–15min e batia na PORTA, que exige 20 — sem que nenhuma
 * das duas mensagens mencionasse a outra. Em 21/08 havia 14 vozes de 9 alunos
 * PAGANTES paradas em `rejected_too_short`, várias por pouco (15min, 18min,
 * 18min), nenhuma delas avisada.
 *
 * O segundo estrago era aritmético: a mensagem arredondava com `Math.round`,
 * então 1174s (19,57min) virava a frase impossível
 * "Áudio total 20min < mínimo de 20min" — foi o que kelinnavelar leu.
 * Aqui o número do aluno SEMPRE arredonda pra baixo: se está abaixo da porta,
 * a frase tem que mostrar isso.
 */

/** A PORTA: soma bruta mínima pro áudio ser aceito. Espelha o medidor da tela. */
export const MIN_TOTAL_SECONDS = 20 * 60;

/** O TREINO: fala limpa mínima exigida pelo worker (TRAIN_MIN_USEFUL_SECONDS). */
export const MIN_USEFUL_SECONDS = 10 * 60;

/**
 * Minutos do aluno pra exibição. Arredonda pra BAIXO de propósito: quem tem
 * 19,57min não pode ler "20min" numa frase que o está recusando por ter menos
 * de 20min.
 */
export function minutosExibidos(segundos: number): number {
  return Math.floor(Math.max(0, segundos) / 60);
}

/**
 * A mensagem de recusa na porta. Diz quanto falta e o que fazer — antes o
 * aluno só recebia o veredito, nunca o alvo.
 */
export function mensagemCurtoDemais(totalSegundos: number): string {
  const tem = minutosExibidos(totalSegundos);
  const alvo = MIN_TOTAL_SECONDS / 60;
  const faltam = Math.max(1, Math.ceil((MIN_TOTAL_SECONDS - totalSegundos) / 60));
  return (
    `Áudio total ${tem}min < mínimo de ${alvo}min. ` +
    `Faltam ~${faltam}min: adicione mais gravação (ou regrave) até somar ${alvo}min ` +
    `e envie de novo — nada foi cobrado.`
  );
}

/**
 * A recusa do TREINO (fala limpa insuficiente), com o mesmo compromisso da
 * porta: o número do aluno arredonda pra BAIXO e a frase diz quanto falta.
 *
 * Por que existe (medido em 21/08, incidente acf8acd6 — o balde estava
 * `fixed` desde 09/08 e voltou a disparar 6x depois disso):
 *
 * `finalize-training` usava `Math.round` nos dois lados da comparação, então
 * quem parava a um passo do mínimo lia a frase impossível
 * "apenas ~10min serviram para o treino (mínimo: 10min de fala limpa)" —
 * o mesmo defeito aritmético que a porta tinha, no outro mínimo.
 *
 * Casos reais, do `training_jobs.useful_seconds`:
 *   dirceu.moura.cruz78  594,2s · **598,5s** · 591,1s   (mínimo 600s)
 *   lauriane20           3 tentativas, todas exibindo "~10min vs 10min"
 *
 * Os dois tentaram TRÊS vezes seguidas. O `598,5s` do dirceu é **1,5 segundo**
 * abaixo do corte: a mensagem afirmava que ele tinha exatamente o mínimo e
 * mesmo assim o recusava, sem dizer o que mudar. Nada a fazer com essa frase
 * a não ser tentar de novo às cegas — foi o que os dois fizeram.
 */
export function mensagemFalaLimpaInsuficiente(
  usefulSegundos: number | null | undefined,
  minUsefulSegundos?: number | null,
): string {
  const min =
    typeof minUsefulSegundos === "number" && minUsefulSegundos > 0
      ? minUsefulSegundos
      : MIN_USEFUL_SECONDS;
  const alvoLimpo = Math.ceil(min / 60);
  const porta = MIN_TOTAL_SECONDS / 60;

  // Sem número do worker não dá pra prometer precisão — não invente um.
  const diagnostico =
    typeof usefulSegundos === "number"
      ? `apenas ~${minutosExibidos(usefulSegundos)}min serviram para o treino ` +
        `(mínimo: ${alvoLimpo}min de fala limpa)`
      : `não sobrou fala limpa suficiente para o treino`;

  // O quase-lá merece frase própria: quem falhou por segundos precisa saber
  // que faltou pouco, senão regrava do zero achando que errou tudo.
  const faltouSeg =
    typeof usefulSegundos === "number" ? Math.max(0, min - usefulSegundos) : null;
  const quantoFalta =
    faltouSeg === null
      ? ""
      : faltouSeg < 60
        ? ` Faltou muito pouco — menos de 1min de fala limpa.`
        : ` Faltaram ~${Math.ceil(faltouSeg / 60)}min de fala limpa.`;

  return (
    `Do áudio enviado, ${diagnostico}.${quantoFalta} ` +
    `Seus créditos foram devolvidos. Grave num ambiente silencioso, falando ` +
    `continuamente e próximo ao microfone. Importante: para enviar de novo, a ` +
    `gravação precisa somar pelo menos ${porta}min no total — é dessa folga que ` +
    `saem os ${alvoLimpo}min de fala limpa, depois que tiramos pausas e ruído.`
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * ENVIO INCOMPLETO: o aluno mandou N arquivos e só M chegaram no R2.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Medido em 21/08 (incidente 2c5bab42), na base inteira e paginada:
 *
 *   status                 vozes   com buraco na numeração
 *   rejected_too_short        24   17  (70,8%)
 *   awaiting_training         28    5  (17,9%)
 *   failed                    51    2  ( 3,9%)
 *   ready                    722    2  ( 0,3%)
 *
 * 70,8% contra 0,3% não é coincidência: quase toda voz recusada por "áudio
 * curto" é, na verdade, um ENVIO PELA METADE que a gente aceitou calado.
 *
 * DE ONDE VEM O BURACO (a causa foi corrigida de rota em 21/08 — a primeira
 * leitura culpava o `uploads-complete`, e ela está ERRADA):
 *
 *   - `voice-creator.tsx` manda `slots.map(s => s.key)` — TODAS as chaves,
 *     nunca um subconjunto — e ainda aborta antes de chamar o
 *     `uploads-complete` se qualquer PUT falhar. Esse caminho **não
 *     consegue** produzir buraco, e é assim desde o commit 727d461.
 *   - Quem produz o buraco é o RESGATE (`rescue-stuck-uploads.ts`): quando a
 *     aba fecha no meio do envio, a voz fica em `uploading` e o sweep lista o
 *     bucket e grava **o que encontrou lá**. Se 3 de 7 arquivos não subiram,
 *     ele grava 4 e soma só esses 4 — e a soma cai abaixo da porta.
 *
 * O estrago é a FRASE: o aluno lia "Áudio total 10min < mínimo de 20min",
 * que o acusa de ter gravado pouco quando ele gravou o dobro e o nosso envio
 * é que perdeu metade no caminho. Mandar esse aluno "gravar mais" é mandar
 * ele repetir o que já fez.
 *
 * O índice do slot está DENTRO da chave (`.../raw/NNN_arquivo.mp3`, ver
 * `buildRawAudioKey`), então o buraco é detectável sem migration e sem
 * persistir contagem nenhuma: se a maior numeração é 006, foram emitidos 7
 * slots.
 */

/** Extrai o índice do slot de uma chave `.../raw/NNN_arquivo.ext`. */
const RX_SLOT = /\/raw\/(\d{3})_/;

/**
 * As extensões que o treino aceita. Fonte única: o `rescue-stuck-uploads`
 * importa daqui em vez de manter cópia própria — duas listas divergentes
 * fazem a contagem de slot discordar do filtro que a produziu.
 */
export const RX_EXT_AUDIO = /\.(mp3|wav|m4a|aac|ogg|opus|webm|mp4|flac)$/i;

export type ContagemEnvio = {
  /**
   * Quantos slots foram emitidos PARA ÁUDIO: maior índice + 1, MENOS os
   * slots ocupados por arquivo que a gente descarta de propósito. 0 se não
   * deu pra ler.
   */
  esperados: number;
  /** Quantas chaves utilizáveis chegaram. */
  chegaram: number;
  /** Quantos slots de áudio ficaram sem arquivo utilizável. */
  faltando: number;
  /**
   * Slots ocupados por arquivo NÃO-ÁUDIO (foto/PDF da pasta do Drive).
   * **Não são buraco** — a gente ignora de propósito desde o `910ea757`.
   */
  ignorados: number;
};

/**
 * Conta slots emitidos × chegados a partir das chaves.
 *
 * `todasAsChaves` deve ser TUDO que existe no prefixo do R2 (inclusive o que
 * foi filtrado por tamanho/extensão) e `utilizaveis` só o que passou no
 * filtro. A diferença entre as duas importa: arquivo que chegou truncado
 * (PUT cortado no meio) existe no bucket com poucos bytes e é descartado —
 * pro aluno o efeito é o mesmo, mas não é o mesmo defeito, então quem chamar
 * consegue distinguir.
 *
 * Sem numeração legível (import antigo, caminho do Drive) devolve zeros —
 * quem chama trata como "não sei", nunca como "não faltou nada".
 *
 * ⚠️ SLOT COM FOTO NÃO É BURACO (medido em 21/08 na voz `8aca0126`,
 * csitya100). O import do Drive numera **todo** arquivo da pasta, inclusive
 * as fotos e os PDFs que o `910ea757` mandou ignorar. Contar esses slots
 * como "não chegou" fazia a recusa dizer *"recebemos apenas 7 dos 20
 * arquivos, 13 não chegaram até nós"* quando os 13 eram 6 JPEG + 7 PDF que
 * a gente descarta de propósito — a gente se acusava de perder o que nunca
 * era áudio, e ainda mandava o aluno reenviar as fotos. Slot ocupado por
 * não-áudio sai da conta de `esperados` e vai pra `ignorados`.
 *
 * Continua contando como buraco o slot que **existe** com extensão de áudio
 * mas foi descartado por tamanho (PUT cortado no meio): esse o aluno mandou
 * de verdade e reenviar resolve.
 */
export function contarSlotsDoEnvio(
  utilizaveis: string[],
  todasAsChaves: string[] = utilizaveis,
): ContagemEnvio {
  const indice = (k: string): number | null => {
    const m = RX_SLOT.exec(k);
    return m ? Number.parseInt(m[1], 10) : null;
  };

  const todos = todasAsChaves
    .map(indice)
    .filter((i): i is number => i !== null);
  const bons = new Set(
    utilizaveis.map(indice).filter((i): i is number => i !== null),
  );

  if (todos.length === 0 && bons.size === 0) {
    return { esperados: 0, chegaram: 0, faltando: 0, ignorados: 0 };
  }

  // Slots que existem no bucket e NÃO são áudio: descarte proposital, não
  // perda. Um slot que também aparece em `utilizaveis` nunca entra aqui.
  const naoAudio = new Set(
    todasAsChaves
      .filter((k) => !RX_EXT_AUDIO.test(k))
      .map(indice)
      .filter((i): i is number => i !== null && !bons.has(i)),
  );

  const maior = Math.max(-1, ...todos, ...bons);
  const esperados = Math.max(0, maior + 1 - naoAudio.size);
  return {
    esperados,
    chegaram: bons.size,
    faltando: Math.max(0, esperados - bons.size),
    ignorados: naoAudio.size,
  };
}

/**
 * A recusa quando o envio chegou pela metade. Não pede pra gravar mais —
 * pede pra REENVIAR, que é a única coisa que resolve. E diz de quem é a
 * culpa, porque é nossa.
 */
export function mensagemEnvioIncompleto(
  totalSegundos: number,
  chegaram: number,
  esperados: number,
): string {
  const faltando = Math.max(0, esperados - chegaram);
  const tem = minutosExibidos(totalSegundos);
  // Concordância no singular: com UM arquivo perdido a frase virava
  // "1 não chegaram até nós". Achado em 21/08 no backfill do `2c5bab42` — a voz
  // `99379e28` (4 de 5) leria exatamente isso. É a frase em que a casa admite a
  // própria falha; escrita errada, soa automática e perde o peso.
  const chegou = faltando === 1 ? "não chegou" : "não chegaram";
  return (
    `Recebemos apenas ${chegaram} dos ${esperados} arquivos que você enviou — ` +
    `${faltando} ${chegou} até nós (o envio foi interrompido no meio, ` +
    `normalmente quando a aba fecha ou a internet oscila). ` +
    `O que chegou soma ~${tem}min, por isso o treino não pôde começar. ` +
    `Não é que você gravou pouco — a MESMA gravação serve. Envie de novo e, ` +
    `desta vez, deixe a aba aberta até a barra de envio chegar ao fim. ` +
    `Nada foi cobrado.`
  );
}
