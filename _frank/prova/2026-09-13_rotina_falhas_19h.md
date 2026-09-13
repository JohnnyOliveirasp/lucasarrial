# Ronda das falhas — 13/09/2026, ~19hZ (16h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais as ordens de
**27/08** (só erro de sistema vira chamado), **29/08** (planilha desligada) e
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

**Item serial: `#249` / `132f7808` (Glauber).** Fechei **1** incidente (`#339`),
anotei **7**, e achei o canal que faltava pra classe inteira. O `#249` **não**
fechou, e o motivo está no §6.

---

## 1. Como escolhi, já que não peguei o mais velho da fila

A fila tem **81 abertos**. Conferi os três da frente antes de escolher, e os três
saem por motivo próprio — registro pra ninguém refazer a conta:

| card | idade | por que não |
|---|---|---|
| `d3d8d1b2` (#15) | 45,2d | **sem aluno esperando.** Última ocorrência 04/09, 19/19 estornados. A condição de fechamento escrita nele (falha nova ou 30 dias limpos a partir de 10/09) não foi atingida |
| `ce6e157d` (#47, Katia) | 25,3d | aluna avisada por e-mail na ronda das **17h**, com cópia confirmada. Pela regra 8 a bola saiu do meu colo |
| `6c38c99d` (#99, Luciano) | 21,1d | a ronda de 10/09 deixou **decisão com data**: o e-mail prometido sai em 16–17/09, 2–3 dias antes da cobrança de 19/09. Conferi a caixa hoje: a última palavra dele continua sendo 28/08 20:53. **Nenhum fato novo ⟹ herdo a decisão em vez de decidir de novo.** Escrever hoje seria a 13ª cópia da mesma escalação |

Sobrou o `#249`: **o mais antigo com aluno afetado onde a bola ainda é nossa.**

---

## 2. O que eu achei, e é a coisa que importa desta ronda

O `#249` carregava um pedido meu, de **04/09 17:25Z**, com estas palavras:
*"achar o e-mail real do aluno `glaubermed@ig.com.br` no cadastro/Hotmart e
reenviar o acesso hoje"*. **Ninguém executou. Nove dias.**

### 2.1 A pergunta do recado tem resposta, e é "não existe outro e-mail"

`glaubermed@ig.com.br` **é** o endereço real — é o que ele digitou no checkout e
é o que a Hotmart guarda (`buyer.ucode d3292fbf`). Ele só não recebe: `550 5.1.1
User unknown in virtual mailbox table`. Procurar "o e-mail certo" era procurar
coisa que não há. Conferido também que **não** existe segunda conta dele.

### 2.2 O que ninguém tinha perguntado: a Hotmart tem o TELEFONE

`GET /sales/users`, bloco `role: BUYER`, devolve o telefone do comprador. **Esse
dado nunca entrou no nosso banco**: `profiles.whatsapp` nulo, `sgp_pedidos` zero
linhas, e `payment_events` **zero linhas** — o desvio do SGP no webhook é de
03/09 e só passou a valer de 07/09 em diante (medido: Glauber, Anderson e Hamilto
têm **0** eventos; Sheila, Sunesa, Ulysses, Valdeni e Ollem têm **1**).

É por isso que a ficha de bounce era um beco sem saída. Ela guardava **um** dado
— o endereço que já se provou morto — e quem a pegasse só podia reenviar pro
mesmo lugar. **O canal vivo estava a uma chamada de API, e a chamada nunca foi
feita.**

### 2.3 A medição da classe inteira

Das **10 fichas de bounce abertas**, **8 têm telefone**. Sete são compradores do
SGP com o **mesmo desenho**, e o desenho é o achado:

| pessoa | SGP pago | parada há | logou? | pedido no portal? |
|---|---|---|---|---|
| Glauber | R$ 397,00 | 9,1d | **nunca** | **0** |
| Anderson | R$ 420,96 | 9,1d | **nunca** | **0** |
| Sunesa | R$ 597,00 | 6,3d | **nunca** | **0** |
| Renato | R$ 741,00 | 3,8d | **nunca** | **0** |
| Valdeni | R$ 741,00 | 3,3d | **nunca** | **0** |
| Ulysses | R$ 741,00 | 3,2d | **nunca** | **0** |
| Sheila | R$ 397,00 | 0,2d | **nunca** | **0** |

**7 de 7**: perfil criado, `last_seen_at` nulo, `sgp_pedidos` zero, `voices`
zero. **A esteira do SGP nunca deu o primeiro passo em nenhum deles**, porque ela
começa pela carta — e a carta quicou.

---

## 3. ⚠️ O número que eu recusei publicar, e por quê

Esses 7 pagaram **R$ 6.012,27** no total. **Não é esse o número que eu reporto**,
e a diferença é exatamente o erro que esta fila cometeu hoje de manhã.

A ronda das 18h quase reportou *"R$ 7.042 de pagante travado"* e se corrigiu
sozinha: **curso não dá plataforma** (regra comercial do Lucas, 31/08, obedecida
de propósito em `acesso-regra.ts`). "Sem acesso / 0 crédito" é o estado **certo**
de quem comprou curso.

Aplicando a mesma régua ao meu achado: dos R$ 6.012,27, a parte da **Fábrica de
Conteúdo Invisível** é curso entregue pela Hotmart — **não é dívida nossa**. O
que sobra, e o que **é** obrigação da casa, é o **SGP**, que é serviço que **nós**
entregamos:

> **R$ 4.034,96 em SGP, com a entrega parada em zero nos 7.**

É metade do número bonito. É o número verdadeiro.

O que torna isto **defeito nosso** e não "conta corretamente vazia": o SGP não é
acesso, é uma esteira que a casa opera, e o primeiro degrau dela é a carta com o
link de senha e o link do portal. Sem a carta, a esteira não arranca. Não é que
eles não tenham direito ao que não compraram — é que **não receberam o que
compraram**.

---

## 4. ✅ Fechado: `#339` (Hamilto)

**Não era defeito nosso, e digo isso com a linha do tempo inteira**, não com
impressão:

```
12:28:11Z  sgp_pedidos criado com o e-mail CERTO (id 12841e0c)
12:28:17Z  quica o código mandado pro e-mail ERRADO (falta um "n")
12:29:10Z  email_verificado_at no e-mail certo
19:29:14Z  enviado_em — material entregue · status "pronto"
13/09      last_seen_at — ele entrou HOJE
```

O aluno digitou errado, **se corrigiu 53 segundos depois** e concluiu o fluxo.
Compra bate na Hotmart no endereço certo (R$ 914,97).

**`ignored`, não `fixed`** — não houve conserto nosso. O sistema se comportou
certo: recusou entregar a endereço inexistente e o portal deixou ele corrigir.
Marcar `fixed` seria a casa levar crédito por trabalho que não fez (regra 14).

⚠️ E **não foi a semelhança do e-mail que fechou o card.** "Endereço parecido não
é identidade" é regra fixada ontem mesmo. O que autoriza a conclusão é o **pedido
SGP completo, verificado e entregue no endereço certo**, com a compra batendo.
A semelhança sozinha não teria fechado nada.

---

## 5. Ferramenta nova: `contato_hotmart.cjs`

Read-only. Lê as fichas de bounce abertas e pergunta à Hotmart viva **qual canal
sobra**. Três decisões de desenho que valem registro:

1. **Controle positivo obrigatório, e ABORTA se ele zerar.** *"Nenhum aluno tem
   telefone"* é a mentira mais cara que ela poderia contar. Zero de instrumento
   cego já enganou esta casa em 07/09, e outra vez **ontem** (coluna `credits`
   inexistente devolvendo "SEM CONTA" pra 11 alunos).
2. **Não adivinha endereço**, de propósito. Trocar domínio parecido é o palpite
   que entrega a compra de um pagante na caixa de outra pessoa.
3. **Só o bloco `BUYER`.** O bloco `PRODUCER` é o telefone da casa — confundir os
   dois faria a ferramenta oferecer o número do Johnny como se fosse o do aluno.

---

## 6. ❌ Por que o `#249` NÃO fecha

**Achar o canal não é falar com o aluno.** Ligar ou mandar WhatsApp é ação
externa em nome da casa e não é minha alçada sozinho — o mesmo limite que me
impediu de escrever pra Sheila na ronda das 18h.

O card fecha quando o Glauber tiver **o acesso dele na mão**, não quando eu
souber o número dele. Foi ao grupo nesta ronda com o pedido de aval.

Prefiro um card aberto e honesto a um card fechado com *"canal identificado"* —
isso é movimento fabricado, e é o que a regra 14 proíbe.

---

## 7. Placar honesto

- **Incidentes fechados: 1** (`#339`, com linha do tempo, não com impressão).
  Fila: **81 → 80**.
- **Fichas que deixaram de ser beco sem saída: 7** — cada uma agora carrega o
  telefone, a compra e o estado medido, em vez de só o endereço morto.
- **Ferramenta nova: 1**, com controle positivo que aborta.
- **Código em produção: 0.** Não subi nada: o que falta nesta classe é uma
  palavra sobre canal externo, não linha de código. Fabricar um PR pra encher o
  placar seria pior do que o zero.
- **Alunos escritos: 0** — os 7 alcançáveis só o são por telefone, e isso depende
  do aval. O único e-mail que eu poderia mandar sozinho (Luciano, `#99`) tem data
  marcada pra 16–17/09 e mandá-lo hoje seria ruído.
- **Número inflado que eu peguei antes de publicar: 1** (R$ 6.012,27 → **R$
  4.034,96**), aplicando em mim a correção que a ronda das 18h aplicou nela mesma.
- Crédito de aluno: **0**. GPU: **0**. Migration: **0**.

**O que emperrou, na cara limpa:** sete pessoas que pagaram continuam sem o que
compraram enquanto eu escrevo isto. Eu achei o caminho até elas e **não posso
percorrê-lo sozinho**. Isso não é vitória — é um bloqueio a menos e uma espera
que continua.

**O que eu NÃO fiz:** não liguei nem mandei WhatsApp sem aval, não reenviei carta
pra endereço morto, não "consertei" e-mail de aluno, não fechei incidente sem
resolver, não mexi em crédito/acesso/assinatura, não gastei GPU, não mergeei
branch STALE, não li a caixa do `suporte@` pra triagem (só varredura de bounces
em `EXAMINE` + `BODY.PEEK` e a thread do Luciano, que é o caso que eu tratava), e
não inventei causa pra parecer produtivo.

---

## 8. Passo fixo de fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` saiu **vazio** — o log
desta ronda está na `main` (`55628b3`), não preso em branch. Nenhum fix meu ficou
para trás.

**O que o passo achou, e que eu deliberadamente NÃO mergeei:** o **PR #263**
(`feat/laco-bounce-message-id`, *"casa o e-mail que voltou com o envio, pelo
Message-ID"*) está aberto, `MERGEABLE`/`CLEAN`, e é **exatamente** a metade viva
do `#101` — o laço que faz o bounce voltar a apontar pro envio.

Ele **não** é o caso do PR #260 de ontem, que ficou 3h20 esquecido. Foi criado às
**18:43Z**, três minutos antes de eu começar. Não está parado: está fresco.

Não mergeei de propósito, e o motivo é a armadilha registrada ontem nesta mesma
fila: *"suíte verde de branch errada é pior que suíte vermelha"*. Eu não rodei os
testes dele no worktree certo, e mergear código de entrega de e-mail que eu não
verifiquei — no dia em que descobri 7 pessoas sem receber carta — seria o tipo de
pressa que cria o próximo incidente. **Fica anotado como próximo da fila, não
como pendência esquecida.**

Também registro, sem tratar: há **30 PRs abertos**, o mais velho de 28/08. Não é
dívida desta ronda e não cabia nela, mas é grande demais pra continuar invisível
no relatório.
