/**
 * R2 do Video React — a LLM assiste o viral e escreve o SEU comentário.
 *
 * Reusa a cadeia que o Gerador de Roteiro já provou: `transcribeFromLink`
 * baixa só o áudio com yt-dlp e transcreve. Aqui muda o PROMPT — não é
 * "escreva um vídeo sobre isso", é "você está reagindo a ESTE vídeo".
 *
 * A regra de ouro veio da conversa de 14/08: **a fala do react tem que caber
 * no tempo do viral.** Se passar, a montagem não fecha e sobra áudio sem
 * imagem — por isso o alvo de palavras sai da duração do vídeo, e a tela
 * mostra a conta antes de gastar crédito de clone.
 */
import { transcribeFromLink } from "@/lib/roteiro/link";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const MODEL = () => process.env.ROTEIRO_MODEL || "deepseek-v4-flash";
const TIMEOUT_MS = 90_000;
const TRANSCRIPT_MAX = 12_000;

/**
 * Ritmo de fala em pt-BR: ~2,5 palavras por segundo é o que sai natural num
 * reaction (mais que isso vira leitura apressada).
 */
export const PALAVRAS_POR_SEGUNDO = 2.5;

/**
 * Preço do React (régua fechada com o Johnny em 14/08).
 *
 * A 1ª escrita do roteiro está inclusa na taxa do React. Da 2ª em diante
 * cobra: cada tentativa manda o vídeo INTEIRO pro Gemini de novo, com
 * download e banda — o Johnny apertou 3x testando e viu o buraco.
 * O ajuste de texto é bem mais barato (não reassiste o vídeo), então segue a
 * régua do chat do Gerador de Roteiro.
 */
export const REACT_COST = 300;
export const REACT_REESCRITA_COST = 50;
export const REACT_AJUSTE_COST = 10;

/**
 * Teto da fala (decisão do Johnny 17/08): react NUNCA passa de 90s de fala,
 * mesmo com viral longo — o caso do vídeo de 448s pedia ~950 palavras, que
 * é monólogo (e clone de ~40.000 cr a 105 cr/s). A montagem já corta o
 * viral na duração da fala, então o teto define o tamanho do vídeo final.
 */
export const FALA_MAX_SEGUNDOS = 90;

export function palavrasAlvo(duracaoSeg: number): number {
  // SEM desconto (correção Johnny 17/08): o vídeo final sai com o tamanho
  // da FALA — os antigos 15% de "respiro" faziam a fala mirar 36s num viral
  // de 42s e o corte comia o desfecho do vídeo. Viral abaixo do teto → a
  // fala mira o tamanho CHEIO do viral; acima → o teto de 90s manda.
  const efetivo = Math.min(duracaoSeg, FALA_MAX_SEGUNDOS);
  return Math.max(20, Math.round(efetivo * PALAVRAS_POR_SEGUNDO));
}

export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function segundosEstimados(texto: string): number {
  return Math.round(contarPalavras(texto) / PALAVRAS_POR_SEGUNDO);
}

const SISTEMA = `Você escreve roteiros de REACTION para TikTok/Reels em português do Brasil.

O criador vai aparecer NA TELA comentando um vídeo viral de outra pessoa. Você escreve SÓ a fala dele.

REGRAS:
- Primeira frase é gancho: dá o motivo de continuar assistindo. Nada de "fala galera", "hoje eu vou falar", "olha só esse vídeo".
- Comente o que ACONTECE no vídeo, com opinião e ponto de vista — não descreva o óbvio, não narre a cena.
- Traga a experiência de quem entende do assunto: o que o vídeo acertou, o que faltou, o que a maioria não percebe.
- Linguagem falada, frases curtas, sem emoji, sem hashtag, sem marcação de cena, sem indicação de tempo.
- NÃO copie falas do vídeo original.
- NÃO escreva chamada para ação no fim: ela é escrita depois, num passo separado.
- Devolva APENAS o texto que a pessoa vai falar, em parágrafos curtos.`;

/**
 * Reescrever ≠ remendar. Quando a pessoa pede uma mudança, o modelo devolve o
 * roteiro INTEIRO já com a ideia dela dentro — colar o pedido no meio do
 * texto quebra o ritmo do reaction (regra combinada com o Johnny 14/08).
 */
const SISTEMA_AJUSTE = `Você reescreve roteiros de REACTION em português do Brasil.

Recebe o roteiro atual e um pedido de mudança do criador. Devolve o roteiro INTEIRO reescrito, já com o pedido incorporado de forma natural — nunca cole o pedido como um parágrafo solto no meio.

Mantenha: o gancho na primeira frase, o tom falado, frases curtas, sem emoji, sem hashtag, sem marcação de cena.
Não escreva chamada para ação: ela é escrita em outro passo.
Devolva APENAS o roteiro final.`;

/**
 * O CTA é sempre o FIM do vídeo e tem CENA PRÓPRIA — por isso não entra na
 * conta de tempo do viral (pergunta do Johnny que virou regra).
 */
const SISTEMA_CTA = `Você escreve a chamada para ação (CTA) que fecha um vídeo de reaction, em português do Brasil.

REGRAS:
- 1 ou 2 frases, no máximo. É o fim do vídeo, não um anúncio.
- Fala direta com quem assistiu, ligando o assunto do vídeo à oferta.
- Sem "link na bio" genérico se o criador disse onde ir — use o que ele deu.
- Sem emoji, sem hashtag, sem exagero de vendedor.
- Devolva APENAS a fala do CTA.`;

export type FonteViral = {
  transcricao: string;
  legenda: string | null;
  autor: string | null;
  duracaoSeg: number;
};

/** Baixa o áudio do viral e transcreve (mesma cadeia do Gerador de Roteiro). */
export async function ouvirViral(url: string): Promise<{ transcript: string; title: string | null }> {
  const fonte = await transcribeFromLink(url);
  return { transcript: fonte.transcript ?? "", title: fonte.title ?? null };
}

/** Uma chamada à LLM. Os três usos (escrever, reescrever, CTA) passam por aqui. */
async function perguntar(
  sistema: string,
  usuario: string,
  maxTokens = 2_000,
): Promise<{ texto: string; model: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("LLM indisponível (sem chave)");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL(),
        // Mesmo cuidado do Gerador de Roteiro: o V4-Flash é modelo de
        // raciocínio e os tokens de "pensar" contam no max_tokens — sem
        // desligar, ele devolve content VAZIO em 1 de cada 3 chamadas.
        thinking: { type: "disabled" },
        max_tokens: maxTokens,
        temperature: 0.85,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { texto: (json.choices?.[0]?.message?.content ?? "").trim(), model: MODEL() };
  } finally {
    clearTimeout(timer);
  }
}

/** R3 — reescreve o roteiro inteiro com o pedido do criador dentro. */
export async function reescreverReact(args: {
  roteiro: string;
  pedido: string;
  duracaoSeg: number;
}): Promise<{ roteiro: string; model: string }> {
  const alvo = palavrasAlvo(args.duracaoSeg);
  const { texto, model } = await perguntar(
    SISTEMA_AJUSTE,
    [
      `ROTEIRO ATUAL:\n${args.roteiro}`,
      `\nO QUE O CRIADOR QUER MUDAR:\n${args.pedido}`,
      `\nTAMANHO: aproximadamente ${alvo} palavras — a fala não pode passar de ${FALA_MAX_SEGUNDOS}s (o vídeo tem ${Math.round(args.duracaoSeg)}s).`,
    ].join("\n"),
  );
  if (texto.length < 40) throw new Error("Reescrita vazia ou curta demais");
  return { roteiro: texto, model };
}

/** R3 — escreve o CTA que fecha o vídeo (cena própria, fora do tempo do viral). */
export async function escreverCta(args: {
  roteiro: string;
  oferta: string;
}): Promise<{ cta: string; model: string }> {
  const { texto, model } = await perguntar(
    SISTEMA_CTA,
    [
      `ASSUNTO DO VÍDEO (roteiro que acabou de ser falado):\n${args.roteiro.slice(0, 2000)}`,
      `\nO QUE O CRIADOR QUER OFERECER / PRA ONDE MANDAR:\n${args.oferta}`,
    ].join("\n"),
    500,
  );
  if (texto.length < 10) throw new Error("CTA vazio");
  return { cta: texto, model };
}

/** Escreve o roteiro do react, no tamanho que cabe no viral. */
export async function escreverReact(fonte: FonteViral): Promise<{ roteiro: string; model: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("LLM indisponível (sem chave)");
  const alvo = palavrasAlvo(fonte.duracaoSeg);

  const user = [
    `VÍDEO QUE ELE ESTÁ COMENTANDO — @${fonte.autor ?? "criador"}, ${Math.round(fonte.duracaoSeg)} segundos.`,
    fonte.legenda ? `\nLEGENDA DO POST:\n${fonte.legenda.slice(0, 600)}` : "",
    `\nO QUE SE FALA NO VÍDEO (transcrição, matéria-prima — NÃO copiar):\n${
      fonte.transcricao.slice(0, TRANSCRIPT_MAX) || "(o vídeo não tem fala)"
    }`,
    `\nTAMANHO: aproximadamente ${alvo} palavras — a fala não pode passar de ${FALA_MAX_SEGUNDOS} segundos, mesmo que o vídeo seja mais longo (a montagem corta o vídeo na fala).`,
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL(),
        // Mesmo cuidado do Gerador de Roteiro: o V4-Flash é modelo de
        // raciocínio e os tokens de "pensar" contam no max_tokens — sem
        // desligar, ele devolve content VAZIO em 1 de cada 3 chamadas.
        thinking: { type: "disabled" },
        max_tokens: 2_000,
        temperature: 0.85,
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const roteiro = (json.choices?.[0]?.message?.content ?? "").trim();
    if (roteiro.length < 40) throw new Error("Roteiro vazio ou curto demais");
    return { roteiro, model: MODEL() };
  } finally {
    clearTimeout(timer);
  }
}
