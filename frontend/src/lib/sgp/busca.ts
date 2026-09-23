/**
 * /admin/sgp — a BUSCA por nome, e-mail e WhatsApp, nas DUAS abas.
 *
 * Pedido do Lucas (recado 5): o time abre a tela pra atender UMA pessoa que
 * acabou de chamar no WhatsApp, e hoje precisa varrer a tabela com o olho. Com
 * 112 compradores e 27 na fila isso já custa; a lista só cresce.
 *
 * ⚠️ POR QUE É FILTRO DE TELA, e não uma consulta nova ao banco: as duas abas já
 * trazem TUDO pra memória (a fila até 500 linhas, a planilha paginada inteira).
 * Buscar no servidor seria uma ida a mais, com espera, pra filtrar um array que
 * já está na mão — e, pior, brigaria com o refresh de 30s da fila. Aqui a
 * resposta é instantânea e a busca sobrevive ao refresh, porque o estado do
 * campo não mora na linha.
 *
 * ⚠️ POR QUE MÓDULO PURO E SEPARADO: a régua de "o que casa com o quê" é onde
 * moram os enganos que o time sente na pele — telefone que não acha porque está
 * guardado com DDI e digitado com parêntese, nome que não acha por causa do
 * acento. Isso precisa de teste próprio, e a tela não sobe num `node --test`.
 *
 * AS REGRAS, e o porquê de cada uma:
 *  1. SEM ACENTO E SEM CAIXA. Ninguém digita "Conceição" no meio do atendimento.
 *  2. CADA PALAVRA PRECISA CASAR (E, não OU). "joao silva" acha "João da Silva",
 *     que uma busca por pedaço contínuo não acharia. É o caso real do time:
 *     ele lembra do primeiro e do último nome, não do nome completo.
 *  3. TELEFONE COMPARA SÓ DÍGITO. O banco guarda "5511999998888" e a tela mostra
 *     "(11) 99999-8888". Comparar texto formatado erraria as duas formas; assim
 *     colar do WhatsApp, digitar com parêntese ou digitar só os 8 finais acha.
 *  4. PALAVRA COM DÍGITO TENTA OS DOIS LADOS. "joao2010" é e-mail de gente de
 *     verdade; se dígito só olhasse telefone, esse aluno ficaria inachável.
 *  6. SÓ PALAVRA SEM LETRA VIRA BUSCA DE TELEFONE (23/09). A regra 4 mandava os
 *     dígitos de QUALQUER palavra pro telefone, e isso quebrou a busca por
 *     e-mail na mão do time: "marcolovison1@icloud.com" tem um "1", virava
 *     "telefone que contenha 1", e casou com 477 dos 578 compradores — todo
 *     mundo cujo celular tem o dígito 1. A tela parecia filtrada e trazia gente
 *     que não tinha nada a ver, então o time lia "o sistema não pesquisa".
 *     Repare que o defeito é INTERMITENTE por natureza: e-mail sem dígito
 *     nenhum sempre funcionou, e por isso ninguém tinha fechado a causa.
 *     A regra 4 continua valendo no que ela queria: "joao2010" segue achável,
 *     porque o lado do TEXTO já procura em nome e e-mail. O que sai é só o
 *     contrário — palavra com letra deixar de ser procurada como telefone.
 *  5. SEM TELEFONE NUNCA CASA. Na tela o vazio vira "—"; se ele virasse texto
 *     buscável, uma busca qualquer traria todo mundo que não tem telefone.
 */

/** Minúsculas, sem acento, sem espaço sobrando. */
export function normalizarTexto(bruto: string | null | undefined): string {
  if (typeof bruto !== "string") return "";
  return (
    bruto
      .normalize("NFD")
      // U+0300–U+036F = os acentos que o NFD separou da letra. Escrito com
      // escape de propósito: caractere combinante cru num arquivo é invisível
      // no editor e some num copiar-colar distraído.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  );
}

/**
 * A palavra tem alguma LETRA? (regra 6)
 *
 * `\p{L}` com a flag `u` pega letra de qualquer alfabeto, acentuada inclusive —
 * então "joão2010" e "José" contam como texto, e "(11)99999-8888" não. Usar
 * `[a-z]` aqui deixaria passar nome acentuado que só tem letra fora do ASCII.
 */
export function temLetra(bruto: string | null | undefined): boolean {
  if (typeof bruto !== "string") return false;
  return /\p{L}/u.test(bruto);
}

/** Só os dígitos: "(11) 99999-8888" → "11999998888". */
export function soDigitos(bruto: string | null | undefined): string {
  if (typeof bruto !== "string") return "";
  return bruto.replace(/\D/g, "");
}

/**
 * O que a busca enxerga de uma linha. `telefone` aceita o que a tela tiver na
 * mão — com DDI, formatado, "—" ou nulo: quem tira os dígitos é a regra 3, e
 * "—" some sozinho porque não tem dígito nenhum.
 */
export type AlvoBusca = {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
};

/** Uma palavra digitada, já quebrada nas duas leituras possíveis (regra 4). */
type Palavra = { texto: string; digitos: string };

/**
 * Quebra o que foi digitado em palavras. Palavra que não sobra nada depois de
 * normalizar (só espaço, ou só pontuação sem dígito) é descartada — senão um
 * espaço a mais no fim do campo zeraria a lista.
 */
export function palavrasDaBusca(termo: string | null | undefined): Palavra[] {
  if (typeof termo !== "string") return [];
  return termo
    .split(/\s+/)
    .map((p) => ({
      texto: normalizarTexto(p),
      // Regra 6: se a palavra tem LETRA, ela não é telefone — é nome ou e-mail.
      // Zerar os dígitos aqui (e não dentro do casaBusca) é de propósito: assim
      // existe UM lugar só onde se decide "isto é um telefone digitado", e o
      // resto do módulo não precisa saber da regra.
      digitos: temLetra(p) ? "" : soDigitos(p),
    }))
    .filter((p) => p.texto !== "" || p.digitos !== "");
}

/** A busca está desligada? (campo vazio ou só espaço) */
export function buscaVazia(termo: string | null | undefined): boolean {
  return palavrasDaBusca(termo).length === 0;
}

/**
 * Esta linha casa com o que foi digitado?
 *
 * Termo vazio casa com TUDO de propósito: o campo em branco não pode esconder
 * ninguém. Quem decide "não filtrar" é o chamador, mas mesmo que ele esqueça, o
 * pior caso aqui é mostrar a lista inteira — nunca escondê-la.
 */
export function casaBusca(termo: string | null | undefined, alvo: AlvoBusca): boolean {
  const palavras = palavrasDaBusca(termo);
  if (palavras.length === 0) return true;

  const nome = normalizarTexto(alvo.nome);
  const email = normalizarTexto(alvo.email);
  const telefone = soDigitos(alvo.telefone);

  // Regra 2: TODAS as palavras precisam achar um lugar. Cada uma pode achar num
  // campo diferente — "joao 99999" casa nome + telefone da mesma pessoa.
  return palavras.every((p) => {
    if (p.texto !== "" && (nome.includes(p.texto) || email.includes(p.texto))) return true;
    // ⚠️ O `p.digitos !== ""` é a guarda que MANDA, e ela não é estilo: sem ela,
    // uma palavra sem dígito nenhum ("otniel") viraria `telefone.includes("")`,
    // que é SEMPRE `true` — e aí toda palavra casaria com toda linha, deixando a
    // lista *parecendo* filtrada sem estar. É o defeito mais perigoso daqui,
    // porque não quebra nada: só devolve gente demais, calado.
    //
    // Regra 5 (linha sem telefone não casa com número) sai de graça disto:
    // `"".includes("99999")` já é `false`.
    if (p.digitos !== "" && telefone.includes(p.digitos)) return true;
    return false;
  });
}

/**
 * Filtra uma lista qualquer. O `alvoDe` é quem sabe onde moram nome/e-mail/
 * telefone naquela aba — as duas guardam com nomes diferentes (`whatsapp` na
 * fila, `celularDigitos` na planilha), e é só isso que muda entre elas.
 */
export function filtrarBusca<T>(
  termo: string | null | undefined,
  linhas: readonly T[],
  alvoDe: (linha: T) => AlvoBusca,
): T[] {
  if (buscaVazia(termo)) return [...linhas];
  return linhas.filter((l) => casaBusca(termo, alvoDe(l)));
}
