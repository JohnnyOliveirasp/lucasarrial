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
 * RE-MEDIDO em 08/09 somando os dois relógios (setup_s + elapsed_s) contra o
 * teto desta função, n=161 desde 05/09: pior uso **62,9%**, p95 **52,6%**,
 * ZERO gerações acima de 80%. Ou seja: a régua tem folga e NÃO é a causa dos
 * estouros que sobraram no #15 — mas a folga é 1,6×, não os 2,5× que o texto
 * antigo prometia. Quem cortar o piso achando que sobra 2,5× come a margem
 * inteira e passa a matar geração saudável.
 *
 * ⚠️ ARMADILHA DE MEDIÇÃO: `generations.elapsed_seconds` significa DUAS COISAS.
 * No SUCESSO é o `elapsed_s` do worker (SEM setup); na FALHA é o
 * `executionTime` que o RunPod manda (COM setup) — webhooks/runpod/route.ts:258.
 * Comparar os 578s de uma falha com os 357s de um sucesso é somar peras com
 * maçãs e faz a régua parecer curta. Some `qa.setup_s` no sucesso antes de
 * comparar, e confira que a linha TEM a chave: sem ela é geração de imagem
 * anterior a 05/09, não "setup zero".
 */
export function inferenceExecutionTimeoutMs(textLen: number): number {
  const chunks = Math.max(1, Math.ceil(textLen / 160));
  return Math.max(8 * 60, 5 * 60 + chunks * 30) * 1000;
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
