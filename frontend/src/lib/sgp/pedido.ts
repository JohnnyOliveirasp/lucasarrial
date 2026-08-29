/** Leitura/escrita do pedido do SGP (server-only, service role). */
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

export async function atualizarPedido(
  userId: string,
  patch: Partial<Omit<SgpPedidoRow, "id" | "user_id" | "criado_em" | "atualizado_em">>,
): Promise<void> {
  const { error } = await getAdmin()
    .from("sgp_pedidos" as never)
    .update(patch as never)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
