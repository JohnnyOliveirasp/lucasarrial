/**
 * TENTATIVAS DE CONTATO: quantas vezes a casa já escreveu pra esta pessoa, e o
 * que aconteceu com cada uma. Módulo PURO (zero IO) — quem lê o banco é o
 * `mail-bounce-registro.ts`, mesma divisão do `mail-bounce.ts`/`mail-envio.ts`.
 *
 * POR QUE EXISTE (chamado b32af5ff, medido 14/09 — e a quarta repetição do
 * mesmo erro). A ficha de "e-mail não chegou" guardava o PRIMEIRO bounce e mais
 * nada. Quem pegasse a ficha lia "PRÓXIMO PASSO: tentar de novo mais tarde
 * costuma funcionar" — uma frase CONSTANTE, igual no primeiro dia e no quarto —
 * e a única ação que ela sugere é reenviar. Resultado real, com a Valdeni
 * (valdene_marques@msn.com):
 *
 *   10/09 12:22Z  boas-vindas do SGP      → 554 5.2.2 caixa cheia
 *   10/09 22:08Z  reenvio manual          → 554 5.2.2 caixa cheia
 *   13/09 22:13Z  3ª tentativa manual     → NENHUM bounce (a caixa esvaziou)
 *
 * Mesmo depois da carta ENTRAR, a ficha continuou dizendo "tente de novo" —
 * porque sucesso não deixa rastro nela: só bounce escrevia ali. Chegaram QUATRO
 * ordens de reenvio (11/09, 13/09, 14/09 ×2), cada uma custando uma ronda
 * inteira de medição pra concluir "não envie". E a 4ª ordem pedia gerar link de
 * recovery novo, o que teria SOBRESCRITO `auth.users.recovery_sent_at` — ou
 * seja, apagado a única prova de que a entrega de 13/09 aconteceu.
 *
 * ⚠️ "SEM BOUNCE" NUNCA É DITO COMO "ENTREGUE", e isso não é preciosismo: é a
 * mesma doutrina que o `mail-envio.ts` já cravou ao se recusar a ter uma coluna
 * `entregue`. A casa NUNCA recebe confirmação de entrega nem de leitura. O que
 * ela sabe é o NEGATIVO (voltou bounce = provado que não chegou) e a AUSÊNCIA
 * de notícia. Ausência de notícia é evidência, não prova. Chamar isso de
 * "entregue" na ficha convidaria exatamente a suposição que criou o problema —
 * então o texto diz "sem bounce há Xh" e explica o que isso vale.
 *
 * ⚠️ ZERO TENTATIVA NÃO É "NÃO ENVIAMOS". A tabela `emails_enviados` só começou
 * a registrar em 14/09 14:06Z (migration 108). Pra qualquer ficha anterior a
 * isso a lista vem VAZIA — e renderizar "0 tentativas" seria um zero CEGO, que
 * reforçaria a ordem de reenviar em vez de pará-la. É o pior desfecho possível
 * pra este módulo: ele existe pra matar a ordem de reenvio e acabaria
 * assinando embaixo dela. Por isso `cobreDesde` é OBRIGATÓRIO no resumo e a
 * falta de cobertura é dita com todas as letras.
 */

/** O que a casa sabe sobre UMA tentativa de falar com a pessoa. */
export type TentativaDeContato = {
  /** quando a casa mandou (ISO) */
  enviadoEm: string;
  /** assunto da mensagem — é o que identifica o caso pro humano */
  assunto: string | null;
  /** de qual fluxo saiu (`origem` de `emails_enviados`) */
  origem: string | null;
  /** carimbo do bounce, quando voltou. `null` = não voltou (ainda) */
  bounceEm: string | null;
  /** classe do bounce (`caixa-cheia`, `inexistente`...), quando houve */
  bounceClasse: string | null;
};

/**
 * O veredito de UMA tentativa. Quatro estados; a fronteira entre
 * `aguardando-veredito` e `sem-bounce` é só TEMPO decorrido:
 *  - `nao-chegou`         → voltou bounce CARIMBADO no ledger. É PROVA.
 *  - `bounce-sem-registro`→ o ledger não tem carimbo, mas o CARTÃO da ficha
 *                           disparou DEPOIS deste envio. Também é prova de que
 *                           não chegou — só que a prova está na outra fonte.
 *  - `aguardando-veredito`→ saiu há pouco e não voltou nada. Cedo pra concluir.
 *  - `sem-bounce`         → saiu há tempo suficiente e não voltou nada.
 *                           Evidência forte de que entrou. NÃO é prova.
 */
export type VeredictoTentativa = "nao-chegou" | "bounce-sem-registro" | "aguardando-veredito" | "sem-bounce";

/**
 * ── POR QUE `bounce-sem-registro` EXISTE (medido em 25/09, dois casos) ──────
 *
 * Este módulo lia UMA fonte: `emails_enviados.bounce_em`. Quando essa coluna
 * está NULL ele conclui "sem bounce ⇒ entrou ⇒ NÃO REENVIE". A conclusão é
 * boa quando a fonte é completa, e a fonte NÃO é completa.
 *
 * O caso que provou (#460, thallitamachado@hotmail.com): carta reenviada em
 * 18/09 15:27:54Z, `bounce_em` NULL — ledger limpo, convidando a ler
 * "entregue". Mas o `last_seen_at` do PRÓPRIO CARTÃO é 18/09 15:30:04Z, dois
 * minutos e meio DEPOIS do envio, e `occurrences` subiu pra 2. Quem disparou o
 * cartão foi o detector de bounce: a carta bateu na mesma caixa cheia e foi o
 * LEDGER que não carimbou. A ficha seguiu dizendo "NÃO REENVIE, entrou".
 *
 * O segundo (#250, andy.silvestre@icloud.com, 21 dias): carta 14/09 19:45:25Z,
 * `bounce_em` NULL, cartão disparado 14/09 19:50:04Z — 4,7 minutos depois,
 * `occurrences` 4. Cada ronda que abriu essa ficha leu "NÃO REENVIE" sobre um
 * pagante de R$ 733,60 que nunca recebeu carta nenhuma.
 *
 * A REGRA, e ela não depende de interpretação: se o cartão da ficha foi visto
 * DEPOIS de um envio, então houve bounce depois daquele envio. Ausência de
 * carimbo no ledger deixa de ser evidência de entrega no instante em que a
 * outra fonte diz que algo bateu.
 *
 * ⚠️ ISTO NÃO SUBSTITUI O CARIMBO, e a diferença importa: `nao-chegou` diz
 * QUAL foi a recusa (classe, diagnóstico cru); `bounce-sem-registro` diz só que
 * houve UMA. É prova de negativa, não descrição do defeito. Quem for consertar
 * o detector de bounce continua precisando do carimbo.
 *
 * ⚠️ E ELE NÃO INVENTA NADA QUANDO A INFORMAÇÃO FALTA: sem `fichaVistaEm`, o
 * módulo se comporta exatamente como antes. Quem não passa a última notícia do
 * cartão não recebe veredito novo — recebe o veredito velho, que é o que ele
 * tem como sustentar.
 */

/**
 * A ATRIBUIÇÃO: qual das cartas o disparo do cartão acusa.
 *
 * O cartão só tem UM `last_seen_at`, então ele acusa UMA carta: a última que
 * saiu ANTES dele. Carta posterior ao disparo não é acusada por ele — ela tem
 * o próprio veredito, pelo tempo.
 *
 * Sem esta atribuição o mesmo disparo condenaria todas as cartas anteriores da
 * ficha, inclusive as que comprovadamente entraram, e a lista viraria ficção.
 */
function indiceAcusadoPeloCartao(tentativas: TentativaDeContato[], fichaVistaEm: string | null): number {
  if (!fichaVistaEm) return -1;
  const visto = new Date(fichaVistaEm).getTime();
  if (!Number.isFinite(visto)) return -1;
  let alvo = -1;
  for (let i = 0; i < tentativas.length; i++) {
    const enviado = new Date(tentativas[i].enviadoEm).getTime();
    // Data ilegível não pode ser acusada nem inocentada: fica de fora.
    if (!Number.isFinite(enviado)) continue;
    if (enviado < visto) alvo = i;
    else break;
  }
  // Carta que JÁ tem carimbo não precisa ser acusada por dedução — o carimbo
  // é a prova melhor, e sobrescrevê-lo perderia a classe do bounce.
  if (alvo >= 0 && tentativas[alvo].bounceEm) return -1;
  return alvo;
}

/**
 * Quanto tempo esperar antes de tratar o silêncio como evidência de entrega.
 *
 * MEDIDO, com amostra pequena e é por isso que a conclusão é fraca de
 * propósito: os dois bounces da Valdeni voltaram em 8 e 9 SEGUNDOS (notas do
 * incidente b32af5ff, 10/09); o único bounce registrado em `emails_enviados`
 * até 14/09 22h (guitaschetti@pradocomunicacao.com) voltou em 153 segundos
 * (enviado 21:52:31Z, bounce 21:55:04Z). 30 minutos é ~12× o pior caso
 * observado.
 *
 * ⚠️ n=3. Esta constante decide quando o texto para de dizer "aguardando" e
 * passa a dizer "sem bounce há Xh" — e NUNCA decide dizer "entregue", que é o
 * que tornaria um erro aqui caro. Errar pra mais só atrasa a conclusão; errar
 * pra menos só antecipa uma frase que já vem com a ressalva colada.
 */
export const JANELA_VEREDITO_MS = 30 * 60 * 1000;

/** Início do registro de envios: migration 108, medido na própria tabela. */
export const EMAILS_ENVIADOS_COBRE_DESDE = "2026-09-14T14:06:31.539Z";

const horas = (ms: number): number => ms / 3_600_000;

/** Data/hora curta em UTC (`10/09 12:22Z`) — é assim que as notas já escrevem. */
export function momento(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p2 = (n: number): string => String(n).padStart(2, "0");
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}Z`;
}

/** "há 21h" / "há 35min" — a idade é o que decide se dá pra concluir algo. */
function idade(desdeIso: string, agoraMs: number): string {
  const ms = agoraMs - new Date(desdeIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const h = horas(ms);
  if (h < 1) return `há ${Math.max(1, Math.round(h * 60))}min`;
  if (h < 48) return `há ${Math.round(h)}h`;
  return `há ${Math.round(h / 24)} dias`;
}

/** O veredito de uma tentativa, dado o relógio. */
export function veredictoDaTentativa(
  t: TentativaDeContato,
  agoraMs: number,
  janelaMs: number = JANELA_VEREDITO_MS,
): VeredictoTentativa {
  if (t.bounceEm) return "nao-chegou";
  const enviado = new Date(t.enviadoEm).getTime();
  // Data ilegível: o lado seguro é NÃO concluir entrega. "Não sei" nunca pode
  // virar "chegou" — é a suposição que este módulo inteiro existe pra impedir.
  if (!Number.isFinite(enviado)) return "aguardando-veredito";
  return agoraMs - enviado >= janelaMs ? "sem-bounce" : "aguardando-veredito";
}

/**
 * Uma linha da lista, já em português de gente.
 *
 * `veredictoDado` existe porque `bounce-sem-registro` NÃO se deduz da tentativa
 * sozinha — ele depende do cartão inteiro (qual carta o disparo acusa). Quem já
 * fez essa conta passa o resultado; quem não passou recebe o cálculo local de
 * sempre. É o mesmo motivo de `resumirContato` guardar os vereditos: a conta
 * tem que ser feita UMA vez, senão a lista e a recomendação divergem.
 */
export function descreverTentativa(
  t: TentativaDeContato,
  indice: number,
  agoraMs: number,
  janelaMs: number = JANELA_VEREDITO_MS,
  veredictoDado?: VeredictoTentativa,
  fichaVistaEm?: string | null,
): string {
  const v = veredictoDado ?? veredictoDaTentativa(t, agoraMs, janelaMs);
  const canal = t.origem ? `e-mail (${t.origem})` : "e-mail";
  const veredicto =
    v === "nao-chegou"
      ? `NÃO CHEGOU${t.bounceClasse ? ` (${t.bounceClasse})` : ""} — bounce em ${momento(t.bounceEm as string)}`
      : v === "bounce-sem-registro"
        ? `NÃO CHEGOU — ${textoDoDisparo(t, fichaVistaEm ?? null, janelaMs)}`
        : v === "sem-bounce"
          ? `sem bounce ${idade(t.enviadoEm, agoraMs)} — evidência de que entrou (NÃO é prova de leitura)`
          : `SEM VEREDITO AINDA — saiu ${idade(t.enviadoEm, agoraMs)}, cedo pra concluir`;
  const assunto = t.assunto ? ` · "${t.assunto}"` : "";
  return ` ${indice}. ${momento(t.enviadoEm)} · ${canal}${assunto} · ${veredicto}`;
}

/**
 * O texto do disparo, e ele MUDA conforme a distância — porque o que está
 * provado muda conforme a distância, e escrever a frase forte nos dois casos
 * seria exatamente o exagero que este módulo cobra dos outros.
 *
 * DENTRO da janela (bounce volta em segundos, n=3 medido): o disparo é desta
 * carta. Diz-se isso.
 *
 * FORA da janela: o cartão disparou, então existe bounce — mas pode ser de uma
 * carta que o ledger nem conhece (o registro só começa em 14/09 14:06Z). O que
 * se afirma então é o negativo honesto: a lista está incompleta e o silêncio do
 * ledger não sustenta "entrou".
 */
function textoDoDisparo(t: TentativaDeContato, fichaVistaEm: string | null, janelaMs: number): string {
  const base =
    `o ledger não carimbou bounce, mas o CARTÃO desta ficha disparou` +
    (fichaVistaEm ? ` em ${momento(fichaVistaEm)}` : ``) +
    `, depois deste envio`;
  const enviado = new Date(t.enviadoEm).getTime();
  const visto = fichaVistaEm ? new Date(fichaVistaEm).getTime() : NaN;
  if (!Number.isFinite(enviado) || !Number.isFinite(visto)) {
    return `${base}. Ausência de carimbo NÃO é prova de entrega.`;
  }
  const delta = visto - enviado;
  if (delta <= janelaMs) {
    const min = Math.max(1, Math.round(delta / 60000));
    return (
      `${base} (${min}min — dentro da janela em que bounce volta). ` +
      `É o bounce DESTA carta, e foi o ledger que não registrou.`
    );
  }
  return (
    `${base} (${idade(t.enviadoEm, visto).replace(/^há /, "")} depois — FORA da janela de ${Math.round(janelaMs / 60000)}min). ` +
    `Existe bounce que o ledger não conhece: a lista acima está incompleta e o silêncio dela não sustenta "entrou".`
  );
}

/** O que a ficha deve RECOMENDAR, olhando o histórico inteiro. */
export type Recomendacao =
  /** último veredito é "sem bounce": a mensagem entrou. Reenviar é ruído. */
  | "nao-reenviar-ja-entrou"
  /** 2+ falhas seguidas sem nenhuma entrada: e-mail não alcança esta pessoa. */
  | "parar-por-email-usar-canal-externo"
  /**
   * o cartão disparou depois do último envio e o ledger não carimbou: a última
   * carta NÃO chegou, ao contrário do que a ausência de bounce sugeria.
   */
  | "cartao-disparou-depois-do-envio"
  /** saiu algo há pouco: espere o veredito antes de decidir qualquer coisa. */
  | "esperar-veredito"
  /** sem histórico utilizável — segue a orientação padrão da classe. */
  | "sem-historico";

export type ResumoDeContato = {
  tentativas: TentativaDeContato[];
  /**
   * o veredito de CADA tentativa, na ordem de `tentativas`. Guardado porque
   * `bounce-sem-registro` depende do cartão inteiro e não se rededuz de uma
   * tentativa isolada: recalcular na hora de imprimir faria a lista dizer uma
   * coisa e a recomendação outra.
   */
  vereditos: VeredictoTentativa[];
  /** veredito da tentativa MAIS RECENTE; `null` quando não há tentativa. */
  ultimoVeredicto: VeredictoTentativa | null;
  /**
   * quantas falhas comprovadas existem no histórico — carimbadas no ledger
   * (`nao-chegou`) MAIS as provadas pelo disparo do cartão
   * (`bounce-sem-registro`). As duas são prova de que não chegou; contar só a
   * primeira foi o que deixou a regra de parada cega em #250 e #460.
   */
  naoChegaram: number;
  recomendacao: Recomendacao;
  /** o registro de envios cobre o período desta ficha? */
  cobertura: "completa" | "parcial";
  /** `last_seen_at` do cartão, quando quem chamou o tinha. */
  fichaVistaEm: string | null;
};

/**
 * Resume o histórico.
 *
 * `fichaDesde` é o `first_seen_at` da ficha: é ele que denuncia a cobertura
 * parcial. Uma ficha de 10/09 com lista vazia NÃO é uma pessoa que nunca foi
 * contatada — é o registro que não existia ainda.
 *
 * `fichaVistaEm` é o `last_seen_at` do cartão: a SEGUNDA fonte. É ele que
 * desmente o silêncio do ledger quando o detector de bounce disparou depois do
 * envio (ver o bloco de `bounce-sem-registro` acima). Opcional de propósito —
 * quem não tem essa informação recebe exatamente o comportamento antigo, em vez
 * de um veredito construído sobre `undefined`.
 */
export function resumirContato(args: {
  tentativas: TentativaDeContato[];
  fichaDesde: string | null;
  agoraMs: number;
  fichaVistaEm?: string | null;
  cobreDesde?: string;
  janelaMs?: number;
}): ResumoDeContato {
  const { agoraMs, janelaMs = JANELA_VEREDITO_MS } = args;
  const cobreDesde = args.cobreDesde ?? EMAILS_ENVIADOS_COBRE_DESDE;
  const fichaVistaEm = args.fichaVistaEm ?? null;

  const tentativas = [...args.tentativas].sort(
    (a, b) => new Date(a.enviadoEm).getTime() - new Date(b.enviadoEm).getTime(),
  );

  const inicioCobertura = new Date(cobreDesde).getTime();
  const nascimento = args.fichaDesde ? new Date(args.fichaDesde).getTime() : NaN;
  // Ficha mais antiga que o registro = existem tentativas que a lista não vê.
  const cobertura: "completa" | "parcial" =
    Number.isFinite(nascimento) && Number.isFinite(inicioCobertura) && nascimento < inicioCobertura
      ? "parcial"
      : "completa";

  if (!tentativas.length) {
    return {
      tentativas,
      vereditos: [],
      ultimoVeredicto: null,
      naoChegaram: 0,
      recomendacao: "sem-historico",
      cobertura,
      fichaVistaEm,
    };
  }

  const vereditos = tentativas.map((t) => veredictoDaTentativa(t, agoraMs, janelaMs));
  // A segunda fonte entra AQUI, e só sobre a carta que o disparo acusa.
  const acusada = indiceAcusadoPeloCartao(tentativas, fichaVistaEm);
  if (acusada >= 0) vereditos[acusada] = "bounce-sem-registro";

  const ultimoVeredicto = vereditos[vereditos.length - 1] ?? null;
  const naoChegaram = vereditos.filter((v) => v === "nao-chegou" || v === "bounce-sem-registro").length;

  const recomendacao: Recomendacao =
    ultimoVeredicto === "sem-bounce"
      ? "nao-reenviar-ja-entrou"
      : ultimoVeredicto === "aguardando-veredito"
        ? "esperar-veredito"
        : // Último NÃO CHEGOU (carimbado ou provado pelo disparo do cartão).
          // Duas falhas comprovadas já bastam pra parar: insistir pelo mesmo
          // caminho é o que a regra de parada existe pra impedir.
          naoChegaram >= 2
          ? "parar-por-email-usar-canal-externo"
          : ultimoVeredicto === "bounce-sem-registro"
            ? "cartao-disparou-depois-do-envio"
            : "sem-historico";

  return { tentativas, vereditos, ultimoVeredicto, naoChegaram, recomendacao, cobertura, fichaVistaEm };
}

/**
 * A REGRA DE PARADA, em texto, pra ir no lugar do `PRÓXIMO PASSO` fixo da
 * classe. É o coração do conserto: a frase deixa de ser constante e passa a ser
 * função do que já aconteceu.
 *
 * Devolve `null` quando o histórico não manda nada — aí quem chama mantém a
 * orientação padrão da classe, que continua correta pro primeiro bounce.
 */
export function passoDoHistorico(r: ResumoDeContato, agoraMs: number): string | null {
  const ultima = r.tentativas[r.tentativas.length - 1];
  switch (r.recomendacao) {
    case "nao-reenviar-ja-entrou":
      return (
        `NÃO REENVIE POR E-MAIL. A última mensagem saiu em ${momento(ultima.enviadoEm)} e NÃO voltou ` +
        `bounce ${idade(ultima.enviadoEm, agoraMs)} — as falhas anteriores voltaram em segundos, então o ` +
        `silêncio aqui é evidência de que ela ENTROU. O que falta não é mais uma cópia da mesma mensagem. ` +
        `⚠️ Gerar link de recovery novo SOBRESCREVE \`auth.users.recovery_sent_at\`, que é a prova de que ` +
        `esta entrega aconteceu: reenviar apaga a evidência de que não era preciso reenviar.`
      );
    case "parar-por-email-usar-canal-externo":
      return (
        `PARE DE INSISTIR POR E-MAIL: ${r.naoChegaram} tentativas voltaram sem chegar, a última em ` +
        `${momento(ultima.bounceEm ?? ultima.enviadoEm)}. Enquanto isso não mudar, ela não recebe NADA nosso ` +
        `— use canal externo (telefone/WhatsApp do cadastro ou da Hotmart). Canal externo em nome da casa ` +
        `precisa de aval humano; registre o pedido em vez de disparar sozinho.`
      );
    case "cartao-disparou-depois-do-envio":
      return (
        `A ÚLTIMA MENSAGEM NÃO CHEGOU — e o ledger não mostra isso. Ela saiu em ` +
        `${momento(ultima.enviadoEm)} com \`bounce_em\` vazio, mas o CARTÃO desta ficha foi visto em ` +
        `${momento(r.fichaVistaEm ?? ultima.enviadoEm)}, DEPOIS do envio: quem levanta o cartão é o detector ` +
        `de bounce, então algo bateu e não foi carimbado. ⚠️ NÃO leia a ausência de bounce como entrega — foi ` +
        `essa leitura que deixou #250 parado 21 dias. Trate como falha de entrega: uma tentativa nova por ` +
        `e-mail é legítima (a caixa pode ter esvaziado), e se ela também não chegar, canal externo.`
      );
    case "esperar-veredito":
      return (
        `ESPERE O VEREDITO ANTES DE DECIDIR. Saiu mensagem em ${momento(ultima.enviadoEm)} ` +
        `(${idade(ultima.enviadoEm, agoraMs)}) e ainda não deu tempo de saber se voltou bounce — eles ` +
        `costumam voltar em segundos. Reenviar agora é criar a segunda cópia antes de saber se a primeira falhou.`
      );
    default:
      return null;
  }
}

/**
 * O BLOCO VISÍVEL da ficha. Vai no corpo da descrição, não em `agent_notes`:
 * o card b32af5ff pediu isso explicitamente porque as notas já traziam a
 * informação e mesmo assim quatro ordens de reenvio nasceram — o que está
 * enterrado não é lido por quem só bate o olho no `PRÓXIMO PASSO`.
 *
 * Devolve `[]` quando não há NADA a dizer (sem tentativas e cobertura
 * completa): bloco vazio é melhor que um "0 tentativas" que ninguém pediu.
 */
export function blocoDeTentativas(r: ResumoDeContato, agoraMs: number, cobreDesde?: string): string[] {
  const inicio = cobreDesde ?? EMAILS_ENVIADOS_COBRE_DESDE;
  const avisoCobertura =
    r.cobertura === "parcial"
      ? [
          `⚠️ O registro de envios só existe a partir de ${momento(inicio)} (migration 108). Esta ficha é`,
          `   ANTERIOR a isso: tentativas mais antigas NÃO aparecem na lista acima. Lista vazia ou curta aqui`,
          `   significa "sem registro", NUNCA "a casa não escreveu" — confira \`varrer_bounces\` e as notas`,
          `   antes de concluir que ninguém tentou.`,
        ]
      : [];

  if (!r.tentativas.length) {
    if (!avisoCobertura.length) return [];
    return ["TENTATIVAS DE CONTATO: nenhuma registrada.", ...avisoCobertura];
  }

  return [
    `TENTATIVAS DE CONTATO (${r.tentativas.length}):`,
    // Os vereditos vêm do resumo, NÃO são recalculados aqui: `bounce-sem-registro`
    // depende do cartão inteiro, e recalcular por tentativa faria esta lista
    // contradizer o `PRÓXIMO PASSO` logo abaixo dela.
    ...r.tentativas.map((t, i) =>
      descreverTentativa(t, i + 1, agoraMs, undefined, r.vereditos[i], r.fichaVistaEm),
    ),
    ...avisoCobertura,
  ];
}

/** Primeira linha do bloco derivado. */
const MARCA_BLOCO = /^TENTATIVAS DE CONTATO/;
/** Última linha do bloco derivado — é ela que fecha a região reescrita. */
const MARCA_PASSO = /^PRÓXIMO PASSO: /;

/**
 * REESCREVE, do zero, o trecho derivado de uma ficha de bounce já gravada.
 *
 * POR QUE ISTO EXISTE, e é a correção do primeiro desenho deste conserto.
 * Na primeira versão o bloco só era montado dentro do `descrever()` do
 * `mail-bounce.ts` — ou seja, **só quando chegava um bounce novo**. O gatilho
 * era o EVENTO DE FALHA. E o caso que abriu o cartão (b32af5ff) é justamente o
 * contrário: a 3ª tentativa da Valdeni em 13/09 22:13Z DEU CERTO, não voltou
 * bounce nenhum — então nada disparava a regravação e a ficha seguia mostrando
 * o conselho escrito no 2º bounce, três dias antes. O caminho de SUCESSO, que é
 * o mais comum, era exatamente o que o conserto não alcançava.
 *
 * Aqui a conta é refeita a CADA LEITURA, contra o `emails_enviados` de agora:
 * quem abre a ficha lê o estado de agora, não o estado do último acidente. É o
 * que "derivar na leitura" significa de verdade — sem coluna nova, sem
 * migration (regra 21) e sem um segundo lugar pra divergir.
 *
 * NÃO INVENTA FICHA. Se a descrição não tem a linha `PRÓXIMO PASSO: `, ela não
 * é do formato que este módulo escreve e volta INTACTA: é melhor uma ficha sem
 * o bloco do que uma ficha corrompida por adivinhação de formato.
 *
 * Quando o histórico não manda nada (`passoDoHistorico` = null), o passo que já
 * estava gravado é PRESERVADO — ele é a orientação padrão da classe, que segue
 * correta pro primeiro bounce. Só o bloco de tentativas é atualizado.
 */
export function reescreverFichaDeBounce(
  descricao: string,
  r: ResumoDeContato,
  agoraMs: number,
  cobreDesde?: string,
): string {
  const linhas = descricao.split("\n");
  const iPasso = linhas.findIndex((l) => MARCA_PASSO.test(l));
  if (iPasso < 0) return descricao;

  // O bloco antigo, quando existe, vive entre a marca e o passo. Sem marca, a
  // região é só a linha do passo e o bloco novo entra por cima dela.
  const iMarca = linhas.findIndex((l) => MARCA_BLOCO.test(l));
  const iInicio = iMarca >= 0 && iMarca < iPasso ? iMarca : iPasso;

  const bloco = blocoDeTentativas(r, agoraMs, cobreDesde);
  const passo = passoDoHistorico(r, agoraMs) ?? linhas[iPasso].replace(MARCA_PASSO, "");

  return [
    ...linhas.slice(0, iInicio),
    ...(bloco.length ? [...bloco, ""] : []),
    `PRÓXIMO PASSO: ${passo}`,
    ...linhas.slice(iPasso + 1),
  ].join("\n");
}
