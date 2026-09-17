# Ronda das falhas — 17/09/2026, ~13hZ (10h BRT)

Dono da fila (14-A). **Fechei um incidente**: o `#306` (`18bf275c`), com o
conserto em **produção** (deploy SUCCESS), a **aluna afetada avisada** por carta
com cópia conferida, e a perna que sobrou separada num cartão próprio com dono.

Ordens lidas antes de tocar em qualquer coisa: `_frank/ordens/README.md`, a de
**29/08** (planilha desligada) e a de **31/08** (canal). **Nada da planilha foi
lido, escrito, classificado ou reprocessado.** Avisos no **grupo**, com
`notify-grupo.sh`.

---

## 1. Qual item peguei, e por quê

A regra 8 manda o mais velho **com aluno afetado**. Os de cima estão presos em
decisão que não é minha, e isso foi conferido hoje, não herdado:

| cartão | idade | onde trava |
|---|---|---|
| `#15` `d3d8d1b2` | 49,0 d | risco aceito pelo Johnny; só reabre se voltar |
| `#99` `6c38c99d` | 24,8 d | resposta comercial do Johnny/Lucas |
| `#226` `702cc916` | 15,8 d | decisão de produto |
| `#234` `f8587cef` | 14,9 d | espera aval de GPU |
| `#249`/`#250` | 12,8 d | classe de bounce: falta o "pode" pra WhatsApp/ligação |
| `#254` `f1ada07e` | 12,7 d | cancelar/estornar é 9-C, e falta a palavra escrita do titular |
| `#263` `5c68eb33` | 12,0 d | tudo que era meu está feito; falta a definição de R$ 97 do Johnny |

Peguei o **`#306` `18bf275c`** porque ele é a exceção no meio dessa fila: o
conserto estava **nomeado, determinístico e inteiramente na minha alçada** desde
**08/09** — a nota 8 do próprio cartão escreveu a receita — e **ninguém encostou
por 9 dias**. Não depende de aval, não depende de aluno responder, não gasta
dinheiro. Só faltava fazer.

---

## 2. Antes de trabalhar o `#306`, matei uma pista minha no `#254`

Levantei a hipótese de que o **Carlos Augusto** não responde porque as duas
cartas teriam ido só pro endereço **órfão** (`caplastica@hotmail.com`), onde ele
não tem conta. Se fosse verdade, escrever pro endereço que ele **usa** era ação
minha, hoje, sem aval de ninguém — e o relógio dele vira em **22/09**.

Fui à fonte em vez de supor: `ler_caixa --enviados --para gutoassuncao16@gmail.com`
devolve **2 cartas, uid 1035 (04/09) e uid 1296 (08/09)** — as mesmas duas,
mandadas **também** pro endereço vivo. **Hipótese refutada.** Ele recebeu nos
dois endereços e não respondeu. A decisão de 16/09 de não escrever uma terceira
vez fica de pé, agora por medição e não por herança.

---

## 3. O defeito do `#306`, e por que ele é caro apesar de ser **um** caso

`orphan-outreach.ts` decide quem recebe *"crie sua conta com EXATAMENTE este
e-mail"*. A guarda `hasAccount` perguntava com `.in("email", chunk)` — igualdade
de **string**. O Gmail **ignora o ponto** no nome e ignora tudo depois do `+`.

Cruzei **todos** os `buyer_email` contra **todos** os e-mails de `profiles` pela
chave normalizada. Voltou **exatamente 1 par vivo**:

```
compra  herysilva.27@gmail.com   (PPEVZBRG, user_id NULL)
conta   herysilva27@gmail.com    (profiles 2f0e5cf8, plan pro, criada 21/07)
```

Um caso. O que o torna caro não é o número, é o que a casa fez com ele — e isso
eu não deduzi, fui ler na pasta de Enviados, com uid:

| quando | o quê |
|---|---|
| 07/09 07:07Z | a casa **cancela** a PPEVZBRG por ser a duplicada |
| 07/09 07:09Z | uid 1196 — carta nossa: *"você pagou US$22 numa assinatura duplicada (já cancelada)"* |
| 07/09 10:43Z | uid 1203 — correção nossa: *"são US$44, não US$22"* |
| 08/09 14:00Z | uid 1319 — **robô**: *"crie sua conta usando EXATAMENTE este e-mail: herysilva.27@gmail.com"* |
| 12/09 14:00Z | uid 1966 — **robô**: *"seus créditos continuam reservados, intactos, esperando por você"* |

**27 horas** depois de escrever pra ela que aquela assinatura era duplicada e já
estava cancelada, a casa escreveu **pra mesma caixa** mandando ativar
exatamente aquela assinatura. E repetiu 4 dias depois. A nota 9 de 08/09 tinha
**previsto** isso ("o lembrete vai reescrever pros mesmos em ~11/09"). Aconteceu,
e agora está com data e uid.

---

## 4. O conserto, e a prova que vale

Card `2422765a` no Mission Board → `coder` → branch
`feat/orfa-hasaccount-alias-gmail` → **PR #327** → merge **`ab8ffc9`** na main →
workflow *Deploy Frontend (production)* run **35224364008 = SUCCESS**.

Conferido **na main**, não no PR: `git merge-base --is-ancestor 9c44e9f
origin/main` = SIM, `email-normalizado.ts` existe em `origin/main`, e
`.in("email"` só sobrou em **comentário**.

A regra é **deliberadamente conservadora**: só normaliza local-part em domínio do
Google. Fora dali, o ponto distingue **pessoas diferentes**, e fundir errado
**calaria um órfão de verdade, pagando sem acesso** — que é o dano **pior**. O
teste `'a.b@outlook.com' != 'ab@outlook.com'` existe pra impedir o conserto de
virar dano.

Rodei a função **de produção** contra o banco vivo, só leitura:

```
profiles paginado até o fim:      2721 linhas
entitlements paginado até o fim:  1317 → 1309 compradores distintos
regra VELHA (string crua) vê herysilva.27@ como quem já tem conta?  FALSE  <- o defeito
regra NOVA  (normalizada) vê?                                       TRUE   <- o conserto
DELTA (quem a nova reconhece e a velha não):  1  → herysilva.27@ → herysilva27@
COLISÕES introduzidas pela normalização:      0  (2721 crus → 2721 chaves)
```

**O par que importa é `delta=1` com `colisão=0`**: pega o caso pretendido e não
funde mais ninguém. E os **2721** não são decoração: são **mais que o teto de
1000** do PostgREST — sem paginar até o fim, 1.721 contas ficariam invisíveis e
virariam "órfão". Foi exatamente o `72a4c9db`.

---

## 5. A minha própria prova mentiu primeiro, e o controle pegou

A primeira rodada devolveu **`DELTA: 0`** — o que teria virado *"o conserto não
muda nada"*.

Era cegueira do **meu** instrumento: li `entitlements` com um `.select()` **sem
paginar**, e o PostgREST cortou em **1000 de 1317**. A herysilva estava fora do
corte. Só descobri porque o controle positivo **exigia** que ela aparecesse no
delta, e ele falhou.

É o **teto de 1000 pela terceira vez na mesma família de código**: `c5f67bd`
(produção, 08/26), este cartão, e agora a minha sonda.

---

## 6. Defeito de processo que peguei nesta ronda (nosso, não do código)

O `coder` gravou o commit `9c44e9f` **com a `main` checada no worktree
principal** e só depois criou o branch. A **main local ficou 1 commit à frente
da origin**. Se eu tivesse commitado o log da ronda por cima, esse código
entraria na main **fora de PR**.

Desfeito com `git reset --hard origin/main` **depois** de conferir
`git branch -r --contains 9c44e9f` (o commit já estava no origin, no branch do
PR — o reset não perdeu nada).

É a **prima** da armadilha de 19/08: lá o código não **chegava** na main; aqui
chegava **sem passar pelo portão**.

---

## 7. A aluna, avisada

Carta pra **`herysilva27@gmail.com`** (o endereço da conta que funciona) —
Enviados **uid 2624**, cópia **CONFIRMADA** na 1ª tentativa. Ela: (a) manda
ignorar os e-mails de 08/09 e 12/09 e **não criar conta nenhuma**; (b) explica o
defeito com todas as letras — o robô compara letra por letra e não sabe que o
Gmail ignora o ponto; (c) confirma qual é a conta boa e que o acesso vai até
21/09, com *"Esqueci minha senha"* em vez de link que expira; (d) mantém **sem
mudar uma vírgula** o discurso de 07/09 sobre os US$ 44 pela Hotmart, sem
prometer data nem valor.

---

## 8. Achado lateral: existe uma 5ª vítima de cobrança em dobro que o detector não enxerga

Trabalhando o `#306`, a Herineth apareceu também como **caso de cobrança em
dobro** — e o instrumento do `#254` **não a mostra**. Medido na Hotmart viva:

```
PPEVZBRG <herysilva.27@gmail.com>  0 USD 21/07 ; 22 USD 18/08 ; 22 USD 30/08
FKJBI6C2 <herysilva27@gmail.com>   0 USD 21/07 ; 22 USD 28/07 ; 22 USD 30/08
```

**US$ 88 pelo mesmo produto**, dos quais **US$ 44 são duplicata** — e em **30/08
ela foi cobrada duas vezes no mesmo dia**. (Ela já foi avisada em 07/09; quem a
achou foi uma ronda na mão, **não** o detector.)

Duas cegueiras independentes, com arquivo:linha:

1. `assinatura_em_dobro.cjs:76` filtra `.eq("status","active")`. Basta **uma**
   perna do par ser cancelada pro par sumir — mesmo com o dinheiro duplicado já
   cobrado e nunca devolvido. Hoje ele detecta *"AINDA está cobrando em dobro"*,
   não *"FOI cobrado em dobro"*. O próprio docstring dele (linhas 34-37) manda
   **não** concluir por `entitlements.status` — e é por aí que ele filtra.
2. Mesmo sem esse filtro, o `agrupar()` (union-find por CPF **ou** telefone
   **ou** nome) **não juntaria** as pernas dela: `document` vazio numa e
   `00208628LA014` na outra, telefone `NULL` nas duas, e os nomes normalizam
   diferente (`herineth silva` × `HErineth Maria Lima da Silva`). O **único**
   campo que junta as duas é a chave normalizada de Gmail — **a mesma
   normalização que faltava na produção**.

Varri sem o filtro de status e achei **8 pares** com pelo menos uma perna
não-active que o detector não mostra hoje. **São CANDIDATOS, não vítimas:** não
conferi na Hotmart se as duas pernas de cada par foram **pagas**, e trial não é
cobrança (`#138`). E a própria sonda tem o vão (2) acima — **a Herineth não está
entre os 8**. Então **8 é piso, não teto**, e ninguém deve escrever "são 8" antes
de medir par a par na Hotmart viva. Tudo anotado na nota 32 do `#254`.

> `PAGANDO EM DOBRO: 4` nunca foi o número de quem **foi** cobrado em dobro; é o
> número de quem **ainda está**. O dinheiro represado mora na diferença.

---

## 9. O que fechei, o que abri, e o que deixei explicitamente de fora

**Fechado — `#306` `18bf275c`**, `resolved_commit = ab8ffc9`, com as duas pernas
do cartão em produção (dedupe cíclico pelo PR #212 em 08/09; alias de Gmail pelo
PR #327 hoje) e a aluna avisada.

**Aberto — `#450`**: a perna que **sobrou** e que o conserto de hoje **não**
cobre — cliente ativo que usa **outro endereço de verdade** (não alias). Caso
vivo medido hoje: **Jackson**, `6VHWPHB9 <jkakorio@hotmail.com>` (user_id NULL,
canceled com `access_until` **19/09, futuro**) e a conta dele em
`jkakoalves@gmail.com`, plan pro. As três guardas o deixam passar.

Abri cartão **próprio** porque o `#222`, que era o dono do casamento por
identidade, está **FIXED** — apontar uma perna viva pra cartão fechado é o jeito
clássico de dano vivo sumir. Declarado com a ressalva: a 6VHWPHB9 está cancelada
e o dedupe agora é **por cobrança**, então o disparo provavelmente **não** se
repete sozinho pra ele; o que está medido é que a **guarda** não o protege.

**Fora da conta, conferido:** `alinecuida@gmail.com` não é caso vivo (KG6OG420 já
tem `user_id`, e o acesso venceu em 10/09). O alcance por **produto** (SGP
7283229) segue no `#312`.

---

## 10. O que eu NÃO fiz

Não mexi em crédito, acesso, entitlement nem assinatura de ninguém. Não cancelei
e não estornei nada. Não escrevi pro Carlos Augusto, Nassara nem Leandro. Não
liguei nem mandei WhatsApp. Não gastei GPU. Não apliquei migration — **este
conserto não tem DDL**, então não há coluna nova pra conferir no banco. Não
mergeei nenhum dos branches stale do origin. Não li a caixa do `suporte@` pra
triagem. Não toquei em nada da planilha.

---

## 11. Lição

**Conserto sem controle é opinião; e o controle tem que morar no instrumento, não
na minha atenção.**

Hoje o mesmo par de perguntas decidiu tudo, duas vezes:

- *"o conserto pega o caso?"* → `delta = 1`, e é exatamente a herysilva.
- *"o conserto atropela alguém?"* → `colisões = 0`, 2721 crus → 2721 chaves.

Sem a **segunda**, eu teria subido uma normalização que poderia fundir caixas e
**calar um pagante órfão** — que é o dano pior, o que ninguém reclama porque a
pessoa nem fica sabendo que existia um e-mail pra ela.

E a parte que dói: a **primeira** rodada da minha prova disse `DELTA: 0`. Um
número redondo, tranquilizador e **falso**, produzido pelo teto de 1000 que esta
casa já documentou duas vezes **neste mesmo arquivo**. Saber da armadilha não me
protegeu; o que me protegeu foi ter pendurado no instrumento uma **resposta
conhecida** que o obrigava a falhar alto.

É a lição de ontem (*"o instrumento provou, nesta execução, que enxerga?"*) com
um degrau a mais: **um instrumento que só sabe achar não sabe dizer que não
achou.** `assinatura_em_dobro.cjs` não está errado — ele responde com precisão a
uma pergunta (*"quem ainda está pagando duas vezes?"*) que **não é** a pergunta
que a casa acha que está fazendo (*"quem foi cobrado duas vezes?"*). Ninguém
mentiu. O relatório só respondia outra coisa, e o dinheiro de quem já foi cobrado
morava no espaço entre as duas perguntas.
