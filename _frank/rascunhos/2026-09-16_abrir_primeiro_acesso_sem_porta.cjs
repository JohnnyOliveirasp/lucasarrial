#!/usr/bin/env node
/**
 * Abre o incidente medido na ronda do VIGIA de 16/09 20hZ:
 * a casa cria a conta do aluno do SGP, entrega tudo, e manda ele "Acessar:
 * fastcloner.com/login" — uma tela para a qual ele nunca teve senha.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const AFETADOS = [
  "iran@ogr.com.br",
  "edust@live.com",
  "soleideritter@gmail.com",
  "rafaelzan@me.com",
  "walsicleia_kaka@hotmail.com",
  "annagalaggi.adv@outlook.com.br",
  "januario@caffaroadvogados.com.br",
  "asbertoni@hotmail.com",
  "bruno_aurelio@msn.com",
  "dacostavenicia@gmail.com",
];

const TITULO =
  "A CASA CRIA A CONTA DO ALUNO E MANDA ELE ENTRAR NUMA TELA PARA A QUAL ELE NUNCA TEVE SENHA: " +
  "os tres e-mails de fim de onboarding terminam em \"Acesse: fastcloner.com/login\" " +
  "(pronto.ts:29 e :43, avisos.ts:258) e NENHUM deles carrega link de definir senha. " +
  "Medido 16/09 20:10Z: 10 alunos com pedido SGP 'pronto' tem last_sign_in_at NULL — " +
  "NUNCA entraram. O mais velho ha 9,8 dias. DOIS deles pagaram (R$ 936,15 e R$ 926,69, " +
  "Hotmart COMPLETE/APPROVED) e escalaram HOJE, com 23 min de diferenca, dizendo a mesma frase: " +
  "o codigo nao chega";

const DESCRICAO = `MEDIDO POR MIM (VIGIA) NA RONDA DE 16/09 20:10Z, EM PRODUCAO.
Cartao aberto pela ordem de 27/08 (so erro de SISTEMA vira chamado). A parte
COMERCIAL deste assunto NAO esta aqui — vai pro grupo, ver "O QUE ESTE CARTAO
NAO AFIRMA".

O QUE ESTE CARTAO AFIRMA
Que a casa cria a conta do aluno (auth.users com email_confirmed_at preenchido
no mesmo instante da criacao, sem o aluno escolher nada) e, no fim do
onboarding, manda pra ele um e-mail cuja unica instrucao de entrada e:
  - frontend/src/lib/onboarding/pronto.ts:29   "Acesse: https://fastcloner.com/login"
  - frontend/src/lib/onboarding/pronto.ts:43   idem (caminho semImagem)
  - frontend/src/lib/onboarding/avisos.ts:258  "e so entrar em ${"${LOGIN_URL}"}" (avisoOkMasAssine)
Os TRES caminhos de fim de onboarding passam por uma dessas linhas. Nenhum dos
tres manda link de definir senha, magic link ou codigo. Conferido lendo os
textos, nao por impressao: grep por senha/recovery/magic em pronto.ts devolve
ZERO.

Para uma conta que o ALUNO criou isso e correto — ele tem a senha dele. Para a
conta que a CASA criou por ele (que e o caso do SGP inteiro), "Acesse: /login"
e uma porta trancada: a unica saida restante e ele descobrir sozinho o
"Esqueci a senha".

A MEDICAO (a consulta esta no fim, e reproduzivel)
10 pedidos SGP com status='pronto' cujo dono tem auth.users.last_sign_in_at
NULL — nunca entraram uma vez sequer. Nao e ruido de campo: dos 89 pedidos
'pronto', 78 tem last_sign_in_at preenchido, entao o campo funciona.
(Um 11o caso existe e foi DESCARTADO de proposito: frank-teste-enviado@
fastcloner.invalid, registro de teste. Os 10 acima sao gente.)

  aluno                              pronto ha   link de recuperacao
  iran@ogr.com.br                    9,8 d       NUNCA RECEBEU NENHUM (NULL)
  edust@live.com                     6,7 d       1, em 10/09
  soleideritter@gmail.com            5,8 d       1, em 14/09
  rafaelzan@me.com                   5,1 d       1, no instante da criacao
  walsicleia_kaka@hotmail.com        5,0 d       1, HOJE 19:34Z (depois de escalar)
  annagalaggi.adv@outlook.com.br     2,8 d       1, no instante da criacao
  januario@caffaroadvogados.com.br   2,2 d       1, no instante da criacao
  asbertoni@hotmail.com              0,1 d       1, no instante da criacao (13/09)
  bruno_aurelio@msn.com              0,0 d       1, no instante da criacao
  dacostavenicia@gmail.com           0,0 d       NUNCA RECEBEU NENHUM (NULL)

Cinco deles receberam EXATAMENTE UM link de recuperacao, no mesmo instante em
que a conta foi criada (diferenca medida entre created_at e recovery_sent_at:
menos de 0,3 s) — antes de existir qualquer motivo pra ele guardar aquele
e-mail — e nunca outro. Dois nunca receberam nenhum.

OS DOIS CASOS QUE PROVAM QUE ISSO DOI, e os dois sao pagantes
1) walsicleia_kaka@hotmail.com — #430, aberto pela Fast hoje 19:05Z, ja com 5
   ocorrencias. PAGOU R$ 936,15 (pagou_de_verdade.cjs: 2 avulsas COMPLETE de
   21/08 — "Sistema de Geracao Pronto" 639,15 e "Fabrica de Conteudo Invisivel"
   297). Escreveu pro suporte SEIS vezes entre 18:51Z e 19:36Z (uids 650, 651,
   652, 653, 654, 655), em caixa alta: "ja ta tudo ok MAIS NAO CONSIGO ENTRAR",
   "Senha coloco que esqueci e nao enviado nenhum codigo", "Nao ta enviado o
   codigo o que faco pra entrar". Voz e foto dela ficaram prontas em 11/09.
   Cinco dias com o produto pronto do outro lado de uma porta.
2) asbertoni@hotmail.com — #431, aberto pela fast-sgp hoje 19:28Z. PAGOU
   R$ 926,69 (2 avulsas APPROVED de 13/09, mesmos dois produtos). O onboarding
   dela rodou HOJE inteiro e com sucesso: 6 e-mails entre 18:41Z e 18:51Z, do
   "Comecamos a preparar" ate "Sua voz clonada ficou pronta". Quarenta minutos
   depois ela escreve que nao consegue entrar. O recovery_sent_at dela esta
   congelado em 13/09 10:46:33 — nenhum link novo saiu hoje.

DOIS ALUNOS INDEPENDENTES, 23 MINUTOS DE DIFERENCA, A MESMA FRASE. E o que
tirou isto da fila de atendimento e botou na fila de sistema: nao e o caso de
uma pessoa confusa, e o caminho de primeiro acesso nao existir.

O QUE ESTE CARTAO **NAO** AFIRMA (importante, pra ninguem consertar a coisa errada)
- NAO afirma que o disparo do "Esqueci a senha" esta quebrado. Suspeitei disso
  e NAO consegui provar: forgot-password-form.tsx:29 chama
  resetPasswordForEmail normalmente e ja trata o cooldown de 60s do Supabase
  (linha 38). O recovery_sent_at da Walsicleia nao mexeu entre 18:51Z e 19:34Z,
  o que É compativel com disparo falhando — mas tambem e compativel com o
  cooldown, e com ela nunca ter chegado na tela certa. Nao tenho auth.audit_log
  (a consulta devolve 0 linhas desde 12:00Z). Quem pegar este cartao: isso e
  hipotese a testar, NAO e achado.
- NAO afirma que os 10 sao todos pagantes bloqueados. Conferi DOIS. Os outros
  oito nao foram medidos um a um na Hotmart.
- NAO afirma nada sobre entitlement. Os 10 estao plan='free' com access_until
  NULL, e por isso caem no avisoOkMasAssine ("assine aqui"). Se esse free esta
  certo ou errado e assunto do #290 e do cartao que o Frank abriu hoje 19:52Z
  (onboarding_pronto_assine_ignora_entitlement) — NAO e deste. Este cartao vale
  igual nos dois cenarios: mesmo que a assinatura estivesse certa, o aluno
  continuaria sem senha.
- A pergunta "compra avulsa do SGP da direito a entrar na plataforma?" e
  decisao COMERCIAL do Johnny (armadilha #173, a propria ferramenta avisa).
  Por 27/08, decisao NAO vira chamado: foi pro grupo nesta ronda.

O DEFEITO DE TEXTO QUE PIORA TUDO
A Fast respondeu a Walsicleia (uid 652) "voce clicou em Esqueci a senha e o
CODIGO de verificacao nao chegou", e mandou ela esperar 5-10 min pelo reenvio.
Mas o produto nao manda codigo nenhum: forgot-password-form.tsx:29 manda um
LINK de redefinicao (redirectTo /auth/callback). A aluna estava esperando um
numero que nunca ia chegar, e a casa confirmou pra ela que o numero existe.

COMO REPRODUZIR / CONFERIR
  SELECT p.email, p.voz_pronta_em, u.recovery_sent_at
    FROM sgp_pedidos p JOIN auth.users u ON lower(u.email)=lower(p.email)
   WHERE p.status='pronto' AND u.last_sign_in_at IS NULL
   ORDER BY p.voz_pronta_em;
Devolve hoje 11 linhas (10 gente + 1 registro de teste .invalid).
Controle positivo: trocando IS NULL por IS NOT NULL tem que devolver 78 — se
devolver 0, o campo parou de ser preenchido e a medicao inteira e lixo.

O QUE EU NAO FIZ (14-A)
Nao respondi aluno, nao escrevi rascunho de carta, nao mexi em credito, nao
fechei nem reabri nada, e nao encostei no #430 nem no #431 alem de uma nota.
Este cartao nasce OPEN, com o diagnostico e sem uma linha de codigo escrita.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "vigia:primeiro-acesso-sem-porta-conta-criada-pela-casa",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 10,
    affected_emails: AFETADOS,
    reported_by: "vigia",
    first_seen_at: "2026-09-07T01:11:15.525Z",
    last_seen_at: agora,
    agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify(data[0], null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
