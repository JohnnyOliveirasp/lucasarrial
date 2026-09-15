// --teste (24/08): manda o job pro endpoint ISOLADO de teste (imagem da dev),
// nunca pra producao. Setado ANTES do dotenv (dotenv nao sobrescreve env ja
// definida). Ver memoria project-runpod-endpoint-teste-dev.
if (process.argv.includes("--teste")) {
  process.env.RUNPOD_ENDPOINT_TRAIN_ID = "vtfxcwcb0ohvdn";
  process.env.RUNPOD_ENDPOINT_INFERENCE_ID = "vtfxcwcb0ohvdn";
  console.log("⚠️  MODO TESTE: endpoint vtfxcwcb0ohvdn (fast_cloner_TESTE_dev)");
}
/**
 * 19/08 — gerar áudio POR CONTA DA CASA (sem cobrar o aluno).
 *
 * Nasceu do caso Katia (incidente 4396496b): o suporte prometeu por escrito
 * refazer o áudio dela sem cobrar, a aluna aceitou 2x — e ninguém gerou,
 * porque não existia caminho pra "gerar em nome do aluno" fora da rota da
 * API (que exige a sessão dele). Ficou palavra dada sem dono por 24h.
 *
 * Réplica do POST /api/v1/voices/[id]/generate (mesmo payload: cfg 1.6,
 * timesteps 15, lora_alpha da voz, prompt_text = reference_transcript da voz,
 * policy.executionTimeout pela régua de `generations/execucao.ts`), menos o
 * débito. O payload mora em `_conta_da_casa.cjs`, um lugar só.
 *
 * ⚠️ REGRA 7: só rode quando o aluno PEDIU **ou** quando é compensação por
 * erro nosso — e aí sem cobrar. Nunca gaste GPU do aluno por iniciativa própria.
 * ⚠️ REGRA 8 (efeito colateral conhecido): se o job FALHAR, o estorno
 * automático credita o valor mesmo sem ter havido débito — o aluno ganha
 * crédito que nunca pagou. Em compensação por erro nosso isso é aceito DE
 * PROPÓSITO. Registre no relatório.
 *
 * ───────────────────────── OS DOIS MODOS ─────────────────────────
 *
 * 1) REFAZER uma geração que existe (modo original):
 *      node refazer_audio_conta_da_casa.cjs <generationId> [--confirmar]
 *    Reaproveita o `text_normalized` JÁ GRAVADO na geração — o texto que de
 *    fato foi pra GPU. Refazer com ele reproduz a mesma entrada.
 *
 *    Com `--texto-arquivo`, REFORMATA esse mesmo texto (caso Katia, incidente
 *    47/ce6e157d: o defeito não é a voz nem o texto, é ONDE o chunker corta;
 *    quebrar em parágrafos põe cada frase no seu chunk sem mexer no worker).
 *    ⚠️ O conteúdo FALADO tem que ser o mesmo: o script confere e ABORTA se as
 *    palavras não baterem. Isso é REFORMATAR, não reescrever.
 *
 * 2) GERAR COM TEXTO NOVO (12/09, caso #369):
 *      node refazer_audio_conta_da_casa.cjs --voz <voiceId> \
 *           --texto-arquivo <arquivo.txt> [--confirmar]
 *
 *    O buraco que isto fecha: a promessa mais comum do suporte é "manda o
 *    texto que você quiser que eu gero por conta da casa" — e não havia
 *    caminho. Só dava pra repetir uma geração que já existia; a trava de
 *    palavras do modo 1 (que existe pra impedir reescrita acidental) abortava
 *    exatamente o pedido legítimo. O aluno contato@mastroiannioliveira.com.br
 *    ficou "no aguardo" de um texto novo com a voz dele. É o padrão do caso
 *    Katia de novo: palavra dada sem dono.
 *
 *    Aqui o texto passa pela MESMA normalização da rota de produção
 *    (`normalizeTextForTTS`, de `frontend/src/lib/llm/normalize.ts`, que a rota
 *    chama em route.ts:175) antes de ir pra GPU. Sem isso o teste da casa não
 *    representa o que o aluno recebe. A trava de palavras NÃO se aplica aqui:
 *    texto diferente é o pedido, não o acidente.
 *
 * Sem `--confirmar` os dois modos são ENSAIO: imprimem o plano e não disparam
 * nem gravam nada.
 */
const { supa, RAIZ } = require("./_comum.cjs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const { S3Client, GetObjectCommand, PutObjectCommand } = require(
  path.join(RAIZ, "frontend", "node_modules", "@aws-sdk/client-s3"),
);
const { getSignedUrl } = require(
  path.join(RAIZ, "frontend", "node_modules", "@aws-sdk/s3-request-presigner"),
);

const nucleo = require("./_conta_da_casa.cjs");

// ── produção, carregada de verdade (sem cópia) ─────────────────────────────
// Mesmo padrão de `garantia_na_fila.cjs`: o que a rota do aluno usa é o que
// este script usa. Reimplementar qualquer um destes três aqui seria assinar
// que eles vão sair do ar um do outro no primeiro ajuste da régua.
const createJiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"));
const jiti = (createJiti.default || createJiti)(path.join(RAIZ, "frontend", "noop.js"), {
  alias: { "@": path.join(RAIZ, "frontend", "src") },
  interopDefault: true,
});
const SRC = path.join(RAIZ, "frontend", "src");
const { normalizeTextForTTS } = jiti(path.join(SRC, "lib", "llm", "normalize.ts"));
const { inferenceExecutionTimeoutMs } = jiti(path.join(SRC, "lib", "generations", "execucao.ts"));
const { generationCreditCost } = jiti(path.join(SRC, "lib", "credits", "config.ts"));
for (const [nome, fn] of [
  ["normalizeTextForTTS", normalizeTextForTTS],
  ["inferenceExecutionTimeoutMs", inferenceExecutionTimeoutMs],
  ["generationCreditCost", generationCreditCost],
]) {
  if (typeof fn !== "function") {
    throw new Error(
      `produção não exporta ${nome}() — ferramenta abortada (não vou adivinhar a regra)`,
    );
  }
}

/* ────────────────────────────── argumentos ────────────────────────────── */

const USO = `uso:
  REFAZER geração existente:
    node refazer_audio_conta_da_casa.cjs <generationId> [--texto-arquivo <path>] [--nome "<rotulo>"] [--confirmar]
  GERAR com TEXTO NOVO (conta da casa):
    node refazer_audio_conta_da_casa.cjs --voz <voiceId> --texto-arquivo <path> [--nome "<rotulo>"] [--confirmar]
  --teste manda o job pro endpoint isolado da dev.`;

let ARGS;
try {
  ARGS = nucleo.interpretarArgumentos(process.argv.slice(2));
} catch (e) {
  console.error(`${e.message}\n\n${USO}`);
  process.exit(1);
}
const MODO = ARGS.modo;

/* ────────────────────────────── dependências ──────────────────────────── */

const PRESIGN_EXPIRES = 2 * 60 * 60;
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const getUrl = (bucket, key) =>
  getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: PRESIGN_EXPIRES,
  });
const putUrl = (bucket, key, type) =>
  getSignedUrl(r2, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type }), {
    expiresIn: PRESIGN_EXPIRES,
  });

(async () => {
  const db = supa();
  const conteudoArquivo = ARGS.textoArquivo
    ? require("node:fs").readFileSync(ARGS.textoArquivo, "utf8")
    : null;

  // `normalizeTextForTTS` falha GRACIOSAMENTE: sem chave de API ela devolve o
  // texto cru (só sanitizado) e não avisa ninguém. Em produção isso é a rede
  // de segurança certa; AQUI seria mentira silenciosa — a casa mandaria pra
  // GPU um texto que a rota do aluno teria normalizado, e o "teste da casa"
  // não representaria o que o aluno recebe. Então neste script é erro, não
  // fallback.
  if (MODO === "texto-novo" && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "sem OPENAI_API_KEY nem ANTHROPIC_API_KEY: a normalização seria PULADA em silêncio e o " +
        "áudio da casa não representaria o que o aluno recebe. Configure a chave em frontend/.env.local.",
    );
  }

  const plano = await nucleo.montarPlano(
    {
      modo: MODO,
      genId: ARGS.genId,
      vozId: ARGS.vozId,
      conteudoArquivo,
      rotulo: ARGS.rotulo,
    },
    {
      db,
      normalizar: normalizeTextForTTS,
      timeoutMs: inferenceExecutionTimeoutMs,
      custoEmCreditos: generationCreditCost,
    },
  );

  const { voz, perfil, origem } = plano;
  console.log("=".repeat(64));
  console.log(
    `MODO  : ${MODO === "texto-novo" ? "TEXTO NOVO (conta da casa)" : "REFAZER geração existente"}`,
  );
  console.log(`ALUNO : ${perfil.display_name} <${perfil.email}>`);
  console.log(`ACESSO: até ${perfil.access_until}`);
  console.log(`SALDO : ${(perfil.credits_subscription ?? 0) + (perfil.credits_extra ?? 0)}`);
  console.log(`VOZ   : ${voz.id} [${voz.status}] lang=${voz.language} alpha=${voz.lora_alpha ?? 16}`);
  if (origem) {
    console.log(`ORIGEM: ${origem.id} (${origem.status}, ${origem.created_at})`);
    if (ARGS.textoArquivo) {
      console.log(
        `TEXTO : REFORMATADO de ${ARGS.textoArquivo} ` +
          `(mesmas ${nucleo.palavras(plano.textoParaGpu).length} palavras, conferido)`,
      );
    }
  } else {
    console.log(`ORIGEM: — (texto NOVO, de ${ARGS.textoArquivo})`);
  }
  console.log(`CUSTO : ${plano.custoQueNaoSeraCobrado} cr — NÃO SERÁ COBRADO (conta da casa)`);
  console.log(`TIMEOUT: ${plano.timeoutMs / 60000} min`);

  if (plano.normalizado) {
    console.log("-".repeat(64));
    console.log(`CRU (${plano.textoRaw.length} chars) — o que o aluno mandou:`);
    console.log(plano.textoRaw);
    console.log("-".repeat(64));
    console.log(
      `NORMALIZADO (${plano.textoParaGpu.length} chars) — o que VAI PRA GPU` +
        `${plano.textoParaGpu === plano.textoRaw ? " (saiu idêntico ao cru)" : ""}:`,
    );
  } else {
    console.log("-".repeat(64));
    console.log(`TEXTO (${plano.textoParaGpu.length} chars) — o que VAI PRA GPU:`);
  }
  console.log(plano.textoParaGpu);
  console.log("=".repeat(64));

  if (!ARGS.confirmar) {
    console.log("\n(SIMULAÇÃO — nada foi disparado. rode com --confirmar pra executar)");
    return;
  }

  const feito = await nucleo.dispararPlano(plano, {
    db,
    fetch: globalThis.fetch,
    getUrl,
    putUrl,
    uuid: randomUUID,
    agora: () => new Date().toISOString(),
    env: process.env,
    buckets: {
      vozes: process.env.R2_BUCKET_VOICES,
      geracoes: process.env.R2_BUCKET_GENERATIONS,
    },
  });

  console.log(`✅ disparado: job ${feito.jobId} (${feito.jobStatus})`);
  console.log(`✅ generation ${feito.novoId} criada para ${feito.email}`);
  console.log(`✅ SEM débito — por conta da casa`);
  console.log(
    `\n⚠️  REGRA 8: se este job FALHAR, o estorno automático vai CREDITAR ` +
      `${plano.custoQueNaoSeraCobrado} cr a ${feito.email} sem ter havido débito. ` +
      `É conhecido e aceito em compensação por erro nosso; registre no chamado.`,
  );
  console.log(`\nacompanhe: node _frank/ferramentas/aluno.cjs ${feito.email}`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
