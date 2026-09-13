/**
 * A consulta de DNS que responde "o domínio do comprador aceita e-mail?".
 *
 * ⚠️ ARQUIVO SEM NENHUM IMPORT DO PROJETO, e isso é o ponto dele. Ele nasceu
 * dentro de `sgp-boas-vindas-canal.ts` e saiu de lá porque aquele arquivo
 * importa `@/lib/db/admin` e `@/lib/agent/mail-smtp` — o runner `node --test`
 * não resolve o alias `@/`, então a consulta de verdade ficava INTESTÁVEL e só
 * o dublê dos testes era exercitado. Aqui só entra `node:dns`, e por isso
 * `sgp-mx.test.ts` roda ESTA função contra o DNS de verdade.
 *
 * O tipo de retorno é estrutural de propósito (não importa `RespostaDns` de
 * `sgp-boas-vindas.ts`): o TypeScript casa os dois no ponto em que o canal é
 * montado, e este arquivo continua carregável sem alias.
 *
 * A classificação (o que significa não ter MX) NÃO mora aqui — ela é pura e
 * mora em `sgp-boas-vindas.ts`, testada sem rede. Aqui só se pergunta ao DNS.
 */
import { Resolver } from "node:dns/promises";

/**
 * Teto de tempo da consulta, em ms.
 *
 * Envio de e-mail dentro de um webhook NÃO pode ficar pendurado esperando
 * resolver nome. São dois tetos somados de propósito: o do próprio resolver
 * (c-ares, com `tries: 1` pra não multiplicar o tempo por tentativa) e uma
 * corrida externa, porque o timeout do c-ares cobre a query mas não cobre um
 * socket que nunca volta.
 */
export const TIMEOUT_DNS_MS = 3_000;

/** Códigos que significam "o DNS RESPONDEU: não tem isso aqui", não "falhou". */
const RESPOSTA_VAZIA = new Set(["ENODATA", "ENOTFOUND"]);

export function codigoDoErro(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "";
}

/** Corrida com relógio. Qualquer promessa que passar do teto vira erro. */
export async function comTeto<T>(p: Promise<T>, ms: number, oQue: string): Promise<T> {
  let alarme: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, rejeitar) => {
        alarme = setTimeout(() => rejeitar(new Error(`timeout de ${ms}ms em ${oQue}`)), ms);
      }),
    ]);
  } finally {
    if (alarme) clearTimeout(alarme);
  }
}

/**
 * O domínio tem A ou AAAA? Só é perguntado quando NÃO há MX, porque é aí que a
 * resposta muda alguma coisa: pela RFC 5321 §5.1 um domínio sem MX mas com
 * endereço ainda recebe e-mail pelo "MX implícito", e chamar isso de
 * indereçável seria inventar um problema.
 */
export async function temEnderecoIp(resolver: ResolvedorMinimo, dominio: string): Promise<boolean> {
  for (const consulta of [() => resolver.resolve4(dominio), () => resolver.resolve6(dominio)]) {
    try {
      const r = await comTeto(consulta(), TIMEOUT_DNS_MS, `A/AAAA de ${dominio}`);
      if (r.length > 0) return true;
    } catch (e) {
      // Resposta vazia é resposta: continua pra próxima família. Falha de
      // verdade sobe, e o orquestrador lê como "não sei".
      if (!RESPOSTA_VAZIA.has(codigoDoErro(e))) throw e;
    }
  }
  return false;
}

/**
 * Consulta o DNS do domínio do destinatário.
 *
 * NXDOMAIN (`ENOTFOUND`) na consulta de MX já responde as DUAS perguntas: o
 * domínio não existe, então não há MX nem A. Por isso ele curto-circuita em vez
 * de gastar mais duas consultas. `ENODATA` é diferente — o domínio existe e só
 * não publica MX — e aí o MX implícito precisa ser conferido.
 *
 * Qualquer outro erro (SERVFAIL, REFUSED, timeout) SOBE. Ele não é resposta, e
 * o chamador é obrigado a tratar isso como "não sei" e seguir com o envio.
 */
export type RespostaDnsCrua = {
  mx: { exchange: string; priority: number }[];
  temEndereco: boolean | null;
};

/** O mínimo do `Resolver` que este módulo usa — o seam que os testes injetam. */
export type ResolvedorMinimo = Pick<Resolver, "resolveMx" | "resolve4" | "resolve6">;

export async function resolverDnsDoDominio(
  dominio: string,
  // Seam de TESTE, e só isso: o default é o resolver de verdade, então o
  // caminho de produção não tem ramo nenhum a mais. Existe porque os códigos
  // que decidem tudo aqui (ENODATA × ENOTFOUND × SERVFAIL) não dá pra provocar
  // de propósito contra o DNS público.
  criarResolvedor: () => ResolvedorMinimo = () => new Resolver({ timeout: TIMEOUT_DNS_MS, tries: 1 }),
): Promise<RespostaDnsCrua> {
  const resolver = criarResolvedor();
  let mx: { exchange: string; priority: number }[];
  try {
    mx = await comTeto(resolver.resolveMx(dominio), TIMEOUT_DNS_MS, `MX de ${dominio}`);
  } catch (e) {
    const codigo = codigoDoErro(e);
    if (codigo === "ENOTFOUND") return { mx: [], temEndereco: false };
    if (codigo !== "ENODATA") throw e;
    mx = [];
  }
  if (mx.length > 0) {
    // Com MX, o A/AAAA não muda nada — e consulta que não muda decisão não se
    // faz dentro de um webhook.
    return { mx, temEndereco: null };
  }
  return { mx: [], temEndereco: await temEnderecoIp(resolver, dominio) };
}

