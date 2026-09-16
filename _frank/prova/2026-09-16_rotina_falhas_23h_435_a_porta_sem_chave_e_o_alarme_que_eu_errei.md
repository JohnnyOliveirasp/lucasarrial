# Rotina das falhas — 16/09 23h

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Item serial:** **#435** (`6e1404ef`) — **FECHADO** (`fixed`, `resolved_at`
21:56:01,389Z), mais **#430** e **#431** fechados junto (mesma causa, mesmos
alunos). **Aberto:** #438. Fila: **90 → 88 abertos**.

**10 de 10 alunos servidos, e 10 de 10 eram PAGANTES.**

---

## 0. Por que este item, e não o mais velho

O mais velho da fila é o `#15` (48,4 d) e ele **continua sendo o mais velho** —
não peguei. Os três da frente não tinham próximo passo na minha mão:

| cartão | idade | por que não era ele |
|---|---|---|
| `#15` `d3d8d1b2` | 48,4 d | fecha por 30 dias limpos ou ocorrência sob a régua nova. Relógio corre |
| `#99` `6c38c99d` | 24,2 d | decisão comercial Johnny/Lucas, pedida em 24/08 |
| `#226` `702cc916` | 15,2 d | trabalhado na ronda das 15h de hoje |
| **`#435`** `6e1404ef` | 9,9 d | ← **peguei este** |

A regra 8 manda pegar o mais antigo **com aluno afetado**, e a de prioridade
manda pôr **aluno pagante travado sem solução** na frente da limpeza da fila.
O `#435` tinha os dois: gente que pagou, com o produto pronto, do lado de fora
da porta — e **dois deles escalaram hoje, com 23 min de diferença, dizendo a
mesma frase**. O Executor tinha escrito às 20:26Z que acionaria alguém se não
houvesse push até a próxima ronda. Houve.

## 1. O defeito, em uma frase

A casa cria a conta do aluno do SGP (`auth.users` nasce com `email_confirmed_at`
no mesmo instante — ele nunca escolhe senha) e depois manda os três e-mails de
fim de onboarding dizendo só **"Acesse: fastcloner.com/login"**. Para uma conta
que o aluno criou, isso é correto. Para a conta que a **casa** criou por ele, é
uma porta trancada: a única saída era ele adivinhar sozinho que precisava pedir
"Esqueci a senha" de uma senha **que nunca existiu**.

## 2. 🔴 O alarme que eu levantei e eu mesmo derrubei

Este é o fato mais importante da ronda, e ele é contra mim.

Achei a causa em 20 minutos: o mailer de auth do Supabase está em Resend com
remetente **do domínio da marca antiga** — exatamente o canal que o cabeçalho do
nosso próprio `enviar_email.cjs` proíbe pra falar com aluno (*"queima a
confiança, já aconteceu na frente de cliente"*). A história fechava sozinha: a
única porta do aluno passava justamente por onde a casa mandou não passar.

**Postei isso no grupo como manchete. E estava errado.**

Antes de escrever uma linha de código eu fui medir se o canal entregava. Parti
`auth.users` por `(recovery_sent_at - created_at) < 10s`:

| grupo | total | entraram depois | % |
|---|---|---|---|
| pediu o reset **por conta própria** | 77 | 46 | **59,7%** |
| carimbado no **instante da criação** | 536 | 35 | **6,5%** |

**Seis em dez** de quem clica em "Esqueci a senha" entra. O canal entrega. O
remetente não é o motivo de ninguém estar travado — é dívida de confiança de
marca, assunto separado.

Corrigi no grupo na hora, antes de qualquer commit. O alarme errado está
registrado **dentro do código** (`avisos.ts`) e nos dois cartões, pra ninguém
queimar outra ronda nessa pista.

O que me salvou foi a ordem das coisas: **medir antes de consertar.** Se eu
tivesse ido direto pro conserto "óbvio", teria mexido em config de auth de
produção às 23h atrás de um problema que não existe — e a porta continuaria
trancada.

## 3. O que os números dizem de verdade

Mesmo canal, mesmo remetente, mesmo template nos dois grupos. A única variável
que muda é **quando** o e-mail chega em relação à intenção do aluno.

> A casa gasta a única chave do aluno numa hora em que ninguém está olhando, e
> depois nunca mais diz a ele que precisa criar uma senha.

## 4. O conserto (em produção)

**PR #318** → merge **`5dc5dc1`** → deploy production **SUCCESS**
(run 35154606913, conferido `completed/success`, não suposto).

Os **três** caminhos passam a carregar o parágrafo de criar senha:
`pronto.ts` (`EMAIL_TEXTO` e `EMAIL_TEXTO_SEM_IMAGEM`) e `avisoOkMasAssine`
(`avisos.ts`).

Decisões que valem registro:
- **Constante única** exportada do `avisos.ts` (módulo de baixo) e importada
  pelo `pronto.ts`. Cópia da regra em dois arquivos foi o que abriu o vão do
  `#351` — aqui não se repete.
- **`/forgot-password`, não link de recuperação embutido.** O token do Supabase
  vale 1 h e este e-mail é lido quando o aluno pode, não quando a casa mandou.
  Link que expira no travesseiro recria o mesmo problema.
- **URL conferida viva** (`curl -L` → **200**) antes de entrar na carta. Não
  mando aluno pra link que eu não abri.
- `tsc --noEmit` **0 erros**; `src/lib/onboarding/*.test.ts` **92 passando**.

## 5. Os alunos — 10 de 10, e todos pagantes

O cartão tinha conferido **2** pagantes. Eu conferi os **10** com o
`pagou_de_verdade.cjs`: **todos pagaram**. Não sobrou ninguém "de graça" na
lista. Um deles, R$ 2.734,89.

Carta individual com link de primeiro acesso, pelo **SMTP do suporte@**, cópia
**confirmada na pasta de enviados** — uids **2584 a 2593**.

Ferramenta nova: `_frank/ferramentas/2026-09-16_porta_de_entrada_sgp.cjs`. Gera
o link pelo admin (`generateLink` — **não** dispara e-mail) e entrega pelo canal
que tem ficha de bounce. Tem **controle positivo que ABORTA** se
`last_sign_in_at` parar de ser preenchido, porque "zero" de instrumento cego já
fez esta casa reportar bobagem antes.

### O ensaio que pegou um erro meu antes de chegar no aluno

O `--dry-run` da primeira carta saiu com **"Olá, walsicleia!"** — o campo `nome`
do pedido dela é o próprio e-mail (a armadilha do `#338`, `processar.ts:87-94`
aceita qualquer coisa com 3+ chars). Meu primeiro filtro só barrava nome com
`@`. Apertei o filtro (local-part, prefixo, ponto/underline/dígito) e **as 10
cartas saíram sem nome quando havia dúvida**. "Olá!" não ofende ninguém; "Olá,
walsicleia_kaka" avisa a pessoa que a casa não sabe quem ela é.

**Ensaio não é entrega — mas ensaio é o que impede a entrega errada.**

## 6. O que eu NÃO afirmo

- **NÃO afirmo que os 10 já entraram.** Afirmo que a carta com o link saiu e
  está confirmada na caixa de enviados. Conferir o desfecho:
  `2026-09-16_porta_de_entrada_sgp.cjs --listar` — quem sumir da lista, entrou.
- **NÃO confirmei nem descartei** a hipótese do cartão de que o disparo do
  "Esqueci a senha" esteja quebrado. A Walsicleia **teve** `recovery_sent_at` às
  19:34Z (o disparo aconteceu — a nota original dizia "congelado", e isso estava
  errado) e mesmo assim não entrou. **Um caso não decide nada.**
- **NÃO decidi nada sobre entitlement/plano** dos 10 (todos `plan='free'`). O
  que a compra avulsa dá direito é decisão **comercial** do Johnny (armadilha
  `#173`) — foi pro grupo, não vira chamado.

## 7. Aberto: #438

O carimbo na criação (os 536 com 6,5%) é defeito **próprio e maior** que o #435,
e o #435 **não** o corrige. Abri cartão separado em vez de deixar o #435 aberto
pra sempre. Ele não tem conserto óbvio — há pelo menos três caminhos e a escolha
tem consequência de segurança, que não é coisa pra decidir às pressas dentro de
uma ronda.

## 8. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` → vazio.
Branch `fix/435-primeiro-acesso-cria-senha` apagado no merge. Nada preso.
