/**
 * SGP — a SESSÃO do wizard. Server-only.
 *
 * 29/08 (Johnny): a conta na plataforma só nasce no "Confirmar e Enviar".
 * Até lá o dono do pedido é um uuid num cookie httpOnly: ele identifica o
 * pedido, as fotos e os áudios que já subiram, e some quando a conta assume.
 */
import { cookies } from "next/headers";
import { getAdmin } from "@/lib/db/admin";
import type { CandidatoRetomada } from "./retomada-pure";
import type { SgpFoto, SgpPedidoRow } from "./types";

export const SGP_COOKIE = "sgp_sessao";
const MAX_IDADE = 60 * 60 * 24 * 30; // 30 dias

/** A sessão do navegador, se existir. Não cria nada. */
export async function sessaoAtual(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(SGP_COOKIE)?.value?.trim();
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/** Abre o pedido desta sessão, criando sessão + linha se for a primeira vez. */
export async function pedidoDaSessao(): Promise<SgpPedidoRow> {
  const atual = await sessaoAtual();
  if (atual) {
    const p = await lerPorSessao(atual);
    if (p) return p;
  }
  const admin = getAdmin();
  const { data, error } = await admin
    .from("sgp_pedidos" as never)
    .insert({ status: "dados" } as never)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "não consegui abrir o pedido");
  const novo = data as SgpPedidoRow;
  await plantarSessao(novo.sessao);
  return novo;
}

/**
 * Grava o cookie da sessão. Só pode ser chamado de Route Handler ou Server
 * Action — Server Component em render não escreve cookie (Next.js).
 * É por AQUI que a retomada reaponta o navegador pra linha canônica
 * (POST /api/v1/sgp/retomar): só o cookie muda, nenhuma linha é tocada.
 */
export async function plantarSessao(sessao: string): Promise<void> {
  const c = await cookies();
  c.set(SGP_COOKIE, sessao, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_IDADE,
  });
}

/**
 * As linhas deste e-mail que podem disputar uma retomada — SÓ LEITURA, e já
 * no formato que a decisão pura (`lib/sgp/retomada-pure.ts`) consome. Quem
 * filtra (em andamento, verificado, sem conta) e escolhe é o módulo puro;
 * aqui é só a busca. `.limit(50)` explícito: o teto silencioso de 1000 linhas
 * do Supabase já enviesou amostra antes, e nenhum e-mail honesto tem 50
 * pedidos.
 */
export async function candidatosPorEmail(email: string): Promise<CandidatoRetomada[]> {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return [];
  const { data, error } = await getAdmin()
    .from("sgp_pedidos" as never)
    .select("id, sessao, status, fotos, atualizado_em, email_verificado_at, user_id")
    .ilike("email", alvo)
    .limit(50);
  if (error) throw new Error(error.message);
  type Linha = Pick<
    SgpPedidoRow,
    "id" | "sessao" | "status" | "fotos" | "atualizado_em" | "email_verificado_at" | "user_id"
  >;
  return ((data as Linha[] | null) ?? []).map((l) => ({
    id: l.id,
    sessao: l.sessao,
    status: l.status,
    fotosAprovadas: ((l.fotos ?? []) as SgpFoto[]).filter((f) => f.status === "aprovada").length,
    atualizadoEm: l.atualizado_em,
    emailVerificadoAt: l.email_verificado_at,
    userId: l.user_id,
  }));
}

/** O pedido desta sessão — null quando o navegador ainda não começou. */
export async function pedidoDaSessaoOuNull(): Promise<SgpPedidoRow | null> {
  const s = await sessaoAtual();
  return s ? lerPorSessao(s) : null;
}

async function lerPorSessao(sessao: string): Promise<SgpPedidoRow | null> {
  const { data, error } = await getAdmin()
    .from("sgp_pedidos" as never)
    .select("*")
    .eq("sessao", sessao)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SgpPedidoRow | null) ?? null;
}

export async function atualizarSessao(
  sessao: string,
  patch: Partial<SgpPedidoRow>,
): Promise<void> {
  const { error } = await getAdmin()
    .from("sgp_pedidos" as never)
    .update(patch as never)
    .eq("sessao", sessao);
  if (error) throw new Error(error.message);
}

/** Some com o cookie — chamado depois que a conta assume o pedido. */
export async function encerrarSessao(): Promise<void> {
  const c = await cookies();
  c.delete(SGP_COOKIE);
}
