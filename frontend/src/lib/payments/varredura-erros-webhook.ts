/**
 * VARREDURA DE PRODUÇÃO de `payment_events.error` — parte (c) do #582 (25/09/2026).
 *
 * POR QUE ISTO EXISTE. O webhook da Hotmart/Stripe já denuncia a falha: grava o
 * motivo em `payment_events.error` e segue com HTTP 200. Só que NINGUÉM LÊ ESSA
 * COLUNA EM PRODUÇÃO — medido em 25/09, os únicos leitores são ferramentas
 * manuais em `_frank/`. O código acreditava o contrário: `sgp-boas-vindas.ts:774`
 * comenta "vira `payment_events.error`, que a varredura do #324 lê", e a
 * varredura do #324 é `_frank/ferramentas/varrer_erros_webhook.cjs` — que roda A
 * MÃO, e ninguém roda. O erro estar registrado não serve de nada se ninguém olha:
 * é a mesma doença do #324 (a mensagem ficou 7 HORAS muda em 09/09) um andar
 * acima, porque agora até o conserto de lá depende de alguém digitar um comando.
 *
 * Custo medido em 25/09: 4 pagantes sem conta nenhuma, o mais velho há 22 dias,
 * um deles com o entitlement vencendo NO DIA SEGUINTE.
 *
 * ── O QUE ESTE MÓDULO NÃO FAZ, e cada "não" é deliberado ────────────────────
 *  · NÃO cria conta, NÃO concede acesso, NÃO estorna, NÃO move crédito, NÃO
 *    manda e-mail ou zap pra ninguém e NÃO gasta GPU. Ele SÓ TORNA VISÍVEL.
 *    Conceder acesso (parte (a)) e estornar (parte (b)) do #582 são do Johnny —
 *    criar conta é PRODUÇÃO, e varredura não decide produção sozinha.
 *  · NÃO grava coluna nova, NÃO tem migration e NÃO guarda estado de "já
 *    varrido". A cadência é PELO RELÓGIO (ver o sweeper), e a janela inteira é
 *    relida a cada execução — é o que torna um tick perdido inofensivo.
 *  · NÃO despeja as linhas cruas. O ruído conhecido (reassinatura) é CONTADO e
 *    nunca abre cartão: uma fila que grita 79 linhas de ruído é ignorada na
 *    segunda semana, que é exatamente como o campo `error` morreu da primeira vez.
 *
 * A CLASSIFICAÇÃO É CÓPIA de `sqlDaVarredura()` do `.cjs`, prefixo por prefixo,
 * na MESMA ordem. Divergir aqui seria a mesma varredura dizendo duas coisas
 * diferentes dependendo de quem a roda — e a manual é a que o time já conhece.
 *
 * ⚠️ IMPORTS: `fetchAllPages` entra por caminho RELATIVO e o abridor de chamado
 * entra por `import()` LAZY. Não é estilo, é o que mantém este arquivo carregável
 * pelo runner nativo do Node (`node --test`), que não resolve o alias `@/` sem
 * loader — é a razão dos `ERR_MODULE_NOT_FOUND` conhecidos da casa. `paginate.ts`
 * não importa nada, então entra estático; `reportar.ts` puxa `@/lib/db/admin` e
 * puxaria a cadeia inteira só pra classificar uma string. Assim os testes rodam
 * o fluxo INTEIRO com um abridor falso, sem flag e sem banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types.ts";
import type { ChamadoReportado } from "../incidents/reportar.ts";
import { fetchAllPages } from "../db/paginate.ts";

/** Janela de leitura, igual ao padrão do `.cjs`. Relida INTEIRA a cada execução. */
export const JANELA_DIAS = 7;

/**
 * Teto de cartões por execução.
 *
 * ⚠️ O que o teto deixou pra trás SAI NO SUMÁRIO (`cortados_pelo_teto`,
 * `cortados_por_classe`) E NO LOG. Teto silencioso se lê como "cobri tudo" e
 * mente: a varredura diria "20 abertos" e quem lesse concluiria que só havia 20.
 * A próxima execução tenta de novo, porque a janela é relida por inteiro.
 */
export const TETO_CHAMADOS_POR_EXECUCAO = 20;

/** Prefixo do `error` que define a FAMÍLIA do `desconhecido`. */
const TAMANHO_CHAVE_FAMILIA = 60;

/**
 * Blocos do `.in("buyer_email", …)` da 2ª consulta. A URL do PostgREST vai no
 * GET: lista de e-mail sem bloco vira URL gigante e o servidor recusa.
 */
const BLOCO_EMAILS = 500;

export type ClasseErroWebhook =
  | "orfa_paga_calada"
  | "sgp_nao_recebeu"
  | "sgp_sem_conta"
  | "compra_orfa"
  | "revoke_sem_dono"
  | "revoke_sem_id"
  | "desconhecido";

/**
 * Cancelamento de código antigo cujo comprador TEM assinatura ativa e viva =
 * troca de plano / reassinatura. Ruído conhecido: 79 dos 84 erros da janela de
 * 30 dias medida em 09/09 eram disto, e 18 de 19 tinham o entitlement ativo
 * criado NO MESMO DIA do cancelamento. CONTA, e NUNCA abre cartão.
 */
export const CLASSE_RUIDO = "revoke_reassinatura" as const;

export type Classificacao = ClasseErroWebhook | typeof CLASSE_RUIDO;

/** Gravidade — mesma `ordem` do `CLASSES` do `.cjs`. Manda no corte do teto. */
const ORDEM: Record<ClasseErroWebhook, number> = {
  orfa_paga_calada: 0,
  sgp_nao_recebeu: 1,
  sgp_sem_conta: 2,
  compra_orfa: 3,
  revoke_sem_dono: 4,
  revoke_sem_id: 5,
  desconhecido: 6,
};

/**
 * `titulo` e `acao` copiados do `CLASSES` do `.cjs`. `acao` é o que a pessoa faz
 * AO VER o cartão — escrito pra quem atende, não pra quem lê código.
 */
const TEXTOS: Record<ClasseErroWebhook, { titulo: string; acao: string }> = {
  orfa_paga_calada: {
    titulo: "COMPRA ÓRFÃ PAGA E O AVISO FOI CALADO — a pessoa não tem conta nenhuma",
    acao:
      "O dinheiro entrou, não existe conta ligada ao pagamento e o aviso foi " +
      "silenciado (ja_avisado / sem canal). Confirme que pagou de verdade com " +
      "`pagou_de_verdade.cjs` (trial de R$0 NÃO conta) e, se pagou, leve pro " +
      "Johnny: criar conta é produção. ⚠️ Olhe o access_until — se estiver " +
      "perto de vencer, ele vence com a pessoa sem nunca ter entrado (caso #207).",
  },
  sgp_nao_recebeu: {
    titulo: "COMPRADOR DO SGP PAGOU E NÃO RECEBEU O E-MAIL",
    acao:
      "É o e-mail que leva o link de definir senha — sem ele a pessoa não entra. " +
      "Gere um link novo e reenvie as boas-vindas. Confira o Enviados antes, " +
      "pra não mandar em dobro.",
  },
  sgp_sem_conta: {
    titulo: "CONTA DO COMPRADOR DO SGP NÃO FOI CRIADA",
    acao:
      "A pessoa pagou e não tem conta. Crie a conta pelo painel e mande o link " +
      "de definir senha.",
  },
  compra_orfa: {
    titulo: "COMPRA ÓRFÃ SEM AVISO",
    acao:
      "Pagamento entrou sem conta ligada e o aviso não saiu por canal nenhum. " +
      "Siga o playbook de compra órfã (achar o entitlement pelo e-mail da compra).",
  },
  revoke_sem_dono: {
    titulo: "CANCELAMENTO SEM DONO — e o comprador NÃO tem assinatura viva",
    acao:
      "Cancelamento que não achou a assinatura, e a pessoa não tem outra ativa. " +
      "Normalmente é compra que nunca chegou a ser aprovada (nada a fazer), mas " +
      "confira se ela não está usando o produto sem pagar.",
  },
  revoke_sem_id: {
    titulo: "CANCELAMENTO COM externalId NÃO EXTRAÍDO DO PAYLOAD",
    acao: "Defeito de leitura do payload. Vai pro time técnico, não tem ação de atendimento.",
  },
  desconhecido: {
    titulo: "ERRO DO WEBHOOK QUE ESTA VARREDURA NÃO SABE CLASSIFICAR",
    acao:
      "Família de erro nova (ou a redação mudou). Leia a mensagem e, se virar " +
      "rotina, acrescente a classe AQUI e em `varrer_erros_webhook.cjs`, pra as " +
      "duas não divergirem.",
  },
};

/**
 * AS ARMADILHAS MEDIDAS. Vão no corpo de TODO cartão porque sem elas o cartão
 * FABRICA VÍTIMA: cada uma destas três frases corresponde a um lote de gente
 * que já foi tratada como lesada sem ser.
 */
const ARMADILHAS = [
  "Confirme que pagou de verdade com `_frank/ferramentas/pagou_de_verdade.cjs` — " +
    "assinatura de R$0 é TRIAL e NÃO conta como compra paga (classe do #333).",
  "access_until vivo NÃO prova que a pessoa entrou: o webhook cria o direito no " +
    "ato do pagamento, inclusive pra quem nunca recebeu senha (foi assim que " +
    "nasceram os 147 falsos de 18/08).",
  "last_sign_in_at NÃO serve pra comprador de SGP: o caminho do SGP é o wizard " +
    "/sgp com verificação de e-mail, não login de plataforma (4 falsos positivos " +
    "medidos em 25/09).",
];

/** A armadilha que só a classe mais grave carrega (o relógio corre contra ela). */
const ARMADILHA_ORFA_PAGA_CALADA =
  "⚠️ Olhe o access_until: se estiver perto de vencer, ele vence com a pessoa " +
  "nunca tendo entrado (caso #207). Criar conta é PRODUÇÃO: leve ao Johnny.";

/**
 * Classifica UM `payment_events.error`. Espelho de `sqlDaVarredura()` do `.cjs`:
 * mesmos prefixos (`like 'x%'` = `startsWith`) e MESMA ORDEM de avaliação.
 *
 * A fronteira que importa é `externalId não casa`: com assinatura viva é
 * reassinatura (ruído), sem ela é cancelamento sem dono (acionável). Trocar a
 * ordem destes dois transformaria o ruído de 79 linhas em fila de trabalho.
 */
export function classificarErro(error: string, temAssinaturaViva: boolean): Classificacao {
  if (
    error.startsWith("boas-vindas do SGP não saíram") ||
    error.startsWith("boas-vindas do SGP desistiram") ||
    error.startsWith("boas-vindas do SGP falharam")
  ) {
    return "sgp_nao_recebeu";
  }
  if (error.startsWith("conta do SGP não criada")) return "sgp_sem_conta";
  if (error.startsWith("compra órfã paga sem aviso novo")) return "orfa_paga_calada";
  if (error.startsWith("compra órfã sem canal de aviso")) return "compra_orfa";
  if (error.startsWith("externalId não extraído")) return "revoke_sem_id";
  if (error.startsWith("externalId não casa")) {
    return temAssinaturaViva ? CLASSE_RUIDO : "revoke_sem_dono";
  }
  return "desconhecido";
}

/**
 * A chave de FAMÍLIA do `desconhecido`: prefixo, minúsculo, dígitos viram `#`.
 *
 * Por que família e não pessoa: `desconhecido` é o balde do que a varredura não
 * sabe ler. Um cartão por pessoa ali inundaria a fila com a MESMA notícia ("a
 * redação mudou") repetida N vezes — e foi fila inundada que matou a leitura
 * deste campo antes. Dígito vira `#` porque id/valor/contador dentro da
 * mensagem é o que faz duas linhas idênticas parecerem famílias diferentes.
 */
export function chaveDaFamilia(error: string): string {
  return error.slice(0, TAMANHO_CHAVE_FAMILIA).toLowerCase().replace(/[0-9]/g, "#");
}

/**
 * O texto do cartão. `acao` do `.cjs` + as armadilhas medidas, nessa ordem:
 * quem abre o cartão lê primeiro o que fazer, e as armadilhas antes de agir.
 */
export function montarTexto(
  classe: ClasseErroWebhook,
  emails: string[],
  sampleError: string,
  maisAntigo: string | null,
): { title: string; description: string } {
  const meta = TEXTOS[classe];
  const armadilhas = [...ARMADILHAS];
  if (classe === "orfa_paga_calada") armadilhas.push(ARMADILHA_ORFA_PAGA_CALADA);

  const quem = emails.length === 1 ? emails[0] : null;
  const title = quem ? `${meta.titulo} — ${quem}` : meta.titulo;

  const description = [
    `O QUE FAZER: ${meta.acao}`,
    "",
    "ARMADILHAS MEDIDAS — leia ANTES de concluir que a pessoa foi lesada:",
    ...armadilhas.map((a) => `· ${a}`),
    "",
    emails.length
      ? `E-MAIL(S) DA COMPRA: ${emails.join(", ")}`
      : "E-MAIL DA COMPRA: o evento veio sem buyer_email.",
    maisAntigo ? `ERRO MAIS ANTIGO DESTE CARTÃO: ${maisAntigo}` : null,
    "",
    `MENSAGEM CRUA MAIS RECENTE DO WEBHOOK:\n${sampleError}`,
    "",
    "Aberto por `varredura-erros-webhook.ts` (#582c), que SÓ LÊ " +
      "`payment_events.error`: ela não criou conta, não concedeu acesso, não " +
      "estornou e não escreveu pra ninguém. A mesma leitura à mão é " +
      "`_frank/ferramentas/varrer_erros_webhook.cjs`.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return { title, description };
}

export type VarreduraWebhookSumario = {
  janela_dias: number;
  /** Linhas com `error is not null` na janela, ruído incluído. */
  total: number;
  /** Contagem por classe, com `revoke_reassinatura` junto. */
  por_classe: Record<string, number>;
  /** Ruído conhecido de reassinatura. Nunca virou cartão, por definição. */
  ruido: number;
  /** Grupos (classe+pessoa, ou família do `desconhecido`) que pediriam cartão. */
  grupos_elegiveis: number;
  /** Cartões abertos ou somados de fato nesta execução (≤ teto). */
  chamados_abertos: number;
  /** Grupos que ficaram pra próxima execução por causa do teto. */
  cortados_pelo_teto: number;
  /** Quantos grupos o teto cortou, por classe. Vazio quando não cortou nada. */
  cortados_por_classe: Record<string, number>;
  /**
   * Linhas de classe nomeada SEM `buyer_email`: não dá pra assinar um cartão
   * por pessoa sem pessoa. Ficam contadas aqui em vez de desaparecerem — sumir
   * em silêncio é o defeito que esta varredura veio consertar.
   */
  sem_email_ignorados: number;
  /** Falhas ao gravar cartão. A próxima execução tenta de novo. */
  erros: number;
};

/**
 * As portas de fora. Existem pro teste rodar o fluxo INTEIRO sem banco e sem
 * abrir chamado de verdade — mesma ideia dos canais falsos de `sgp-boas-vindas`.
 */
export type PortasVarredura = {
  abrirChamado?: (c: ChamadoReportado) => Promise<number | null>;
  /** Relógio injetável: a janela e o "assinatura viva" comparam com ele. */
  agora?: number;
};

type LinhaPaymentEvent = { buyer_email: string | null; error: string | null; received_at: string };
type LinhaEntitlement = { buyer_email: string | null; access_until: string | null };

/** Do builder do PostgREST só `data`/`error` interessam ao `fetchAllPages`. */
type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function abrirDeVerdade(c: ChamadoReportado): Promise<number | null> {
  const { abrirChamadoReportado } = await import("@/lib/incidents/reportar");
  return abrirChamadoReportado(c);
}

type Grupo = {
  classe: ClasseErroWebhook;
  signature: string;
  emails: string[];
  sampleError: string;
  maisAntigo: string;
  maisRecente: string;
};

/**
 * A VARREDURA.
 *
 * ⚠️ ELA LANÇA quando a consulta falha, de propósito, e isso é o oposto do que
 * um sweep "tolerante" faria. Consulta quebrada que degrada pra lista vazia é
 * literalmente o incidente 72a4c9db: a guarda viu 0 linha, concluiu "ninguém tem
 * conta" e mandou "crie sua conta" pra 105 clientes ATIVOS. Aqui a mentira seria
 * mais barata e mais perigosa — "nenhum erro na janela" é a frase que fez esta
 * coluna morrer. Quem chama é que decide não derrubar o resto (ver o envelope
 * best-effort no sweeper).
 */
export async function varrerErrosDoWebhook(
  admin: SupabaseClient<Database>,
  portas: PortasVarredura = {},
): Promise<VarreduraWebhookSumario> {
  const abrirChamado = portas.abrirChamado ?? abrirDeVerdade;
  const agora = portas.agora ?? Date.now();
  const desde = new Date(agora - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();

  // PAGINADO com ordem estável (`id`): o PostgREST corta `.select()` sem
  // `.range()` em 1000 linhas EM SILÊNCIO, e esta leitura alimenta agregação.
  const linhas = await fetchAllPages<LinhaPaymentEvent>(
    "payment_events com erro",
    (from, to) =>
      admin
        .from("payment_events")
        .select("buyer_email, error, received_at")
        .not("error", "is", null)
        .gt("received_at", desde)
        .order("id", { ascending: true })
        .range(from, to) as unknown as Pagina<LinhaPaymentEvent>,
  );

  const comErro = linhas.filter((l): l is LinhaPaymentEvent & { error: string } => !!l.error);

  /**
   * 2ª consulta: quem TEM assinatura ativa e viva, pelos `buyer_email`
   * DISTINTOS da janela (só destes a pergunta importa). Paginada também.
   *
   * ⚠️ O `.in()` vai com o e-mail COMO ESTÁ no evento, não em minúsculo: o
   * `.cjs` casa `en.buyer_email = e.buyer_email` no banco, e o PostgREST também
   * compara byte a byte. Perguntar em minúsculo por um endereço gravado com
   * maiúscula não acha o entitlement — e não achar aqui promove ruído de
   * reassinatura a "cancelamento sem dono", ou seja FABRICA cartão. O índice em
   * memória é que fica em minúsculo, pra casar com o agrupamento por pessoa.
   */
  const emailsDoEvento = [...new Set(comErro.map((l) => l.buyer_email ?? "").filter(Boolean))];
  const vivos = new Set<string>();
  for (let i = 0; i < emailsDoEvento.length; i += BLOCO_EMAILS) {
    const bloco = emailsDoEvento.slice(i, i + BLOCO_EMAILS);
    const rows = await fetchAllPages<LinhaEntitlement>(
      `entitlements ativos (bloco ${i / BLOCO_EMAILS})`,
      (from, to) =>
        admin
          .from("entitlements")
          .select("buyer_email, access_until")
          .in("buyer_email", bloco)
          .eq("status", "active")
          .order("id", { ascending: true })
          .range(from, to) as unknown as Pagina<LinhaEntitlement>,
    );
    for (const r of rows) {
      const email = (r.buyer_email ?? "").toLowerCase();
      if (!email) continue;
      // `access_until is null` = vitalício, e vitalício é vivo.
      if (!r.access_until || new Date(r.access_until).getTime() > agora) vivos.add(email);
    }
  }

  const classificados = comErro.map((l) => {
    const email = (l.buyer_email ?? "").toLowerCase();
    return {
      email,
      error: l.error,
      received_at: l.received_at,
      classe: classificarErro(l.error, vivos.has(email)),
    };
  });

  const porClasse: Record<string, number> = {};
  for (const c of classificados) porClasse[c.classe] = (porClasse[c.classe] ?? 0) + 1;

  // RUÍDO sai da fila AQUI. Ele só existe no `por_classe`/`ruido`.
  const acionaveis = classificados.filter(
    (c): c is typeof c & { classe: ClasseErroWebhook } => c.classe !== CLASSE_RUIDO,
  );

  const grupos = new Map<string, Grupo>();
  let semEmail = 0;

  for (const c of acionaveis) {
    const familia = c.classe === "desconhecido";
    if (!familia && !c.email) {
      semEmail += 1;
      continue;
    }
    const chave = familia
      ? `webhook-error:desconhecido:${chaveDaFamilia(c.error)}`
      : `webhook-error:${c.classe}:${c.email}`;

    let g = grupos.get(chave);
    if (!g) {
      g = {
        classe: c.classe,
        signature: chave,
        emails: [],
        sampleError: c.error,
        maisAntigo: c.received_at,
        maisRecente: c.received_at,
      };
      grupos.set(chave, g);
    }
    if (c.email && !g.emails.includes(c.email)) g.emails.push(c.email);
    // `sampleError` acompanha a ocorrência MAIS RECENTE: é a redação de agora
    // que diz se o defeito mudou. Vai CRUA — quem trunca aqui cega o cartão.
    if (c.received_at >= g.maisRecente) {
      g.maisRecente = c.received_at;
      g.sampleError = c.error;
    }
    if (c.received_at < g.maisAntigo) g.maisAntigo = c.received_at;
  }

  /**
   * Mais GRAVE primeiro; empatada a gravidade, mais VELHO primeiro. A ordem é o
   * que dá sentido ao teto: se ele tem que cortar, corta o menos grave e o mais
   * novo. Quem espera há 22 dias sem conta não pode ficar atrás de um defeito de
   * parsing de payload.
   */
  const ordenados = [...grupos.values()].sort(
    (a, b) => ORDEM[a.classe] - ORDEM[b.classe] || a.maisAntigo.localeCompare(b.maisAntigo),
  );
  const dentro = ordenados.slice(0, TETO_CHAMADOS_POR_EXECUCAO);
  const cortados = ordenados.slice(TETO_CHAMADOS_POR_EXECUCAO);

  let chamadosAbertos = 0;
  let erros = 0;
  for (const g of dentro) {
    const { title, description } = montarTexto(g.classe, g.emails, g.sampleError, g.maisAntigo);
    try {
      /**
       * Idempotente por `signature`: a MESMA pessoa com a MESMA classe soma
       * ocorrência no cartão que já existe em vez de abrir um segundo, e reabre
       * se alguém tinha fechado. É o que deixa esta varredura rodar de hora em
       * hora relendo 7 dias sem virar máquina de cartão repetido.
       */
      const numero = await abrirChamado({
        signature: g.signature,
        title,
        description,
        reportedBy: "varredura-webhook",
        // "tecnico" nas sete classes: em todas existe ação NOSSA (reenviar o
        // link, criar a conta, consertar o parsing). Nenhuma é dúvida de aluno.
        categoria: "tecnico",
        kind: "webhook_error",
        cause: g.classe,
        affectedEmails: g.emails,
        sampleError: g.sampleError,
      });
      if (numero != null) chamadosAbertos += 1;
    } catch (e) {
      // Um cartão que não gravou não pode esconder os outros 19.
      erros += 1;
      console.error(
        `[varredura-webhook] falhei em abrir ${g.signature}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  const cortadosPorClasse: Record<string, number> = {};
  for (const g of cortados) cortadosPorClasse[g.classe] = (cortadosPorClasse[g.classe] ?? 0) + 1;
  if (cortados.length > 0) {
    console.error(
      `[varredura-webhook] teto de ${TETO_CHAMADOS_POR_EXECUCAO} batido: ` +
        `${cortados.length} grupo(s) NÃO viraram cartão nesta execução ` +
        `(${Object.entries(cortadosPorClasse)
          .map(([classe, n]) => `${classe}: ${n}`)
          .join(", ")}). A próxima execução relê a janela inteira e tenta de novo.`,
    );
  }

  return {
    janela_dias: JANELA_DIAS,
    total: comErro.length,
    por_classe: porClasse,
    ruido: porClasse[CLASSE_RUIDO] ?? 0,
    grupos_elegiveis: ordenados.length,
    chamados_abertos: chamadosAbertos,
    cortados_pelo_teto: cortados.length,
    cortados_por_classe: cortadosPorClasse,
    sem_email_ignorados: semEmail,
    erros,
  };
}
