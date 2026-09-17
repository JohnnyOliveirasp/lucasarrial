/**
 * O que a gente FAZ com um bounce. Server-only.
 *
 * A DECISÃO (classe, assinatura, fila, texto do chamado) é pura e vive em
 * `mail-bounce.ts` — `planoDoBounce()`. Este arquivo só EXECUTA o plano contra
 * o banco. A divisão é deliberada: a parte que erra em silêncio é a
 * classificação, e ela precisa ser testável sem Supabase.
 *
 * A REGRA QUE ESTE ARQUIVO EXISTE PRA CUMPRIR (#201): **e-mail que voltou não
 * é e-mail respondido**. Hoje o caso do aluno é dado como atendido no instante
 * em que o SMTP devolve 250 — que só quer dizer "aceitei pra entrega". Quando
 * o bounce chega minutos depois, o chamado já fechou e a fila mente. Então
 * bounce faz DUAS coisas, sempre nesta ordem:
 *
 *   1. REABRE o que foi dado como resolvido para aquele aluno (`fixed`,
 *      `aguardando_aluno`) — é o desfazer do fechamento errado.
 *   2. ABRE um chamado próprio da entrega que falhou, mesmo que não existisse
 *      chamado nenhum antes (o e-mail podia ser iniciativa nossa, como foi o
 *      do Tulio). Sem isso, aluno sem chamado prévio seguiria invisível.
 *
 * ⚠️ NÃO manda mensagem pra ninguém (nem grupo, nem WhatsApp, nem e-mail).
 * Bounce vira REGISTRO na fila; quem avisa alguém decide isso lendo o quadro.
 * Um detector automático que escreve pro mundo é como o mesmo aluno levaria
 * três avisos do mesmo problema.
 */
import { getAdmin } from "@/lib/db/admin";
import { limparFechamento } from "@/lib/incidents/closure";
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
import { parseBounce, planoDoBounce, type AcaoDeBounce, type Bounce } from "./mail-bounce";
import { lerHistoricoDeContato } from "./contato-ficha";
import { refinarPorDns } from "./mail-bounce-dns";
import { notaDeObsoleto, veredictoDoCadastro } from "./mail-bounce-cadastro";
import { marcarNaoEntregue } from "./mail-envio-registro";

/**
 * Status que significam "esse aluno já está atendido". São exatamente os que
 * um bounce desmente — por isso são os únicos que ele reabre.
 *
 * `ignored` fica FORA de propósito: alguém decidiu na mão que aquilo não era
 * caso, e um bounce não é motivo pra desfazer decisão humana.
 */
const STATUS_QUE_O_BOUNCE_DESMENTE = ["fixed", "aguardando_aluno"];

/**
 * Endereços NOSSOS: cópia oculta de admin, revisores e os domínios da casa.
 * Um bounce que pegou só estes não é silêncio de aluno (armadilha 3 do
 * mail-bounce.ts). Item começando com "@" casa domínio; o resto casa exato.
 */
export function enderecosInternos(): string[] {
  const dominioDoSuporte = (process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com").split("@")[1];
  const lista = (v: string | undefined): string[] =>
    (v || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return [
    ...new Set([
      `@${dominioDoSuporte}`,
      "@fastcloner.com",
      "@lucasarrial.com",
      "johnny.oliveirasp@gmail.com",
      "lucas.m.arrial@gmail.com",
      ...lista(process.env.AGENT_VIDEO_REVIEW_EMAILS),
      ...lista(process.env.AGENT_MAIL_INTERNAL),
    ]),
  ];
}

export type ResultadoBounce = {
  /** "falha" tratada ou "atraso" ignorado de propósito. */
  tipo: "falha" | "atraso";
  /** Alunos que ficaram sem a resposta. */
  alunos: string[];
  /** Chamados reabertos por causa disto. */
  reabertos: number[];
  /** Chamados abertos/somados para a entrega que falhou. */
  chamados: number[];
  /**
   * Endereços que quicaram e que NÃO são mais cadastro de ninguém — o chamado
   * deles nasceu marcado como obsoleto. Contado em vez de só marcado: se este
   * número crescer, o problema não é o bounce, é o cadastro deixando endereço
   * morto pra trás, e é melhor saber por um número do que por um chamado
   * fantasma virando ordem de "corrigir o cadastro" (foi o #440).
   */
  obsoletos: string[];
  /** Só a cópia interna falhou — sinal nosso, sem vítima do lado do aluno. */
  soInterno: boolean;
  /** Envios que o bounce conseguiu carimbar como não-entregues (casou o Message-ID). */
  enviosMarcados: number;
  /**
   * Bounces cujo envio NÃO estava registrado — mensagem anterior à tabela, ou
   * saída por um caminho que não passa pelo `sendSupportMail`. Contado em vez
   * de ignorado: se este número não cair com o tempo, o laço tem um furo e é
   * melhor saber disso por um número do que por um aluno reclamando.
   */
  enviosNaoRegistrados: number;
};

/**
 * Reabre o que estava dado como resolvido para este aluno.
 *
 * Espelha `reabrirPorRespostaDoAluno` (incidents/espera.ts) de propósito: é a
 * mesma ideia — chegou informação nova que desmente o fechamento — com o
 * gatilho oposto. Lá o aluno falou; aqui a gente descobriu que ele NUNCA
 * ouviu. Nunca lança: registro não pode derrubar a varredura.
 */
async function reabrirPorBounce(email: string, motivo: string): Promise<number[]> {
  try {
    const admin = getAdmin();
    const { data } = await admin
      .from("incidents" as never)
      .select("id, numero, agent_notes")
      .in("status", STATUS_QUE_O_BOUNCE_DESMENTE)
      .contains("affected_emails", [email]);

    const linhas = (data ?? []) as unknown as Array<{
      id: string;
      numero: number | null;
      agent_notes: Array<{ at: string; by: string; note: string }> | null;
    }>;
    if (!linhas.length) return [];

    const agora = new Date().toISOString();
    const reabertos: number[] = [];
    for (const l of linhas) {
      // agent_notes é jsonb ARRAY: CONCATENAR no que já existe, nunca
      // sobrescrever — sobrescrever já destruiu 21 notas em 21/08.
      const nota = { at: agora, by: "sistema", note: `Reaberto: a resposta NÃO chegou no aluno. ${motivo}` };
      const { error } = await admin
        .from("incidents" as never)
        .update({
          status: "open",
          // Reabre linha que estava "fixed" (ver STATUS_QUE_O_BOUNCE_DESMENTE):
          // sem limpar, o chamado volta pra open carregando o carimbo do
          // fechamento que o bounce acabou de desmentir.
          ...limparFechamento(),
          last_seen_at: agora,
          agent_notes: [...(l.agent_notes ?? []), nota],
        } as never)
        .eq("id", l.id);
      if (!error && l.numero != null) reabertos.push(l.numero);
    }
    return reabertos;
  } catch (e) {
    console.error("[agent/bounce] falhou ao reabrir:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Grava o chamado de uma ação do plano.
 *
 * `obsoleto` faz o chamado NASCER marcado (ignored + nota), sem sumir: é o
 * caso do endereço que quicou e que não é mais o do cadastro. A medição, e o
 * que aquele caminho se proíbe (adivinhar o endereço substituto), estão em
 * `mail-bounce-cadastro.ts`.
 */
async function abrirChamadoDaAcao(
  a: AcaoDeBounce,
  emailsAfetados: string[],
  obsoleto?: { nota: string },
): Promise<number | null> {
  return abrirChamadoReportado({
    signature: a.signature,
    // A marca vai no TÍTULO porque é por ele que a fila é lida. Um chamado
    // fechado com a marca só na nota continua parecendo caso de verdade pra
    // quem bate o olho na lista.
    title: obsoleto ? `[endereço obsoleto] ${a.titulo}`.slice(0, 120) : a.titulo,
    description: obsoleto ? `${obsoleto.nota}\n\n---\n\n${a.descricao}` : a.descricao,
    reportedBy: "fast",
    categoria: a.categoria,
    affectedEmails: emailsAfetados,
    sampleError: a.diagnostico || null,
    ...(obsoleto ? { nasceIgnorado: true, notaDeFechamento: obsoleto.nota } : {}),
  });
}

/**
 * Executa o plano de um relatório de entrega já parseado.
 *
 * Best-effort por aluno: erro no registro de um não impede o registro dos
 * outros — num bounce de spam de saída todos caem juntos, e perder o resto por
 * causa do primeiro seria repetir o mesmo silêncio que este código conserta.
 */
export async function registrarBounce(bounce: Bounce): Promise<ResultadoBounce> {
  const agoraMs = Date.now();
  // Antes de decidir: se o relatório culpou a resolução de MX/DNS, PERGUNTA AO
  // DNS (#402). É a única etapa deste caminho que sai pra rede, e ela existe
  // porque julgar isso pela frase do provedor já falhou três vezes no mesmo
  // arquivo. Não lança e não consulta nada quando o bounce é de outra causa.
  // (relatório de ATRASO não vira caso nenhum — nem gasta consulta.)
  //
  // Roteamento (quem é aluno, quem é cópia interna) sai daqui já com o veredito
  // do DNS embutido; o plano final é remontado abaixo com o histórico de
  // contato, que é o que muda o PRÓXIMO PASSO da ficha.
  const medido = bounce.tipo === "atraso" ? bounce : await refinarPorDns(bounce);
  const plano = planoDoBounce(medido);
  const res: ResultadoBounce = {
    tipo: plano.tipo,
    alunos: [],
    reabertos: [],
    chamados: [],
    obsoletos: [],
    soInterno: false,
    enviosMarcados: 0,
    enviosNaoRegistrados: 0,
  };

  if (plano.tipo === "atraso") {
    // O servidor ainda vai tentar e o aluno provavelmente recebeu. Reabrir
    // aqui seria alarme falso — fica só o log.
    console.log(
      `[agent/bounce] ATRASO (não é falha) para ${bounce.destinatarios.map((d) => d.email).join(", ") || "?"} — nada a fazer`,
    );
    return res;
  }

  if (plano.interno) {
    res.soInterno = true;
    const numero = await abrirChamadoDaAcao(plano.interno, []);
    if (numero != null) res.chamados.push(numero);
    console.log(`[agent/bounce] só a cópia interna falhou (${plano.interno.email}) — chamado técnico da saída`);
    return res;
  }

  // CARIMBA ANTES DE LER O HISTÓRICO, e a ordem é o ponto: se lêssemos primeiro,
  // o envio que ACABOU de quicar ainda apareceria sem `bounce_em` e a ficha diria
  // "sem bounce — evidência de que entrou" sobre a mensagem que voltou agora.
  // Seria a mentira exatamente oposta à que este conserto veio matar.
  for (const a of plano.alunos) {
    try {
      // Carimba o ENVIO como não-entregue, casando pelo Message-ID que o
      // relatório devolve. É isto que torna respondível a pergunta que ninguém
      // conseguia responder — "quais alunos a gente acha que avisou e na
      // verdade não avisou" —, porque liga o que voltou ao que saiu.
      const marcado = await marcarNaoEntregue({
        messageId: bounce.messageIdOriginal,
        classe: a.classe,
        diagnostico: a.diagnostico,
      });
      if (marcado.achou) res.enviosMarcados += 1;
      else if (marcado.motivo === "envio-nao-registrado") res.enviosNaoRegistrados += 1;
    } catch (e) {
      console.error(`[agent/bounce] falhou ao carimbar ${a.email}:`, e instanceof Error ? e.message : e);
    }
  }

  // Agora sim: o histórico já enxerga este bounce, e a ficha nasce com as
  // TENTATIVAS e com o passo que corresponde a elas.
  const contato = await lerHistoricoDeContato(
    plano.alunos.map((a) => a.email),
    agoraMs,
  );
  // `medido`, NÃO `bounce`: o plano final tem que carregar o veredito do DNS.
  // Passar o bounce cru aqui jogaria fora a medição do #402 em silêncio — a
  // ficha voltaria a ser decidida pela frase do provedor, que é justo o que
  // este caminho existe pra não fazer. (Pegadinha da junção com o #283.)
  const planoComHistorico = planoDoBounce(medido, contato, agoraMs);

  for (const a of planoComHistorico.alunos) {
    res.alunos.push(a.email);
    try {
      /**
       * O endereço que quicou ainda é o do cadastro? (#440/#441, 17/09.)
       *
       * Só para ALUNO: a cópia interna (`plano.interno`, acima) NÃO passa por
       * aqui de propósito — `suporte@fastcloner.com` nunca vai constar em
       * `sgp_pedidos` nem em `profiles`, então a checagem diria "obsoleto" pra
       * TODO bounce interno e nasceria fechado o sinal de saída suja, que é
       * justamente o que ninguém mais veria.
       *
       * "nao-sei" cai no ramo normal junto com "vigente": na dúvida o chamado
       * nasce ABERTO, que é o comportamento de sempre.
       */
      const veredicto = await veredictoDoCadastro(a.email);
      const obsoleto = veredicto === "obsoleto" ? { nota: notaDeObsoleto(a.email, new Date().toISOString()) } : undefined;
      if (obsoleto) res.obsoletos.push(a.email);

      res.reabertos.push(...(await reabrirPorBounce(a.email, a.motivoReabertura)));
      const numero = await abrirChamadoDaAcao(a, [a.email], obsoleto);
      if (numero != null) res.chamados.push(numero);
    } catch (e) {
      console.error(`[agent/bounce] falhou ao registrar ${a.email}:`, e instanceof Error ? e.message : e);
    }
  }

  if (res.alunos.length) {
    console.log(
      `[agent/bounce] entrega falhou para ${res.alunos.join(", ")}` +
        `${res.reabertos.length ? ` · reabertos ${res.reabertos.map((n) => `#${n}`).join(", ")}` : ""}` +
        `${res.chamados.length ? ` · chamados ${res.chamados.map((n) => `#${n}`).join(", ")}` : ""}` +
        `${res.obsoletos.length ? ` · ${res.obsoletos.length} endereço(s) obsoleto(s) — chamado nasceu marcado` : ""}` +
        `${res.enviosMarcados ? ` · ${res.enviosMarcados} envio(s) carimbado(s) como não-entregue` : ""}` +
        `${res.enviosNaoRegistrados ? ` · ${res.enviosNaoRegistrados} bounce(s) sem envio registrado` : ""}`,
    );
  }
  return res;
}

/**
 * Atalho pro caminho da varredura: recebe o e-mail CRU, decide se é bounce e
 * trata. Devolve `null` quando NÃO é bounce (o chamador segue o fluxo normal).
 *
 * ⚠️ NUNCA LANÇA, e isso é a parte importante. Esta função roda ANTES de tudo
 * em `respondOne`, então uma exceção aqui (regex em mensagem malformada, banco
 * fora do ar) derrubaria o tratamento de UMA mensagem que nunca é marcada como
 * lida — e a varredura tentaria a mesma mensagem a cada 5 minutos, para
 * sempre, sem chegar nas seguintes. É exatamente assim que o e-mail de 33MB
 * deixou a Fast 2 dias muda em 08/08. Detector que trava a fila é pior que
 * detector que não existe: em vez de um aluno em silêncio, todos.
 *
 * Falhar aqui devolve `null` de propósito: o e-mail segue o fluxo normal (vai
 * cair no filtro de remetente de sistema e ser marcado como lido, que é o
 * comportamento de hoje) em vez de parar a fila inteira.
 */
export async function tratarSeForBounce(raw: string): Promise<ResultadoBounce | null> {
  try {
    const bounce = parseBounce(raw, enderecosInternos());
    if (!bounce) return null;
    return await registrarBounce(bounce);
  } catch (e) {
    console.error("[agent/bounce] falhou ao triar (segue o fluxo normal):", e instanceof Error ? e.message : e);
    return null;
  }
}
