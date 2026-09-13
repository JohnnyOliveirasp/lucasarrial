/**
 * `node --test src/lib/video-clone/registrar-face-gate.test.ts`
 *
 * O que estes testes protegem, em ordem de importância:
 *   1. O RASTRO NUNCA MUDA O DESTINO DO PEDIDO. Banco fora do ar, tabela
 *      ausente, `registrar` lançando exceção — o aluno tem que receber
 *      exatamente a mesma resposta de sempre. Rastro que derruba pedido é pior
 *      que não ter rastro.
 *   2. O fail-open também grava. Sem isso a gente troca uma cegueira por outra:
 *      saberia quem foi barrado e continuaria sem saber quem foi COBRADO sem
 *      nunca ter sido olhado.
 *   3. Aprovação olhada não grava. Senão vira uma linha por clone e o sinal
 *      que a tabela existe pra dar se afoga.
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checarRostoComRastro,
  linhaDoFaceGate,
  registrarFaceGate,
  type DepsRastro,
  type RegistroFaceGate,
} from "./registrar-face-gate.ts";
import type { FaceGateResult } from "./face-gate.ts";

/** Os campos que vão pro banco (sem a URL, que é só entrada do gate). */
const BASE = {
  userId: "0e6a538a-0000-4000-8000-000000000371",
  bucket: "generations",
  imageKey: "0e6a538a/video-clone/uploads/2352_UPLOAD_b5c6dea7.jpeg",
};
const ARGS = { ...BASE, imageUrl: "https://r2.exemplo/assinada?x=1" };

/** O texto literal que o gate devolveu pra Alice nas 6 tentativas do #371. */
const MOTIVO_ALICE = "a pessoa está olhando para baixo, não para a câmera";

/** Junta o que foi gravado + permite mandar `registrar` falhar. */
function espiao(aoRegistrar?: (r: RegistroFaceGate) => Promise<void>) {
  const gravadas: RegistroFaceGate[] = [];
  const registrar = async (r: RegistroFaceGate) => {
    gravadas.push(r);
    if (aoRegistrar) await aoRegistrar(r);
  };
  return { gravadas, registrar };
}

function deps(veredito: FaceGateResult, aoRegistrar?: (r: RegistroFaceGate) => Promise<void>) {
  const e = espiao(aoRegistrar);
  const urlsVistas: string[] = [];
  const d: DepsRastro = {
    checar: async (url) => {
      urlsVistas.push(url);
      return veredito;
    },
    registrar: e.registrar,
  };
  return { deps: d, gravadas: e.gravadas, urlsVistas };
}

/** Cliente falso no formato que `registrarFaceGate` usa: .from().insert() */
function fakeAdmin(insert: (row: unknown) => unknown) {
  const chamadas: { tabela: string; row: unknown }[] = [];
  const admin = {
    from(tabela: string) {
      return {
        insert(row: unknown) {
          chamadas.push({ tabela, row });
          return Promise.resolve(insert(row));
        },
      };
    },
  };
  return { admin: admin as unknown as SupabaseClient, chamadas };
}

// ── linhaDoFaceGate: o mapeamento pro banco ────────────────────────────────

test("linhaDoFaceGate mapeia os campos com os nomes de coluna da migration 108", () => {
  const linha = linhaDoFaceGate({
    userId: ARGS.userId,
    bucket: ARGS.bucket,
    imageKey: ARGS.imageKey,
    resultado: "recusa",
    motivo: MOTIVO_ALICE,
  });
  assert.deepEqual(linha, {
    user_id: ARGS.userId,
    bucket: ARGS.bucket,
    image_key: ARGS.imageKey,
    resultado: "recusa",
    motivo: MOTIVO_ALICE,
  });
});

test("linhaDoFaceGate: motivo vazio/só-espaço vira null, não string vazia", () => {
  assert.equal(linhaDoFaceGate({ ...BASE, resultado: "recusa", motivo: "   " }).motivo, null);
  assert.equal(linhaDoFaceGate({ ...BASE, resultado: "recusa", motivo: "" }).motivo, null);
});

test("linhaDoFaceGate corta motivo gigante em 500 chars (texto de modelo não tem teto)", () => {
  const linha = linhaDoFaceGate({ ...BASE, resultado: "recusa", motivo: "x".repeat(2000) });
  assert.equal((linha.motivo as string).length, 500);
});

// ── (a) recusa grava exatamente UMA linha, com o motivo CRU ────────────────

test("(a) recusa: grava exatamente uma linha, com o motivo cru e sem reescrever o texto", async () => {
  const { deps: d, gravadas } = deps({ ok: false, reason: MOTIVO_ALICE });

  const veredito = await checarRostoComRastro(d, ARGS);

  assert.equal(gravadas.length, 1, "uma recusa = uma linha, nem zero nem duas");
  assert.deepEqual(gravadas[0], {
    userId: ARGS.userId,
    bucket: ARGS.bucket,
    imageKey: ARGS.imageKey,
    resultado: "recusa",
    // CRU: o mesmo texto que o modelo devolveu, sem virar a mensagem do aluno.
    // É lendo este texto repetido que se descobre o viés do detector (#371).
    motivo: MOTIVO_ALICE,
  });
  // E o veredito chega intacto pra rota devolver `face_not_frontal`.
  assert.deepEqual(veredito, { ok: false, reason: MOTIVO_ALICE });
});

// ── (b) INSERT falhando não impede a recusa de chegar ao aluno ─────────────

test("(b) INSERT falhando NÃO impede a recusa de chegar ao aluno", async () => {
  const { deps: d, gravadas } = deps(
    { ok: false, reason: MOTIVO_ALICE },
    async () => {
      throw new Error('relation "public.face_gate_recusas" does not exist');
    },
  );

  const veredito = await checarRostoComRastro(d, ARGS);

  assert.equal(gravadas.length, 1, "tentou gravar");
  // O que importa: o veredito saiu igualzinho ao do caso feliz.
  assert.deepEqual(veredito, { ok: false, reason: MOTIVO_ALICE });
});

test("(b2) registrarFaceGate não lança nem quando o supabase devolve erro", async () => {
  const { admin, chamadas } = fakeAdmin(() => ({
    error: { message: 'relation "public.face_gate_recusas" does not exist' },
  }));
  await registrarFaceGate(admin, { ...BASE, resultado: "recusa", motivo: MOTIVO_ALICE });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].tabela, "face_gate_recusas");
});

test("(b3) registrarFaceGate não lança nem quando o próprio insert explode", async () => {
  const { admin } = fakeAdmin(() => {
    throw new Error("fetch failed");
  });
  // Sem assert.rejects: o contrato é justamente NÃO lançar.
  await registrarFaceGate(admin, { ...BASE, resultado: "avaliacao_impossivel", motivo: "falha_tecnica: anthropic 529" });
});

// ── (c) fail-open também grava — as três portas ────────────────────────────

test("(c1) fail-open por falha técnica grava, com a causa técnica junto", async () => {
  const { deps: d, gravadas } = deps({ ok: true, skipped: "falha_tecnica", erro: "anthropic 529" });

  const veredito = await checarRostoComRastro(d, ARGS);

  assert.equal(gravadas.length, 1);
  assert.equal(gravadas[0].resultado, "avaliacao_impossivel");
  // "falha_tecnica" sozinho não distingue timeout de 429 de JSON torto.
  assert.equal(gravadas[0].motivo, "falha_tecnica: anthropic 529");
  // Continua passando: o produto não para porque o detector caiu.
  assert.equal(veredito.ok, true);
});

test("(c2) fail-open por ANTHROPIC_API_KEY ausente grava (configuração faltando é cegueira)", async () => {
  const { deps: d, gravadas } = deps({ ok: true, skipped: "sem_api_key" });
  await checarRostoComRastro(d, ARGS);
  assert.equal(gravadas.length, 1);
  assert.equal(gravadas[0].resultado, "avaliacao_impossivel");
  assert.equal(gravadas[0].motivo, "sem_api_key");
});

test("(c3) presign falhando grava E nem chama a visão (a terceira porta, que é da rota)", async () => {
  const { deps: d, gravadas, urlsVistas } = deps({ ok: false, reason: "nunca deveria ser consultado" });

  const veredito = await checarRostoComRastro(d, { ...ARGS, imageUrl: null });

  assert.equal(urlsVistas.length, 0, "sem URL não há o que olhar");
  assert.equal(gravadas.length, 1);
  assert.equal(gravadas[0].resultado, "avaliacao_impossivel");
  assert.match(gravadas[0].motivo, /^presign_falhou:/);
  // Fail-open: passa. Era o comportamento de antes do #372 (o `if (gateUrl)`),
  // e ele NÃO muda aqui — só deixa de ser invisível.
  assert.equal(veredito.ok, true);
});

test("(c4) gate DESLIGADO de propósito não grava (escolha nossa não é cegueira acidental)", async () => {
  const { deps: d, gravadas } = deps({ ok: true, skipped: "desligado" });
  const veredito = await checarRostoComRastro(d, ARGS);
  assert.equal(gravadas.length, 0, "uma linha por pedido afogaria o sinal da tabela");
  assert.equal(veredito.ok, true);
});

// ── (d) aprovação normal não grava nada e o fluxo segue idêntico ───────────

test("(d) aprovação olhada não grava NADA e o fluxo segue idêntico ao de hoje", async () => {
  const { deps: d, gravadas, urlsVistas } = deps({ ok: true });

  const veredito = await checarRostoComRastro(d, ARGS);

  assert.equal(gravadas.length, 0, "aprovação não vira linha — isso video_clones já responde");
  assert.deepEqual(urlsVistas, [ARGS.imageUrl], "a visão foi chamada com a URL assinada");
  assert.deepEqual(veredito, { ok: true });
});

test("(d2) o rastro NUNCA altera o veredito — devolve o objeto do gate intacto", async () => {
  for (const veredito of [
    { ok: true },
    { ok: true, skipped: "falha_tecnica", erro: "timeout" },
    { ok: false, reason: "a boca está coberta pela mão" },
  ] as FaceGateResult[]) {
    const { deps: d } = deps(veredito);
    assert.deepEqual(await checarRostoComRastro(d, ARGS), veredito);
  }
});
