/**
 * Classificação automática de falhas → incidentes (aba Falhas do /admin).
 * Regras determinísticas em cima do texto do erro: causa + assinatura de
 * dedup (mesma causa raiz = mesmo incidente, mesmo com uuids/urls diferentes).
 *
 * ⚠️ DESDE 16/09 O TEXTO DO ERRO NÃO É MAIS A ÚNICA ENTRADA. As três funções
 * públicas aceitam um `diag` OPCIONAL com o stderr do trainer, porque a falha
 * de treino chega ao `error_message` como as três palavras `trainer failed`,
 * iguais em toda falha — o diagnóstico de verdade mora em
 * `training_jobs.trainer_stderr` (mig 97). O porquê, com os números medidos,
 * está em `./diagnostico-trainer.ts`. Sem `diag`, tudo se comporta exatamente
 * como antes: as 70 falhas cegas da tabela (pré-mig 97) dependem disso.
 */
import {
  ASSINATURA_CUDA_OOM,
  ASSINATURA_DISCO_CHEIO,
  ASSINATURA_ESCRITA_CHECKPOINT,
  type DiagnosticoTrainer,
  ehCudaOom,
  ehDiscoCheio,
  ehEscritaDeCheckpointFalhou,
  SUFIXO_CUDA_OOM,
  SUFIXO_DISCO_CHEIO,
  SUFIXO_ESCRITA_CHECKPOINT,
} from "./diagnostico-trainer.ts";

export type { DiagnosticoTrainer };
export {
  ASSINATURA_CUDA_OOM,
  ASSINATURA_DISCO_CHEIO,
  ASSINATURA_ESCRITA_CHECKPOINT,
  ehCudaOom,
  ehDiscoCheio,
  ehEscritaDeCheckpointFalhou,
};

export type IncidentCause =
  | "user_dataset"
  | "infra_gpu"
  // Disco LOCAL do worker cheio (ENOSPC). Separado de `infra_storage`, que é o
  // bucket remoto (R2): outra máquina, outro dono, outra conduta. Ver
  // `ASSINATURA_DISCO_CHEIO`.
  | "infra_disk"
  | "infra_storage"
  | "capacity"
  | "bug"
  | "reported"
  | "unknown";

export const CAUSE_LABELS: Record<IncidentCause, string> = {
  user_dataset: "Áudio do usuário",
  infra_gpu: "Infra GPU",
  infra_disk: "Infra disco (worker)",
  infra_storage: "Infra armazenamento",
  capacity: "Capacidade/timeout",
  bug: "Bug",
  reported: "Reportado",
  unknown: "Desconhecida",
};

export const KIND_LABELS: Record<string, string> = {
  training: "Treino de voz",
  voice: "Treino de voz",
  generation: "Geração de áudio",
  reported: "Reportado",
};

/** Sufixo da assinatura do chunk de dataset inválido. Fixo — ver
 *  `ehChunkDoDatasetInvalido`. */
export const SUFIXO_CHUNK_DATASET = "dataset-chunk-invalido";

/** Sufixo da assinatura de falha do bucket remoto (R2). Fixo — o porquê está
 *  no bloco de `infra_storage` dentro de `errorSignature` (#510, 21/09). */
export const SUFIXO_STORAGE = "r2";

/**
 * O ARQUIVO CITADO NO ERRO É NOSSO, NÃO DO ALUNO — #475, medido em 19/09.
 *
 * O worker trabalha em duas pastas, e a diferença entre elas é a diferença
 * entre "o aluno mandou lixo" e "nós produzimos lixo":
 *
 *   /workspace/jobs/<voz>/raw/      ← o que o ALUNO enviou (upload/zip)
 *   /workspace/jobs/<voz>/dataset/  ← o que NÓS escrevemos, fatiando o áudio
 *                                     dele em chunks `voice_NNNN.wav`
 *
 * Nada que o aluno envie nasce em `/dataset/`: essa pasta só existe depois que
 * a nossa etapa de preparo escreve nela. Logo, mídia inválida ali dentro é
 * defeito NOSSO, por construção.
 *
 * ── Por que isto precisou virar código ────────────────────────────────────
 * `isCorruptFile()` decidia por TEXTO, e o texto é o mesmo nos dois mundos. Os
 * dois únicos jobs da história da tabela com "Invalid data found when
 * processing input" (medido em 19/09) dizem coisas opostas:
 *
 *   14/08  1815ad70  ".../raw/000_000_onboarding_*.zip: Invalid data found"
 *                    → o ZIP que o aluno subiu estava podre. Culpa dele. OK.
 *   19/09  ab066e99  "[Errno 1094995529] Invalid data found: '.../dataset/
 *                     voice_0032.wav'"
 *                    → o arquivo é um chunk que NÓS cortamos. Culpa nossa.
 *
 * O segundo caía em `user_dataset` junto com o primeiro, e isso disparava três
 * consequências erradas de uma vez, todas medidas na josiclareth (#475):
 *   1. `falhaEhNossa()` devolvia false → NENHUM chamado foi aberto. A falha não
 *      existiu para a fila: entre 00h15Z e 10h15Z nasceram 2 cartões e os dois
 *      vieram da Fast, por contato de aluno.
 *   2. A mensagem mandou ela "enviar o arquivo de novo (ou gravar novamente)" —
 *      23 minutos de regravação por um arquivo que ela nunca enviou.
 *   3. Ela não tentou de novo. Ficou 5h sem voz, com acesso ativo e 100.000
 *      créditos na conta.
 *
 * A perícia que sustenta "o material dela estava bom": os 9 `raw/*.mp3` foram
 * decodificados um a um (`_frank/ferramentas/2026-09-19_periciar_takes_da_voz.cjs`)
 * — 9/9 limpos, taxa uniforme de 16003 B/s, nenhum mudo, detector validado por
 * controle negativo na mesma execução.
 *
 * ⚠️ Deliberadamente ESTREITO: só o caminho `/dataset/`. Erro sem caminho
 * nenhum ("moov atom not found" seco) continua sendo do aluno, como sempre foi
 * — mudar isso mexeria em comportamento antigo sem medida que justifique.
 */
export function ehChunkDoDatasetInvalido(error: string | null | undefined): boolean {
  const e = (error || "").toLowerCase();
  return e.includes("/dataset/") && ehTextoDeMidiaInvalida(e);
}

/** As frases de mídia ilegível, sem julgar de QUEM é o arquivo. */
function ehTextoDeMidiaInvalida(e: string): boolean {
  return (
    e.includes("moov atom") ||
    e.includes("invalid data found when processing input") ||
    e.includes("could not find codec parameters") ||
    e.includes("corrompido ou incompleto") ||
    // Caso Erica 31/07 (inc. 57d360e4): arquivo SEM trilha de áudio nenhuma
    // (vídeo mudo ou upload quebrado) — ffmpeg não tem o que converter.
    e.includes("does not contain any stream")
  );
}

/** Arquivo do usuário corrompido/incompleto (caso Carla 29/07: moov atom).
 * Cobre o erro CRU do ffmpeg e a mensagem amigável do finalize-training.
 *
 * ⚠️ 19/09: mídia ilegível cujo caminho é `/dataset/` NÃO entra aqui — aquele
 * arquivo foi escrito por nós. Ver `ehChunkDoDatasetInvalido`. */
export function isCorruptFile(error: string): boolean {
  const e = (error || "").toLowerCase();
  if (ehChunkDoDatasetInvalido(e)) return false;
  return ehTextoDeMidiaInvalida(e);
}

/**
 * Tira o invólucro "RunPod <STATUS>: " que UM dos dois caminhos de falha
 * coloca na frente do erro real.
 *
 * A MESMA falha chega ao banco escrita de duas formas, e quem escreve depende
 * de uma CORRIDA, não da causa:
 *   - webhook (`webhooks/runpod/route.ts`) grava o erro CRU:
 *       "executionTimeout exceeded"
 *   - polling da tela do aluno (`generations/[id]/route.ts`) embrulha:
 *       "RunPod FAILED: executionTimeout exceeded"
 *
 * Sem tirar o invólucro, o head da assinatura muda e a mesma causa raiz vira
 * DOIS incidentes. Medido em 24/08 no `d3d8d1b2` (nº 15, 12 alunos, o mais
 * antigo do quadro): ele acumulava só a forma crua, então a falha da Janete de
 * 23/08 23:41 (a mesma `executionTimeout`) não incrementou nada e o
 * `last_seen_at` ficou congelado em 18/08 — o incidente parecia dormente
 * enquanto a classe seguia derrubando aluno. Foi o que sustentou, por 11
 * rondas, o "detector cego" que ninguém conseguia explicar.
 *
 * Só desembrulha quando sobra conteúdo: "RunPod FAILED: " sozinho (resp.error
 * nulo) não vira string vazia, senão falhas sem detalhe nenhum desabariam
 * todas num único `unknown`.
 */
export function stripRunpodWrapper(error: string): string {
  // `[\s\S]+` em vez de `.+` com flag `s`: o target do projeto é anterior a
  // es2018 e não aceita dotall. Sem isso, erro com traceback (multi-linha)
  // não casaria e continuaria embrulhado.
  const m = /^\s*runpod\s+(failed|cancelled|timed_out)\s*:\s*([\s\S]+)$/i.exec(error || "");
  return m && m[2].trim() ? m[2].trim() : error || "";
}

/**
 * Remove o sufixo de telemetria "[fase: ...]" que `errorMessageComFase`
 * (lib/generations/fase-telemetria.ts) concatena no error_message de falha por
 * executionTimeout (incidente d3d8d1b2, #15). O nome da fase VARIA
 * (geracao.chunk × qa.whisper × model.load...) e não é normalizado pelas regras
 * numéricas abaixo — sem este strip, cada fase pendurada viraria um incidente
 * NOVO e a mesma causa raiz se estilhaçaria (a patologia do "detector cego"
 * medida em 24/08 no próprio d3d8d1b2). Mudou o formato do sufixo lá, muda o
 * regex aqui — são gêmeos.
 */
export function stripFaseSuffix(error: string): string {
  return (error || "").replace(/\s*\[fase:[^\]]*\]/gi, "").trim();
}

export function classifyCause(error: string, diag?: DiagnosticoTrainer): IncidentCause {
  const e = stripRunpodWrapper(stripFaseSuffix(error)).toLowerCase();
  // ⚠️ SEM `diag`, daqui pra baixo NADA muda. Falha cega (as 70 anteriores à
  // mig 97) e caller antigo continuam caindo nas mesmas regras de sempre —
  // inclusive `!e → unknown`, que precede o diagnóstico de propósito: erro
  // vazio sem stderr não pode virar causa inventada.
  // ⚠️ Os dois detectores precisam estar nesta guarda. Ela roda ANTES das
  // regras, então um `error` vazio com stderr que PROVA a causa sairia daqui
  // como "unknown" e nunca chegaria na linha que o classifica.
  if (
    !e &&
    !ehCudaOom(diag?.stderr) &&
    !ehDiscoCheio(diag?.stderr) &&
    !ehEscritaDeCheckpointFalhou(diag?.stderr)
  ) {
    return "unknown";
  }
  if (
    e.includes("insufficient_audio") ||
    e.includes("no usable speech") ||
    // Desde fdcc75c o voices.error_message guarda a MENSAGEM AMIGÁVEL pro
    // usuário, não o código do worker — sem estes padrões o incidente caía em
    // "unknown" (gap achado pelo Vigia na 1ª execução, incidente 4eed0e0d).
    e.includes("fala limpa") ||
    e.includes("serviram para o treino") ||
    // Arquivo corrompido = problema do INPUT do usuário (caía em unknown e
    // engordava o guarda-chuva genérico — caso Carla 29/07, inc. 49df7b4a).
    isCorruptFile(error)
  ) {
    return "user_dataset";
  }
  /**
   * CHUNK DO DATASET INVÁLIDO — a correção de 19/09 (job `ab066e99`, #475).
   *
   * Sem esta linha a falha cai em `unknown`, porque o texto dela não casa com
   * nenhuma regra abaixo (não tem "trainer failed", nem traceback, nem cuda,
   * nem timeout). `unknown` abriria chamado — já seria melhor que hoje — mas
   * não diz nada a quem varre a fila, e o vão que esta correção fecha é
   * justamente o de uma falha nossa passar despercebida.
   *
   * É `bug` e não `infra_*` de propósito: com n=1 eu NÃO sei o mecanismo que
   * produziu o wav inválido (disco? escrita curta? take na fronteira do corte?).
   * `bug` diz o que está provado — o arquivo é nosso e saiu quebrado — e deixa
   * a investigação com dono. Chamar de `infra_disk` seria herdar a causa do
   * incidente vizinho, que é exatamente a armadilha que o playbook U proíbe.
   *
   * ⚠️ VEM DEPOIS de `user_dataset` para não mexer na precedência existente. Os
   * dois não podem coexistir: `isCorruptFile` agora devolve false justamente
   * quando este detector devolve true, e o teste de mutação prova isso.
   */
  if (ehChunkDoDatasetInvalido(error)) return "bug";
  /**
   * OOM PROVADO PELO STDERR — a correção de 16/09 (incidente #11).
   *
   * Sem esta linha, `classifyCause("trainer failed")` cai lá embaixo na regra
   * de `bug` e uma falha de INFRAESTRUTURA vira BUG NOSSO no quadro. Foi o que
   * aconteceu com a falha de GPU do ricardoolito em 15/09.
   *
   * ⚠️ VEM DEPOIS de `user_dataset`, de propósito. Se um dia chegar uma falha
   * que é, ao mesmo tempo, material impróprio do aluno E stderr com OOM, quem
   * ganha é o material — é a causa acionável, e é o comportamento de hoje.
   * Nunca foi observado (áudio ruim não chega a alocar na GPU); a ordem está
   * escrita para não mudar semântica antiga sem medida que justifique.
   */
  if (ehCudaOom(diag?.stderr)) return "infra_gpu";
  /**
   * DISCO CHEIO PROVADO PELO STDERR — a correção de 17/09 (job `bbf4b050`).
   *
   * Mesmo vão que o OOM fechou, com outro nome: sem esta linha,
   * `classifyCause("trainer failed")` cai lá embaixo na regra de `bug` e uma
   * falha de INFRAESTRUTURA vira BUG NOSSO dentro do #11.
   *
   * ⚠️ VEM DEPOIS do OOM, de propósito e conservadoramente. Os dois nunca
   * coexistiram (medido: o stderr do `bbf4b050` tem ENOSPC e NÃO tem texto de
   * OOM), então a ordem entre eles é hoje inobservável. Colocar disco DEPOIS
   * garante, por construção, que nenhum stderr que hoje classifica como
   * `infra_gpu` mude de causa por causa deste PR — zero regressão sem medida
   * que a justifique. Se algum dia chegar uma falha com os dois textos, ela cai
   * em `infra_gpu` e isso é uma decisão a revisar COM o caso na mão, não agora.
   */
  if (ehDiscoCheio(diag?.stderr)) return "infra_disk";
  /**
   * ESCRITA DE CHECKPOINT TRUNCADA — a correção de 18/09 (job `c7a376e5`).
   *
   * Terceira vez o mesmo vão: sem esta linha, `classifyCause("trainer failed")`
   * cai lá embaixo em `bug` e a falha reabre o #11. Foi o que aconteceu às
   * 22:40:12Z de 18/09.
   *
   * ⚠️ MESMA CAUSA do ENOSPC (`infra_disk`) — mesma conduta, mesmo dono — mas
   * assinatura com SUFIXO PRÓPRIO, porque o torch não confessa o errno. O
   * porquê está em `ASSINATURA_ESCRITA_CHECKPOINT`.
   *
   * ⚠️ VEM DEPOIS do ENOSPC, de propósito e conservadoramente: os dois textos
   * podem coexistir num stderr longo (mesma função `save_checkpoint`, arquivos
   * diferentes) e, nesse caso, ganha o que tem PROVA de errno. Assim nenhum
   * stderr que hoje classifica como `no-space` muda de assinatura por causa
   * deste PR.
   */
  if (ehEscritaDeCheckpointFalhou(diag?.stderr)) return "infra_disk";
  if (e.includes("out of memory") || e.includes("outofmemoryerror") || e.includes("cuda")) {
    return "infra_gpu";
  }
  if (
    e.includes("cloudflarestorage") ||
    e.includes("r2 upload failed") ||
    e.includes("502 bad gateway") ||
    e.includes("read timed out") ||
    e.includes("failed to download")
  ) {
    return "infra_storage";
  }
  if (e.includes("executiontimeout") || e.includes("timed_out")) {
    return "capacity";
  }
  if (e.includes("trainer failed") || e.includes("traceback") || e.includes("no module named")) {
    return "bug";
  }
  return "unknown";
}

/** Assinatura estável da causa raiz: tira uuids, urls, números e paths. */
export function errorSignature(kind: string, error: string, diag?: DiagnosticoTrainer): string {
  const cause = classifyCause(error, diag);
  // "voice" e "training" são a MESMA falha vista de duas tabelas — unifica.
  const k = kind === "voice" ? "training" : kind;
  /**
   * ── OOM SAI DO GUARDA-CHUVA `training:bug:trainer failed` ────────────────
   *
   * Chave CONSTANTE, sem head do erro. Dois motivos, nesta ordem:
   *
   * 1. O head não pode vir do stderr. O traceback muda a cada ocorrência
   *    (bytes alocados, pid do processo vizinho, GiB livres, frames do torch),
   *    então cada OOM abriria um incidente novo — a patologia que
   *    `classify.test.ts` já documenta e que o head de 120 chars torna
   *    inevitável. Nem a normalização numérica salva: os frames também mudam.
   * 2. O head não pode vir do `error`. Ele é literalmente `trainer failed` em
   *    TODA falha de trainer, e é por isso que o OOM de 15/09 foi engolido
   *    pelo #11 (aberto 21/07, "investigating" há 56 dias, `last_seen_at`
   *    carimbado pela própria falha de GPU que ninguém viu).
   *
   * ⚠️ ISTO ÓRFÃ O #11 PARA OOM, E É INTENCIONAL. O que acontece com as 4
   * ocorrências históricas dele está decidido e escrito no PR: elas FICAM onde
   * estão, sem migration de reassinatura. Três das quatro (21/07, 10/08,
   * 27/08) são cegas — `trainer_stderr` e `trainer_returncode` nulos, o RunPod
   * já purgou os jobs — e reassiná-las como OOM seria inventar causa para
   * falha que ninguém pode mais diagnosticar (o erro do #410: "classe
   * inventada é pior que chave velha"). A quarta (15/09) é OOM provado, mas já
   * está contada em `incident_occurrences` e mover só ela racharia um
   * incidente em dois. O #11 passa a ser o que sempre foi de fato: o
   * guarda-chuva das falhas de trainer SEM diagnóstico.
   *
   * ⚠️ A GUARDA É `cause === "infra_gpu"`, NÃO só `ehCudaOom`. A primeira
   * versão desta linha perguntava apenas pelo stderr e foi pega pelo teste
   * "erro de dataset continua ganhando do diagnóstico": material impróprio do
   * aluno + stderr com OOM produzia a chave inconsistente
   * `training:user_dataset:cuda-oom` — uma assinatura de dataset com sufixo de
   * GPU, que não é nenhum dos dois incidentes. Perguntar pela CAUSA DECIDIDA
   * mantém `classifyCause` como o único lugar que arbitra precedência.
   */
  if (cause === "infra_gpu" && ehCudaOom(diag?.stderr)) {
    return `${k}:${cause}:${SUFIXO_CUDA_OOM}`;
  }
  // Disco cheio: mesma disciplina do OOM logo acima — chave CONSTANTE (o
  // traceback muda a cada ocorrência: step, loss, frames do safetensors) e
  // guarda pela CAUSA DECIDIDA, não só pelo detector, para não produzir chave
  // inconsistente do tipo `training:user_dataset:no-space` caso um dia o
  // material do aluno ganhe a precedência com ENOSPC no stderr.
  if (cause === "infra_disk" && ehDiscoCheio(diag?.stderr)) {
    return `${k}:${cause}:${SUFIXO_DISCO_CHEIO}`;
  }
  // Escrita truncada: MESMA causa do acima (`infra_disk`), chave DIFERENTE. É a
  // primeira vez que duas classes dividem a causa, então a ordem destes dois
  // `if` é que arbitra o desempate — e ela é a mesma de `classifyCause`: ENOSPC
  // provado ganha de ENOSPC inferido. Repare que a guarda por CAUSA continua
  // valendo pelo mesmo motivo do OOM: sem ela, material impróprio do aluno com
  // este traceback produziria `training:user_dataset:write-failed`.
  if (cause === "infra_disk" && ehEscritaDeCheckpointFalhou(diag?.stderr)) {
    return `${k}:${cause}:${SUFIXO_ESCRITA_CHECKPOINT}`;
  }
  /**
   * ── R2 SAI DO HEAD DO ERRO — #510, medido em 21/09 ────────────────────────
   *
   * Chave CONSTANTE, mesma disciplina do OOM e do disco acima, pelo motivo
   * mais literal de todos: a URL PRESIGNADA do R2 passa de 500 chars e o erro
   * é truncado em 500 em DOIS produtores (finalize-training.ts, o
   * `adminError`; ingest.ts, o `error` da occurrence). O corte cai DENTRO da
   * URL, então cada produtor vê um tamanho diferente do MESMO erro e o head
   * normaliza para assinaturas diferentes. Medido em 21/09 (voz 8d7e7c37,
   * 12:54Z): a mesma falha de download virou #507 (texto longo, com o
   * HTTPSConnectionPool) e #508 (texto cortado, só "failed to download
   * <url>") — e o #508, com assinatura genérica parada em aguardando_aluno,
   * virou ímã de falhas alheias (ingest casa por assinatura sem filtro de
   * status e preserva o status existente).
   *
   * ⚠️ UMA chave só, sem separar download de upload, DE PROPÓSITO. A direção
   * do fenômeno só existe no TEXTO ("failed to download" × "r2 upload
   * failed"), e o texto é exatamente o que a truncagem destrói — o mesmo erro
   * real chegou com e sem o pedaço do HTTPSConnectionPool dependendo de onde
   * o corte caiu. Separar por marcador de texto recriaria o racha que esta
   * chave mata. O precedente de duas chaves na mesma causa (infra_disk) não
   * se aplica: lá o desempate é provado por detector de stderr à prova de
   * truncagem (errno × frase do torch), não pelo head. Se um dia upload
   * merecer cartão próprio, que venha com detector assim e com o caso na mão.
   *
   * ⚠️ A GUARDA É `cause === "infra_storage"`, e aqui ela é a decisão INTEIRA:
   * ao contrário do OOM/disco, não existe detector de stderr para repetir na
   * guarda — todo infra_storage nasce das regras de texto de `classifyCause`.
   * A disciplina dos blocos acima continua valendo: `classifyCause` é o único
   * lugar que arbitra precedência, então material impróprio do aluno continua
   * ganhando (a causa dele decide antes) e nunca nasce a chave inconsistente
   * `training:user_dataset:r2`.
   */
  if (cause === "infra_storage") {
    return `${k}:${cause}:${SUFIXO_STORAGE}`;
  }
  // user_dataset: a CAUSA já é a raiz — o texto varia (erro cru do worker ×
  // mensagem amigável do voices.error_message desde fdcc75c) e duplicava o
  // incidente (acf8acd6 × 014bb108, gap achado pelo Vigia 23/07). Demais
  // causas mantêm o head: dentro de infra/bug o texto distingue problemas.
  // Arquivo corrompido é raiz DIFERENTE de "gravação sem fala limpa" — não
  // mistura no incidente canônico de dataset.
  if (cause === "user_dataset") {
    return isCorruptFile(error) ? `${k}:${cause}:corrupt` : `${k}:${cause}`;
  }
  // Chunk de dataset inválido: chave CONSTANTE, mesma disciplina do OOM e do
  // disco cheio. O head normalizado seria quase estável (o uuid vira <id> e o
  // 0032 vira #), mas "quase" já rachou incidente aqui antes — e o `[Errno
  // 1094995529]` do início da frase é justamente o tipo de número que muda de
  // ocorrência para ocorrência. Fixa, então, e o incidente acumula.
  if (cause === "bug" && ehChunkDoDatasetInvalido(error)) {
    return `${k}:${cause}:${SUFIXO_CHUNK_DATASET}`;
  }
  const head = stripRunpodWrapper(stripFaseSuffix(error))
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/[0-9a-f]{16,}/g, "<hex>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${k}:${cause}:${head}`;
}

export function incidentTitle(kind: string, error: string, diag?: DiagnosticoTrainer): string {
  const cause = classifyCause(error, diag);
  const k = KIND_LABELS[kind] ?? kind;
  const detail = stripRunpodWrapper(stripFaseSuffix(error)).split("\n")[0].slice(0, 80);
  // O título é a única coisa que quem varre a fila lê antes de abrir. Se ele
  // disser só "GPU sem memória", a pessoa vai procurar o que consertar no
  // nosso código — e a conduta certa é repetir o treino. Cabe em 120 chars.
  // Título NÃO entra na assinatura: mexer aqui não racha incidente nenhum.
  // Guarda por CAUSA pelo mesmo motivo de `errorSignature` — quem arbitra
  // precedência é `classifyCause`, não cada função por conta própria.
  if (cause === "infra_gpu" && ehCudaOom(diag?.stderr)) {
    return `${k}: GPU sem memória (OOM) — transitório, repetir costuma curar`;
  }
  // O título precisa dizer que o treino TERMINOU, senão quem varre a fila lê
  // "falhou" e vai procurar defeito no material do aluno — que está intacto.
  if (cause === "infra_disk" && ehDiscoCheio(diag?.stderr)) {
    return `${k}: disco cheio no worker — treino completou, perdeu ao salvar`;
  }
  // "provável" no TÍTULO, não só na nota: quem varre a fila lê o título e nada
  // mais. Se ele dissesse "disco cheio" seco, a hipótese viraria fato antes de
  // alguém abrir o chamado — e o torch não confessou errno nenhum aqui.
  if (cause === "infra_disk" && ehEscritaDeCheckpointFalhou(diag?.stderr)) {
    return `${k}: escrita do checkpoint truncada — provável disco cheio no worker`;
  }
  if (cause === "user_dataset") {
    return isCorruptFile(error)
      ? `${k}: arquivo enviado corrompido/incompleto`
      : `${k}: áudio insuficiente/sem fala limpa`;
  }
  // O título precisa dizer DE QUEM é o arquivo. Mesma lição do disco cheio
  // logo acima: quem varre a fila lê só o título, e se ele disser "arquivo
  // inválido" seco a pessoa vai procurar defeito no material do aluno — que
  // aqui está intacto, e que o produto já culpou uma vez.
  if (cause === "bug" && ehChunkDoDatasetInvalido(error)) {
    return `${k}: chunk do dataset saiu inválido — arquivo NOSSO, material do aluno intacto`;
  }
  if (cause === "infra_gpu") return `${k}: GPU sem memória (OOM)`;
  if (cause === "infra_storage") return `${k}: falha de armazenamento (R2)`;
  if (cause === "capacity") return `${k}: tempo de execução estourado`;
  return `${k}: ${detail || "erro desconhecido"}`;
}
