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
 *
 * ── O QUARTO RÓTULO (Lucas, 14/09) ──────────────────────────────────────────
 * *"eu preciso de um botão de conclusão aqui nessa tela, para que a equipe
 * consiga concluir o atendimento"*. CONCLUÍDO não é um quarto pé do PEDIDO: é
 * uma declaração sobre o ATENDIMENTO, feita por gente, e por isso vem de coluna
 * própria (migration 110) em vez de sair de `status`. O "concluído" que a tela
 * tinha até aqui era derivado e não clicável (`compradores.ts` › `statusPedido
 * === 'pronto'`), e derivado responde outra pergunta: "o robô entregou", não
 * "alguém ainda precisa mexer nisto". A precedência entre os quatro está
 * justificada inteira em `situacao`, logo abaixo.
 */
export const SITUACOES = ["concluido", "erro", "aguardando", "pronto"] as const;
export type SituacaoSgp = (typeof SITUACOES)[number];

/** Em caixa alta porque é etiqueta de planilha, não frase. */
export const SITUACAO_ROTULO: Record<SituacaoSgp, string> = {
  concluido: "CONCLUÍDO",
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

/** O "atendimento concluído" declarado por gente (migration 110). */
export type Conclusao = {
  em: string;
  /** Quem concluiu. Nunca vazio: a rota grava e-mail ou id. */
  por: string;
  /** O que a pessoa escreveu ao concluir. `null` quando não escreveu nada. */
  motivo: string | null;
  desdeMs: number;
  /**
   * O PEDIDO ANDOU depois da conclusão — a declaração virou histórico.
   *
   * Mesma régua do requisito 4 do "já cobrei": `atualizado_em` passou na frente
   * de `concluido_em`. É o que impede o buraco que esta marca criaria sozinha:
   * o time conclui "o aluno desistiu", o aluno volta e manda foto, trava de novo
   * — e a linha nunca mais gritaria, porque a conclusão não vence por tempo.
   *
   * A marca NÃO é apagada: ela continua na tela como histórico ("foi concluído
   * há 5 dias por fulano, mas o aluno mexeu depois"). O que ela perde é o poder
   * de calar o alerta. Apagar seria destruir uma declaração auditável de gente.
   *
   * (É o gatilho da migration 110 que garante que concluir não empurra
   * `atualizado_em` — senão TODA conclusão se auto-superaria no mesmo instante.)
   */
  superada: boolean;
};

/**
 * Lê a marca de conclusão da linha.
 *
 * ⚠️ AS DUAS DIFERENÇAS PRAS OUTRAS DUAS MARCAS, as duas deliberadas:
 *  · pro `lerCobranca`: esta NÃO vence por tempo. "Já cobrei" é um timer de 48h;
 *    "concluí" é uma decisão, e decisão não expira no relógio.
 *  · pro `lerErroManual`: aquela NÃO se invalida quando o aluno mexe (é uma
 *    afirmação sobre um defeito que já aconteceu). Esta se invalida, porque é
 *    uma afirmação sobre o FUTURO — "não preciso mais mexer nisto" — e o aluno
 *    voltando a mexer é exatamente o fato que a desmente.
 */
export function lerConclusao(p: SgpPedidoRow, agora: number): Conclusao | null {
  if (!p.concluido_em) return null;
  const em = new Date(p.concluido_em).getTime();
  // Data ilegível não pode virar "concluído há NaN" na cara do atendente — mas
  // também não pode sumir com a marca, então cai num tempo zerado e a marca fica.
  const legivel = Number.isFinite(em);
  const mexeuDepois = legivel && new Date(p.atualizado_em).getTime() > em;
  return {
    em: p.concluido_em,
    por: p.concluido_por?.trim() || "alguém do time",
    motivo: p.concluido_motivo?.trim() || null,
    desdeMs: legivel ? Math.max(0, agora - em) : 0,
    // Data ilegível conta como superada: dado torto nunca pode calar um alerta
    // (é a mesma regra que `lerCobranca` já aplica).
    superada: !legivel || mexeuDepois,
  };
}

/**
 * A situação do PEDIDO, ignorando o que o time declarou sobre o ATENDIMENTO.
 *
 * Fica separada porque é ela que continua escrita na tela por baixo do rótulo
 * CONCLUÍDO. Sem isso, concluir esconderia o estado real — e é justamente o que
 * o pedido do Lucas proíbe ("se sumir, a gente perde de vista quem pagou e não
 * recebeu").
 */
export function situacaoDoPedido(p: SgpPedidoRow, agora: number = Date.now()): Situacao {
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

/**
 * A régua dos QUATRO estados, em ordem de precedência. É ela que o time vai ler
 * na tela, então está escrita aqui inteira, num lugar só:
 *
 *  1. CONCLUÍDO  — alguém do time declarou o ATENDIMENTO encerrado
 *                  (`concluido_em`) e o pedido não andou desde então.
 *  2. ERRO       — alguém do time marcou na mão (`erro_manual_em`); OU o pedido
 *                  está em `falhou`; OU o sistema carimbou algo em `erro` (falha
 *                  PARCIAL, com o status ainda andando).
 *  3. PRONTO     — `status = 'pronto'`. Entregue.
 *  4. AGUARDANDO — todo o resto (cadastro, foto, áudio, revisão, fila, geração).
 *
 * ── POR QUE CONCLUÍDO GANHA DE ERRO (a decisão que o Lucas pediu, 14/09) ────
 *
 * O Lucas leu como "conclusão declarada por humano vence o derivado, porque o
 * humano sabe coisas que o banco não sabe". Concordo, e vou além: ela tem que
 * vencer também o ERRO, que não é derivado — e é exatamente aí que estava a
 * dúvida. Três razões, em ordem de peso:
 *
 *  1. SENÃO O BOTÃO É DECORATIVO NO CASO QUE O MOTIVOU. É o mesmo argumento que
 *     fez ERRO ganhar de PRONTO na 109, aplicado uma vez a mais: "deu erro, o
 *     time tratou, acabou" é o caso mais comum de conclusão. Se ERRO ganhasse,
 *     clicar em "Concluir" numa linha em erro não mudaria NADA na tela — e um
 *     botão que não funciona justamente no caso que o pediu não é um botão.
 *  2. É O MESMO PROBLEMA DE 04/09, UM NÍVEL ACIMA. "O time cobrou a Wallana e o
 *     painel continuou gritando" virou o "Já cobrei". Um caso em `falhou` que o
 *     time já resolveu (reembolsou, refez por fora) gritaria PARA SEMPRE, porque
 *     `falhou` não sai sozinho. Alerta que não tem como ser baixado por quem o
 *     resolveu é alerta que o time aprende a ignorar.
 *  3. AS PERGUNTAS SÃO DIFERENTES. ERRO/PRONTO/AGUARDANDO respondem *em que pé
 *     está o PEDIDO*; CONCLUÍDO responde *alguém ainda precisa mexer nisto*. O
 *     time lê uma coluna só, e a segunda pergunta é a que decide o dia dele.
 *
 * ── O QUE IMPEDE ISSO DE VIRAR "SUMIR COM O PROBLEMA" ───────────────────────
 * Quatro travas, porque esta precedência é a parte perigosa da mudança:
 *  a) o estado real continua ESCRITO no motivo ("…O pedido em si está ERRO: o
 *     sistema falhou: timeout"), nunca apagado;
 *  b) `situacaoPorBaixo` fica na linha, e `resumir` conta os concluídos que
 *     ainda têm pendência por baixo — se esse número cresce, alguém está
 *     fechando caso quebrado, e isso aparece no topo da tela;
 *  c) a linha NÃO some da tabela e o "parado há" continua contando a verdade
 *     (o gatilho da 110 garante que concluir não zera o relógio);
 *  d) a conclusão é SUPERADA se o pedido andar depois dela — ver `lerConclusao`.
 */
export function situacao(p: SgpPedidoRow, agora: number = Date.now()): Situacao {
  const porBaixo = situacaoDoPedido(p, agora);
  const fim = lerConclusao(p, agora);
  if (!fim || fim.superada) return porBaixo;

  const quem = `concluído pelo time há ${tempoHumano(fim.desdeMs)} (${fim.por})`;
  const cabeca = fim.motivo ? `${fim.motivo} — ${quem}` : `Atendimento ${quem}`;
  return {
    codigo: "concluido",
    rotulo: SITUACAO_ROTULO.concluido,
    // Trava (a): o que o pedido É continua na frente do atendente. Sem esta
    // segunda frase, CONCLUÍDO viraria uma tampa em cima de quem pagou e não
    // recebeu — que é o que o pedido do Lucas proíbe em caixa alta.
    motivo: `${cabeca}. O pedido em si está ${porBaixo.rotulo}: ${porBaixo.motivo}`,
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
  /** CONCLUÍDO / ERRO / PRONTO / AGUARDANDO — a etiqueta de planilha. */
  situacao: SituacaoSgp;
  situacaoRotulo: string;
  situacaoMotivo: string;
  /**
   * O que o PEDIDO é, ignorando a conclusão do atendimento. Igual a `situacao`
   * em toda linha não concluída. Existe pra que "concluído" nunca apague o
   * estado real de quem pagou e não recebeu — ver a trava (b) em `situacao`.
   */
  situacaoPorBaixo: SituacaoSgp;
  /** O time declarou o atendimento encerrado E o pedido não andou depois. */
  concluido: boolean;
  /** "concluído há 3h por fulano@x.com", pra tela. `null` = ninguém concluiu. */
  concluidoTexto: string | null;
  /** O que o atendente escreveu ao concluir. `null` = concluiu sem escrever. */
  concluidoMotivo: string | null;
  /**
   * Foi concluído, mas o pedido ANDOU depois: a marca virou histórico e parou
   * de calar o alerta. A linha volta a se comportar como não concluída.
   */
  conclusaoSuperada: boolean;
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
  conclusao: Conclusao | null = null,
): string {
  // Conclusão viva manda em tudo: o time já decidiu que não precisa mexer.
  // Mas a frase NÃO pode parar em "nada a fazer" quando o aluno pagou e não
  // recebeu — aí ela diz as duas coisas, porque as duas são verdade.
  if (conclusao && !conclusao.superada) {
    const quem = `${conclusao.por} concluiu este atendimento há ${tempoHumano(conclusao.desdeMs)}`;
    const porque = conclusao.motivo ? ` (“${conclusao.motivo}”)` : "";
    const base = `Nada a fazer: ${quem}${porque}.`;
    if (p.status === "pronto" && !p.erro?.trim()) return base;
    return (
      `${base} Atenção: o clone dele NÃO chegou a ser entregue — o pedido parou em ` +
      `"${ETAPA_HUMANA[p.status] ?? p.status}". A linha fica aqui pra ninguém ` +
      `perder de vista quem pagou e não recebeu. Se o caso voltar, é só desfazer.`
    );
  }
  if (conclusao?.superada) {
    // Não esconde a decisão anterior, mas também não deixa ela calar a tela: o
    // pedido andou depois, então o caso pode ter reaberto sozinho.
    const aviso =
      `${conclusao.por} já tinha concluído este atendimento, mas o aluno mexeu depois ` +
      `— confira se o caso reabriu. `;
    return aviso + oQueFazer(p, paradoMs, cobranca, null);
  }
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
  const fim = lerConclusao(p, agora);
  const concluido = !!fim && !fim.superada;

  // Travado no wizard há +48h. Isto NÃO depende da cobrança: o aluno está
  // parado do mesmo jeito, e é o que a linha continua mostrando na tela.
  const travado = noWizard(p.status) && paradoMs > PARADO_MS;
  // O que GRITA. Um "já cobrei" recente tira o vermelho e o contador — e só.
  //
  // A conclusão tira os dois, e é o ponto do botão: o time declarou que este
  // caso não precisa mais de ninguém. O que ela NÃO faz é sumir com a linha nem
  // mexer no relógio — `paradoMs` continua contando a verdade logo ao lado, e
  // `situacaoPorBaixo` continua dizendo que o aluno não recebeu. Ela também não
  // cala para sempre: se o pedido andar, `superada` devolve o alerta sozinho.
  const silenciado = !concluido && travado && !!cobranca?.silenciado;
  const parado = !concluido && travado && !silenciado;
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
    situacaoPorBaixo: situacaoDoPedido(p, agora).codigo,
    concluido,
    concluidoTexto: fim
      ? `concluído há ${tempoHumano(fim.desdeMs)} por ${fim.por}` +
        (fim.superada ? " — mas o aluno mexeu depois" : "")
      : null,
    concluidoMotivo: fim?.motivo ?? null,
    conclusaoSuperada: !!fim?.superada,
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
    oQueFazer: oQueFazer(p, paradoMs, cobranca, fim),
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
    // 3º degrau (14/09): concluído vai pro FIM, e é o único degrau que empurra
    // pra baixo em vez de puxar pra cima. Sem ele, um caso encerrado há 30 dias
    // subiria na frente de um aluno que entrou ontem — porque o desempate final
    // é "mais tempo parado primeiro", e caso encerrado nunca mais anda. Ele
    // continua na tabela; só não ocupa o lugar de quem ainda pode precisar.
    if (a.concluido !== b.concluido) return a.concluido ? 1 : -1;
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
  /** Atendimentos que o time declarou encerrados e que o pedido não desmentiu. */
  concluidos: number;
  /**
   * ⚠️ O CONTADOR QUE GUARDA A DECISÃO DE PRECEDÊNCIA (ver `situacao`, trava b).
   *
   * Concluídos cujo PEDIDO não está entregue e limpo — ou seja, gente que pagou
   * e não recebeu, e cujo caso alguém encerrou mesmo assim. Isso é legítimo com
   * frequência (reembolso, desistência), então não é alarme: é o número que
   * torna a escolha auditável. Se ele só cresce, o botão virou vassoura de
   * tapete — e aí dá pra ver, em vez de descobrir por reclamação de aluno.
   */
  concluidosComPendencia: number;
  /**
   * Os quatro buckets da planilha do Lucas. Ficam ao lado de `porEtapa`, não no
   * lugar dele: etapa responde "em que passo", situação responde "encerrado,
   * pronto, esperando ou quebrado" — e é esta a leitura de longe.
   */
  situacoes: Record<SituacaoSgp, number>;
  porEtapa: Array<{ status: SgpStatus; etapa: string; n: number }>;
};

/** Contadores do topo: quantos em cada etapa e quantos parados há +48h. */
export function resumir(linhas: LinhaPainel[]): ResumoPainel {
  const contagem = new Map<SgpStatus, number>();
  for (const l of linhas) contagem.set(l.status, (contagem.get(l.status) ?? 0) + 1);
  const situacoes: Record<SituacaoSgp, number> = { concluido: 0, erro: 0, aguardando: 0, pronto: 0 };
  for (const l of linhas) situacoes[l.situacao] += 1;
  return {
    total: linhas.length,
    parados: linhas.filter((l) => l.parado).length,
    cobrados: linhas.filter((l) => l.silenciado).length,
    concluidos: linhas.filter((l) => l.concluido).length,
    concluidosComPendencia: linhas.filter((l) => l.concluido && l.situacaoPorBaixo !== "pronto")
      .length,
    situacoes,
    porEtapa: (Object.keys(ETAPA_HUMANA) as SgpStatus[])
      .filter((s) => contagem.has(s))
      .map((s) => ({ status: s, etapa: ETAPA_HUMANA[s], n: contagem.get(s) ?? 0 })),
  };
}
