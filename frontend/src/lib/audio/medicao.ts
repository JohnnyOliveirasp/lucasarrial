/**
 * A régua da MEDIÇÃO no browser: o que conta no total, o que trava o botão, e
 * por quê — em um lugar só, sem DOM, testável (`node --test`).
 *
 * Por que existe (incidente #203, medido em 31/08):
 *
 * A tela do treino de voz tinha DOIS estados colapsados num `null` só:
 * "ainda estou medindo" e "não consegui medir". O primeiro é passagem, o
 * segundo é desfecho — e a tela renderizava os dois como "medindo…". Quem caía
 * no segundo via um arquivo eternamente "medindo", total 00:00 e o botão
 * Treinar apagado, sem uma linha de erro. A Jussara (assinante pagante) passou
 * UM MÊS assim sem conseguir treinar voz nenhuma.
 *
 * A assimetria que deixou o defeito existir: no fluxo do SGP a medição do
 * browser é só atalho — o servidor mede com ffmpeg e é ele quem julga, então
 * arquivo ilegível SOBE. No treino de voz o servidor NÃO mede nada
 * (uploads-complete apenas soma o `client_durations` que o browser enviou),
 * então a medição do browser é a única que existe: quando ela falha em
 * silêncio, o aluno fica sem saída e sem rastro.
 *
 * O compromisso desta régua, herdado do `regua-audio.ts`: o número que o aluno
 * lê nunca pode contradizer o que a tela faz com ele. Arquivo não medido vale
 * ZERO no total (não dá pra inventar duração de arquivo que ninguém leu), mas
 * então a tela é OBRIGADA a dizer que ele não está contando — silêncio aqui é
 * exatamente o defeito que estamos consertando.
 */
import type { MotivoFalhaMedicao } from "./duration";

/** Um arquivo do ponto de vista da medição. */
export type ItemMedicao = {
  /** Segundos medidos, ou null enquanto mede / se não deu pra medir. */
  duracao: number | null;
  /** Preenchido só quando a medição FALHOU (≠ ainda estar medindo). */
  falha?: MotivoFalhaMedicao;
};

/** O estado de UM arquivo na tela — os três são distintos de propósito. */
export type EstadoMedicao = "medido" | "medindo" | "falhou";

export function estadoDoItem(item: ItemMedicao): EstadoMedicao {
  if (item.falha) return "falhou";
  return item.duracao == null ? "medindo" : "medido";
}

export type ResumoMedicao = {
  /** Soma só do que foi realmente medido. */
  total: number;
  medidos: number;
  medindo: number;
  falhados: number;
  atingeMinimo: boolean;
  acimaDoMaximo: boolean;
  /** Falta pro mínimo, considerando só o que foi medido. */
  faltam: number;
  /**
   * A pergunta que importa: o botão está morto POR CAUSA de arquivo que não
   * deu pra medir? Só é verdade quando existe falha E o mínimo não foi
   * atingido. Se o resto do áudio já passa dos 20min, a falha de um arquivo
   * NÃO bloqueia ninguém — ele sobe junto e o total nem precisava dele.
   */
  bloqueadoPorFalha: boolean;
};

export function resumirMedicao(
  itens: ItemMedicao[],
  minSegundos: number,
  maxSegundos: number,
): ResumoMedicao {
  let total = 0;
  let medidos = 0;
  let medindo = 0;
  let falhados = 0;

  for (const item of itens) {
    switch (estadoDoItem(item)) {
      case "medido":
        total += item.duracao ?? 0;
        medidos++;
        break;
      case "medindo":
        medindo++;
        break;
      case "falhou":
        falhados++;
        break;
    }
  }

  const acimaDoMaximo = total > maxSegundos;
  const atingeMinimo = total >= minSegundos && !acimaDoMaximo;

  return {
    total,
    medidos,
    medindo,
    falhados,
    atingeMinimo,
    acimaDoMaximo,
    faltam: Math.max(0, minSegundos - total),
    bloqueadoPorFalha: falhados > 0 && !atingeMinimo,
  };
}

/**
 * Chave i18n do motivo (sufixo de `errors.measureFailed`). Devolve chave, não
 * frase: quem traduz é a tela, e assim o teste não depende de idioma.
 */
export function chaveDoMotivo(motivo: MotivoFalhaMedicao): string {
  switch (motivo) {
    case "timeout":
      return "timeout";
    case "erro-do-audio":
      return "formato";
    case "sem-duracao":
      return "semDuracao";
    case "decode-falhou":
      return "formato";
    case "sem-audiocontext":
      return "navegador";
    case "fora-do-browser":
    case "excecao":
      return "generico";
  }
}

/**
 * O motivo vale uma nova tentativa? `timeout` é o único transitório da lista
 * (arquivo grande, aba ocupada) — os outros são propriedade do arquivo ou do
 * navegador e vão falhar igual na segunda vez. Botão de "tentar de novo" que
 * repete uma falha determinística só ensina o aluno a desconfiar da tela.
 */
export function vaiAdiantarTentarDeNovo(motivo: MotivoFalhaMedicao): boolean {
  return motivo === "timeout";
}
