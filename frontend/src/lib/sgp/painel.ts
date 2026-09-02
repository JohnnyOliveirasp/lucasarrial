/**
 * SGP — tradução do pedido para a linguagem do TIME DE SUPORTE (/admin/sgp).
 *
 * Pedido do Lucas (02/09): *"o time precisa ver, sozinho, quem já foi feito e
 * quais os próximos passos"*. Hoje o dado só existe no banco.
 *
 * REGRA QUE MANDA AQUI: quem lê esta tela NÃO tem acesso ao código e não sabe o
 * que é `status = 'revisao'`. Nada de jargão, nada de nome de coluna, nada de
 * sigla. Cada linha tem que responder duas perguntas: *em que pé está* e *o que
 * eu faço agora*.
 *
 * Módulo PURO de propósito: sem banco, sem fetch, sem `new Date()` escondido —
 * o `agora` entra por parâmetro. Dá pra testar a régua inteira sem subir nada.
 *
 * ⚠️ POR QUE NÃO CHAMA `estadoDasEtapas` (lib/sgp/etapas.ts): aquela função
 * ESCREVE — carimba `foto_pronta_em`/`voz_pronta_em`, atualiza `status` e
 * DISPARA E-MAIL pro aluno. Chamar por linha, num painel que atualiza sozinho,
 * mandaria e-mail toda vez que alguém deixasse a tela aberta. O reuso correto
 * aqui é ler o que ela já gravou na linha (`status`, `foto_pronta_em`,
 * `voz_pronta_em`) — a regra continua morando lá, esta tela só a lê.
 */
import type { SgpPedidoRow, SgpStatus } from "./types.ts";
import { SGP_FOTOS_MIN, SGP_PASSOS } from "./types.ts";

/** Parado além disto = alguém precisa cobrar o aluno. Único caso com ação humana. */
export const SGP_PARADO_HORAS = 48;
const PARADO_MS = SGP_PARADO_HORAS * 60 * 60 * 1000;

/** O passo é do wizard (a bola está com o ALUNO) ou já é processamento nosso? */
export function noWizard(status: SgpStatus): boolean {
  return (SGP_PASSOS as readonly string[]).includes(status);
}

/** Em que pé está — em português de gente, não de banco. */
export const ETAPA_HUMANA: Record<SgpStatus, string> = {
  dados: "Preenchendo o cadastro",
  foto: "Enviando as fotos",
  audio: "Gravando o áudio",
  revisao: "Conferindo antes de enviar",
  enviado: "Enviado, na fila",
  processando: "Estamos gerando",
  pronto: "Entregue",
  falhou: "Deu erro",
};

/** O que ainda falta o ALUNO fazer, para a frase de cobrança. */
const FALTA_NO_WIZARD: Record<string, string> = {
  dados: "terminar o cadastro (nome, e-mail e WhatsApp)",
  foto: "mandar as fotos",
  audio: "mandar o áudio da voz",
  revisao: "apertar o botão de enviar — o material dele já está todo lá",
};

export type LinhaPainel = {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  /** Rótulo da etapa, já em linguagem de gente. */
  etapa: string;
  status: SgpStatus;
  /** Quanto tempo desde a última movimentação do pedido. */
  paradoMs: number;
  paradoTexto: string;
  /** Passou de 48h no mesmo passo do wizard, sem enviar. */
  parado: boolean;
  /** Precisa de gente: cobrar o aluno ou tratar erro. Manda na ordenação. */
  precisaAcao: boolean;
  foto: string;
  voz: string;
  enviadoEm: string | null;
  erro: string | null;
  /** A coluna mais importante da tela. Uma frase, sem jargão. */
  oQueFazer: string;
};

/** "2 dias e 7h", "5h", "40min" — nada de ISO na cara do atendente. */
export function tempoHumano(ms: number): string {
  if (ms < 0) ms = 0;
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const resto = h % 24;
  const dias = d === 1 ? "1 dia" : `${d} dias`;
  return resto ? `${dias} e ${resto}h` : dias;
}

/**
 * Foto/Voz. Depois do envio é o clone (o carimbo que `etapas.ts` gravou);
 * ANTES do envio é o material que o aluno subiu — que é o que o time precisa
 * saber pra cobrar ("mandou 1 de 4 fotos", e não um "-" sem explicação).
 */
function colunaFoto(p: SgpPedidoRow): string {
  if (p.foto_pronta_em) return "ok";
  const enviadas = (p.fotos ?? []).length;
  if (!p.enviado_em) return enviadas ? `${enviadas} de ${SGP_FOTOS_MIN}` : "nenhuma";
  return "gerando";
}

function colunaVoz(p: SgpPedidoRow): string {
  if (p.voz_pronta_em) return "ok";
  const audios = (p.audios ?? []).length;
  if (!p.enviado_em) return audios ? `${audios} áudio(s)` : "nenhum";
  return "gerando";
}

/**
 * A frase de ação. Nunca promete prazo (regra do Johnny/Lucas), nunca cita
 * arquivo, nunca manda o atendente "abrir card".
 */
export function oQueFazer(p: SgpPedidoRow, paradoMs: number): string {
  if (p.status === "falhou") {
    return "Deu erro no sistema. O time técnico já é acionado automaticamente — avise o aluno que estamos resolvendo e NÃO prometa prazo.";
  }
  if (p.status === "pronto") return "Nada a fazer. Já foi entregue.";
  if (p.status === "processando") {
    return paradoMs > PARADO_MS
      ? "Está gerando há mais de 2 dias, o que é tempo demais. Avise o time técnico."
      : "Nada a fazer. Está sendo gerado agora.";
  }
  if (p.status === "enviado") {
    return paradoMs > PARADO_MS
      ? "Enviado há mais de 2 dias e ainda não começou. Avise o time técnico."
      : "Nada a fazer. Entrou na fila e começa em seguida.";
  }
  // Wizard: a bola está com o aluno.
  const falta = FALTA_NO_WIZARD[p.status] ?? "continuar o cadastro";
  if (paradoMs > PARADO_MS) {
    return `Cobrar o aluno: chame no WhatsApp e peça pra ele ${falta}. Está parado há ${tempoHumano(paradoMs)}.`;
  }
  return `Aguardar. O aluno ainda está no meio do cadastro — só cobre se passar de ${SGP_PARADO_HORAS}h parado.`;
}

/** Uma linha da tabela, pronta pra desenhar. `agora` entra por fora (testável). */
export function montarLinha(p: SgpPedidoRow, agora: number): LinhaPainel {
  const paradoMs = agora - new Date(p.atualizado_em).getTime();
  const parado = noWizard(p.status) && paradoMs > PARADO_MS;
  const precisaAcao = parado || p.status === "falhou";
  return {
    id: p.id,
    nome: p.nome?.trim() || "(sem nome)",
    email: p.email?.trim() || "—",
    whatsapp: p.whatsapp?.trim() || "—",
    etapa: ETAPA_HUMANA[p.status] ?? p.status,
    status: p.status,
    paradoMs,
    paradoTexto: tempoHumano(paradoMs),
    parado,
    precisaAcao,
    foto: colunaFoto(p),
    voz: colunaVoz(p),
    enviadoEm: p.enviado_em,
    erro: p.erro,
    oQueFazer: oQueFazer(p, paradoMs),
  };
}

/**
 * Ordem da tela (requisito 5 do pedido): *"o topo deve ser o que precisa de
 * ação"* e, dentro disso, *"há mais tempo parado primeiro"*. Só "mais tempo
 * parado" não bastava — um pedido ENTREGUE há 4 dias ficaria acima de um aluno
 * travado há 2, e o topo da tela viraria justamente o que não precisa de nada.
 */
export function ordenar(linhas: LinhaPainel[]): LinhaPainel[] {
  return [...linhas].sort((a, b) => {
    if (a.precisaAcao !== b.precisaAcao) return a.precisaAcao ? -1 : 1;
    return b.paradoMs - a.paradoMs;
  });
}

export type ResumoPainel = {
  total: number;
  parados: number;
  porEtapa: Array<{ status: SgpStatus; etapa: string; n: number }>;
};

/** Contadores do topo: quantos em cada etapa e quantos parados há +48h. */
export function resumir(linhas: LinhaPainel[]): ResumoPainel {
  const contagem = new Map<SgpStatus, number>();
  for (const l of linhas) contagem.set(l.status, (contagem.get(l.status) ?? 0) + 1);
  return {
    total: linhas.length,
    parados: linhas.filter((l) => l.parado).length,
    porEtapa: (Object.keys(ETAPA_HUMANA) as SgpStatus[])
      .filter((s) => contagem.has(s))
      .map((s) => ({ status: s, etapa: ETAPA_HUMANA[s], n: contagem.get(s) ?? 0 })),
  };
}
