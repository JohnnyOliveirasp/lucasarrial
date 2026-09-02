/**
 * Fila de um em um, no navegador — defesa em profundidade do #238.
 *
 * O servidor já é seguro sozinho (o append virou passo atômico com a linha
 * travada, ver lib/sgp/anexar.ts). Isto aqui é a SEGUNDA camada: o cliente
 * mandava as confirmações em paralelo (`for (const f of cortada) void
 * enviarUma(f)`), que é o que criava a rajada de 6 requests em 350ms. Com a
 * fila, o upload pro R2 continua paralelo (o aluno não espera à toa) e só a
 * confirmação — a parte que escreve no pedido — anda uma de cada vez.
 *
 * Não substitui a trava do banco: aba duplicada, retentativa do navegador ou
 * um cliente antigo em cache voltariam a mandar em paralelo.
 */
export type Fila = <T>(tarefa: () => Promise<T>) => Promise<T>;

export function criarFila(): Fila {
  let ultima: Promise<unknown> = Promise.resolve();
  return function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
    // `then(tarefa, tarefa)` de propósito: uma tarefa que falhou não pode
    // travar a fila nem impedir as próximas de rodar.
    const resultado = ultima.then(tarefa, tarefa);
    ultima = resultado.catch(() => {});
    return resultado;
  };
}
