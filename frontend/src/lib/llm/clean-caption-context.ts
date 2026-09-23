/**
 * Limpeza do contexto antes de gerar legenda (#Johnny 23/09).
 *
 * O "Gerar legenda" recebe como contexto o PROMPT DE GERAÇÃO da imagem/vídeo,
 * cheio de diretiva técnica de renderização ("8k, ultra detailed, sharp focus,
 * cinematic lighting, studio background"). Sem a ideia do criador, o Haiku só
 * tem isso na mão e escreve sobre o PROCESSO DE PRODUZIR A FOTO — legenda de
 * fotógrafo, não de criador. Este módulo tira a diretiva técnica e deixa só o
 * ASSUNTO.
 *
 * Regras de desenho:
 * - Segmento (pedaço entre vírgulas/quebras) que é SÓ diretiva técnica: cai.
 * - Segmento com conteúdo real: fica INTEIRO, mesmo que contenha uma palavra
 *   técnica no meio — mutilar frase boa é pior que deixar passar um adjetivo.
 * - Texto sem diretiva nenhuma (ex.: roteiro de vídeo): volta INTACTO.
 * - Sobrou nada: devolve "" — quem chama decide pedir uma ideia ao aluno em
 *   vez de inventar legenda genérica.
 *
 * Módulo puro, sem alias @/, sem dependência — testável com node --test.
 */

/** Flags de ferramenta de geração no meio do texto: --ar 16:9, --v 6, --style raw… */
const FLAGS_INLINE = /(^|\s)--[a-z][\w-]*(?:\s+[\w:./-]+)?/gi;

/** Peso de ênfase estilo Stable Diffusion/MidJourney: "(termo:1.2)" e "termo::2". */
const PESO_PARENTESES = /\(([^()]*?):\d+(?:\.\d+)?\)/g;
const PESO_DUPLO_DOIS_PONTOS = /(\S)::\d+(?:\.\d+)?\b/g;

/**
 * Diretivas técnicas de renderização/fotografia (EN + pt-BR — o gerador de
 * prompt da casa escreve em português, mas prompt colado de fora vem em inglês).
 * Cada padrão é avaliado por segmento, case-insensitive.
 */
const DIRETIVAS_TECNICAS: RegExp[] = [
  // resolução / qualidade de render
  /\b(?:2k|4k|8k|16k|1080p|720p|uhd|full\s?hd|hdr)\b/i,
  /\b(?:ultra|highly|hyper|insanely|extremely|super)[\s-]?detailed\b/i,
  /\b(?:ultra|altamente|extremamente|super)[\s-]?detalhad[oa]s?\b/i,
  /\bmasterpiece\b|\bobra[\s-]prima\b/i,
  /\b(?:best|high(?:est)?|top)\s?quality\b/i,
  /\balta\s(?:resolu[çc][ãa]o|defini[çc][ãa]o|qualidade)\b/i,
  /\baward[\s-]?winning\b/i,
  /\btrending\son\s\w+\b|\bartstation\b/i,
  // foco / profundidade
  /\b(?:sharp|soft|crisp)\sfocus\b/i,
  /\bfoco\s(?:n[ií]tido|suave|perfeito)\b/i,
  /\bdepth\sof\sfield\b|\bprofundidade\sde\scampo\b/i,
  /\bbokeh\b/i,
  // iluminação como diretiva
  /\b(?:cinematic|studio|dramatic|volumetric|professional|soft|moody|natural|golden\shour|rim|ambient)\s?light(?:ing)?\b/i,
  /\bilumina[çc][ãa]o\s(?:cinematogr[áa]fica|de\sest[úu]dio|dram[áa]tica|volum[ée]trica|profissional|suave|natural|difusa|lateral)\b/i,
  /\bluz\s(?:de\sest[úu]dio|cinematogr[áa]fica|difusa|dram[áa]tica|volum[ée]trica)\b/i,
  // fundo como diretiva
  /\b(?:studio|blurred|white|plain|neutral|clean|seamless|solid)\sbackground\b/i,
  /\bfundo\s(?:de\sest[úu]dio|desfocado|branco|neutro|liso|infinito|s[óo]lido)\b/i,
  // realismo de render
  /\bphoto[\s-]?realistic\b|\b(?:hyper|ultra)[\s-]?realistic\b/i,
  /\bfotor?[\s-]?realista\b|\b(?:hiper|ultra)[\s-]?r?realista\b|\bultrarrealista\b/i,
  /\boctane\srender\b|\bunreal\sengine\b|\bray[\s-]?trac(?:ed|ing)\b|\b3d\srender\b/i,
  /\brender(?:ed|ing)?\b|\brenderiza[çc][ãa]o\b/i,
  /\bcinematic\b|\bcinematogr[áa]fic[oa]\b/i,
  // câmera / lente / filme
  /\b(?:lente\s)?\d{1,3}\s?mm(?:\s(?:lens|film|filme))?\b/i,
  /\bf\/\d+(?:\.\d+)?\b/i,
  /\bshot\son\b|\bdslr\b|\bmirrorless\b/i,
  /\bcanon\s?(?:eos)?\s?\w*\d\w*\b|\bsony\s?a\d\w*\b|\bnikon\s?[dz]\d+\b|\bleica\b|\bhasselblad\b|\bfujifilm\b/i,
];

/** Palavras de ligação que sozinhas não fazem um segmento valer a pena. */
const CONECTIVOS = new Set([
  // pt
  "de", "da", "do", "das", "dos", "com", "sem", "em", "no", "na", "nos", "nas",
  "um", "uma", "uns", "umas", "para", "pra", "por", "que", "muito", "mais",
  "estilo", "tipo",
  // en
  "the", "and", "with", "very", "for", "style", "of", "in", "on", "a", "an",
]);

/** O que sobra do segmento tem conteúdo de verdade (alguma palavra com letra, ≥3 chars, fora conectivo)? */
function temConteudo(texto: string): boolean {
  const palavras = texto.match(/[\p{L}\p{N}]+/gu) ?? [];
  return palavras.some(
    (p) => p.length >= 3 && /\p{L}/u.test(p) && !CONECTIVOS.has(p.toLowerCase()),
  );
}

/** O segmento é (quase) só diretiva técnica? */
function segmentoEhTecnico(segmento: string): boolean {
  let resto = segmento;
  let bateu = false;
  for (const padrao of DIRETIVAS_TECNICAS) {
    const re = new RegExp(padrao.source, "gi");
    if (re.test(resto)) {
      bateu = true;
      resto = resto.replace(new RegExp(padrao.source, "gi"), " ");
    }
  }
  return bateu && !temConteudo(resto);
}

/**
 * Remove diretiva técnica de renderização do contexto; devolve só o assunto.
 * Sem diretiva nenhuma → texto original intacto (trim). Só diretiva → "".
 */
export function cleanCaptionContext(context: string): string {
  const original = context.trim();
  if (!original) return "";

  const semFlags = original
    .replace(PESO_PARENTESES, "$1")
    .replace(PESO_DUPLO_DOIS_PONTOS, "$1")
    .replace(FLAGS_INLINE, " ");

  const linhas = semFlags.split("\n");
  let removeuAlgo = semFlags !== original;
  const linhasLimpa: string[] = [];

  for (const linha of linhas) {
    const segmentos = linha.split(/[,;•|]/);
    const mantidos: string[] = [];
    for (const seg of segmentos) {
      const s = seg.trim();
      if (!s) continue;
      if (segmentoEhTecnico(s)) {
        removeuAlgo = true;
        continue;
      }
      mantidos.push(s);
    }
    if (mantidos.length > 0) linhasLimpa.push(mantidos.join(", "));
    else if (segmentos.some((s) => s.trim())) removeuAlgo = true;
  }

  // Nada de técnico no texto? Devolve INTACTO — não normaliza espaço nem vírgula.
  if (!removeuAlgo) return original;

  const resultado = linhasLimpa.join("\n").replace(/[ \t]{2,}/g, " ").trim();
  // Sobrou só resto sem conteúdo (pontuação, conectivo)? Então não sobrou assunto.
  return temConteudo(resultado) ? resultado : "";
}
