/**
 * GET /api/openapi → especificação OpenAPI 3.0 da API pública (TTS por voz).
 * O `servers[0]` usa o host atual da requisição (funciona em local e prod).
 * Renderizada pelo Swagger UI em /api/docs.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function buildSpec(origin: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "AI Clone Verse — API",
      version: "1.0.0",
      description:
        "API para gerar áudio com a sua voz clonada. Autenticação por chave " +
        "(header `x-api-key`) gerada em Configurações → API. Cada chave só " +
        "acessa as vozes do seu dono.\n\n" +
        "**Fluxo:** 1) `POST /voices/{voiceId}/generate` devolve um `generation_id` " +
        "(processamento assíncrono). 2) Faça polling em `GET /generations/{id}` a " +
        "cada ~30s; quando `status` = `ready`, a resposta traz `audio_url` (link do " +
        "`.mp3`, válido por 1h).",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
      },
      schemas: {
        GenerateRequest: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string", maxLength: 2000, example: "Olá, isso é um teste da minha voz." },
            cfg_value: { type: "number", default: 2.0 },
            inference_timesteps: { type: "integer", default: 15 },
          },
        },
        GenerateResponse: {
          type: "object",
          properties: {
            generation_id: { type: "string", format: "uuid" },
            runpod_job_id: { type: "string" },
            status: { type: "string", example: "pending" },
          },
        },
        Generation: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            voice_id: { type: "string", format: "uuid" },
            text_raw: { type: "string" },
            status: { type: "string", enum: ["pending", "generating", "ready", "failed"] },
            duration_seconds: { type: "number", nullable: true },
            elapsed_seconds: { type: "number", nullable: true },
            audio_url: {
              type: "string",
              nullable: true,
              description: "Presigned URL do .mp3 (válida ~1h). Preenchida quando status=ready.",
            },
            error_message: { type: "string", nullable: true },
          },
        },
        Voice: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            status: { type: "string", example: "ready" },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/api/v1/voices": {
        get: {
          summary: "Lista suas vozes",
          description: "Retorna as vozes da conta dona da chave. Use o `id` de uma voz `ready` na geração.",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { voices: { type: "array", items: { $ref: "#/components/schemas/Voice" } } },
                  },
                },
              },
            },
            "401": { description: "Chave ausente ou inválida" },
          },
        },
      },
      "/api/v1/voices/{voiceId}/generate": {
        post: {
          summary: "Gera áudio com uma voz",
          description:
            "Submete a geração (assíncrona). Devolve `generation_id`; consulte o status em " +
            "`GET /api/v1/generations/{id}`.",
          parameters: [
            {
              name: "voiceId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "ID de uma voz com status `ready`.",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/GenerateRequest" } },
            },
          },
          responses: {
            "200": {
              description: "Geração submetida",
              content: { "application/json": { schema: { $ref: "#/components/schemas/GenerateResponse" } } },
            },
            "400": { description: "Texto ausente/grande ou voz não pronta" },
            "401": { description: "Chave ausente ou inválida" },
            "404": { description: "Voz não encontrada" },
          },
        },
      },
      "/api/v1/generations/{id}": {
        get: {
          summary: "Status da geração (polling)",
          description:
            "Repita a cada ~30s até `status` = `ready`. Aí a resposta traz `audio_url` (link do .mp3).",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { generation: { $ref: "#/components/schemas/Generation" } },
                  },
                },
              },
            },
            "401": { description: "Chave ausente ou inválida" },
            "404": { description: "Geração não encontrada" },
          },
        },
      },
    },
  };
}

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Atrás do nginx (prod), o host real vem nos headers de proxy. Sem proxy
  // (local), cai no host da própria URL. Assim o Swagger mostra o domínio
  // público correto sem configuração manual.
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const origin = `${proto}://${host}`;
  return NextResponse.json(buildSpec(origin));
}
