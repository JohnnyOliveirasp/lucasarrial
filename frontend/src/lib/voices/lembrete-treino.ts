/**
 * LEMBRETE de voz parada em `awaiting_training` — decisão, texto e trava
 * anti-repetição (módulo PURO).
 *
 * ⚠️ POR QUE EXISTE (medido em 06/09/2026):
 * 18 vozes em `awaiting_training`, TODAS com áudio enviado (20 a 59 min por
 * pessoa), a mais velha parada há 54 DIAS. O aluno fez a parte dele; a voz
 * nunca treinou porque `awaiting_training` espera um CLIQUE dele em "Iniciar
 * treinamento" (`start-training/route.ts:93` exige esse status).
 *
 * O conserto de 26/08 (incidente 137) mexeu na tela de LISTA: pôs o aviso
 * "Falta 1 passo" na linha e deixou o badge sólido. Ele REDUZIU o fluxo novo
 * (16 das 18 são anteriores a ele, 2 posteriores) mas não zerou, e — o ponto
 * que importa aqui — não fez NADA por quem já estava parado: ninguém foi
 * avisado. Uma tela só avisa quem volta nela. Quem não volta precisa de um
 * e-mail, e é isso que este módulo decide.
 *
 * TRÊS DECISÕES QUE MORAM AQUI, e o motivo de cada uma:
 *
 *  1. A RÉGUA (`ETAPAS_DIAS`) — lembra no dia 3 e de novo no dia 14, no
 *     máximo DUAS vezes por voz, nunca mais. Dia 3 porque a pessoa gravou de
 *     20 a 60 minutos: a intenção é altíssima e a memória é curta, então 3
 *     dias já passou do "faço no fim de semana" sem virar cobrança. O segundo
 *     no dia 14 existe porque um e-mail só, se cair no spam, deixa a pessoa
 *     presa para sempre. Duas tentativas e a gente para de insistir — o clique
 *     é dele, e voz parada não é motivo pra perseguir ninguém.
 *
 *  2. O SALDO MUDA O TEXTO. Treinar custa `custoTreino` créditos e o botão
 *     devolve 402 pra quem não tem (`start-training/route.ts:104`). Mandar
 *     "é só clicar em Treinar" pra quem tem saldo zero é mandar a pessoa num
 *     botão que vai bater numa parede — o mesmo tipo de erro que este trabalho
 *     nasceu pra evitar. Quem tem saldo recebe "falta 1 clique"; quem não tem
 *     recebe a verdade: o áudio está guardado e falta crédito.
 *
 *  3. A TRAVA É POR VOZ + ETAPA. O sweep roda a cada 5 min: sem trava, a
 *     mesma voz geraria um e-mail a cada 5 minutos. `etapaDevida` só devolve
 *     etapa que ainda não saiu, e o estado guarda quais já saíram.
 *
 * PURO de propósito: sem `@/`, sem Next, sem Supabase — o runner
 * `node --test` não resolve o alias. Assim a régua inteira (inclusive a trava)
 * roda em `lembrete-treino.test.ts` sem tocar em banco nenhum.
 */

/**
 * Dias de espera que disparam cada lembrete. Máximo de 2 e-mails por voz.
 * Ver decisão 1 no cabeçalho.
 */
export const ETAPAS_DIAS = [3, 14] as const;

/**
 * ⚠️ CORTE DE BACKFILL — a automação NÃO escreve para voz criada antes disto.
 *
 * Em 06/09/2026 as 18 vozes paradas já tinham dono: o Johnny escreveu À MÃO
 * para os 16 alunos afetados explicando o passo que falta. Sem este corte, o
 * primeiro sweep depois do deploy varreria as mesmas 18, veria "parada há 54
 * dias, nunca lembrada" e mandaria TUDO de novo — carta duplicada no mesmo
 * dia, que é exatamente o defeito que a trava existe pra impedir.
 *
 * O corte é a data do trabalho manual. Voz anterior a ela = já tratada por
 * humano, a máquina não repete. Voz criada a partir daí = a régua vale.
 */
export const SEM_LEMBRETE_ANTES_DE = "2026-09-06T00:00:00.000Z";

/** Uma voz parada, com o que a decisão precisa saber sobre o dono. */
export type VozParada = {
  voiceId: string;
  userId: string;
  email: string;
  /** Primeiro nome, quando existe — só pra abertura do e-mail. */
  nome: string | null;
  /** `voices.created_at` (ISO). Ver nota sobre o relógio em `diasParado`. */
  criadaEm: string;
  /** Saldo total (assinatura + extra) no momento da varredura. */
  saldo: number;
  /** Equipe/admin não é cobrada — o saldo dela é irrelevante. */
  equipe: boolean;
};

/** O que já saiu para cada voz. Persistido em `agent_state` (sem migration). */
export type RegistroLembrete = {
  /** Etapas (em dias) já enviadas — subconjunto de `ETAPAS_DIAS`. */
  etapas: number[];
  /** Quando o último saiu. */
  at: string;
  email: string;
};

export type EstadoLembretes = Record<string, RegistroLembrete>;

export type MotivoPulo =
  | "antes_do_corte"
  | "nova_demais"
  | "ja_lembrada"
  | "sem_email";

export type ResultadoLembrete =
  | { enviou: true; etapa: number; comSaldo: boolean }
  | { enviou: false; motivo: MotivoPulo };

export type TextoLembrete = { assunto: string; texto: string };

/**
 * Dias inteiros entre a criação da voz e agora.
 *
 * ⚠️ `created_at` é PROXY de "parada desde". Não existe coluna
 * `awaiting_since` e criar uma exigiria migration — que aqui não se aplica.
 * O proxy é bom: no fluxo normal a voz vira `awaiting_training` minutos
 * depois de nascer (`uploads-complete`), então created_at ≈ início da espera.
 * Onde ele erra é a favor da cautela: uma voz que voltou pra fila depois de
 * um treino falho parece MAIS velha do que está parada, e no máximo recebe o
 * lembrete um pouco antes — nunca depois, e nunca duas vezes (a trava é por
 * voz, não por data).
 */
export function diasParado(criadaEm: string, agora: Date): number {
  const nasceu = new Date(criadaEm).getTime();
  if (!Number.isFinite(nasceu)) return 0;
  const ms = agora.getTime() - nasceu;
  if (ms < 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Qual etapa está devida agora, ou null se nenhuma.
 *
 * Devolve a MAIOR etapa vencida que ainda não saiu — nunca uma rajada. É o
 * que impede que uma voz parada há 54 dias e nunca lembrada receba os dois
 * e-mails de uma vez: ela recebe só o de 14, e o de 3 é marcado como vencido
 * junto (ver `etapasCobertas`).
 */
export function etapaDevida(dias: number, jaEnviadas: number[]): number | null {
  const vencidas = ETAPAS_DIAS.filter((e) => dias >= e && !jaEnviadas.includes(e));
  if (vencidas.length === 0) return null;
  return Math.max(...vencidas);
}

/**
 * Todas as etapas que a voz já ultrapassou. Ao mandar a etapa 14 a gente marca
 * a 3 como coberta também: ela nunca mais faz sentido, e sem isso o próximo
 * sweep mandaria o e-mail de 3 dias depois do de 14 — na ordem errada.
 */
export function etapasCobertas(dias: number): number[] {
  return ETAPAS_DIAS.filter((e) => dias >= e);
}

/** Voz criada antes do corte de backfill (já tratada à mão). */
export function antesDoCorte(criadaEm: string, corte = SEM_LEMBRETE_ANTES_DE): boolean {
  const t = new Date(criadaEm).getTime();
  const c = new Date(corte).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(c)) return false;
  return t < c;
}

/** Quem paga o treino tem que ter saldo; equipe passa direto. */
export function temSaldo(voz: Pick<VozParada, "saldo" | "equipe">, custoTreino: number): boolean {
  return voz.equipe || voz.saldo >= custoTreino;
}

const PAINEL_URL = "https://fastcloner.com/app/voice-cloning";
const ASSINAR_URL = "https://fastcloner.com/#planos";

/**
 * O texto. Português de gente, sem jargão: o aluno não sabe (nem tem que
 * saber) o que é R2, RunPod, LoRA ou `awaiting_training`. Uma coisa a fazer,
 * dita numa linha, no topo.
 */
export function montarLembrete(
  voz: VozParada,
  dias: number,
  custoTreino: number,
): TextoLembrete {
  const oi = `Oi${voz.nome ? `, ${voz.nome}` : ""}!`;
  const guardado =
    `O seu áudio está guardado com a gente desde que você enviou — ` +
    `não se perdeu nada e você não precisa gravar de novo.`;

  if (temSaldo(voz, custoTreino)) {
    return {
      assunto: "Falta 1 clique para a sua voz ficar pronta",
      texto: [
        oi,
        "",
        `Notamos que a sua voz está esperando há ${dias} dias — e falta só um passo, que é seu:`,
        "",
        `1. Abra ${PAINEL_URL}`,
        `2. Clique na voz que você enviou`,
        `3. Clique no botão "Iniciar treinamento"`,
        "",
        `Depois disso é com a gente: o treino leva de 15 a 30 minutos e você ` +
          `pode fechar a página. A gente te avisa quando a voz estiver pronta.`,
        "",
        guardado,
        "",
        `Se você clicar e algo não funcionar, responde este e-mail que a gente resolve.`,
      ].join("\n"),
    };
  }

  return {
    assunto: "Sua voz está pronta para treinar — falta o crédito",
    texto: [
      oi,
      "",
      `A sua voz está esperando há ${dias} dias para ser treinada. O áudio está ` +
        `certo e já validado: o que falta é crédito na conta.`,
      "",
      `Treinar uma voz custa ${custoTreino.toLocaleString("pt-BR")} créditos e ` +
        `hoje a sua conta tem ${voz.saldo.toLocaleString("pt-BR")}.`,
      "",
      `Para destravar: ${ASSINAR_URL}`,
      "",
      `Assim que o crédito entrar, é só abrir ${PAINEL_URL}, clicar na sua voz ` +
        `e clicar em "Iniciar treinamento".`,
      "",
      guardado,
      "",
      `Qualquer dúvida, responde este e-mail.`,
    ].join("\n"),
  };
}

/** Manda o lembrete. Devolve o que aconteceu — nunca lança por conta própria. */
export type EnviarLembrete = (voz: VozParada, texto: TextoLembrete) => Promise<void>;

/**
 * Decide e envia UM lembrete para UMA voz, respeitando a trava.
 *
 * Ordem proposital: corte de backfill → etapa devida → envia → grava. O
 * estado é gravado DEPOIS do envio mas marcando as etapas cobertas mesmo se o
 * envio falhar dentro do `enviar` (o caller decide se propaga) — repetir uma
 * carta é pior que perder uma, e a falha fica visível no log do sweep.
 */
export async function lembrarVoz(
  voz: VozParada,
  estado: EstadoLembretes,
  custoTreino: number,
  agora: Date,
  enviar: EnviarLembrete,
): Promise<ResultadoLembrete> {
  if (!voz.email || !voz.email.trim()) {
    return { enviou: false, motivo: "sem_email" };
  }
  if (antesDoCorte(voz.criadaEm)) {
    return { enviou: false, motivo: "antes_do_corte" };
  }

  const dias = diasParado(voz.criadaEm, agora);
  const jaEnviadas = estado[voz.voiceId]?.etapas ?? [];
  const etapa = etapaDevida(dias, jaEnviadas);
  if (etapa == null) {
    return {
      enviou: false,
      motivo: jaEnviadas.length > 0 ? "ja_lembrada" : "nova_demais",
    };
  }

  const texto = montarLembrete(voz, dias, custoTreino);
  await enviar(voz, texto);

  // Marca TUDO que já venceu, não só a etapa enviada — ver `etapasCobertas`.
  const cobertas = Array.from(new Set([...jaEnviadas, ...etapasCobertas(dias)])).sort(
    (a, b) => a - b,
  );
  estado[voz.voiceId] = { etapas: cobertas, at: agora.toISOString(), email: voz.email };

  return { enviou: true, etapa, comSaldo: temSaldo(voz, custoTreino) };
}
