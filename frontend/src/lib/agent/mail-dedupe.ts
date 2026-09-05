/**
 * TRAVA CONTRA RESPONDER DUAS VEZES A MESMA MENSAGEM (#259, 05/09).
 *
 * O QUE ACONTECEU: a aluna katiasalvador32@gmail.com recebeu CINCO respostas
 * automáticas com o mesmo assunto — enviados uid 641, 644, 645 (04/09, três em
 * cinco minutos) e uid 1055, 1056 (05/09). A resposta de 1055 pedia pra ela
 * REENVIAR um print, contra o que a equipe já tinha respondido nos enviados
 * 651 e 765. Ela reenviou 31MB, o próprio sistema recusou por MAIL_MAX_BYTES,
 * e ela ficou sem resposta nenhuma.
 *
 * POR QUE A TRAVA DE HOJE NÃO PEGA: a única proteção é `markSeen(mail.uid)`, e
 * UID é identidade da CÓPIA da mensagem dentro da caixa, não da MENSAGEM. Se o
 * servidor reentrega a mesma mensagem, ela chega com uid NOVO e UNSEEN — a
 * marcação anterior não vale nada e ela ganha resposta nova. O `claim_alert`
 * do sweep também não pega: ele só impede duas varreduras SIMULTÂNEAS, e a
 * reentrega da Katia aconteceu com um dia de diferença.
 *
 * O QUE ISTO FAZ: guarda o Message-ID (identidade da MENSAGEM, estável entre
 * reentregas) de tudo que a Fast já respondeu, e consulta antes de responder.
 *
 * ONDE MORA O ESTADO — `agent_state`, SEM MIGRATION. Motivo, e esta é a razão
 * de não pendurar isto na tabela do PR #9 (`support_mail_replies`): aquela
 * tabela NÃO EXISTE em produção. A migration 85 nunca foi aplicada — o próprio
 * cabeçalho dela diz "ESPELHO — NÃO APLICADO, DDL aguardando aprovação do
 * Johnny", e o relatório de 20/08 registra "FALTA — proposta, branch não
 * mergeada". Uma trava que lê uma tabela inexistente nunca bloqueia nada e
 * ainda PARECE que funciona. `agent_state` já existe e já é usada exatamente
 * assim (dedupe durável sem DDL) pelo Vigia, pelo orphan-outreach, pelo
 * sgp-boas-vindas e pelo aviso-orfao.
 *
 * SEGURANÇA DE FALHA: se a leitura do estado falhar, esta trava LIBERA a
 * resposta (comportamento de hoje). Entre "responder duas vezes" e "deixar o
 * aluno no silêncio", o silêncio é o dano pior e mais caro — foi ele que
 * gerou este incidente. Falha de leitura vira linha de log, não bloqueio.
 */
import { getAdmin } from "@/lib/db/admin";

/** Chave única em `agent_state` (mesmo padrão de `orphan_invites`). */
const STATE_KEY = "fast_mail_replied";

/**
 * Por quanto tempo um Message-ID continua barrando reentrega. 30 dias cobre
 * com folga a reentrega real observada (1 dia) e mantém o JSONB pequeno: a
 * varredura responde no máximo 8 por rodada, então o teto prático é da ordem
 * de milhares de chaves, não milhões.
 */
const RETENCAO_MS = 30 * 24 * 60 * 60 * 1000;

/** Message-ID → instante em que a Fast respondeu (ISO). */
export type RespostasEnviadas = Record<string, string>;

/**
 * Normaliza o Message-ID pra comparação: tira os sinais de menor/maior, espaço
 * e caixa. `<ABC@Host>` e `abc@host` são a MESMA mensagem — servidores variam
 * a caixa do domínio ao reentregar, e sem normalizar a trava passaria batido.
 *
 * Devolve null pra cabeçalho ausente ou vazio: mensagem sem Message-ID não é
 * deduplicável e segue o caminho normal (ver `jaRespondida`).
 */
export function normalizarMessageId(messageId: string | null | undefined): string | null {
  if (!messageId) return null;
  const limpo = messageId.trim().replace(/^</, "").replace(/>$/, "").trim().toLowerCase();
  return limpo.length ? limpo : null;
}

/**
 * Descarta o que passou da retenção. Roda a cada escrita — é o que impede o
 * JSONB de crescer pra sempre, já que ninguém mais limpa esta chave.
 */
export function podar(estado: RespostasEnviadas, agora = Date.now()): RespostasEnviadas {
  const corte = agora - RETENCAO_MS;
  const saida: RespostasEnviadas = {};
  for (const [id, quando] of Object.entries(estado)) {
    const t = Date.parse(quando);
    // Data ilegível: mantém. Perder a trava por causa de um registro torto é
    // pior do que carregar uma chave a mais.
    if (Number.isNaN(t) || t >= corte) saida[id] = quando;
  }
  return saida;
}

async function carregar(): Promise<RespostasEnviadas> {
  // `agent_state` fica fora do Database tipado (padrão das rotas do Vigia).
  const { data, error } = await getAdmin()
    .from("agent_state" as never)
    .select("value")
    .eq("key", STATE_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (((data as { value?: RespostasEnviadas } | null)?.value ?? {}) as RespostasEnviadas) || {};
}

async function salvar(estado: RespostasEnviadas): Promise<void> {
  const { error } = await getAdmin()
    .from("agent_state" as never)
    .upsert({ key: STATE_KEY, value: estado, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error(error.message);
}

/**
 * Esta mensagem já foi respondida antes?
 *
 * Sem Message-ID → false (responde). Não dá pra deduplicar por remetente +
 * assunto: "oi, tem novidade?" mandado duas vezes é DUAS perguntas legítimas, e
 * calar a segunda seria criar o silêncio que este incidente veio corrigir.
 */
export async function jaRespondida(messageId: string | null): Promise<boolean> {
  const id = normalizarMessageId(messageId);
  if (!id) return false;
  try {
    return Boolean((await carregar())[id]);
  } catch (e) {
    // Falha de leitura LIBERA (ver "segurança de falha" no topo).
    console.error(
      "[agent/mail-dedupe] falha ao ler o registro de respostas — seguindo sem a trava:",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

/**
 * Marca a mensagem como respondida. Chamada ANTES do envio: se gravássemos
 * depois, um envio bem-sucedido cujo registro falhasse deixaria a porta aberta
 * pra reentrega responder de novo — que é exatamente o defeito em questão.
 * O preço é o inverso (envio que falha depois da reserva), e é por isso que
 * existe `liberarReserva`.
 */
export async function reservarResposta(messageId: string | null): Promise<void> {
  const id = normalizarMessageId(messageId);
  if (!id) return;
  try {
    const estado = podar(await carregar());
    estado[id] = new Date().toISOString();
    await salvar(estado);
  } catch (e) {
    // Não derruba o envio: sem reserva a gente volta ao comportamento de hoje.
    console.error(
      "[agent/mail-dedupe] falha ao registrar a resposta:",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Desfaz a reserva quando o ENVIO falhou. Sem isto, um erro de SMTP deixaria a
 * mensagem marcada como respondida e o aluno nunca receberia nada — a mesma
 * classe de silêncio que este módulo existe pra evitar. Como o `respondOne`
 * não marca a mensagem como lida quando o envio estoura, a próxima varredura
 * tenta de novo e precisa encontrar a porta aberta.
 */
export async function liberarReserva(messageId: string | null): Promise<void> {
  const id = normalizarMessageId(messageId);
  if (!id) return;
  try {
    const estado = await carregar();
    if (!(id in estado)) return;
    delete estado[id];
    await salvar(estado);
  } catch (e) {
    console.error(
      "[agent/mail-dedupe] falha ao liberar a reserva:",
      e instanceof Error ? e.message : e,
    );
  }
}
