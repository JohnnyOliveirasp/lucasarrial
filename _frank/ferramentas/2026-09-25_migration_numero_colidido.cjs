/**
 * MIGRATION DE NUMERO COLIDIDO — dois arquivos de DDL com o MESMO numero.
 *
 *   node _frank/ferramentas/2026-09-25_migration_numero_colidido.cjs
 *   node _frank/ferramentas/2026-09-25_migration_numero_colidido.cjs --json
 *
 * SO LEITURA. Nao aplica DDL, nao escreve, nao chama funcao do banco.
 *
 * ── POR QUE NASCEU (ronda de 25/09 ~00hZ) ────────────────────────────────
 *
 * Fui mergear o `#307` (o mais velho da coluna "entram hoje", 8d, na vespera
 * do corte de 9d medido pelo `conserto_pronto_e_parado.cjs`). Ele adiciona
 * `scripts/118_sgp_conclusao_automatica.sql` e o proprio corpo do PR explica,
 * com cuidado, por que escolheu o 118:
 *
 *     "O cartao pediu '117+'. A 117 ja existe (117_sgp_fracassos.sql, na
 *      main). Conferi antes de escrever. Esta e a 118."
 *
 * A conferencia estava certa em 16/09 e ficou ERRADA sem ninguem mexer nela:
 * a main ja tem DOIS arquivos 118 (`118_virais_do_aluno.sql` e
 * `118_voices_speech_rate.sql`). O #307 faria o TERCEIRO.
 *
 * ── ⚠️ A HIPOTESE COM QUE ELE NASCEU FOI REFUTADA PELA PROPRIA MEDICAO ────
 *
 * Escrevi este arquivo achando que a colisao ja tinha CAUSADO um pulo: que
 * alguem leria "a N ja foi aplicada" e pularia a gemea. A primeira rodada
 * parecia confirmar — `82_generations_runpod_timing` e
 * `100_image_generations_video_historico` estao AUSENTES no banco vivo
 * enquanto as gemeas do mesmo numero estao presentes.
 *
 * **Nao e isso.** Fui ler o cabecalho dos dois arquivos antes de escrever a
 * acusacao, e os DOIS se declaram nao-aplicados DE PROPOSITO:
 *
 *   82  → "⚠️ ESPELHO — NAO APLICADO. DDL aguardando aprovacao do Johnny."
 *   100 → "NAO APLICADO. Commitado pra leitura e aval (ordem de 18/08,
 *          'DDL pelo git')."
 *
 * Ou seja: sao a politica da casa funcionando (DDL espera aval), nao vitimas
 * da colisao. O `ddl_aplicado.cjs` ja os reporta assim, com o rotulo
 * "(NAO APLICADA)", e continua sendo o instrumento certo pra pergunta
 * "que coluna falta no banco".
 *
 * Fica registrado porque quase virou achado: **estado divergente entre gemeas
 * NAO e prova de pulo.** Ele e compativel com pulo E com decisao deliberada,
 * e sao os cabecalhos que separam as duas. Concluir pela divergencia sozinha
 * seria deduzir e chamar de medido — o erro que esta casa ja documentou.
 *
 * ── ENTAO O QUE ESTE INSTRUMENTO SERVE ───────────────────────────────────
 *
 * Pra UMA pergunta que o `ddl_aplicado.cjs` nao faz: **quantos numeros de
 * migration estao repetidos, e quais.** Ele agrupa por ARQUIVO e por isso e
 * cego pra colisao — nao disse em nenhum momento que o 82 tem TRES arquivos
 * e o 118 tem DOIS.
 *
 * A colisao e defeito de ESCRITURACAO, e o dano dela e concreto e ja medido:
 * o corpo do `#307` argumenta, com cuidado e conferindo antes, que
 * *"a 117 ja existe, logo esta e a 118"* — afirmacao que era VERDADEIRA em
 * 16/09 e ficou FALSA sem ninguem tocar no PR, porque duas 118 entraram na
 * main enquanto ele esperava merge. O numero nao e identificador: e um
 * palpite sobre o que os outros ainda nao mergearam. Quem chega depois nao
 * tem como saber, e a frase "conferi antes de escrever" nao protege.
 *
 * MEDE, entao: os numeros repetidos em `scripts/` na `origin/main`, e — como
 * CONTEXTO, nao como acusacao — o estado no banco vivo do que cada arquivo
 * promete.
 *
 * O teste de existencia e um `select <coluna> limit 1` no PostgREST: coluna
 * que nao existe devolve o codigo `42703` (undefined_column) e tabela que nao
 * existe devolve `42P01`. E deteccao positiva, nao inferencia por ausencia de
 * dado — tabela VAZIA responde 200 e conta como PRESENTE, que e o certo:
 * a pergunta e sobre o SCHEMA, nao sobre o conteudo.
 *
 * NAO MEDE, e esta dito em vez de escondido:
 *
 *  - **Funcao (`create function`) fica FORA da conta.** O `82_trial_expiry_
 *    cobranca_em_voo.sql` cria `expire_trial_credits`, e o unico jeito de
 *    prova-la pelo PostgREST e CHAMANDO — e ela MEXE EM CREDITO DE ALUNO.
 *    Ronda nao chama funcao de dinheiro pra satisfazer instrumento. Ela sai
 *    no relatorio como NAO-MEDIDA, nunca como aplicada.
 *  - **`create index` / `enable row level security` / `create trigger`** nao
 *    tem coluna pra apontar e tambem ficam fora.
 *  - **Coluna presente NAO prova que foi este arquivo que a criou.** Prova
 *    que o schema tem o que o arquivo pedia. Pra decidir merge isso basta;
 *    pra auditoria de autoria, nao.
 *
 * ── O QUE ELE NAO AUTORIZA ────────────────────────────────────────────────
 *
 * Nao autoriza renumerar arquivo na main (DDL ja aplicado nao se renumera:
 * o numero e o rastro do que rodou) nem aplicar migration nenhuma. A saida e
 * insumo pra decisao de producao, que tem dono e nao e a ronda.
 */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { supa } = require("./_comum.cjs");

const RAIZ = path.resolve(__dirname, "..", "..");
const JSON_OUT = process.argv.includes("--json");
const git = (...a) => execFileSync("git", a, { cwd: RAIZ, encoding: "utf8" });

/**
 * O que cada arquivo colidido PROMETE ao schema.
 * Montado a mao, lendo o DDL — e nao por regex no SQL — porque `add column
 * if not exists` em bloco, `create table` e funcao tem formas diferentes e um
 * parser meia-boca erraria em silencio. Lista curta e conferivel a olho.
 */
const PROMESSAS = {
  "82_generations_runpod_timing.sql": [
    { tabela: "generations", coluna: "delay_seconds" },
    { tabela: "generations", coluna: "execution_seconds" },
  ],
  "82_trial_expiry_cobranca_em_voo.sql": [
    { funcao: "expire_trial_credits" }, // NAO-MEDIVEL sem chamar: mexe em credito
  ],
  "82_video_projects_product_idea.sql": [
    { tabela: "video_projects", coluna: "product_idea" },
  ],
  "100_image_generations_video_historico.sql": [
    { tabela: "image_generations", coluna: "video_paths_anteriores" },
  ],
  "100_sgp_pedidos.sql": [
    { tabela: "profiles", coluna: "whatsapp" },
    { tabela: "sgp_pedidos", coluna: "id" },
  ],
  "118_virais_do_aluno.sql": [
    { tabela: "viral_videos", coluna: "enviado_por" },
    { tabela: "viral_videos", coluna: "publico" },
    { tabela: "viral_videos", coluna: "removido_em" },
  ],
  "118_voices_speech_rate.sql": [
    { tabela: "voices", coluna: "speech_rate_wps" },
    { tabela: "voices", coluna: "reference_rate_wps" },
  ],
};

/** Existe no schema? Deteccao POSITIVA pelo codigo de erro do PostgREST. */
async function existeColuna(db, tabela, coluna) {
  const { error } = await db.from(tabela).select(coluna).limit(1);
  if (!error) return { estado: "PRESENTE" };
  if (error.code === "42703") return { estado: "AUSENTE", motivo: "coluna nao existe (42703)" };
  if (error.code === "42P01") return { estado: "AUSENTE", motivo: "tabela nao existe (42P01)" };
  // Qualquer outra coisa (permissao, rede, RLS) NAO e ausencia. Nao chute.
  return { estado: "NAO-MEDIDO", motivo: `${error.code || "?"}: ${error.message}` };
}

(async () => {
  const db = supa();

  // 1. Achar os numeros colididos na main (nao na arvore local, que pode ter lixo)
  const arquivos = git("ls-tree", "--name-only", "origin/main", "scripts/")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^scripts\/\d+_.*\.sql$/.test(l))
    .map((l) => l.replace(/^scripts\//, ""));

  const porNumero = new Map();
  for (const a of arquivos) {
    const n = a.match(/^(\d+)_/)[1].replace(/^0+/, "");
    if (!porNumero.has(n)) porNumero.set(n, []);
    porNumero.get(n).push(a);
  }
  const colididos = [...porNumero.entries()]
    .filter(([, fs]) => fs.length > 1)
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  // 2. Medir cada promessa no banco vivo
  const resultado = [];
  for (const [numero, fs] of colididos) {
    const grupo = { numero, arquivos: [] };
    for (const f of fs) {
      const promessas = PROMESSAS[f];
      const item = { arquivo: f, checagens: [] };
      if (!promessas) {
        item.checagens.push({ alvo: "(sem promessa mapeada)", estado: "NAO-MEDIDO", motivo: "arquivo novo: mapeie em PROMESSAS" });
      } else {
        for (const p of promessas) {
          if (p.funcao) {
            item.checagens.push({
              alvo: `function ${p.funcao}()`,
              estado: "NAO-MEDIDO",
              motivo: "so se prova CHAMANDO, e ela mexe em credito de aluno",
            });
            continue;
          }
          const r = await existeColuna(db, p.tabela, p.coluna);
          item.checagens.push({ alvo: `${p.tabela}.${p.coluna}`, ...r });
        }
      }
      const es = item.checagens.map((c) => c.estado);
      item.veredito = es.includes("AUSENTE")
        ? "NAO APLICADA (ao menos em parte)"
        : es.every((e) => e === "PRESENTE")
          ? "aplicada"
          : "NAO-MEDIDA";
      grupo.arquivos.push(item);
    }
    // Gemeas do mesmo numero em estados DIFERENTES.
    // ⚠️ NAO e prova de pulo: e compativel com "nao aplicada de proposito"
    // (a politica de DDL-espera-aval), que foi o caso dos DOIS divergentes
    // medidos em 25/09. Quem separa as duas leituras e o CABECALHO do arquivo.
    const vs = grupo.arquivos.map((a) => a.veredito);
    grupo.divergente = new Set(vs.filter((v) => v !== "NAO-MEDIDA")).size > 1;
    resultado.push(grupo);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ colididos: resultado }, null, 2));
    return;
  }

  console.log(`\n🔢 NUMEROS DE MIGRATION COLIDIDOS NA main: ${resultado.length}`);
  console.log(`   (${arquivos.length} arquivos em scripts/ ao todo)\n`);

  let ausentes = 0;
  let divergentes = 0;
  for (const g of resultado) {
    console.log(`── numero ${g.numero} · ${g.arquivos.length} arquivos ${g.divergente ? "· gemeas em estados diferentes (NAO e prova de pulo — leia o cabecalho)" : ""}`);
    if (g.divergente) divergentes++;
    for (const a of g.arquivos) {
      const marca = a.veredito.startsWith("NAO APLICADA") ? "🔴" : a.veredito === "aplicada" ? "✅" : "⬜";
      console.log(`   ${marca} ${a.arquivo} → ${a.veredito}`);
      for (const c of a.checagens) {
        if (c.estado === "AUSENTE") ausentes++;
        const m = c.estado === "PRESENTE" ? "   ·" : c.estado === "AUSENTE" ? "   ✗" : "   ?";
        console.log(`${m} ${c.alvo}${c.motivo ? ` — ${c.motivo}` : ""}`);
      }
    }
    console.log("");
  }

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`>>> NUMERO PRO RELATORIO: ${resultado.length} numero(s) de migration colidido(s) na main`);
  console.log(`    (contexto, nao acusacao: ${ausentes} promessa(s) ausente(s) no banco vivo · ${divergentes} numero(s) com gemeas em estados diferentes)`);
  console.log("    ⚠️  Estado divergente NAO e prova de pulo: em 25/09 os 2 divergentes (82, 100)");
  console.log("       se declaram nao-aplicados DE PROPOSITO no cabecalho, esperando aval do Johnny.");
  console.log("    ⚠️  Coluna PRESENTE nao prova que foi ESTE arquivo que a criou.");
  console.log("    ⚠️  Funcao de dinheiro fica NAO-MEDIDA de proposito: prova-la exige chama-la.");
  console.log("    O dano da colisao e de ESCRITURACAO: o numero vira palpite sobre o que os");
  console.log("    outros ainda nao mergearam, e 'conferi antes de escrever' nao protege quem espera.");
  console.log("    Renumerar arquivo JA APLICADO nao e conserto — o numero e o rastro do que rodou.");
  console.log("    Renumerar arquivo NUNCA aplicado, ainda em PR, e seguro — foi o caso do #307.");
})().catch((e) => {
  console.error("falhou:", e.message);
  process.exit(1);
});
