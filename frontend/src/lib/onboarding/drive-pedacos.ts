/**
 * Download do Drive em PEDAÇOS (faixas Range sequenciais), com retentativa por
 * pedaço quando a resposta é a página de cota. Separado de drive.ts pela regra
 * de 400 linhas por arquivo (_frank/01_REGRAS_DURAS.md #22).
 */
import { classificarHtmlDoDrive, lerPrefixo, mensagemHtmlDoDrive } from "./drive-html.ts";

// ── Download em PEDAÇOS: o que foi MEDIDO, sem vender o que não foi ───────
// 29/08, contra dois arquivos públicos (490MB e 2,06GB) do aluno
// johnathan.ppires@gmail.com, com a cota do Drive dele já estourada:
//   (a) pedido do arquivo INTEIRO — sem Range, ou com `Range: bytes=0-`, que é
//       exatamente o que este arquivo fazia até hoje: **0 sucesso em 9
//       tentativas**. Sempre a página de cota, HTTP 200 (não 403), 2009 bytes.
//   (b) pedido por FAIXA LIMITADA (`Range: bytes=0-1048575`): parte das
//       tentativas volta 206 com bytes reais de video/mp4, parte volta a mesma
//       página. Na amostra alternada deu ~50%.
//   (c) em pedaços de 8MB com até 25 retentativas por pedaço: 218MB contínuos
//       do arquivo de 490MB (~100MB nos primeiros 25s) e então o pedaço
//       seguinte falhou nas 25 tentativas seguidas. **NÃO completou.**
// Leitura honesta: a cota do Drive é um limite de VOLUME, exaurível, que reseta
// em ~24h. Pedir por faixa limitada rende MUITO mais que pedir o arquivo
// inteiro, mas NÃO é contorno garantido — é ganho de PROBABILIDADE, não de
// certeza. Isto não é bypass de cota e não deve ser descrito assim.
// Vale mesmo assim porque hoje o único pedido que fazemos é justamente o que
// nunca passa: o aluno com arquivo grande recebe 0 byte, sempre.

/** Tamanho de cada faixa pedida. 8MB é o pedaço da medição (c). */
const PEDACO_BYTES = 8 * 1024 * 1024;
/** Tentativas por PEDAÇO quando a resposta é cota (1 original + 7 retentativas). */
const MAX_TENTATIVAS_QUOTA = 8;
/** Espera ENTRE tentativas do MESMO pedaço. Soma das 7 usadas = 57s. */
const BACKOFF_QUOTA_MS = [2_000, 5_000, 10_000, 10_000, 10_000, 10_000, 10_000];
/** Orçamento de SONO por arquivo (só o tempo dormindo, não o de transferência).
 *  Os 7s de hoje são curtos demais pra um limite que dura horas. */
const TETO_ESPERA_QUOTA_MS = 60_000;
/** Orçamento de sono no regime DEGRADADO: rende exatamente as 3 tentativas /
 *  7s de hoje (2s + 5s, e a 3ª espera de 10s já não cabe). */
const TETO_ESPERA_QUOTA_DEGRADADO_MS = 7_000;
/** Quando um arquivo esgota o orçamento na cota, os PRÓXIMOS entram no regime
 *  degradado por este tempo. Sem isto o conserto vira um tiro no pé: a rota
 *  /api/v1/onboarding/import tem maxDuration=600 e o laço de áudio roda até
 *  MAX_AUDIOS=20 arquivos — 20 × 60s de sono = 1200s, o import inteiro morre e
 *  o aluno não recebe recusa nenhuma, recebe NADA. Com o degradado o pior caso
 *  é 60s (o primeiro) + 19 × 7s ≈ 193s. Um pedaço real que volta limpa o
 *  estado, então um arquivo saudável no meio da pasta restaura o orçamento. */
const COOLDOWN_QUOTA_MS = 120_000;
/** Teto de RELÓGIO do arquivo inteiro. É guarda de "nunca pendurar", NÃO
 *  orçamento: 240s a 24MB/s (throughput real medido) dá ~5,7GB, folga sobre o
 *  maior teto de tamanho do importador (MAX_AUDIO_SOURCE_BYTES = 4GB). Quem
 *  limita o regime de cota é o orçamento de sono acima, não este. */
const TETO_RELOGIO_DOWNLOAD_MS = 240_000;

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Injeção só pra teste: sem isto o teste do retry gastaria sono real e rede.
 *  `agora` existe porque o relógio é orçamento — com `esperar` falso o
 *  `Date.now()` não anda e o teto de relógio nunca seria exercitado.
 *  Os chamadores de produção não passam nada. */
export type DriveDeps = {
  fetchImpl?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  agora?: () => number;
};

/** Última vez que um arquivo esgotou o orçamento de sono na cota. Estado de
 *  módulo de propósito: o import inteiro roda numa invocação só, e é ali que a
 *  proteção precisa valer (mesma escolha do mapa `locais` abaixo). */
// `null` = nunca esgotou. Não usar 0 como sentinela: instante 0 é um valor
// legítimo de relógio (e é o que o relógio injetado dos testes devolve).
let cotaExauridaEm: number | null = null;

/** Só pra teste: zera o regime degradado entre casos. */
export function esquecerCotaExaurida(): void {
  cotaExauridaEm = null;
}

type Orcamento = { fimDoRelogio: number; esperaRestanteMs: number };

function novoOrcamento(agora: number): Orcamento {
  const degradado = cotaExauridaEm !== null && agora - cotaExauridaEm < COOLDOWN_QUOTA_MS;
  return {
    fimDoRelogio: agora + TETO_RELOGIO_DOWNLOAD_MS,
    esperaRestanteMs: degradado ? TETO_ESPERA_QUOTA_DEGRADADO_MS : TETO_ESPERA_QUOTA_MS,
  };
}

/** Tamanho total declarado no `Content-Range: bytes 0-8388607/490000000`.
 *  `null` quando o Drive manda `*` ou não manda o cabeçalho. */
function totalDoContentRange(valor: string | null): number | null {
  const m = valor?.match(/\/\s*(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/**
 * Pede UMA faixa e devolve a Response já sabidamente não-HTML. Único ponto de
 * fetch: antes o trecho estava duplicado nos dois downloaders e só um teria
 * sido corrigido.
 *
 * Retenta SÓ na cota, que passa sozinha. 403/404/privado/página de login falham
 * na hora, como hoje: mascarar defeito de permissão como cota esconderia o
 * problema de verdade e deixaria o aluno esperando um limite que não existe.
 */
async function pedirFaixa(
  fileId: string,
  inicio: number,
  fim: number,
  deps: DriveDeps,
  orc: Orcamento,
): Promise<Response | "fim"> {
  const doFetch = deps.fetchImpl ?? fetch;
  const esperar = deps.esperar ?? dormir;
  const agora = deps.agora ?? Date.now;
  const url =
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}` +
    `&export=download&confirm=t`;

  for (let tentativa = 1; ; tentativa++) {
    // Teto de relógio: estourou, aborta com o MESMO erro transitório de hoje
    // (culpa NOSSA, aluno não é incomodado). Nunca pendura.
    if (agora() > orc.fimDoRelogio) throw new Error(mensagemHtmlDoDrive("quota", fileId));

    const res = await doFetch(url, {
      redirect: "follow",
      // Faixa LIMITADA, não `bytes=0-`. O range aberto é o pedido que a medição
      // (a) reprovou 9 vezes em 9; a faixa curta é a que passa, ainda que só às
      // vezes. O header em si continua obrigatório: SEM Range o Drive devolve
      // HTML pra arquivo grande mesmo com confirm=t, e o código lia isso como
      // "arquivo não está público" (caso 527: 8,9GB, público, 206 com Range).
      headers: { Range: `bytes=${inicio}-${fim}` },
    });

    // Pedimos além do fim do arquivo: acabou, não é erro.
    if (res.status === 416) return "fim";
    if (!res.ok) throw new Error(`Drive respondeu ${res.status} pro arquivo ${fileId}`);

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("text/html")) {
      // Pedaço real: a cota está rendendo de novo, sai do regime degradado.
      cotaExauridaEm = null;
      return res;
    }

    // HTML: o CORPO decide o diagnóstico, não o content-type sozinho.
    const tipo = classificarHtmlDoDrive(await lerPrefixo(res));
    if (tipo !== "quota") throw new Error(mensagemHtmlDoDrive(tipo, fileId));

    const espera =
      BACKOFF_QUOTA_MS[tentativa - 1] ?? BACKOFF_QUOTA_MS[BACKOFF_QUOTA_MS.length - 1] ?? 2_000;
    if (tentativa >= MAX_TENTATIVAS_QUOTA || espera > orc.esperaRestanteMs) {
      cotaExauridaEm = agora();
      throw new Error(mensagemHtmlDoDrive("quota", fileId));
    }
    orc.esperaRestanteMs -= espera;
    await esperar(espera);
  }
}

/** Consumidor de bloco. Lança quando o acumulado passa do teto de tamanho. */
type Escritor = (bloco: Buffer) => Promise<void>;

/** O Drive ignorou o Range e mandou o arquivo inteiro num 200: lê o corpo em
 *  blocos do stream — nunca um Buffer só, senão o caminho de disco perderia a
 *  proteção de RAM que existe desde o A248 (878MB). */
async function drenarCorpo(res: Response, escrever: Escritor): Promise<void> {
  if (!res.body) {
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length > 0) await escrever(b);
    return;
  }
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) await escrever(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/**
 * Baixa o arquivo em faixas sequenciais, entregando cada pedaço a `escrever` na
 * ORDEM. Sequencial de propósito: paralelizar multiplicaria o consumo da cota,
 * que é justamente o recurso escasso aqui.
 */
export async function baixarEmPedacos(
  fileId: string,
  maxBytes: number,
  deps: DriveDeps,
  escrever: Escritor,
): Promise<{ contentType: string; filename: string | null; bytes: number }> {
  const agora = deps.agora ?? Date.now;
  const orc = novoOrcamento(agora());
  const tetoMB = Math.round(maxBytes / 1e6);

  let baixados = 0;
  let total: number | null = null;
  let contentType = "";
  let filename: string | null = null;

  const entregar = async (bloco: Buffer): Promise<void> => {
    baixados += bloco.length;
    if (baixados > maxBytes) {
      throw new Error(`Arquivo ${fileId} passou de ${tetoMB}MB no download`);
    }
    await escrever(bloco);
  };

  while (total === null || baixados < total) {
    const inicio = baixados;
    const pedido = total === null ? PEDACO_BYTES : Math.min(PEDACO_BYTES, total - inicio);
    const res = await pedirFaixa(fileId, inicio, inicio + pedido - 1, deps, orc);
    if (res === "fim") break;

    if (inicio === 0) {
      contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      filename = parseFilename(res.headers.get("content-disposition"));
      total = totalDoContentRange(res.headers.get("content-range"));
      if (total === null && res.status !== 206) {
        const declarado = Number(res.headers.get("content-length") ?? 0);
        total = declarado > 0 ? declarado : null;
      }
      // Teto de TAMANHO antes de gastar rede. A mensagem tem que continuar
      // casando com a regex de import.ts:584 (`/teto \d+ ?MB|passa do
      // teto|passou de \d+ ?MB/i`) — é ela que decide se o resgate por
      // streaming é acionado. Mudar o texto desliga o resgate em silêncio.
      if (total !== null && total > maxBytes) {
        throw new Error(`Arquivo ${fileId} tem ${Math.round(total / 1e6)}MB (teto ${tetoMB}MB)`);
      }
    }

    if (res.status !== 206) {
      await drenarCorpo(res, entregar);
      break;
    }

    const pedaco = Buffer.from(await res.arrayBuffer());
    if (pedaco.length === 0) break;
    await entregar(pedaco);
    // Sem tamanho declarado, pedaço curto = fim do arquivo.
    if (total === null && pedaco.length < pedido) break;
  }

  if (baixados === 0) throw new Error(`Arquivo ${fileId} veio vazio do Drive`);
  return {
    contentType: contentType.split(";")[0] || "application/octet-stream",
    filename,
    bytes: baixados,
  };
}

/** Extrai o filename do Content-Disposition (filename* UTF-8 ou filename=""). */
function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]).trim();
    } catch {
      /* cai pro filename simples */
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}
