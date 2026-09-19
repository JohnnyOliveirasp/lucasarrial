/**
 * O QUE O TRAINER DISSE AO MORRER — e por que isso precisa sair de uma coluna
 * própria, não de `error_message`.
 *
 * Regra PURA, sem imports: dá pra rodar com `node --test` pelado.
 *
 * ── O defeito que este arquivo fecha (medido 16/09, incidente #11) ─────────
 * Quando o subprocess do trainer morre, o worker (`jobs/train.py:96-101`)
 * devolve SEMPRE o mesmo `error: "trainer failed"` — três palavras, iguais em
 * toda falha, qualquer que seja a causa. Esse texto é tudo que
 * `training_jobs.error_message` guarda, e é dele que saem `classifyCause()` e
 * `errorSignature()`. Consequência medida no banco vivo em 16/09:
 *
 *   · incidente #11, assinatura `training:bug:trainer failed`, aberto em
 *     21/07, status "investigating" há 56 dias, 4 ocorrências;
 *   · `last_seen_at` = 2026-09-15T21:46:06Z — que é EXATAMENTE a falha do
 *     ricardoolito.
 *
 * Ou seja: um OOM de GPU caiu dentro de um guarda-chuva parado há quase dois
 * meses e não avisou ninguém. E `classifyCause("trainer failed")` devolve
 * `bug`, porque as palavras "out of memory"/"cuda" não estão em `error`:
 * estão no traceback, que mora em `training_jobs.trainer_stderr` (mig 97).
 * Uma falha de INFRAESTRUTURA estava sendo carimbada como BUG NOSSO.
 *
 * A cura não é enfiar o traceback no `error_message` — isso já foi analisado e
 * recusado em `classify.test.ts`: o traceback varia a cada ocorrência (bytes
 * alocados, pid, GiB livres) e o head de 120 chars da assinatura faria cada
 * falha virar um incidente NOVO. A cura é ler o stderr COMO DIAGNÓSTICO, à
 * parte, e deixar ele decidir causa e assinatura — sem nunca entrar no head.
 *
 * ── 17/09: o mesmo vão, com outro nome ────────────────────────────────────
 * O detector de OOM (16/09) fechou o buraco para GPU e SÓ para GPU. Em 17/09 o
 * job `bbf4b050` (almaraujo13) morreu com o disco do worker cheio — ENOSPC ao
 * gravar o `lora_weights.safetensors` — e, por não casar nada, caiu de novo em
 * `bug` + `training:bug:trainer failed`, reabrindo o #11 por um motivo que não
 * é o dele. Daí `ehDiscoCheio`/`ASSINATURA_DISCO_CHEIO`, logo abaixo.
 *
 * ── 18/09: a MESMA função, o arquivo SEGUINTE ─────────────────────────────
 * `ehDiscoCheio` está ancorado no texto do ENOSPC ("no space left on device"),
 * que é o que o safetensors grita. Às 22:40:12Z de 18/09 o job `c7a376e5`
 * morreu dentro do MESMO `save_checkpoint()`, no arquivo seguinte —
 * `optimizer.pth`, gravado pelo `torch.save` — e não casou nada: o torch ENGOLE
 * o errno e devolve só `PytorchStreamWriter failed writing file data/1004`.
 * Resultado: causa `bug` e reabertura do #11, de novo. Daí
 * `ehEscritaDeCheckpointFalhou`/`ASSINATURA_ESCRITA_CHECKPOINT`, no fim do
 * arquivo.
 *
 * ⚠️ Essa classe é a primeira que divide a CAUSA (`infra_disk`) com outra e
 * mesmo assim tem SUFIXO próprio (`write-failed`, não `no-space`). O motivo
 * está escrito em `ASSINATURA_ESCRITA_CHECKPOINT` e é de honestidade, não de
 * organização: o torch não diz ENOSPC nesse texto, então carimbar `no-space`
 * afirmaria no chamado uma coisa que o traceback não prova.
 *
 * O padrão a repetir quando aparecer a PRÓXIMA classe: detector estreito
 * ancorado na FRASE do erro (nunca em palavra solta), assinatura FIXA, nota de
 * conduta própria, e nenhuma retentativa automática.
 */

/**
 * O que o subprocess do trainer deixou pra trás.
 *
 * Duas origens, mesmo conteúdo:
 *  · `finalize-training.ts` tem os dois em memória (`out.stderr_tail`,
 *    `out.trainer_returncode`) no instante da falha;
 *  · `ingest.ts` (a varredura) lê as colunas `training_jobs.trainer_stderr` /
 *    `trainer_returncode` pelo `ref_id` da falha.
 *
 * Tudo opcional: 70 das 71 falhas da tabela são CEGAS (anteriores à mig 97,
 * sem stderr e sem returncode) e precisam continuar classificando como hoje.
 */
export type DiagnosticoTrainer = {
  /** Tail do stderr do trainer. `null`/ausente = falha cega (pré-mig 97). */
  stderr?: string | null;
  /**
   * Código de saída do subprocess.
   *
   * ⚠️ NÃO É REGRA DE CLASSIFICAÇÃO, de propósito. Medido na tabela inteira em
   * 16/09: o ÚNICO valor já gravado é `1` — o OOM veio como exceção do PyTorch,
   * não como sinal do kernel. Escrever regra em cima de 137 (OOM killer) ou 139
   * (SIGSEGV) seria legislar sobre valores que nunca aconteceram aqui, e o
   * primeiro caso real cairia numa regra escrita no escuro. Fica registrado no
   * chamado como CONTEXTO, e quem classifica é o stderr.
   */
  returncode?: number | null;
};

/** Sufixo da assinatura de OOM. Fixo, e é esse o ponto — ver `ASSINATURA_CUDA_OOM`. */
export const SUFIXO_CUDA_OOM = "cuda-oom";

/**
 * A assinatura que todo OOM de treino passa a ter.
 *
 * ⚠️ FIXA, SEM HEAD DO ERRO — e isso é a decisão central deste arquivo.
 * O caminho normal de `errorSignature` normaliza os primeiros 120 chars do
 * texto do erro. Se o stderr entrasse nesse head, cada OOM viraria incidente
 * novo: o traceback muda a cada ocorrência ("Tried to allocate 24.00 MiB",
 * "Process 560 has 7.95 GiB", "16.88 MiB is free"...). Nenhuma normalização
 * numérica salva isso — os frames do traceback também mudam com a versão do
 * torch. Chave constante é a única que agrupa a CAUSA em vez do texto.
 */
export const ASSINATURA_CUDA_OOM = `training:infra_gpu:${SUFIXO_CUDA_OOM}`;

/**
 * Este treino morreu de OOM de GPU?
 *
 * Detector ESTREITO de propósito. `classifyCause` já tem uma regra larga
 * (`e.includes("cuda")`) que funciona bem no `error_message`, curto e escrito
 * pelo worker — mas seria um desastre solta em cima de stderr: um traceback
 * cita `/usr/local/cuda/...` em toda falha de import, e metade das falhas de
 * treino viraria "GPU sem memória". Aqui a exigência é o texto do OOM, não a
 * palavra "cuda".
 *
 * Os dois padrões são OBSERVADOS na única falha instrumentada que existe
 * (training_jobs `c90ff577`, 15/09, ricardoolito) — não são palpite:
 *
 *   torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 24.00 MiB.
 *   GPU 0 has a total capacity of 94.97 GiB of which 16.88 MiB is free.
 *
 * `cuda out of memory` é o texto da MENSAGEM do torch e sobrevive à troca do
 * nome da classe (`torch.cuda.OutOfMemoryError` até o torch 2.3,
 * `torch.OutOfMemoryError` depois) — por isso as duas grafias da classe entram
 * como reforço, e a mensagem é a âncora.
 */
export function ehCudaOom(stderr: string | null | undefined): boolean {
  const s = (stderr ?? "").toLowerCase();
  if (!s) return false;
  return (
    s.includes("cuda out of memory") ||
    s.includes("torch.outofmemoryerror") ||
    s.includes("torch.cuda.outofmemoryerror")
  );
}

/** Sufixo da assinatura de disco cheio. Fixo — ver `ASSINATURA_DISCO_CHEIO`. */
export const SUFIXO_DISCO_CHEIO = "no-space";

/**
 * A assinatura que todo "disco cheio do worker" passa a ter.
 *
 * ⚠️ FIXA, SEM HEAD DO ERRO, pelo mesmo motivo escrito em `ASSINATURA_CUDA_OOM`:
 * o traceback muda a cada ocorrência (step alcançado, loss, caminho do
 * checkpoint, frames do safetensors) e o head de 120 chars faria cada falha de
 * disco abrir um incidente NOVO.
 *
 * ── Por que causa PRÓPRIA (`infra_disk`) e não `infra_storage` ─────────────
 * `infra_storage` hoje significa uma coisa só: o bucket REMOTO (R2) recusou —
 * `cloudflarestorage`, `r2 upload failed`, `502 bad gateway`, `failed to
 * download`. É outra máquina, outro dono e outra conduta. Isto aqui é o
 * SISTEMA DE ARQUIVOS LOCAL do worker da RunPod enchendo. Jogar os dois no
 * mesmo balde esconderia um problema recorrente de capacidade de volume dentro
 * de um incidente de indisponibilidade de bucket — exatamente o tipo de
 * mistura que este arquivo existe para desfazer.
 */
export const ASSINATURA_DISCO_CHEIO = `training:infra_disk:${SUFIXO_DISCO_CHEIO}`;

/**
 * Este treino morreu porque o disco do worker encheu?
 *
 * Detector ESTREITO, na mesma disciplina do `ehCudaOom`: a âncora é a FRASE do
 * erro, não as palavras "disco"/"espaço"/"device" soltas. Um traceback que só
 * MENCIONA espaço em disco noutra frase ("could not check free space", "disk
 * space is low") não pode ser carimbado como disco cheio — há teste de controle
 * negativo travando isso.
 *
 * Os dois padrões são OBSERVADOS na única falha instrumentada deste tipo
 * (training_jobs `bbf4b050`, 17/09, almaraujo13) — não são palpite:
 *
 *   safetensors._safetensors_rust.SafetensorError: Error while serializing:
 *   I/O error: No space left on device (os error 28)
 *
 * `no space left on device` é a mensagem canônica do ENOSPC e atravessa as duas
 * camadas que podem gritar aqui: o Rust do safetensors ("os error 28") e o
 * Python puro ("[Errno 28] No space left on device", que contém a mesma frase).
 * Por isso a frase é a âncora e `os error 28` entra como reforço — espelhando a
 * escolha feita no OOM, onde a mensagem do torch é a âncora e o nome da classe
 * é o reforço.
 */
export function ehDiscoCheio(stderr: string | null | undefined): boolean {
  const s = (stderr ?? "").toLowerCase();
  if (!s) return false;
  return s.includes("no space left on device") || s.includes("os error 28");
}

/**
 * O parágrafo que o chamado de DISCO CHEIO precisa carregar.
 *
 * Este texto NÃO é cópia do de OOM, e a diferença é o ponto. No OOM o treino
 * morre no meio e a GPU não chegou a produzir nada. Aqui o treino COMPLETOU —
 * no caso medido, 499 de 500 steps, 10,6 epochs, loss convergido — e o
 * resultado foi jogado fora no `save_checkpoint`, ao gravar o
 * `lora_weights.safetensors`. Quem lê o chamado precisa saber disso por dois
 * motivos práticos: repetir é BARATO EM RISCO (o material já provou que treina)
 * e CARO EM GPU (a placa vai ser paga uma segunda vez pelo mesmo trabalho).
 *
 * ⚠️ INSTRUÇÃO PARA GENTE, não gatilho — igual ao OOM. Nenhuma retentativa
 * automática entra por aqui: retreino queima GPU e a decisão é do dono do
 * negócio (cartão próprio: #422).
 */
export function notaDiscoCheio(diag: DiagnosticoTrainer | undefined): string {
  return [
    `DISCO CHEIO NO WORKER — o treino terminou e o resultado se perdeu ao salvar.`,
    ``,
    `NÃO é "morreu no meio": é "morreu na entrega". No caso instrumentado o`,
    `trainer chegou ao step 499 de 500 (10,6 epochs, loss convergido) e falhou`,
    `em save_checkpoint(), gravando lora_weights.safetensors, com ENOSPC —`,
    `"No space left on device (os error 28)". A GPU fez o trabalho inteiro e ele`,
    `foi descartado na hora de escrever o arquivo.`,
    ``,
    `O DISCO É DO WORKER, NÃO DO ALUNO. O material enviado está intacto e não há`,
    `nada para ele corrigir, reenviar ou regravar — não peça isso a ele.`,
    ``,
    `⚠️ JÁ ACONTECEU ANTES. A resolution_note do incidente #11 registra a falha`,
    `de 10/08 como "disco cheio do worker (tratada no incidente de disk_full)".`,
    `Esta é a SEGUNDA vez. Disco que enche de novo depois de "tratado" sugere`,
    `volume que se enche com o tempo (checkpoints//tmp/cache que não são`,
    `limpos), e isso é INFRA para alguém olhar — não é código para consertar`,
    `nesta classificação. Este cartão só tira a falha do guarda-chuva cego; ele`,
    `não resolve o volume, e ninguém deve fechá-lo achando que resolveu.`,
    ``,
    `CONDUTA: repetir o treino com o mesmo material tende a curar SE o volume`,
    `tiver espaço agora — mas confira o disco do worker antes de gastar GPU de`,
    `novo, porque repetir num volume ainda cheio queima a placa para nada. Não`,
    `há retentativa automática de propósito: a decisão de acionar retreino é do`,
    `dono do negócio.`,
    ``,
    `Frequência medida em 17/09 na tabela inteira (1394 treinos, 72 falhas): das`,
    `2 falhas com stderr — as únicas diagnosticáveis, pois o resto é anterior à`,
    `mig 97 — 1 é OOM e 1 é esta. n=1: é a primeira desta classe DESDE que existe`,
    `instrumentação, não "50% das falhas". As outras 70 são cegas e continuam`,
    `sem causa conhecida.`,
    ``,
    `trainer_returncode: ${diag?.returncode ?? "(não registrado)"}`,
    `(o ENOSPC chega como exceção do safetensors, não como sinal do kernel.)`,
  ].join("\n");
}

/**
 * O parágrafo que o chamado de OOM PRECISA carregar.
 *
 * Por que isto é código e não redação livre: das duas vezes em que um OOM de
 * treino se curou, ele se curou por ACASO DE HORÁRIO, não por processo. O
 * franwd82 (27/08) e o ricardoolito (15/09) voltaram a treinar depois e deu
 * certo — mas ninguém tinha escrito em lugar nenhum que repetir era a conduta.
 * Quem pegasse o chamado leria "GPU sem memória" e iria procurar o que
 * consertar no nosso código, que não é o problema: a placa tem 94,97 GiB e o
 * NOSSO processo estava usando 11,93 GiB dela. A memória foi comida por outro
 * processo no mesmo device.
 *
 * ⚠️ Isto é INSTRUÇÃO PARA GENTE, não gatilho. Nenhuma retentativa automática
 * entra por aqui: retreinar queima GPU e é decisão do dono do negócio, ainda
 * pendente. O chamado diz que repetir costuma curar; quem repete é uma pessoa.
 */
export function notaDeTransitoriedade(diag: DiagnosticoTrainer | undefined): string {
  return [
    `FALHA TRANSITÓRIA — candidata a curar repetindo o MESMO material.`,
    ``,
    `A GPU ficou sem memória durante o treino. Não é defeito do áudio do aluno`,
    `nem, até prova em contrário, do nosso código: no caso instrumentado a placa`,
    `tinha 94,97 GiB e o nosso processo segurava 11,93 GiB — a memória foi`,
    `consumida por outro processo no mesmo device. Nas 2 vezes em que isso`,
    `aconteceu e o treino foi refeito (27/08 e 15/09), refazer curou.`,
    ``,
    `CONDUTA: repetir o treino com o mesmo material antes de investigar código.`,
    `Não há retentativa automática de propósito — retreino gasta GPU e a decisão`,
    `de acioná-lo é do dono do negócio.`,
    ``,
    `Frequência medida em 16/09: 1 falha em 402 treinos (0,25%) na janela`,
    `instrumentada pela mig 97, que tem 20 dias. A tabela inteira tem 71 falhas`,
    `em 1361 treinos (5,22%), mas 70 delas são CEGAS (sem stderr, anteriores à`,
    `mig 97) — os dois números NÃO são comparáveis, e "melhorou de 5,22% para`,
    `0,25%" seria leitura errada.`,
    ``,
    `trainer_returncode: ${diag?.returncode ?? "(não registrado)"}`,
    `(único valor já visto na tabela é 1 — o OOM chega como exceção do PyTorch,`,
    `não como sinal do kernel. 137/139 nunca ocorreram aqui.)`,
  ].join("\n");
}

/** Sufixo da assinatura de escrita de checkpoint truncada. Fixo — ver
 *  `ASSINATURA_ESCRITA_CHECKPOINT`. NÃO é `no-space`, e isso é deliberado. */
export const SUFIXO_ESCRITA_CHECKPOINT = "write-failed";

/**
 * A assinatura que toda "escrita de checkpoint truncada" passa a ter.
 *
 * ⚠️ FIXA, SEM HEAD DO ERRO, pelo mesmo motivo já escrito em
 * `ASSINATURA_CUDA_OOM` e `ASSINATURA_DISCO_CHEIO`: o traceback muda a cada
 * ocorrência — o nome do registro interno do zip (`data/1004`), os dois números
 * do `unexpected pos 131040192 vs 131040080`, o step alcançado — e o head de
 * 120 chars faria cada falha virar um incidente NOVO.
 *
 * ── Por que causa IGUAL (`infra_disk`) e sufixo DIFERENTE (`write-failed`) ──
 * A CAUSA é a mesma do ENOSPC: disco local do worker, mesma conduta, mesmo
 * dono. Por isso `infra_disk`, e não uma causa nova que racharia o painel em
 * dois baldes que a mesma pessoa trata do mesmo jeito.
 *
 * O SUFIXO, porém, NÃO pode ser `no-space`. O torch engole o errno: o texto que
 * ele devolve ("PytorchStreamWriter failed writing file", "unexpected pos X vs
 * Y") diz que a escrita SAIU CURTA, não que o dispositivo estava cheio. Disco
 * cheio é a leitura mais provável — mas é leitura NOSSA, não confissão do
 * sistema de arquivos. Carimbar `no-space` afirmaria no chamado uma coisa que o
 * traceback não prova, e quem abrisse o incidente não teria como distinguir os
 * dois casos. Sufixo próprio mantém a diferença visível na chave: o `no-space`
 * é ENOSPC provado, este é ENOSPC inferido.
 */
export const ASSINATURA_ESCRITA_CHECKPOINT = `training:infra_disk:${SUFIXO_ESCRITA_CHECKPOINT}`;

/**
 * Este treino morreu porque a ESCRITA do checkpoint saiu truncada?
 *
 * Detector ESTREITO, na mesma disciplina dos dois acima: âncora é a FRASE, e
 * palavra solta é proibida. "write failed", "enforce fail" e "pos" aparecem em
 * traceback por mil motivos e nenhum deles é este — há teste de controle
 * negativo travando cada um.
 *
 * Os dois padrões são OBSERVADOS na falha instrumentada deste tipo
 * (training_jobs `c7a376e5`, 18/09 22:40:12Z) — não são palpite. O traceback
 * traz as DUAS mensagens, em cadeia:
 *
 *   RuntimeError: [enforce fail at inline_container.cc:858] .
 *   PytorchStreamWriter failed writing file data/1004: file write failed
 *   ...
 *   RuntimeError: [enforce fail at inline_container.cc:664] .
 *   unexpected pos 131040192 vs 131040080
 *
 * `pytorchstreamwriter failed writing file` é a âncora: é a mensagem do
 * `_open_zipfile_writer` do torch ao não conseguir gravar um registro do zip, e
 * cita o writer PELO NOME junto do verbo. O par `unexpected pos ` +
 * `inline_container` entra como reforço para o caso em que só a segunda
 * exceção da cadeia sobrevive no tail do stderr — e os dois termos são exigidos
 * JUNTOS de propósito, porque "unexpected pos" sozinho casaria "unexpected
 * position", que é outra coisa. Espelha a escolha do OOM (mensagem é âncora,
 * classe é reforço) e a do ENOSPC (frase é âncora, "os error 28" é reforço).
 */
export function ehEscritaDeCheckpointFalhou(stderr: string | null | undefined): boolean {
  const s = (stderr ?? "").toLowerCase();
  if (!s) return false;
  if (s.includes("pytorchstreamwriter failed writing file")) return true;
  // Espaço final em "unexpected pos " é o que separa de "unexpected position",
  // e o `inline_container` garante que é o writer do torch falando.
  return s.includes("unexpected pos ") && s.includes("inline_container");
}

/**
 * O parágrafo que o chamado de ESCRITA TRUNCADA precisa carregar.
 *
 * Este texto NÃO é cópia do de disco cheio, e a diferença é justamente o que
 * ele precisa comunicar. Lá o sistema de arquivos CONFESSA ("No space left on
 * device (os error 28)"). Aqui o torch engole o errno e sobra só o sintoma: a
 * escrita saiu curta. A conduta é a mesma; a certeza não é. Quem lê o chamado
 * precisa saber dessa diferença, senão o "provável" vira "foi" na primeira
 * releitura e alguém fecha o volume como resolvido sem ter medido nada.
 *
 * ⚠️ INSTRUÇÃO PARA GENTE, não gatilho — igual aos dois anteriores. Nenhuma
 * retentativa automática entra por aqui: retreino queima GPU e a decisão é do
 * dono do negócio.
 */
export function notaEscritaCheckpointFalhou(diag: DiagnosticoTrainer | undefined): string {
  return [
    `ESCRITA DO CHECKPOINT SAIU TRUNCADA — causa PROVÁVEL: disco cheio no worker.`,
    ``,
    `O que o traceback diz, literalmente: o torch tentou gravar`,
    `optimizer.pth e o PytorchStreamWriter falhou no meio —`,
    `"unexpected pos 131040192 vs 131040080". Esse par de números é uma ESCRITA`,
    `TRUNCADA: o arquivo prometeu 131040192 bytes e o writer só conseguiu pôr`,
    `131040080 no lugar. Gravação que para antes do fim, não gravação recusada.`,
    ``,
    `POR QUE DISCO CHEIO É A LEITURA MAIS PROVÁVEL: save_checkpoint() grava dois`,
    `arquivos em sequência — lora_weights.safetensors (linha 777) e, logo`,
    `depois, optimizer.pth (linha 814). A falha de ENOSPC PROVADA do mesmo dia`,
    `(job 7115da78, 15:27Z) morreu na 777; esta morreu na 814, no arquivo`,
    `seguinte da mesma função. Volume com pouco espaço falha exatamente assim:`,
    `o primeiro arquivo ainda cabe, o segundo não.`,
    ``,
    `⚠️ RESSALVA — ISTO É CAUSA PROVÁVEL, NÃO CONFESSADA. O torch NÃO entrega o`,
    `errno: ao contrário do safetensors, que diz "No space left on device (os`,
    `error 28)" com todas as letras, aqui sobra só o sintoma da escrita curta.`,
    `Disco cheio explica bem, mas o traceback não prova. Por isso este chamado`,
    `tem assinatura PRÓPRIA (write-failed) e não entra no balde do no-space —`,
    `quem for medir o volume precisa saber que está confirmando uma hipótese, e`,
    `quem ler depois precisa saber que ninguém viu um ENOSPC aqui.`,
    ``,
    `O DISCO É DO WORKER, NÃO DO ALUNO. O material enviado está intacto e não há`,
    `nada para ele corrigir, reenviar ou regravar — não peça isso a ele.`,
    ``,
    `CONDUTA: repetir o treino com o mesmo material. É barato e já funcionou —`,
    `medido em 18/09 com o Heitor: falhou às 15:27Z, foi retentado, e a voz`,
    `ficou ready às 15:36Z, em 260s. Confira o disco do worker antes, porque`,
    `repetir num volume ainda cheio queima a placa para nada. Não há`,
    `retentativa automática de propósito: retreino gasta GPU e a decisão de`,
    `acioná-lo é do dono do negócio.`,
    ``,
    `trainer_returncode: ${diag?.returncode ?? "(não registrado)"}`,
    `(a escrita curta chega como RuntimeError do torch, não como sinal do`,
    `kernel — e sem o errno que o safetensors entregaria.)`,
  ].join("\n");
}
