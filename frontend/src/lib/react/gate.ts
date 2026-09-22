/**
 * Quem pode usar o React.
 *
 * Até 22/09 as 5 rotas do wizard eram `gateAdmin` — o produto vivia na
 * pré-produção. Com a ordem do Johnny de liberar pros alunos, elas passam por
 * aqui: qualquer pessoa LOGADA entra, e o freio vira o CRÉDITO, que é a regra
 * da casa ("crédito é o único gate").
 *
 * Devolve o mesmo formato do `gateAdmin` (`{ auth }` ou `{ res }`) de
 * propósito: as rotas não precisaram ser reescritas, só trocar a chamada.
 */
import type { NextRequest } from "next/server";
import { authenticate, type AuthResult } from "@/lib/api/auth";
import { unauthorized } from "@/lib/api/responses";

export type ReactGate = { auth: NonNullable<AuthResult> } | { res: Response };

export async function gateReact(request: NextRequest): Promise<ReactGate> {
  const auth = await authenticate(request);
  if (!auth) return { res: unauthorized() };
  return { auth };
}
