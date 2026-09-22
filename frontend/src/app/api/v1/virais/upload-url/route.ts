/**
 * POST /api/v1/virais/upload-url — o OUTRO jeito de mandar um viral.
 *
 * Ordem do Johnny 22/09: "as pessoas precisam subir o vídeo na plataforma que
 * quiserem, seja o vídeo por link ou o vídeo por upload". Então além do link,
 * o aluno pode mandar o arquivo direto.
 *
 * O arquivo vai do NAVEGADOR pro R2 (presigned PUT), sem passar pelo Next: o
 * /tmp do Hetzner é RAM (medido em 22/08), e 100 MB atravessando a aplicação
 * é memória que falta pro resto da casa.
 *
 * O teto vive em `LIMITE_VIRAL` (um lugar só, usado aqui e na tela). Ele é
 * checado DE NOVO depois do upload, em /enviar: o navegador diz o tamanho que
 * quiser, e o presigned PUT não sabe recusar por isso.
 */
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, unauthorized } from "@/lib/api/responses";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedPut } from "@/lib/r2/presigned";
import { LIMITE_VIRAL, TIPOS_ACEITOS } from "@/lib/virais/limites";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { content_type?: unknown; bytes?: unknown; filename?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const tipo = String(body.content_type ?? "").toLowerCase().trim();
  if (!TIPOS_ACEITOS.has(tipo)) {
    return badRequest("Formato não suportado — envie MP4, MOV ou WebM.");
  }

  const bytes = Number(body.bytes ?? 0);
  if (Number.isFinite(bytes) && bytes > LIMITE_VIRAL.bytes) {
    return badRequest(
      `Esse arquivo tem ${(bytes / 1024 / 1024).toFixed(0)} MB. O limite é ${LIMITE_VIRAL.mb} MB.`,
    );
  }

  const key = `virais/comunidade/upload/${auth.user_id}/${randomUUID()}.mp4`;
  const uploadUrl = await createPresignedPut(R2_BUCKETS.generations, key, tipo, 3600);

  return jsonOk({ key, upload_url: uploadUrl, limite_mb: LIMITE_VIRAL.mb });
}
