/**
 * Guarda o ANEXO que o aluno manda por e-mail.
 *
 * 🔴 Caso Claudia (14/08): a Fast pediu o print, a aluna mandou, e a imagem
 * não ficou em lugar nenhum — o incidente chegou ao Sentinela dizendo
 * "verificar imagem anexada no e-mail anterior" com `attachment_path` vazio.
 * Resultado: tive que abrir a caixa do suporte@ por IMAP na mão pra ver a
 * tela de erro. Toda vez que alguém responde com foto, a prova evaporava.
 *
 * Agora o arquivo sobe pro R2 e o caminho vai no incidente.
 *
 * 🔴 #370 (12/09): isto só rodava DENTRO do `if (reason)`, ou seja, só quando a
 * Fast escalava. No caminho normal o anexo nem era salvo. Agora o
 * `mail-respond.ts` chama no caminho normal, e a falha de salvamento deixou de
 * ser silêncio: `guardarAnexos` RELATA o que não subiu, em vez de devolver
 * lista vazia igual a "não havia nada" — era impossível distinguir os dois.
 *
 * ⚠️ Só até o teto: a caixa do suporte não é canal de arquivo (um anexo de
 * 33MB já travou a Fast por 2 dias — ver mail-imap.ts).
 */
import { guardarPrintBytes } from "@/lib/support/prints";

/** Teto por arquivo. Print de celular dá 200KB-2MB; 8MB é folga. */
const MAX_ARQUIVO_BYTES = 8 * 1024 * 1024;

/**
 * PDF entrou no #370 junto com as imagens. Motivo concreto: a classe inteira do
 * incidente é REEMBOLSO, e comprovante de banco chega em PDF tanto quanto em
 * JPEG. Guardar só imagem faria a Fast dizer "recebi e já encaminhei pro time"
 * enquanto o arquivo não existia em lugar nenhum — o texto novo mentiria
 * justamente no caso que motivou a correção.
 */
const TIPOS = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf)$/i;

/** Quantos arquivos vale a pena copiar por e-mail. 3 já contam a história. */
const MAX_ARQUIVOS = 3;

type Anexo = { nome: string; tipo: string; bytes: Buffer };

/**
 * Varre as partes MIME atrás dos arquivos que a gente sabe guardar.
 *
 * Parser simples de propósito: as partes vêm separadas por boundary e o que
 * interessa é `Content-Type` + `base64`. Não vale trazer uma biblioteca de MIME
 * pra isso (o projeto não usa SDK onde fetch resolve).
 *
 * ⚠️ Isto NÃO é a lista do manifesto. Aqui entra só o que é COPIÁVEL (tipo
 * suportado, dentro do teto). O manifesto que vai pro cérebro usa
 * `listarAnexos` (mail-charset.ts) e lista TUDO que chegou, inclusive o que não
 * sabemos guardar — senão a Fast voltaria a re-pedir um .zip que o aluno acabou
 * de mandar, que é exatamente o defeito do #370.
 */
export function extrairAnexosGuardaveis(raw: string): Anexo[] {
  const out: Anexo[] = [];
  const partes = raw.split(/\r?\n--[-=_a-zA-Z0-9]{6,}/);
  for (const parte of partes) {
    const cabecaFim = parte.search(/\r?\n\r?\n/);
    if (cabecaFim < 0) continue;
    const cabeca = parte.slice(0, cabecaFim);
    if (!/Content-Transfer-Encoding:\s*base64/i.test(cabeca)) continue;
    const tipo = cabeca.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1]?.trim() ?? "";
    if (!TIPOS.test(tipo)) continue;

    const nome =
      cabeca.match(/filename="?([^"\r\n;]+)"?/i)?.[1] ??
      cabeca.match(/name="?([^"\r\n;]+)"?/i)?.[1] ??
      `print.${tipo.split("/")[1] ?? "png"}`;

    const corpo = parte.slice(cabecaFim).replace(/\s+/g, "");
    if (!corpo) continue;
    try {
      const bytes = Buffer.from(corpo, "base64");
      if (bytes.length > 0 && bytes.length <= MAX_ARQUIVO_BYTES) {
        out.push({ nome: nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60), tipo, bytes });
      }
    } catch {
      /* parte quebrada: ignora e segue */
    }
    if (out.length >= MAX_ARQUIVOS) break;
  }
  return out;
}

/** O resultado da guarda — precisa distinguir "não havia nada" de "falhou". */
export type ResultadoDeGuarda = {
  /** Chaves no R2 (entram no incidente). */
  chaves: string[];
  /** Arquivos elegíveis encontrados. */
  encontrados: number;
  /** Elegíveis que NÃO viraram chave: o upload recusou. */
  falhas: number;
  /** Erro que derrubou a varredura inteira. */
  erro: string | null;
};

/**
 * Sobe os anexos e devolve as chaves no R2. Nunca lança: perder o anexo é ruim,
 * derrubar a resposta ao aluno por causa dele é pior — quem decide o que fazer
 * com a falha é o chamador (`falhaAoGuardarAnexo`, em mail-manifesto.ts).
 *
 * 🔒 Não loga NOME de arquivo: anexo de aluno é material sensível (comprovante
 * bancário). Só a contagem vai pro log.
 */
export async function guardarAnexos(
  raw: string,
  ctx: { fromEmail: string; uid: number },
): Promise<ResultadoDeGuarda> {
  try {
    const arquivos = extrairAnexosGuardaveis(raw);
    const chaves: string[] = [];
    for (const [i, arq] of arquivos.entries()) {
      const key = `suporte/prints/${ctx.uid}-${i}-${arq.nome}`;
      const guardada = await guardarPrintBytes(arq.bytes, arq.tipo, key);
      if (guardada) chaves.push(guardada);
    }
    if (chaves.length) {
      console.log(`[agent/mail] ${chaves.length} anexo(s) guardado(s) de=${ctx.fromEmail} uid=${ctx.uid}`);
    }
    return { chaves, encontrados: arquivos.length, falhas: arquivos.length - chaves.length, erro: null };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[agent/mail] falhou ao guardar anexo:", erro);
    return { chaves: [], encontrados: 0, falhas: 0, erro };
  }
}
