/**
 * Incidente 146 (26/08) — o onboarding NÃO pode repetir um veredito velho.
 *
 * O sintoma: o aluno recebia "o áudio enviado soma menos de 20 minutos" sobre
 * material que o sistema NUNCA OLHOU. Medido: em 14 dias, 18 das 20 recusas com
 * esse motivo tiveram `imported = 0` — nada foi baixado e nada foi medido.
 *
 * Eram DOIS defeitos independentes, e este módulo guarda a lógica pura dos dois
 * (o wrapper real — import.ts e a rota — só liga os fios):
 *
 *  (1) A GUARDA DE IDEMPOTÊNCIA pegava a voz MAIS ANTIGA do onboarding
 *      (`created_at ASC limit 1`) e tratava QUALQUER status != "uploading" como
 *      "já está pronto". Consequências: estado TERMINAL DE FALHA
 *      ("rejected_too_short", "failed") virava "pronto", então material NOVO era
 *      pulado sem download e sem medição; e o aluno que já tinha consertado
 *      seguia julgado pela primeira falha. Caso real: rafaelleitemacedo tinha
 *      voz `ready` desde 16/08 e em 22/08 levou e-mail dizendo que o áudio dele
 *      tinha menos de 20min, porque a guarda leu a voz reprovada de 13/08.
 *      → `decidirVozOnboarding`.
 *
 *  (2) A ROTA convertia esse `voice_status` HERDADO em e-mail ao aluno, sem
 *      perguntar se ESTE run tinha medido alguma coisa. Prova: run f7a26c5e
 *      (ycarlosk@gmail.com, 26/08 19h31) devolveu
 *      `{"imported":0,"skipped":10,"voice_id":"8dafbf91","voice_status":"rejected_too_short"}`
 *      — a voz 8dafbf91 é de 24/08, tem 1 arquivo e 72s, e não foi tocada em
 *      26/08; o aluno tinha acabado de mandar 10 arquivos com 28min.
 *      → `vereditoAudio`.
 *
 * ⚠️ A RÉGUA NÃO MUDA. `MIN_TOTAL_SECONDS` e `estimateSpeechSeconds` seguem
 * intactos: o objetivo é fazer o portão de 20min RODAR, não afrouxá-lo.
 */

/** O que a guarda precisa saber de uma voz do onboarding. */
export type VozOnboarding = {
  id: string;
  status: string;
  /** `voices.raw_audio_paths` cru do banco (pode vir null/JSON). */
  raw_audio_paths?: unknown;
  created_at?: string | null;
};

/**
 * Estados em que a voz já cumpriu — ou está cumprindo — o papel dela. Aqui a
 * idempotência ANTIGA continua valendo integralmente: não se importa de novo,
 * não se cobra de novo, e `awaiting_training` segue disparando o treino.
 * "validating" entra porque é passagem, não desfecho.
 */
export const ESTADOS_BONS = [
  "ready",
  "training",
  "awaiting_training",
  "validating",
] as const;

/**
 * Estados TERMINAIS DE FALHA. O veredito aqui é sobre o material ANTIGO — não
 * vale para material novo, e é exatamente isso que o defeito (1) confundia.
 */
export const ESTADOS_FALHA_TERMINAL = ["rejected_too_short", "failed"] as const;

export type DecisaoVoz =
  /** Voz em estado bom: pula a importação (comportamento idempotente de sempre). */
  | { acao: "reusar"; voz: VozOnboarding }
  /** Voz em "uploading": a importação anterior morreu no meio — retoma nela. */
  | { acao: "retomar"; voz: VozOnboarding }
  /** Falha terminal + MESMO material: re-execução da planilha, nada a fazer. */
  | { acao: "pular"; voz: VozOnboarding }
  /** Sem voz, ou falha terminal + material NOVO: importa e MEDE de verdade. */
  | { acao: "importar" };

/**
 * O fileId já está representado em `raw_audio_paths`?
 *
 * A chave é determinística: `buildRawAudioKey` grava
 * `<userId>/<voiceId>/raw/NNN_onboarding_<fileId>.<ext>` (com o fileId
 * higienizado por `[^a-zA-Z0-9_-]`). A extensão depende do CONTEÚDO baixado,
 * então casamos pelo miolo `_<fileId>.` — que também sobrevive ao
 * `filename.slice(-80)` do `buildRawAudioKey` (o corte come o prefixo
 * "onboarding_", nunca o id nem o ponto da extensão).
 */
export function fileIdRepresentado(paths: unknown, fileId: string): boolean {
  const lista = Array.isArray(paths) ? paths : [];
  const safe = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) return false;
  const marca = `_${safe}.`;
  return lista.some((p) => typeof p === "string" && p.includes(marca));
}

/** Ordena da mais NOVA pra mais velha (sem `created_at` vai pro fim). */
function maisNovaPrimeiro(vozes: VozOnboarding[]): VozOnboarding[] {
  return [...vozes].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : Number.NEGATIVE_INFINITY;
    const tb = b.created_at ? Date.parse(b.created_at) : Number.NEGATIVE_INFINITY;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    return (Number.isNaN(tb) ? Number.NEGATIVE_INFINITY : tb) -
      (Number.isNaN(ta) ? Number.NEGATIVE_INFINITY : ta);
  });
}

/**
 * Decide o que fazer com as vozes "Minha Voz" que o aluno já tem.
 *
 * Regra, nesta ordem:
 *  1. Existe voz em estado BOM? Ela manda — comportamento de hoje, preservado.
 *  2. A mais recente está em "uploading"? Retoma a importação nela.
 *  3. A mais recente está em falha terminal?
 *     - todos os fileIds já representados → é a planilha reprocessando o MESMO
 *       material: continua pulando (é essa proteção que evita o e-mail
 *       duplicado — robson levou 3, itabenke 3, isabella 3);
 *     - existe fileId NOVO → o aluno reenviou: importa e MEDE.
 *  4. Status desconhecido: pula, como a guarda antiga fazia (conservador).
 */
export function decidirVozOnboarding(
  vozes: VozOnboarding[],
  fileIds: string[],
): DecisaoVoz {
  const ordenadas = maisNovaPrimeiro(vozes);
  const bom = ordenadas.find((v) =>
    (ESTADOS_BONS as readonly string[]).includes(v.status),
  );
  if (bom) return { acao: "reusar", voz: bom };

  const recente = ordenadas[0];
  if (!recente) return { acao: "importar" };

  if (recente.status === "uploading") return { acao: "retomar", voz: recente };

  if ((ESTADOS_FALHA_TERMINAL as readonly string[]).includes(recente.status)) {
    const temMaterialNovo = fileIds.some(
      (id) => !fileIdRepresentado(recente.raw_audio_paths, id),
    );
    return temMaterialNovo ? { acao: "importar" } : { acao: "pular", voz: recente };
  }

  return { acao: "pular", voz: recente };
}

// ── Lado da rota: quem pode falar de DURAÇÃO com o aluno ────────────────────

export type EntradaAvisoAudio = {
  /** Quantos áudios a linha da planilha pediu (`audios.length` na rota). */
  audiosPedidos: number;
  /** Arquivos que ESTE run baixou e subiu (logo, MEDIU). */
  imported: number;
  /** Arquivos que ESTE run pulou (o veredito veio de uma voz anterior). */
  skipped: number;
  voiceStatus: string | null;
  /** Nota do disparo do treino — entra no texto do áudio curto. */
  training?: string | null;
  /** `failed[0].error` da importação, quando houve. */
  primeiroErro?: string | null;
  /** `failed.length` da importação. */
  qtdErros?: number;
};

export type AvisoAudio = {
  /**
   * ESTE run mediu o material e ele ficou abaixo da régua — a ÚNICA situação em
   * que se pode falar de "20 minutos" com o aluno. Também derruba o `ok` da rota.
   */
  audioCurto: boolean;
  /**
   * "rejected_too_short" herdado de uma importação anterior: nada foi medido
   * agora. O aluno NÃO é avisado de novo (ele já foi, no run que mediu), mas a
   * linha continua sendo erro — ela está parada de verdade.
   */
  audioCurtoHerdado: boolean;
  acao:
    /** E-mail pro aluno + grupo (`tratarErro`). */
    | "avisar_aluno"
    /** Só o grupo: veredito herdado, o aluno já sabe (incidente 146). */
    | "so_grupo_herdado"
    /** Só o grupo: parte dos arquivos falhou, mas a etapa não travou. */
    | "so_grupo_parcial"
    | "nenhum";
  /** Motivo pronto — o MESMO texto vai pra planilha, pro grupo e pro e-mail. */
  motivo: string | null;
};

/** O motivo HONESTO da herança — o que o run pode afirmar sem ter medido nada. */
export const MOTIVO_AUDIO_CURTO_HERDADO =
  "a voz do onboarding já estava recusada por áudio curto numa importação " +
  "anterior e nenhum áudio novo chegou nesta execução";

/** Arquivos que a importação NÃO conseguiu ler (teto de tamanho, download etc). */
export type DescarteAudio = { qtd: number; total: number; erro?: string | null };

/**
 * Texto de recusa por duração. Só sai quando ESTE run mediu.
 *
 * ⚠️ O `descarte` não é enfeite (medido no caso Johnathan, #180, 29/08). Ele
 * mandou 15 gravações; 8 morreram no teto de 400MB do import — entre elas uma
 * de 490MB com 28min22s de fala, que SOZINHA abriria a porta de 20min. As 7 que
 * couberam somaram 19min15s, e a mensagem saía como "o áudio enviado soma menos
 * de 20 minutos": verdade sobre o que MEDIMOS, mentira sobre o que ELE ENVIOU —
 * e a diferença eram 45 segundos. Ele já tinha sido mandado consertar o
 * compartilhamento (que estava certo) e reorganizar a pasta (que ele fez); este
 * seria o TERCEIRO recado culpando o aluno por um limite nosso.
 */
export function motivoAudioCurto(
  training?: string | null,
  descarte?: DescarteAudio | null,
): string {
  const base = `o áudio enviado soma menos de 20 minutos (${training ?? "mínimo não atingido"})`;
  if (!descarte || descarte.qtd <= 0) return base;
  return (
    `o áudio que CONSEGUIMOS LER soma menos de 20 minutos (${training ?? "mínimo não atingido"}), ` +
    `mas ${descarte.qtd} de ${descarte.total} arquivos ficaram de fora por limitação nossa ` +
    `(${descarte.erro ?? "motivo não registrado"}) — a soma acima não é o que foi enviado`
  );
}

/**
 * Decide o que a rota faz com o resultado da importação de áudio.
 *
 * A regra que faltava (incidente 146): um run que não mediu NADA não pode
 * afirmar NADA ao aluno sobre duração. Só `imported > 0` prova que este run
 * baixou o material e passou a régua nele.
 *
 * Continuam intactos os dois casos legítimos de hoje:
 *  - `imported > 0` com `rejected_too_short` → recusa MEDIDA, o aluno é avisado
 *    (definidameta 25/08 e a 1ª run do itabenke foram exatamente isso);
 *  - `imported + skipped === 0` → nada aproveitável no link, o aluno é avisado.
 */
export function decidirAvisoAudio(e: EntradaAvisoAudio): AvisoAudio {
  const curto = e.voiceStatus === "rejected_too_short";
  const mediuAgora = e.imported > 0;
  const audioCurto = curto && mediuAgora;
  const audioCurtoHerdado = curto && !mediuAgora && e.skipped > 0;
  const nadaEntrou = e.imported + e.skipped === 0;

  if (e.audiosPedidos > 0 && (nadaEntrou || audioCurto)) {
    return {
      audioCurto,
      audioCurtoHerdado,
      acao: "avisar_aluno",
      motivo: audioCurto
        ? motivoAudioCurto(e.training, {
            // O ramo `so_grupo_parcial` lá embaixo já contava os descartados,
            // mas ele é INALCANÇÁVEL quando `audioCurto` é true — o `return`
            // acima sai primeiro. Era assim que o descarte por teto sumia da
            // mensagem do aluno (#180).
            qtd: e.qtdErros ?? 0,
            total: e.audiosPedidos,
            erro: e.primeiroErro,
          })
        : (e.primeiroErro ?? "nenhum áudio aproveitável no link"),
    };
  }

  if (audioCurtoHerdado) {
    return {
      audioCurto,
      audioCurtoHerdado,
      acao: "so_grupo_herdado",
      motivo: MOTIVO_AUDIO_CURTO_HERDADO,
    };
  }

  if ((e.qtdErros ?? 0) > 0) {
    return {
      audioCurto,
      audioCurtoHerdado,
      acao: "so_grupo_parcial",
      motivo: `${e.qtdErros} de ${e.audiosPedidos} falharam: ${e.primeiroErro ?? "?"}`,
    };
  }

  return { audioCurto, audioCurtoHerdado, acao: "nenhum", motivo: null };
}
