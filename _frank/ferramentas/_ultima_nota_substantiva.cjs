/**
 * _ultima_nota_substantiva.cjs — o recuo por cima de nota NEUTRA (carimbo de
 * lote/retrofit que nao fala do estado real do caso), compartilhado entre
 * quem le "a ultima nota" de um incidente.
 *
 * EXTRAIDO em 25/09 (incidente 02581255) de
 * `2026-09-22_esperando_johnny.cjs` (linhas ~178-309, escritas em 24/09
 * 21h45Z pro #554). E a TERCEIRA vez que este padrao aparece na casa — a
 * ordem era clara: nao duplicar de novo.
 *
 * O DEFEITO QUE ISTO CONSERTA, medido no `percepcao_travada.cjs`: a funcao
 * `travadosDe()` lia `agent_notes[agent_notes.length - 1]` cru. Quando a
 * ultima nota de um cartao era um carimbo de LOTE (ex.: o retrofit da trava
 * do humano, #415, escrito em 21 cartoes de uma tacada em 24/09 17:48Z), o
 * pedido de percepcao real ficava enterrado uma posicao ATRAS e o cartao
 * saia da varredura em SILENCIO. Medido em 25/09: 22 de 164 cartoes vivos
 * (13%) tinham a ultima nota neutra — nao e prova de que os 22 escondiam
 * pedido de percepcao (a maioria nao escondia), e sim de que o instrumento
 * era CEGO pra essa classe inteira sem ninguem saber.
 *
 * O CRITERIO, herdado do #554: "ultima nota" passa a ser "ultima nota
 * SUBSTANTIVA" — anda pra tras enquanto a nota for NEUTRA (marcada por
 * texto, ver NOTA_NEUTRA abaixo), ate um TETO. O teto existe por escrito: o
 * criterio de quem consome este modulo (percepcao ou decisao do Johnny) e
 * "o passo que falta AGORA" — recuar sem limite pode ressuscitar um pedido
 * JA ATENDIDO por uma nota substantiva anterior aquela que o superou.
 *
 * NOTA_NEUTRA E DELIBERADAMENTE CURTA E CONFERIDA A MAO (ver o cabecalho
 * original em `2026-09-22_esperando_johnny.cjs` pra o raciocinio completo:
 * nem todo texto em LOTE e neutro — 2 dos 4 padroes de lote medidos em 24/09
 * MUDAM o estado do caso e nao podem ser pulados). Incluir padrao aqui exige
 * motivo e data, e o piso so desce por escrito — mesma disciplina do
 * CONTROLE positivo dos dois consumidores.
 *
 * USO:
 *   const { ultimaNotaSubstantiva } = require("./_ultima_nota_substantiva.cjs");
 *   const { nota, pulos } = ultimaNotaSubstantiva(incidente.agent_notes);
 *   // nota: o objeto de agent_notes ({ by, at, note, ... }) ou null se nao
 *   //       achou nenhuma substantiva (array vazio/invalido, ou pilha
 *   //       inteira neutra ate o TETO).
 *   // pulos: quantas notas neutras foram puladas pra chegar ate `nota`
 *   //        (0 se a ultima ja era substantiva, ou se nada foi achado).
 *
 * TESTE (sem banco): node --test "_frank/ferramentas/_ultima_nota_substantiva.test.cjs"
 */

const NOTA_NEUTRA = [
  // Retrofit da trava do humano (#415), 24/09 17:48Z, 21 cartoes. A propria
  // nota declara: "NADA MAIS foi tocado — nem status, nem credito, nem
  // acesso, nem texto de nota", e o #554 conferiu que e verdade. Fala de
  // MARCA no registro, nunca do desfecho do caso.
  /retrofit\s+da\s+trava\s+do\s+humano/i,
  // Carimbo automatico da Fast quando o aluno escreve de novo num chamado
  // que ja esta com o time (10 cartoes, desde 16/09). Registra que o aluno
  // voltou a falar; nao decide nada e nao tira nada do colo de quem esta
  // com o caso. Mesma familia do BOILERPLATE do sensor, so que em nota
  // inteira.
  /o\s+aluno\s+mandou\s+outro\s+e-?mail\s+e\s+a\s+fast\s+n[aã]o\s+respondeu/i,
];

const ehNeutra = (texto) => !!texto && NOTA_NEUTRA.some((p) => p.test(texto));

// Quantas notas neutras seguidas se aceita pular. Teto baixo de proposito: se
// um cartao tiver uma PILHA de carimbos por cima, isso e achado pra
// investigar (outro lote cego), nao coisa pra varrer em silencio. Estourar o
// teto devolve "nada substantivo achado" — o vies volta a ser pra baixo, que
// e o lado seguro (falso negativo, nunca falso positivo).
const TETO_NEUTRAS = 5;

/**
 * Anda pra tras no array de `agent_notes` pulando notas NEUTRAS, ate
 * TETO_NEUTRAS. Pura, sem banco. `agent_notes` null, vazio ou fora do
 * formato de array devolve `{ nota: null, pulos: 0 }` sem explodir.
 *
 * @param {any} agentNotes o campo `agent_notes` do incidente
 * @returns {{ nota: object|null, pulos: number }}
 *   nota  — o objeto de nota substantiva encontrado, ou null se a pilha
 *           inteira (ate o teto) for neutra, vazia ou invalida.
 *   pulos — quantas notas neutras foram puladas. Continua contando mesmo
 *           quando `nota` sai null (estourou o teto ou bateu no inicio do
 *           array todo neutro), pra quem quiser diagnosticar; mas so conte
 *           isso como "resgate" quando `nota` NAO for null — pular sem achar
 *           nada substantivo nao revelou pedido nenhum.
 */
function ultimaNotaSubstantiva(agentNotes) {
  const n = agentNotes;
  if (!Array.isArray(n) || n.length === 0) return { nota: null, pulos: 0 };
  let i = n.length - 1;
  let pulos = 0;
  while (i >= 0 && pulos < TETO_NEUTRAS && ehNeutra(n[i] && n[i].note)) {
    i--;
    pulos++;
  }
  if (i < 0) return { nota: null, pulos };
  return { nota: n[i], pulos };
}

module.exports = { ultimaNotaSubstantiva, ehNeutra, NOTA_NEUTRA, TETO_NEUTRAS };
