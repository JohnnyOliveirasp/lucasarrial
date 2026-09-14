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
 * O veredito de UMA tentativa. Três estados, e a fronteira entre os dois
 * últimos é só TEMPO decorrido:
 *  - `nao-chegou`         → voltou bounce. É PROVA.
 *  - `aguardando-veredito`→ saiu há pouco e não voltou nada. Cedo pra concluir.
 *  - `sem-bounce`         → saiu há tempo suficiente e não voltou nada.
 *                           Evidência forte de que entrou. NÃO é prova.
 */
export type VeredictoTentativa = "nao-chegou" | "aguardando-veredito" | "sem-bounce";

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

/** Uma linha da lista, já em português de gente. */
export function descreverTentativa(
  t: TentativaDeContato,
  indice: number,
  agoraMs: number,
  janelaMs: number = JANELA_VEREDITO_MS,
): string {
  const v = veredictoDaTentativa(t, agoraMs, janelaMs);
  const canal = t.origem ? `e-mail (${t.origem})` : "e-mail";
  const veredicto =
    v === "nao-chegou"
      ? `NÃO CHEGOU${t.bounceClasse ? ` (${t.bounceClasse})` : ""} — bounce em ${momento(t.bounceEm as string)}`
      : v === "sem-bounce"
        ? `sem bounce ${idade(t.enviadoEm, agoraMs)} — evidência de que entrou (NÃO é prova de leitura)`
        : `SEM VEREDITO AINDA — saiu ${idade(t.enviadoEm, agoraMs)}, cedo pra concluir`;
  const assunto = t.assunto ? ` · "${t.assunto}"` : "";
  return ` ${indice}. ${momento(t.enviadoEm)} · ${canal}${assunto} · ${veredicto}`;
}

/** O que a ficha deve RECOMENDAR, olhando o histórico inteiro. */
export type Recomendacao =
  /** último veredito é "sem bounce": a mensagem entrou. Reenviar é ruído. */
  | "nao-reenviar-ja-entrou"
  /** 2+ falhas seguidas sem nenhuma entrada: e-mail não alcança esta pessoa. */
  | "parar-por-email-usar-canal-externo"
  /** saiu algo há pouco: espere o veredito antes de decidir qualquer coisa. */
  | "esperar-veredito"
  /** sem histórico utilizável — segue a orientação padrão da classe. */
  | "sem-historico";

export type ResumoDeContato = {
  tentativas: TentativaDeContato[];
  /** veredito da tentativa MAIS RECENTE; `null` quando não há tentativa. */
  ultimoVeredicto: VeredictoTentativa | null;
  /** quantas falhas comprovadas existem no histórico. */
  naoChegaram: number;
  recomendacao: Recomendacao;
  /** o registro de envios cobre o período desta ficha? */
  cobertura: "completa" | "parcial";
};

/**
 * Resume o histórico.
 *
 * `fichaDesde` é o `first_seen_at` da ficha: é ele que denuncia a cobertura
 * parcial. Uma ficha de 10/09 com lista vazia NÃO é uma pessoa que nunca foi
 * contatada — é o registro que não existia ainda.
 */
export function resumirContato(args: {
  tentativas: TentativaDeContato[];
  fichaDesde: string | null;
  agoraMs: number;
  cobreDesde?: string;
  janelaMs?: number;
}): ResumoDeContato {
  const { agoraMs, janelaMs = JANELA_VEREDITO_MS } = args;
  const cobreDesde = args.cobreDesde ?? EMAILS_ENVIADOS_COBRE_DESDE;

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
    return { tentativas, ultimoVeredicto: null, naoChegaram: 0, recomendacao: "sem-historico", cobertura };
  }

  const vereditos = tentativas.map((t) => veredictoDaTentativa(t, agoraMs, janelaMs));
  const ultimoVeredicto = vereditos[vereditos.length - 1] ?? null;
  const naoChegaram = vereditos.filter((v) => v === "nao-chegou").length;

  const recomendacao: Recomendacao =
    ultimoVeredicto === "sem-bounce"
      ? "nao-reenviar-ja-entrou"
      : ultimoVeredicto === "aguardando-veredito"
        ? "esperar-veredito"
        : // Último é "nao-chegou". Duas falhas comprovadas já bastam: insistir
          // pelo mesmo caminho é o que a regra de parada existe pra impedir.
          naoChegaram >= 2
          ? "parar-por-email-usar-canal-externo"
          : "sem-historico";

  return { tentativas, ultimoVeredicto, naoChegaram, recomendacao, cobertura };
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
    ...r.tentativas.map((t, i) => descreverTentativa(t, i + 1, agoraMs)),
    ...avisoCobertura,
  ];
}
