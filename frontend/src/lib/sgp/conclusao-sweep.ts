/**
 * SGP — o FECHAMENTO AUTOMÁTICO do atendimento, 7 dias depois da ENTREGA.
 *
 * *"'Concluir atendimento' automático 7 dias após ENTREGUE sem reclamação."*
 * (Johnny, recado 6, requisito 5)
 *
 * A RÉGUA NÃO MORA AQUI. Quem decide é `conclusaoAutomatica` (painel.ts), que é
 * pura e já estava escrita e testada — este módulo é só o BRAÇO: lê a fila, roda
 * a régua, e escreve. Mesma divisão de `cobranca.ts` × `painel.ts`, e pelo mesmo
 * motivo: a decisão tem que ser testável sem banco.
 *
 * ── ⚠️ ISTO NASCE DESLIGADO, E A RAZÃO NÃO É COVARDIA ───────────────────────
 * `painel.ts` deixou a régua propositalmente sem braço, com esta justificativa
 * escrita: *"concluir automaticamente é uma ação irreversível do ponto de vista
 * do time (o caso sai do radar), e ela depende da definição final de 'entregue',
 * que tem uma perna em aberto (o estado ACESSÍVEL)"*. A perna continua aberta:
 * medido em 15/09, 42 dos 81 alunos avisados NÃO tinham acesso vivo — eles foram
 * avisados de um material que não conseguem abrir, e para a régua dos 7 dias
 * isso hoje é indistinguível de um caso resolvido.
 *
 * Então o braço existe, inteiro e testado, e o interruptor é do Johnny:
 *
 *   SGP_CONCLUSAO_AUTOMATICA=1   → grava
 *   (ausente, o padrão)          → ENSAIO: conta e relata, não escreve nada
 *
 * O ensaio não é enfeite — é como se descobre, com números do banco vivo e sem
 * risco, QUANTOS casos fechariam e QUEM são, antes de decidir. Ligar depois é
 * uma variável de ambiente, sem deploy.
 *
 * ── O QUE ESTE MÓDULO NÃO FAZ, e cada "não" tem um motivo ───────────────────
 *  · NÃO manda e-mail, WhatsApp ou qualquer contato ao aluno. Fechar um
 *    atendimento é anotação interna; a regra da casa é que o sistema NUNCA
 *    aborda aluno sozinho.
 *  · NÃO mexe em `status`. `status` é a máquina de estados da PRODUÇÃO, e
 *    `lib/sgp/fracasso.ts` dispara e-mail e chama o grupo nas transições dela.
 *    É a mesma regra que a rota de conclusão manual já segue.
 *  · NÃO esconde a linha. Ela continua na tabela, com o "parado há" contando a
 *    verdade e `situacaoPorBaixo` dizendo o que o pedido realmente é.
 *  · NÃO fecha quem não foi avisado, quem tem erro (do sistema ou do time), nem
 *    quem já foi concluído por gente — isso tudo é `conclusaoAutomatica`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SGP_CONCLUSAO_AUTOMATICA_AUTOR,
  SGP_CONCLUSAO_AUTOMATICA_DIAS,
  conclusaoAutomatica,
  lerAviso,
} from "./painel.ts";
import type { SgpPedidoRow } from "./types.ts";
import {
  COLUNAS_AVISO,
  COLUNAS_CONCLUSAO,
  COLUNAS_CONCLUSAO_AUTO,
  colunaConclusaoAutomaticaAusente,
  criarFilaComFallback,
} from "./cobranca.ts";
import { buscarAvisos } from "./aviso.ts";

/**
 * Quantos casos um único ensaio/varredura pode fechar.
 *
 * Existe por causa da PRIMEIRA execução: hoje há uma fila inteira de pedidos
 * entregues há semanas, e todos venceriam os 7 dias no mesmo instante. Fechar 80
 * de uma vez é indistinguível, pra quem olha a tela, de um defeito que apagou a
 * fila. Com o teto, o primeiro dia fecha 25, o Johnny olha, e o resto vem nos
 * dias seguintes — ou não vem, se ele desligar.
 *
 * ⚠️ O que o teto deixou pra trás SAI NO RELATÓRIO (`adiados`) e no log. Teto que
 * não se anuncia é pior que teto nenhum: a varredura diria "3 fechados" e quem
 * lesse concluiria que só havia 3 elegíveis.
 */
export const CONCLUSAO_AUTOMATICA_TETO_POR_VARREDURA = 25;

/** Quantos pedidos a varredura examina por rodada. A tabela tem ~270 linhas. */
const LIMITE_LEITURA = 500;

export type ConclusaoAutomaticaSumario = {
  /** `false` = ENSAIO: nada foi escrito, os números são do que fecharia. */
  ligado: boolean;
  /**
   * `false` = a migration 110 não está aplicada, então não existe onde gravar.
   * Nesse caso a varredura é inerte por completo e diz por quê.
   */
  disponivel: boolean;
  /** Pedidos em `pronto` examinados nesta rodada. */
  examinados: number;
  /** Quantos a régua aprovaria pra fechar. */
  elegiveis: number;
  /** Quantos foram REALMENTE gravados (sempre 0 no ensaio). */
  concluidos: number;
  /** Elegíveis que ficaram pra próxima rodada por causa do teto. */
  adiados: number;
  /** Falhas de escrita. A próxima varredura tenta de novo. */
  erros: number;
  /**
   * Quem fecharia/fechou, pra o relatório sair com nome e não só com número.
   * Limitado ao teto, pelo mesmo motivo que a escrita é.
   */
  casos: Array<{ id: string; email: string | null; motivo: string }>;
  /** Por que a varredura não escreveu nada, quando não escreveu. */
  observacao?: string;
};

/** O interruptor. Ausente = ensaio, que é o padrão seguro. */
export function conclusaoAutomaticaLigada(): boolean {
  const bruto = (process.env.SGP_CONCLUSAO_AUTOMATICA ?? "").trim().toLowerCase();
  return bruto === "1" || bruto === "true" || bruto === "sim";
}

/** As colunas que a régua precisa ler. Segredo de sessão fica de fora, como na rota. */
const COLUNAS_BASE = [
  "id",
  "email",
  "status",
  "criado_em",
  "atualizado_em",
  "enviado_em",
  "erro",
  "erro_manual_em",
  "user_id",
];

/**
 * A varredura. NUNCA LANÇA: devolve o sumário com `erros` preenchido.
 *
 * Roda pendurada no cron de 5min (`/api/v1/agent/sweep-clones`), como as outras
 * varreduras da casa. Derrubar aquele cron por causa de uma anotação de suporte
 * seria trocar um recurso acessório por vários essenciais.
 */
export async function varrerConclusaoAutomatica(
  admin: SupabaseClient<never>,
  agora: number = Date.now(),
): Promise<ConclusaoAutomaticaSumario> {
  const ligado = conclusaoAutomaticaLigada();
  const vazio = (extra: Partial<ConclusaoAutomaticaSumario>): ConclusaoAutomaticaSumario => ({
    ligado,
    disponivel: false,
    examinados: 0,
    elegiveis: 0,
    concluidos: 0,
    adiados: 0,
    erros: 0,
    casos: [],
    ...extra,
  });

  // A leitura cai grupo a grupo enquanto as migrations não entram — a mesma
  // régua (e o mesmo memo) que a rota do painel usa. `erro_manual_em` fica na
  // base porque a 109 JÁ está aplicada (registrado na 110).
  const buscar = criarFilaComFallback<SgpPedidoRow>(
    (colunas) =>
      admin
        .from("sgp_pedidos" as never)
        .select(colunas)
        .eq("status", "pronto")
        .order("atualizado_em", { ascending: true })
        .limit(LIMITE_LEITURA) as unknown as Promise<{ data: SgpPedidoRow[] | null; error: unknown }>,
    COLUNAS_BASE,
    [
      { nome: "conclusao", colunas: COLUNAS_CONCLUSAO },
      { nome: "conclusaoAuto", colunas: COLUNAS_CONCLUSAO_AUTO },
      { nome: "aviso", colunas: COLUNAS_AVISO },
    ],
  );

  let pedidos: SgpPedidoRow[];
  let temConclusao: boolean;
  let temFlagAuto: boolean;
  try {
    const { data, error, disponivel } = await buscar();
    if (error) {
      return vazio({
        erros: 1,
        observacao: `não consegui ler a fila: ${mensagem(error)}`,
      });
    }
    pedidos = data ?? [];
    temConclusao = !!disponivel.conclusao;
    temFlagAuto = !!disponivel.conclusaoAuto;
  } catch (e) {
    return vazio({ erros: 1, observacao: `não consegui ler a fila: ${mensagem(e)}` });
  }

  // Sem a 110 não existe `concluido_em`: não dá pra gravar E não dá nem pra
  // saber quem já foi concluído por gente. Fica INERTE, e diz por quê — em vez
  // de rodar a régua sobre um dado que não tem como estar certo.
  if (!temConclusao) {
    return vazio({
      examinados: pedidos.length,
      observacao:
        "a migration 110 (concluir atendimento) não está aplicada: não há coluna onde gravar, " +
        "e sem ela não dá pra saber quem o time já concluiu. A varredura fica inerte até ela entrar.",
    });
  }

  const avisos = await buscarAvisos(admin, pedidos);

  const elegiveis: Array<{ p: SgpPedidoRow; motivo: string }> = [];
  for (const p of pedidos) {
    const aviso = lerAviso(p, avisos.get(p.id) ?? null, agora);
    const v = conclusaoAutomatica(p, aviso, agora);
    if (v.conclui) elegiveis.push({ p, motivo: v.motivo });
  }

  const alvos = elegiveis.slice(0, CONCLUSAO_AUTOMATICA_TETO_POR_VARREDURA);
  const adiados = elegiveis.length - alvos.length;
  const casos = alvos.map(({ p, motivo }) => ({ id: p.id, email: p.email, motivo }));

  const base: ConclusaoAutomaticaSumario = {
    ligado,
    disponivel: true,
    examinados: pedidos.length,
    elegiveis: elegiveis.length,
    concluidos: 0,
    adiados,
    erros: 0,
    casos,
  };

  if (!ligado) {
    return {
      ...base,
      observacao:
        `ENSAIO: ${elegiveis.length} atendimento(s) fechariam sozinhos agora ` +
        `(${SGP_CONCLUSAO_AUTOMATICA_DIAS} dias após a entrega, sem reclamação). ` +
        "Nada foi gravado. Pra ligar de verdade: SGP_CONCLUSAO_AUTOMATICA=1.",
    };
  }

  let concluidos = 0;
  let erros = 0;
  for (const { p, motivo } of alvos) {
    try {
      const ok = await gravar(admin, p.id, motivo, temFlagAuto);
      if (ok) concluidos += 1;
    } catch (e) {
      erros += 1;
      console.error("[sgp/conclusao-automatica] falhei em", p.id, mensagem(e));
    }
  }
  return { ...base, concluidos, erros };
}

/**
 * Grava UMA conclusão automática.
 *
 * ⚠️ O `.is("concluido_em", null)` NÃO é decoração. Entre a leitura e a escrita
 * cabe um atendente clicando em "Concluir" com o motivo dele escrito; sem a
 * guarda, a varredura sobrescreveria a declaração de uma pessoa por uma do
 * relógio, e o rastro de quem tratou o caso sumiria. Na corrida, quem chegou
 * primeiro fica.
 *
 * Devolve `false` quando a linha já não se qualificava (alguém chegou antes) —
 * que não é erro e não pode contar como erro.
 */
async function gravar(
  admin: SupabaseClient<never>,
  id: string,
  motivo: string,
  temFlagAuto: boolean,
): Promise<boolean> {
  const update: Record<string, unknown> = {
    concluido_em: new Date().toISOString(),
    concluido_por: SGP_CONCLUSAO_AUTOMATICA_AUTOR,
    concluido_motivo: motivo,
  };
  if (temFlagAuto) update.concluido_automatico = true;

  const executar = (corpo: Record<string, unknown>) =>
    admin
      .from("sgp_pedidos" as never)
      .update(corpo as never)
      .eq("id", id)
      .is("concluido_em", null)
      .select("id");

  let { data, error } = await executar(update);
  // A 119 pode ter sumido do schema cache entre a leitura e agora. Repete sem a
  // coluna em vez de perder a conclusão: o sentinela em `concluido_por` mantém a
  // tela honesta sozinho (ver SGP_CONCLUSAO_AUTOMATICA_AUTOR).
  if (error && temFlagAuto && colunaConclusaoAutomaticaAusente(error)) {
    const semFlag = { ...update };
    delete semFlag.concluido_automatico;
    ({ data, error } = await executar(semFlag));
  }
  if (error) throw new Error(mensagem(error));
  return !!data && (data as unknown[]).length > 0;
}

function mensagem(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return String(e);
}
