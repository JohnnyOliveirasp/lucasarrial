/**
 * Tripwire de código do incidente #11 (persistir o stderr do trainer).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/voices/finalize-training.test.ts
 *
 * POR QUE ler o fonte em vez de importar o módulo: finalize-training.ts fala com
 * Supabase, Resend e o alias "@/" — importá-lo num teste unitário exigiria
 * montar meio backend de mentira, e o que precisa ser travado aqui não é
 * comportamento em runtime, é uma DECISÃO ESTRUTURAL que um refactor bem
 * intencionado desfaz sem perceber:
 *
 *  1. O diagnóstico do trainer NÃO pode entrar no `error_message` do claim.
 *     Esse campo alimenta errorSignature() (ver incidents/classify.test.ts);
 *     texto variável = incidente novo a cada falha = o #11 estilhaçado.
 *  2. O UPDATE da telemetria NÃO pode entrar no claim idempotente. A DDL de
 *     scripts/97 ainda não foi aplicada; coluna inexistente dentro do claim
 *     derruba a finalização inteira e o ESTORNO do aluno nunca roda.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FONTE = readFileSync(join(import.meta.dirname, "finalize-training.ts"), "utf8");

/**
 * O bloco do gate idempotente: do começo do UPDATE até o filtro de status.
 * Ancorado em `const { data: claimed }`, NÃO em `.from("training_jobs")` — as
 * funções de telemetria (registrarCuraEBuild/registrarSaidaDoTrainer) escrevem
 * na mesma tabela e aparecem ANTES no arquivo, então o `.from` genérico casaria
 * com elas e o teste acusaria falso positivo.
 */
function blocoDoClaim(): string {
  const inicio = FONTE.indexOf("const { data: claimed } = await admin");
  const fim = FONTE.indexOf('.in("status"', inicio);
  assert.ok(inicio > 0 && fim > inicio, "não achei o claim idempotente no fonte");
  return FONTE.slice(inicio, fim);
}

test("o claim idempotente grava error_message CRU, sem traceback", () => {
  const claim = blocoDoClaim();
  assert.match(claim, /error_message:\s*adminError/);
  for (const proibido of ["trainer_stderr", "trainer_stdout", "stderr_tail", "stdout_tail"]) {
    assert.ok(
      !claim.includes(proibido),
      `"${proibido}" entrou no claim idempotente — isso muda o error_message ` +
        `e/ou derruba a finalização se a mig 97 não estiver aplicada`,
    );
  }
});

test("adminError sai só do rawError, truncado — nada de log do trainer", () => {
  assert.match(FONTE, /const adminError = success \? null : rawError\.slice\(0, 500\);/);
});

test("a telemetria do trainer roda DEPOIS do gate e é best-effort", () => {
  const posClaim = FONTE.indexOf("if (!claimed || claimed.length === 0)");
  const posChamada = FONTE.indexOf("await registrarSaidaDoTrainer(");
  assert.ok(posClaim > 0, "não achei o gate idempotente");
  assert.ok(posChamada > posClaim, "registrarSaidaDoTrainer foi chamado ANTES do gate");

  // O UPDATE da função tem que estar dentro de try/catch — falhar a telemetria
  // não pode derrubar voz/estorno/amostra.
  const inicioFn = FONTE.indexOf("async function registrarSaidaDoTrainer(");
  const corpo = FONTE.slice(inicioFn, FONTE.indexOf("export async function finalizeTraining"));
  assert.ok(inicioFn > 0, "não achei registrarSaidaDoTrainer");
  assert.match(corpo, /try\s*\{[\s\S]*\.from\("training_jobs"\)[\s\S]*\}\s*catch/);
  assert.match(corpo, /logger\.warn\(/);
});

/**
 * A janela entre o claim idempotente e o ESTORNO tem que ficar VAZIA de código
 * que possa lançar. registrarSaidaDoTrainer roda dentro dessa janela: se algo
 * dela subir, o claim já foi consumido e o estorno do aluno nunca roda —
 * crédito perdido, sem retry. O `logger.error` é a única instrução de
 * observabilidade da função além do UPDATE, e ele NÃO pode ficar fora do
 * try/catch: logger/server.ts protege a escrita em arquivo com try/catch
 * próprio, mas o ramo de console logo abaixo fica desprotegido e roda TAMBÉM em
 * produção quando level === 'error'.
 */
test("nada da telemetria do trainer fica fora do try/catch (nem o logger.error)", () => {
  const inicioFn = FONTE.indexOf("async function registrarSaidaDoTrainer(");
  assert.ok(inicioFn > 0, "não achei registrarSaidaDoTrainer");
  const corpo = FONTE.slice(inicioFn, FONTE.indexOf("export async function finalizeTraining"));

  const posTry = corpo.indexOf("try {");
  const posCatch = corpo.indexOf("} catch (e)", posTry);
  assert.ok(posTry > 0 && posCatch > posTry, "não achei o try/catch de registrarSaidaDoTrainer");

  const posErro = corpo.indexOf('logger.error("api", "voice.train.trainer_failed"');
  assert.ok(posErro > 0, "não achei o logger.error da telemetria do trainer");
  assert.ok(
    posErro > posTry && posErro < posCatch,
    "logger.error saiu do try/catch — exceção dele sobe por finalizeTraining e " +
      "mata o ESTORNO com o claim idempotente já consumido",
  );

  // E não pode ter aparecido nenhum OUTRO logger.error fora do try.
  const foraDoTry = corpo.slice(0, posTry);
  assert.ok(
    !foraDoTry.includes("logger."),
    "apareceu chamada de logger antes do try — mesma armadilha, outro lugar",
  );
});

test("os logs do trainer são truncados em 8000 chars, pelo FIM", () => {
  assert.match(FONTE, /const MAX_TRAINER_LOG_CHARS = 8000;/);
  // slice NEGATIVO: o traceback está no fim da saída.
  assert.match(FONTE, /stderr\.slice\(-MAX_TRAINER_LOG_CHARS\)/);
  assert.match(FONTE, /stdout\.slice\(-MAX_TRAINER_LOG_CHARS\)/);
});

/**
 * ── Tripwires do conserto de 15/09 (caso ricardoolito) ───────────────────
 * O comportamento tem teste próprio e de verdade em `falha-de-treino.test.ts`
 * (módulo puro). O que fica aqui é o mesmo tipo de trava dos testes acima: a
 * DECISÃO ESTRUTURAL que um refactor bem intencionado desfaz sem perceber.
 */

test("o desfecho (estorno + chamado) é apurado ANTES da mensagem do aluno", () => {
  const posEstorno = FONTE.indexOf("const temDebito = await houveDebitoDeTreino");
  const posChamado = FONTE.indexOf("chamado = await abrirChamadoDaFalhaTecnica");
  const posMensagem = FONTE.indexOf("const errorMessage = success");
  assert.ok(posEstorno > 0 && posChamado > 0 && posMensagem > 0, "sumiu alguma das três etapas");
  assert.ok(
    posEstorno < posMensagem,
    "a mensagem voltou a ser montada antes de saber se houve estorno — foi assim que ela " +
      "afirmou devolução numa voz sem nenhuma linha de débito",
  );
  assert.ok(
    posChamado < posMensagem,
    "a mensagem voltou a ser montada antes de abrir o chamado — sem o número dele, " +
      '"nossa equipe já está com ele" é promessa sem lastro',
  );
});

test("a mensagem do aluno não afirma estorno nem equipe por texto fixo", () => {
  // As duas frases do defeito, exatamente como estavam.
  assert.ok(
    !FONTE.includes("Seus créditos foram devolvidos automaticamente"),
    "a frase fixa de estorno voltou ao fonte",
  );
  assert.ok(
    !FONTE.includes("nossa equipe já foi notificada"),
    "a frase fixa de equipe notificada voltou ao fonte",
  );
});

test("o estorno continua decidido pelo EXTRATO, não por quem é o aluno", () => {
  // A simetria de 17/08 (onboarding-cobranca.ts): sem linha de débito para
  // esta voz, não há o que estornar. Trocar isto por bypassesBilling sozinho
  // devolve 10.000 créditos REAIS a quem nunca pagou.
  assert.match(FONTE, /deveEstornarTreino\(\{\s*bypass: bypassesBilling\(userEmail\),\s*temDebito,/);
});

test("escalateStuckUser continua DEPOIS do estorno (a régua de rajada conta o estorno)", () => {
  const posEstorno = FONTE.indexOf('refType: "voice_train_refund"');
  const posEscalate = FONTE.indexOf("await escalateStuckUser(");
  assert.ok(posEstorno > 0 && posEscalate > 0, "sumiu o estorno ou o escalate");
  assert.ok(
    posEstorno < posEscalate,
    "escalateStuckUser subiu para antes do estorno: ele conta credit_transactions de " +
      "ref_type voice_train_refund na janela, então a falha de agora deixaria de contar",
  );
});

test("o chamado nasce com a MESMA assinatura que a varredura daria", () => {
  // Chave própria (por voz/por job) = dois chamados para uma falha só, que é
  // o racha que o #410 acabou de curar.
  assert.match(FONTE, /signature: errorSignature\("training", args\.rawError\)/);
  assert.match(FONTE, /kind: "training"/);
  assert.match(FONTE, /cause: classifyCause\(args\.rawError\)/);
  assert.match(FONTE, /categoria: "tecnico"/);
});

test("o ingest IMPORTA o prefixo da mensagem, não repete a string", () => {
  const INGEST = readFileSync(
    join(import.meta.dirname, "..", "incidents", "ingest.ts"),
    "utf8",
  );
  assert.match(
    INGEST,
    /import \{ PREFIXO_FALHA_TECNICA \} from "@\/lib\/voices\/falha-de-treino"/,
    "o ingest parou de importar o prefixo",
  );
  assert.match(
    INGEST,
    /startsWith\(PREFIXO_FALHA_TECNICA\)/,
    "o filtro do ingest voltou a usar string literal — variante nova de mensagem " +
      "deixaria de casar em silêncio e o guarda-chuva f830fd4e voltaria",
  );
  assert.ok(
    !INGEST.includes('startsWith("Tivemos um problema'),
    "voltou a cópia literal do prefixo dentro do ingest",
  );
});

test("a abertura da mensagem técnica é a que o ingest filtra", () => {
  const PURO = readFileSync(join(import.meta.dirname, "falha-de-treino.ts"), "utf8");
  assert.match(
    PURO,
    /export const PREFIXO_FALHA_TECNICA = "Tivemos um problema técnico durante o treinamento";/,
    "a abertura mudou: o ingest passa a ingerir a mensagem amigável da tabela voices e " +
      "funde causas diferentes num incidente eterno (guarda-chuva f830fd4e)",
  );
});
