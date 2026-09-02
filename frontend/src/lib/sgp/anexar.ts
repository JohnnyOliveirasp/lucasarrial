/**
 * SGP — anexar foto/áudio ao pedido SEM perder o que subiu junto (#238).
 *
 * NÃO existe mais "ler o array, concatenar em JS e gravar por cima". Aquilo era
 * um lost update: o route lia `pedido.fotos`, esperava a impressão digital + a
 * chamada de visão (segundos) e só então gravava — e como o cliente sobe as
 * fotos em PARALELO, N requests liam o MESMO array e cada um gravava o seu de 1
 * item. Sobrava 1, as outras sumiam sem erro nenhum na tela. Medido: 16 objetos
 * no R2 contra 1 no banco (sessão 3e2a184d).
 *
 * Aqui a leitura, a decisão (teto, repetida) e a escrita acontecem dentro de uma
 * linha travada no Postgres — ver scripts/103_sgp_anexo_atomico.sql. Duas
 * requisições concorrentes viram fila, não corrida.
 */
import { getAdmin } from "@/lib/db/admin";
import { DHASH_LIMITE } from "./impressao-foto";
import { SGP_AUDIO_MAX_ARQUIVOS, SGP_FOTOS_MAX, type SgpAudio, type SgpFoto } from "./types";

/** Por que o anexo não entrou. Nenhum deles é silencioso: todos viram mensagem. */
export type MotivoRecusa = "sem_pedido" | "sem_key" | "repetida" | "max";

export type Anexo =
  | { ok: true; total: number }
  | { ok: false; motivo: MotivoRecusa; total?: number };

type RetornoSql = { ok?: boolean; reason?: string; total?: number } | null;

function ler(data: RetornoSql): Anexo {
  if (!data || typeof data !== "object") {
    // Sem resposta do banco não dá pra dizer que gravou. Falhar aqui é o
    // certo: o chamador devolve erro pro aluno em vez de um ✅ mentiroso.
    throw new Error("o banco não respondeu ao anexo");
  }
  if (data.ok) return { ok: true, total: data.total ?? 0 };
  const motivo = (data.reason ?? "sem_pedido") as MotivoRecusa;
  return { ok: false, motivo, total: data.total };
}

/**
 * Anexa UMA foto. O teto e o "já enviou esta foto" são decididos DENTRO da
 * trava, sobre o array de verdade — em JS eles voltariam a furar sob
 * concorrência (dois requests leem 5 fotos, os dois passam, grava 7).
 */
export async function anexarFoto(
  sessao: string,
  foto: SgpFoto,
  max: number = SGP_FOTOS_MAX,
): Promise<Anexo> {
  const { data, error } = await getAdmin().rpc("sgp_anexar_foto" as never, {
    p_sessao: sessao,
    p_foto: foto,
    p_max: max,
    p_dhash_limite: DHASH_LIMITE,
  } as never);
  if (error) throw new Error(error.message);
  return ler(data as RetornoSql);
}

/** Anexa UM áudio. Mesma trava; áudio não tem dedup (ver o .sql). */
export async function anexarAudio(
  sessao: string,
  audio: SgpAudio,
  max: number = SGP_AUDIO_MAX_ARQUIVOS,
): Promise<Anexo> {
  const { data, error } = await getAdmin().rpc("sgp_anexar_audio" as never, {
    p_sessao: sessao,
    p_audio: audio,
    p_max: max,
  } as never);
  if (error) throw new Error(error.message);
  return ler(data as RetornoSql);
}

/**
 * Tira uma foto do pedido numa instrução só. O DELETE antigo lia o array em JS
 * e gravava o filtrado — o que apagava, sem querer, a foto que um POST
 * concorrente tinha acabado de anexar.
 */
export async function removerFoto(sessao: string, key: string): Promise<void> {
  const { error } = await getAdmin().rpc("sgp_remover_foto" as never, {
    p_sessao: sessao,
    p_key: key,
  } as never);
  if (error) throw new Error(error.message);
}

export async function removerAudio(sessao: string, key: string): Promise<void> {
  const { error } = await getAdmin().rpc("sgp_remover_audio" as never, {
    p_sessao: sessao,
    p_key: key,
  } as never);
  if (error) throw new Error(error.message);
}

/** A mensagem que o aluno lê. Recusa sem motivo claro é o bug de novo. */
export function mensagemDaRecusaDeFoto(motivo: MotivoRecusa, max: number): string {
  switch (motivo) {
    case "repetida":
      return "Você já enviou esta foto. Escolha outra, de um ângulo diferente.";
    case "max":
      return `Máximo de ${max} fotos.`;
    case "sem_pedido":
      return "Comece pela tela de dados.";
    case "sem_key":
      return "Essa foto não é deste pedido";
  }
}

export function mensagemDaRecusaDeAudio(motivo: MotivoRecusa, max: number): string {
  switch (motivo) {
    case "max":
      return `Máximo de ${max} arquivos.`;
    case "sem_pedido":
      return "Comece pela tela de dados.";
    case "repetida":
    case "sem_key":
      return "Esse áudio não é deste pedido";
  }
}
