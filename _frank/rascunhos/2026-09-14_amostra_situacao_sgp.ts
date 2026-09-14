/**
 * Amostra REAL da coluna SITUAÇÃO do /admin/sgp, exigida pelo cartão.
 *
 * Não é mock: puxa linhas de verdade de `sgp_pedidos` e roda nelas a MESMA
 * função que o servidor roda (`montarLinha` de lib/sgp/painel.ts). O que sai aqui
 * é, literalmente, o que a tela recebe da rota.
 *
 * Rodar:  node --experimental-strip-types _frank/rascunhos/2026-09-14_amostra_situacao_sgp.ts
 */
import { createRequire } from "node:module";
import { montarLinha, resumir, type LinhaPainel } from "../../frontend/src/lib/sgp/painel.ts";
import type { SgpPedidoRow } from "../../frontend/src/lib/sgp/types.ts";

const require = createRequire(import.meta.url);
const { supa } = require("../ferramentas/_comum.cjs");

const COLUNAS =
  "id, nome, email, whatsapp, status, criado_em, atualizado_em, enviado_em, foto_pronta_em, voz_pronta_em, fotos, audios, erro";

function mostrar(titulo: string, l: LinhaPainel, nota?: string) {
  console.log(`\n── ${titulo} ${"─".repeat(Math.max(0, 60 - titulo.length))}`);
  if (nota) console.log(`   (${nota})`);
  console.log(`   Nome .......... ${l.nome}`);
  console.log(`   SITUAÇÃO ...... [${l.situacaoRotulo}]`);
  console.log(`   motivo ........ ${l.situacaoMotivo}`);
  console.log(`   Etapa atual ... ${l.etapa}`);
  console.log(`   Parado há ..... ${l.paradoTexto}`);
  console.log(`   Marcar erro ... ${l.erroManualTexto ?? "(botão)"}`);
  if (l.erroManualMotivo) console.log(`   motivo escrito  "${l.erroManualMotivo}"`);
  console.log(`   sobe pro topo?  ${l.precisaAcao ? "SIM (precisa de ação)" : "não"}`);
}

const db = supa();
const { data, error } = await db
  .from("sgp_pedidos")
  .select(COLUNAS)
  .order("atualizado_em", { ascending: false })
  .limit(500);
if (error) throw new Error(JSON.stringify(error));

const brutos = data as SgpPedidoRow[];
const agora = Date.now();
const linhas = brutos.map((p) => montarLinha(p, agora));

console.log(`banco vivo: ${brutos.length} pedidos lidos em ${new Date(agora).toISOString()}`);
console.log("contadores da tela:", resumir(linhas).situacoes);

const pronto = linhas.find((l) => l.situacao === "pronto");
const aguardando = linhas.find((l) => l.situacao === "aguardando");
const jaEmErro = linhas.find((l) => l.situacao === "erro");

if (pronto) mostrar("PRONTO — linha real", pronto);
if (aguardando) mostrar("AGUARDANDO — linha real", aguardando);

if (jaEmErro) {
  mostrar("ERRO — linha real", jaEmErro);
} else {
  // HONESTIDADE: não existe linha em ERRO no banco hoje. Medido: 0 em `falhou`
  // e 0 com `erro` preenchido, nas 236. Então a amostra de ERRO é a MESMA função
  // aplicada a uma linha REAL do banco com a marcação do time aplicada em
  // memória — é exatamente o que o POST /erro grava. O que é real: a linha, o
  // aluno, a etapa, o relógio. O que é simulado: as 3 colunas da migration 109.
  const base = brutos.find((p) => p.status === "pronto");
  if (!base) throw new Error("sem linha base para a amostra de ERRO");
  mostrar(
    "ERRO — mesma linha real, com a marcação do time",
    montarLinha(
      {
        ...base,
        erro_manual_em: new Date(agora - 2 * 60 * 60 * 1000).toISOString(),
        erro_manual_por: "suporte@lucasarrial.com",
        erro_manual_motivo: "aluno avisou no WhatsApp que a voz não é dele",
      },
      agora,
    ),
    "NENHUM pedido está em ERRO no banco hoje (0 em 'falhou', 0 com `erro`): " +
      "as 3 colunas da migration 109 foram simuladas em memória, o resto é do banco",
  );
}
