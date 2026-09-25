# Ronda das falhas — 25/09, ~01:40–02:10Z

**Item serial (regra 8):** o **#350** (`3a9a4854`) — *"A casa só olha a garantia
quando vai responder, nunca enquanto o pedido espera na fila"*, parado **11,1d**,
**3 alunos**.

**Entreguei conserto em produção**, conferido no servidor. **Não fechei o
cartão**, e o passo que emperrou está nomeado no fim.

Por que não peguei o mais abandonado que o instrumento escolheu (`#380`, 11,1d):
ele está **`aguardando_aluno`** — o aluno foi respondido duas vezes, com medição,
e a ordem de 21/08 diz em letra que *esperar resposta de aluno não é estar
travado; o item saiu do seu colo*. Na mesma idade, o #350 tem **3 alunos** contra
1, e é a **causa sistêmica** do dano que a ronda anterior mediu: 5 alunos que
perderam a janela de garantia em silêncio.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1266 lidas · 1189 já tinham linha · **0 escrituráveis**. Fecha **1266 = 1266**. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | Veredito: **0 carta depois do corte** fora da tabela. Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho **0d**. Controles ± OK, **551** varridos. |
| `2026-09-24_escolher_o_abandonado.cjs` | **158 abertos** (open 12 · investigating 110 · aguardando_aluno 36) · 147 com aluno nomeado · mais abandonado **11,1d**. |
| `2026-09-22_esperando_johnny.cjs` | **20 cartões** parados em decisão dele · **60 alunos** · mais velho **23d**. Inalterado. |

As **77 cartas** anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — continua decisão de produção, não de ronda.

> Rodei tudo de clone **sincronizado com a `origin/main`** antes de medir. A
> armadilha que a ronda anterior registrou contra si mesma (ferramenta rodada de
> clone velho devolve número menor e plausível, sem quebrar e sem avisar) foi a
> primeira coisa que eu tirei do caminho.

---

## 2. O conserto: a hora do prazo parou de ser jogada fora

### 2.1 O defeito estava medido há 11 dias, com `arquivo:linha`, e ninguém pegou

O Vigia escreveu no #350 em **14/09 00hZ** que `diaBR()` **joga a hora fora** e
que o tempo restante (`fim - agora`) estava **calculado e descartado**. Pediu por
escrito: *"marquem como conserto PRÓPRIO"* — porque o varredor de fila que o
cartão pede pode ser construído inteiro e a resposta da Fast **continuaria**
dizendo "vai até 13/09" pra quem tem meia hora. São dois consertos na mesma
porta; um não arrasta o outro.

Ficou 11 dias parado. A perna de código que faltava era essa.

### 2.2 O caso real, medido antes de eu tocar em nada

Caixa de Enviados, **uid 2164**. `evelyn.cheida@gmail.com` escreveu *"REEMBOLSO
DOS 2 PRODUTOS"* e recebeu da casa *"a garantia informada pela Hotmart vai até
13/09 — ou seja, você está dentro do prazo"*.

```
fim  = 2026-09-14T00:00:00Z  = 13/09 21:00 BRT
ela  = 2026-09-13T23:30:13Z  = 13/09 20:30 BRT, domingo
       faltavam 29m47s  ->  ~30 MINUTOS
```

Frase **verdadeira**, impressão **falsa**. `"vai até 13/09 · hoje é 13/09 →
DENTRO"` lê como *"você tem o dia"*. Eram 30 minutos, num domingo às 20h30. Ela
perdeu a janela.

### 2.3 O que está no ar (PR #441, squash `1a8fad41`)

- **`instanteBR()`** imprime o **mesmo instante com a hora**. De quebra explica o
  *"um dia mais cedo"* que o comentário do `diaBR` já documentava, em vez de
  deixar alguém reencontrá-lo como bug: `2026-09-21T00:00Z` é **20/09 às 21:00**
  em Brasília — meia-noite UTC vista daqui, não off-by-one.
- **Prazo abaixo de 48h vira ORDEM**, não informação:
  `⏰ FECHA EM ~30 MINUTO(S)` + *diga na primeira frase, trate como urgente, não
  dê a entender que ela tem o dia inteiro*. Fronteira **inclusiva** (48h exatas
  já avisam): o erro desta classe tem **uma direção só** — a pessoa perde
  dinheiro por avisarmos **tarde**, nunca por avisarmos cedo.
- **Os dois caminhos**: linha única **e** bloco multi-produto. Consertar só a
  linha única deixaria o buraco nos alunos de **maior** risco (2+ produtos) — que
  é exatamente o erro que a primeira versão do bloco já cometeu com as instruções
  do #198.
- **`linhaGarantiaUmProduto()` mudou de casa**, do `account.ts` pro `garantia.ts`.
  No `account.ts` ela importa `@/lib/db/admin`, então **não havia como testar a
  string que chega no prompt** — buraco #12 da revisão de 15/09, e a razão pela
  qual os dois defeitos do #265 viveram 6 dias no ar. Agora quebra.

### 2.4 O que eu **não** mexi, e isso é o ponto

**A janela.** `dentro` compara contra o mesmo `fim`, a renderização segue em São
Paulo igual à main, nada esticou 1 ms. A pergunta de política parada com o Johnny
— *a janela devia ir até o fim do dia brasileiro?*, que a esticaria em **toda a
base** — **continua parada**. Escrevi um **teste GUARDA** só pra travar isso: se
ele ficar vermelho, alguém decidiu política de dinheiro dentro de um conserto de
texto.

### 2.5 Prova — medida, não herdada

| Controle | Resultado |
|---|---|
| `account-garantia.test.ts` | **28/28** (eram 20 · 8 novos) |
| mutação: `instanteBR` volta a ser `diaBR` | derruba **5 de 28** |
| mutação: urgência removida | derruba **3 de 28** |
| restaurado | **28/28** |
| `tsc --noEmit` | exit **0** |
| 32 suites de `lib/agent` + `lib/payments` | todas verdes |

**Em produção, por SSH no Hetzner e não por Action verde:**

- **BUILD_ID `mDQ3wSKkJfnXTR4aToUUR`**, mtime **25/09 01:53:00Z**.
- `toLocaleTimeString(…) + "(horário de Brasília)"` e o `"FECHA EM"` estão no
  **bundle compilado** (`.next/server/chunks/9043.js`), nos **dois** caminhos.
- processo `aiverse` reiniciou **01:53:54Z**, **depois** do build. Build sem
  restart seria código que ninguém executa.

### 2.6 Dois testes meus nasceram errados e o código me corrigiu

Registro porque é o inverso do que costuma dar problema aqui:

- esperei `compra paga em 08/09` e a amostra é **07/09** — eu tinha errado a
  conta do epoch, não o código;
- esperei que **48h exatas** ainda não fossem "curto", e a implementação avisa.
  Pensei de novo: a fronteira **certa** é a inclusiva, pelo mesmo motivo do
  `agora <= fim`. Corrigi a **expectativa**, não o código, e deixei o motivo
  escrito no teste pra ninguém "consertar" a fronteira pro lado errado depois.

---

## 3. Uma dívida que eu fui pagar e **já estava paga**

A nota de 11/09 mandava a próxima ronda trocar o rótulo `"sem compra paga"` do
`garantia_na_fila.cjs`, porque ausência de linha saía impressa com cara de
veredito de pagamento e podia **negar a maior devolução da casa** (#356,
R$ 2.712,12).

Fui fazer. Ele **já diz** *"SEM LINHA NO NOSSO BANCO para este e-mail — NÃO É O
MESMO QUE 'não pagou'"* e aponta pro `pagou_de_verdade.cjs` (linhas 281-285 e
327). Alguém pagou antes de mim. **Não reivindico trabalho de outro.**

A dívida **(b) segue aberta**: o script **cair automaticamente** no
`pagou_de_verdade.cjs` quando não há linha local, em vez de só instruir o leitor
a conferir. Enquanto ela não existir, o número *"perderam a janela"* é **piso, não
total** — qualquer pagante invisível ao nosso banco está fora da conta.

---

## 4. Estado da classe de garantia hoje

`garantia_na_fila.cjs`: **7 perderam a janela na fila** · **0 vencem em 48h** ·
**0 na perna da renovação**. **2 desses estão em card FECHADO** — a casa
considera o assunto resolvido e o aluno ainda está perdendo dinheiro (#384).

E o número que importa pro vão: **137 pessoas** de card técnico ficaram de fora da
conta porque **ninguém pediu nada por elas**. É exatamente onde a **Aline** vive.

### 4.1 🔴 A ALINE continua vencendo 27/09 — faltam 2 dias

Medido de novo nesta ronda (`2026-09-25_garantia_da_classe_de_bounce.cjs`):
**5 já perderam** a janela, **1 ainda dentro** (ela), **5 não medidas**.

`alinedutra_@hotmail.com.br` · **R$ 849,45** pagos em 20/09 · entrega **ZERO** ·
carta de acesso quicou **3 min** depois da compra (`550 5.5.0`, Outlook) · ela
**não sabe que a carta existe**, então não reclama.

**Não re-escalei.** A ronda anterior levou isso ao grupo há **uma hora**, marcado
como urgente, com as duas saídas concretas (um humano manda o WhatsApp com o texto
que já está escrito, **ou** me autorizam e **eu ligo**). Repetir o mesmo pedido
uma hora depois é ruído no canal, e a doutrina de 17/09 proíbe. O bloqueio é
**real e declarado, com data**: e-mail morto com prova, sem 2º endereço conferido
por nome na Hotmart, e telefone é **canal externo** — falar por ele em nome da
casa não é alçada de ronda, e aval não se presume por urgência.

Não deixa de ser o item mais urgente da fila. Só não é um item que eu possa
destravar sozinho.

---

## 5. Achado lateral, registrado e **não** consertado

`manual-contatos.test.ts` **não roda** — nem aqui, nem na main:
`ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`, porque o `node --test` não
resolve o alias `@/`. Conferido com `git stash`, é **pré-existente** e não é da
minha família.

É uma suite que **guarda zero** enquanto parece existir, e é a mesma forma do
achado do #380 (nenhum CI roda a suíte python do worker). Vale card próprio; **não
abri** porque não medi se há outras nessa situação e afirmar alcance sem medir é o
erro que esta casa já documentou contra si mesma.

---

## 6. Dinheiro, GPU, aluno

- **Não mexi** em crédito, acesso, plano, assinatura, saldo nem status de pedido.
- **Não estornei** nada e **não decidi reembolso** de ninguém.
- **Não gastei GPU**, não pedi retreino, não regenerei áudio.
- **Não escrevi pra aluno** nesta ronda. O único caso em aberto tem e-mail
  **morto com prova**, e o canal vivo é externo.
- **Não apliquei migration.** **Não** toquei nos 6 branches STALE do índice.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não li** a caixa do suporte@ pra triagem.
- **Não fechei** o #350. `fixed` sem resolver é a regra 14, e ela continua inteira.

---

## 7. Por que o #350 não fecha

Fix em produção **não é fim**. Falta o que a nota de 11/09 já listava e que **não
é minha alçada**:

- **a palavra do Johnny** sobre as 4 devolucões de quem pediu **DENTRO** e viu o
  prazo virar **na nossa fila**: Victor R$ 397 · Lucila R$ 291 · Dropweb
  R$ 610,88 · + a perna da renovação do Marcelo. Minha recomendação segue a
  mesma, registrada desde 11/09: **honrar** — o atraso foi nosso, não deles;
- **escrever pros alunos** depois da decisão.

Segue `investigating`, com `resolved_commit = 1a8fad41` gravado.

---

## 8. Fim de ronda

- Código por **branch + PR com base main**: PR **#441**, squash **`1a8fad41`**,
  branch apagado no merge. Conferido no **conteúdo da `origin/main`**
  (`git cat-file`), não em relatório herdado.
- **Nada preso em branch**: o fix está na main e o branch não existe mais.
- Log commitado **na main** (registro em `feat/` é invisível pra próxima ronda —
  foi o que custou 9h em 19/08).
- `git log --oneline origin/main..HEAD` conferido **vazio** no fim.
- Recado no **grupo** via `notify-grupo.sh` (canal de 31/08). Nada no privado.

### O que fica pra próxima ronda, com nome

1. 🔴 **A ALINE VENCE 27/09** — restam **~2 dias**. Se a palavra não vier, ela é a
   **6ª** da classe e a lista passa a ter **zero** salváveis.
2. **Os 5 que já perderam a janela** seguem em limbo: pagaram, não receberam, e
   não podem mais pedir de volta. Decisão de reparação é do Johnny.
3. **A dívida (b)** do `garantia_na_fila.cjs`: cair no `pagou_de_verdade.cjs`
   quando não há linha local. Enquanto não existir, o número da classe é **piso**.
4. **Os 2 em card FECHADO ainda perdendo dinheiro** (#384) — classe fechada que
   segue sangrando é exatamente o que a ordem de 20/08 manda olhar.
5. **A pergunta nomeada do §5 da ronda anterior** segue de pé: separar "buraco de
   webhook" de "entrou por importação" nas 3 fichas com 0 linha. **Não trabalhada
   hoje.**
6. **`#332` é o próximo PR a vencer**, depois `#330`, `#328`, `#325`. Herdado e
   **não trabalhado hoje** — escolhi a perna de código que tinha aluno perdendo
   prazo atrás dela.
7. **`manual-contatos.test.ts` não roda** (§5). Medir quantas outras suites estão
   assim antes de abrir cartão.
