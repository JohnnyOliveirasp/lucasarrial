/**
 * Legenda queimada do Video React — os MESMOS presets do editor de vídeo.
 *
 * Por que ASS local e não o worker `caption_burn`: a montagem do React já roda
 * ffmpeg aqui no servidor. Mandar o mp4 pro RunPod só pra escrever texto
 * custaria crédito e minutos por nada. Provado na mão em 14/08: o ffmpeg do
 * Hetzner tem libass e as 6 fontes já viajam no deploy (public/assets), então
 * `subtitles=arquivo.ass:fontsdir=...` casa a fonte pelo NOME DA FAMÍLIA
 * (`fontselect: (Luckiest Guy, 400, 0) -> LuckiestGuy-Regular`).
 *
 * O desenho espelha `SUBTITLE_PRESETS` (fonte de verdade da UI) e o
 * `caption-style.ts` do Estúdio — mudou lá, muda aqui.
 */
import type { CaptionWord } from "@/lib/video/transcribe-words";
import type { SubtitlePosition, SubtitleSize } from "@/lib/video/subtitle-presets";

/** Família da fonte por preset — é o nome que o libass procura no fontsdir. */
const FAMILIA: Record<string, string> = {
  hormozi: "Montserrat Black",
  hormozi_green: "Montserrat Black",
  beast: "Luckiest Guy",
  one_word: "Archivo Black",
  karaoke: "Anton",
  neon: "Anton",
  clean: "Poppins SemiBold",
  boxed: "Poppins SemiBold",
  sobrio: "Poppins SemiBold",
  bangers: "Bangers",
};

type Desenho = {
  cor: string;
  ativa?: string;
  contorno: string;
  /** Faixa preta atrás do texto em vez de contorno (BorderStyle 3). */
  caixa?: boolean;
  maiuscula?: boolean;
  /** Palavras por bloco na tela. */
  porBloco: number;
  /** Multiplicador do tamanho base. */
  escala: number;
};

const DESENHO: Record<string, Desenho> = {
  hormozi: { cor: "#FFFFFF", ativa: "#FFD400", contorno: "#000000", maiuscula: true, porBloco: 3, escala: 1 },
  hormozi_green: { cor: "#FFFFFF", ativa: "#00FF3C", contorno: "#000000", maiuscula: true, porBloco: 3, escala: 1 },
  beast: { cor: "#FFFFFF", ativa: "#FF3B30", contorno: "#000000", maiuscula: true, porBloco: 3, escala: 1 },
  one_word: { cor: "#FFFFFF", contorno: "#000000", maiuscula: true, porBloco: 1, escala: 1.5 },
  karaoke: { cor: "#FFFFFF", ativa: "#FFD400", contorno: "#000000", porBloco: 4, escala: 1 },
  clean: { cor: "#FFFFFF", contorno: "#000000", porBloco: 5, escala: 1 },
  boxed: { cor: "#FFFFFF", contorno: "#000000", caixa: true, porBloco: 5, escala: 1 },
  neon: { cor: "#B4FF00", contorno: "#0A2A00", maiuscula: true, porBloco: 4, escala: 1 },
  bangers: { cor: "#FFFFFF", contorno: "#000000", maiuscula: true, porBloco: 3, escala: 1 },
  sobrio: { cor: "#FFFFFF", contorno: "#000000", porBloco: 6, escala: 0.8 },
};

/** #RRGGBB → &HBBGGRR& (o ASS inverte os canais; errar aqui troca vermelho por azul). */
function corAss(hex: string): string {
  const h = hex.replace("#", "");
  return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase() + "&";
}

/** Segundos → 0:00:00.00 (centésimos, como o ASS espera). */
function tempo(s: number): string {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const seg = Math.floor(t % 60);
  const cs = Math.round((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}.${String(Math.min(99, cs)).padStart(2, "0")}`;
}

/** Alinhamento numpad do ASS: 2 = base-centro, 5 = meio, 8 = topo. */
const ALINHAMENTO: Record<SubtitlePosition, number> = { bottom: 2, center: 5, top: 8 };

function escapar(t: string): string {
  return t.replace(/\\/g, "").replace(/[{}]/g, "").trim();
}

export function estiloTemLegenda(id: string | null | undefined): boolean {
  return Boolean(id) && id !== "none" && Boolean(DESENHO[id as string]);
}

/**
 * Monta o .ass inteiro. Um evento POR PALAVRA falada: o bloco todo aparece e a
 * palavra do momento troca de cor — é o karaokê que o pessoal espera do TikTok,
 * e não depende de tag \k (que o libass renderiza diferente por versão).
 *
 * @param altura altura do vídeo em px; o corpo da fonte sai dela (5,2%)
 */
export function montarAss(args: {
  palavras: CaptionWord[];
  estilo: string;
  posicao?: SubtitlePosition | null;
  tamanho?: SubtitleSize | null;
  largura?: number;
  altura?: number;
}): string | null {
  const d = DESENHO[args.estilo];
  const familia = FAMILIA[args.estilo];
  if (!d || !familia || args.palavras.length === 0) return null;

  const L = args.largura ?? 1080;
  const A = args.altura ?? 1920;
  // Default TOPO (19/08): no layout do React o avatar mora no rodapé — legenda
  // embaixo era desenhada EM CIMA dele. A referência do Johnny (IG DO6uRUQATaa)
  // põe o texto grande no topo-centro, longe do avatar. Quem quiser embaixo
  // ainda escolhe no seletor.
  const posicao = args.posicao ?? (args.estilo === "one_word" ? "center" : "top");
  const grande = args.tamanho === "large" ? 1.3 : 1;
  const corpo = Math.round(A * 0.052 * d.escala * grande);
  const contorno = Math.max(2, Math.round(corpo * 0.07));
  // Margem de baixo generosa: no 9:16 a legenda colada no rodapé some atrás da
  // barra do TikTok.
  // topo com 10% de respiro (na referência o título senta a ~15% da altura).
  const margemV =
    posicao === "bottom" ? Math.round(A * 0.14)
    : posicao === "top" ? Math.round(A * 0.1)
    : Math.round(A * 0.05);

  const cabecalho = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${L}`,
    `PlayResY: ${A}`,
    // WrapStyle 0 = quebra de linha inteligente. Estava em 2 (NUNCA quebra):
    // linha mais larga que a tela era simplesmente CORTADA nas bordas — o
    // "legendas estão cortando" que o Johnny viu no React de 19/08.
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    [
      "Style: L",
      familia,
      corpo,
      corAss(d.cor),
      corAss(d.contorno),
      d.caixa ? "&H99000000" : corAss(d.contorno),
      0, 0, 0, 0, 100, 100, 0, 0,
      d.caixa ? 3 : 1,
      d.caixa ? Math.max(6, Math.round(corpo * 0.12)) : contorno,
      0,
      ALINHAMENTO[posicao],
      Math.round(L * 0.06),
      Math.round(L * 0.06),
      margemV,
      1,
    ].join(","),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const eventos: string[] = [];
  for (let i = 0; i < args.palavras.length; i += d.porBloco) {
    const bloco = args.palavras.slice(i, i + d.porBloco);
    for (let j = 0; j < bloco.length; j++) {
      const p = bloco[j];
      // Fim do último evento do bloco: NUNCA passa do início do bloco seguinte.
      // Sem o teto, o "max(p.end, ...)" invadia o próximo bloco e o libass
      // empilhava os dois na tela ao mesmo tempo (frame f_14 do React 19/08).
      const proximoBloco = args.palavras[i + d.porBloco]?.start ?? Infinity;
      const fim =
        j + 1 < bloco.length
          ? bloco[j + 1].start
          : Math.min(Math.max(p.end, p.start + 0.12), proximoBloco);
      const texto = bloco
        .map((w, k) => {
          const t = escapar(d.maiuscula ? w.word.toUpperCase() : w.word);
          // Sem cor de destaque (clean/one_word/...), o bloco sai chapado.
          if (!d.ativa || k !== j) return t;
          return `{\\c${corAss(d.ativa)}}${t}{\\c${corAss(d.cor)}}`;
        })
        .join(" ");
      eventos.push(`Dialogue: 0,${tempo(p.start)},${tempo(fim)},L,,0,0,0,,${texto}`);
    }
  }

  return [...cabecalho, ...eventos].join("\n") + "\n";
}
