/**
 * GUARDA DE MANDATO do normalizador de TTS (incidente #192).
 *
 * O QUE ESTA AQUI RESOLVE
 * O normalizador (normalize.ts) manda o texto do aluno pro gpt-4.1 com um
 * SYSTEM que autoriza um conjunto FECHADO de mudanças: expandir número, moeda,
 * data, porcentagem, abreviação, símbolo e unidade; reescrever estrangeirismo e
 * palavra técnica longa pela pronúncia; corrigir erro de digitação óbvio; tirar
 * rubrica de produção e marcação de tempo. O prompt diz, com todas as letras,
 * "gírias e regionalismos ficam como estão. Na dúvida, NÃO altere".
 *
 * Medido em 30/08 sobre 3.258 gerações que têm text_raw e text_normalized: o
 * modelo troca PALAVRA do aluno fora desse mandato. A troca mais frequente de
 * todas é "pra" -> "para" (134 ocorrências, 102 gerações, 58 alunos). Junto vêm
 * "clica" -> "clique", "olha" -> "olhe", "esse" -> "este", "vamos" -> "vai",
 * "real" -> "verdade" e duas violações diretas do próprio prompt: "digital" ->
 * "dijital" (a palavra está listada NOMINALMENTE entre as intocáveis) e
 * "creator" -> "criador" (tradução, proibida em maiúsculas).
 *
 * POR QUE É CÓDIGO E NÃO PROMPT
 * O prompt já manda não fazer. O modelo faz assim mesmo — "digital" é a prova.
 * Instrução não é garantia; guarda determinística é.
 *
 * POR QUE AS GUARDAS ANTIGAS NÃO PEGAVAM
 * `keepsOriginalWords` exige 50% das palavras preservadas (foi feita contra o
 * caso Anderson, em que o modelo RESPONDIA ao texto): trocar 2 palavras em 81
 * passa folgado. E o QA de intrusão do worker compara o áudio com o texto JÁ
 * reescrito — ele nunca vê o texto do aluno.
 *
 * COMO ESTA GUARDA FUNCIONA
 * Alinha text_raw x saída do LLM palavra a palavra (LCS) e olha SÓ as
 * substituições 1-para-1 de palavra alfabética. Expansão (1 palavra vira
 * várias), remoção (rubrica, marcação de tempo) e inserção não são tocadas —
 * é justamente ali que mora o trabalho legítimo, e desfazer isso devolveria
 * "R$ 50,90" cru pro sintetizador. Cada substituição 1x1 é classificada; a que
 * não couber no mandato volta a ser a palavra do aluno, no lugar dela, sem
 * mexer em pontuação nem no número de fins de frase.
 *
 * ORDEM DE DECISÃO (a primeira que casar decide):
 *   0. não é substituição 1x1 alfabética, ou só muda acento/caixa  -> não mexe
 *   1. palavra do aluno em CAIXA ALTA (sigla)                      -> não mexe
 *   2. alongamento ("diaaa" -> "dia", "carrro" -> "carro")         -> mantém
 *   3. palavra PROTEGIDA (fala/classe fechada/nominal do prompt)   -> REVERTE
 *   4. formato de abreviação ("dra" -> "doutora")                  -> mantém
 *   5. palavra com cara de estrangeira ("marketing", "reels")      -> mantém
 *   6. troca só de flexão ("clica" -> "clique", "rede" -> "redes")  -> REVERTE
 *   7. troca lexical ("creator" -> "criador", "humano" -> "dia")   -> REVERTE
 *   8. resto (erro de digitação, técnica longa em g->j)            -> mantém
 */

// ── básico ────────────────────────────────────────────────────────────────

/** minúscula sem acento — é a chave de comparação. Conserto de acento
 *  ("so" -> "só", "n[U+FFFD]o" -> "não") fica INVISÍVEL aqui de propósito:
 *  é trabalho legítimo e a guarda nunca deve desfazer. */
export function chave(palavra: string): string {
  return palavra
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const SO_LETRAS = /^[a-z]+$/;

/** Distância de edição (Levenshtein) com duas linhas. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let ant = new Uint16Array(b.length + 1);
  let cur = new Uint16Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) ant[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + custo);
    }
    const t = ant;
    ant = cur;
    cur = t;
  }
  return ant[b.length];
}

/** 1 = idênticas, 0 = nada a ver. */
export function semelhanca(a: string, b: string): number {
  const maior = Math.max(a.length, b.length);
  return maior === 0 ? 1 : 1 - distancia(a, b) / maior;
}

function prefixoComum(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function eSubsequencia(curta: string, longa: string): boolean {
  let i = 0;
  for (const c of longa) if (i < curta.length && curta[i] === c) i++;
  return i === curta.length;
}

/** Colapsa letra repetida ("diaaa" -> "dia", "carrro" -> "caro"). */
function semRepeticao(w: string): string {
  return w.replace(/(.)\1+/g, "$1");
}

// ── listas do mandato ─────────────────────────────────────────────────────

/**
 * PALAVRAS QUE O NORMALIZADOR NÃO TEM MANDATO PARA TROCAR.
 *
 * Três grupos, e cada um tem o mesmo argumento por trás: nenhuma dessas
 * palavras é número, moeda, data, abreviação, estrangeirismo ou termo técnico
 * longo — ou seja, NENHUMA delas pode cair em qualquer categoria que o prompt
 * autoriza. Logo, desfazer uma troca aqui nunca destrói trabalho legítimo. A
 * única mudança legítima possível nelas seria acento/caixa, e essa é invisível
 * pra guarda (ver `chave`).
 *
 *  (a) FORMA FALADA / gíria / regionalismo — o prompt manda deixar como está;
 *      é o grupo de "pra", a troca nº 1 do defeito.
 *  (b) CLASSE GRAMATICAL FECHADA — artigo, preposição, pronome, demonstrativo,
 *      conjunção, quantificador, advérbio comum e as formas dos verbos
 *      auxiliares. Classe fechada não ganha palavra nova, então a lista é
 *      completa por construção.
 *  (c) NOMINAIS DO PRÓPRIO PROMPT — "digital", "vídeo", "online", "celular",
 *      "mídia", "postar/posta/postou" e as siglas que se soletram. O prompt já
 *      as lista como intocáveis; aqui elas passam a ser garantia.
 *
 * Tudo em minúscula e sem acento (é a `chave`).
 */
export const PROTEGIDAS: ReadonlySet<string> = new Set([
  // (a) forma falada, gíria, regionalismo
  "pra", "pras", "pro", "pros", "prum", "pruma", "ta", "tao", "to", "ce", "ces",
  "ne", "num", "numa", "nuns", "numas", "dum", "duma", "duns", "dumas", "vamo",
  "tamo", "tamos", "tava", "tavam", "trampo", "mano", "mina", "galera", "bora",
  "oxe", "uai", "cade", "tipo", "grana", "rolar", "rola", "massa", "curtir",
  "curte", "curti", "bagulho", "treta", "papo", "sacar", "saca",

  // (b) classe fechada — artigo e preposição
  "o", "a", "os", "as", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "por", "pelo",
  "pela", "pelos", "pelas", "ao", "aos", "com", "sem", "sob", "sobre", "ate",
  "apos", "ante", "contra", "desde", "entre", "perante", "tras", "para", "pera",
  // pronome pessoal e possessivo
  "eu", "tu", "ele", "ela", "eles", "elas", "voce", "voces", "me", "te", "se",
  "lhe", "lhes", "mim", "ti", "si", "comigo", "contigo", "consigo", "conosco",
  "convosco", "vos", "meu", "meus", "minha", "minhas", "teu", "teus", "tua",
  "tuas", "seu", "seus", "sua", "suas", "nosso", "nossos", "nossa", "nossas",
  "vosso", "vossa", "dele", "dela", "deles", "delas", "nele", "nela", "neles",
  "nelas",
  // demonstrativo
  "este", "esta", "estes", "estas", "isto", "esse", "essa", "esses", "essas",
  "isso", "aquele", "aquela", "aqueles", "aquelas", "aquilo", "deste", "desta",
  "destes", "destas", "disto", "desse", "dessa", "desses", "dessas", "disso",
  "daquele", "daquela", "daquilo", "neste", "nesta", "nestes", "nestas",
  "nisto", "nesse", "nessa", "nesses", "nessas", "nisso", "naquele", "naquela",
  "naquilo",
  // conjunção, relativo e interrogativo
  "e", "mas", "porem", "contudo", "todavia", "entretanto", "porque", "pois",
  "que", "quando", "enquanto", "embora", "conforme", "como", "assim", "logo",
  "portanto", "entao", "ou", "nem", "caso", "quem", "qual", "quais", "quanto",
  "quanta", "quantos", "quantas", "onde", "aonde", "cujo", "cuja", "cujos",
  "cujas",
  // advérbio e quantificador comuns
  "nao", "sim", "tambem", "ainda", "ja", "agora", "hoje", "ontem", "amanha",
  "sempre", "nunca", "jamais", "talvez", "apenas", "so", "somente", "muito",
  "muita", "muitos", "muitas", "pouco", "pouca", "poucos", "poucas", "mais",
  "menos", "bem", "mal", "melhor", "pior", "aqui", "ali", "la", "ca", "perto",
  "longe", "dentro", "fora", "cima", "baixo", "antes", "depois", "cedo",
  "tarde", "devagar", "rapido", "junto", "juntos", "tudo", "todo", "toda",
  "todos", "todas", "nada", "algo", "alguem", "ninguem", "cada", "outro",
  "outra", "outros", "outras", "mesmo", "mesma", "mesmos", "mesmas", "proprio",
  "propria", "tal", "tais", "real", "reais", "verdade",
  // verbo auxiliar e de altíssima frequência (as formas, não o lema)
  "ser", "sou", "es", "somos", "sao", "era", "eram", "fui", "foi", "foram",
  "sera", "serao", "seja", "sejam", "sendo", "sido",
  "estar", "estou", "esta", "estamos", "estao", "estava", "estavam", "estive",
  "esteve", "estara", "esteja", "estejam", "estando",
  "ter", "tenho", "tem", "temos", "tenha", "tenham", "tinha", "tinham", "tive",
  "teve", "tera", "terao", "tendo", "tido",
  "haver", "ha", "havia", "houve", "havera",
  "ir", "vou", "vai", "vamos", "vao", "ia", "iam", "va", "indo",
  "vir", "venho", "vem", "vimos", "veem", "venha", "venham", "vindo", "veio",
  "fazer", "faco", "faz", "fazemos", "fazem", "fez", "fazia", "fara", "faca",
  "facam", "fazendo", "feito",
  "poder", "posso", "pode", "podemos", "podem", "podia", "podera", "possa",
  "possam", "podendo",
  "querer", "quero", "quer", "queremos", "querem", "queria", "quis", "queira",
  "querendo",
  "saber", "sei", "sabe", "sabemos", "sabem", "sabia", "soube", "saiba",
  "sabendo",
  "dar", "dou", "damos", "dao", "deu", "dava", "dara", "deem", "dando",
  "ver", "vejo", "ve", "vemos", "viu", "via", "vera", "veja", "vejam", "vendo",
  "visto",
  "dizer", "digo", "diz", "dizemos", "dizem", "disse", "dizia", "dira", "diga",
  "digam", "dizendo", "dito",

  // (c) nominais que o próprio SYSTEM do normalizador manda não tocar
  "digital", "digitais", "digitalmente", "video", "videos", "online",
  "celular", "celulares", "midia", "midias",
  "postar", "posta", "postas", "posto", "postos", "postou", "postam", "postei",
  "postamos", "postando", "postado", "postada", "postados", "postadas",
  "ia", "ceo",
]);

/**
 * Terminações flexionais do português. Servem pra reconhecer troca de MODO,
 * PESSOA, NÚMERO ou GÊNERO — que é reescrita gramatical, não normalização.
 * Lista deliberadamente curta: terminação rara fica de fora pra não confundir
 * flexão com conserto de erro de digitação (que é legítimo).
 */
const TERMINACOES: ReadonlySet<string> = new Set([
  "", "s", "m", "r",
  "a", "o", "e", "as", "os", "es",
  "am", "em", "ou", "ei", "eu",
  "ar", "er", "ir",
  "ao", "oes", "ais",
  "ndo", "ando", "endo", "indo",
  "mos", "amos", "emos", "imos", "rmos", "armos", "ermos", "irmos",
  "ue", "uem", "uei", "ues",
]);

/** Letras com que palavra portuguesa termina. Fora daqui é palavra de fora. */
const FINAL_PT = /[aeioulmnrsxz]$/;

/** Dígrafos e encontros que o português não usa. "ss"/"rr" ficam de fora da
 *  lista porque são normais em português ("nosso", "carro"). */
const NAO_PORTUGUES = /(sh|th|ck|ph|wh|ee|oo|ll|ff|tt|zz|bb|dd|gg|pp|mm|nn)/;

/** Português não começa palavra com s + consoante ("stories", "studio"). */
const S_INICIAL_ESTRANGEIRA = /^s[bcdfgklmnpqrtvz]/;

/**
 * Estrangeirismos que o SYSTEM cita nominalmente e cuja forma escrita não
 * denuncia a origem — sem isto, "design" -> "dizáin" (21 ocorrências) e
 * "reel" -> "riul" seriam desfeitos por engano.
 */
const ESTRANGEIRAS_NOMINAIS: ReadonlySet<string> = new Set([
  "design", "designer", "designers", "reel", "reels", "story", "stories",
  "feed", "feeds", "post", "posts", "influencer", "influencers", "podcast",
  "podcasts", "lead", "leads", "hashtag", "hashtags", "live", "lives",
  "creator", "creators", "site", "sites", "email", "emails", "link", "links",
  "banner", "banners", "close", "print", "prints", "outdoor", "release",
]);

/** Palavra com cara de estrangeira — o prompt MANDA reescrever essas pela
 *  pronúncia, então a guarda não pode desfazer. */
export function pareceEstrangeira(w: string): boolean {
  if (ESTRANGEIRAS_NOMINAIS.has(w)) return true;
  if (/[kwy]/.test(w)) return true;
  if (NAO_PORTUGUES.test(w)) return true;
  if (S_INICIAL_ESTRANGEIRA.test(w)) return true;
  if (!FINAL_PT.test(w)) return true;
  return false;
}

/** c/qu e g/gu antes de e/i são a MESMA consoante ("clica"/"clique",
 *  "divulga"/"divulgue"). Sem isto a flexão passa despercebida. */
function canonizaRadical(w: string): string {
  return w.replace(/qu(?=[ei])/g, "c").replace(/gu(?=[ei])/g, "g");
}

// ── classificação de uma substituição 1x1 ────────────────────────────────

export type Veredito =
  | "mantem-alongamento"
  | "mantem-abreviacao"
  | "mantem-estrangeira"
  | "mantem"
  | "reverte-protegida"
  | "reverte-flexao"
  | "reverte-troca-lexical";

/** Limiar de semelhança abaixo do qual a troca é outra palavra, não um
 *  conserto de digitação. Calibrado no histórico: "creator"/"criador" fica em
 *  0,714 e precisa cair; "aluguro"/"aluguel" (0,714 também) é salvo antes,
 *  pelo prefixo comum de 5 letras. */
const LIMIAR_TROCA_LEXICAL = 0.75;

/**
 * Decide o destino de UMA substituição 1x1, já em `chave` (minúscula sem
 * acento). `cruEmCaixaAlta` diz se a palavra aparecia toda em maiúscula no
 * texto do aluno (sigla — nunca se mexe, e desfazer ali quebraria expansão
 * de sigla em várias palavras).
 */
export function classificaTroca(
  cru: string,
  saida: string,
  cruEmCaixaAlta: boolean,
): Veredito {
  if (cru === saida) return "mantem";
  if (!SO_LETRAS.test(cru) || !SO_LETRAS.test(saida)) return "mantem";
  if (cruEmCaixaAlta && cru.length >= 2) return "mantem";

  // 2. alongamento e letra duplicada: "diaaa" -> "dia", "carrro" -> "carro"
  if (semRepeticao(cru) === semRepeticao(saida)) return "mantem-alongamento";

  // 3. palavra sem mandato de troca
  if (PROTEGIDAS.has(cru)) return "reverte-protegida";

  // 4. abreviação virando palavra inteira: "dra" -> "doutora", "vcs" -> "voces"
  if (cru.length <= 5 && saida.length >= cru.length + 2 && eSubsequencia(cru, saida)) {
    return "mantem-abreviacao";
  }

  // 5. estrangeirismo: o prompt manda reescrever pela pronúncia
  if (pareceEstrangeira(cru)) return "mantem-estrangeira";

  // 6. só mudou a flexão (modo, pessoa, número, gênero)
  if (cru.length >= 4 && FINAL_PT.test(cru)) {
    const a = canonizaRadical(cru);
    const b = canonizaRadical(saida);
    const p = prefixoComum(a, b);
    if (p >= 3 && TERMINACOES.has(a.slice(p)) && TERMINACOES.has(b.slice(p))) {
      return "reverte-flexao";
    }
  }

  // 7. outra palavra no lugar (sinônimo, tradução, termo trocado)
  if (
    cru.length >= 4 &&
    saida.length >= 3 &&
    prefixoComum(cru, saida) < 4 &&
    semelhanca(cru, saida) < LIMIAR_TROCA_LEXICAL
  ) {
    return "reverte-troca-lexical";
  }

  // 8. erro de digitação, técnica longa reescrita em g->j, o que sobrar
  return "mantem";
}

// ── alinhamento palavra a palavra ────────────────────────────────────────

type Pedaco = { texto: string; ehPalavra: boolean };

/** Quebra em pedaços preservando TUDO (a junção dos pedaços é o texto). */
function fatia(texto: string): Pedaco[] {
  const out: Pedaco[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) out.push({ texto: texto.slice(ultimo, m.index), ehPalavra: false });
    out.push({ texto: m[0], ehPalavra: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) out.push({ texto: texto.slice(ultimo), ehPalavra: false });
  return out;
}

/** Teto de custo do alinhamento. Acima disso a guarda se abstém (devolve a
 *  saída do LLM intacta) em vez de gastar tempo na rota de geração. */
const TETO_ALINHAMENTO = 4_000_000;

type Operacao =
  | { tipo: "igual"; i: number; j: number }
  | { tipo: "troca"; cru: number[]; saida: number[] };

/** Alinhamento por LCS. Devolve null quando é grande demais pra medir. */
function alinha(a: string[], b: string[]): Operacao[] | null {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return null;
  if (n * m > TETO_ALINHAMENTO) return null;

  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 1; i <= n; i++) {
    const linha = dp[i];
    const acima = dp[i - 1];
    for (let j = 1; j <= m; j++) {
      linha[j] = a[i - 1] === b[j - 1] ? acima[j - 1] + 1 : Math.max(acima[j], linha[j - 1]);
    }
  }

  const ops: Operacao[] = [];
  let i = n;
  let j = m;
  let pa: number[] = [];
  let pb: number[] = [];
  const fecha = () => {
    if (pa.length || pb.length) ops.push({ tipo: "troca", cru: pa.reverse(), saida: pb.reverse() });
    pa = [];
    pb = [];
  };
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      fecha();
      i--;
      j--;
      ops.push({ tipo: "igual", i, j });
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      pa.push(--i);
    } else {
      pb.push(--j);
    }
  }
  while (i > 0) pa.push(--i);
  while (j > 0) pb.push(--j);
  fecha();
  return ops.reverse();
}

// ── a guarda ─────────────────────────────────────────────────────────────

export type Reversao = { cru: string; saida: string; motivo: Veredito };

export type ResultadoGuarda = {
  /** A saída do LLM com as trocas fora do mandato desfeitas. */
  texto: string;
  /** O que foi revertido (pra log/medição). */
  revertidas: Reversao[];
  /** O que foi olhado e mantido de propósito (pra log/medição). */
  mantidas: Reversao[];
  /** true quando o texto era grande demais e a guarda se absteve. */
  abstida: boolean;
};

/**
 * Confere a saída do LLM contra o texto do aluno e desfaz troca de palavra
 * fora do mandato. Só mexe em substituição 1-para-1 de palavra alfabética:
 * expansão, remoção e inserção passam intactas, e nenhum caractere de
 * pontuação é criado ou apagado — o número de fins de frase da saída do LLM
 * não muda.
 */
export function aplicaGuardaDeMandato(cru: string, saida: string): ResultadoGuarda {
  const pedacosCru = fatia(cru);
  const pedacosSaida = fatia(saida);

  const idxCru: number[] = [];
  const idxSaida: number[] = [];
  pedacosCru.forEach((p, k) => p.ehPalavra && idxCru.push(k));
  pedacosSaida.forEach((p, k) => p.ehPalavra && idxSaida.push(k));

  const chavesCru = idxCru.map((k) => chave(pedacosCru[k].texto));
  const chavesSaida = idxSaida.map((k) => chave(pedacosSaida[k].texto));

  const ops = alinha(chavesCru, chavesSaida);
  if (!ops) return { texto: saida, revertidas: [], mantidas: [], abstida: true };

  const revertidas: Reversao[] = [];
  const mantidas: Reversao[] = [];

  for (const op of ops) {
    if (op.tipo !== "troca") continue;
    // SÓ substituição 1x1. 1-pra-muitos é expansão (o trabalho legítimo),
    // muitos-pra-1 e os desequilibrados são rubrica/marcação saindo ou
    // expansão parcial — desfazer ali quebraria a normalização.
    if (op.cru.length !== 1 || op.saida.length !== 1) continue;

    const posCru = op.cru[0];
    const posSaida = op.saida[0];
    const textoCru = pedacosCru[idxCru[posCru]].texto;
    const alvo = pedacosSaida[idxSaida[posSaida]];
    const kCru = chavesCru[posCru];
    const kSaida = chavesSaida[posSaida];

    const caixaAlta = textoCru.length >= 2 && textoCru === textoCru.toUpperCase();
    const veredito = classificaTroca(kCru, kSaida, caixaAlta);
    const registro: Reversao = { cru: kCru, saida: kSaida, motivo: veredito };

    if (!veredito.startsWith("reverte")) {
      if (kCru !== kSaida) mantidas.push(registro);
      continue;
    }

    // devolve a palavra do aluno no lugar da palavra do modelo. A caixa segue
    // a da SAÍDA quando o modelo abriu frase ali, pra não estragar o começo de
    // uma frase que o LLM manteve.
    let reposta = textoCru;
    const saidaAbreMaiuscula =
      alvo.texto[0] === alvo.texto[0]?.toUpperCase() &&
      alvo.texto[0] !== alvo.texto[0]?.toLowerCase();
    const cruAbreMinuscula =
      textoCru[0] === textoCru[0]?.toLowerCase() &&
      textoCru[0] !== textoCru[0]?.toUpperCase();
    if (saidaAbreMaiuscula && cruAbreMinuscula) {
      reposta = textoCru[0].toUpperCase() + textoCru.slice(1);
    }
    alvo.texto = reposta;
    revertidas.push(registro);
  }

  return {
    texto: pedacosSaida.map((p) => p.texto).join(""),
    revertidas,
    mantidas,
    abstida: false,
  };
}
