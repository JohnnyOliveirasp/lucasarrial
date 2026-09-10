/**
 * Teto de execução do job de geração (policy.executionTimeout do RunPod).
 *
 * Morava dentro da rota POST /voices/[id]/generate. Saiu pra cá em 28/08 (#15)
 * porque o reenvio automático precisa do MESMO teto do envio original — dois
 * cálculos separados sairiam do ar um do outro no primeiro ajuste de régua.
 *
 * Histórico da régua (#15, 24/08): o piso de 30 min vinha da era do worker frio
 * (download de 5 GB por worker), assado na imagem em adcf18a (11/08). Medido em
 * 24/08 sobre 1.186 gerações prontas desde então: p99 ≤ 271s em TODAS as faixas
 * de tamanho, máximo absoluto 460s. Com 30 min, um worker travado segurava o
 * aluno 1.812s por um texto de 78 caracteres (23/08 23:41) — 14 casos, todos
 * estornados, nenhum correlacionado com tamanho de texto.
 * Agora: 5 min + 30s por pedaço de 160 chars, piso 8 min (2.567 chars → 13,5
 * min). Chunk de 160 chars espelha TTS_CHUNK_MAX_CHARS do worker.
 *
 * ⚠️ A MARGEM REAL É 1,6× — NÃO 2,5×. NÃO APERTE A RÉGUA POR CIMA DO NÚMERO
 * ANTIGO. O "≥2,5× o pior caso real" que ficou aqui de 24/08 até 08/09 foi
 * calibrado num relógio que IGNORA o setup: `elapsed_s` do worker começa DEPOIS
 * de baixar o LoRA, preparar a referência e carregar o modelo (`run()` só
 * carimba `self.t0` no fim do setup), mas o executionTimeout do RunPod corre
 * sobre o job INTEIRO. O setup não é ruído: medido em 08/09 sobre 161 gerações
 * prontas com `qa.setup_s` (instrumentado em 2bd3c3f), p50 **73,5s**, p95
 * **94,2s**, máx **116,8s** — ~85s que a calibração antiga não enxergava.
 *
 * ⛔ A CONCLUSÃO DE 08/09 ("pior uso 62,9%, p95 52,6%, ZERO acima de 80%: a
 * régua tem folga e NÃO é a causa dos estouros") FOI FALSIFICADA EM 10/09. Ela
 * não estava mal medida — estava medida numa janela em que o setup se comportou.
 * No dia seguinte ele não se comportou e o número virou outro. Fica registrado
 * porque aquele texto dizia, a quem abrisse este arquivo, que aqui não havia
 * nada pra consertar.
 *
 * RE-MEDIDO em 10/09 (n=279 prontas desde 05/09, `setup_s + elapsed_s` contra
 * este teto, consulta PAGINADA):
 *   - pior uso **90,6%**, não 62,9%. É a `873fcee4` (09/09 16:11, 1.591 chars,
 *     10 chunks, teto 600s): setup **242,2s** + elapsed 301,1s = 543,3s. Ficou
 *     a **57 segundos** de virar mais uma ocorrência deste chamado.
 *   - setup máximo **260,7s**, não 116,8s: o máximo MAIS QUE DOBROU em um dia.
 *   - os 3 setups acima de 150s de toda a telemetria (197,2s / 242,2s / 260,7s)
 *     caem numa janela de 90 min em 09/09 (14:43 → 16:11). Nos 4 dias
 *     anteriores, o máximo foi ≤116,8s.
 *
 * A CAUSA, ENFIM NOMEADA: não é "chunk pendurado" — é o **pico de setup comendo
 * a base fixa do teto**. A base existe pra absorver o setup e estava
 * dimensionada pela MEDIANA (~73s), não pela cauda. Com a régua antiga (300s de
 * base) o que sobra por chunk é `(300 − setup)/chunks + 30`:
 *   - setup típico (73s), 10 chunks → 22,7 + 30 = **52,7s/chunk**: folgado;
 *   - setup de pico (260s), 10 chunks →  4,0 + 30 = **34,0s/chunk**.
 * E o p95 medido de segundos-por-chunk na faixa 9–12 é **34,4s**. No pico de
 * setup, texto longo virava cara ou coroa contra o próprio p95 da frota. E
 * texto longo falha primeiro porque é quem precisa de mais chunks — que é
 * exatamente o padrão das ocorrências que sobraram no #15.
 *
 * ⚠️ O PICO NÃO É NOSSO PRA PREVENIR. Conferido em 10/09: NÃO houve deploy do
 * worker em 09/09 (`runpod-worker.yml`, último em 08/09 14:47Z) — não é cold
 * start que a casa causou, é variação do lado do RunPod (escala, disputa de GPU,
 * rede pro download do LoRA/modelo). Como não dá pra evitar, a régua tem que
 * TOLERAR. Por isso a base virou reserva nomeada, e não um "5 min" solto.
 *
 * ⚠️ LIMITE DO QUE ESTA MUDANÇA PROVA: ela tira a estreiteza estrutural que o
 * quase-acidente de 90,6% expôs. Ela NÃO prova que teria salvado a `a07e9278`
 * (04/09, 9 chunks), que estourou 570s nas DUAS tentativas — o dado não diz de
 * quanto ela precisava, só que precisava de mais. Não escreva em lugar nenhum
 * que o #15 está curado por causa disto.
 *
 * ⚠️ A AMOSTRA TEM UM QUARTO CEGO, E ELE PUXA PRO LADO INSEGURO: `qa.setup_s` só
 * existe em **71–78%** das gerações prontas, TODO DIA desde 05/09 — não é começo
 * de telemetria, é buraco permanente. Então "máximo 260,7s" é o máximo entre os
 * que REPORTAM; o real pode ser maior. Por isso a reserva fica acima do pior
 * caso observado, e não colada nele.
 *
 * ⚠️ ARMADILHA DE MEDIÇÃO: `generations.elapsed_seconds` significa DUAS COISAS.
 * No SUCESSO é o `elapsed_s` do worker (SEM setup); na FALHA é o
 * `executionTime` que o RunPod manda (COM setup) — webhooks/runpod/route.ts:258.
 * Comparar os 578s de uma falha com os 357s de um sucesso é somar peras com
 * maçãs e faz a régua parecer curta. Some `qa.setup_s` no sucesso antes de
 * comparar, e confira que a linha TEM a chave: sem ela é geração de imagem
 * anterior a 05/09, não "setup zero".
 */
/**
 * Orçamento de SETUP: baixar o LoRA, preparar a referência, carregar o modelo —
 * tudo que corre ANTES do `self.t0` do worker e que mesmo assim conta no
 * executionTimeout do RunPod. Medido em 10/09: p50 73,1s / p95 94,4s / máx
 * **260,7s** (n=279, 05→10/09). 360s cobre o pior caso observado com ~100s de
 * margem — a margem é justamente pro quarto da amostra que não reporta setup.
 * ⚠️ Isto NÃO é meta de tempo, é rede de segurança. Não aperte contra o p50.
 */
const RESERVA_SETUP_S = 360;

/**
 * Orçamento de INFERÊNCIA por pedaço de 160 chars (espelha TTS_CHUNK_MAX_CHARS
 * do worker). Medido em 10/09 nas faixas longas, que são onde o teto aperta:
 * p50 15,4–21,9s, **p95 34,4s**. Os 30s antigos ficavam ABAIXO do p95: só
 * funcionavam enquanto a base sobrava, e pararam de funcionar no dia em que a
 * base não sobrou. 40s fica acima do p95 medido.
 */
const SEGUNDOS_POR_CHUNK = 40;

export function inferenceExecutionTimeoutMs(textLen: number): number {
  const chunks = Math.max(1, Math.ceil(textLen / 160));
  return Math.max(8 * 60, RESERVA_SETUP_S + chunks * SEGUNDOS_POR_CHUNK) * 1000;
}

/**
 * O erro é o estouro do teto acima? Só esse caso ganha reenvio automático
 * (#15) — erro de worker (OOM, modelo, áudio curto) repetiria o mesmo defeito
 * e só faria o aluno esperar em dobro. O RunPod manda "executionTimeout
 * exceeded"; o caminho do poll prefixa "RunPod FAILED: " e a telemetria de
 * fase pode acrescentar o sufixo "[fase: ...]".
 */
export function ehTimeoutDeExecucao(rawError: string): boolean {
  return rawError.toLowerCase().includes("executiontimeout");
}

/**
 * Falha que NÃO é do material do aluno — vale refazer sozinho.
 *
 * 29/08 (Johnny): "isso já aconteceu com outros alunos; precisa de plano de
 * contingência: se falhar, gerar de novo e não cobrar". O reenvio automático
 * (#89) só cobria `executionTimeout`; um tropeço de rede no download do LoRA
 * ou um 5xx do R2 caía direto em "falhou". Nada disso repete defeito de
 * entrada: refazer resolve.
 *
 * ⚠️ Continua FORA: OOM/CUDA, erro de modelo e áudio inválido — repetir só
 * faria o aluno esperar em dobro pelo mesmo erro.
 */
const TRANSITORIAS = [
  "failed to download",
  "connection reset",
  "connection aborted",
  "read timed out",
  "temporarily unavailable",
  "502 bad gateway",
  "503 service",
  "504 gateway",
  "internalerror",
];

export function ehFalhaTransitoria(rawError: string): boolean {
  const e = rawError.toLowerCase();
  return ehTimeoutDeExecucao(e) || TRANSITORIAS.some((t) => e.includes(t));
}
