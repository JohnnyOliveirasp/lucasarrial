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

/**
 * Quanto tempo um "já cobrei" segura o alerta (pedido do Lucas, 04/09).
 *
 * NÃO É "resolvido". O time cobrou a aluna no WhatsApp, mas ela CONTINUA parada
 * (1 de 4 fotos, sem mexer há dias) — sumir com a linha sumiria com o alerta e
 * não com o problema, e o problema é uma aluna que pagou. Então a marca só
 * cala o vermelho por este período; vencido, a linha volta a alertar sozinha.
 *
 * Um clique não pode calar pra sempre. É por isso que isto é uma JANELA e não
 * um booleano.
 *
 * Configurável por `SGP_COBRANCA_SILENCIO_HORAS` — mas a leitura do env mora na
 * rota (server-only), porque este módulo é puro e roda também no browser.
 */
export const SGP_COBRANCA_SILENCIO_HORAS = 48;
export const SGP_COBRANCA_SILENCIO_MS = SGP_COBRANCA_SILENCIO_HORAS * 60 * 60 * 1000;

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
  /**
   * Passou de 48h no mesmo passo do wizard, sem enviar — E ninguém cobrou
   * dentro da janela de silêncio. É o que pinta a linha de vermelho e o que o
   * contador do topo soma.
   */
  parado: boolean;
  /** Precisa de gente: cobrar o aluno ou tratar erro. Manda na ordenação. */
  precisaAcao: boolean;
  /**
   * Está parado de verdade, mas o time já cobrou e a janela ainda não venceu.
   * A linha CONTINUA na tabela (o aluno segue travado) — só não grita.
   */
  silenciado: boolean;
  /** "cobrado há 3h por fulano@x.com", pra tela. `null` = ninguém cobrou. */
  cobradoTexto: string | null;
  /** "volta a avisar em 45h" enquanto a marca está valendo. */
  voltaAAvisarTexto: string | null;
  foto: string;
  voz: string;
  enviadoEm: string | null;
  /**
   * Texto do erro JÁ SEM o carimbo de autoria (ver `lerMarcaErro`). O que a
   * tela mostra. `null` = sem erro nenhum.
   */
  erro: string | null;
  /** Quem registrou o erro: o TIME (na mão, nesta tela) ou o SISTEMA. */
  erroOrigem: OrigemErro | null;
  /** Só para `erroOrigem === "time"`: quem marcou. */
  erroPor: string | null;
  /**
   * Só para `erroOrigem === "time"`: quando marcou, em ISO.
   * ISO de propósito — quem formata é a TELA, no fuso de quem está lendo. Se
   * fosse formatado aqui (no servidor) o time no Brasil leria a hora do servidor.
   */
  erroEm: string | null;
  /** PRONTO | AGUARDANDO | ERRO — a leitura do TIME (pedido do Lucas, 10/09). */
  estadoTime: EstadoTime;
  /** O mesmo, já com o rótulo de tela. */
  estadoTimeRotulo: string;
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

/* ==========================================================================
 * O ERRO MARCADO PELO TIME (pedido do Lucas, 10/09)
 * ==========================================================================
 *
 * PEDIDO: *"mostrar em que pé está cada aluno do ponto de vista do TIME —
 * pronto, aguardando ou erro — igual como era feito na planilha"*. Na planilha
 * antiga isso era uma coluna preenchida na mão, mais a coluna Responsável. O
 * sistema novo mostra onde o ALUNO está (etapa do wizard) e perdeu o gesto de
 * o TIME dizer *"esse aqui deu problema, e o problema é este"*.
 *
 * ONDE ISSO É GRAVADO: na coluna `erro`, que JÁ EXISTE e hoje está vazia nos 63
 * pedidos — sem migration, como pedido.
 *
 * ⚠️ MAS A COLUNA `erro` TEM DOIS DONOS. O SISTEMA também escreve nela
 * (`lib/sgp/processar.ts`, quando o clone de foto ou o treino de voz falha).
 * Confundir os dois seria ruim nos dois sentidos: o time apagaria o diagnóstico
 * técnico sem saber, e o técnico leria "aluno mandou foto de outra pessoa" como
 * se fosse defeito do sistema.
 *
 * A separação é um CARIMBO no começo do texto, e é ele que resolve, de uma vez:
 *   - a autoria (requisito 4: QUEM marcou e QUANDO) sem coluna nova;
 *   - a distinção time × sistema (só o do time tem carimbo);
 *   - o "desmarcar" seguro (só se apaga o que TEM carimbo — ver a rota).
 *
 * Formato gravado:
 *   [erro do time · victor@x.com · 2026-09-10T14:32:11.000Z · desde 2026-09-05T09:10:00.000Z] texto livre
 *
 * É legível pra quem abrir o banco na mão (não é base64 nem JSON escondido) e
 * é ancorado em `^`, então texto livre com colchete no meio não confunde nada.
 */

/** Quem escreveu o que está na coluna `erro`. */
export type OrigemErro = "time" | "sistema";

/** O que o carimbo guarda. */
export type MarcaErro = {
  /** O texto que o atendente escreveu, já sem o carimbo. */
  texto: string;
  /** E-mail (ou user_id) de quem marcou. Nunca vazio. */
  por: string;
  /** Quando marcou, ISO. `null` quando o carimbo veio ilegível. */
  em: string | null;
  /**
   * O `atualizado_em` que o pedido tinha ANTES da marca — o relógio do
   * "parado há". Ver `relogioDoPedido` para o motivo de isto existir.
   */
  paradoDesde: string | null;
};

/** Teto do texto livre. Uma frase pro próximo atendente, não um relatório. */
export const ERRO_TEXTO_MAX = 300;

const MARCA_ABERTURA = "[erro do time · ";
const MARCA_RE = /^\[erro do time · ([^·\]]+) · ([^·\]]+?)(?: · desde ([^·\]]+?))?\]\s?/;

/** Campo do carimbo: nada que possa quebrar a leitura dele depois. */
function limparCampo(v: string): string {
  return v.replace(/[·[\]\r\n]/g, "").trim();
}

/**
 * O texto livre do atendente, saneado.
 *
 * Uma linha só (quebra de linha vira espaço), sem caracteres de controle, com
 * teto de tamanho, e sem `[` no começo — só pra que um texto não consiga
 * *parecer* um carimbo de autoria de outra pessoa.
 */
export function limparTextoErro(bruto: string): string {
  const limpo = bruto
    // `\p{Cc}` = categoria "control" do Unicode. Escrito assim (e nao como
    // \x00-\x1f literal) pra nao plantar byte de controle no fonte.
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\[+/, "")
    .trim();
  return limpo.slice(0, ERRO_TEXTO_MAX).trim();
}

/** Monta o valor que vai pra coluna `erro`. Usado pela rota de escrita. */
export function formatarMarcaErro(m: {
  texto: string;
  por: string;
  em: string;
  paradoDesde?: string | null;
}): string {
  const por = limparCampo(m.por) || "alguém do time";
  const desde = m.paradoDesde ? ` · desde ${limparCampo(m.paradoDesde)}` : "";
  return `${MARCA_ABERTURA}${por} · ${limparCampo(m.em)}${desde}] ${limparTextoErro(m.texto)}`;
}

/** Data do carimbo só vale se for lida como data. Lixo vira `null`, não vira mentira. */
function isoValido(v: string | undefined): string | null {
  if (!v) return null;
  return Number.isFinite(new Date(v).getTime()) ? v : null;
}

/**
 * Lê o carimbo. `null` = não é marca do time (ou está vazio) — ou seja, é erro
 * do SISTEMA, e ninguém apaga erro do sistema por esta tela.
 */
export function lerMarcaErro(erro: string | null | undefined): MarcaErro | null {
  if (!erro) return null;
  const m = MARCA_RE.exec(erro);
  if (!m) return null;
  return {
    texto: erro.slice(m[0].length).trim(),
    por: m[1].trim() || "alguém do time",
    em: isoValido(m[2]?.trim()),
    paradoDesde: isoValido(m[3]?.trim()),
  };
}

/**
 * De quando conta o "parado há".
 *
 * ⚠️ O PORQUÊ, que não é óbvio: o gatilho `sgp_pedidos_touch` (migration 100,
 * que É a que está aplicada) faz `new.atualizado_em = now()` em TODO update.
 * Então marcar um erro por esta tela ZERA o relógio do aluno: quem estava
 * parado há 5 dias vira "parado há 0min", sai do vermelho e some do contador —
 * exatamente o "botão que some com a linha" que o pedido de 04/09 proíbe. É o
 * mesmo estrago que a migration 106 conserta para a cobrança (e que a 108,
 * escrita neste PR e ainda NÃO aplicada, conserta para o `erro`).
 *
 * Enquanto a 108 não entra, o relógio original viaja DENTRO do carimbo
 * (`desde ...`) e é ele que manda aqui. Com a 108 aplicada o gatilho preserva
 * `atualizado_em` e os dois valores passam a ser o mesmo — o resultado não muda.
 *
 * Resíduo honesto: marcar e depois DESMARCAR (sem a 108) perde o relógio de vez,
 * porque o desmarcar leva o carimbo junto. Está dito na tela e no PR.
 */
export function relogioDoPedido(p: SgpPedidoRow): string {
  return lerMarcaErro(p.erro)?.paradoDesde ?? p.atualizado_em;
}

/* ==========================================================================
 * PRONTO × AGUARDANDO × ERRO — a leitura do TIME
 * ========================================================================== */

/** Os três estados da planilha antiga, que o time pede de volta. */
export const ESTADOS_TIME = ["erro", "aguardando", "pronto"] as const;
export type EstadoTime = (typeof ESTADOS_TIME)[number];

export const ESTADO_TIME_ROTULO: Record<EstadoTime, string> = {
  erro: "Erro",
  aguardando: "Aguardando",
  pronto: "Pronto",
};

/**
 * A régua, medida no banco em 10/09 (63 pedidos: dados 8, foto 19, audio 7,
 * pronto 29, e `erro` vazio nos 63):
 *
 *   ERRO       = tem erro registrado (do time OU do sistema), ou status `falhou`
 *   PRONTO     = status `pronto`
 *   AGUARDANDO = todo o resto
 *
 * ERRO GANHA DE PRONTO de propósito: se o time marcou problema num pedido já
 * entregue (clone errado, aluno reclamou), o que importa é o problema aberto —
 * senão a marca que ele acabou de fazer sumiria da vista.
 *
 * `falhou` entra em ERRO por definição ("Deu erro"), e não muda os números
 * medidos: hoje não há nenhum `falhou`.
 */
export function estadoDoTime(p: SgpPedidoRow): EstadoTime {
  if (p.erro?.trim() || p.status === "falhou") return "erro";
  if (p.status === "pronto") return "pronto";
  return "aguardando";
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

/** O "já cobrei" ainda valendo, já interpretado. `null` = não há marca viva. */
export type Cobranca = {
  /** Quando clicaram (ISO). */
  em: string;
  /** Quem clicou. Nunca vazio: a rota grava e-mail ou id, nunca nada. */
  por: string;
  /** Há quanto tempo cobraram. */
  desdeMs: number;
  /** Ainda dentro da janela de silêncio. */
  silenciado: boolean;
  /** Quanto falta pra voltar a alertar. */
  restaMs: number;
};

/**
 * Lê a marca de cobrança da linha. Devolve `null` quando ela não vale mais.
 *
 * Três motivos pra não valer, e o terceiro é o requisito 4 do pedido:
 *  1. ninguém cobrou (ou a migration 106 ainda não entrou e a coluna nem existe);
 *  2. a data veio ilegível — dado torto nunca pode calar um alerta;
 *  3. O ALUNO MEXEU DEPOIS. Aí a marca virou irrelevante sozinha, sem ninguém
 *     precisar limpar nada: `atualizado_em` andou pra frente do `cobrado_em`.
 *     (É o gatilho da migration 106 que garante que a própria cobrança não
 *     empurra `atualizado_em` — senão TODA marca se auto-invalidaria na hora.)
 */
export function lerCobranca(
  p: SgpPedidoRow,
  agora: number,
  silencioMs: number = SGP_COBRANCA_SILENCIO_MS,
): Cobranca | null {
  if (!p.cobrado_em) return null;
  const em = new Date(p.cobrado_em).getTime();
  if (!Number.isFinite(em)) return null;
  // `relogioDoPedido` e não `p.atualizado_em` cru: sem a migration 108, marcar
  // um erro carimba `atualizado_em = now()` e invalidaria, de graça, um "já
  // cobrei" que ainda estava valendo — o ALUNO não mexeu, o time é que anotou.
  if (new Date(relogioDoPedido(p)).getTime() > em) return null;

  // Relógio adiantado do banco não pode virar tempo negativo na tela.
  const desdeMs = Math.max(0, agora - em);
  return {
    em: p.cobrado_em,
    por: p.cobrado_por?.trim() || "alguém do time",
    desdeMs,
    silenciado: desdeMs <= silencioMs,
    restaMs: Math.max(0, silencioMs - desdeMs),
  };
}

/**
 * A frase de ação. Nunca promete prazo (regra do Johnny/Lucas), nunca cita
 * arquivo, nunca manda o atendente "abrir card".
 */
export function oQueFazer(
  p: SgpPedidoRow,
  paradoMs: number,
  cobranca: Cobranca | null = null,
): string {
  // O time marcou um problema NA MÃO. Isso ganha de tudo: é a única informação
  // da linha que veio de uma pessoa que falou com o aluno, e é o que a planilha
  // antiga tinha e o sistema tinha perdido.
  const marca = lerMarcaErro(p.erro);
  if (marca) {
    return (
      `Erro marcado pelo time (${marca.por}): ${marca.texto} ` +
      `— trate este caso primeiro. Quando estiver resolvido, clique em "desmarcar" nesta linha ` +
      `pra ele voltar pro fluxo normal.`
    );
  }
  if (p.status === "falhou") {
    return "Deu erro no sistema. O time técnico já é acionado automaticamente — avise o aluno que estamos resolvendo e NÃO prometa prazo.";
  }
  // Erro gravado pelo SISTEMA sem o pedido ter ido pra `falhou`: é o que
  // `lib/sgp/processar.ts` faz quando o clone de foto ou o treino de voz falha
  // e o status fica onde estava. Sem isto a linha mostraria um erro na coluna e
  // "Nada a fazer" ao lado — foi o tipo de caso que a planilha antiga marcava
  // como Erro e o sistema deixou invisível.
  if (p.erro?.trim()) {
    return (
      `O sistema registrou um erro neste pedido: ${p.erro.trim()}. ` +
      `Avise o time técnico e NÃO prometa prazo ao aluno.`
    );
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
    // Já cobraram e a janela ainda vale: não manda cobrar de novo, mas também
    // não deixa o atendente achar que o caso está resolvido — ele NÃO está.
    if (cobranca?.silenciado) {
      return (
        `Já cobraram há ${tempoHumano(cobranca.desdeMs)} (${cobranca.por}). ` +
        `Nada a fazer agora: espere o aluno responder. Ele continua parado há ` +
        `${tempoHumano(paradoMs)}, e se não mexer isto volta a aparecer em vermelho ` +
        `daqui a ${tempoHumano(cobranca.restaMs)}.`
      );
    }
    // Cobraram, a janela venceu e o aluno não mexeu. Volta pro vermelho — mas
    // avisando que já teve uma tentativa, pra não parecer a mesma cobrança.
    if (cobranca) {
      return (
        `Cobrar o aluno DE NOVO: ${cobranca.por} já cobrou há ` +
        `${tempoHumano(cobranca.desdeMs)} e ele continua sem mexer. ` +
        `Chame no WhatsApp e peça pra ele ${falta}. Está parado há ${tempoHumano(paradoMs)}.`
      );
    }
    return `Cobrar o aluno: chame no WhatsApp e peça pra ele ${falta}. Está parado há ${tempoHumano(paradoMs)}.`;
  }
  return `Aguardar. O aluno ainda está no meio do cadastro — só cobre se passar de ${SGP_PARADO_HORAS}h parado.`;
}

/**
 * Uma linha da tabela, pronta pra desenhar. `agora` entra por fora (testável),
 * e `silencioMs` também — quem lê o env é a rota, este módulo continua puro.
 */
export function montarLinha(
  p: SgpPedidoRow,
  agora: number,
  silencioMs: number = SGP_COBRANCA_SILENCIO_MS,
): LinhaPainel {
  // `relogioDoPedido` e não `atualizado_em` cru — ver o comentário lá: enquanto
  // a migration 108 não entra, marcar um erro zeraria este relógio.
  const paradoMs = agora - new Date(relogioDoPedido(p)).getTime();
  const cobranca = lerCobranca(p, agora, silencioMs);
  const marca = lerMarcaErro(p.erro);
  const temErro = !!p.erro?.trim();
  const estadoTime = estadoDoTime(p);

  // Travado no wizard há +48h. Isto NÃO depende da cobrança: o aluno está
  // parado do mesmo jeito, e é o que a linha continua mostrando na tela.
  const travado = noWizard(p.status) && paradoMs > PARADO_MS;
  // O que GRITA. Um "já cobrei" recente tira o vermelho e o contador — e só.
  const silenciado = travado && !!cobranca?.silenciado;
  const parado = travado && !silenciado;
  // Erro (do time OU do sistema) é caso ABERTO: sobe pro topo junto com quem
  // precisa ser cobrado. Se ficasse no meio da lista, marcar o erro seria o
  // mesmo que esconder o aluno — o defeito que este pedido veio consertar.
  const precisaAcao = parado || p.status === "falhou" || temErro;

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
    silenciado,
    cobradoTexto: cobranca ? `cobrado há ${tempoHumano(cobranca.desdeMs)} por ${cobranca.por}` : null,
    voltaAAvisarTexto:
      cobranca?.silenciado ? `volta a avisar em ${tempoHumano(cobranca.restaMs)}` : null,
    foto: colunaFoto(p),
    voz: colunaVoz(p),
    enviadoEm: p.enviado_em,
    // O texto do erro vai pra tela SEM o carimbo (requisito 3: quem for atender
    // precisa ler o que houve, não o cabeçalho de autoria).
    erro: marca ? marca.texto : (p.erro?.trim() || null),
    erroOrigem: temErro ? (marca ? "time" : "sistema") : null,
    erroPor: marca?.por ?? null,
    erroEm: marca?.em ?? null,
    estadoTime,
    estadoTimeRotulo: ESTADO_TIME_ROTULO[estadoTime],
    oQueFazer: oQueFazer(p, paradoMs, cobranca),
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
    // 2º degrau (04/09): quem já foi cobrado desce do vermelho, mas NÃO pode
    // cair no meio dos pedidos entregues. Sem isto, um aluno travado há 5 dias
    // que o time acabou de cobrar apareceria embaixo de uma entrega de 30 dias
    // atrás — a linha continuaria "na tabela" e, na prática, escondida. O caso
    // ainda está aberto: ele fica logo abaixo do que grita, não no fim.
    if (a.silenciado !== b.silenciado) return a.silenciado ? -1 : 1;
    return b.paradoMs - a.paradoMs;
  });
}

export type ResumoPainel = {
  total: number;
  parados: number;
  /**
   * Parados que o time JÁ cobrou e ainda estão na janela de silêncio.
   * Contador separado de propósito: some do "precisam ser cobrados" sem sumir
   * da tela. Se este número só cresce, a cobrança não está resolvendo nada.
   */
  cobrados: number;
  porEtapa: Array<{ status: SgpStatus; etapa: string; n: number }>;
  /**
   * PRONTO / AGUARDANDO / ERRO — a leitura do TIME (pedido do Lucas, 10/09).
   *
   * Vem SEMPRE com os três, inclusive zerados. Diferente de `porEtapa`, aqui
   * o zero informa: "Erro 0" é a resposta certa pra *"tem algum caso com
   * problema?"*, e some-se o filtro se a pilha some quando está vazia.
   */
  porEstadoTime: Array<{ estado: EstadoTime; rotulo: string; n: number }>;
};

/** Contadores do topo: quantos em cada etapa e quantos parados há +48h. */
export function resumir(linhas: LinhaPainel[]): ResumoPainel {
  const contagem = new Map<SgpStatus, number>();
  for (const l of linhas) contagem.set(l.status, (contagem.get(l.status) ?? 0) + 1);
  return {
    total: linhas.length,
    parados: linhas.filter((l) => l.parado).length,
    cobrados: linhas.filter((l) => l.silenciado).length,
    porEtapa: (Object.keys(ETAPA_HUMANA) as SgpStatus[])
      .filter((s) => contagem.has(s))
      .map((s) => ({ status: s, etapa: ETAPA_HUMANA[s], n: contagem.get(s) ?? 0 })),
    porEstadoTime: ESTADOS_TIME.map((estado) => ({
      estado,
      rotulo: ESTADO_TIME_ROTULO[estado],
      n: linhas.filter((l) => l.estadoTime === estado).length,
    })),
  };
}
