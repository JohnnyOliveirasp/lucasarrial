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

/**
 * A recusa do TREINO (fala limpa insuficiente), com o mesmo compromisso da
 * porta: o número do aluno arredonda pra BAIXO e a frase diz quanto falta.
 *
 * Por que existe (medido em 21/08, incidente acf8acd6 — o balde estava
 * `fixed` desde 09/08 e voltou a disparar 6x depois disso):
 *
 * `finalize-training` usava `Math.round` nos dois lados da comparação, então
 * quem parava a um passo do mínimo lia a frase impossível
 * "apenas ~10min serviram para o treino (mínimo: 10min de fala limpa)" —
 * o mesmo defeito aritmético que a porta tinha, no outro mínimo.
 *
 * Casos reais, do `training_jobs.useful_seconds`:
 *   dirceu.moura.cruz78  594,2s · **598,5s** · 591,1s   (mínimo 600s)
 *   lauriane20           3 tentativas, todas exibindo "~10min vs 10min"
 *
 * Os dois tentaram TRÊS vezes seguidas. O `598,5s` do dirceu é **1,5 segundo**
 * abaixo do corte: a mensagem afirmava que ele tinha exatamente o mínimo e
 * mesmo assim o recusava, sem dizer o que mudar. Nada a fazer com essa frase
 * a não ser tentar de novo às cegas — foi o que os dois fizeram.
 */
export function mensagemFalaLimpaInsuficiente(
  usefulSegundos: number | null | undefined,
  minUsefulSegundos?: number | null,
): string {
  const min =
    typeof minUsefulSegundos === "number" && minUsefulSegundos > 0
      ? minUsefulSegundos
      : MIN_USEFUL_SECONDS;
  const alvoLimpo = Math.ceil(min / 60);
  const porta = MIN_TOTAL_SECONDS / 60;

  // Sem número do worker não dá pra prometer precisão — não invente um.
  const diagnostico =
    typeof usefulSegundos === "number"
      ? `apenas ~${minutosExibidos(usefulSegundos)}min serviram para o treino ` +
        `(mínimo: ${alvoLimpo}min de fala limpa)`
      : `não sobrou fala limpa suficiente para o treino`;

  // O quase-lá merece frase própria: quem falhou por segundos precisa saber
  // que faltou pouco, senão regrava do zero achando que errou tudo.
  const faltouSeg =
    typeof usefulSegundos === "number" ? Math.max(0, min - usefulSegundos) : null;
  const quantoFalta =
    faltouSeg === null
      ? ""
      : faltouSeg < 60
        ? ` Faltou muito pouco — menos de 1min de fala limpa.`
        : ` Faltaram ~${Math.ceil(faltouSeg / 60)}min de fala limpa.`;

  return (
    `Do áudio enviado, ${diagnostico}.${quantoFalta} ` +
    `Seus créditos foram devolvidos. Grave num ambiente silencioso, falando ` +
    `continuamente e próximo ao microfone. Importante: para enviar de novo, a ` +
    `gravação precisa somar pelo menos ${porta}min no total — é dessa folga que ` +
    `saem os ${alvoLimpo}min de fala limpa, depois que tiramos pausas e ruído.`
  );
}
