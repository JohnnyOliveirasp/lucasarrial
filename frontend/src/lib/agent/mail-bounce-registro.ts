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
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
import { parseBounce, planoDoBounce, type AcaoDeBounce, type Bounce } from "./mail-bounce";

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
  /** Só a cópia interna falhou — sinal nosso, sem vítima do lado do aluno. */
  soInterno: boolean;
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
        .update({ status: "open", last_seen_at: agora, agent_notes: [...(l.agent_notes ?? []), nota] } as never)
        .eq("id", l.id);
      if (!error && l.numero != null) reabertos.push(l.numero);
    }
    return reabertos;
  } catch (e) {
    console.error("[agent/bounce] falhou ao reabrir:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Grava o chamado de uma ação do plano. */
async function abrirChamadoDaAcao(a: AcaoDeBounce, emailsAfetados: string[]): Promise<number | null> {
  return abrirChamadoReportado({
    signature: a.signature,
    title: a.titulo,
    description: a.descricao,
    reportedBy: "fast",
    categoria: a.categoria,
    affectedEmails: emailsAfetados,
    sampleError: a.diagnostico || null,
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
  const plano = planoDoBounce(bounce);
  const res: ResultadoBounce = { tipo: plano.tipo, alunos: [], reabertos: [], chamados: [], soInterno: false };

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

  for (const a of plano.alunos) {
    res.alunos.push(a.email);
    try {
      res.reabertos.push(...(await reabrirPorBounce(a.email, a.motivoReabertura)));
      const numero = await abrirChamadoDaAcao(a, [a.email]);
      if (numero != null) res.chamados.push(numero);
    } catch (e) {
      console.error(`[agent/bounce] falhou ao registrar ${a.email}:`, e instanceof Error ? e.message : e);
    }
  }

  if (res.alunos.length) {
    console.log(
      `[agent/bounce] entrega falhou para ${res.alunos.join(", ")}` +
        `${res.reabertos.length ? ` · reabertos ${res.reabertos.map((n) => `#${n}`).join(", ")}` : ""}` +
        `${res.chamados.length ? ` · chamados ${res.chamados.map((n) => `#${n}`).join(", ")}` : ""}`,
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
