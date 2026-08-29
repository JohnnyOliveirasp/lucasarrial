/**
 * Leitura do pedido pelo DONO DA CONTA (server-only).
 * O wizard em si roda por sessão (lib/sgp/sessao.ts) — isto aqui serve pro
 * acompanhamento em /app/sgp, depois que a conta assumiu o pedido.
 */
import { getAdmin } from "@/lib/db/admin";
import type { SgpPedidoRow } from "./types";

export async function lerPedido(userId: string): Promise<SgpPedidoRow | null> {
  const { data, error } = await getAdmin()
    .from("sgp_pedidos" as never)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SgpPedidoRow | null) ?? null;
}

/**
 * O pedido do aluno logado, criando a linha se ela não existir.
 *
 * 29/08: o Johnny fez as fotos numa conta, entrou com OUTRA no mesmo browser
 * e o upload de áudio morreu com "Comece pela tela de dados" — mensagem certa
 * e inútil. Quem está autenticado sempre tem por onde continuar; o portão de
 * verdade é o `concluir` de cada etapa, que confere o material.
 */
export async function lerOuCriarPedido(userId: string): Promise<SgpPedidoRow> {
  const atual = await lerPedido(userId);
  if (atual) return atual;
  const { error } = await getAdmin()
    .from("sgp_pedidos" as never)
    .insert({ user_id: userId, status: "foto" } as never);
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  const criado = await lerPedido(userId);
  if (!criado) throw new Error("não consegui abrir o seu pedido");
  return criado;
}

