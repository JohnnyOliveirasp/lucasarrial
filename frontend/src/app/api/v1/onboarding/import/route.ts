/**
 * POST /api/v1/onboarding/import
 *
 * Webhook do onboarding via planilha (Apps Script → aqui). Recebe uma linha
 * "Recebido" da planilha DFY e faz o serviço completo:
 *   1. Cria a conta do aluno (email+senha da planilha, e-mail já confirmado).
 *      Conta nasce ZERO créditos e travada — estado padrão de não-assinante.
 *   2. Resgata compras órfãs da Hotmart pelo e-mail (claimPurchasesOnLogin —
 *      quem pagou ANTES da conta existir tem o crédito preso até o 1º login;
 *      sem isso, as cobranças abaixo achariam saldo zero num aluno pagante).
 *   3. Importa as fotos do Drive como REFERÊNCIA (close frontal vira a
 *      principal via visão; nada vai pro histórico — só geradas ficam lá).
 *   4. GERA 2-3 avatares do aluno com as fotos (COBRADO: 525 cr/avatar 1K).
 *   5. Importa os áudios do Drive e DISPARA O TREINO da voz (COBRADO:
 *      10.000 cr — correção Johnny 17/08; antes era por conta da casa).
 *   (Correção Johnny 13/08, caso Vinicius — antes: foto no histórico +
 *   referência aleatória + voz parada esperando o aluno pagar.)
 *
 * ⚠️ SALDO (decisão Johnny 21/08): aqui — e SÓ aqui — a cobrança NÃO tem
 * trava. Treino e avatares rodam mesmo com o aluno a zero e ele fica negativo
 * até assinar (`debitCreditsOnboarding`, migration 88). Era a trava que
 * deixava a fila presa: linha após linha em "Erro" com "sem créditos".
 *
 * A RÉGUA DE AVISOS (Johnny 21/08, lib/onboarding/avisos.ts): o aluno recebe
 * "começamos" → "processando imagens" → "processando áudio" → final. Erro que
 * DEPENDE dele (link sem acesso, áudio curto) → ele é avisado do que fazer;
 * erro NOSSO → não. Todo erro vai pro grupo com LINHA + E-MAIL. Imagem e áudio
 * são independentes: a falha de um não impede o outro de tentar.
 *
 * Segurança: header X-Onboarding-Secret contra ONBOARDING_WEBHOOK_SECRET,
 * comparação em tempo constante (mesmo padrão do webhook Hotmart).
 *
 * Idempotente de ponta a ponta: reprocessar a mesma linha não duplica conta,
 * foto nem áudio (chaves R2 determinísticas por fileId do Drive).
 *
 * Payload (Apps Script):
 *   { email, password, name?, whatsapp?, images?: string[], audios?: string[], row? }
 *   images/audios = fileIds do Drive já tornados "qualquer um com link – leitor".
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { importImages, importTrainingAudios } from "@/lib/onboarding/import";
import { gerarAvatares } from "@/lib/onboarding/avatares";
import {
  avisoComecamos,
  avisoPrecisamosDeVoce,
  avisoProcessandoAudio,
  avisoProcessandoImagens,
  dependeDoAluno,
  escalarNoGrupo,
} from "@/lib/onboarding/avisos";
import { abrirLink } from "@/lib/onboarding/links";
import { registrarArquivoLocal } from "@/lib/onboarding/drive";
import { claimPurchasesOnLogin } from "@/lib/payments/claim";
import { registrarRun, arquivosDoResultado } from "@/lib/onboarding/registrar-run";
import { faxinaOrfaos } from "@/lib/onboarding/tmp";

export const maxDuration = 600;
/** Teto por link externo (zip de fotos + áudios). */
const MAX_LINK_BYTES = 2 * 1024 * 1024 * 1024; // vídeo de 600MB+ + áudios de treino (502 do caso A125)

type Body = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  whatsapp?: unknown;
  images?: unknown;
  audios?: unknown;
  /**
   * Link CRU das colunas J/K (22/08). Quando NÃO é Drive, o Apps Script não
   * consegue listar fileIds — manda o link e o servidor abre (WeTransfer,
   * Dropbox, OneDrive, zip…). lib/onboarding/links.ts.
   */
  images_link?: unknown;
  audios_link?: unknown;
  /** O que o Apps Script não conseguiu coletar ("imagens (J): não é um link (…)"). */
  link_problems?: unknown;
  row?: unknown;
  /** Correção de conta importada no modelo antigo: re-escolhe a referência. */
  force_reference?: unknown;
};

function validSecret(header: string | null): boolean {
  const expected = process.env.ONBOARDING_WEBHOOK_SECRET;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Aceita array de fileIds (strings) e ignora lixo. */
function asFileIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => /^[a-zA-Z0-9_-]{10,}$/.test(x));
}

/**
 * Garante o usuário no Auth. Retorna { userId, created }.
 * Conta já existente (profile OU auth órfão) → reusa, não mexe na senha.
 */
async function ensureUser(
  admin: ReturnType<typeof getAdmin>,
  email: string,
  password: string,
  name: string | null,
  whatsapp: string | null,
): Promise<{ userId: string; created: boolean }> {
  const { data: prof } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (prof?.id) return { userId: prof.id as string, created: false };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...(name ? { full_name: name } : {}),
      ...(whatsapp ? { whatsapp } : {}),
      onboarding_source: "planilha",
    },
  });
  if (!error && data.user) return { userId: data.user.id, created: true };

  // Auth já tem o e-mail mas o profile sumiu/nunca existiu → acha pelo scan
  // (mesmo recurso do /api/v1/generations pra listar usuários).
  const msg = (error?.message ?? "").toLowerCase();
  if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
    for (let page = 1; page <= 5; page++) {
      const { data: batch } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const hit = batch?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
      if (hit) return { userId: hit.id, created: false };
      if (!batch || batch.users.length < 1000) break;
    }
  }
  throw new Error(`createUser falhou: ${error?.message ?? "sem detalhe"}`);
}

export async function POST(request: NextRequest) {
  if (!validSecret(request.headers.get("x-onboarding-secret"))) return unauthorized();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return badRequest("JSON inválido");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() || null : null;
  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() || null : null;
  const images = asFileIds(body.images);
  const audios = asFileIds(body.audios);
  const imagesLink = typeof body.images_link === "string" ? body.images_link.trim() : "";
  const audiosLink = typeof body.audios_link === "string" ? body.audios_link.trim() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("E-mail inválido");
  if (password.length < 6) return badRequest("Senha precisa de 6+ caracteres");

  // 22/08: o `finally` que apaga o diretório de download NÃO roda quando o
  // processo morre no meio — e o deploy (pm2 restart) faz exatamente isso. Seis
  // pastas órfãs somando ~3GB deixaram o /tmp do Hetzner em 100%, e a linha 359
  // morreu com ENOSPC. Nesse estado nada que precise de /tmp funciona, nem o
  // onboarding nem o resto. Faxina antes de começar; só mexe no que tem nosso
  // prefixo e mais de 30min (nenhum import passa dos 6min do Apps Script).
  await faxinaOrfaos().catch(() => 0);

  const admin = getAdmin();

  let userId: string;
  let created: boolean;
  try {
    ({ userId, created } = await ensureUser(admin, email, password, name, whatsapp));
  } catch (e) {
    console.error("[onboarding/import] conta:", e instanceof Error ? e.message : e);
    return serverError(e instanceof Error ? e.message : "Falha ao criar a conta");
  }

  // O trigger handle_new_user cria o profile no signup, mas não recria se
  // faltar (mesma blindagem do auth/callback). Best-effort.
  await admin
    .from("profiles")
    .upsert(
      { id: userId, email, display_name: name },
      { onConflict: "id", ignoreDuplicates: true },
    );

  // Compra Hotmart feita ANTES da conta existir fica órfã até o 1º login —
  // resgata AGORA, senão treino e avatares (cobrados) veriam saldo zero num
  // aluno que pagou. Idempotente e best-effort (nunca lança).
  await claimPurchasesOnLogin(userId, email);

  const row = typeof body.row === "number" ? body.row : null;

  // ── Régua de avisos: "começamos" — só na 1ª passagem desta linha. Numa
  // reprocessagem (linha que estava em Erro) o aluno já recebeu este e-mail;
  // mandar de novo é ruído. A marca é a conta ter sido criada AGORA.
  if (created) await avisoComecamos(email, name);

  // Erro que depende do aluno → ele é avisado do que fazer. Erro nosso → não.
  // Nos dois casos o grupo recebe linha + e-mail (lib/onboarding/avisos.ts).
  // 22/08: `tratarErro` avisava o aluno e o grupo mas NÃO contava como falha —
  // o `ok` da resposta era calculado só pelas listas `failed`, que ficam vazias
  // quando nada chegou a ser tentado. Resultado: linha com ZERO foto e ZERO
  // áudio voltava `ok: true`, virava "Em Andamento" e ficava parada pra
  // sempre, porque não existe voz nem avatar pra ficar pronto — e o aluno tinha
  // recebido "deu tudo certo". Casos reais: linha 504 (WeTransfer we.tl),
  // 525 (Drive) e 526 (Google Photos, que a gente nem suporta).
  const falhas: string[] = [];

  const tratarErro = async (etapa: "imagens" | "áudio", motivo: string, oQueFazer: string) => {
    falhas.push(`${etapa}: ${motivo}`);
    const doAluno = dependeDoAluno(motivo);
    if (doAluno) {
      await avisoPrecisamosDeVoce(
        email,
        etapa === "imagens" ? "Precisamos de você: suas imagens" : "Precisamos de você: seu áudio",
        etapa === "imagens"
          ? `Não conseguimos pegar as suas imagens. Motivo: ${motivo}.`
          : `Não conseguimos usar o seu áudio. Motivo: ${motivo}.`,
        oQueFazer,
      );
    }
    await escalarNoGrupo({ linha: row, email, etapa, motivo, dependeDoAluno: doAluno });
  };

  // ── Link que NÃO é Drive (22/08): o servidor abre. Os arquivos baixados
  // entram no registro local e ganham um id determinístico (hash do link +
  // nome), então os importadores abaixo rodam SEM saber de onde veio e a
  // idempotência por id continua valendo. Sem fileIds E sem link = nada a
  // fazer naquela etapa (linha sem imagens/áudio é válida).
  const workDir = await mkdtemp(join(tmpdir(), "onb-links-"));
  const abrir = async (link: string, etapa: "imagens" | "áudio", lista: string[]) => {
    if (!link || lista.length > 0) return;
    const r = await abrirLink(link, join(workDir, etapa === "imagens" ? "img" : "aud"), MAX_LINK_BYTES);
    if (!r.ok) {
      if (r.kind === "drive") return; // Drive sem fileIds = o Apps Script já falhou antes
      await tratarErro(
        etapa,
        `${r.motivo} (${r.kind})`,
        r.kind === "nao_suportado"
          ? "Envie o material por Google Drive, WeTransfer ou Dropbox, com o link aberto para \"qualquer pessoa com o link\"."
          : "Gere um link novo (o anterior expirou ou está inacessível) e cole na planilha.",
      );
      return;
    }
    const base = createHash("sha1").update(link).digest("hex").slice(0, 12);
    for (const a of r.arquivos) {
      const id = `lk_${base}_${a.filename.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
      registrarArquivoLocal(id, a.path, a.filename);
      lista.push(id);
    }
    console.log(`[onboarding/import] ${etapa}: ${r.arquivos.length} arquivo(s) via ${r.kind}`);
  };
  await abrir(imagesLink, "imagens", images);
  await abrir(audiosLink, "áudio", audios);

  // O Apps Script já sabe o que não deu pra coletar (coluna sem link, Drive
  // inacessível). Passa pela MESMA régua: depende do aluno → ele é avisado;
  // sempre → grupo com linha + e-mail. Não derruba a outra coluna.
  const linkProblems = Array.isArray(body.link_problems)
    ? body.link_problems.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
  for (const prob of linkProblems) {
    const etapa = /^imagens/i.test(prob) ? "imagens" : "áudio";
    await tratarErro(
      etapa,
      prob,
      etapa === "imagens"
        ? "Cole na planilha o LINK da pasta ou do arquivo das fotos (Google Drive, WeTransfer ou Dropbox), aberto para \"qualquer pessoa com o link\"."
        : "Cole na planilha o LINK do áudio (Google Drive, WeTransfer ou Dropbox), aberto para \"qualquer pessoa com o link\".",
    );
  }

  const forceReference = body.force_reference === true;
  if (images.length > 0) await avisoProcessandoImagens(email);
  const imagesResult = await importImages(admin, userId, images, { forceReference }).catch((e) => {
    console.error("[onboarding/import] imagens:", e instanceof Error ? e.message : e);
    return {
      imported: 0,
      skipped: 0,
      failed: images.map((id) => ({ id, error: "falha geral" })),
      ignored: [] as Array<{ id: string; reason: string }>,
      reference_key: null,
      all_keys: [] as string[],
    };
  });

  // Regra do Johnny: basta PELO MENOS 1 imagem. Nenhuma aproveitável = erro da
  // etapa (e o áudio segue mesmo assim — são independentes).
  if (images.length > 0 && imagesResult.all_keys.length === 0) {
    const motivo =
      imagesResult.failed[0]?.error ??
      imagesResult.ignored?.[0]?.reason ??
      "nenhuma imagem aproveitável no link";
    await tratarErro(
      "imagens",
      motivo,
      "Confira se o link das fotos está aberto para \"qualquer pessoa com o link\" e se há pelo menos uma foto sua (pode ser um vídeo curto também).",
    );
  } else if (imagesResult.failed.length > 0) {
    // Parcial: algumas subiram, outras não. Não é bloqueio, mas o grupo sabe.
    await escalarNoGrupo({
      linha: row, email, etapa: "imagens",
      motivo: `${imagesResult.failed.length} de ${images.length} falharam: ${imagesResult.failed[0]?.error ?? "?"}`,
      dependeDoAluno: false,
    });
  }

  // 2-3 avatares gerados com as fotos (cobrado do aluno; idempotente). Falha aqui
  // NÃO derruba o import — fica registrada na resposta pra nota da planilha.
  const avatarsResult = await gerarAvatares(admin, userId, imagesResult.all_keys).catch((e) => {
    console.error("[onboarding/import] avatares:", e instanceof Error ? e.message : e);
    return { created: 0, skipped: 0, failed: [{ nome: "todos", error: "falha geral" }] };
  });

  // ── Áudio: SEMPRE tenta, mesmo que a imagem tenha falhado (Johnny 21/08).
  if (audios.length > 0) await avisoProcessandoAudio(email);
  let audiosResult;
  try {
    audiosResult = await importTrainingAudios(admin, userId, audios);
  } catch (e) {
    console.error("[onboarding/import] áudios:", e instanceof Error ? e.message : e);
    audiosResult = {
      imported: 0,
      skipped: 0,
      failed: audios.map((id) => ({ id, error: "falha geral" })),
      voice_id: null,
      voice_status: null,
      training: null,
    };
  }

  // Erro de áudio: nenhum arquivo baixou, ou a soma ficou abaixo de 20min.
  // Os dois dependem do aluno (link fechado / gravar mais) → ele é avisado.
  const audioCurto = audiosResult.voice_status === "rejected_too_short";
  if (audios.length > 0 && (audiosResult.imported + audiosResult.skipped === 0 || audioCurto)) {
    const motivo = audioCurto
      ? `o áudio enviado soma menos de 20 minutos (${audiosResult.training ?? "mínimo não atingido"})`
      : (audiosResult.failed[0]?.error ?? "nenhum áudio aproveitável no link");
    // Arquivo gigante tem orientação PRÓPRIA: mandar "abra o link" pra quem
    // subiu 8,9GB não ajuda em nada — o link está aberto, o arquivo é que não
    // cabe. Casos reais 22/08: linha 529 (8.944MB) e 531 (3.932MB).
    const grande = /teto|passou de \d+|tem \d+ ?MB/i.test(motivo);
    await tratarErro(
      "áudio",
      motivo,
      audioCurto
        ? "Grave mais alguns minutos falando naturalmente (pode ser em vários arquivos) até somar pelo menos 20 minutos, e coloque na mesma pasta."
        : grande
          ? "O arquivo que você enviou é grande demais para o nosso limite. Se for um vídeo, envie só o áudio (MP3 ou M4A); se for áudio, pode dividir em partes menores na mesma pasta. Precisamos de 20 minutos de fala — não de qualidade de estúdio."
          : "Confira se o link do áudio está aberto para \"qualquer pessoa com o link\" e se os arquivos estão mesmo na pasta.",
    );
  } else if (audiosResult.failed.length > 0) {
    await escalarNoGrupo({
      linha: row, email, etapa: "áudio",
      motivo: `${audiosResult.failed.length} de ${audios.length} falharam: ${audiosResult.failed[0]?.error ?? "?"}`,
      dependeDoAluno: false,
    });
  }

  // "ok" = nada falhou → Apps Script marca Processando (vira Realizado quando
  // voz + avatares terminam); qualquer falha → Erro na planilha com o detalhe
  // (a idempotência deixa re-tentar de graça, e o que deu certo fica).
  // Entrou ALGUMA coisa? Linha que não rendeu nem uma foto nem um áudio nunca
  // é sucesso — mesmo que nada tenha "falhado" formalmente. É o que separa
  // "o aluno não tinha material" (a linha fica esperando, correto) de "o
  // servidor não conseguiu abrir o que ele mandou" (erro, precisa de gente).
  const entrouAlgo =
    imagesResult.all_keys.length > 0 ||
    audiosResult.imported + audiosResult.skipped > 0;
  const tinhaLinkOuArquivo =
    images.length > 0 || audios.length > 0 || !!imagesLink || !!audiosLink;

  const ok =
    imagesResult.failed.length === 0 &&
    audiosResult.failed.length === 0 &&
    !audioCurto &&
    falhas.length === 0 &&
    (entrouAlgo || !tinhaLinkOuArquivo);

  // 22/08 (Johnny): "não é ler a nota, é entender o porquê no SISTEMA".
  // Cada tentativa fica em onboarding_runs — motivo inteiro, sem o corte de
  // ~300 caracteres da nota da célula. É o que permite responder "por que a
  // linha 529 falhou" com uma consulta em vez de garimpo no Drive.
  const etapaFalha: "imagens" | "audio" | null = !ok
    ? (imagesResult.all_keys.length === 0 && images.length > 0 ? "imagens" : "audio")
    : null;

  // 22/08: o motivo PRECISA sair daqui pronto. O Apps Script monta a nota com
  // `body.error.message || falhas(images) || falhas(audios) || "HTTP " + code`,
  // e `falhas()` só olha a lista `failed`. Áudio curto tem `failed` VAZIO — o
  // arquivo baixou bem, só é curto — então caía no fallback e a planilha
  // recebia a nota inútil **"HTTP 200"**. Linhas 348, 352 e 353 ficaram assim,
  // sendo que o motivo real era "áudio com menos de 20 minutos".
  const motivoGeral =
    imagesResult.failed[0]?.error ??
    imagesResult.ignored?.[0]?.reason ??
    audiosResult.failed[0]?.error ??
    (audioCurto
      ? `o áudio enviado soma menos de 20 minutos (${audiosResult.training ?? "mínimo não atingido"})`
      : null) ??
    falhas[0] ??
    (tinhaLinkOuArquivo && !entrouAlgo
      ? "o link foi aberto mas não veio nenhuma foto nem áudio aproveitável"
      : null);

  await registrarRun(admin, {
    linha: row,
    email,
    userId,
    contaCriada: created,
    ok,
    etapaFalha,
    motivo:
      imagesResult.failed[0]?.error ??
      imagesResult.ignored?.[0]?.reason ??
      audiosResult.failed[0]?.error ??
      (audioCurto ? "áudio soma menos de 20 minutos" : null),
    erroDetalhe: JSON.stringify({
      imagens: { failed: imagesResult.failed, ignored: imagesResult.ignored ?? [] },
      audios: { failed: audiosResult.failed, training: audiosResult.training },
      avatares: avatarsResult.failed ?? [],
    }),
    imagensPedidas: images.length,
    audiosPedidos: audios.length,
    imagesLink: imagesLink || null,
    audiosLink: audiosLink || null,
    arquivos: [
      ...arquivosDoResultado(imagesResult, images),
      ...arquivosDoResultado(audiosResult, audios),
    ],
    resultado: { images: imagesResult, avatars: avatarsResult, audios: audiosResult },
  });

  return jsonOk({
    ok,
    // `error.message` é o PRIMEIRO campo que o Apps Script consulta pra montar
    // a nota — mandando o motivo aqui, a planilha nunca mais escreve "HTTP 200".
    ...(ok || !motivoGeral ? {} : { error: { message: motivoGeral } }),
    user: { id: userId, created },
    images: imagesResult,
    avatars: avatarsResult,
    audios: audiosResult,
    row,
  });
}
