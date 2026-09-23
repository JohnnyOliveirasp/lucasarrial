/**
 * O QUE A GENTE DIZ AO ALUNO QUANDO O TREINO FALHA POR CULPA NOSSA.
 *
 * Regra PURA, sem imports: dá pra rodar com `node --test` pelado e, mais
 * importante, dá pra TESTAR cada combinação sem montar meio Supabase de
 * mentira (era o motivo de este ramo nunca ter teste de comportamento).
 *
 * ── O defeito que este arquivo fecha (medido 15/09 no caso ricardoolito) ──
 * A mensagem de falha técnica era um texto FIXO que afirmava duas coisas sem
 * nunca olhar se elas tinham acontecido:
 *
 *  1. *"Seus créditos foram devolvidos automaticamente"* — mas o estorno já
 *     era condicional desde 17/08 (hoje `valorDoEstornoDeTreino`: só devolve
 *     o que o extrato daquela voz ainda deve). Quem vem do SGP **nunca** é
 *     cobrado pelo treino
 *     (`onboarding-cobranca.ts`), então a frase era falsa para TODO aluno de
 *     SGP — e, no caso medido, `credit_transactions` por `ref_id` da voz
 *     estava vazio: não houve cobrança, logo não houve estorno.
 *  2. *"nossa equipe já foi notificada"* — mas o único aviso era um e-mail
 *     best-effort pro suporte. E-mail que falha em silêncio transforma a
 *     frase em mentira, e nenhum chamado nascia.
 *
 * A cura não é escrever um texto melhor: é a mensagem PASSAR A DEPENDER do
 * que de fato aconteceu. Por isso as duas entradas aqui são desfechos
 * apurados (`credito`, `chamado`), não suposições sobre quem é o aluno.
 *
 * ── E a saída do aluno ────────────────────────────────────────────────────
 * "Tente treinar novamente" só é verdade para quem PODE. A voz fica em
 * `failed` (terminal) e o caminho de recomeço é a tela nova de clonagem, que
 * cobra `TRAINING_CREDIT_COST` de novo. Quem foi estornado tem o saldo de
 * volta e consegue; quem nunca foi cobrado (SGP) tem 0 crédito por desenho e
 * bateria em 402 `insufficient_credits` — mandar essa pessoa "tentar de novo"
 * é empurrar pra uma porta trancada. Então o texto muda: para ela o retreino
 * é por nossa conta, e o chamado aberto é quem garante que alguém faça.
 */

/** Como ficou o dinheiro desta tentativa. Apurado do extrato, não inferido. */
export type DesfechoCredito =
  /** Não houve linha de débito para esta voz — SGP ou equipe. Nada a devolver. */
  | "nao_cobrado"
  /** Houve débito e a devolução entrou. */
  | "estornado"
  /** Houve débito, a devolução foi tentada e FALHOU. A equipe aplica na mão. */
  | "estorno_falhou";

/**
 * A primeira frase da mensagem técnica é CONTRATO, não estilo.
 *
 * `lib/incidents/ingest.ts` descarta, por este prefixo exato, a ocorrência que
 * chega pela tabela `voices` — porque a MESMA falha já existe crua em
 * `training_jobs` e agrupar pela mensagem amigável fundiria causas diferentes
 * num incidente eterno (guarda-chuva f830fd4e). Mexer nesta abertura sem
 * mexer lá reabre aquele incidente-guarda-chuva.
 *
 * Por isso o texto variável (crédito, chamado, saída) vem DEPOIS do prefixo, e
 * o `ingest` IMPORTA esta constante em vez de repetir a string — divergência
 * entre os dois vira impossível por construção, não por disciplina.
 */
export const PREFIXO_FALHA_TECNICA = "Tivemos um problema técnico durante o treinamento";

/** 10000 → "10.000". Feito à mão de propósito: `toLocaleString` depende do ICU
 *  do runtime, e teste de mensagem não pode variar com o build do Node. */
function milhar(n: number): string {
  const inteiro = Math.abs(Math.trunc(n)).toString();
  const comPonto = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `-${comPonto}` : comPonto;
}

/**
 * A mensagem que o aluno lê quando o treino morreu por falha NOSSA.
 *
 * Só afirma o que as entradas provam:
 *  · fala em crédito SOMENTE quando houve débito de verdade;
 *  · fala em equipe acionada SOMENTE quando o chamado existe (tem número);
 *  · manda tentar de novo SOMENTE quem tem saldo para isso.
 */
export function mensagemFalhaTecnica(args: {
  credito: DesfechoCredito;
  /** Número curto do chamado (#85) ou null se a abertura falhou. */
  chamado: number | null;
  custoCreditos: number;
}): string {
  const partes = [`${PREFIXO_FALHA_TECNICA} — não foi culpa sua.`];

  if (args.credito === "estornado") {
    partes.push(`Devolvemos os ${milhar(args.custoCreditos)} créditos desta tentativa.`);
  } else if (args.credito === "estorno_falhou") {
    // Nunca dizer "devolvemos" aqui: a devolução foi tentada e não entrou.
    partes.push(
      `A devolução dos ${milhar(args.custoCreditos)} créditos não saiu sozinha e ` +
        `nossa equipe vai aplicar na mão.`,
    );
  }
  // "nao_cobrado": silêncio sobre crédito. Não houve cobrança, então qualquer
  // frase sobre devolução — inclusive "não foi cobrado" — só levanta a dúvida.

  if (args.chamado !== null) {
    partes.push("Abrimos um chamado e nossa equipe já está com ele.");
  } else {
    // Sem número não dá pra prometer equipe. O que continua VERDADE é que a
    // falha ficou gravada: o `training_jobs` já foi marcado `failed` com o
    // erro cru antes desta mensagem existir, e a varredura de incidentes lê
    // de lá. Afirmamos só isso.
    partes.push("A falha ficou registrada aqui do nosso lado.");
  }

  partes.push(
    args.credito === "estornado"
      ? "Com os créditos de volta, você já pode começar a clonagem de novo com o mesmo áudio."
      : "Você não precisa fazer nada: o retreino é por nossa conta.",
  );

  return partes.join(" ");
}

/**
 * Esta falha é culpa NOSSA (técnica) ou do material que o aluno enviou?
 *
 * Só a técnica vira chamado e retreino por nossa conta. Erro de dataset/arquivo
 * é acionável pelo aluno (a mensagem dele já diz o que fazer) e tem caminho
 * próprio — `escalateStuckUser` cobre quem repete e continua sem voz.
 */
export function falhaEhNossa(args: {
  erroDeDataset: boolean;
  arquivoCorrompido: boolean;
}): boolean {
  return !args.erroDeDataset && !args.arquivoCorrompido;
}

/** Traduz o par (foi cobrado?, o estorno entrou?) no desfecho de crédito. */
export function desfechoDoCredito(args: {
  billed: boolean;
  estornoOk: boolean;
}): DesfechoCredito {
  if (!args.billed) return "nao_cobrado";
  return args.estornoOk ? "estornado" : "estorno_falhou";
}
