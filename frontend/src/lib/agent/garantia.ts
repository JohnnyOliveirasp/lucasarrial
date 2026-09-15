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
 * `estado` é explícito de propósito, porque a versão anterior deste tipo tinha
 * só um booleano `semGarantia` e ele CONFUNDIA duas coisas muito diferentes:
 * "a compra foi adesão de R$ 0, não há o que reembolsar" (um fato) com "não
 * consegui ler o preço / a data / a garantia" (uma ignorância). Impresso, o
 * segundo virava afirmação — a casa dizia "adesão de R$ 0, não há valor a
 * reembolsar" a quem pagou. É a mesma assimetria da regra 9-A: desconhecido
 * nunca vira débito, e aqui nunca vira negativa de garantia.
 *
 *  - `dentro`  → compra paga, `warranty_date` lido, ainda dentro da janela
 *  - `fora`    → compra paga, `warranty_date` lido, janela fechada
 *  - `adesao0` → preço lido e é ZERO: não há valor a reembolsar (regra intacta)
 *  - `indefinida` → qualquer outra coisa (preço ilegível, sem data de compra,
 *    sem `warranty_date`, produto sem identidade). SEMPRE escala; nunca afirma.
 *
 * `primeiraCobranca` vem do `date_next_charge` do mesmo payload: pra quem está
 * em adesão trial, é a única data que importa.
 */
export type EstadoProduto = "dentro" | "fora" | "adesao0" | "indefinida";

export type JanelaProduto = {
  produtoId: string | null;
  produto: string | null;
  identificado: boolean;
  compra: Date | null;
  fim: Date | null;
  estado: EstadoProduto;
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
 *    a APARECER marcado `adesao0`, que é diferente de passar a valer.
 *
 * Dentro de um mesmo produto segue valendo a que FECHA PRIMEIRO: a conservadoria
 * não muda, só deixa de atravessar produto.
 *
 * ── DUAS PROPRIEDADES QUE A PRIMEIRA VERSÃO NÃO TINHA (revisão de 15/09) ────
 *
 * 1. **Nada é descartado em silêncio.** A versão anterior fazia `continue` na
 *    linha sem `product.id`/`name`. Como o chamador RETORNA nesta função quando
 *    há 2+ produtos, a linha descartada sumia junto com o veredito dela — e se
 *    fosse justamente a que FECHA PRIMEIRO, o texto virava DENTRO onde a
 *    `janelaGarantia()` dizia FORA. Nenhuma ocorrência viva (medido em 15/09:
 *    `product.id` presente em 2.308 de 2.308 `PURCHASE_APPROVED`), mas o custo
 *    do dia em que aparecer é prometer reembolso que a casa não deve. Agora a
 *    linha sem identidade vira um produto `indefinida`, que força ESCALAR.
 *
 * 2. **O resultado não depende da ORDEM das linhas.** A consulta em
 *    `account.ts` não tem `ORDER BY`, então a ordem das linhas é o que o
 *    Postgres devolver — e a versão anterior decidia por "quem chegou primeiro"
 *    em dois ramos. Veredito de dinheiro que muda com o plano de execução não é
 *    reconferível. A escolha agora é uma ORDEM TOTAL (`piorEstado`), e
 *    `primeiraCobranca` é sempre a MAIS CEDO, não a primeira vista.
 */
const PESO: Record<EstadoProduto, number> = { indefinida: 0, fora: 1, dentro: 2, adesao0: 3 };

/** A ordem total: pior (mais conservador) primeiro. Empate → fecha antes. */
function piorEstado(a: JanelaProduto, b: JanelaProduto): JanelaProduto {
  if (PESO[a.estado] !== PESO[b.estado]) return PESO[a.estado] < PESO[b.estado] ? a : b;
  if (a.fim && b.fim && a.fim.getTime() !== b.fim.getTime()) return a.fim < b.fim ? a : b;
  if (a.compra && b.compra && a.compra.getTime() !== b.compra.getTime()) return a.compra < b.compra ? a : b;
  return a;
}

export function janelasPorProduto(linhas: EventoCompra[], agora: Date): JanelaProduto[] {
  const porProduto = new Map<string, JanelaProduto>();

  for (const e of linhas) {
    const p = e.payload?.data?.product;
    const c = e.payload?.data?.purchase;
    const produtoId = texto(p?.id) ?? (typeof p?.id === "number" ? String(p.id) : null);
    const produto = texto(p?.name);
    const identificado = Boolean(produtoId ?? produto);
    // Sem identidade a linha não pode ser atribuída a produto NENHUM — mas
    // também não pode sumir (ver propriedade 1 acima). Vai pro balde único de
    // não-identificadas, que só sabe dizer "escale".
    const chave = produtoId ?? produto ?? " sem-identidade";

    // `preco` só é ZERO quando foi LIDO como número zero. Ausente, nulo, NaN ou
    // string não-canônica ("617,12") é IGNORÂNCIA, não adesão gratuita.
    const bruto = c?.price?.value;
    const preco = typeof bruto === "number" && Number.isFinite(bruto) ? bruto : null;
    const compra = ms(c?.approved_date) ?? ms(c?.order_date);
    const fim = iso(p?.warranty_date);
    const proxima = ms(c?.date_next_charge);
    const temCompra = typeof compra === "number" && compra > 0;

    let estado: EstadoProduto;
    if (!identificado || preco === null) estado = "indefinida";
    else if (preco === 0) estado = "adesao0";
    else if (typeof fim !== "number" || !temCompra) estado = "indefinida";
    else estado = agora.getTime() <= fim ? "dentro" : "fora";

    const candidato: JanelaProduto = {
      produtoId,
      produto,
      identificado,
      compra: temCompra ? new Date(compra as number) : null,
      fim: (estado === "dentro" || estado === "fora") && typeof fim === "number" ? new Date(fim) : null,
      estado,
      primeiraCobranca: typeof proxima === "number" && proxima > 0 ? new Date(proxima) : null,
    };

    const atual = porProduto.get(chave);
    if (!atual) {
      porProduto.set(chave, candidato);
      continue;
    }
    const vencedor = piorEstado(atual, candidato);
    const cedo = [atual.primeiraCobranca, candidato.primeiraCobranca]
      .filter((d): d is Date => d instanceof Date)
      .sort((x, y) => x.getTime() - y.getTime())[0];
    porProduto.set(chave, {
      ...vencedor,
      produto: vencedor.produto ?? atual.produto ?? candidato.produto,
      primeiraCobranca: cedo ?? null,
    });
  }

  return [...porProduto.values()];
}

/**
 * A linha que a Fast é mandada OBEDECER quando nada pôde ser confirmado.
 *
 * Mora aqui, e não no `account.ts`, porque o texto do multi-produto (abaixo)
 * precisa poder cair nela — e porque o `account.ts` importa o banco, o que
 * impedia testar a string que de fato chega no prompt (era o buraco #12 da
 * revisão de 15/09: os 16 testes verdes não tocavam em UMA letra do texto).
 */
export const GARANTIA_ESCALAR =
  `GARANTIA HOTMART: NÃO foi possível confirmar a janela de garantia deste e-mail. ` +
  `NÃO afirme nada sobre prazo de garantia e escale pro humano.`;

/**
 * ⚠️ RENDERIZA EM SÃO PAULO, IGUAL À MAIN — de propósito, e NÃO por distração.
 *
 * Medido em 15/09 nas 2.308 compras: `warranty_date` vem SEMPRE às 00:00Z, e em
 * 2.224 delas é "data da aprovação em horário de Brasília + 7 dias". Ou seja, a
 * Hotmart serializa uma DATA como meia-noite UTC, e renderizar esse instante em
 * São Paulo (UTC-3) mostra o DIA ANTERIOR. A casa vem dizendo a data um dia mais
 * cedo — em 100% dos casos, desde sempre.
 *
 * Não corrijo aqui, e o motivo é regra, não preguiça: mudar isso ESTICA a janela
 * de reembolso de toda a base em um dia, e `dentro` compara contra o mesmo
 * instante (`agora <= fim`), então o conserto honesto mexe nos DOIS — que é
 * decidir política de dinheiro. Vira pergunta pro Johnny, medida e separada,
 * como a renovação. Este PR corrige ATRIBUIÇÃO de produto; se ele carregasse
 * junto uma mudança de janela, ninguém conseguiria dizer depois qual das duas
 * causou o quê.
 */
export const diaBR = (d: Date) =>
  d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * O BLOCO de garantia para quem tem 2+ produtos, como string pura e testável.
 *
 * ⚠️ TUDO que a linha única diz na ponta FORA tem que estar aqui também. A
 * primeira versão deste texto perdeu, sem ninguém notar, três instruções que o
 * #198 pagou caro pra pôr no prompt: "NÃO prometa reembolso", "escale pro
 * humano" e a orientação de cobrança indevida em renovação. Sobrou um
 * "→ FORA da janela." solto — informação sem ordem, exatamente o formato que faz
 * o modelo improvisar pro lado generoso. E é o caminho que atende os alunos de
 * MAIOR risco (os que têm mais de um produto), não os de menor.
 *
 * Devolve `null` quando NENHUM produto pôde ser confirmado: aí o chamador manda
 * `GARANTIA_ESCALAR`, porque o invariante do `account.ts` é "quando não acha
 * compra, devolve ESCALAR — nunca o silêncio, nunca uma afirmação".
 */
export function blocoGarantiaMultiProduto(produtos: JanelaProduto[], agora: Date): string | null {
  if (produtos.length < 2) return null;
  // Só vale a pena o bloco se ALGUMA janela foi de fato confirmada. Se são todas
  // adesão de R$ 0 e/ou indefinidas, não há veredito nenhum a obedecer, e
  // afirmar "não há garantia" seria trocar ESCALAR por uma negativa de dinheiro.
  if (!produtos.some((p) => p.estado === "dentro" || p.estado === "fora")) return null;

  const linhas = produtos
    .map((p) => {
      const nome = p.identificado ? (p.produto ?? `produto ${p.produtoId}`) : "compra que NÃO conseguimos identificar";
      const comprado = p.compra ? `comprado em ${diaBR(p.compra)} · ` : "";
      if (p.estado === "adesao0") {
        const cobra = p.primeiraCobranca
          ? ` A 1ª cobrança dele é ${diaBR(p.primeiraCobranca)} — é ESSA a data que vale pra ele.`
          : "";
        return `  · ${nome}: ${comprado}adesão de R$ 0, NÃO há valor a reembolsar (logo não há janela de garantia).${cobra}`;
      }
      if (p.estado === "indefinida") {
        return `  · ${nome}: ${comprado}garantia NÃO confirmada → NÃO afirme prazo, NÃO prometa reembolso, escale pro humano.`;
      }
      if (p.estado === "dentro") {
        return `  · ${nome}: ${comprado}a garantia informada pela Hotmart vai até ${diaBR(p.fim as Date)} → DENTRO da janela.`;
      }
      return `  · ${nome}: ${comprado}a garantia informada pela Hotmart terminou em ${diaBR(p.fim as Date)} → FORA da janela. NÃO prometa reembolso deste produto; escale pro humano.`;
    })
    .join("\n");

  return (
    `GARANTIA HOTMART (calculado pelo sistema — obedeça estas linhas): este e-mail tem ` +
    `${produtos.length} produtos, e CADA UM tem a sua própria janela. Hoje é ${diaBR(agora)}.\n${linhas}\n` +
    `USE A LINHA DO PRODUTO SOBRE O QUAL A PESSOA ESTÁ FALANDO, e trate cada produto separadamente: ` +
    `um pode estar DENTRO e o outro FORA ao mesmo tempo. NUNCA repita a data de um produto ao falar de ` +
    `outro — foi exatamente isso que a casa fez com uma aluna, citando a compra e a garantia do produto ` +
    `errado. Se não estiver claro de qual produto ela fala, PERGUNTE antes de dizer qualquer data. Cite a ` +
    `DATA, nunca um número de dias. Renovação mensal NÃO reabre a garantia: se a pessoa contesta uma ` +
    `cobrança RECENTE de renovação, isso é cobrança indevida — escale, não trate como garantia. Na dúvida, escale.`
  );
}
