/**
 * Quantas gravações do aluno a tela de treino ENCONTROU — somando as TRÊS
 * fontes, sem DOM, testável (`node --test`).
 *
 * Por que existe (caso João Soares, 16/09):
 *
 * A tela `/app/voice-cloning/new` importa gravação de três lugares:
 *   1. Gravador do NAVEGADOR (IndexedDB, mesmo aparelho)   → id `rec-…`
 *   2. Gravações salvas na CONTA (R2, qualquer aparelho)   → id `srv-…`
 *   3. Takes do "gravar pelo celular" (R2)                 → id `cel-…`
 *
 * A única confirmação na tela ("N gravações carregadas") estava presa na
 * fonte 1: ela era renderizada sob o estado que SÓ o efeito do IndexedDB
 * preenchia. Só que desde 02/09 o Gravador sobe cada clipe pra conta e APAGA
 * a cópia local assim que o upload confirma (voice-recorder.tsx:108-111).
 * Resultado invertido: quem teve upload BEM-SUCEDIDO caía no caminho 2 e não
 * via confirmação nenhuma; quem teve upload FALHO ficava com a cópia local e
 * ganhava o aviso verde. A confirmação aparecia exatamente para quem ela não
 * deveria tranquilizar.
 *
 * O João gravou 23 min (7 arquivos, medidos no R2), chegou ao passo 01, leu
 * "Requisitos: mínimo 20 minutos de fala" com o formulário em branco e
 * nenhuma palavra sobre as gravações dele, e desistiu — 0 vozes, 0 jobs, 0
 * débito. Nada tinha se perdido.
 *
 * O compromisso deste módulo: a contagem que a tela mostra é a SOMA das três
 * fontes, e o portão da confirmação é "achei em QUALQUER fonte" — nunca o
 * desfecho de uma fonte só. Enquanto a decisão morar aqui, ela não consegue
 * voltar a depender do IndexedDB em silêncio.
 */

/** As três origens de gravação que a tela de treino sabe importar. */
export type Fonte = "navegador" | "conta" | "celular";

/**
 * Prefixo do `id` de cada item da lista, por origem. Ele é o que permite
 * separar, dentro da MESMA lista, o que veio de gravação do que o aluno
 * escolheu no disco — e `voice-creator.tsx` já dependia desses prefixos para
 * decidir o que apagar quando o aluno remove uma linha.
 */
export const PREFIXO_FONTE: Record<Fonte, string> = {
  navegador: "rec-",
  conta: "srv-",
  celular: "cel-",
};

/** Quantas gravações entraram por cada origem nesta visita. */
export type FontesGravacao = Record<Fonte, number>;

export const NENHUMA_GRAVACAO: FontesGravacao = {
  navegador: 0,
  conta: 0,
  celular: 0,
};

export type ResumoGravacoes = {
  /** Soma das três fontes. É o número que o aluno lê. */
  total: number;
  /**
   * `true` se QUALQUER fonte trouxe gravação. É o portão da confirmação.
   * Existe como campo próprio (em vez de `total > 0` espalhado pela tela)
   * porque foi justamente um portão amarrado a uma fonte só que produziu o
   * aviso invertido.
   */
  achou: boolean;
  fontes: FontesGravacao;
};

/** Contagem negativa não existe; tratar como 0 em vez de subtrair do total. */
function naoNegativo(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function resumirGravacoes(fontes: FontesGravacao): ResumoGravacoes {
  const navegador = naoNegativo(fontes.navegador);
  const conta = naoNegativo(fontes.conta);
  const celular = naoNegativo(fontes.celular);
  const total = navegador + conta + celular;
  return {
    total,
    achou: total > 0,
    fontes: { navegador, conta, celular },
  };
}

/** De qual origem veio este item da lista — `null` se veio do disco. */
export function fonteDoId(id: string): Fonte | null {
  for (const fonte of Object.keys(PREFIXO_FONTE) as Fonte[]) {
    if (id.startsWith(PREFIXO_FONTE[fonte])) return fonte;
  }
  return null;
}

/** Um item da lista de arquivos, do ponto de vista desta contagem. */
export type ItemDaLista = {
  id: string;
  /** Segundos medidos, ou null enquanto mede / se não deu pra medir. */
  duracao: number | null;
};

export type SomaGravacoes = {
  /**
   * Segundos somados SÓ das gravações (arquivo escolhido no disco não entra).
   * Item sem medida vale 0 — não se inventa duração de áudio que ninguém leu,
   * mesma regra de `medicao.ts`.
   */
  segundos: number;
  /** Quantas gravações ainda não têm duração medida. */
  semMedida: number;
};

export function somarGravacoes(itens: ItemDaLista[]): SomaGravacoes {
  let segundos = 0;
  let semMedida = 0;
  for (const item of itens) {
    if (fonteDoId(item.id) === null) continue;
    if (item.duracao == null || !Number.isFinite(item.duracao) || item.duracao < 0) {
      semMedida++;
      continue;
    }
    segundos += item.duracao;
  }
  return { segundos, semMedida };
}
