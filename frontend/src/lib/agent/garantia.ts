/**
 * A DECISÃO da janela de garantia da Hotmart — separada da consulta e da
 * formatação (que ficam em `account.ts`).
 *
 * MORA NUM ARQUIVO PRÓPRIO, SEM NENHUM IMPORT, DE PROPÓSITO: é a parte que
 * decide dinheiro, e precisa ser testável com `node --test` sem subir banco,
 * sem alias `@/` e sem bundler. Enquanto ela vivia dentro do `account.ts` — que
 * importa `@/lib/db/admin` — não havia como escrever um teste, e foi assim que
 * os dois defeitos do #265 ficaram 6 dias no ar: errar aqui não quebra nada, o
 * texto sai bonito e errado.
 *
 * ── A CONSTANTE DE 7 DIAS SAIU DAQUI (incidente #265, 05/09/2026) ───────────
 * A versão anterior calculava `aprovação + 7 dias`. Sete não é a janela deste
 * produto e nunca foi: `payload.data.product.warranty_date` vem PRONTO em
 * TODAS as 694 compras pagas registradas (medido em 05/09, zero ausências) e
 * diz outra coisa. Distribuição real, em compras PAGAS:
 *     6 dias → 648 · 7 dias → 17 · 14 dias → 24 · 15 dias → 3 · 30 dias → 1
 * O erro tinha as duas direções, e as duas machucam:
 *  - nos produtos de 14/15/30 dias a constante FECHAVA a janela cedo demais e
 *    a Fast dizia "FORA" a quem estava DENTRO — 3 alunos nessa situação no
 *    momento da medição, com a âncora inalterada;
 *  - nos de 6 dias ela ABRIA um dia a mais do que a Hotmart honra, que é
 *    exatamente o "promete dinheiro que não volta" que o #198 criou esta conta
 *    pra impedir. Ninguém está nesse vão de 1 dia hoje, mas isso é sorte de
 *    calendário, não segurança.
 *
 * Conservadora de propósito, nas quatro pontas:
 *  - usa a janela que FECHA PRIMEIRO entre as compras pagas;
 *  - só considera compra PAGA (`price.value > 0`): adesão de R$0 não tem o que
 *    reembolsar. É a mesma regra do `pagou_de_verdade.cjs`, e existe porque a
 *    Hotmart emite mensalidade OVERDUE pra quem nunca pagou (18/08: devolvemos
 *    1.356.554 créditos a 14 pessoas por confundir valor com pagamento);
 *  - `warranty_date` chega como data em 00:00Z e esse instante é o FIM da
 *    janela, sem esticar pro fim do dia — erra pro lado que não promete
 *    reembolso a mais;
 *  - sem `warranty_date` legível devolve `null` (o chamador vira ESCALAR). NÃO
 *    existe constante de reserva: foi a constante que produziu este incidente.
 *    Se a Hotmart parar de mandar o campo, o certo é a Fast calar e chamar
 *    gente — não chutar de novo.
 *
 * ⚠️ O QUE ESTA FUNÇÃO **NÃO** DECIDE: se a RENOVAÇÃO reabre a garantia. A
 * âncora continua sendo a janela mais antiga entre as compras pagas, igual
 * antes. Isso não é bug, é política de dinheiro — e a conta dela é grande:
 * medido em 05/09, dos 57 alunos que a linha declara FORA e cujo
 * `warranty_date` mais recente ainda está no futuro, **54 dependem só dessa
 * decisão** e 3 do defeito corrigido aqui. Enquanto o Johnny não decidir, o
 * comportamento fica o de hoje.
 */

/** Linha crua do `payment_events` — só os campos que esta conta lê. */
export type EventoCompra = {
  payload?: {
    data?: {
      product?: { id?: unknown; name?: unknown; warranty_date?: unknown };
      purchase?: {
        approved_date?: unknown;
        order_date?: unknown;
        date_next_charge?: unknown;
        price?: { value?: unknown };
      };
    };
  };
};

export type Janela = { compra: Date; fim: Date; dentro: boolean };

/**
 * A janela DE UM PRODUTO — o que a `Janela` sozinha nunca soube dizer.
 *
 * `semGarantia` marca o produto cuja única compra foi adesão de R$ 0: não há o
 * que reembolsar (regra mantida intacta), mas o produto EXISTE na vida do aluno
 * e some da conta. Era esse buraco que fazia a linha do outro produto ser lida
 * como se fosse a dele. `primeiraCobranca` vem do `date_next_charge` do mesmo
 * payload: pra quem está em adesão trial, é a única data que importa.
 */
export type JanelaProduto = {
  produtoId: string | null;
  produto: string | null;
  compra: Date | null;
  fim: Date | null;
  dentro: boolean;
  semGarantia: boolean;
  primeiraCobranca: Date | null;
};

/**
 * `agora` entra por parâmetro de propósito: prazo testado com relógio real
 * vira teste que passa hoje e quebra amanhã sem ninguém ter mexido no código.
 */
const ms = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
// warranty_date vem ISO ("2026-08-24T00:00:00Z"), NÃO epoch como approved_date.
// Os dois formatos convivem no MESMO payload; passar o ISO pelo `ms()` acima
// devolveria null e a compra cairia fora da conta em silêncio.
const iso = (v: unknown) => {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) && t > 0 ? t : null;
};
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function janelaGarantia(linhas: EventoCompra[], agora: Date): Janela | null {
  const pagas = linhas
    .filter((e) => Number(e.payload?.data?.purchase?.price?.value ?? 0) > 0)
    .map((e) => ({
      compra: ms(e.payload?.data?.purchase?.approved_date) ?? ms(e.payload?.data?.purchase?.order_date),
      fim: iso(e.payload?.data?.product?.warranty_date),
    }))
    .filter((c): c is { compra: number; fim: number } =>
      typeof c.compra === "number" && Number.isFinite(c.compra) && c.compra > 0 && typeof c.fim === "number",
    );
  if (!pagas.length) return null;

  const alvo = pagas.reduce((a, b) => (b.fim < a.fim ? b : a));
  return { compra: new Date(alvo.compra), fim: new Date(alvo.fim), dentro: agora.getTime() <= alvo.fim };
}

/**
 * UMA JANELA POR PRODUTO — o conserto do falso positivo da Evelyn (#265, 14/09).
 *
 * POR QUE EXISTE: `janelaGarantia()` colapsa N compras numa linha só, e essa
 * linha não carrega QUAL produto ela descreve. A Fast recebe uma data sem dono e
 * atribui ao produto que o aluno perguntou — com 2+ compras isso é erro
 * garantido, não risco. Medido em 15/09: **237 alunos** têm 2+ janelas distintas.
 * A Evelyn foi informada "sua compra foi feita em 07/09 e a garantia vai até
 * 13/09" sobre um FastCloner que ela comprou em **10/09**: as duas datas eram do
 * Sistema de Geração Pronto.
 *
 * O QUE ESTA FUNÇÃO **NÃO** MUDA, de propósito:
 *  - não mexe em `janelaGarantia()`: a âncora "fecha primeiro entre as pagas"
 *    continua idêntica, então nada regride pra quem tem um produto só;
 *  - **não decide se renovação reabre garantia.** Essa é a política parada com o
 *    Johnny, e é a esmagadora maioria do volume: dos 76 alunos que hoje a linha
 *    declara FORA tendo `warranty_date` futuro, **73 são renovação do MESMO
 *    produto** (decisão dele) e só **3** são produto DIFERENTE (este defeito).
 *    Publicar 76 como "bug" seria inflar 25×;
 *  - não remove o filtro de compra PAGA. R$ 0 não tem o que reembolsar, e essa
 *    regra custou 1.356.554 créditos pra ser aprendida. O produto de R$ 0 passa
 *    a APARECER marcado `semGarantia`, que é diferente de passar a valer.
 *
 * Dentro de um mesmo produto segue valendo a que FECHA PRIMEIRO: a conservadoria
 * não muda, só deixa de atravessar produto.
 */
export function janelasPorProduto(linhas: EventoCompra[], agora: Date): JanelaProduto[] {
  const porProduto = new Map<string, JanelaProduto>();

  for (const e of linhas) {
    const p = e.payload?.data?.product;
    const c = e.payload?.data?.purchase;
    const produtoId = texto(p?.id) ?? (typeof p?.id === "number" ? String(p.id) : null);
    const produto = texto(p?.name);
    // Sem identidade nenhuma a linha não pode ser atribuída a produto algum —
    // agrupar tudo isso num balde "null" reconstruiria o bug que estamos tirando.
    const chave = produtoId ?? produto;
    if (!chave) continue;

    const paga = Number(c?.price?.value ?? 0) > 0;
    const compra = ms(c?.approved_date) ?? ms(c?.order_date);
    const fim = iso(p?.warranty_date);
    const proxima = ms(c?.date_next_charge);

    const atual = porProduto.get(chave);
    const candidato: JanelaProduto = {
      produtoId,
      produto,
      compra: typeof compra === "number" && compra > 0 ? new Date(compra) : null,
      fim: paga && typeof fim === "number" ? new Date(fim) : null,
      dentro: paga && typeof fim === "number" ? agora.getTime() <= fim : false,
      semGarantia: !paga,
      primeiraCobranca: typeof proxima === "number" && proxima > 0 ? new Date(proxima) : null,
    };

    if (!atual) {
      porProduto.set(chave, candidato);
      continue;
    }
    // Uma compra PAGA sempre ganha da adesão de R$ 0 do mesmo produto: é ela que
    // tem o que reembolsar. Entre duas pagas, a que fecha primeiro.
    const trocaPorPaga = atual.semGarantia && !candidato.semGarantia;
    const fechaAntes =
      !atual.semGarantia && !candidato.semGarantia && atual.fim && candidato.fim && candidato.fim < atual.fim;
    if (trocaPorPaga || fechaAntes) {
      porProduto.set(chave, { ...candidato, primeiraCobranca: candidato.primeiraCobranca ?? atual.primeiraCobranca });
    } else if (!atual.primeiraCobranca && candidato.primeiraCobranca) {
      porProduto.set(chave, { ...atual, primeiraCobranca: candidato.primeiraCobranca });
    }
  }

  return [...porProduto.values()];
}
