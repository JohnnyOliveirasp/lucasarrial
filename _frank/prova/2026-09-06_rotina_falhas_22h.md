# Ronda das falhas — 06/09, ~22hZ (19h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente, levei até o fim, e o motivo dele me entregou um defeito novo.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08) — o `/sgp` que aparece aqui é o módulo em produção
que **substituiu** a planilha, não ela. Canal: ordem de 31/08 — o aviso saiu no
**GRUPO**, nada foi pro privado.

---

## 0. A ronda em uma linha

**O nosso próprio e-mail de boas-vindas diz ao assinante que ele não tem a
assinatura que acabou de pagar — e os 8 alunos que nunca logaram uma vez sequer
são exatamente os que receberam essa frase enquanto já pagavam a plataforma.**

---

## 1. Qual incidente eu peguei, e por quê

Fila no início: **24 abertos**, 12 `aguardando_aluno`, 4 presos.

Pela regra 8 os mais antigos vêm primeiro, mas conferi antes de herdar: **#15,
#222, #226, #234** seguem presos em **decisão**, não em investigação. Reli o
`#222` inteiro (nota de hoje 14:50Z) e confirmo o diagnóstico dele: o passo que
emperra é DECISÃO do Johnny, e ele já pediu reenquadrar ou fechar. **#237**
segue bloqueado em identificação. **#246**, **#249**, **#250** e **#254** foram
tratados nas rondas de hoje.

Peguei o **#283** (`cced114f`) — 9 pagantes presos em zero crédito — porque
prioridade manda **aluno pagante** antes de limpeza de fila, e porque ele estava
com o trabalho todo feito e **sem ninguém pra assinar**: pela regra 14-A quem
fecha sou eu, e card resolvido que fica aberto é o "card imortal" que o próprio
#222 descreve.

## 2. Não aceitei a nota anterior como prova — medi de novo

O #283 chegou com a ronda das 15h dizendo "resolvido" e o Vigia dizendo
"conferido". **Isso não é prova pra quem assina.** O que eu mesmo rodei:

| o que | resultado |
|---|---|
| `6f153ac` está na main? | sim (`git branch --contains`) |
| `claim-guard.ts` faz o que diz? | li inteiro: 4 ramos, 3 sem tocar no banco, falha **fechada** |
| os 9 no banco | 9/9 `plan=pro`, 100.000 créditos, **1** grant e **1** ref_id cada |

## 3. A medição que ninguém tinha feito — e era o risco real

A deduplicação da RPC é por **(user_id, kind, ref_id)**. Isso protege contra
creditar a mesma pessoa duas vezes na **mesma conta** — e **não protege** contra
a mesma transação da Hotmart virar grant em **duas contas diferentes**. Que é
exatamente o cenário desta classe de aluno, porque vários **compram num e-mail e
entram noutro**. As duas conferências anteriores contaram "1 grant por
user_id" — a pergunta certa é por `ref_id`.

Rodei o detector cross-conta na tabela inteira (`subscription_grant` agrupado
por `ref_id` tendo `count(distinct user_id) > 1`): **zero linhas**. Nenhum
pagamento virou crédito duas vezes. E confirmei que `qooqi.criacoes@gmail.com`
— o e-mail que **pagou** — não tem conta própria, então o grant em
`gestao@qooqi.com.br` não duplica nada.

## 4. Refutei uma suspeita minha, medindo

Lendo o e-mail que os 8 receberam, vi que eles compraram o **Sistema de Geração
Pronto**, e o nosso texto diz que o SGP **não inclui** a assinatura da
plataforma. Se algum tivesse comprado só o SGP, os 100.000 créditos seriam
**produto dado de graça** — o erro na direção contrária, que ninguém procura.

Conferi um a um no `pagou_de_verdade.cjs`, que separa assinatura de avulsa de
propósito (o cabeçalho dele avisa: *"não colapse os dois fatos num bit só"*).
**Os 9 têm venda `assin.` do FastCloner paga** (COMPLETE/APPROVED). A concessão
está certa nos 9. Registro porque a suspeita era razoável e só a medição derruba.

## 5. O aluno que ninguém tinha tocado

`gestao@qooqi.com.br`: conta criada 21/07, `plan=pro`, **zero crédito por 47
dias**, assinatura de R$ 97 paga em 28/07 e 21/08. Caixa do suporte@ vazia nos
**dois** sentidos: nunca escrevemos, ele nunca escreveu.

**Ele não reclamou. Ele logou uma vez, em 21/07, e nunca mais voltou.**

Escrevi hoje (Sent **uid 1177**, cópia CONFIRMADA): o erro foi nosso, o crédito
já está lá, não há nada a pagar. Regra 8 pré-autoriza e-mail individual sobre
caso que estou tratando — não segurei esperando permissão.

## 6. #283 FECHADO

`status=fixed`, `resolved_commit=6f153ac`, `resolution_note` com o que o **banco
confirmou depois de gravar**, não o que o script planejava. Gravação conferida
na releitura: **1 linha afetada**, 4 → 5 notas.

Residual honesto, e ele **já tem dono**: 3 contas satisfazem a condição nova
permanentemente e chamam a consulta a cada page load — custo/latência, não
dinheiro, e é o **#284**.

---

## 7. O defeito novo: por que nenhum dos 8 tinha logado

Fechado o card, sobrou uma pergunta que ninguém tinha feito: **os 8 têm conta,
acesso e crédito há 2 dias — por que nenhum entrou?**

Fui ler o e-mail que eles receberam, na fonte (`EXAMINE` + `BODY.PEEK`,
read-only), uids **921** (max), **922** (cris), **852** (rmf174), **843**
(flavia), **841** (ruti). Os cinco carregam este parágrafo:

> *"IMPORTANTE: o Sistema de Geração Pronto é a montagem do seu clone pela nossa
> equipe. Ele **NÃO inclui a assinatura da plataforma FastCloner** — se você
> também quiser usar a plataforma para gerar os seus vídeos, ela é contratada à
> parte."*

**Os cinco têm assinatura FastCloner paga.** Nós dissemos a um assinante pagante
que ele não tem o produto que pagou.

### No código, não por dedução

`frontend/src/lib/payments/sgp-boas-vindas.ts:388-392`, em `montarBoasVindas()`.
O parágrafo está no corpo **fixo** do array. O `blocoAcesso` logo acima **é**
condicional (só entra se a conta acabou de ser criada); este **não tem condição
nenhuma** — a função nem recebe o dado que permitiria decidir.

### Por que isso atinge justamente quem paga

A assinatura é vendida como **order bump no mesmo checkout** do SGP. Provado
pelos pares de transação com sufixo `C1`/`C2` sobre a mesma base:
`HP1035474703C1`/`C2` (flavia), `HP3698277513C1`/`C2` (rmf174). Quem clicou no
bump recebe, dias depois, um e-mail nosso mandando contratar o que já pagou.

### A divisão não é aleatória — e é isso que fecha o caso

Lote de 04/09, **369 contas** criadas. Dessas, **15** têm assinatura FastCloner
ativa e paga. Das 15: **8 nunca logaram**, 7 logaram.

| grupo | `access_until` | leitura |
|---|---|---|
| 7 que logaram | **todos 11/09** | janela uniforme da restituição |
| 8 que nunca logaram | 13/09, 13/09, 19/09, 20/09, 20/09, 29/09, 30/09, 02/10 | derivado da **compra real** deles |

Os 8 são exatamente os que **já pagavam antes da conta existir** — de 2 a 22
dias antes, **102 dias somados** de assinatura paga sem porta pra entrar. São os
que mais precisavam do e-mail e são os que o e-mail mandou embora.

**Relógio:** `max@md2net.com.br` e `cris_evangelista22@hotmail.com` pagaram em
13/08 e o ciclo vence **13/09**. Se não entrarem até lá, terão pago um mês
inteiro de plataforma com **zero dia de uso** — e a Hotmart cobra o próximo
ciclo em cima disso.

Virou o **#290** (`446c3ae4`), com a medição inteira na `description`.

## 8. O conserto

Card **56be5c44** no Mission Board, dono **`coder`**: tornar o parágrafo
condicional (com assinatura ativa → texto oposto; sem → mantém o texto de hoje,
que está correto e existe por um motivo legítimo), **falhando fechado** se a
consulta de assinatura falhar, e virar as duas asserts do teste — que hoje
**cravam a frase incondicional** (linhas ~315 e ~568) — em teste dos dois ramos.
Branch `feat/290-...`, PR com base `main`, **sem merge**: quem revisa e mergeia
sou eu.

## 9. O que eu NÃO fiz

**Não escrevi aos 8.** É e-mail em **lote** e a regra 8 manda pedir o "pode" do
Johnny — diferente do caso individual do item 5, que eu disparei sozinho. O
texto está pronto; levei o pedido ao GRUPO. Enquanto não sai, os 8 seguem
pagando sem saber que têm.

Não apliquei migration, não mergeei PR, não mexi em crédito, acesso, plano ou
entitlement, não gastei GPU, não reabri nada, não toquei em nada da planilha.
Hotmart lida por GET puro; caixa por `EXAMINE` + `BODY.PEEK`.

## 10. Precisa de DECISÃO do Johnny

1. **Novo:** posso escrever aos **8** contando que já têm a plataforma e os
   créditos? Lote, texto pronto. Relógio de 13/09 em dois deles.
2. Seguem de antes: **#222** reenquadrar ou fechar (a medição de hoje sustenta
   fechar); **#226** destrava o #234; **migration 82** destrava o #15;
   WhatsApp para Glauber e Anderson (#249/#250); **PR #196** (18 vozes paradas)
   e **PR #176** esperando revisão. Relógios: **Diego 08/09 12hZ**,
   **Marcelo 11/09**.

## 11. As lições

**"Conferido" não é a mesma pergunta que "conferido do jeito certo".** Duas
instâncias contaram *1 grant por user_id* e as duas estavam certas — só que a
trava do sistema é por `(user_id, kind, ref_id)` e a classe inteira desses
alunos é gente que **compra num e-mail e entra noutro**. A pergunta que faltava
era por `ref_id` entre contas. Antes de assinar embaixo de uma conferência
alheia, olhe **de que chave** ela depende.

**Feche o card, mas não pare na causa que o card nomeia.** O #283 explicava por
que os 8 estavam sem crédito e não explicava por que nenhum tinha entrado. A
resposta não estava no banco: estava num parágrafo do nosso próprio e-mail. Um
aluno que não loga não é necessariamente um aluno desinteressado — **pode ser um
aluno a quem nós dissemos que ele não tem o produto.**

**E o silêncio continua sendo o pior sintoma.** O qooqi pagou 47 dias, viu uma
conta vazia, foi embora e não escreveu. Se dependesse de reclamação, ninguém
nunca teria achado.
