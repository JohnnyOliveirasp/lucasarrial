/**
 * Transporte HTTP do Kie: chave, URL base, `createTask` COM RETENTATIVA em 429
 * e a tradução do erro cru pra mensagem do aluno. Server-only.
 *
 * Por que este arquivo existe separado do `client.ts`: aqui não entra NADA que
 * dependa do catálogo de modelos (`./config`). Sem imports relativos, o módulo
 * roda direto no `node --test` com type-stripping — mesma convenção dos outros
 * testes do repo (`lib/r2/client.ts`, `lib/agent/mail-charset.ts`). O
 * `client.ts` reexporta o que é público, então quem importa
 * `@/lib/kie/client` não muda uma linha.
 */

export const BASE = "https://api.kie.ai/api/v1/jobs";

export function key(): string {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error("Missing KIE_API_KEY");
  return k;
}

/**
 * Reconhece o throttle do Kie a partir da mensagem crua. Casa tanto o formato
 * nosso (`Kie 429: ...`) quanto o texto do provedor, que nem sempre traz o
 * número ("Your call frequency is too high").
 */
export function ehThrottleKie(low: string): boolean {
  return (
    low.includes("429") ||
    low.includes("call frequency") ||
    low.includes("rate limit") ||
    low.includes("too many requests")
  );
}

/**
 * Converte um erro cru do Kie numa mensagem amigável em pt-BR pro usuário final
 * (sem vazar detalhe técnico). Distingue "provedor sem saldo/limite" (problema
 * operacional nosso, NÃO do usuário) de erro temporário.
 */
export function friendlyKieError(raw: string): string {
  const low = raw.toLowerCase();
  // ⚠️ ORDEM IMPORTA: o teste de throttle vem ANTES do de saldo porque um 429
  // costuma vir escrito como "quota exceeded" — e "quota" cai na régua logo
  // abaixo, que culpa o SALDO do provedor. Na ordem inversa, uma fila cheia
  // seria anunciada como "limite do provedor", que é outro problema e manda o
  // suporte investigar o lugar errado.
  if (ehThrottleKie(low)) {
    return "Sistema congestionado no momento (muitas gerações ao mesmo tempo). Já tentamos algumas vezes automaticamente. Aguarde um ou dois minutos antes de tentar de novo.";
  }
  if (
    low.includes("402") ||
    low.includes("insufficient") ||
    low.includes("credit") ||
    low.includes("balance") ||
    low.includes("quota")
  ) {
    return "Serviço de vídeo indisponível no momento (limite do provedor). Tente novamente mais tarde.";
  }
  if (low.includes("internal error") || low.includes("500") || low.includes("timeout") || low.includes("temporar")) {
    return "O provedor de vídeo teve um erro temporário. Tente novamente em instantes.";
  }
  return "Não foi possível gerar o vídeo agora. Tente novamente.";
}

/**
 * Throttle do Kie (429) que sobreviveu a TODAS as retentativas.
 *
 * É uma classe pra que o chamador consiga distinguir "o provedor pediu pra
 * esperar" de "a geração falhou de verdade". Quem só quer a mensagem do aluno
 * continua passando `e.message` pro `friendlyKieError` normalmente.
 */
export class KieRateLimitError extends Error {
  readonly status = 429;
  constructor(message: string) {
    super(message);
    this.name = "KieRateLimitError";
  }
}

/** Espera entre tentativas: 3 retentativas DEPOIS da chamada original. */
const RETRY_DELAYS_MS = [2_000, 5_000, 12_000] as const;

/** Teto pro `Retry-After` do provedor — nunca segurar a request eternamente. */
const RETRY_AFTER_MAX_MS = 30_000;

/** Ganchos injetáveis só pra teste (sem eles, tempo e sorte de verdade). */
export type KieRetryHooks = {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** ±25% de jitter pra não sincronizar a retentativa de vários alunos no mesmo ms. */
function comJitter(baseMs: number, random: () => number): number {
  return Math.round(baseMs * (0.75 + random() * 0.5));
}

/**
 * Lê o `Retry-After` (segundos OU data HTTP). Devolve null quando ausente,
 * ilegível, no passado ou absurdo — o número do provedor é sugestão, não ordem.
 */
function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after");
  if (!raw) return null;
  const cru = raw.trim();
  if (cru === "") return null;
  const segundos = Number(cru);
  let ms: number;
  if (Number.isFinite(segundos)) {
    ms = segundos * 1000;
  } else {
    const quando = Date.parse(cru);
    if (Number.isNaN(quando)) return null;
    ms = quando - Date.now();
  }
  if (!(ms > 0)) return null;
  return Math.min(ms, RETRY_AFTER_MAX_MS);
}

/**
 * POST /createTask com retentativa em 429. Caminho ÚNICO de criação de task —
 * imagem e vídeo passam os dois por aqui, de propósito.
 *
 * ⚠️ O PORQUÊ (incidente 11/09, conta mcpaganatto@gmail.com): o Kie sinaliza
 * throttle com **HTTP 200** e `code: 429` NO CORPO ("Your call frequency is
 * too high"). Como `res.ok` é `true` nesse caso, o código antigo passava
 * limpo pela guarda de status, não achava `data.taskId` e lançava erro na
 * PRIMEIRA tentativa — o chamador marcava a cena `failed` e estornava. Deu 22
 * cenas destruídas num aluno só no mesmo dia, 16 delas no mesmo minuto: o
 * aluno via a falha na hora, reapertava, e alimentava o próprio rate-limit.
 *
 * Por isso a detecção precisa olhar os DOIS lugares — o status HTTP e o `code`
 * do corpo. Quem só testa `res.status === 429` não pega este bug.
 */
export async function postCreateTask(
  body: Record<string, unknown>,
  semTaskIdMsg: (code: unknown, msg: string) => string,
  hooks: KieRetryHooks = {},
): Promise<{ taskId: string }> {
  const sleep = hooks.sleep ?? realSleep;
  const random = hooks.random ?? Math.random;

  let ultimoThrottle = "Kie 429";
  for (let tentativa = 0; ; tentativa++) {
    const res = await fetch(`${BASE}/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let throttled = res.status === 429;

    if (!res.ok && !throttled) {
      // Erro real de transporte/servidor: comportamento idêntico ao de antes.
      const text = await res.text().catch(() => "");
      throw new Error(`Kie ${res.status}: ${text.slice(0, 400)}`);
    }

    if (throttled) {
      const text = await res.text().catch(() => "");
      ultimoThrottle = `Kie 429: ${text.slice(0, 200)}`.trim();
    } else {
      const json = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } };
      const taskId = json.data?.taskId;
      if (taskId) return { taskId };
      if (json.code === 429) {
        throttled = true;
        ultimoThrottle = `Kie 429: ${json.msg ?? ""}`.trim();
      } else {
        // Sem taskId e sem throttle: falha determinística, não adianta insistir.
        throw new Error(semTaskIdMsg(json.code, json.msg ?? ""));
      }
    }

    const base = RETRY_DELAYS_MS[tentativa];
    // Régua esgotada: agora sim é falha — o chamador pode estornar.
    if (base === undefined) throw new KieRateLimitError(ultimoThrottle);

    // `Retry-After` só ALONGA a espera, nunca encurta: se o provedor pedir 1s
    // na terceira tentativa, insistir em 1s é exatamente o que nos pôs aqui.
    const espera = comJitter(base, random);
    const pedido = retryAfterMs(res);
    await sleep(pedido !== null ? Math.max(pedido, espera) : espera);
  }
}
