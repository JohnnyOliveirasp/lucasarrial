/**
 * Especificação OpenAPI 3.0 da API pública — o CONTEÚDO, separado da rota.
 *
 * Módulo quase-puro de propósito (só importa constantes de outro módulo puro,
 * zero next/server): o teste de regressão (openapi-doc.test.ts) importa
 * `buildSpec` direto no `node --test` e confere que TODO path documentado
 * existe como route.ts no disco, com os métodos documentados exportados.
 * Doc que descola do código mente com autoridade — o teste impede.
 *
 * Os números dos guardrails (6/dia, 2h, 1h, 3 tentativas) vêm de
 * trial-guardrails-pure.ts — única fonte, ninguém duplica número de regra.
 */
import {
  ESPACAMENTO_NORMAL_PADRAO_MIN,
  ESPACAMENTO_TRIAL_PADRAO_MIN,
  LIMITE_TRIALS_POR_DIA,
  MAX_TENTATIVAS_TRIAL,
} from "../../../lib/social/trial-guardrails-pure.ts";

/** Envelope de erro padrão das rotas /api/v1/* (lib/api/responses.ts). */
const REF_ERRO = { $ref: "#/components/schemas/ApiError" } as const;

function respostaErro(descricao: string) {
  return {
    description: descricao,
    content: { "application/json": { schema: REF_ERRO } },
  };
}

export function buildSpec(origin: string) {
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
        "`.mp3`, válido por 1h).\n\n" +
        "**Publicador social** (`/api/v1/social/*`): conecte uma conta em " +
        "Configurações → Redes sociais e publique Reels/imagens/stories via " +
        "`POST /social/publish`. A publicação é assíncrona: a resposta 201 traz " +
        "o `id`; acompanhe o `status` pelo `GET /social/publish` até " +
        "`published` ou `failed` (motivo em `error`).\n\n" +
        "**Erros:** todas as rotas `/api/v1/*` devolvem o envelope " +
        '`{"error":{"code","message","details?"}}`. Códigos: `bad_request` (400), ' +
        "`unauthorized` (401), `forbidden` (403), `not_found` (404), " +
        "`server_error` (500).",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
      },
      schemas: {
        ApiError: {
          type: "object",
          description:
            "Envelope de erro padrão de todas as rotas /api/v1/* " +
            "(lib/api/responses.ts).",
          properties: {
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  enum: ["bad_request", "unauthorized", "forbidden", "not_found", "server_error"],
                },
                message: { type: "string" },
                details: { description: "Opcional; presente só em alguns bad_request." },
              },
            },
          },
        },
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
        SocialAccount: {
          type: "object",
          description: "Conta social conectada. Tokens NUNCA são devolvidos (nem mascarados).",
          properties: {
            id: { type: "string", format: "uuid" },
            platform: { type: "string", enum: ["instagram", "tiktok"] },
            username: { type: "string", nullable: true },
            account_ref: {
              type: "string",
              description: "Id do usuário NA plataforma (IG user id / TikTok open_id).",
            },
            status: {
              type: "string",
              enum: ["active", "expired", "revoked"],
              description: "Só `active` publica; `expired` exige reconectar a conta.",
            },
            token_expires_at: { type: "string", format: "date-time", nullable: true },
            connected_at: { type: "string", format: "date-time" },
          },
        },
        PublishSource: {
          type: "object",
          description:
            "Mídia gerada NA plataforma ou upload prévio (alternativa ao media_url). " +
            "O servidor valida a posse e resolve a referência interna na hora de publicar.",
          required: ["kind"],
          properties: {
            kind: {
              type: "string",
              enum: ["image", "clone-padrao", "clone-heygen", "cenas", "edicao", "upload"],
              description:
                "`image`/`clone-padrao`/`clone-heygen`/`cenas` referenciam por `id`; " +
                "`edicao` e `upload` referenciam por `key`.",
            },
            id: {
              type: "string",
              description: "Obrigatório para kinds referenciados por id.",
            },
            key: {
              type: "string",
              description:
                "Obrigatório para `edicao` e `upload` (a `key` devolvida por /social/upload-url).",
            },
            media_type: {
              type: "string",
              enum: ["reel", "image", "story"],
              description: "Só para `upload`: tipo do arquivo enviado.",
            },
          },
        },
        PublishPlatformOptions: {
          type: "object",
          description:
            "Opções específicas da plataforma da CONTA escolhida. TikTok: compliance " +
            "do popup de publicação. Instagram: Trial Reel (trial_params na Graph v23.0).",
          properties: {
            privacy_level: {
              type: "string",
              default: "SELF_ONLY",
              description: "TikTok: nível de privacidade do post.",
            },
            disable_comment: { type: "boolean", description: "TikTok." },
            brand_content: { type: "boolean", description: "TikTok: conteúdo de marca." },
            brand_organic: { type: "boolean", description: "TikTok: publi orgânica." },
            is_trial: {
              type: "boolean",
              description:
                "Instagram: publica como Reel de teste (Trial Reel). Exige media_type " +
                "`reel` com UM vídeo .mp4. Sujeito aos guardrails anti-restrição " +
                "(ver descrição do POST /social/publish).",
            },
            graduation_strategy: {
              type: "string",
              enum: ["MANUAL", "SS_PERFORMANCE"],
              default: "MANUAL",
              description:
                "Instagram, só com is_trial: MANUAL (você decide quando o Reel vai " +
                "pro perfil) ou SS_PERFORMANCE (o Instagram promove sozinho se performar).",
            },
          },
        },
        PublishRequest: {
          type: "object",
          required: ["account_id"],
          description:
            "Exatamente UMA fonte de mídia: `source` (mídia da plataforma/upload) OU " +
            "`media_url` (URL https pública). Se `source` estiver presente, `media_url` é ignorado.",
          properties: {
            account_id: {
              type: "string",
              format: "uuid",
              description: "Conta conectada (GET /social/accounts) com status `active`.",
            },
            media_url: {
              type: "string",
              description: "URL https pública da mídia (obrigatória quando não há `source`).",
            },
            source: { $ref: "#/components/schemas/PublishSource" },
            caption: { type: "string", maxLength: 2200, nullable: true },
            media_type: {
              type: "string",
              enum: ["reel", "image", "story"],
              default: "reel",
              description: "Com `source`, o default vem do tipo da mídia resolvida.",
            },
            scheduled_at: {
              type: "string",
              format: "date-time",
              description:
                "Agendamento. Mais de 1 min no futuro → fica `ready` e o sweeper (cron) " +
                "publica na hora; ausente ou até 1 min no futuro → publica AGORA.",
            },
            platform_options: { $ref: "#/components/schemas/PublishPlatformOptions" },
          },
        },
        PublicationCreated: {
          type: "object",
          description: "Estado da publicação logo após a criação (POST /social/publish).",
          properties: {
            id: { type: "string", format: "uuid" },
            status: {
              type: "string",
              enum: ["ready", "processing", "published", "failed"],
              description:
                "Imediata: normalmente `processing` (container criado) ou `failed`/`ready` " +
                "com o motivo em `error`. Agendada: `ready`.",
            },
            scheduled_at: { type: "string", format: "date-time", nullable: true },
            error: { type: "string", nullable: true },
          },
        },
        Publication: {
          type: "object",
          description: "Item do histórico (GET /social/publish).",
          properties: {
            id: { type: "string", format: "uuid" },
            account_id: { type: "string", format: "uuid" },
            platform: { type: "string", enum: ["instagram", "tiktok"] },
            media_type: { type: "string", enum: ["reel", "image", "story"] },
            media_url: { type: "string" },
            caption: { type: "string", nullable: true },
            scheduled_at: { type: "string", format: "date-time", nullable: true },
            status: { type: "string", enum: ["ready", "processing", "published", "failed"] },
            platform_post_id: { type: "string", nullable: true },
            permalink: { type: "string", nullable: true },
            error: {
              type: "string",
              nullable: true,
              description: "Motivo legível quando `failed` ou quando um guardrail reagendou.",
            },
            created_at: { type: "string", format: "date-time" },
            thumb_url: {
              type: "string",
              nullable: true,
              description: "Miniatura (só imagem, presigned 1h); null pra vídeo/mídia já limpa.",
            },
          },
        },
        UploadUrlRequest: {
          type: "object",
          required: ["content_type"],
          properties: {
            filename: { type: "string", description: "Opcional; sanitizado no servidor." },
            content_type: {
              type: "string",
              enum: ["image/jpeg", "image/jpg", "image/png", "image/webp", "video/mp4"],
            },
          },
        },
        UploadUrlResponse: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Use em POST /social/publish como source {kind: \"upload\", key}.",
            },
            upload_url: {
              type: "string",
              description: "Presigned PUT no R2 (válido 1h). Envie o arquivo com o mesmo Content-Type.",
            },
            media_type: {
              type: "string",
              enum: ["reel", "image"],
              description: "Derivado do content_type: video/mp4 → reel; imagem → image.",
            },
          },
        },
        CaptionRequest: {
          type: "object",
          properties: {
            context: {
              type: "string",
              description:
                "Contexto do conteúdo (prompt da imagem / roteiro do vídeo). Todos os " +
                "campos são opcionais no contrato; sem contexto a legenda sai genérica.",
            },
            locale: { type: "string", description: "Idioma da legenda (ex.: pt, en, es)." },
            idea: { type: "string", description: "Ideia opcional da pessoa pra guiar a legenda." },
          },
        },
        CaptionResponse: {
          type: "object",
          properties: {
            caption: { type: "string", description: "Legenda com hashtags, no idioma pedido." },
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
      "/api/v1/social/accounts": {
        get: {
          summary: "Lista suas contas sociais conectadas",
          description:
            "Contas do dono da chave, SEM tokens (nem mascarados). `enabled: false` " +
            "significa que o publicador está desligado pro seu usuário — a lista vem " +
            "vazia mesmo que existam contas.",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      enabled: { type: "boolean" },
                      accounts: {
                        type: "array",
                        items: { $ref: "#/components/schemas/SocialAccount" },
                      },
                    },
                  },
                },
              },
            },
            "401": respostaErro("`unauthorized` — chave ausente ou inválida"),
          },
        },
        delete: {
          summary: "Desconecta uma conta social",
          description:
            "Apaga a conta e as publicações pendentes dela (cascade). Idempotente: " +
            "id inexistente ou de outro usuário também devolve `deleted: true` " +
            "(o filtro por dono simplesmente não apaga nada).",
          parameters: [
            {
              name: "id",
              in: "query",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Id da conta (GET /social/accounts).",
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { deleted: { type: "boolean" } } },
                },
              },
            },
            "400": respostaErro('`bad_request` — "id da conta é obrigatório"'),
            "401": respostaErro("`unauthorized` — chave ausente ou inválida"),
          },
        },
      },
      "/api/v1/social/publish": {
        post: {
          summary: "Cria uma publicação (imediata ou agendada)",
          description:
            "Sem `scheduled_at` → inicia AGORA (container na plataforma) e o sweeper " +
            "conclui o publish quando o processamento terminar. Com `scheduled_at` " +
            "futuro → fica `ready` e o sweeper dispara na hora.\n\n" +
            "**A publicação pode falhar DEPOIS do 201**: acompanhe pelo " +
            "`GET /social/publish` — `status: failed` traz o motivo em `error`; " +
            "guardrail transitório mantém `ready` e reagenda (`scheduled_at` = " +
            "quando libera), também com o motivo em `error`.\n\n" +
            "**Guardrails do Trial Reel (Instagram, `is_trial`)** — checados na " +
            "criação (erro 400 amigável) E no envio (a checagem que vale; agendado " +
            "só sai pelo sweeper):\n" +
            '- **dedupe** (permanente → `failed`): "Este vídeo já foi publicado como ' +
            'Reel de teste nesta conta. Escolha outro vídeo ou publique como Reel normal."\n' +
            "- **circuit_breaker** (24h após um trial falhar → reagenda): \"Reels de " +
            "teste desta conta estão pausados por 24h após uma falha (proteção contra " +
            "restrição do Instagram). Reels normais continuam publicando. Liberado em …\"\n" +
            `- **limite_diario** (${LIMITE_TRIALS_POR_DIA}/dia por conta, janela ` +
            `deslizante de 24h → reagenda): "Limite de ${LIMITE_TRIALS_POR_DIA} Reels ` +
            'de teste por dia nesta conta atingido. Próximo liberado em …"\n' +
            `- **espacamento** (${ESPACAMENTO_TRIAL_PADRAO_MIN / 60}h entre trials da ` +
            'mesma conta, configurável → reagenda): "Intervalo mínimo de … entre Reels ' +
            'de teste da mesma conta. Próximo liberado em …"\n' +
            "- **cota da Meta** (content_publishing_limit, hoje 100/24h → reagenda " +
            '~1h): "O Instagram informou que esta conta atingiu o limite de … ' +
            'publicações via API nas últimas 24h. Nova tentativa automática em ~1h."\n\n' +
            `Post normal (não-trial) tem só espaçamento (${ESPACAMENTO_NORMAL_PADRAO_MIN} ` +
            "min entre posts da conta, configurável) — bloqueio reagenda, nunca falha. " +
            `HTTP 429 da Meta → retry com backoff (15 min dobrando, teto 2h, máx ` +
            `${MAX_TENTATIVAS_TRIAL} tentativas); restrição de recurso NUNCA é retentada ` +
            "(→ `failed`, e abre o circuit breaker da conta).",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PublishRequest" } },
            },
          },
          responses: {
            "201": {
              description: "Publicação criada (o publish em si é assíncrono)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { publication: { $ref: "#/components/schemas/PublicationCreated" } },
                  },
                },
              },
            },
            "400": respostaErro(
              "`bad_request` — corpo JSON inválido; `account_id` ausente " +
                '("Escolha a conta do Instagram"); "source.kind não suportado" ou ' +
                "mídia do `source` não encontrada/não sua; \"media_url precisa ser " +
                'uma URL https pública"; "media_type deve ser reel, image ou story"; ' +
                'legenda acima de 2200 caracteres; "scheduled_at inválido"; ' +
                '"Conta da rede social não encontrada"; "A conexão com a rede social ' +
                'expirou. Reconecte a conta."; Trial Reel inválido (só reel, UM vídeo ' +
                ".mp4, estratégia MANUAL|SS_PERFORMANCE); ou guardrail do trial " +
                "bloqueando agora (mensagens na descrição acima).",
            ),
            "401": respostaErro("`unauthorized` — chave ausente ou inválida"),
            "403": respostaErro(
              "`forbidden` — publicador desligado pro seu usuário ou pra plataforma " +
                "da conta (hoje: TikTok fechado; Instagram aberto).",
            ),
            "500": respostaErro('`server_error` — "Não foi possível criar a publicação"'),
          },
        },
        get: {
          summary: "Histórico de publicações (polling)",
          description:
            "As 30 publicações mais recentes do dono da chave, mais nova primeiro. " +
            "Use pra acompanhar `status` até `published`/`failed`.",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      publications: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Publication" },
                      },
                    },
                  },
                },
              },
            },
            "401": respostaErro("`unauthorized` — chave ausente ou inválida"),
          },
        },
        delete: {
          summary: "Cancela uma publicação AGENDADA",
          description:
            "Só cancela `status: ready` com `scheduled_at` marcado (ainda não enviada). " +
            "Publicação imediata não cancela: o container na plataforma já foi criado.",
          parameters: [
            {
              name: "id",
              in: "query",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cancelada",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { canceled: { type: "string", format: "uuid" } },
                  },
                },
              },
            },
            "400": respostaErro(
              '`bad_request` — "id ausente" ou "Só publicações agendadas (ainda não ' +
                'enviadas) podem ser canceladas"',
            ),
            "401": respostaErro("`unauthorized` — chave ausente ou inválida"),
            "500": respostaErro('`server_error` — "Não foi possível cancelar a publicação"'),
          },
        },
      },
      "/api/v1/social/upload-url": {
        post: {
          summary: "Presigned PUT pra subir mídia do computador",
          description:
            "Devolve URL de upload direto no R2 (válida 1h). Fluxo: 1) POST aqui; " +
            "2) `PUT upload_url` com o arquivo (mesmo Content-Type); 3) publique com " +
            '`source: {kind: "upload", key}`. O arquivo é apagado 7 dias após ' +
            "publicar/falhar.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/UploadUrlRequest" } },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/UploadUrlResponse" } },
              },
            },
            "400": respostaErro(
              "`bad_request` — corpo JSON inválido ou \"Formato não suportado — use " +
                'JPG, PNG, WebP ou MP4"',
            ),
            "401": respostaErro("`unauthorized` — chave ausente ou inválida"),
            "403": respostaErro("`forbidden` — publicador desligado pro seu usuário"),
          },
        },
      },
      "/api/v1/social/caption": {
        post: {
          summary: "Gera legenda com hashtags pro post",
          description:
            "Recebe o contexto do conteúdo (prompt da imagem / roteiro do vídeo), o " +
            "idioma e a ideia opcional da pessoa, e devolve a legenda pronta. " +
            "Processamento síncrono (até ~30s).",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CaptionRequest" } },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/CaptionResponse" } },
              },
            },
            "400": respostaErro("`bad_request` — corpo JSON inválido"),
            "401": respostaErro("`unauthorized` — chave ausente ou inválida"),
            "403": respostaErro("`forbidden` — publicador desligado pro seu usuário"),
          },
        },
      },
    },
  };
}
