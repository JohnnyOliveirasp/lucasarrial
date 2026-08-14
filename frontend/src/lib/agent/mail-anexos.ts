/**
 * Guarda o PRINT que o aluno manda por e-mail.
 *
 * 🔴 Caso Claudia (14/08): a Fast pediu o print, a aluna mandou, e a imagem
 * não ficou em lugar nenhum — o incidente chegou ao Sentinela dizendo
 * "verificar imagem anexada no e-mail anterior" com `attachment_path` vazio.
 * Resultado: tive que abrir a caixa do suporte@ por IMAP na mão pra ver a
 * tela de erro. Toda vez que alguém responde com foto, a prova evaporava.
 *
 * Agora a imagem sobe pro R2 e o caminho vai no incidente.
 *
 * ⚠️ Só IMAGEM e só até o teto: a caixa do suporte não é canal de arquivo
 * (um anexo de 33MB já travou a Fast por 2 dias — ver mail-imap.ts).
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

/** Teto por imagem. Print de celular dá 200KB-2MB; 8MB é folga. */
const MAX_IMAGEM_BYTES = 8 * 1024 * 1024;
const TIPOS = /^image\/(png|jpe?g|webp|gif|heic)$/i;

type Anexo = { nome: string; tipo: string; bytes: Buffer };

/**
 * Varre as partes MIME atrás de imagens em base64.
 *
 * Parser simples de propósito: as partes vêm separadas por boundary e o que
 * interessa é `Content-Type: image/*` + `base64`. Não vale trazer uma
 * biblioteca de MIME pra isso (o projeto não usa SDK onde fetch resolve).
 */
export function extrairImagens(raw: string): Anexo[] {
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
      if (bytes.length > 0 && bytes.length <= MAX_IMAGEM_BYTES) {
        out.push({ nome: nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60), tipo, bytes });
      }
    } catch {
      /* parte quebrada: ignora e segue */
    }
    if (out.length >= 3) break; // 3 prints já contam a história
  }
  return out;
}

/**
 * Sobe as imagens e devolve as chaves no R2. Nunca lança: perder o print é
 * ruim, mas não pode derrubar a resposta ao aluno.
 */
export async function guardarPrints(
  raw: string,
  ctx: { fromEmail: string; uid: number },
): Promise<string[]> {
  try {
    const imagens = extrairImagens(raw);
    const chaves: string[] = [];
    for (const [i, img] of imagens.entries()) {
      const key = `suporte/prints/${ctx.uid}-${i}-${img.nome}`;
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKETS.generations,
          Key: key,
          Body: img.bytes,
          ContentType: img.tipo,
        }),
      );
      chaves.push(key);
    }
    if (chaves.length) {
      console.log(`[agent/mail] ${chaves.length} print(s) guardado(s) de=${ctx.fromEmail} uid=${ctx.uid}`);
    }
    return chaves;
  } catch (e) {
    console.error("[agent/mail] falhou ao guardar print:", e instanceof Error ? e.message : e);
    return [];
  }
}
