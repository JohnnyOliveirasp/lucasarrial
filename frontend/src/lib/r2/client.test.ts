/**
 * Testes do `imagesBucket()` — incidente 147/148 (27/08).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/r2/client.test.ts
 *
 * O DEFEITO COBERTO: `imagesBucket()` devolvia "" quando nem `R2_BUCKET_IMAGES`
 * nem `R2_BUCKET_VOICES` estavam no ambiente. Esse "" ia parar no
 * `PutObjectCommand` e o SDK da AWS estourava com
 *   "No value provided for input HTTP label: Bucket."
 * — mensagem que não fala em configuração. Em `lib/studio/scenes.ts` o erro era
 * lido como "a geração falhou" e a cena do aluno era marcada `failed` +
 * estornada, mesmo com o vídeo PRONTO no Kie: 8 cenas de 3 alunos destruídas em
 * 71 segundos, uma delas com o arquivo esperando havia 14 dias.
 *
 * `R2_BUCKETS` é lido no CARREGAMENTO do módulo, então cada caso precisa de uma
 * instância nova — daí o import dinâmico com query de cache-busting.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

let seq = 0;
/**
 * Roda `usar` com o ambiente montado E com um client.ts carregado do zero.
 *
 * ⚠️ As duas variáveis são lidas em MOMENTOS DIFERENTES, e é fácil escrever um
 * teste que passa por engano: `R2_BUCKET_VOICES` entra em `R2_BUCKETS` no
 * CARREGAMENTO do módulo, enquanto `R2_BUCKET_IMAGES` é lido a cada CHAMADA de
 * `imagesBucket()`. Por isso o ambiente só é restaurado DEPOIS de `usar` rodar
 * — restaurar antes fazia o primeiro caso deste arquivo ler o fallback e
 * reprovar sozinho.
 */
async function comEnv<T>(
  env: Record<string, string | undefined>,
  usar: (m: typeof import("./client.ts")) => T,
): Promise<T> {
  const antes = {
    R2_BUCKET_IMAGES: process.env.R2_BUCKET_IMAGES,
    R2_BUCKET_VOICES: process.env.R2_BUCKET_VOICES,
  };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    const m = (await import(`./client.ts?caso=${seq++}`)) as typeof import("./client.ts");
    return usar(m);
  } finally {
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("usa R2_BUCKET_IMAGES quando ele existe", async () => {
  await comEnv({ R2_BUCKET_IMAGES: "bucket-imagens", R2_BUCKET_VOICES: "bucket-vozes" }, (m) =>
    assert.equal(m.imagesBucket(), "bucket-imagens"),
  );
});

test("cai no bucket de vozes quando R2_BUCKET_IMAGES não existe (é o caso da PRODUÇÃO)", async () => {
  await comEnv({ R2_BUCKET_IMAGES: undefined, R2_BUCKET_VOICES: "voices-clone-ai-verse" }, (m) =>
    assert.equal(m.imagesBucket(), "voices-clone-ai-verse"),
  );
});

test("SEM nenhum dos dois: LANÇA em vez de devolver string vazia", async () => {
  await comEnv({ R2_BUCKET_IMAGES: undefined, R2_BUCKET_VOICES: undefined }, (m) =>
    assert.throws(() => m.imagesBucket(), /R2 mal configurado/),
  );
});

test("string vazia é tratada como ausente, não como bucket válido", async () => {
  await comEnv({ R2_BUCKET_IMAGES: "", R2_BUCKET_VOICES: "" }, (m) =>
    assert.throws(() => m.imagesBucket(), /R2 mal configurado/),
  );
});

test("o que ele NUNCA pode fazer: devolver falsy e deixar o SDK estourar lá na frente", async () => {
  // Este é o teste que representa o incidente. Se um dia alguém "consertar" o
  // throw devolvendo "" de novo, é aqui que a regressão aparece.
  await comEnv({ R2_BUCKET_IMAGES: undefined, R2_BUCKET_VOICES: undefined }, (m) => {
    let devolveu: unknown = "NAO_CHAMOU";
    try {
      devolveu = m.imagesBucket();
    } catch {
      devolveu = "LANCOU";
    }
    assert.equal(devolveu, "LANCOU", "imagesBucket() devolveu valor vazio em vez de lançar");
  });
});
