/**
 * Chamado ABERTO POR GENTE (kind "reported") — a fila que o Frank varre.
 *
 * Existia só dentro de `mail-respond.ts`, privado, e por isso o WhatsApp
 * nunca abriu chamado nenhum: a Carol escalava, mandava zap pro técnico,
 * pausava a conversa… e o pedido morria ali. Quem escreveu o caminho do
 * e-mail não replicou no do zap — o mesmo tipo de metade que deixou o aviso
 * do grupo mudo (22/08).
 *
 * Idempotente pela `signature`: o mesmo pedido soma ocorrência em vez de
 * abrir chamado novo, e um pedido que volta depois de fechado REABRE.
 *
 * REABERTURA GRAVA RASTRO (incidente 4f328521, 26/09) — DOIS pontos cegos
 * que `ingest.ts` já tinha resolvido pro caminho de falha crua e este
 * caminho (relato de gente) nunca teve:
 *
 *   1. `agent_notes` não ganhava nota nenhuma na reabertura automática. Sem
 *      isso, `incidents` não tem `updated_at` (ver ./closure.ts) e um
 *      chamado reaberto por um novo relato fica indistinguível de chamado
 *      novo — quem pega a fila reinvestiga do zero um caso que já tinha
 *      diagnóstico.
 *   2. `incident_occurrences` só recebia linha de `ingest.ts` (falha
 *      detectada pelo sistema). Todo relato de GENTE — metade da fila —
 *      nunca deixava rastro ali, e "o livro" mentia por omissão.
 *
 * ⚠️ A nota daqui NÃO é cópia da de `ingest.ts` ("REINCIDÊNCIA: falha
 * voltou..."). O gatilho é outro: aqui não é uma falha do sistema que
 * repetiu, é um RELATO NOVO (`c.reportedBy`: fast/carol-grupo/carol-zap/
 * sgp/help/...) que apontou pra um chamado que já tinha sido dado como
 * resolvido. Nota que descreve o gatilho errado é pior que nota nenhuma —
 * mente pro próximo leitor sobre o que de fato aconteceu.
 *
 * ⚠️ ARMADILHA JÁ MEDIDA NESTA FAMÍLIA (ver 2026-09-22_esperando_johnny.cjs
 * e percepcao_travada.cjs): os dois leitores da fila do Johnny/percepção
 * trabalham em cima da ÚLTIMA nota de `agent_notes`. Empurrar uma nota de
 * sistema aqui SEM marcá-la como neutra enterraria a nota substantiva de
 * baixo e sumiria o cartão da varredura (a mesma doença do #554 e do
 * 02581255). O texto abaixo foi escolhido para casar com a regra NEUTRA
 * daquele arquivo — ver a entrada `REABERTURA:` em NOTA_NEUTRA lá.
 *
 * Server-only. As tabelas da mig 47 não estão nos types gerados → `as never`.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdmin } from "@/lib/db/admin";
import { assinaturaLegada } from "@/lib/agent/mail-incident";
import { CLOSED_STATUSES, closureFields, limparFechamento } from "./closure";
import { CONFLITO, inserirChamadoUnico } from "./gravar";

type AgentNote = { at: string; by: string; note: string };

/** Uma linha do livro de ocorrências (mig 47) — mesmo formato que `ingest.ts`
 *  já grava pra falha crua. `ref_id` não tem correspondente natural aqui (não
 *  existe uma linha de origem, é um RELATO); um uuid novo por chamada só
 *  precisa ser único o bastante pra não colidir com a chave primária
 *  (kind, ref_id) — não existe dedupe a fazer neste caminho, `signature` já
 *  faz esse trabalho antes de chegar aqui. */
function registrarOcorrencia(
  admin: SupabaseClient<never>,
  incidentId: string,
  c: Pick<ChamadoReportado, "kind" | "affectedEmails" | "sampleError">,
  now: string,
) {
  return admin.from("incident_occurrences" as never).insert({
    kind: c.kind ?? "reported",
    ref_id: randomUUID(),
    incident_id: incidentId,
    at: now,
    email: c.affectedEmails?.[0] ?? null,
    error: (c.sampleError ?? "").slice(0, 500) || null,
  } as never);
}

export type ChamadoReportado = {
  /** Dedupe. Precisa distinguir PEDIDOS, não canais: num grupo o chat é um só,
   *  então assinar pelo chat faria todo pedido virar o mesmo chamado eterno. */
  signature: string;
  title: string;
  description: string;
  /** Quem registrou: "fast" (e-mail), "carol-grupo", "carol-zap". */
  reportedBy: string;
  /** E-mails de alunos afetados, quando dá pra saber. No grupo costuma ser vazio. */
  affectedEmails?: string[];
  /** Trecho do que a pessoa escreveu — sem isso o chamado nasce cego. */
  sampleError?: string | null;
  /** Anexos (chaves no R2), separados por vírgula na coluna. */
  attachments?: string[];
  /**
   * Em qual FILA o chamado entra (mig 93).
   *   "tecnico"     → existe ação NOSSA que resolve: retreinar a voz, refazer
   *                   a imagem, reprocessar o material, corrigir o bug.
   *   "atendimento" → reclamação do produto, dúvida, pré-venda, espera de
   *                   resposta. Precisa de PESSOA falando com o aluno.
   * O padrão é "atendimento" porque esta função é a porta de quem RELATA —
   * quem abre por falha de sistema (burst-rule, sync) manda "tecnico".
   */
  categoria?: "tecnico" | "atendimento";
  /**
   * `kind`/`cause` do incidente. O padrão ("reported"/"reported") descreve a
   * porta: alguém RELATOU. Ambos são sobrescritíveis desde 15/09 porque o
   * treino de voz passou a abrir chamado daqui por falha NOSSA, e ele nasce
   * com a MESMA assinatura que `ingest.ts` daria àquela falha (errorSignature)
   * — de propósito, pra varredura somar ocorrência no chamado que já existe em
   * vez de abrir um segundo. Se o kind/cause também não viessem, o mesmo
   * incidente ficaria gravado como "relatado por gente" sob uma assinatura
   * `training:infra_gpu:…`, e o quadro passaria a mentir sobre a origem.
   * Campos de CRIAÇÃO: o caminho de dedupe não os toca (nem os outros).
   */
  kind?: string;
  cause?: string;
  /**
   * O chamado JÁ NASCE fechado como `ignored`, com `notaDeFechamento` dizendo
   * por quê. Mesma ideia do `rajadaNasceFechada` (support/failure-alert.ts):
   * o registro existe, tem número e é buscável — só não entra na fila de quem
   * trabalha, porque já se sabe que não há o que fazer ali.
   *
   * Usado pelo bounce de endereço obsoleto (17/09): o endereço que quicou não
   * é mais o do cadastro, então o caso é fantasma. NÃO suprime — marcar é o
   * pedido; sumir seria ficar cego pra entrega que falhou de verdade.
   *
   * ⚠️ Só vale na CRIAÇÃO. Num chamado que já existe isto não fecha nada — ver
   * o `reopened` abaixo, onde ele só impede a REABERTURA automática.
   */
  nasceIgnorado?: boolean;
  /** O porquê do `nasceIgnorado`. Nota genérica em chamado auto-fechado é o
   *  mesmo que não ter nota: quem lê depois não sabe se confia no fechamento. */
  notaDeFechamento?: string;
};

type ChamadoExistente = {
  id: string;
  numero: number | null;
  status: string;
  occurrences: number;
  affected_emails: string[];
  title: string | null;
  agent_notes: AgentNote[] | null;
};

/** Lista de status fechados no formato que o PostgREST espera no `.not(…,"in",…)`.
 *  Derivada de `CLOSED_STATUSES` pra não virar a sétima cópia da lista. */
const FECHADOS_PGRST = `(${[...CLOSED_STATUSES].map((s) => `"${s}"`).join(",")})`;

/**
 * Procura o chamado dono de uma assinatura. `apenasAberto` existe porque as
 * duas buscas têm regras DIFERENTES, e a diferença é o ponto:
 *
 *  · chave EXATA (false): inclui fechado de propósito — é assim que um pedido
 *    que volta depois de resolvido REABRE o chamado dele (ver `limparFechamento`
 *    logo abaixo). Comportamento antigo, intocado.
 *  · chave LEGADA (true): só chamado ABERTO. Ressuscitar um chamado fechado
 *    por uma chave que nem é mais a dele é outra coisa, e não foi pedido: se o
 *    legado está fechado, que nasça chamado novo.
 */
async function buscarPorAssinatura(
  admin: SupabaseClient<never>,
  signature: string,
  apenasAberto: boolean,
): Promise<ChamadoExistente | null> {
  let q = admin
    .from("incidents" as never)
    .select("id, numero, status, occurrences, affected_emails, title, agent_notes")
    .eq("signature", signature);
  if (apenasAberto) q = q.not("status", "in", FECHADOS_PGRST);
  const { data } = await q.order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  return (data as unknown as ChamadoExistente | null) ?? null;
}

/** Devolve o número curto do chamado (#85), que é como as pessoas se referem
 *  a ele. null se a gravação falhou. */
export async function abrirChamadoReportado(c: ChamadoReportado): Promise<number | null> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  let existing = await buscarPorAssinatura(admin, c.signature, false);

  /**
   * FALLBACK DE LEITURA PRA CHAVE LEGADA (#410, 15/09).
   *
   * O conserto do dedupe por queixa (#23) mudou a assinatura do e-mail de
   * `fast-email:{canal}:{email}` pra `fast-email:{canal}:{classe}:{email}` e
   * subiu sem cuidar do que já estava gravado. Como esta busca casa por
   * igualdade EXATA, chamado aberto sob a chave velha nunca mais somava
   * ocorrência: a queixa seguinte do mesmo aluno procurava a chave nova, não
   * achava, e nascia chamado novo com o histórico rachado em dois. Medido em
   * 15/09: 23 abertos na chave velha contra 2 na nova, e o racha já consumado
   * no #408/#356 (o reembolso da Maria Teresa).
   *
   * A cura é aqui e não no banco: uma migration teria que ADIVINHAR
   * retroativamente a classe de 23 chamados, e classe inventada é pior que
   * chave velha. Assim cada chamado se migra sozinho na primeira queixa que
   * chegar, com a classe REAL da queixa de agora — e some da lista dos 23.
   *
   * ORDEM IMPORTA: a chave nova é consultada PRIMEIRO. Quando o aluno já tem
   * os dois chamados (o legado e o que nasceu do racha), quem recebe é o NOVO.
   * Fazer o contrário jogaria uma queixa de classe conhecida dentro de um
   * chamado de classe desconhecida, que é exatamente o bug que o #23 consertou.
   * O par que já rachou (#408/#356) NÃO é fundido por código: fundir é decidir
   * qual título e qual histórico morre, e isso é decisão de dono, não de
   * função de gravação.
   */
  let adotadoDoLegado = false;
  if (!existing) {
    const legada = assinaturaLegada(c.signature);
    if (legada) {
      existing = await buscarPorAssinatura(admin, legada, true);
      adotadoDoLegado = existing !== null;
    }
  }

  if (existing) {
    /**
     * `!c.nasceIgnorado` é o que impede o chamado fantasma de RESSUSCITAR um
     * chamado já fechado. Sem isso o conserto se anularia no segundo bounce:
     * o endereço obsoleto que quica de novo (o do Robério quicou duas vezes)
     * acharia o `ignored` que acabou de nascer e o reabriria como "open", que é
     * exatamente o chamado fantasma na fila que este caminho veio tirar.
     * Mesma guarda do `reopened = closed && !userError` em failure-alert.ts.
     */
    const reopened = (existing.status === "fixed" || existing.status === "ignored") && !c.nasceIgnorado;
    const tituloNovo = c.title.slice(0, 120);
    /**
     * ⚠️ TÍTULO E DESCRIÇÃO TÊM QUE ANDAR JUNTOS (#213, 31/08).
     *
     * Até aqui a ocorrência nova sobrescrevia a `description` e NÃO mexia no
     * `title`. Como a assinatura do chat é por PESSOA (`help:atend:<email>`,
     * help/route.ts:170) e não por problema, o mesmo aluno perguntando outra
     * coisa cai no MESMO chamado — e o registro passava a se contradizer:
     * título do pedido VELHO, descrição do pedido NOVO.
     *
     * Não é cosmético. No #213 o título dizia "aluno quer saber como apagar
     * fotos" (já respondido e fechado às 19h38Z) enquanto a descrição, às
     * 20h45Z, já era "insatisfeito com o realismo dos dentes no Vídeo Clone".
     * Quem pega a fila pelo título trabalha no problema errado, e a reclamação
     * que está de fato esperando fica invisível.
     *
     * Agora os dois andam juntos. E o título velho NÃO é destruído em
     * silêncio: quando o assunto muda, ele fica preservado no corpo da
     * descrição, porque o pedido anterior pode ter ficado sem resposta.
     */
    const mudouDeAssunto = !!existing.title && existing.title !== tituloNovo;
    const description = mudouDeAssunto
      ? `${c.description}\n\n⚠️ ASSUNTO MUDOU (ocorrência ${(existing.occurrences ?? 1) + 1}). ` +
        `O pedido anterior deste mesmo chamado era: "${existing.title}". ` +
        `Confira se ELE já foi respondido antes de tratar só o de agora.`
      : c.description;
    const alvo = existing;
    /**
     * NOTA DE REABERTURA (incidente 4f328521, 26/09) — mesma doença que
     * `ingest.ts` já resolveu pro lado da falha crua: sem isto, `incidents`
     * não tem `updated_at` e um chamado reaberto por relato novo fica
     * indistinguível de chamado nunca visto. Só empilha nota quando REABRE
     * de verdade (`reopened`); um bump comum não ganha nota nenhuma, igual
     * sempre foi.
     *
     * O texto casa de propósito com a entrada `REABERTURA:` de NOTA_NEUTRA em
     * `_frank/ferramentas/2026-09-22_esperando_johnny.cjs` — sem isso esta
     * nota de sistema viraria a ÚLTIMA nota e enterraria a nota substantiva
     * de baixo pros dois leitores que trabalham por `agent_notes -> -1`
     * (esperando_johnny.cjs e percepcao_travada.cjs).
     */
    const notes: AgentNote[] = Array.isArray(alvo.agent_notes) ? alvo.agent_notes : [];
    if (reopened) {
      notes.push({
        at: now,
        by: "system",
        note: `REABERTURA: novo relato (${c.reportedBy}) apontou pra este chamado após status "${alvo.status}" — reaberto.`,
      });
    }
    const gravar = (migrarChave: boolean) =>
      admin
        .from("incidents" as never)
        .update({
          status: reopened ? "open" : alvo.status,
          /**
           * A MIGRAÇÃO DA CHAVE (#410) — só no chamado adotado pelo legado.
           *
           * Vai JUNTO com o bump de ocorrência, numa escrita só: ou o chamado
           * soma e passa a viver na chave nova, ou não acontece nada. Duas
           * escritas separadas deixariam a janela de um chamado somado que
           * continua invisível pra próxima busca.
           */
          ...(migrarChave ? { signature: c.signature } : {}),
          /**
           * REABERTURA AUTOMÁTICA LIMPA O CARIMBO (02/09).
           *
           * Só quando `reopened`: aqui a mesma escrita também serve pro bump de
           * ocorrência de um chamado que continua no status em que estava. Se a
           * limpeza fosse incondicional, uma ocorrência nova num chamado ainda
           * FECHADO apagaria a data do fechamento legítimo dele.
           *
           * Sem isto o chamado voltava pra "open" carregando resolved_at/by/
           * commit do fechamento anterior — o registro afirmava aberto E
           * resolvido ao mesmo tempo. É o sexto conserto desta família; o
           * porquê de ela reincidir está em ./closure.ts.
           */
          ...(reopened ? limparFechamento() : {}),
          occurrences: (alvo.occurrences ?? 1) + 1,
          last_seen_at: now,
          sample_error: (c.sampleError ?? "").slice(0, 1000) || null,
          title: tituloNovo,
          description,
          agent_notes: notes,
          ...(c.attachments?.length ? { attachment_path: c.attachments.join(",") } : {}),
        } as never)
        .eq("id", alvo.id);

    const { error } = await gravar(adotadoDoLegado);
    /**
     * PERDEMOS A CORRIDA NA MIGRAÇÃO (#410).
     *
     * Entre o SELECT e este UPDATE, alguém criou o chamado da chave nova — e
     * o índice único da mig 92 recusa dois ABERTOS com a mesma signature.
     * Aqui o conflito não é erro, é informação: a chave nova já tem dono, e a
     * migração simplesmente não é desta vez (a próxima queixa tenta de novo,
     * ou nem precisa, porque a busca exata vai achar o dono).
     *
     * O que NÃO pode acontecer é a ocorrência sumir junto com a migração
     * recusada — o update inteiro é atômico, então sem este retry o aluno
     * teria escrito e o chamado não registraria nada. Regrava sem a chave: a
     * ocorrência entra no legado, que é onde ela estava indo.
     */
    if (error && adotadoDoLegado && (error as { code?: string }).code === CONFLITO) {
      await gravar(false);
    }
    // O livro (mig 47) cobre a fila inteira, não só a falha crua de
    // `ingest.ts`: todo bump por relato de gente também vira linha aqui.
    await registrarOcorrencia(admin, alvo.id, c, now);
    return alvo.numero ?? null;
  }

  const criado = await inserirChamadoUnico(admin, {
      kind: c.kind ?? "reported",
      cause: c.cause ?? "reported",
      status: c.nasceIgnorado ? "ignored" : "open",
      // O carimbo do fechamento sai do `closureFields` e não na mão: é o único
      // lugar que garante os TRÊS campos juntos. Escrever `resolved_at` solto
      // aqui seria o sétimo conserto da família descrita em ./closure.ts.
      ...(c.nasceIgnorado
        ? { ...closureFields("ignored", "sistema", now), resolution_note: c.notaDeFechamento ?? null }
        : {}),
      signature: c.signature,
      title: c.title.slice(0, 120),
      occurrences: 1,
      affected_emails: c.affectedEmails ?? [],
      sample_error: (c.sampleError ?? "").slice(0, 1000) || null,
      description: c.description,
      reported_by: c.reportedBy,
      categoria: c.categoria ?? "atendimento",
      attachment_path: c.attachments?.length ? c.attachments.join(",") : null,
      first_seen_at: now,
      last_seen_at: now,
  });
  // Se perdemos a corrida, inserirChamadoUnico já somou a ocorrência no
  // chamado que venceu e devolve o número DELE — que é o que o time vai citar.
  if (criado) await registrarOcorrencia(admin, criado.id, c, now);
  return criado?.numero ?? null;
}
