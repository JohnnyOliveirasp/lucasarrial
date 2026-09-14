/**
 * PERGUNTAR AO DNS em vez de interpretar a prosa do bounce. Tem IO (`node:dns`),
 * por isso vive fora do `mail-bounce.ts`, que é puro — o que este arquivo
 * devolve é um `VeredictoDns`, e o SIGNIFICADO dele pra classe mora lá, testável
 * sem rede.
 *
 * POR QUE EXISTE (chamado #402, medido 14/09). O classificador decidia falha de
 * MX pela FRASE, e essa corrida a gente perde sempre: o `mail-bounce.ts` foi
 * remendado duas vezes em 13/09 pelo mesmo motivo e furou de novo no dia
 * seguinte, porque o Google escreve "No MX server found" e o padrão exigia
 * "no mx record|hosts". Resultado: `guitaschetti@pradocomunicacao.com` quicou
 * duas vezes (21:55 e 22:10) com um bounce PERMANENTE — o domínio não tem MX
 * nem A — e a casa arquivou como "desconhecida". Um terceiro remendo no regex
 * seria a mesma aposta pela terceira vez.
 *
 * ⚠️ AS DUAS ARMADILHAS DESTE ARQUIVO (as duas já custaram caro):
 *
 *  1. MX NULO NÃO É "SEM MX", E NÃO PODE CAIR NO A. `gmail.com.br` publica MX
 *     nulo (RFC 7505) E TEM registro A (142.251.34.133, medido). Quem tratasse
 *     o MX nulo como "não achei MX" e caísse no A implícito (RFC 5321) diria
 *     que o domínio é alcançável — e ele é o exemplo canônico de domínio que
 *     declara que NÃO aceita e-mail. Por isso MX nulo retorna na hora.
 *
 *  2. MX NULO SE MEDE PELO ALVO EXATO, NUNCA PELO PONTO FINAL. Null MX é alvo
 *     `.` (a raiz) SOZINHO. `0 pradocomunicacao.com.br.` é MX auto-apontado,
 *     normalíssimo, e esse domínio ENTREGA e-mail — foi lido como nulo numa
 *     ronda e quase declarou um aluno inalcançável quando 7 mensagens nossas
 *     já tinham chegado nele. Aqui o alvo só é nulo se for exatamente "." ou
 *     vazio (o `node:dns` devolve `exchange: ""` nesse caso, medido).
 *
 * ⚠️ E O QUE ESTE ARQUIVO SE PROÍBE: NUNCA lançar e NUNCA chutar. Resolvedor
 * fora do ar, SERVFAIL ou timeout devolvem `indeterminado`, que não muda classe
 * nenhuma — ignorância não pode virar veredito permanente contra um aluno
 * alcançável. E como ele roda dentro da varredura (`tratarSeForBounce` nunca
 * lança, senão a fila trava), qualquer erro aqui devolve o bounce intacto.
 */
import { promises as dns } from "node:dns";
import {
  dominioDoEmail,
  classeComDns,
  pareceFalhaDeMx,
  type Bounce,
  type DestinatarioQueFalhou,
  type VeredictoDns,
  // Extensão explícita: é o que deixa este arquivo rodar sob `node --test` sem
  // bundler, igual ao resto do `src/lib` (allowImportingTsExtensions).
} from "./mail-bounce.ts";

/** Teto por consulta. O `node:dns` tem timeout próprio e generoso; a varredura não pode ficar pendurada nele. */
const TIMEOUT_MS = 4000;

/**
 * A porta de saída, injetável — é o que torna a regra testável sem rede (e sem
 * depender de um domínio de terceiro continuar publicando o que publica hoje).
 */
export type Resolvedor = {
  /** Registros MX. Deve LANÇAR com `.code` (ENOTFOUND/ENODATA/ESERVFAIL...) como o `node:dns`. */
  mx(dominio: string): Promise<Array<{ exchange: string; priority: number }>>;
  /** A/AAAA — o MX implícito do RFC 5321 §5.1. */
  ips(dominio: string): Promise<string[]>;
};

/** Código de erro de DNS que significa "perguntei e não existe", não "não consegui perguntar". */
function ehAusencia(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code ?? "";
  return code === "ENOTFOUND" || code === "ENODATA";
}

function comTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_r, rej) => {
    t = setTimeout(() => rej(Object.assign(new Error("dns timeout"), { code: "ETIMEOUT" })), ms);
    // Não segurar o processo por causa de uma consulta pendente.
    (t as unknown as { unref?: () => void }).unref?.();
  });
  return Promise.race([p, limite]).finally(() => {
    if (t) clearTimeout(t);
  }) as Promise<T>;
}

export const resolvedorReal: Resolvedor = {
  mx: (dominio) => comTimeout(dns.resolveMx(dominio)),
  ips: async (dominio) => {
    // Os dois erros importam: só é "sem registro" se A e AAAA disserem ausência.
    const v4 = await comTimeout(dns.resolve4(dominio)).then(
      (r) => ({ ok: true as const, r }),
      (e) => ({ ok: false as const, e }),
    );
    const v6 = await comTimeout(dns.resolve6(dominio)).then(
      (r) => ({ ok: true as const, r }),
      (e) => ({ ok: false as const, e }),
    );
    if (v4.ok || v6.ok) return [...(v4.ok ? v4.r : []), ...(v6.ok ? v6.r : [])];
    // Ausência só vale se ambos concordarem; senão propaga o erro "duro", que
    // vira `indeterminado` lá em cima.
    throw ehAusencia(v4.e) && !ehAusencia(v6.e) ? v6.e : v4.e;
  },
};

/** Alvo de MX nulo (RFC 7505): a raiz, SOZINHA. Ver armadilha 2 no topo. */
function ehAlvoNulo(exchange: string): boolean {
  const alvo = (exchange || "").trim();
  return alvo === "" || alvo === ".";
}

/** Domínio plausível pra consultar. Nome sem ponto não recebe e-mail, mas também não é prova de nada. */
function vaiAPerguntar(dominio: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(dominio);
}

/**
 * O domínio recebe e-mail? Determinístico e igual pra qualquer provedor — é o
 * ponto inteiro do #402.
 */
export async function veredictoDoDominio(dominio: string, r: Resolvedor = resolvedorReal): Promise<VeredictoDns> {
  if (!vaiAPerguntar(dominio)) return "indeterminado";

  let mx: Array<{ exchange: string; priority: number }> | null = null;
  try {
    mx = await r.mx(dominio);
  } catch (e) {
    // NXDOMAIN/sem MX: ainda pode haver A (MX implícito). Qualquer outro erro é
    // ignorância nossa, não ausência dele.
    if (!ehAusencia(e)) return "indeterminado";
  }

  if (mx && mx.length > 0) {
    // ⚠️ MX nulo responde AQUI e não cai pro A — ver armadilha 1 no topo.
    if (mx.every((linha) => ehAlvoNulo(linha.exchange))) return "sem-registro";
    return "resolve";
  }

  try {
    const ips = await r.ips(dominio);
    return ips.length > 0 ? "resolve" : "sem-registro";
  } catch (e) {
    return ehAusencia(e) ? "sem-registro" : "indeterminado";
  }
}

/**
 * Reavalia as classes do bounce à luz do DNS de verdade.
 *
 * Só consulta quando o próprio relatório culpou MX/DNS: bounce de caixa cheia
 * não vira consulta, e o custo no caso comum é ZERO. Uma consulta por DOMÍNIO
 * (um relatório de spam de saída derruba vários endereços do mesmo domínio de
 * uma vez).
 *
 * NUNCA lança: devolve o bounce como estava se o DNS não cooperar.
 */
export async function refinarPorDns(bounce: Bounce, r: Resolvedor = resolvedorReal): Promise<Bounce> {
  try {
    const alvos = bounce.destinatarios.filter((d) => pareceFalhaDeMx(d.diagnostico));
    if (!alvos.length) return bounce;

    const porDominio = new Map<string, VeredictoDns>();
    for (const dominio of new Set(alvos.map((d) => dominioDoEmail(d.email)))) {
      porDominio.set(dominio, await veredictoDoDominio(dominio, r));
    }

    const destinatarios: DestinatarioQueFalhou[] = bounce.destinatarios.map((d) => {
      if (!pareceFalhaDeMx(d.diagnostico)) return d;
      const veredito = porDominio.get(dominioDoEmail(d.email));
      if (!veredito) return d;
      return { ...d, dns: veredito, classe: classeComDns(d.classe, d.diagnostico, veredito) };
    });

    return { ...bounce, destinatarios };
  } catch (e) {
    console.error("[agent/bounce] DNS não respondeu, mantendo a classe do texto:", e instanceof Error ? e.message : e);
    return bounce;
  }
}
