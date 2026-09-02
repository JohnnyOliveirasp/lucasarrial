/**
 * Prova da corrida do SGP (#238) — o teste que FALHA antes do conserto.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/lib/sgp/anexar.test.ts
 *
 * DUAS PARTES, e elas provam coisas diferentes:
 *
 *  (A) CORRIDA DE VERDADE, contra o Postgres. Precisa de NEXT_PUBLIC_SUPABASE_URL
 *      + SUPABASE_SERVICE_ROLE_KEY (lidos de .env.local). Sem credencial o teste
 *      se PULA com aviso — nunca passa em silêncio fingindo que provou algo.
 *      O caso (A1) roda o algoritmo ANTIGO (ler em JS → esperar → gravar por
 *      cima) e exige que ele PERCA fotos: é o controle que mostra que a bancada
 *      reproduz mesmo a corrida. Se um dia (A1) parar de perder, o teste falha
 *      e avisa que a bancada deixou de medir o que dizia medir.
 *
 *  (B) TRIPWIRE DE FONTE, roda sempre, sem banco. Os routes não podem voltar a
 *      montar o array em JS e gravar com atualizarSessao(). O alias "@/" não
 *      resolve em `node --test`, então aqui se lê o fonte — mesmo padrão do
 *      finalize-training.test.ts.
 *
 * O teste cria uma linha DESCARTÁVEL em sgp_pedidos (sessão aleatória, sem
 * user_id) e apaga no fim. Não toca em pedido de aluno, crédito, GPU nem R2.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------- (B) fonte

const AQUI = import.meta.dirname;
const ROUTES = join(AQUI, "..", "..", "app", "api", "v1", "sgp");

test("(B1) o route da foto não monta mais o array em JS", () => {
  const fonte = readFileSync(join(ROUTES, "foto", "route.ts"), "utf8");
  assert.match(fonte, /anexarFoto\(/, "o POST tem que usar o passo atômico");
  assert.match(fonte, /removerFoto\(/, "o DELETE tem que usar o passo atômico");
  assert.doesNotMatch(
    fonte,
    /atualizarSessao\([^)]*fotos/,
    "voltou o append cego em JS — é exatamente o bug do #238",
  );
});

test("(B2) o route do áudio não monta mais o array em JS", () => {
  const fonte = readFileSync(join(ROUTES, "audio", "route.ts"), "utf8");
  assert.match(fonte, /anexarAudio\(/);
  assert.match(fonte, /removerAudio\(/);
  assert.doesNotMatch(fonte, /atualizarSessao\([^)]*audios/);
});

test("(B3) recusa do passo atômico vira mensagem, nunca descarte silencioso", () => {
  const fonte = readFileSync(join(AQUI, "anexar.ts"), "utf8");
  // Todo motivo de recusa precisa de texto pro aluno; um `default:` mudo aqui
  // deixaria a foto sumir de novo, só que por outro caminho.
  for (const motivo of ["repetida", "max", "sem_pedido", "sem_key"]) {
    assert.match(fonte, new RegExp(`case "${motivo}"`), `sem mensagem pra "${motivo}"`);
  }
});

// ------------------------------------------------------------- (A) corrida

const N = 8; // fotos escolhidas juntas, como o aluno faz
const GAP_MS = 400; // o tempo da visão/ffmpeg: é ele que abre a janela da corrida

function credenciais(): { url: string; key: string } | null {
  try {
    const env = readFileSync(join(AQUI, "..", "..", "..", ".env.local"), "utf8");
    const pega = (nome: string) =>
      env.match(new RegExp(`^${nome}=(.*)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
    const url = pega("NEXT_PUBLIC_SUPABASE_URL");
    const key = pega("SUPABASE_SERVICE_ROLE_KEY");
    return url && key ? { url, key } : null;
  } catch {
    return null;
  }
}

const cred = credenciais();
const semBanco = { skip: cred ? false : "sem .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)" };

const db: SupabaseClient | null = cred
  ? createClient(cred.url, cred.key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Uma foto de mentira, com impressão digital única por índice. */
function fotoFalsa(i: number, sha = `sha-${i}`, dhash = hex16(i)) {
  return { key: `sgp/teste/fotos/${i}.jpg`, status: "aprovada", sha256: sha, dhash };
}

/** dHash de 16 chars bem distantes entre si (nada de falso "repetida"). */
function hex16(i: number): string {
  const a = (i % 16).toString(16);
  return a.repeat(16);
}

async function novoPedido(): Promise<string> {
  const sessao = randomUUID();
  const { error } = await db!
    .from("sgp_pedidos")
    .insert({ sessao, status: "foto", fotos: [], audios: [] } as never);
  if (error) throw new Error(`não consegui criar o pedido de teste: ${error.message}`);
  return sessao;
}

async function apagar(sessao: string) {
  await db!.from("sgp_pedidos").delete().eq("sessao", sessao);
}

async function lerFotos(sessao: string): Promise<unknown[]> {
  const { data } = await db!.from("sgp_pedidos").select("fotos").eq("sessao", sessao).single();
  return ((data as { fotos?: unknown[] } | null)?.fotos ?? []) as unknown[];
}

test("(A1) CONTROLE: o algoritmo ANTIGO perde fotos em upload paralelo", semBanco, async (t) => {
  const sessao = await novoPedido();
  t.after(() => apagar(sessao));

  // Exatamente o que o route fazia: lê o array, espera a visão, grava por cima.
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const { data } = await db!.from("sgp_pedidos").select("fotos").eq("sessao", sessao).single();
      const atuais = ((data as { fotos?: unknown[] } | null)?.fotos ?? []) as unknown[];
      await espera(GAP_MS);
      await db!
        .from("sgp_pedidos")
        .update({ fotos: [...atuais, fotoFalsa(i)] } as never)
        .eq("sessao", sessao);
    }),
  );

  const fotos = await lerFotos(sessao);
  console.log(`   (A1) antigo: mandei ${N} fotos, sobraram ${fotos.length} no banco`);
  assert.ok(
    fotos.length < N,
    `a bancada não reproduziu a corrida (ficaram ${fotos.length}/${N}); sem isso o (A2) não prova nada`,
  );
});

test("(A2) O CONSERTO: as N chegam todas com o passo atômico", semBanco, async (t) => {
  const sessao = await novoPedido();
  t.after(() => apagar(sessao));

  const rs = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      await espera(GAP_MS); // mesma janela de antes
      const { data, error } = await db!.rpc("sgp_anexar_foto" as never, {
        p_sessao: sessao,
        p_foto: fotoFalsa(i),
        p_max: 50,
        p_dhash_limite: 5,
      } as never);
      if (error) throw new Error(error.message);
      return data as { ok: boolean };
    }),
  );

  const fotos = await lerFotos(sessao);
  console.log(`   (A2) atômico: mandei ${N} fotos, ficaram ${fotos.length} no banco`);
  assert.equal(rs.filter((r) => r.ok).length, N, "todas tinham que ser aceitas");
  assert.equal(fotos.length, N, `perdeu foto: ${fotos.length}/${N}`);
});

test("(A3) o teto não fura na corrida, e quem sobra ouve o motivo", semBanco, async (t) => {
  const sessao = await novoPedido();
  t.after(() => apagar(sessao));
  const MAX = 6;

  const rs = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      await espera(GAP_MS);
      const { data, error } = await db!.rpc("sgp_anexar_foto" as never, {
        p_sessao: sessao,
        p_foto: fotoFalsa(i),
        p_max: MAX,
        p_dhash_limite: 5,
      } as never);
      if (error) throw new Error(error.message);
      return data as { ok: boolean; reason?: string };
    }),
  );

  const fotos = await lerFotos(sessao);
  const recusadas = rs.filter((r) => !r.ok);
  console.log(`   (A3) teto ${MAX}: ${fotos.length} gravadas, ${recusadas.length} recusadas`);
  assert.equal(fotos.length, MAX, `o teto furou: ${fotos.length} > ${MAX}`);
  assert.equal(recusadas.length, N - MAX);
  for (const r of recusadas) assert.equal(r.reason, "max", "recusa sem motivo = sumiço silencioso");
});

test("(A4) foto repetida não passa nem quando as duas chegam juntas", semBanco, async (t) => {
  const sessao = await novoPedido();
  t.after(() => apagar(sessao));

  // Todas com o MESMO sha256 e o MESMO dhash: é a mesma foto N vezes.
  const rs = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      await espera(GAP_MS);
      const { data, error } = await db!.rpc("sgp_anexar_foto" as never, {
        p_sessao: sessao,
        // keys diferentes de propósito: o que barra é a IMPRESSÃO, não a key.
        p_foto: { ...fotoFalsa(i, "sha-igual", "a".repeat(16)), key: `sgp/teste/fotos/r${i}.jpg` },
        p_max: 50,
        p_dhash_limite: 5,
      } as never);
      if (error) throw new Error(error.message);
      return data as { ok: boolean; reason?: string };
    }),
  );

  const fotos = await lerFotos(sessao);
  console.log(`   (A4) mesma foto ${N}x: ${fotos.length} no banco`);
  assert.equal(fotos.length, 1, "entrou foto repetida");
  assert.equal(rs.filter((r) => r.ok).length, 1);
  for (const r of rs.filter((x) => !x.ok)) assert.equal(r.reason, "repetida");
});

test("(A5) mesma key SUBSTITUI (não duplica) — a semântica antiga continua", semBanco, async (t) => {
  const sessao = await novoPedido();
  t.after(() => apagar(sessao));

  for (const status of ["reprovada", "aprovada"]) {
    const { error } = await db!.rpc("sgp_anexar_foto" as never, {
      p_sessao: sessao,
      p_foto: { key: "sgp/teste/fotos/mesma.jpg", status, sha256: "s1", dhash: "b".repeat(16) },
      p_max: 6,
      p_dhash_limite: 5,
    } as never);
    if (error) throw new Error(error.message);
  }

  const fotos = (await lerFotos(sessao)) as Array<{ status: string }>;
  console.log(`   (A5) reenvio da mesma key: ${fotos.length} entrada(s), status "${fotos[0]?.status}"`);
  assert.equal(fotos.length, 1, "reenvio da mesma key duplicou");
  assert.equal(fotos[0]?.status, "aprovada", "a entrada nova tinha que substituir a antiga");
});

test("(A6) áudio: as N chegam todas (janela ainda maior, ffmpeg)", semBanco, async (t) => {
  const sessao = await novoPedido();
  t.after(() => apagar(sessao));

  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      await espera(GAP_MS);
      const { error } = await db!.rpc("sgp_anexar_audio" as never, {
        p_sessao: sessao,
        p_audio: { key: `sgp/teste/audio/${i}.mp3`, nome: `a${i}.mp3`, segundos: 60, status: "aprovado" },
        p_max: 20,
      } as never);
      if (error) throw new Error(error.message);
    }),
  );

  const { data } = await db!.from("sgp_pedidos").select("audios").eq("sessao", sessao).single();
  const audios = ((data as { audios?: unknown[] } | null)?.audios ?? []) as unknown[];
  console.log(`   (A6) áudio: mandei ${N}, ficaram ${audios.length} no banco`);
  assert.equal(audios.length, N, `perdeu áudio: ${audios.length}/${N}`);
});

test("(A7) remover não apaga o que um anexo concorrente acabou de gravar", semBanco, async (t) => {
  const sessao = await novoPedido();
  t.after(() => apagar(sessao));

  // Uma foto já no pedido; então, ao mesmo tempo: remove essa e anexa outra.
  await db!.rpc("sgp_anexar_foto" as never, {
    p_sessao: sessao,
    p_foto: fotoFalsa(1),
    p_max: 6,
    p_dhash_limite: 5,
  } as never);

  await Promise.all([
    db!.rpc("sgp_remover_foto" as never, { p_sessao: sessao, p_key: fotoFalsa(1).key } as never),
    db!.rpc("sgp_anexar_foto" as never, {
      p_sessao: sessao,
      p_foto: fotoFalsa(2),
      p_max: 6,
      p_dhash_limite: 5,
    } as never),
  ]);

  const fotos = (await lerFotos(sessao)) as Array<{ key: string }>;
  console.log(`   (A7) remover + anexar juntos: ficou ${JSON.stringify(fotos.map((f) => f.key))}`);
  assert.equal(fotos.length, 1);
  assert.equal(fotos[0]?.key, fotoFalsa(2).key, "o anexo concorrente foi apagado pelo DELETE");
});
