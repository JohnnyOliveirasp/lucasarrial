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
 * ⛔ O "QUARTO CEGO" DE 10/09 ESTÁ REFUTADO — NÃO EXISTE BURACO DE TELEMETRIA.
 * Aqui se afirmava que `qa.setup_s` só existia em 71–78% das gerações prontas,
 * "buraco permanente" cujo viés "puxa pro lado inseguro". Medido em 11/09 sobre
 * TODAS as prontas desde 05/09 (n=556, paginado): o quarto que falta são
 * **137 linhas `name = "Amostra automática"`**, gravadas direto por
 * `voices/finalize-training.ts:519-531` quando o treino termina. Elas têm
 * **`runpod_job_id` NULL nas 137** — nunca passaram pela inferência, logo não
 * têm `qa` nem setup POR CONSTRUÇÃO. Não são gerações.
 * Cortando a população certa (`status='ready' AND runpod_job_id IS NOT NULL`):
 * cobertura de `setup_s` = **416/419 = 99,3%**, e **100% todo dia desde 06/09**
 * (as 3 exceções são 05/09 00:07–00:36, a própria hora da instrumentação).
 * Ou seja: o máximo de setup NÃO é "o máximo entre os que reportam" — é o máximo
 * da população inteira que importa. Quem medir régua tem que filtrar
 * `runpod_job_id IS NOT NULL`, senão infla o denominador em ~25% com amostras de
 * 103 chars e `elapsed_seconds` nulo. Ferramenta pronta:
 * `_frank/ferramentas/medir_regua_15.cjs`.
 *
 * ⛔ E A RESERVA DE 360s JÁ FOI ESTOURADA PELA OBSERVAÇÃO — 3ª vez que a cauda
 * do setup anda depois de alguém fechar o número nesta régua. Medido em 11/09:
 * **setup máximo 376,3s** (`f7a0420c`, 10/09 14:42Z), contra os 260,7s de 10/09.
 * Isto é ~14h DEPOIS do merge de #229, que escolheu 360s justamente por ficar
 * "acima do pior caso observado". Não fica mais.
 *   - pior uso do teto NOVO: **93,0%** (n=416), não os 71,5% publicados em 10/09;
 *     acima de 80%: **1**, não 0. p50 32,0% / p95 45,9% seguem folgados.
 *   - ⚠️ INVERTE QUEM CORRE RISCO: a `f7a0420c` tem só **568 chars / 4 chunks**.
 *     Com setup de pico o refém não é mais o texto LONGO (que ganha teto por
 *     chunk) e sim o CURTO, preso ao piso de 8 min: setup 376,3s de um teto de
 *     520s deixou 143,7s pra inferência inteira. O modelo de 10/09 ("texto longo
 *     falha primeiro") vale pra régua apertada na base, não pra pico de setup.
 *
 * ✅ O QUE #229 JÁ PROVOU, E QUE EM 10/09 AINDA NÃO DAVA PRA PROVAR: a
 * `f7a0420c` somou setup 376,3s + elapsed 107,3s = **483,6s**. Teto NOVO 520s →
 * passou com 36,4s de folga. Teto VELHO (300 + 4×30 = piso 480s) → **100,7%: ela
 * teria FALHADO por 3,6s** e virado a 20ª ocorrência do #15. A mudança não é mais
 * só estrutural — ela tem um caso real salvo, medido.
 *   ⚠️ Continua NÃO provando que salvaria a `a07e9278` (04/09, 9 chunks, estourou
 *   570s nas duas tentativas). Não escreva que o #15 está curado.
 *
 * ⚠️ ANTES DE ALARGAR DE NOVO, LEIA: a tentação é subir a reserva pra ~480s e
 * repetir o ciclo. n=1 acima de 360s (p95 do setup segue 94,2s) não sustenta
 * isso, e a régua também protege o aluno de worker pendurado — o piso de 30 min
 * da era antiga segurava gente 1.812s por um texto de 78 chars. Se a cauda andar
 * de novo, a resposta provavelmente não é régua maior, é limitar/observar o setup
 * do lado do RunPod ou falhar rápido e reenviar. Decida com dado, não com susto.
 *
 * ⚠️ ARMADILHA DE MEDIÇÃO: `generations.elapsed_seconds` significa DUAS COISAS.
 * No SUCESSO é o `elapsed_s` do worker (SEM setup); na FALHA é o
 * `executionTime` que o RunPod manda (COM setup) — webhooks/runpod/route.ts:258.
 * Comparar os 578s de uma falha com os 357s de um sucesso é somar peras com
 * maçãs e faz a régua parecer curta. Some `qa.setup_s` no sucesso antes de
 * comparar. Linha SEM a chave não é "setup zero": ou é `Amostra automática`
 * (`runpod_job_id` NULL, filtre fora), ou é anterior a 05/09.
 */
/**
 * Orçamento de SETUP: baixar o LoRA, preparar a referência, carregar o modelo —
 * tudo que corre ANTES do `self.t0` do worker e que mesmo assim conta no
 * executionTimeout do RunPod. Re-medido em 11/09 sobre a população certa
 * (`ready` + `runpod_job_id IS NOT NULL`, n=416, 05→11/09, paginado):
 * p50 **73,7s** / p95 **94,2s** / máx **376,3s**.
 *
 * ⛔ ESTES 360s NÃO COBREM MAIS O PIOR CASO OBSERVADO. Quando #229 os escolheu
 * (10/09), o máximo era 260,7s e sobrava ~100s de margem; o máximo de hoje
 * (376,3s, `f7a0420c` em 10/09 14:42Z) passa POR CIMA da reserva. O número
 * segue aqui de propósito: a cauda é n=1 contra um p95 de 94,2s, e alargar a
 * régua também é deixar worker pendurado segurar o aluno por mais tempo.
 * Quem for mexer lê o bloco "ANTES DE ALARGAR DE NOVO" no topo do arquivo.
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
 * O erro é o estouro do teto acima? O RunPod manda "executionTimeout
 * exceeded"; o caminho do poll prefixa "RunPod FAILED: " e a telemetria de
 * fase pode acrescentar o sufixo "[fase: ...]".
 *
 * ⚠️ NÃO é mais "o único caso que ganha reenvio", e já não era desde 29/08.
 * Quem decide o reenvio é `ehFalhaTransitoria` logo abaixo; este predicado é
 * só UM dos membros daquela classe. Quem for mexer no reenvio automático lê a
 * lista TRANSITORIAS, não este comentário.
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
 * 11/09 (#52, 37bacb68 — 23 dias aberto, 19 alunos): entrou a EXAUSTÃO DA QA
 * DE COBERTURA, e ela merece parágrafo próprio porque à primeira vista parece
 * o oposto de uma transitória — o áudio saiu incompleto, então "é defeito do
 * material", certo? Errado, e o banco diz: das 8 falhas em que o aluno
 * reenviou o texto IDENTICAMENTE igual, 7 saíram ready (9 sucessos contra 3
 * falhas). O caso que abriu esta mudança é a geração 67f28d0f (355 chars):
 * falhou 20:53Z e o MESMÍSSIMO texto saiu ready em 109s às 20:58Z. Ou seja o
 * chunk alucinado é SORTEIO DO MODELO, não propriedade do texto — que é
 * exatamente o critério desta lista. Sem isto, a geração morria e o aluno
 * tinha que refazer na mão (depois de esperar).
 *
 * A string tem 2 variantes no banco, as duas contendo "qa_coverage":
 *   "qa_coverage: audio gerado nao contem o texto completo apos esgotar regeneracoes"
 *   "RunPod FAILED: qa_coverage: ..." (caminho do poll)
 * Casar pelo prefixo é seguro: não existe outro erro que o use.
 *
 * ⚠️ Continua FORA: OOM/CUDA, erro de modelo e áudio inválido/corrompido —
 * repetir só faria o aluno esperar em dobro pelo mesmo erro. A fronteira é
 * fina de propósito: "áudio que não cobre o texto porque o modelo sorteou
 * mal" (qa_coverage, MEDIDO como refazível) entra; "áudio que não presta"
 * continua fora. Não alargue isto pra outros erros de áudio sem repetir a
 * medição acima.
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
  "qa_coverage",
];

export function ehFalhaTransitoria(rawError: string): boolean {
  const e = rawError.toLowerCase();
  return ehTimeoutDeExecucao(e) || TRANSITORIAS.some((t) => e.includes(t));
}
