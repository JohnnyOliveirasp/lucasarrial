/**
 * Gate de rosto frontal do Vídeo Clone (chamado #131, 25/08).
 *
 * A cadeia Gerar Imagem → Animar → Vídeo Clone cobrava os três passos sem
 * NENHUMA checagem de que o quadro que vai pro lip-sync tem um rosto de frente
 * com a boca visível. O aluno escolhia uma referência frontal válida, o prompt
 * de cena virava a cabeça dele pra baixo, e o produto sincronizava lábios num
 * rosto que não existe de frente (Itamar, 10.120c, mesma classe do #121).
 *
 * Roda ANTES da cobrança. Haiku com visão, mesmo padrão de
 * `lib/onboarding/referencia.ts`. FAIL-OPEN: se a API não responder, não
 * bloqueia (o produto não pode parar por causa do detector) — mas registra.
 */
const MODEL = "claude-haiku-4-5";

/**
 * DETERMINISMO (#371). O corpo da chamada NÃO mandava `temperature`, e o
 * default da API é 1.0: um classificador BINÁRIO, que decide se o aluno pode
 * usar um produto pago, estava SORTEANDO.
 *
 * A prova não é estatística, é aritmética: no conjunto da Alice, os arquivos
 * `5f610dda` e `8cd4c73c` são **byte a byte o mesmo arquivo** (md5
 * `73c4cc82bc77168e3897502168ef45ce`, 116.869 b nos dois) e tiveram **placar
 * diferente** entre si. Mesma entrada, veredito diferente = sorteio.
 *
 * ⚠️ `temperature: 0` NÃO é garantia matemática (a inferência não é
 * bit-determinística). É a única alavanca que existe, e por isso o efeito é
 * MEDIDO, não presumido: `_Bugs/2026-09-13_gate371_determinismo.cjs`, 5
 * rodadas por imagem, ANTES (main) × DEPOIS (este branch).
 */
const TEMPERATURE = 0;

/**
 * O SYSTEM tinha DOIS defeitos medidos, além da temperatura. Os dois viram
 * conserto aqui, e o terceiro — a cláusula de olhar — foi deliberadamente NÃO
 * adotado. Vale ler o porquê antes de "melhorar" este texto.
 *
 * 1. ANCORAGEM. O texto velho trazia UM exemplo de `reason` — "a pessoa está
 *    olhando pra baixo, pra tábua na mesa" — e **17 das 21 recusas** medidas
 *    repetiram essa frase, inclusive em foto com o rosto cravado na lente. O
 *    modelo papagaiava o exemplo em vez de descrever a foto. Não há mais
 *    exemplo de frase; há a instrução de descrever o que se vê.
 *
 * 2. CONTRADIÇÃO. Dizia "up to ~30° of yaw/pitch is fine" e, na MESMA frase,
 *    reprovava "looking down at something". Queixo recolhido cabe nos 30° e
 *    ainda assim caía na cláusula categórica. Resolvido mantendo só o critério
 *    angular, que é verificável.
 *
 * 3. ⛔ O QUE NÃO ENTROU, E POR QUÊ. O branch `feat/371-gate-deterministico`
 *    (STALE, não mergear) propunha trocar a cláusula velha por *"reprova o
 *    olhar preso num objeto fora do quadro"*. Isso **não é atributo visual
 *    verificável**: exige inferir INTENÇÃO de uma foto parada, e é justamente
 *    o tipo de julgamento que fez a conclusão sobre as fotos da Alice inverter
 *    duas vezes em sete dias — inclusive entre dois leitores independentes
 *    (eu e o `olho`) que divergiram no olhar em 4 das 9 imagens.
 *
 *    A justificativa do branch era que "a cláusula do olhar é o que segura o
 *    controle negativo". **Não segura.** No controle negativo (#131, Itamar
 *    `8cd37f59`) a CABEÇA está virada pra baixo, não só o olhar — ele é barrado
 *    por POSE, critério que já está aqui. Isso é afirmação medível, e está
 *    medida na tabela do PR: se o negativo vazar sem a cláusula de gaze, esta
 *    decisão está errada e deve ser revertida com a medição na mão.
 *
 * O contrato, portanto, é POSE DA CABEÇA + BOCA VISÍVEL. Direção do olhar não
 * é critério — e não precisa ser, porque quem sincroniza no lip-sync é a boca.
 */
const SYSTEM = `You inspect ONE photo that will be used for lip-sync video (the mouth will be animated to speech).
Answer ONLY a JSON object: {"frontal": true|false, "mouth_visible": true|false, "reason": "<short, in Brazilian Portuguese>"}.

Judge ONLY two things: the POSE OF THE HEAD and whether the MOUTH IS VISIBLE.
Do NOT judge where the eyes are looking. Do NOT guess what the person is paying attention to. Gaze direction is not a criterion.

"frontal" = the head is turned toward the camera, within about 30 degrees of yaw, pitch and roll.
  true (accept all of these): head rotated or tilted up to ~30 degrees; chin tucked down, or camera held above eye level, while the face still faces the camera; very tight close-up, or a small face in the frame; eyes narrowed, closed, or pointing away from the lens; neutral or serious expression; mouth closed.
  false: profile or near-profile, turned more than ~30 degrees so one side of the face is hidden; back of the head; no clear human face; the head tipped so far down or up that the eyes or the mouth are no longer visible.
"mouth_visible" = the mouth is visible and not covered (hand, mask, microphone, object, hair, or an angle so extreme the mouth is out of view).
"reason" is ONE short sentence in Brazilian Portuguese naming the concrete thing this person must change. Describe only what you actually see in THIS photo. Never reuse a stock phrase.`;

type Block = { type: string; text?: string };

/**
 * POR QUE o gate deixou passar sem olhar (#372). Antes era só `skipped: true`,
 * o que juntava três coisas muito diferentes num booleano: escolha nossa,
 * configuração faltando e detector caído. A distinção importa porque só as
 * duas últimas são CEGUEIRA — e cegueira é o que precisa virar linha na
 * `face_gate_recusas`.
 *
 * `presign_falhou` não nasce aqui: é da rota, que nem chega a chamar esta
 * função quando não consegue a URL assinada. Mora no tipo porque é a mesma
 * classe de evento e o rastro trata os três igual.
 */
export type FaceGateSkip =
  /** `VIDEO_CLONE_FACE_GATE=0`. Desligamos de propósito. */
  | "desligado"
  /** Sem `ANTHROPIC_API_KEY`. Não é escolha: é configuração faltando. */
  | "sem_api_key"
  /** A visão foi chamada e não respondeu direito (HTTP, timeout, JSON torto). */
  | "falha_tecnica"
  /** A rota não conseguiu a URL assinada da imagem — a visão nem foi chamada. */
  | "presign_falhou";

export type FaceGateResult =
  /**
   * `skipped` ausente = a visão OLHOU e aprovou. `skipped` presente = NINGUÉM
   * olhou e o fail-open deixou passar. Os dois são `ok: true` pro fluxo, mas
   * só o primeiro é uma aprovação de verdade.
   */
  | { ok: true; skipped?: FaceGateSkip; erro?: string }
  | { ok: false; reason: string };

export async function checkFrontalFace(imageUrl: string): Promise<FaceGateResult> {
  if (process.env.VIDEO_CLONE_FACE_GATE === "0") return { ok: true, skipped: "desligado" };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: true, skipped: "sem_api_key" };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        temperature: TEMPERATURE,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: "Inspect this photo. JSON only." },
          ],
        }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Block[] };
    const text = (data.content ?? []).find((b) => b.type === "text")?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("sem JSON na resposta");
    const parsed = JSON.parse(m[0]) as { frontal?: boolean; mouth_visible?: boolean; reason?: string };
    if (parsed.frontal === true && parsed.mouth_visible === true) return { ok: true };
    const reason = (parsed.reason ?? "").trim() || (parsed.frontal === false
      ? "o rosto não está de frente pra câmera"
      : "a boca não está visível");
    return { ok: false, reason };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[video-clone/face-gate] visão falhou (fail-open):", erro);
    // `erro` sobe junto pro rastro: "falha_tecnica" sozinho não distingue
    // timeout de 429 de JSON torto, e é essa distinção que diz se vale
    // retentar ou se o modelo mudou de comportamento.
    return { ok: true, skipped: "falha_tecnica", erro };
  }
}

/** Mensagem pro aluno — diz o que fazer, não só o que deu errado. Não cobra. */
export function faceGateMessage(reason: string): string {
  return (
    `Essa foto não serve pro Vídeo Clone: ${reason}. ` +
    "O lip-sync precisa de um rosto olhando pra câmera, com a boca visível. " +
    "Escolha uma foto de frente (ou gere a imagem com a pessoa olhando pra câmera) e tente de novo. Você não foi cobrado."
  );
}
