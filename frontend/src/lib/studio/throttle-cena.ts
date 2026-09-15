/**
 * Política de ESPERA por throttle do Kie numa cena do Estúdio (#358, perna 2)
 * — módulo folha, sem nenhum import, pra rodar no `node --test`.
 *
 * POR QUE EXISTE: o #240 criou a classe `KieRateLimitError` (o 429 que
 * sobreviveu às 3 retentativas do `postCreateTask`) mas NENHUM chamador
 * escuta. Em `lib/studio/scenes.ts`, o erro caía no catch genérico e chamava
 * `failScene`, que marca a cena `failed` **e ESTORNA**. Ou seja: régua de
 * retry esgotada = cena destruída permanentemente, e o aluno perde a cena por
 * causa de uma fila cheia momentânea — exatamente o prejuízo que o #240 se
 * propôs a evitar e resolveu só pela metade.
 *
 * A REGRA: throttle é condição TEMPORÁRIA, então a cena não deve morrer por
 * causa dele — deve ficar onde está e ser retentada no próximo tick (o poll da
 * tela e o cron `sweep-stuck-scenes` já reprocessam cena parada). Mas "espera
 * pra sempre" cria cena presa eternamente, que é o outro defeito conhecido
 * desta base (imagem presa 28 dias, incidente 69f0aec5). Por isso a espera tem
 * PRAZO: passados 30 min desde o nascimento da cena, o comportamento de hoje
 * volta (falha + estorno), e o aluno recebe o crédito de volta em vez de
 * ficar com uma cena zumbi.
 */

/**
 * Janela em que vale a pena esperar a fila do Kie aliviar. Depois dela, a cena
 * falha e estorna (comportamento anterior) pra nunca virar cena presa.
 */
export const JANELA_ESPERA_THROTTLE_MS = 30 * 60 * 1000;

/**
 * Reconhece o `KieRateLimitError` de `lib/kie/http.ts` SEM importá-lo.
 *
 * ⚠️ Por que pelo `name` e não por `instanceof`: este arquivo precisa ficar
 * sem imports pra ser carregável no `node --test` (o `../kie/http` sem
 * extensão só resolve no bundler do Next). A classe seta `this.name =
 * "KieRateLimitError"` no construtor, então a checagem é equivalente na
 * prática — e ainda sobrevive a realm diferente, onde `instanceof` falharia.
 *
 * O acoplamento por string está AMARRADO POR TESTE: `throttle-cena.test.ts`
 * importa a classe de verdade (`../kie/http.ts`, com extensão — aí resolve) e
 * exige que ela seja reconhecida aqui. Se alguém renomear a classe ou tirar o
 * `this.name`, o teste quebra em vez de a cena voltar a ser destruída em
 * silêncio.
 */
export function ehThrottleEsgotado(e: unknown): boolean {
  return e instanceof Error && e.name === "KieRateLimitError";
}

/**
 * Decide se um erro de despacho ao Kie deve ADIAR a cena (deixar como está pro
 * próximo tick retentar) em vez de reprovar+estornar.
 *
 * Só adia quando é throttle esgotado E a cena ainda está dentro da janela.
 * Qualquer outro erro — ou `created_at` ausente/ilegível, onde não dá pra
 * afirmar a idade — mantém o comportamento de hoje, que é o lado seguro:
 * falhar e devolver o crédito.
 */
export function deveAdiarPorThrottle(
  e: unknown,
  createdAt: string | null | undefined,
  agora: number,
): boolean {
  if (!ehThrottleEsgotado(e)) return false;
  if (!createdAt) return false;
  const nascimento = Date.parse(createdAt);
  if (Number.isNaN(nascimento)) return false;
  // Idade negativa (relógio do banco adiantado) cai como "dentro da janela",
  // que é o lado que NÃO destrói a cena do aluno.
  return agora - nascimento < JANELA_ESPERA_THROTTLE_MS;
}
