/**
 * QUANTA GENTE RECEBEU LINK DE RECUPERAÇÃO E MESMO ASSIM NUNCA ENTROU?
 *
 * POR QUE EXISTE (ronda 19hZ de 18/09, caso Walsicleia `#1a37605a`). A aluna
 * pagou, tem voz e foto prontas, recebeu link de primeiro acesso DUAS vezes e
 * `last_sign_in_at` seguia NULL. A pergunta que decide se isso é o caso dela ou
 * um defeito da casa não é sobre ela: é **quantas outras pessoas estão no mesmo
 * estado**. Um caso é atendimento; uma população é bug em produção.
 *
 * O QUE ELE MEDE, e por que este par de campos:
 *   `recovery_sent_at` != NULL  → a casa (ou o próprio aluno) PEDIU o link.
 *   `last_sign_in_at`  == NULL  → e mesmo assim a pessoa nunca logou UMA vez.
 * Quem está nos dois ao mesmo tempo recebeu a chave e continuou do lado de fora.
 *
 * ⚠️ O QUE ESTE NÚMERO **NÃO** PROVA. Ele não distingue quem nunca abriu o
 * e-mail de quem clicou e o produto falhou. Ele mede a POPULAÇÃO EXPOSTA, não a
 * causa. A causa tem que vir do código (ver abaixo) — este script só diz de que
 * tamanho é o problema se a causa for real. Não escreva "N alunos travados pelo
 * bug" com base só nisto; escreva "N alunos estão expostos a este caminho".
 *
 * ⚠️ CONTROLE POSITIVO OBRIGATÓRIO (regra da casa: consulta que erra volta
 * vazia). Ele também conta quem tem `recovery_sent_at` E JÁ LOGOU. Se esse
 * segundo número vier ZERO, não comemore o primeiro: significa que o filtro
 * está quebrado, não que todo mundo está travado.
 *
 * A HIPÓTESE DE CAUSA que este número dimensiona (medida nesta ronda):
 *   `recovery-link/route.ts:41` devolve `properties.action_link`, que aponta pro
 *   `/auth/v1/verify` do Supabase. Esse endpoint responde **303** devolvendo a
 *   sessão no **FRAGMENTO** da URL (`#access_token=...`) — medido nesta ronda.
 *   Fragmento **nunca é enviado ao servidor**. E `auth/callback/route.ts` só lê
 *   `code` e `token_hash` da QUERY STRING: sem nenhum dos dois, ele cai no
 *   `return` final, `/login?error=missing_code_or_token` — com o token de uso
 *   único JÁ QUEIMADO pelo verify. O aluno perde a chave e vê tela de erro.
 *
 * Só LEITURA: `listUsers` da API admin + contagem. Não gera link (gerar link
 * INVALIDA o link anterior do aluno), não escreve, não manda e-mail.
 *
 * uso: node _frank/ferramentas/2026-09-18_recovery_que_nunca_vira_login.cjs [--listar]
 */
const { supa } = require("./_comum.cjs");

const LISTAR = process.argv.includes("--listar");

(async () => {
  const db = supa();

  const usuarios = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    usuarios.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const pediu = usuarios.filter((u) => u.recovery_sent_at);
  const presos = pediu.filter((u) => !u.last_sign_in_at);
  const entraram = pediu.filter((u) => u.last_sign_in_at);
  const nuncaLogaram = usuarios.filter((u) => !u.last_sign_in_at);

  console.log(`auth.users .................... ${usuarios.length}`);
  console.log(`nunca logaram (qualquer causa)   ${nuncaLogaram.length}`);
  console.log("");
  console.log(`pediram/receberam recovery ...   ${pediu.length}`);
  console.log(`   ├─ e DEPOIS entraram .......   ${entraram.length}   ← controle positivo`);
  console.log(`   └─ e NUNCA entraram ........   ${presos.length}   ← população exposta`);
  console.log("");

  if (!pediu.length) {
    console.log("⚠️  ZERO com recovery_sent_at. Isso é suspeito de filtro quebrado,");
    console.log("    não de 'ninguém pediu'. Confira o campo antes de concluir.");
    return;
  }
  if (!entraram.length) {
    console.log("🚨 CONTROLE POSITIVO FALHOU: ninguém com recovery_sent_at aparece");
    console.log("   como tendo logado. Trate o número de cima como NÃO CONFIÁVEL.");
  } else {
    const taxa = ((presos.length / pediu.length) * 100).toFixed(1);
    console.log(`taxa de quem recebeu link e nunca entrou: ${taxa}%`);
    console.log("(o controle positivo acima prova que o filtro enxerga os dois lados)");
  }

  if (LISTAR) {
    console.log("\n── presos (recovery enviado, login nunca) ──");
    for (const u of presos
      .slice()
      .sort((a, b) => String(b.recovery_sent_at).localeCompare(String(a.recovery_sent_at)))) {
      console.log(
        `  ${String(u.recovery_sent_at).slice(0, 19)} | criado ${String(u.created_at).slice(0, 10)} | ${u.email}`,
      );
    }
  }
})().catch((e) => {
  console.error("falhou:", e?.message ?? e);
  process.exit(1);
});
