/**
 * Legenda do vídeo final (Fase 5): cronometra as palavras e gera um .ass com
 * KARAOKÊ (palavra acende quando é falada). Sem dependência nova — só ffmpeg
 * queima o .ass depois.
 *
 * Timing (em ordem de preferência):
 *   1) Whisper API (OpenAI) se OPENAI_API_KEY estiver setado — preciso.
 *   2) Proporcional pelo texto do roteiro (100% local, sem chave) — aproximado.
 *
 * Whisper local (whisper.cpp) entra aqui depois como 3ª opção sem chave.
 * Server-only.
 */
import { readFile } from "node:fs/promises";

// ── Timing por palavra ──────────────────────────────────────────────────────

/** Divide o texto em palavras (mantém pontuação junto). */
function splitWords(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Distribui as palavras ao longo da duração, peso = tamanho da palavra. */
function proportionalTimings(text, totalDur) {
  const words = splitWords(text);
  if (words.length === 0) return [];
  const weights = words.map((w) => Math.max(1, w.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return words.map((w, i) => {
    const dur = (weights[i] / total) * totalDur;
    const start = t;
    t += dur;
    return { word: w, start, end: t };
  });
}

/** Whisper API (OpenAI) com timestamps por palavra. Lança em erro. */
async function whisperApiTimings(audioFile, apiKey) {
  const buf = await readFile(audioFile);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const words = Array.isArray(json.words) ? json.words : [];
  return words
    .filter((w) => typeof w.word === "string" && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => ({ word: w.word.trim(), start: w.start, end: w.end }))
    .filter((w) => w.word);
}

/**
 * Timings por palavra. Usa Whisper API se houver chave; senão proporcional.
 * NUNCA lança — cai no proporcional em qualquer erro.
 */
export async function getWordTimings(audioFile, scriptText, totalDur) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const w = await whisperApiTimings(audioFile, apiKey);
      if (w.length > 0) return w;
    } catch (e) {
      console.warn("[subtitles] Whisper API falhou, usando proporcional:", e.message);
    }
  }
  return proportionalTimings(scriptText, totalDur);
}

// ── Geração do .ass (karaokê) ───────────────────────────────────────────────

function assTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  const ss = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Estilos de legenda oferecidos ao usuário — ESPELHAM os ids de
 * `src/lib/video/subtitle-presets.ts` (UI/API); manter em sincronia.
 *
 * Fontes: embarcadas em `public/assets/subtitle-fonts/` (o worker passa
 * `fontsdir` pro filtro ass — nada de instalar fonte no SO).
 * Cores em ASS = &HAABBGGRR (AA=alfa: 00 opaco, FF transparente; BGR!).
 *
 * `mode`:
 *   static    — frase inteira, sem destaque.
 *   karaoke   — \k: palavra muda de secondary→primary quando falada.
 *   highlight — 1 Dialogue por palavra: a ativa ganha cor (hl) e pop (\t).
 *   word      — UMA palavra por vez na tela (gigante), com pop.
 */
const WHITE = "&H00FFFFFF";
const BLACK = "&H00000000";
const YELLOW = "&H0000D4FF"; // #FFD400
const GREEN = "&H003CFF00"; // #00FF3C
const RED = "&H00303BFF"; // #FF3B30
const LIME = "&H0000FFB4"; // #B4FF00
const DARKGREEN = "&H00002A0A"; // #0A2A00

export const SUBTITLE_STYLES = {
  hormozi: {
    label: "Hormozi",
    fontname: "Montserrat Black", fontsize: 56, bold: 0, uppercase: true,
    primary: WHITE, secondary: WHITE, outline: BLACK, back: BLACK,
    borderStyle: 1, outlineW: 4, shadow: 2,
    mode: "highlight", hl: [YELLOW], pop: true,
    maxWords: 4, maxChars: 18,
  },
  hormozi_green: {
    label: "Hormozi Verde",
    fontname: "Montserrat Black", fontsize: 56, bold: 0, uppercase: true,
    primary: WHITE, secondary: WHITE, outline: BLACK, back: BLACK,
    borderStyle: 1, outlineW: 4, shadow: 2,
    mode: "highlight", hl: [GREEN], pop: true,
    maxWords: 4, maxChars: 18,
  },
  beast: {
    label: "Beast",
    fontname: "Luckiest Guy", fontsize: 58, bold: 0, uppercase: true,
    primary: WHITE, secondary: WHITE, outline: BLACK, back: BLACK,
    borderStyle: 1, outlineW: 5, shadow: 2,
    mode: "highlight", hl: [YELLOW, GREEN, RED], pop: true,
    maxWords: 3, maxChars: 16,
  },
  one_word: {
    label: "Uma Palavra",
    fontname: "Archivo Black", fontsize: 78, bold: 0, uppercase: true,
    primary: WHITE, secondary: WHITE, outline: BLACK, back: BLACK,
    borderStyle: 1, outlineW: 5, shadow: 2,
    mode: "word", pop: true,
    maxWords: 1, maxChars: 99, defaultPosition: "center",
  },
  karaoke: {
    label: "Karaokê",
    fontname: "Anton", fontsize: 54, bold: 0,
    primary: YELLOW, secondary: WHITE, outline: BLACK, back: BLACK,
    borderStyle: 1, outlineW: 4, shadow: 1,
    mode: "karaoke",
    maxWords: 3, maxChars: 18,
  },
  clean: {
    label: "Clean",
    fontname: "Poppins SemiBold", fontsize: 48, bold: 0,
    primary: WHITE, secondary: WHITE, outline: BLACK, back: BLACK,
    borderStyle: 1, outlineW: 4, shadow: 1,
    mode: "static",
    maxWords: 4, maxChars: 22,
  },
  boxed: {
    label: "Boxed",
    fontname: "Poppins SemiBold", fontsize: 46, bold: 0,
    primary: WHITE, secondary: WHITE, outline: "&H90000000", back: "&H90000000",
    borderStyle: 3, outlineW: 8, shadow: 0,
    mode: "static",
    maxWords: 4, maxChars: 22,
  },
  neon: {
    label: "Neon",
    fontname: "Anton", fontsize: 54, bold: 0, uppercase: true,
    primary: LIME, secondary: LIME, outline: DARKGREEN, back: BLACK,
    borderStyle: 1, outlineW: 4, shadow: 2,
    mode: "static",
    maxWords: 4, maxChars: 20,
  },
  bangers: {
    label: "Bangers",
    fontname: "Bangers", fontsize: 62, bold: 0, uppercase: true,
    primary: WHITE, secondary: WHITE, outline: BLACK, back: BLACK,
    borderStyle: 1, outlineW: 4, shadow: 3,
    mode: "static",
    maxWords: 4, maxChars: 20,
  },
  sobrio: {
    label: "Sóbrio",
    fontname: "Poppins SemiBold", fontsize: 38, bold: 0,
    primary: WHITE, secondary: WHITE, outline: BLACK, back: BLACK,
    borderStyle: 1, outlineW: 3, shadow: 1,
    mode: "static",
    maxWords: 6, maxChars: 30,
  },
};

export function resolveStyle(id) {
  return SUBTITLE_STYLES[id] || SUBTITLE_STYLES.karaoke;
}

/** Posição na tela → alinhamento ASS (numpad) + margem vertical. */
const POSITIONS = {
  bottom: { alignment: 2, marginV: 230 },
  center: { alignment: 5, marginV: 0 },
  top: { alignment: 8, marginV: 140 },
};

/** Tamanho escolhido pelo usuário → multiplicador do fontsize do preset. */
const SIZES = { normal: 1, large: 1.22 };

/** Agrupa palavras em linhas curtas (por pontuação forte ou limites do estilo). */
function chunkLines(words, maxChars, maxWords) {
  const lines = [];
  let cur = [];
  let chars = 0;
  for (const w of words) {
    cur.push(w);
    chars += w.word.length + 1;
    const strongPunct = /[.!?…,]$/.test(w.word);
    if (strongPunct || chars >= maxChars || cur.length >= maxWords) {
      lines.push(cur);
      cur = [];
      chars = 0;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function assHeader(s, alignment, marginV, fontsize) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${s.fontname},${fontsize},${s.primary},${s.secondary},${s.outline},${s.back},${s.bold},0,0,0,100,100,0,0,${s.borderStyle},${s.outlineW},${s.shadow},${alignment},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

/** Override de pop (a palavra "estoura" e assenta em ~90ms). */
const POP = "\\fscx135\\fscy135\\t(0,90,\\fscx100\\fscy100)";

/**
 * Monta o .ass a partir das palavras + preset + preferências do usuário.
 * `opts`: { position: bottom|center|top|null, size: normal|large|null }.
 * WrapStyle 0 = quebra automática (nunca corta na horizontal).
 */
export function buildAss(words, styleId, opts = {}) {
  if (!words || words.length === 0) return null;
  const s = resolveStyle(styleId);
  const pos = POSITIONS[opts.position] || POSITIONS[s.defaultPosition] || POSITIONS.bottom;
  const fontsize = Math.round(s.fontsize * (SIZES[opts.size] || 1));
  const cased = s.uppercase
    ? words.map((w) => ({ ...w, word: w.word.toLocaleUpperCase("pt-BR") }))
    : words;
  const lines = chunkLines(cased, s.maxChars, s.maxWords);
  const events = [];
  let hlIdx = 0;

  for (const line of lines) {
    const start = line[0].start;
    const end = line[line.length - 1].end;

    if (s.mode === "word") {
      // UMA palavra por vez; cada uma fica na tela até a próxima começar.
      for (let i = 0; i < line.length; i++) {
        const w = line[i];
        const wEnd = i + 1 < line.length ? line[i + 1].start : end;
        const fx = s.pop ? `{${POP}}` : "";
        events.push(
          `Dialogue: 0,${assTime(w.start)},${assTime(Math.max(wEnd, w.start + 0.05))},Default,,0,0,0,,${fx}${w.word}`,
        );
      }
      continue;
    }

    if (s.mode === "highlight") {
      // 1 Dialogue por palavra: frase inteira visível, a ativa colorida + pop.
      for (let i = 0; i < line.length; i++) {
        const evStart = i === 0 ? start : line[i].start;
        const evEnd = i + 1 < line.length ? line[i + 1].start : end;
        if (evEnd - evStart < 0.01) continue;
        const color = s.hl[hlIdx % s.hl.length];
        const text = line
          .map((w, j) =>
            j === i ? `{\\c${color}${s.pop ? POP : ""}}${w.word}{\\r}` : w.word,
          )
          .join(" ");
        events.push(`Dialogue: 0,${assTime(evStart)},${assTime(evEnd)},Default,,0,0,0,,${text}`);
        hlIdx++;
      }
      continue;
    }

    let text;
    if (s.mode === "karaoke") {
      text = "";
      let prevEnd = start;
      for (const w of line) {
        const gap = Math.max(0, w.start - prevEnd);
        if (gap > 0.02) text += `{\\k${Math.round(gap * 100)}}`;
        const durCs = Math.max(1, Math.round((w.end - w.start) * 100));
        text += `{\\k${durCs}}${w.word} `;
        prevEnd = w.end;
      }
      text = text.trim();
    } else {
      text = line.map((w) => w.word).join(" ");
    }
    events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${text}`);
  }

  return assHeader(s, pos.alignment, pos.marginV, fontsize) + events.join("\n") + "\n";
}
