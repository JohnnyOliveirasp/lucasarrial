/**
 * A data de hoje, escrita pra ir no topo do system prompt da Fast.
 *
 * POR QUE ESTE ARQUIVO EXISTE (caso alana_pinho@hotmail.com, 09/09):
 * o system prompt da Fast NUNCA disse que dia é hoje. Ela lia o histórico da
 * conversa, encontrava um "te aviso no dia 07" escrito por ela mesma dias
 * antes, e REPETIA a promessa como se o dia 07 ainda estivesse por vir. A
 * aluna percebeu o absurdo e corrigiu a Fast — depois de já ter chamado a
 * gente de robô. Conta criada 01/09, acesso vencido em 08/09, ZERO vozes,
 * ZERO gerações, 99.475 créditos intactos: o teste inteiro dela foi consumido
 * por um defeito nosso, e por cima disso a Fast reprometeu uma data vencida.
 *
 * POR QUE MÓDULO SEPARADO, e não uma função dentro do manual.ts:
 * manual.ts importa por alias ("@/lib/video-clone/config"), que o runner
 * nativo do Node não resolve sem loader — por isso manual.test.ts lê o FONTE
 * em vez de importar o módulo. Este arquivo NÃO importa nada, então o teste
 * consegue CHAMAR a função de verdade, com relógio fixo, e medir a saída em
 * vez de medir texto. Mesmo motivo e mesmo padrão do garantia.ts.
 *
 * NÃO ponha import aqui. Um único import quebra o teste de relógio fixo.
 */

/** Fuso do aluno e da equipe. A data é sempre a de Brasília, não a do servidor. */
const FUSO = "America/Sao_Paulo";

const FMT_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const FMT_SEMANA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  weekday: "long",
});

/**
 * Bloco "HOJE É ..." + a regra dura sobre data vencida.
 *
 * Saber a data não basta: sem a regra, o modelo tem a data no topo e mesmo
 * assim repete a promessa que está no histórico, porque copiar o histórico é
 * mais barato do que comparar. A regra é a metade que faz o trabalho.
 *
 * @param hoje momento de referência. Default = agora (os 6 call sites chamam
 *   sem argumento). Data inválida cai pra agora: "que dia é hoje" sempre tem
 *   resposta certa, e um prompt sem a linha é exatamente o defeito de origem.
 */
export function linhaDataHoje(hoje: Date = new Date()): string {
  const quando =
    hoje instanceof Date && !Number.isNaN(hoje.getTime()) ? hoje : new Date();

  const data = FMT_DATA.format(quando);
  const semana = FMT_SEMANA.format(quando);

  return `HOJE É ${data}, ${semana} (horário de Brasília).

DATAS DO HISTÓRICO PODEM JÁ TER PASSADO. A conversa acima pode ter dias ou
semanas de idade. Antes de repetir QUALQUER data que aparece nela como
promessa ("te aviso no dia X", "até o dia X está pronto"), compare a data com
HOJE:
- ainda no futuro → pode repetir normalmente.
- JÁ VENCIDA (anterior a hoje) → NUNCA reprometa a mesma data e NUNCA invente
  uma data nova no lugar. O prazo furou: reconheça o atraso em uma frase, sem
  desculpa técnica, NÃO dê prazo novo por conta própria e escale pro humano
  (regra 3). Repetir uma data vencida é o que faz a pessoa sentir que está
  falando com um robô que não leu nada.
Isto vale pras promessas de retorno que VOCÊ fez na conversa. NÃO use esta
data pra calcular garantia, prazo de reembolso ou tempo de acesso: essas
contas continuam vindo PRONTAS no bloco CONTA DO ALUNO, e a regra da garantia
segue valendo inteira — você não conta dias.`;
}
