/**
 * `npx tsx --test src/components/voice/tocador-recuperacao.test.ts`
 *
 * NÃO use `node --test` pelado: o runner não resolve o alias `@/` (lição do
 * PR #159) — por isso o import abaixo é relativo e com extensão `.ts`
 * explícita, igual ao `progresso-envio.test.ts` ao lado.
 *
 * O que este teste protege: o tocador do histórico não pode morrer calado. Os
 * dois casos que importam, nas palavras do card:
 *   · onError → re-assina → sucesso na 2ª  (o aluno volta a ouvir, sem aviso)
 *   · onError → re-assina → falha → aviso visível
 * E a invariante que impede o remédio de virar doença: UMA tentativa só, nunca
 * um laço de requisição contra a nossa própria API.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aoFalharOTocador,
  buscarUrlFresca,
  proximoPassoDoTocador,
  type AcaoDeFalha,
  type EstadoTocador,
  type FetchLike,
} from "./tocador-recuperacao.ts";

const ID = "gen-rendanova-1";

/**
 * Um `fetch` de mentira com o formato REAL da rota: o GET
 * /api/v1/generations/<id> responde `{ generation: { ..., audio_url } }`
 * ([id]/route.ts:203). Conta as chamadas, que é como se prova "uma vez só".
 */
function fetchFalso(resposta: {
  ok?: boolean;
  audioUrl?: string | null;
  explode?: boolean;
  jsonQuebrado?: boolean;
}) {
  const chamadas: string[] = [];
  const impl: FetchLike = async (url) => {
    chamadas.push(url);
    if (resposta.explode) throw new TypeError("Failed to fetch");
    return {
      ok: resposta.ok ?? true,
      json: async () => {
        if (resposta.jsonQuebrado) throw new SyntaxError("Unexpected token <");
        return { generation: { id: ID, audio_url: resposta.audioUrl ?? null } };
      },
    };
  };
  return { impl, chamadas };
}

// ---------------------------------------------------------------- a máquina

test("primeiro erro tenta se curar; o segundo desiste; depois disso, silêncio", () => {
  assert.equal(proximoPassoDoTocador(undefined), "recuperar");
  assert.equal(proximoPassoDoTocador("recuperando"), "desistir");
  assert.equal(proximoPassoDoTocador("sem-tocador"), "ignorar");
});

// -------------------------------------------------- o caso 1 pedido no card

test("onError → re-assina → sucesso na 2ª: o card troca o src e NÃO mostra aviso", async () => {
  const estados = new Map<string, EstadoTocador>();
  const { impl, chamadas } = fetchFalso({ audioUrl: "https://r2/fresca.mp3?sig=nova" });

  const acao = await aoFalharOTocador(ID, estados, impl);

  assert.deepEqual(acao, { tipo: "trocar-src", url: "https://r2/fresca.mp3?sig=nova" });
  assert.deepEqual(chamadas, [`/api/v1/generations/${ID}`]);
  // Ainda "recuperando": a URL nova é a segunda tentativa, e ela pode falhar.
  assert.equal(estados.get(ID), "recuperando");
});

// -------------------------------------------------- o caso 2 pedido no card

test("onError → re-assina → a URL nova também falha → aviso visível", async () => {
  const estados = new Map<string, EstadoTocador>();
  const { impl, chamadas } = fetchFalso({ audioUrl: "https://r2/fresca.mp3?sig=nova" });

  const primeira = await aoFalharOTocador(ID, estados, impl);
  assert.equal(primeira.tipo, "trocar-src");

  // O browser carregou a URL nova e ela também não tocou.
  const segunda = await aoFalharOTocador(ID, estados, impl);

  assert.deepEqual(segunda, { tipo: "mostrar-aviso" });
  assert.equal(estados.get(ID), "sem-tocador");
  // A 2ª falha NÃO pede outra URL: foi uma tentativa só.
  assert.equal(chamadas.length, 1);
});

// ------------------------------------------------------------ a anti-doença

test("depois do aviso, erro repetido não bate mais na API (nada de laço)", async () => {
  const estados = new Map<string, EstadoTocador>();
  const { impl, chamadas } = fetchFalso({ audioUrl: "https://r2/fresca.mp3?sig=nova" });

  await aoFalharOTocador(ID, estados, impl); // trocar-src
  await aoFalharOTocador(ID, estados, impl); // mostrar-aviso
  const extras: AcaoDeFalha[] = [];
  for (let i = 0; i < 20; i++) extras.push(await aoFalharOTocador(ID, estados, impl));

  assert.ok(
    extras.every((a) => a.tipo === "nada"),
    "todo erro depois da desistência tem que ser inerte",
  );
  assert.equal(chamadas.length, 1, "20 erros a mais não podem virar 20 requisições");
});

test("um card que falhou não contamina o card do lado", async () => {
  const estados = new Map<string, EstadoTocador>();
  const { impl } = fetchFalso({ audioUrl: "https://r2/fresca.mp3?sig=nova" });

  await aoFalharOTocador("gen-A", estados, impl);
  await aoFalharOTocador("gen-A", estados, impl);
  assert.equal(estados.get("gen-A"), "sem-tocador");

  const vizinho = await aoFalharOTocador("gen-B", estados, impl);
  assert.equal(vizinho.tipo, "trocar-src", "gen-B nunca falhou antes; tem direito à 1ª tentativa");
});

// ------------------------------------- quando o backend não devolve URL nova

test("backend sem URL nova → aviso direto, sem 2ª tentativa de tocar", async () => {
  for (const cenario of [
    { nome: "HTTP não-ok", resp: { ok: false }, motivo: "http" as const },
    { nome: "generation ready=false (audio_url null)", resp: { audioUrl: null }, motivo: "sem_url" as const },
    { nome: "fetch explodiu (offline)", resp: { explode: true }, motivo: "excecao" as const },
    { nome: "corpo não é JSON", resp: { jsonQuebrado: true }, motivo: "excecao" as const },
  ]) {
    const estados = new Map<string, EstadoTocador>();
    const { impl } = fetchFalso(cenario.resp);

    const direto = await buscarUrlFresca(ID, impl);
    assert.deepEqual(direto, { ok: false, motivo: cenario.motivo }, cenario.nome);

    const acao = await aoFalharOTocador(ID, estados, impl);
    assert.deepEqual(acao, { tipo: "mostrar-aviso" }, cenario.nome);
    assert.equal(estados.get(ID), "sem-tocador", cenario.nome);
  }
});

// --------------------------------------------- a guarda contra o erro duplo

test("dois onError no MESMO tick disparam uma busca só", async () => {
  const estados = new Map<string, EstadoTocador>();
  const { impl, chamadas } = fetchFalso({ audioUrl: "https://r2/fresca.mp3?sig=nova" });

  // Sem await entre os dois: é exatamente o que um `useState` deixaria passar,
  // porque as duas invocações leriam o mesmo valor velho do closure.
  const [a, b] = await Promise.all([
    aoFalharOTocador(ID, estados, impl),
    aoFalharOTocador(ID, estados, impl),
  ]);

  assert.equal(chamadas.length, 1, "a marca é gravada antes do await");
  const tipos = [a.tipo, b.tipo].sort();
  assert.deepEqual(tipos, ["mostrar-aviso", "trocar-src"].sort());
});

test("o endpoint chamado é o mesmo que o botão de baixar já usa", async () => {
  const { impl, chamadas } = fetchFalso({ audioUrl: "https://r2/x.mp3" });
  await buscarUrlFresca("abc-123", impl);
  assert.deepEqual(chamadas, ["/api/v1/generations/abc-123"]);
});
