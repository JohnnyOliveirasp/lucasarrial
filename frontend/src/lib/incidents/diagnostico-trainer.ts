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
