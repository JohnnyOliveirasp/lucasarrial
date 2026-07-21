/**
 * Auth do agente de monitoramento (rotina agendada): token dedicado no header
 * x-agent-token, comparado com AGENT_MONITOR_TOKEN do servidor. Escopo restrito
 * aos endpoints /api/v1/agent/* — se vazar, revoga trocando a env, sem afetar
 * usuários nem admins.
 */
import type { NextRequest } from "next/server";

export function agentTokenOk(request: NextRequest): boolean {
  const expected = process.env.AGENT_MONITOR_TOKEN;
  const got = request.headers.get("x-agent-token");
  return Boolean(expected && got && got === expected);
}
