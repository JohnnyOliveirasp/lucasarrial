/**
 * O Gemini ASSISTE o viral — imagem e áudio — e escreve o comentário.
 *
 * 🔴 Por que trocou (Johnny, 14/08): a primeira versão usava a cadeia do
 * Gerador de Roteiro (yt-dlp → Whisper → DeepSeek). O DeepSeek **não vê
 * vídeo**: recebia "é um vídeo de um pastor" com uma transcrição fraca e
 * inventava metáfora bonita em cima de nada. Modelo sem olhos alucina.
 *
 * O Gemini lê vídeo COM ÁUDIO nativamente. Medido em 14/08 com um viral de
 * 15s: transcrição literal correta + descrição do que estava na tela, em
 * 8,2 segundos. É uma chamada só — o modelo escreve o roteiro com o vídeo
 * ainda "na cabeça", em vez de escrever a partir de um resumo de segunda mão.
 *
 * A regra do tamanho continua: a fala tem que caber na duração do viral.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { FALA_MAX_SEGUNDOS } from "@/lib/react/roteiro";

const run = promisify(execFile);

const API = "https://generativelanguage.googleapis.com/v1beta/models";
/** `gemini-flash-latest` foi o testado; a env permite trocar sem deploy. */
const MODELO = () => process.env.REACT_VISION_MODEL || "gemini-flash-latest";
const TIMEOUT_MS = 180_000;

/**
 * Teto do que vai inline na requisição. O limite do Gemini é ~20MB no corpo
 * inteiro e o base64 infla ~33%, então 12MB de arquivo é o corte seguro.
 * Acima disso a gente encolhe o vídeo antes (não recusa).
 */
const MAX_INLINE_BYTES = 12 * 1024 * 1024;

export type LeituraViral = {
  transcricao: string;
  descricao: string;
  temFala: boolean;
  roteiro: string;
  /** Chamada final quando a IDEIA pediu uma — vai separada pro passo do CTA
   *  (cena própria), nunca dentro do roteiro (senão duplicava, 17/08). */
  cta: string;
};

/** Encolhe pra 480p quando o arquivo é grande demais pra ir inline. */
async function encolher(origem: string): Promise<string> {
  const destino = path.join(path.dirname(origem), "menor.mp4");
  await run(
    "ffmpeg",
    [
      "-y", "-v", "error", "-i", origem,
      "-vf", "scale=-2:480",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
      "-c:a", "aac", "-b:a", "64k",
      destino,
    ],
    { timeout: 300_000, maxBuffer: 8 * 1024 * 1024 },
  );
  return destino;
}

const INSTRUCAO = (
  autor: string,
  duracao: number,
  alvo: number,
  legenda: string | null,
  ideia: string | null,
) =>
  [
    "Você vai ASSISTIR o vídeo (imagem e áudio) e escrever o roteiro de um REACTION em português do Brasil.",
    "",
    "Quem vai falar é um criador que aparece na tela comentando este vídeo. Escreva SÓ a fala dele.",
    "",
    // A ideia vem antes das regras de propósito: é o ângulo obrigatório da
    // reação (Johnny 17/08 — sem isso o roteiro saía só no tema do viral).
    ideia
      ? [
          "A IDEIA DO CRIADOR — a reação PRECISA seguir este ângulo:",
          `"${ideia}"`,
          "Comente o que acontece no vídeo DE VERDADE e conduza a fala para essa",
          "ideia/produto com uma ponte natural — sem inventar fatos sobre o vídeo",
          "e sem soar propaganda: é um comentário que desemboca no assunto dele.",
          "",
        ].join("\n")
      : "",
    "REGRAS DO ROTEIRO:",
    "- Primeira frase é gancho: dá o motivo de continuar assistindo. Nada de 'fala galera' ou 'olha esse vídeo'.",
    "- Comente o que REALMENTE acontece no vídeo — o que você viu e ouviu. Não invente fato que não está lá.",
    "- Opinião e ponto de vista, não narração da cena.",
    "- Linguagem falada, frases curtas, sem emoji, sem hashtag, sem marcação de cena.",
    "- NÃO copie as falas do vídeo original.",
    "- NÃO escreva chamada para ação DENTRO do roteiro. Se a ideia do criador",
    "  pedir uma chamada final (link, oferta, 'clique e saiba mais'), devolva",
    "  essa chamada SEPARADA na chave \"cta\" do JSON — ela vira uma cena",
    "  própria no fim do vídeo. Sem pedido de chamada, deixe \"cta\" vazio.",
    // Viral mais longo que o teto: o react vai ao ar SÓ com o começo do
    // vídeo (a montagem corta na fala) — o modelo assiste tudo, mas não
    // pode ancorar a fala em cena que o público nunca vai ver.
    duracao > FALA_MAX_SEGUNDOS
      ? [
          `- Tamanho: cerca de ${alvo} palavras — a fala NÃO pode passar de ${FALA_MAX_SEGUNDOS} segundos.`,
          `- O vídeo tem ${duracao} segundos, mas o react vai ao ar usando SÓ os primeiros ~${FALA_MAX_SEGUNDOS}s dele.`,
          "  Você assistiu tudo — use isso pra entender o contexto — mas comente o que aparece no COMEÇO:",
          "  não cite cena, fala ou momento que só acontece depois desse corte.",
        ].join("\n")
      : `- Tamanho: cerca de ${alvo} palavras. A fala precisa CABER nos ${duracao} segundos do vídeo.`,
    "",
    `CONTEXTO: vídeo de @${autor}, ${duracao} segundos.`,
    legenda ? `LEGENDA DO POST: ${legenda.slice(0, 400)}` : "",
    "",
    "Responda SOMENTE um JSON válido, sem cercas de código, com as chaves:",
    '{"transcricao": "a fala literal do vídeo (vazio se não houver fala)",',
    ' "descricao": "o que acontece na tela, em 3 frases",',
    ' "tem_fala": true ou false,',
    ' "roteiro": "o roteiro do reaction (SEM chamada para ação)",',
    ' "cta": "a chamada final, só se a ideia pedir uma (senão vazio)"}',
  ]
    .filter(Boolean)
    .join("\n");

/** Assiste o vídeo e devolve leitura + roteiro. */
export async function assistirEEscrever(args: {
  caminhoMp4: string;
  autor: string | null;
  legenda: string | null;
  duracaoSeg: number;
  palavrasAlvo: number;
  /** Direcionamento do criador — o ângulo/produto que a reação deve puxar. */
  ideia?: string | null;
}): Promise<LeituraViral> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada");

  let caminho = args.caminhoMp4;
  const { size } = await fs.stat(caminho);
  if (size > MAX_INLINE_BYTES) caminho = await encolher(caminho);
  const bytes = await fs.readFile(caminho);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/${MODELO()}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: "video/mp4", data: bytes.toString("base64") } },
              {
                text: INSTRUCAO(
                  args.autor ?? "criador",
                  Math.round(args.duracaoSeg),
                  args.palavrasAlvo,
                  args.legenda,
                  args.ideia ?? null,
                ),
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2_000 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const cru = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return interpretar(cru);
  } finally {
    clearTimeout(timer);
    if (caminho !== args.caminhoMp4) await fs.rm(caminho, { force: true }).catch(() => {});
  }
}

/**
 * O modelo às vezes embrulha o JSON em cercas de código, mesmo mandado não
 * fazer. Melhor tolerar aqui do que devolver erro pro aluno.
 */
function interpretar(cru: string): LeituraViral {
  const limpo = cru.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const j = JSON.parse(limpo) as Record<string, unknown>;
    const roteiro = String(j.roteiro ?? "").trim();
    if (roteiro.length < 40) throw new Error("roteiro curto");
    return {
      transcricao: String(j.transcricao ?? "").trim(),
      descricao: String(j.descricao ?? "").trim(),
      temFala: j.tem_fala === true,
      roteiro,
      cta: String(j.cta ?? "").trim(),
    };
  } catch {
    // Sem JSON: o texto inteiro ainda serve como roteiro.
    if (limpo.length < 40) throw new Error("Resposta vazia do modelo");
    return { transcricao: "", descricao: "", temFala: false, roteiro: limpo, cta: "" };
  }
}

/** Baixa o mp4 do R2 pra um arquivo temporário (o Gemini precisa dos bytes). */
export async function pastaTemporaria(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "react-ver-"));
}
