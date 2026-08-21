/**
 * A régua de áudio do treino, em UM lugar só — e a mensagem que o aluno lê.
 *
 * Por que existe (incidente 07745f61, medido em 21/08):
 *
 * São DOIS mínimos diferentes e o aluno só conhecia o errado:
 *   - PORTA (aqui): 20min BRUTOS somados. É o que deixa o áudio ENTRAR.
 *   - TREINO (worker): 10min de fala LIMPA, pós Demucs+VAD. É o que faz o
 *     treino PASSAR.
 * 20 brutos ≈ 10 limpos é a folga que cobre pausa, respiração e ruído.
 *
 * O estrago: nossas mensagens de falha citavam só o mínimo do TREINO ("10min
 * de fala limpa") e mandavam "tente de novo com essa gravação nova". Quem
 * obedecia gravava 12–15min e batia na PORTA, que exige 20 — sem que nenhuma
 * das duas mensagens mencionasse a outra. Em 21/08 havia 14 vozes de 9 alunos
 * PAGANTES paradas em `rejected_too_short`, várias por pouco (15min, 18min,
 * 18min), nenhuma delas avisada.
 *
 * O segundo estrago era aritmético: a mensagem arredondava com `Math.round`,
 * então 1174s (19,57min) virava a frase impossível
 * "Áudio total 20min < mínimo de 20min" — foi o que kelinnavelar leu.
 * Aqui o número do aluno SEMPRE arredonda pra baixo: se está abaixo da porta,
 * a frase tem que mostrar isso.
 */

/** A PORTA: soma bruta mínima pro áudio ser aceito. Espelha o medidor da tela. */
export const MIN_TOTAL_SECONDS = 20 * 60;

/** O TREINO: fala limpa mínima exigida pelo worker (TRAIN_MIN_USEFUL_SECONDS). */
export const MIN_USEFUL_SECONDS = 10 * 60;

/**
 * Minutos do aluno pra exibição. Arredonda pra BAIXO de propósito: quem tem
 * 19,57min não pode ler "20min" numa frase que o está recusando por ter menos
 * de 20min.
 */
export function minutosExibidos(segundos: number): number {
  return Math.floor(Math.max(0, segundos) / 60);
}

/**
 * A mensagem de recusa na porta. Diz quanto falta e o que fazer — antes o
 * aluno só recebia o veredito, nunca o alvo.
 */
export function mensagemCurtoDemais(totalSegundos: number): string {
  const tem = minutosExibidos(totalSegundos);
  const alvo = MIN_TOTAL_SECONDS / 60;
  const faltam = Math.max(1, Math.ceil((MIN_TOTAL_SECONDS - totalSegundos) / 60));
  return (
    `Áudio total ${tem}min < mínimo de ${alvo}min. ` +
    `Faltam ~${faltam}min: adicione mais gravação (ou regrave) até somar ${alvo}min ` +
    `e envie de novo — nada foi cobrado.`
  );
}
