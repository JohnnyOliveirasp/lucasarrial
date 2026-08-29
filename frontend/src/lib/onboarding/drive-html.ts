/**
 * HTML no lugar do arquivo do Drive: qual HTML é qual, e de quem é a culpa.
 * Extraído de drive.ts em 29/08 só pra caber na regra de 400 linhas por
 * arquivo (_frank/01_REGRAS_DURAS.md #22) — o conteúdo abaixo é o do PR #114,
 * movido PALAVRA POR PALAVRA. `drive.ts` reexporta as duas funções públicas,
 * então nada que importava daqui precisou mudar.
 */

// ── HTML no lugar do arquivo: TRÊS causas diferentes, não uma ──────────────
// Incidente #184 (29/08). O código tratava QUALQUER `text/html` como "arquivo
// privado" e mandava o aluno arrumar o compartilhamento. Mas o Drive também
// devolve HTML quando estoura a COTA DE DOWNLOAD DO PRÓPRIO ARQUIVO — 2009
// bytes com `<title>Google Drive - Quota exceeded</title>` e "Too many users
// have viewed or downloaded this file recently". Medido na pasta do
// johnathan.ppires@gmail.com: os 4 primeiros arquivos vieram video/mp4 e do 5º
// em diante veio essa página; minutos depois o MESMO id voltou a responder 206
// video/mp4. Ou seja: link certo, permissão certa, limite temporário de rajada
// — e o aluno levava a culpa por isso, parado 2 dias com 0 vozes.

export type TipoHtmlDrive = "quota" | "privado" | "desconhecido";

/** Cota de tráfego do arquivo estourada. Testado ANTES do login: a página de
 *  cota também traz link de "Sign in" no rodapé e casaria com o padrão errado. */
const RE_QUOTA = /quota exceeded|too many users have viewed or downloaded/i;
/** Aí sim é login/privado — o diagnóstico que a mensagem antiga dava a todos. */
const RE_LOGIN = /ServiceLogin|accounts\.google\.com|Sign in/i;

/** Teto de leitura do corpo pra classificar. A página do Drive tem ~2KB; o teto
 *  existe só pra um HTML esquisito não segurar RAM à toa. */
const MAX_HTML_PREVIEW_BYTES = 64 * 1024;

/** Só a classificação, exposta pra teste. Recebe o corpo já lido. */
export function classificarHtmlDoDrive(corpo: string): TipoHtmlDrive {
  if (RE_QUOTA.test(corpo)) return "quota";
  if (RE_LOGIN.test(corpo)) return "privado";
  return "desconhecido";
}

/**
 * A mensagem que vira o `motivo` — e o `motivo` é o que decide se o ALUNO leva
 * e-mail de culpa (lib/onboarding/erro-dono.ts). Por isso o texto de cada caso
 * é parte da correção, não enfeite:
 *   quota        → NOSSO (as âncoras "limitou temporariamente"/"cota de tráfego"
 *                  estão na regra de erro-dono.ts). O aluno não é incomodado.
 *   privado      → ALUNO. Mantida PALAVRA POR PALAVRA a mensagem antiga: este é
 *                  o único caso em que o diagnóstico original estava certo.
 *   desconhecido → ALUNO, mas SEM afirmar que é permissão. Fica com o aluno de
 *                  propósito: pela regra invertida de 22/08, o que não é
 *                  comprovadamente nosso é avisado — um e-mail a mais custa
 *                  menos que um aluno parado em silêncio.
 */
export function mensagemHtmlDoDrive(tipo: TipoHtmlDrive, fileId: string): string {
  if (tipo === "quota") {
    return (
      `O Google limitou temporariamente o download do arquivo ${fileId} ` +
      `(cota de tráfego do próprio arquivo). O link está correto; costuma liberar em até 24h.`
    );
  }
  if (tipo === "privado") {
    return `Arquivo ${fileId} não está público no Drive (veio página HTML, não o arquivo)`;
  }
  return `O Drive devolveu uma página HTML inesperada no lugar do arquivo ${fileId}`;
}

/** Lê no máximo `maxBytes` do corpo e cancela o resto — não usa res.text(),
 *  que leria a resposta inteira se ela viesse grande por acidente. */
export async function lerPrefixo(res: Response, maxBytes = MAX_HTML_PREVIEW_BYTES): Promise<string> {
  if (!res.body) {
    try {
      return (await res.text()).slice(0, maxBytes);
    } catch {
      return "";
    }
  }
  const reader = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        partes.push(value);
        total += value.length;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(partes).subarray(0, maxBytes).toString("utf8");
}
