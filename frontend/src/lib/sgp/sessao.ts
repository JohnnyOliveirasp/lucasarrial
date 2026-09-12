/**
 * SGP — a SESSÃO do wizard. Server-only.
 *
 * 29/08 (Johnny): a conta na plataforma só nasce no "Confirmar e Enviar".
 * Até lá o dono do pedido é um uuid num cookie httpOnly: ele identifica o
 * pedido, as fotos e os áudios que já subiram, e some quando a conta assume.
 */
import { cookies } from "next/headers";
import { getAdmin } from "@/lib/db/admin";
import { noWizardAberto } from "./destino";
import type { SgpPedidoRow } from "./types";

export const SGP_COOKIE = "sgp_sessao";
const MAX_IDADE = 60 * 60 * 24 * 30; // 30 dias

/** A sessão do navegador, se existir. Não cria nada. */
export async function sessaoAtual(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(SGP_COOKIE)?.value?.trim();
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/**
 * Grava o cookie da sessão. Só pode ser chamado de Route Handler ou Server
 * Action — Server Component em render não escreve cookie (Next.js).
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
 * O pedido EM ABERTO deste e-mail, pra quem chegou sem cookie.
 *
 * É o conserto do beco sem saída da tela 1: sem isto, um navegador sem cookie
 * abre uma linha NOVA e o material que o aluno já tinha subido some da frente
 * dele (e a gente fica com duas linhas pro mesmo e-mail no /admin/sgp).
 *
 * DE PROPÓSITO só devolve pedido ainda no wizard e SEM `user_id`: pedido já
 * enviado pertence a uma conta, e conta se retoma com login — não digitando um
 * e-mail numa tela pública. Quem adota ainda precisa provar o e-mail com o
 * código de 6 dígitos (ver `POST /api/v1/sgp/inicio`); só o cookie não abre
 * nada.
 */
export async function pedidoAbertoPorEmail(email: string): Promise<SgpPedidoRow | null> {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return null;
  const { data, error } = await getAdmin()
    .from("sgp_pedidos" as never)
    .select("*")
    .ilike("email", alvo)
    .is("user_id", null)
    .order("atualizado_em", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const linha = (data as SgpPedidoRow[] | null)?.[0] ?? null;
  return linha && noWizardAberto(linha.status) ? linha : null;
}

/** O pedido de uma sessão específica (usado pela retomada por link). */
export async function pedidoPorSessao(sessao: string): Promise<SgpPedidoRow | null> {
  return lerPorSessao(sessao);
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
