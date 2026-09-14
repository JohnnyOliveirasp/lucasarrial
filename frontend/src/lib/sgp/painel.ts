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

/* ---------------------------------------------------------------------------
 * SITUAÇÃO — os três rótulos que o Lucas pediu (10/09, reenviado 14/09)
 * ------------------------------------------------------------------------- */

/**
 * *"Desses que já estão prontos, ou aguardando ou erro, precisamos deixar
 * explicitamente nessa tela para meu time ver. Igual como era feito na
 * planilha."*
 *
 * A tela já tinha a ETAPA (`ETAPA_HUMANA`: "Enviando as fotos", "Estamos
 * gerando"…), que responde *em que passo está*. Isso NÃO é a mesma pergunta: o
 * time da planilha lê a coluna de status procurando três buckets, e oito etapas
 * não viram três buckets na cabeça de ninguém. Por isso a situação é um campo
 * próprio, e a etapa continua existindo ao lado dela.
 *
 * NADA aqui inventa coluna: sai de `status`, `erro` e das marcas de erro manual.
 */
export const SITUACOES = ["erro", "aguardando", "pronto"] as const;
export type SituacaoSgp = (typeof SITUACOES)[number];

/** Em caixa alta porque é etiqueta de planilha, não frase. */
export const SITUACAO_ROTULO: Record<SituacaoSgp, string> = {
  erro: "ERRO",
  aguardando: "AGUARDANDO",
  pronto: "PRONTO",
};

export type Situacao = {
  codigo: SituacaoSgp;
  rotulo: string;
  /** Uma linha dizendo POR QUE está nesse estado. Sem jargão, como o resto. */
  motivo: string;
};

/** A marca de "deu erro" que alguém do time botou na mão (migration 109). */
export type ErroManual = {
  em: string;
  /** Quem marcou. Nunca vazio: a rota grava e-mail ou id. */
  por: string;
  /** O que a pessoa escreveu. `null` quando ela não escreveu nada. */
  motivo: string | null;
  desdeMs: number;
};

/**
 * Lê a marca de erro manual da linha.
 *
 * ⚠️ DIFERENÇA DELIBERADA PRO `lerCobranca`: esta marca **não vence** e **não se
 * invalida quando o aluno mexe**. "Já cobrei" é um timer — cala o alerta por um
 * tempo e volta. "Deu erro" é uma AFIRMAÇÃO de defeito feita por gente que viu
 * algo que o sistema não vê (o aluno falou no WhatsApp, o material veio errado).
 * O aluno mandar mais uma foto não desmente isso. Sai só por "desfazer".
 */
export function lerErroManual(p: SgpPedidoRow, agora: number): ErroManual | null {
  if (!p.erro_manual_em) return null;
  const em = new Date(p.erro_manual_em).getTime();
  // Data ilegível não pode virar "marcado há NaN" na cara do atendente — mas
  // também não pode sumir com a marca, então cai num tempo zerado e a marca fica.
  const desdeMs = Number.isFinite(em) ? Math.max(0, agora - em) : 0;
  return {
    em: p.erro_manual_em,
    por: p.erro_manual_por?.trim() || "alguém do time",
    motivo: p.erro_manual_motivo?.trim() || null,
    desdeMs,
  };
}

/**
 * A régua dos três estados, em ordem de precedência. É ela que o time vai ler na
 * tela, então está escrita aqui inteira, num lugar só:
 *
 *  1. ERRO  — alguém do time marcou na mão (`erro_manual_em`); OU o pedido está
 *             em `falhou`; OU o sistema carimbou algo em `erro` (isso acontece
 *             em falha PARCIAL, com o status ainda em `processando` — é
 *             justamente o caso que passaria despercebido sem esta coluna).
 *  2. PRONTO — `status = 'pronto'`. Entregue, nada a fazer.
 *  3. AGUARDANDO — todo o resto (cadastro, foto, áudio, revisão, fila, geração).
 *
 * ERRO ganha de PRONTO de propósito: "material veio errado" é exatamente um
 * pedido ENTREGUE que o time precisa marcar. Se PRONTO ganhasse, marcar erro
 * nesse caso — o caso que o Lucas citou — não mudaria nada na tela.
 */
export function situacao(p: SgpPedidoRow, agora: number = Date.now()): Situacao {
  const manual = lerErroManual(p, agora);
  if (manual) {
    const quem = `marcado pelo time há ${tempoHumano(manual.desdeMs)} (${manual.por})`;
    return {
      codigo: "erro",
      rotulo: SITUACAO_ROTULO.erro,
      motivo: manual.motivo ? `${manual.motivo} — ${quem}` : `Erro ${quem}`,
    };
  }

  const doSistema = p.erro?.trim() || null;
  if (p.status === "falhou") {
    return {
      codigo: "erro",
      rotulo: SITUACAO_ROTULO.erro,
      motivo: doSistema
        ? `O sistema falhou: ${doSistema}`
        : "O sistema falhou ao gerar (sem motivo registrado).",
    };
  }
  if (doSistema) {
    // Falha parcial: uma parte do clone morreu e o pedido seguiu em frente.
    return {
      codigo: "erro",
      rotulo: SITUACAO_ROTULO.erro,
      motivo: `Parte da geração falhou: ${doSistema}`,
    };
  }

  if (p.status === "pronto") {
    return { codigo: "pronto", rotulo: SITUACAO_ROTULO.pronto, motivo: "Entregue." };
  }

  if (p.status === "processando") {
    return { codigo: "aguardando", rotulo: SITUACAO_ROTULO.aguardando, motivo: "Estamos gerando." };
  }
  if (p.status === "enviado") {
    return {
      codigo: "aguardando",
      rotulo: SITUACAO_ROTULO.aguardando,
      motivo: "Na fila, esperando a geração começar.",
    };
  }
  return {
    codigo: "aguardando",
    rotulo: SITUACAO_ROTULO.aguardando,
    motivo: `Esperando o aluno ${FALTA_NO_WIZARD[p.status] ?? "continuar o cadastro"}.`,
  };
}

export type LinhaPainel = {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  /** Rótulo da etapa, já em linguagem de gente. */
  etapa: string;
  status: SgpStatus;
  /** PRONTO / AGUARDANDO / ERRO — a etiqueta de planilha (pedido do Lucas). */
  situacao: SituacaoSgp;
  situacaoRotulo: string;
  situacaoMotivo: string;
  /** "marcado há 3h por fulano@x.com". `null` = ninguém marcou erro na mão. */
  erroManualTexto: string | null;
  /** O que o atendente escreveu ao marcar. `null` = marcou sem escrever nada. */
  erroManualMotivo: string | null;
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
  if (new Date(p.atualizado_em).getTime() > em) return null;

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
  const paradoMs = agora - new Date(p.atualizado_em).getTime();
  const cobranca = lerCobranca(p, agora, silencioMs);
  const sit = situacao(p, agora);
  const erroManual = lerErroManual(p, agora);

  // Travado no wizard há +48h. Isto NÃO depende da cobrança: o aluno está
  // parado do mesmo jeito, e é o que a linha continua mostrando na tela.
  const travado = noWizard(p.status) && paradoMs > PARADO_MS;
  // O que GRITA. Um "já cobrei" recente tira o vermelho e o contador — e só.
  const silenciado = travado && !!cobranca?.silenciado;
  const parado = travado && !silenciado;
  // Era `p.status === "falhou"`, que é um subconjunto estrito de `situacao ===
  // "erro"`: agora a falha PARCIAL (erro carimbado com status ainda andando) e a
  // marca do time também sobem pro topo. Quem está em ERRO precisa de gente por
  // definição — era a regra que já valia pro "falhou", só que cega pros outros dois.
  const precisaAcao = parado || sit.codigo === "erro";

  return {
    id: p.id,
    nome: p.nome?.trim() || "(sem nome)",
    email: p.email?.trim() || "—",
    whatsapp: p.whatsapp?.trim() || "—",
    etapa: ETAPA_HUMANA[p.status] ?? p.status,
    status: p.status,
    situacao: sit.codigo,
    situacaoRotulo: sit.rotulo,
    situacaoMotivo: sit.motivo,
    erroManualTexto: erroManual
      ? `marcado há ${tempoHumano(erroManual.desdeMs)} por ${erroManual.por}`
      : null,
    erroManualMotivo: erroManual?.motivo ?? null,
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
    erro: p.erro,
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
  /**
   * Os três buckets da planilha do Lucas. Ficam ao lado de `porEtapa`, não no
   * lugar dele: etapa responde "em que passo", situação responde "pronto,
   * esperando ou quebrado" — e é esta a leitura de longe.
   */
  situacoes: Record<SituacaoSgp, number>;
  porEtapa: Array<{ status: SgpStatus; etapa: string; n: number }>;
};

/** Contadores do topo: quantos em cada etapa e quantos parados há +48h. */
export function resumir(linhas: LinhaPainel[]): ResumoPainel {
  const contagem = new Map<SgpStatus, number>();
  for (const l of linhas) contagem.set(l.status, (contagem.get(l.status) ?? 0) + 1);
  const situacoes: Record<SituacaoSgp, number> = { erro: 0, aguardando: 0, pronto: 0 };
  for (const l of linhas) situacoes[l.situacao] += 1;
  return {
    total: linhas.length,
    parados: linhas.filter((l) => l.parado).length,
    cobrados: linhas.filter((l) => l.silenciado).length,
    situacoes,
    porEtapa: (Object.keys(ETAPA_HUMANA) as SgpStatus[])
      .filter((s) => contagem.has(s))
      .map((s) => ({ status: s, etapa: ETAPA_HUMANA[s], n: contagem.get(s) ?? 0 })),
  };
}
