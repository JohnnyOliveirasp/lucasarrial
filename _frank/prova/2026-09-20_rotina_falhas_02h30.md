# Ronda das falhas — 20/09, ~02h30Z

Item serial: **#254 / `f1ada07e`** (cobrança em dobro, 15,3d, 15 e-mails na
lista, **`resolution_note` NULA desde 04/09**). **Não fechado** — e não fecha
por decisão que não é minha.

O que sobrou de verdade: **o Carlos é cobrado nas DUAS assinaturas daqui a 2
dias**, e a casa escreveu pra ele duas cartas que se anulam sem nenhuma das
duas frentes saber da outra.

---

## 0. Passos fixos

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`):
784 cartas lidas da pasta `Sent`, 707 já tinham linha, 77 fora da janela do
corte, **0 escrituráveis, 0 recusadas**. A contagem fecha (784 = 784). O
instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue PASSIVO.
(Ronda anterior: 776 lidas / 699 com linha. +8 cartas, todas já escrituradas.)

**Percepção travada** (ordem de 17/09): **2 cartões**, mais velho parado há
1,5d — os mesmos dois, nenhuma parada nova. `#450` já despachado e resolvido
como falso positivo do varredor; `#473` (Katia) espera a aluna ouvir o áudio
refeito. Espera legítima, com data.

**Placar:** 85 abertos (era 83) · 39 com 7d+ · 1 patch do Vigia · 118 recados.

---

## 1. Por que este card, e não o de cima da lista

A fila começa com quatro cartões mais velhos que o #254, e os quatro estão
parados em decisão que não é minha:

| cartão | idade | por que não move |
|---|---|---|
| #15 `d3d8d1b2` | 51d | itens (b) e (c) são decisão de produto, no grupo desde 17/09 |
| #226 `702cc916` | 18d | mesma decisão do #15 |
| #234 `f8587cef` | 17d | mesma decisão do #15 |
| #249/#250 | 15,4d | trabalhados na ronda anterior, propostas aguardando o "pode" |

O #254 é o quinto, **e era o único com `resolution_note` NULA** — o que na
varredura o faz parecer nunca olhado. Tinha 33 notas de trabalho real no
`agent_notes` e zero no campo que a triagem lê. Corrigido nesta ronda: o campo
agora diz, em texto curto, o que falta e de quem é.

Peguei-o pela exceção da regra 8 (dinheiro sendo cobrado errado agora).

---

## 2. O relógio, medido na Hotmart viva

`GET /subscriptions` por e-mail, produto 7851642, hoje:

| aluno | perna | status | próxima cobrança |
|---|---|---|---|
| **Carlos** | MY5O3KWB (órfã) | ACTIVE | **2026-09-22** |
| **Carlos** | UMJP7PDY | ACTIVE | **2026-09-22** |
| Leandro | J9HMYL9P | ACTIVE | 2026-09-28 |
| Leandro | 4XVSU9U7 | ACTIVE | 2026-09-30 |
| Nassara | ZKJBP56C | DELAYED | 2026-09-30 (retentativa) |
| Herineth | FKJBI6C2 | ACTIVE | 2026-09-21 (perna BOA, não é dobro) |

**As duas pernas do Carlos cobram no mesmo dia, daqui a 2 dias.** É o relógio
mais próximo do cartão.

A armadilha que este cartão já registrou vale aqui inteira: as duas vêm
`trial=true / "Plano Founder"`, e isso **não** quer dizer que não cobra — foi
exatamente o que a perna do Solon ensinou em 04/09. Entre as duas elas já
cobraram R$ 97 três vezes.

Remedição do cartão inteiro (`2026-09-17_cobrado_em_dobro_historico.cjs`, só
leitura): **cobrado em dobro = 4** (+ a conta de teste do Johnny, excluída pelo
método do próprio cartão). Lista **idêntica** à de 15, 16 e 17/09. Controle de
veredito passou (reencontrou Nassara, Leandro e Carlos). **Nenhuma vítima
nova.**

---

## 3. O achado: duas frentes da casa escreveram pro mesmo aluno coisas que se anulam

A nota de 16/09 deste cartão diz *"não escrevi a 3ª vez pro Carlos, não há fato
novo"*. Verdade sobre **mim**. Falso sobre **a casa**. Lido na pasta Enviados
hoje, o Carlos recebeu **quatro** cartas:

| quando | assunto | de onde |
|---|---|---|
| 04/09 | "qual das duas quer manter?" | este cartão (#254) |
| 08/09 | lembrete | este cartão (#254) |
| 17/09 | "falta criar a conta no FastCloner" | outra ronda (`origem=ronda-manual`) |
| 19/09 | "paga mas sem acesso, qual e-mail você usa?" | outra ronda (`origem=ronda-manual`) |

As duas últimas tratam a perna órfã pelo ângulo da **compra órfã** e oferecem
**criar/vincular conta** no `caplastica@`. Nenhuma das duas menciona que ele
paga duas assinaturas, nem a data 22/09.

**O estrago possível, e é concreto:** se o Carlos responder a carta de 19/09
pedindo a conta nova, a casa cria o segundo acesso, as duas assinaturas passam
a ser "legítimas" e a cobrança em dobro deixa de parecer defeito — vira plano.
Um trabalho desfaz o outro sem que nenhum dos dois saiba.

Não é culpa da ronda de 19/09: ela não tinha como saber. O cruzamento "quem já
escreveu pra este aluno" só existe pra resposta **humana** (`ja_falaram.cjs`) e
não pra carta que a **própria casa** mandou. Fica registrado como defeito de
processo, não como acusação — e é o mesmo formato do acidente do Rodrigo
(14/09), só que com a casa cega pra si mesma em vez de cega pro time.

---

## 4. A identidade do Carlos deixou de depender do nome

Com o `2026-09-20_contato_do_comprador.cjs` (ferramenta que nasceu na ronda
anterior, no #249), as duas transações do Carlos devolvem, no papel BUYER, o
**mesmo telefone** — lido do registro de quem vendeu, não do nosso banco.

O método deste cartão manda provar identidade por **campo independente, nunca
por nome**, e até hoje o par Carlos estava unido **só por nome**. Agora não
está mais. (O número não vai pro log nem pro grupo: dado pessoal.)

E tem consequência prática: **4 cartas sem resposta não significam aluno
inalcançável.** Existe segundo canal. Ligar é ação externa — proposto ao
Johnny, não feito.

---

## 5. O uso dele, remedido e não herdado

| conta | o que o banco diz hoje |
|---|---|
| `caplastica@hotmail.com` | **não tem perfil nenhum.** A perna que ele mais pagou (R$ 194: 13/08 + 28/08) nunca teve conta atrás |
| `gutoassuncao16@gmail.com` | 8 linhas em `credit_transactions`: 3 `subscription_grant` (22/07, 30/07, 28/08) e 5 gastos de imagem, **todos em 22/07**. 0 voz, 0 geração de vídeo, último login **22/07** |

**Corrijo a descrição deste cartão**, que diz "conta boa, 5 gastos" como se ele
estivesse usando: ele usou **um dia, há 59 dias**, e desde então paga duas
assinaturas e não entra. 300.000 créditos concedidos, 3.930 gastos.

---

## 6. O que eu fiz (fato consumado)

**Escrevi pro Carlos, nos dois endereços.** Cópias **confirmadas** na pasta de
enviados: uid **2953** e uid **2954**, chave `carlos-254-dobro-22set`, as duas
registradas em `emails_enviados`.

A carta: (a) dá a data 22/09 e os valores conferidos hoje; (b) diz que a perna
do `caplastica@` nunca teve conta e que os R$ 194 não compraram acesso, e que a
falha é nossa; (c) **desfaz explicitamente a armadilha da carta de 19/09** —
pede que ele leia esta antes de responder aquela, porque criar a segunda conta
resolveria o acesso e o deixaria pagando duas mensalidades pra sempre; (d) pede
a frase escrita pra cancelar uma, com a sugestão declarada como sugestão e a
decisão dele; (e) diz que **sem a frase escrita eu não cancelo nada**; (f) dá a
transação pra ele cancelar sozinho na Hotmart se não quiser esperar por mim;
(g) sobre reembolso diz a verdade: está em análise, sem valor e sem data
prometidos.

Postei no grupo, marcado como urgente, com as duas perguntas que precisam de
decisão.

---

## 7. O que continua travado, há 16 dias, e não é comigo

O **"pode" do Johnny pro reembolso** do duplicado (Carlos ~R$ 97 do dobro +
R$ 194 da órfã sem acesso, Nassara R$ 97, Leandro R$ 97, Herineth US$ 44) foi
pedido no grupo em **04/09 ~20hZ**. Hoje é 20/09. **Dezesseis dias.**

E **cancelar sem a frase escrita do titular** continua fora da minha alçada pela
9-C, mesmo com a cobrança marcada pra daqui a 2 dias.

Essas duas são as únicas coisas que faltam pro Carlos, e nenhuma é minha. É por
isso que o cartão não fecha, e escrever `fixed` nele seria mentira (regra 14).

---

## 8. O que eu NÃO fiz

Não cancelei assinatura, não estornei, não mexi em crédito, acesso, entitlement
ou plano de ninguém. Não liguei pra ninguém. Não escrevi pro Leandro (sem fato
novo desde 17/09; o relógio dele é 28–30/09) nem pra Nassara (a carta de 17/09
ainda está no prazo de resposta dela). Não gastei GPU, não apliquei migration,
não abri PR. Tudo na Hotmart por `GET` puro. Nada da planilha (ordem de 29/08).

---

## 9. Fim de ronda

`git fetch && git log --oneline origin/main..HEAD` — conferido, ver commit deste
log. A segunda metade do passo fixo (`git rev-list main..<branch>` em todo
branch) continua devolvendo 170+ branches por squash merge, como a ronda das
02hZ registrou: a pergunta útil é "o que EU escrevi nesta ronda ficou preso?", e
pra isso `origin/main..HEAD` basta. Esta ronda não abriu branch nem PR: as
escritas foram duas cartas, duas notas de incidente e este log.
