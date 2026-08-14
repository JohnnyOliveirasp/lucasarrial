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

export function palavrasAlvo(duracaoSeg: number): number {
  // Deixa 15% de respiro: o viral também precisa "falar" sozinho em algum
  // momento, senão vira locução por cima do vídeo inteiro.
  return Math.max(20, Math.round(duracaoSeg * PALAVRAS_POR_SEGUNDO * 0.85));
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
    `\nTAMANHO: aproximadamente ${alvo} palavras. A fala precisa CABER nos ${Math.round(
      fonte.duracaoSeg,
    )} segundos do vídeo — passar disso quebra a montagem.`,
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
