/**
 * A DATA DE ACESSO, DITA EM PORTUGUÊS — incidente #303 (`a0bc1f7e`).
 *
 * POR QUE ESTE ARQUIVO EXISTE. `profiles.access_until` é UMA coluna com DOIS
 * significados opostos, e a coluna sozinha não conta qual dos dois:
 *
 *   assinatura ACTIVE    → a data é a PRÓXIMA COBRANÇA. A assinatura RENOVA
 *                          nela. Não é prazo de uso, não é vencimento.
 *   assinatura CANCELED  → a data é o fim do período JÁ PAGO. Aí sim acaba.
 *
 * Medido em produção em 17/09, não suposto: dos 606 perfis com entitlement
 * `active` vivo, **605** têm `access_until` igual, ao minuto, a
 * `raw_event->purchase->date_next_charge`. Para assinatura viva a data É a
 * cobrança. E **230** desses 606 têm a data dentro de 7 dias — ou seja, 230
 * contas sobre as quais a casa podia escrever um prazo que não existe.
 *
 * O ESTRAGO QUE JÁ ACONTECEU. Em 07/09 a casa escreveu a uma aluna (conta
 * 49110dde, Enviados uid 1243) "o seu acesso está indo até 09/09, ou seja,
 * mais dois dias" e "vale regravar hoje ou amanhã antes do prazo". A
 * assinatura dela era HCIA7GIM, status ACTIVE, `date_next_charge` 09/09 — ela
 * ia RENOVAR, não vencer. Nas 8 horas seguintes o saldo dela caiu de 149.049
 * para 121.613: **27.436 créditos** queimados depois de a casa ter inventado a
 * pressa. (A sequência e o tamanho estão medidos; o nexo causal não está
 * provado, e não é afirmado aqui nem no card.)
 *
 * POR QUE UMA FUNÇÃO COMPARTILHADA, E NÃO UM `if` NO `account.ts`. A confusão
 * não mora no agente, mora na LEITURA DO CAMPO. Em 08/09 ela reapareceu num
 * e-mail escrito À MÃO, fora de qualquer prompt, a partir da mesma coluna: um
 * rascunho aprovado para 8 assinantes PAGANTES dizia "a sua assinatura está
 * ATIVA ATÉ {DATA}", e os 8 tinham `status = ACTIVE` com aquela data sendo a
 * renovação. Foi pego na bancada por acaso. Consertar só o `account.ts`
 * deixaria a armadilha viva para a Fast, para rascunho manual e para qualquer
 * script futuro que formate essa data. Quem precisar da frase pede aqui.
 *
 * A CLASSE JÁ VOLTOU QUATRO VEZES: #48 (19/08, aluna achou que perdia 185.969
 * créditos no "vencimento"), #136 (25/08), #198 (30/08) e este. Sempre fechada,
 * nunca consertada na origem.
 *
 * ZERO IMPORT, de propósito — igual a `acesso-regra.ts`: é o que permite rodar
 * `node --test src/lib/payments/acesso-frase.test.ts` sem arrastar Supabase
 * atrás. A regra mais cara de escrever da casa fica sob teste.
 */

/**
 * O que a data SIGNIFICA nesta conta. É isto que a coluna sozinha não diz.
 *
 * ⚠️ `desconhecido` não é enchimento de `switch`: é a resposta honesta quando
 * não achamos a linha de entitlement (ou quando a leitura dela FALHOU). Pelo
 * princípio que a casa já paga caro para manter — #222 em `vinculo.ts`, #282 em
 * `entitlements-pure.ts` — **ausência de informação não é informação**. Chutar
 * "vence" aqui é exatamente o defeito que este arquivo existe para matar.
 */
export type NaturezaDaData =
  /** Sem acesso agora. A data, se existir, já passou. */
  | "sem_acesso"
  /** Acesso sem data de término (vitalício). */
  | "vitalicio"
  /** ACTIVE: a data é a PRÓXIMA COBRANÇA — a assinatura renova nela. */
  | "renova"
  /** CANCELED: a data é o fim do período já pago — aí sim termina. */
  | "termina"
  /** Tem data futura, mas não sabemos se renova. Não afirme nada. */
  | "desconhecido";

/**
 * O que se sabe da conta na hora de escrever a frase.
 *
 * `statusEntitlement` é o status da MELHOR linha viva de `entitlements` (mesmo
 * desempate de `entitlements-pure.melhorAcesso`: "active" ganha de "canceled";
 * empatado, a data mais longe). `null` = não sabemos — inclui o caso em que o
 * SELECT errou, e é por isso que o campo aceita `null` em vez de cair num
 * `"canceled"` padrão.
 */
export type LeituraDeAcesso = {
  accessUntil: string | null;
  accessSource: string | null;
  statusEntitlement: string | null;
};

/** Data curta em pt-BR no fuso de São Paulo (dd/mm/aaaa). */
export function diaBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** O que a data significa. Sem texto, para poder ser testada e ramificada. */
export function naturezaDaData(
  l: LeituraDeAcesso,
  agoraIso: string,
): NaturezaDaData {
  if (!l.accessUntil) return l.accessSource ? "vitalicio" : "sem_acesso";
  // Data no passado: a janela acabou, seja qual for o status da linha. Antes
  // daqui o `account.ts` escrevia "ativo até <data passada>" — "ativo" sobre
  // conta expirada, que é a mesma família de erro pelo outro lado.
  if (l.accessUntil <= agoraIso) return "sem_acesso";
  if (l.statusEntitlement === "active") return "renova";
  if (l.statusEntitlement === "canceled") return "termina";
  return "desconhecido";
}

/**
 * A frase para o PROMPT DO AGENTE (Fast). É imperativa de propósito: o leitor é
 * um modelo, e o defeito original foi ele preencher com o palpite mais óbvio o
 * que a string não dizia. Aqui o que ele NÃO pode dizer está escrito.
 *
 * O desenho é o de `linhaGarantiaHotmart()` (`account.ts`), criada depois do
 * #198 pela mesma razão: a linha que falta vira afirmação errada.
 */
export function fraseDeAcessoParaAgente(
  l: LeituraDeAcesso,
  agoraIso: string,
): string {
  const n = naturezaDaData(l, agoraIso);
  const dia = l.accessUntil ? diaBR(l.accessUntil) : "?";
  switch (n) {
    case "renova":
      return (
        `ATIVO · a assinatura RENOVA automaticamente em ${dia} — essa data é a ` +
        `PRÓXIMA COBRANÇA, NÃO é prazo de uso. NUNCA diga que o acesso "vai ` +
        `até", "vence" ou "termina" nessa data, e NUNCA crie urgência em cima ` +
        `dela. Se o aluno perguntar até quando tem acesso: enquanto a ` +
        `assinatura seguir ativa.`
      );
    case "termina":
      return (
        `ATIVO até ${dia} · a assinatura está CANCELADA e NÃO renova; essa data ` +
        `é o fim do período já pago. ⚠️ Os créditos que ele já tem NÃO somem ` +
        `nessa data — a geração é liberada por SALDO, não por data. NÃO anuncie ` +
        `perda de créditos e NÃO mande "usar antes que acabe".`
      );
    case "vitalicio":
      return `ATIVO, sem data de término${l.accessSource ? ` (origem: ${l.accessSource})` : ""}.`;
    case "desconhecido":
      return (
        `ATIVO até ${dia}${l.accessSource ? ` (origem: ${l.accessSource})` : ""} · ` +
        `⚠️ NÃO temos o status da assinatura desta conta. NÃO afirme que ela ` +
        `renova NEM que vence nessa data — se o aluno perguntar, ESCALE para o ` +
        `humano em vez de escolher uma das duas.`
      );
    case "sem_acesso":
      // ⚠️ ESTE CASO ERA O ÚNICO SEM IMPERATIVO — incidente #507 (21/09/2026).
      //
      // Os outros quatro ramos deste `switch` dizem ao modelo o que ele NÃO
      // pode afirmar; `sem_acesso` só dizia o fato seco ("SEM assinatura
      // ativa.") e confiava que ele tiraria a conclusão. Não tira: é a mesma
      // aposta que produziu o #198 (data de garantia crua) e o #303 (data de
      // acesso crua), e que o cabeçalho deste arquivo chama pelo nome — a
      // linha que falta vira afirmação errada.
      //
      // Caso vivo: 21/09 08:54:39Z, chat de ajuda do app. O contexto da conta
      // trazia, correto, `Plano: free · Acesso: SEM assinatura ativa` e
      // `Saldo: 0 créditos`, e a Fast respondeu à aluna que ela "pode
      // continuar usando a plataforma normalmente". A conta tinha zero
      // entitlement, zero crédito e 16 dias de espera; a frase mandou uma
      // pessoa que não consegue gerar nada ir tentar.
      //
      // A proibição aponta para o SALDO em vez de negar a geração em bloco,
      // porque negar seria falso do outro lado: sem assinatura quem libera a
      // geração é o saldo, exatamente como o ramo `termina` já explica ("a
      // geração é liberada por SALDO, não por data"). Conta sem assinatura e
      // COM créditos avulsos gera normalmente — e dizer a ela que não pode
      // seria o mesmo defeito virado ao contrário.
      return (
        (l.accessUntil
          ? `SEM assinatura ativa (a última janela paga terminou em ${dia}).`
          : "SEM assinatura ativa.") +
        ` ⚠️ NUNCA diga a esta conta que ela "pode continuar usando a` +
        ` plataforma normalmente", e NUNCA mande ela "ir tentar": sem` +
        ` assinatura, o que libera geração é o SALDO. LEIA a linha "Saldo" do` +
        ` contexto antes de afirmar qualquer coisa sobre o que ela consegue` +
        ` fazer. Se o saldo também for 0, a conta não consegue gerar NADA —` +
        ` diga isso com todas as letras e trate o pedido dela como acesso que` +
        ` falta, não como dúvida de uso.`
      );
  }
}

/**
 * A mesma verdade, curta, para escrever a um ALUNO (e-mail, chat, rascunho
 * manual). Existe para o caso de 08/09: quem estava redigindo à mão tinha a
 * data e não tinha o status, e escreveu "ativa até" sobre uma renovação.
 *
 * Devolve `null` no caso `desconhecido` de propósito — sem status não há frase
 * honesta a dar ao aluno, e devolver algo genérico convidaria a preencher o
 * resto na mão, que é exatamente como o incidente nasceu.
 */
export function fraseDeAcessoParaAluno(
  l: LeituraDeAcesso,
  agoraIso: string,
): string | null {
  const n = naturezaDaData(l, agoraIso);
  const dia = l.accessUntil ? diaBR(l.accessUntil) : "?";
  switch (n) {
    case "renova":
      return `sua assinatura está ativa e renova automaticamente em ${dia}`;
    case "termina":
      return `sua assinatura foi cancelada e não renova; o acesso do período já pago vai até ${dia}`;
    case "vitalicio":
      return "seu acesso está ativo e não tem data de término";
    case "sem_acesso":
      return l.accessUntil
        ? `seu acesso à plataforma terminou em ${dia}`
        : "você não tem assinatura ativa";
    case "desconhecido":
      return null;
  }
}
