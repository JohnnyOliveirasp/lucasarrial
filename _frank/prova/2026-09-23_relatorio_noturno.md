# 23/09 — Relatório noturno

**Postado no grupo** (`notify-grupo.sh`), ordem de 31/08. Consolidado do dia
inteiro numa mensagem só; as rondas já postaram os fatos consumados (regra 7) e
não se repetem aqui.

Fechado às **24/09 ~01:50Z** (o dia 23/09 teve ronda até 01hZ do 24).

Medições feitas entre 01:00Z e 01:50Z, depois da ronda das 01hZ (`f4feaa59`).

---

## 1. O que eu resolvi

### 1-A. 13 cartões fechados — conferidos por `resolved_at` no banco

Foram **13**, contra **3** ontem. Todos com `resolved_at` gravado dentro do dia:

| cartão | fechado | o que era |
|---|---|---|
| `b5073c91` | 01:55Z | geração de imagem travou em loop infinito no chat do app |
| `6ce07ef4` | 11:31Z | a casa dizia ao aluno que o suporte foi avisado, e não era verdade |
| `eac94e82` | 12:39Z | a Fast confirmou por escrito que pôs o áudio pra rodar, e não existia |
| `a158570c` | 14:27Z | aluno assinou 21/09 e contestava a cobrança |
| `7fb9e7e3` | 15:29Z | áudio de 684 cr entregue com intrusão — crédito devolvido |
| `2126f366` | 16:38Z | o guard do `esperando_johnny` só abortava no zero (perdia 1 de 4 controles) |
| `7aa7bea2` | 17:50Z | Bárbara: contestação de compra FCI/SGP, com retratação da oferta |
| `acac6983` | 18:52Z | aluno queimando crédito em teste |
| `506b7c3a` | 20:47Z | Alana cobrou retorno prometido — ela cancelou o teste em 09/09 |
| `4e74ad34` | 21:32Z | contestação de assinatura Hotmart + pedido de declaração |
| `4f879676` | 21:45Z | +20 min gravados no Gravador |
| `70d52fdd` | 22:27Z | aluna insatisfeita com a voz "Minha Voz" — voz curada |
| `86de22c6` | 23:52Z | Simone: **R$ 975,40 já estavam estornados** e quatro instrumentos liam zero |

O que mais importou é o **`86de22c6`**. Ela esperou **16 dias** por uma resposta
que a casa não conseguia dar porque **`/sales/history` só devolve compra PAGA**:
o estorno apagou as duas transações dela de `pagou_de_verdade`, do `aluno.cjs`,
do balde de nome de 8 meses e da busca por valor. Com quatro zeros na mão, o
passo natural era escrever que o dinheiro "nunca entrou nesta casa" — acusação
falsa sobre dinheiro que a própria casa já tinha devolvido. O que salvou foi ler
a nota 3 do próprio cartão, onde os dois códigos de transação estavam escritos
desde 07/09. Ferramenta nova nasceu daí, com controle positivo embutido.

### 1-B. 78 cartas, 27 escritas à mão, para 32 pessoas

Separadas por `origem`: **17** `ronda-manual` + **10** `fast-resposta` são mão
humana. As outras 51 são código (33 avisos de onboarding, 17 códigos do SGP, 1
convite de compra órfã).

### 1-C. O pagante trancado da noite: era 1, agora é 0 — e o defeito virou cartão

A varredura das 01hZ devolveu **1 pagante trancado**. Fui conferir antes de
reportar, e o caso é o inverso do que o número sugere:

**Renato Niero** (`aprocamgerencia@gmail.com`) comprou hoje. O webhook
`PURCHASE_APPROVED` chegou às **18:41Z**, foi processado às **18:41Z**, `error`
NULL — e **a perna do crédito rodou** (100.000 cr lançados). A perna do
**acesso** não rodou: `access_until` e `access_source` ficaram **NULL**.

Ele **não ficou sem usar o produto** — o portão de gasto é SALDO, não
`access_until` (§⛔ do `03_ROTINA`), e ele gerou 3 imagens e 1 animação entre
19:11Z e 19:21Z. Mas aparecia como **SEM ACESSO** em todo instrumento da casa.

Medido no mesmo dia, para saber se era sistêmico: **13 contas** nasceram em
23/09 e receberam grant de 100.000 cr. **12** ficaram com `access_until =
2026-09-30 12:00:00Z` e `access_source = hotmart`. **Só a dele ficou NULL.**

- Não é o tipo do evento: os 12 irmãos vieram do mesmo `PURCHASE_APPROVED`.
- Não é corrida com a criação da conta: o perfil dele existia havia 5 min quando
  o webhook chegou (`18:35:47Z` × `18:41Z`). O `zizozinstudio` nasceu 22:17Z com
  webhook 22:27Z — mesmo intervalo — e recebeu o acesso.

**Feito:** escrevi à mão `access_until = 2026-09-30 12:00:00Z` e `access_source =
hotmart`, **iguais aos 12 irmãos do mesmo dia** (regra "resgatar aluno travado /
refazer o que falhou por culpa nossa"; é adição reversível, nunca remoção).
Conferido pelo instrumento independente: `pagante_trancado.cjs` voltou de
**1 para 0**.

**Cartão `41f1444f` (#543) aberto para a CAUSA** — consertar a linha dele não
impede a próxima. Falta ler o handler do `PURCHASE_APPROVED` e descobrir por que
a perna do acesso pode não rodar sem gravar erro. É parente do `68a66227`
(`reconcileUserEntitlements` casa só por e-mail) mas **não é o mesmo caso**:
aqui o casamento funcionou, tanto que o crédito caiu no perfil certo.

### 1-D. Um erro meu, e o que fiz com ele

Ao trocar de branch pra commitar este relatório, rodei um `git reset --hard
origin/main` com a branch `feat/intrusao-sistemica-gate` ainda em cima — movi o
ponteiro dela e tirei 2 commits do `#530` de baixo dela. **Nada se perdeu**: a
branch estava publicada no origin em `5f7508f0`, conferi no `ls-remote` e
restaurei o ponteiro local pro mesmo sha antes de seguir. Registro porque erro
meu vai no relatório mesmo quando não custou nada.

---

## 2. O que precisa de você

**O lote de 20 decisões foi ao grupo hoje às 20hZ e segue inteiro sem resposta.**
A doutrina de 17/09 manda lote, não repetição — então não reenvio as 20 aqui.
Elas continuam valendo, com o mais velho parado há **55 dias** e **52 alunos**
distintos atrás.

Só o que é **novo desta noite**:

> **1.** Recarregar o crédito do provedor dos 3 operários do Gemini (`olho`,
> `pesquisa`, `social`)? — **sim/não**

É gasto, então é seu. Importa porque são exatamente **os únicos que enxergam
vídeo e áudio**, e há cartão parado esperando alguém **assistir** um render
(Valdemir, Alexandre, Igor). Os de Claude (`coder`, `qa`, `generalist`) voltaram
e estão respondendo.

---

## 3. O que subiu pra produção

**BUILD_ID no servidor: `BzCmIt7xEmTsUXYIjPSVG`**, construído em **24/09
00:30:05Z**. Conferido por SSH no Hetzner, não por Action verde.

**16 PRs mergeados no dia** (contra **zero em ~11h** ontem): #352, #353, #407,
#341, #411, #412, #410, #413, #414, #415, #416, #408, #409, #403, #420, #421.

O último merge do dia foi o **#421** às **00:28:36Z** — o build é de **00:30:05Z**,
dois minutos depois. **Tudo que entrou hoje está no ar.**

Prova de que o último merge está mesmo no ar (não só mergeado):

- fonte no servidor `src/lib/sgp/painel.ts` → md5 **`93fce5115d974368a95ae7fa82b4ba37`**
- mesmo arquivo em `origin/main` → md5 **`93fce5115d974368a95ae7fa82b4ba37`** — **byte a byte idêntico**
- bundle compilado `.next/server/app/[locale]/admin/sgp/page.js` **contém** a etiqueta `COBRADO`

⚠️ Vale registrar o contraste: ontem a produção estava com build de **22/09
15:03Z** e nada do dia tinha subido. Hoje o build é de **2 minutos atrás**.

---

## 4. Estado geral

```
Fila            116 abertos (era 109 no fim de 22/09)
                74 técnicos · 42 atendimento · idade média 9,4 d
                + 31 aguardando_aluno (era 34; fora da conta, por desenho)
Faixas          30d+: 2 · 15–30d: 23 · 7–15d: 43 · 3–7d: 32 · <3d: 16
Mais velhos     d3d8d1b2 55d (19 alunos) · 37bacb68 35d (22) · 8b8fc4c8 23d
                7ed72ad0 22d · 702cc916 22d · f8587cef 21d (10)
Parados em você 15 conferidos · teto 17 · mais velho 55d · 52 alunos distintos
                (a ronda das 20hZ mediu 20 na mão: o script subconta 3)
Varredura       3 itens presos · 1 é escrituração de training_job, ninguém esperando
Pagantes        0 trancados (283 conferidos 1 a 1) · 1 sem prova (sem subscriber code)
Cartões         17 novos no dia · 13 fechados
Cartas          78 e-mails · 27 à mão · 32 pessoas distintas
PRs             56 abertos · 16 mergeados hoje
Produção        BUILD_ID BzCmIt7xEmTsUXYIjPSVG (24/09 00:30:05Z)
Recados         116 na fila (defeito #541: recado não sai quando o cartão fecha)
Frota           3 de 13 operários fora — os 3 do Gemini
```

**O que mudou de ontem pra hoje, e é bom:** os fechamentos subiram de **3 para
13**, os merges de **0 para 16**, a produção saiu de um build de dois dias atrás
pra um de dois minutos atrás, e a frota saiu de **12 de 13 mortos** para **3 de
13**.

**O que mudou e não é bom:** a fila subiu de **109 para 116** — 17 entraram, 13
saíram. A faixa de **7–15 dias engordou de 38 para 43**, exatamente como ontem.
É a mesma leitura de 22/09: a fila anda pra direita porque **a cabeça dela não
sai**, e a cabeça espera decisão sua, não apuração minha. Fechar 13 num dia não
inverteu isso.

**Uma coisa que o Vigia mediu às 00hZ e ainda está de pé:** a Walsicleia está no
**8º contato** sem carta, e 15 cartas humanas saíram nas 6h anteriores — nenhuma
pra ela.

---

## 5. O que eu não fiz

Não devolvi dinheiro nenhum (9-A é seu). Não mergeei nada. Não gastei GPU. Não
mudei preço. Não rodei migration nem DDL. Não mexi em produção fora do fluxo
normal. Não escrevi para os 90 do SGP. Não li, escrevi nem reprocessei nada da
planilha (ordem de 29/08).

Não afirmo que os parados em você são exatamente 15: o instrumento marca **2
contestados** (teto 17), **10 falsos positivos** da marca, e a própria ronda das
20hZ mediu **20** conferindo na mão, porque o script perde 3 que não caem em
balde nenhum. O número honesto é **"entre 15 e 20, mais perto de 20"**.

A única escrita de dados que fiz foi a do §1-C, e está descrita lá com o antes,
o depois e a conferência pelo instrumento independente.
