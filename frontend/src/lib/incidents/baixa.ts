/**
 * A BAIXA do chamado — as duas coisas que hoje estão coladas no painel de
 * Falhas e que o pedido do Lucas (04/09) manda separar.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * O time olha 24 chamados não-fechados e não consegue fechar nenhum: o único
 * botão de baixa é "Marcar corrigido". Só que "corrigido" quer dizer O DEFEITO
 * ACABOU, e na maioria desses casos o defeito está VIVO — o que terminou foi a
 * parte humana (alguém falou com o aluno).
 *
 * Medição de 04/09 nos 24 não-fechados, que é o motivo da trava existir:
 *   #234 palavra decapitada no áudio — 609 ocorrências, 10 alunos
 *   #226 áudio que o nosso próprio QA reprovou — 290 ocorrências
 *   #254 cobrança em dobro — 7 alunos pagando 2×, dinheiro saindo agora
 * Se o time clicar "resolvido" nesses três porque o aluno foi respondido, a
 * dívida técnica que afeta centenas de alunos some do quadro e ninguém
 * descobre. É exatamente o que a regra da casa proíbe: nunca marcar como
 * resolvido o que não foi resolvido.
 *
 * Então:
 *   ALUNO RESPONDIDO → a parte humana está feita. Qualquer um do time marca.
 *                      Não muda status, não fecha nada, não esconde o defeito.
 *   RESOLVIDO        → o defeito acabou. Bloqueado enquanto o defeito estiver
 *                      medivelmente vivo (ver `defeitoVivo`).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ONDE A BAIXA FICA GRAVADA, e por que não é coluna nova: em `agent_notes`
 * (jsonb, já existe), como uma nota com `tipo`. Isso mantém o pedido SEM
 * migration — regra do Johnny: migration se propõe, não se aplica — e de
 * quebra a baixa nasce auditável, porque toda nota já carrega `at` e `by`.
 * Quem lê `agent_notes` hoje (painel, _Bugs/*.cjs, rondas) usa `note`/`by`/
 * `at`; a chave `tipo` a mais é ignorada por todos eles.
 */

/** Uma linha de `incidents.agent_notes`. `tipo` só existe nas notas de baixa. */
export type NotaIncidente = {
  at: string;
  by: string;
  note: string;
  tipo?: string;
};

export const TIPO_ALUNO_RESPONDIDO = "aluno_respondido";
/** O desfazer de um clique errado. Ver `alunoRespondido`. */
export const TIPO_ALUNO_RESPONDIDO_DESFEITO = "aluno_respondido_desfeito";

/**
 * As duas réguas do "defeito vivo" (números sugeridos pelo Lucas no pedido).
 *
 * São um OU, e os dois lados pegam caso que o outro deixa passar: o #226 tem
 * 290 ocorrências e UM aluno só (pega pela ocorrência); o #254 tem 5
 * ocorrências e 7 alunos pagando duas vezes (pega pelo número de alunos).
 * Com uma régua só, um dos dois escaparia.
 */
export const LIMITE_OCORRENCIAS = 50;
export const LIMITE_ALUNOS = 5;

export type IncidenteParaBaixa = {
  occurrences?: number | null;
  affected_emails?: readonly string[] | null;
  agent_notes?: readonly NotaIncidente[] | null;
};

function ocorrencias(inc: IncidenteParaBaixa): number {
  return typeof inc.occurrences === "number" ? inc.occurrences : 0;
}

function alunos(inc: IncidenteParaBaixa): number {
  return Array.isArray(inc.affected_emails) ? inc.affected_emails.length : 0;
}

function notas(inc: IncidenteParaBaixa): readonly NotaIncidente[] {
  return Array.isArray(inc.agent_notes) ? inc.agent_notes : [];
}

/**
 * O defeito ainda está acontecendo em escala? Então "Resolvido" não é um
 * clique — é uma afirmação técnica, e ela não sai do painel de atendimento.
 *
 * Deliberadamente NÃO olha status nem categoria: um chamado pode estar em
 * `atendimento` e mesmo assim ser a ponta visível de um defeito de 609
 * ocorrências. O que decide é o tamanho do estrago medido.
 */
export function defeitoVivo(inc: IncidenteParaBaixa): boolean {
  return ocorrencias(inc) > LIMITE_OCORRENCIAS || alunos(inc) > LIMITE_ALUNOS;
}

/**
 * A explicação que vai NA TELA junto do botão desabilitado.
 *
 * O botão fica visível e desabilitado, com o porquê escrito — não escondido.
 * Time que não entende por que não pode, contorna: manda e-mail, mexe no banco,
 * ou marca outra coisa errada. `null` quando não há trava.
 */
export function motivoDefeitoVivo(inc: IncidenteParaBaixa): string | null {
  if (!defeitoVivo(inc)) return null;
  const partes: string[] = [];
  if (ocorrencias(inc) > LIMITE_OCORRENCIAS) partes.push(`${ocorrencias(inc)} ocorrências`);
  if (alunos(inc) > LIMITE_ALUNOS) partes.push(`${alunos(inc)} alunos afetados`);
  return (
    `Este defeito ainda está acontecendo (${partes.join(" e ")}). ` +
    `Marque "Aluno respondido" — o conserto técnico é separado e fica com o time de código.`
  );
}

/** Data/hora em pt-BR no fuso de São Paulo — o fuso em que o time trabalha. */
function quando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // O `toLocaleString` do pt-BR mete uma vírgula entre data e hora ("04/09/2026,
  // 15:30"). Vira "às" porque a nota é lida por gente, não por parser.
  return d
    .toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(", ", " às ");
}

/**
 * A baixa vale? Lê a ÚLTIMA nota de baixa do chamado.
 *
 * O desfazer não apaga a nota anterior — acrescenta uma nota de "desfeito".
 * Apagar linha de `agent_notes` seria destruir rastro, e baixa sem rastro é o
 * mesmo que não ter baixa. Por isso a resposta é "quem venceu por último".
 */
export function alunoRespondido(inc: IncidenteParaBaixa): { at: string; by: string } | null {
  for (let i = notas(inc).length - 1; i >= 0; i--) {
    const n = notas(inc)[i];
    if (n?.tipo === TIPO_ALUNO_RESPONDIDO) return { at: n.at, by: n.by };
    if (n?.tipo === TIPO_ALUNO_RESPONDIDO_DESFEITO) return null;
  }
  return null;
}

/**
 * A nota que a baixa grava no chamado, no formato da casa: "O QUE FAZER"
 * primeiro, em português de gente, porque quem lê é o atendente e não o
 * programador.
 */
export function notaAlunoRespondido(args: {
  by: string;
  at: string;
  observacao?: string | null;
}): NotaIncidente {
  const obs = args.observacao?.trim();
  const linhas = [
    "=== O QUE FAZER ===",
    `Nada com o aluno por enquanto: ${args.by} registrou em ${quando(args.at)} que o aluno JÁ FOI RESPONDIDO.`,
    "Se ele voltar a falar, o chamado reaparece sozinho na fila — ninguém precisa vigiar.",
    'NÃO marque este chamado como "Resolvido" por causa desta baixa: responder o aluno e consertar o defeito são duas coisas diferentes.',
    obs ? `Anotação de quem deu a baixa: ${obs}` : null,
  ].filter((l): l is string => l !== null);
  return { at: args.at, by: args.by, note: linhas.join("\n"), tipo: TIPO_ALUNO_RESPONDIDO };
}

/** A nota do desfazer — mesmo formato, mesma razão de existir. */
export function notaAlunoRespondidoDesfeito(args: { by: string; at: string }): NotaIncidente {
  const linhas = [
    "=== O QUE FAZER ===",
    `A baixa "aluno respondido" foi DESFEITA por ${args.by} em ${quando(args.at)}.`,
    "O chamado voltou pra fila de atendimento: alguém ainda precisa falar com o aluno.",
  ];
  return {
    at: args.at,
    by: args.by,
    note: linhas.join("\n"),
    tipo: TIPO_ALUNO_RESPONDIDO_DESFEITO,
  };
}
