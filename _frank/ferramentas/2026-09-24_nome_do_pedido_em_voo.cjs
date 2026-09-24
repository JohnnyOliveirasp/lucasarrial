/**
 * #377 / cartao 0d18df31 — O PEDIDO QUE JA ESTAVA EM VOO QUANDO A TRAVA SUBIU.
 *
 * O conserto do #377 (d8ace93f, em producao desde 15/09 02:20Z) tem DUAS
 * pernas, e as duas guardam a PORTA DE ENTRADA:
 *
 *   1. `problemaNoNome` em `/api/v1/sgp/inicio` — recusa e-mail no campo nome
 *      na PRIMEIRA tela.
 *   2. `camposDoPerfil` em `processar.ts` — nao sobrescreve `display_name` de
 *      conta que JA existe.
 *
 * O buraco: pedido criado ANTES do merge ja passou pela tela 1 com o nome ruim
 * GRAVADO, e a perna 2 so protege quem JA TEM CONTA. Pedido antigo + aluno sem
 * conta = `contaCriada=true` => `semNadaAPreservar=true` => o upsert grava
 * `display_name = pedido.nome`. A conta nasce chamada "fulano@gmail.com", e o
 * mesmo texto vai junto em `user_metadata.full_name` na criacao do usuario.
 *
 * Medido em 24/09: 398 pedidos, UM unico com e-mail no campo nome —
 * `4d0e4dd1` (angelacleomarfreitasdasilva@gmail.com), criado 11/09 20:30Z,
 * status `foto`, parado desde 11/09 20:32Z. Dos 140 pedidos nascidos DEPOIS do
 * merge, ZERO tem e-mail no nome: a trava pega o fluxo novo, e so o acervo em
 * voo ficou de fora. Terceiro caso da classe do #410 ("conserto sobe e nao
 * migra o acervo aberto").
 *
 * O NOME NAO E INVENTADO. A nota de 13/09 parou aqui de proposito: "nao existe
 * compra no nome dela em payment_events e ela nao tem conta, entao nao tenho
 * nome autoritativo. Nao invento nome de aluno a partir do e-mail." Estava
 * certa sobre o NOSSO banco e certa em parar. O que mudou: o
 * `2026-09-20_contato_do_comprador.cjs` (nascido 20/09, DEPOIS daquela nota)
 * le a Hotmart viva, e la esta a compra HP0025277184 (Fabrica de Conteudo
 * Invisivel, 270,27 BRL, COMPLETE, 11/09) com `buyer.name` preenchido. E o
 * nome que ela mesma digitou ao pagar — fonte autoritativa, o MESMO metodo que
 * curou a Ana Paula em 13/09. "O nosso banco nao tem" nunca foi "nao existe".
 *
 * NAO MEXE em credito, acesso, plano, cobranca, status do pedido nem GPU.
 * Corrige UM campo de texto para o valor que a fonte de verdade ja dizia.
 *
 *   node _frank/ferramentas/2026-09-24_nome_do_pedido_em_voo.cjs            # ensaio
 *   node _frank/ferramentas/2026-09-24_nome_do_pedido_em_voo.cjs --confirmar
 *
 * ARMADILHA (03_ROTINA): update no Supabase por id inexistente afeta 0 linhas
 * EM SILENCIO. Aqui todo update pede `.select()` e o script conta as linhas
 * afetadas; 0 linha e FALHA, nao sucesso.
 */
const { supa } = require("./_comum.cjs");

const PEDIDO = "4d0e4dd1-1514-4ab4-9416-cc416beaa91a";
const EMAIL = "angelacleomarfreitasdasilva@gmail.com";
const NOME_BOM = "Angela Cleomar Freitas Da Silva"; // buyer.name de HP0025277184
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONFIRMAR = process.argv.includes("--confirmar");

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

(async () => {
  const db = supa();

  const { data: antes, error: e1 } = await db
    .from("sgp_pedidos").select("id, email, nome, status").eq("id", PEDIDO).maybeSingle();
  exigir("ler pedido", e1);
  if (!antes) { console.error("❌ pedido nao existe — abortando"); process.exit(1); }

  console.log("ANTES:", JSON.stringify(antes));

  if ((antes.email || "").toLowerCase() !== EMAIL) {
    console.error("❌ e-mail do pedido nao bate com o alvo — abortando"); process.exit(1);
  }
  if (!EMAIL_RE.test((antes.nome || "").trim())) {
    console.log("\n✔ nada a fazer: o nome deste pedido JA nao e um e-mail.");
    process.exit(0);
  }
  if (EMAIL_RE.test(NOME_BOM)) { console.error("❌ o nome novo parece e-mail — abortando"); process.exit(1); }

  if (!CONFIRMAR) {
    console.log(`\n[ENSAIO] gravaria nome = "${NOME_BOM}"  (rode com --confirmar)`);
    console.log("ENSAIO NAO E ENTREGA: nada foi gravado.");
    process.exit(0);
  }

  const { data: depois, error: e2 } = await db
    .from("sgp_pedidos").update({ nome: NOME_BOM }).eq("id", PEDIDO).select("id, email, nome, status");
  exigir("gravar nome", e2);
  const n = (depois || []).length;
  console.log(`\nlinhas afetadas: ${n}`);
  if (n !== 1) { console.error("❌ esperava 1 linha afetada — NAO afirme que gravou"); process.exit(1); }
  console.log("DEPOIS (retorno do update):", JSON.stringify(depois[0]));

  // Releitura INDEPENDENTE do update
  const { data: rel, error: e3 } = await db
    .from("sgp_pedidos").select("id, nome").eq("id", PEDIDO).maybeSingle();
  exigir("releitura", e3);
  const ok = rel && rel.nome === NOME_BOM;
  console.log("RELEITURA:", JSON.stringify(rel), ok ? "✔ confere" : "❌ NAO confere");
  process.exit(ok ? 0 : 1);
})();
