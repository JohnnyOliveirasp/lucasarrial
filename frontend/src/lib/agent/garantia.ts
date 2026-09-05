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
      product?: { warranty_date?: unknown };
      purchase?: { approved_date?: unknown; order_date?: unknown; price?: { value?: unknown } };
    };
  };
};

export type Janela = { compra: Date; fim: Date; dentro: boolean };

/**
 * `agora` entra por parâmetro de propósito: prazo testado com relógio real
 * vira teste que passa hoje e quebra amanhã sem ninguém ter mexido no código.
 */
export function janelaGarantia(linhas: EventoCompra[], agora: Date): Janela | null {
  const ms = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
  // warranty_date vem ISO ("2026-08-24T00:00:00Z"), NÃO epoch como approved_date.
  // Os dois formatos convivem no MESMO payload; passar o ISO pelo `ms()` acima
  // devolveria null e a compra cairia fora da conta em silêncio.
  const iso = (v: unknown) => {
    if (typeof v !== "string") return null;
    const t = Date.parse(v);
    return Number.isFinite(t) && t > 0 ? t : null;
  };

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
