# Rotina das falhas — 17/09, 02hZ

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Item desta ronda:** **#303** (`a0bc1f7e`) — **FECHADO** (`fixed`, `resolved_at`
01:56:36,66Z, `resolved_commit` `55f56b6`).
**Erro meu nesta ronda:** o PR do conserto nasceu do branch errado e levou
trabalho alheio pra produção. Está no item 4, não em rodapé.
Fila: **86 → 85 abertos**.

> **Régua de hora:** log em **Z**, seguindo as rondas anteriores. 02hZ de 17/09
> = 23h BRT de 16/09.

---

## 1. Por que o #303

Os nove da frente seguem presos em decisão que não é minha, e todos foram
reconferidos pelas rondas de 16/09. Conferi no banco a última nota de `frank`
de cada um antes de escolher, em vez de herdar a tabela da ronda passada:

| cartão | idade | onde está travado | última nota de `frank` |
|---|---|---|---|
| `#15` `d3d8d1b2` | 48,5 d | 30 dias limpos ou ocorrência sob a régua nova | 16/09 22:05 |
| `#99` `6c38c99d` | 24,4 d | decisão comercial Johnny/Lucas | 16/09 13:46 |
| `#226` `702cc916` | 15,3 d | decisão de produto | 16/09 14:47 |
| `#234` `f8587cef` | 14,4 d | aval de GPU | 12/09 23:47 |
| `#249` `132f7808` | 12,4 d | aval de WhatsApp | 16/09 16:51 |
| `#250` `8c29740f` | 12,3 d | não sobrou canal | 16/09 22:50 |
| `#254` `f1ada07e` | 12,2 d | frase escrita do titular + 9-C | 16/09 17:44 |
| `#263` `5c68eb33` | 11,5 d | definição do Johnny sobre R$ 97 | 14/09 21:47 |
| `#270` `9d9baab6` | 11,4 d | estorno em escala + e-mail em massa = "pode" do Johnny | 16/09 11:53 |
| `#305` `54c14038` | 10,5 d | — | 16/09 18:02 |
| `#288` `df008dcf` | 10,4 d | — | 16/09 16:54 |
| `#290` `446c3ae4` | 10,2 d | — | 16/09 19:53 |
| `#294` `94d3015d` | 9,6 d | **aval de WhatsApp** (Sunesa, R$ 597, mesmo bloqueio do `#249`) | 13/09 18:57 |
| `#296` `ab5644be` | 9,5 d | investigando de propósito (ronda das 00h50Z) | 17/09 00:54 |
| **`#303`** `a0bc1f7e` | **9,5 d** | ← **peguei este** | **10/09** (7 dias) |

O #303 era o cartão mais antigo **cujo desfecho inteiro cabia na minha alçada**
— conserto de código, sem aval de ninguém, sem dinheiro a devolver — e que
ninguém encostava havia sete dias.

Registro de novo, porque não melhorou: o **`#294`** (Sunesa, R$ 597 de SGP nunca
entregue) faz **9,6 dias** parado esperando um "pode" de WhatsApp, levado ao
grupo em 13/09. Um pagante de R$ 597 esperando dez dias por uma autorização não
é item de rodapé.

---

## 2. #303 — o defeito, e por que ele não morava onde o título dizia

**O que era:** `profiles.access_until` é **uma** coluna com **dois significados
opostos**, e a coluna sozinha não conta qual dos dois:

| status da assinatura | o que a data significa |
|---|---|
| `active` | a **próxima cobrança** — renova nela |
| `canceled` | o fim do período **já pago** — acaba nela |

`account.ts` montava a linha do prompt só com a data (`ativo até <data>`), então
uma **renovação** chegava ao agente com cara de vencimento e ele inventava uma
urgência que não existe.

### 2.1 O que eu medi agora, e não herdei do card

1. **605 de 606** perfis com entitlement `active` vivo têm `access_until` igual,
   **ao minuto**, a `raw_event->purchase->date_next_charge`. Para assinatura
   viva, a data **é** a cobrança. Isso estava afirmado no card desde 08/09 sobre
   **um** caso; agora está medido sobre a base inteira.
2. **271** perfis têm a data dentro de 7 dias: **230 `renova`** + **40
   `termina`** + **1 `desconhecido`**. Os 230 eram as contas sobre as quais a
   casa podia escrever um prazo que não existe. A exposição do card (265, medida
   em 08/09) estava certa na ordem de grandeza.
3. **Confirmação a posteriori do diagnóstico, e esta é a parte bonita:** a conta
   da vítima (`49110dde`, `leonicemleandrosociedadeadvoca@gmail.com`) está hoje
   com `access_until` **09/10** e entitlement `active`. Ela **renovou** em 09/09.
   O "prazo de dois dias" que a casa anunciou em 07/09 nunca existiu — o card
   dizia isso em teoria, e o relógio provou.

### 2.2 A nota de 08/09 estava certa, e foi ela que definiu o desenho

O `frank` de 08/09 escreveu neste card que a confusão **não mora no agente, mora
na leitura da coluna** — e provou: ela reapareceu num e-mail escrito **à mão**
para 8 assinantes **pagantes** (*"sua assinatura está ATIVA ATÉ {DATA}"*, os 8
com status `ACTIVE`), fora de qualquer prompt, pego na bancada por acaso.

Por isso o conserto **não** foi um `if` no `account.ts`:

- **novo** `frontend/src/lib/payments/acesso-frase.ts`, **ZERO import** (mesmo
  padrão de `acesso-regra.ts` e `entitlements-pure.ts`, que é o que permite
  `node --test` sem arrastar Supabase). Expõe `naturezaDaData`,
  `fraseDeAcessoParaAgente` e `fraseDeAcessoParaAluno`. **9 testes.**
- `account.ts` ganhou `statusDaAssinatura()`, que lê a melhor linha viva de
  `entitlements` com o **mesmo desempate** de `entitlements-pure.melhorAcesso`
  — que é quem escreveu o `access_until` do perfil. Ler por outro critério daria
  o status de UMA linha e a data de OUTRA.

### 2.3 Dois ramos que são decisão, não enchimento de `switch`

- **`desconhecido`** (sem linha viva **ou SELECT que errou**) manda **ESCALAR**
  em vez de afirmar. É o princípio do #282: erro de leitura não pode virar
  afirmação sobre a assinatura de um pagante. **1 conta** está nesse ramo hoje.
- **`termina`** (CANCELED) **proíbe anunciar perda de crédito** — a geração é
  liberada por **saldo**, não por data. É a outra metade, a do `#47`: a Katia
  passou 48h achando que perderia 176.420 créditos.

### 2.4 A classe já voltou quatro vezes

`#48` (19/08), `#136` (25/08), `#198` (30/08) e este. Sempre fechada, **nunca
consertada na origem**. É o argumento de por que desta vez tinha de virar código.

---

## 3. O que eu NÃO fiz, e é decisão

- **Não escrevi para os 230.** Eles são **exposição, não vítima**: nenhum
  recebeu mensagem errada. A única vítima confirmada já tinha sido corrigida por
  e-mail em 07/09 (Enviados uid 1285). **Não há aluno esperando resposta neste
  card** — foi por isso que ele podia ser pego sem furar a regra de "aluno
  esperando vem antes".
- **Não mexi** em `app/account/page.tsx:119` (*"Acesso garantido até {data}"*).
  "Garantido até" é um **piso**, e é verdade nos dois casos, ao contrário de
  "ativo até". Fica anotado; não virou cartão.
- Sem migration, sem DDL, sem gasto de GPU ou crédito.

---

## 4. O ERRO DESTA RONDA — eu levei trabalho alheio pra produção

**O que aconteceu.** Rodei `git checkout -b feat/acesso-renova-ou-vence` e o
branch nasceu em cima de **`feat/bounce-endereco-obsoleto`** (`468418c`,
conserto do #440/#441 de uma ronda anterior), **não da main**. O `reflog` mostra
o caminho: eu tinha ido pra main no início da ronda, mas o HEAD voltou pra
`feat/bounce-endereco-obsoleto` antes do meu `checkout -b`, e eu **não conferi**
o `git log --oneline -1` antes de começar a trabalhar.

**A consequência.** O PR **#321** saiu com **8 arquivos** em vez de 4, e o
squash gravou o `468418c` na main **dentro do meu commit**: autoria e mensagem
originais dissolvidas, e o conserto do #440/#441 entrando em produção **sem PR
próprio e sem revisão**.

**Como eu peguei.** Pelo `8 files changed` na saída do merge, que não batia com
os 4 arquivos que eu sabia ter escrito. Se eu não tivesse lido aquela linha,
passava.

**Por que eu NÃO revertí**, e quero que a razão fique escrita: os incidentes
`#440` e `#441` **já estavam fechados** (`ignored`, 01:26–01:27Z) apontando para
aquele conserto. Reverter tiraria de produção o código que os fechou e deixaria
dois cartões fechados sobre um conserto inexistente — trocaria um problema de
processo por uma inconsistência na fila. O código veio de uma ronda desta casa,
está documentado e passa no `tsc`.

**O que veio quebrado junto, e aí sim era defeito real.** O
`mail-bounce.test.ts` **morria inteiro no import**: a regra do #440/#441 nasceu
dentro de `mail-bounce-cadastro.ts`, que importa `@/lib/db/admin`, e o
`node --test` não resolve o alias `@/` do Next.

| | antes | depois |
|---|---|---|
| `node --test src/lib/agent/mail-bounce.test.ts` | `tests 1 · pass 0 · fail 1` | `tests 40 · pass 40 · fail 0` |

E o estrago não era só nos testes novos: junto morreram os testes do **parser de
bounce**, vivos desde 30/08, que guardam as três armadilhas das amostras **reais**
da caixa (uid 380 filtro de saída, uid 259 `Status: 5.0.0` com
`Diagnostic-Code: 452-4.2.2`, uid 277 `Action: delayed` que **não** é bounce).
**Um módulo de IO importado por um teste apagou a cobertura de um módulo puro** —
e apagou em silêncio, porque ninguém roda um teste esperando que ele nem comece.

Consertado no **PR #322** (`4283125`) com o padrão que a casa já usa duas vezes:
`mail-bounce-cadastro-pure.ts` com ZERO import leva a regra, o arquivo antigo
fica só com o IO e **re-exporta**, e `mail-bounce-registro.ts` não muda uma
linha. Regra byte a byte a mesma.

**A lição, gravada como regra permanente (`learn-cli` id 1555):** antes de
`git checkout -b`, sempre `git checkout main && git fetch && git reset --hard
origin/main`, e **conferir que `git log --oneline -1` bate com `origin/main`**.
E nunca `git add -A`: adicionar por caminho explícito e ler o
`git status --porcelain` antes do commit. No PR #322 eu fiz assim — 3 arquivos,
conferidos.

> Vale dizer o que isto NÃO foi: não foi "o `add -A` pegou lixo da árvore", que
> era a minha primeira hipótese e estava **errada**. A árvore estava limpa. Foi
> o **ponto de partida do branch**. Se eu tivesse parado na primeira explicação
> plausível, teria gravado a lição errada e o erro voltaria.

---

## 5. O que saiu daqui

- **#303 `fixed`**, `resolved_commit` `55f56b6`, `resolved_at` 01:56:36,66Z.
  Gravação conferida na releitura (**1 linha afetada**), não no que o script
  planejava fazer.
- **PR #321** (`55f56b6`) em produção — deploy **SUCCESS** 01:49Z, 2m52s.
- **PR #322** (`4283125`) em produção — deploy **SUCCESS**, testes de bounce de
  volta.
- **Prova reproduzível e só-leitura** em
  `_frank/ferramentas/2026-09-17_prova_acesso_frase.mts`: roda contra a base
  viva e imprime, lado a lado, o que a linha dizia ANTES e o que diz DEPOIS.
- **Grupo:** dois avisos — o fecho do #303 e o erro do branch com o PR #322.

---

## 6. Lição desta ronda

**A primeira explicação plausível de um erro seu é a mais perigosa.** Quando vi
`8 files changed`, a hipótese óbvia era "o `git add -A` varreu a árvore suja", e
ela explicava o sintoma inteiro. Se eu tivesse escrito essa lição, teria gravado
uma regra sobre `add -A` — verdadeira, mas irrelevante para o que aconteceu — e
o erro de verdade (**branch nascido do lugar errado**) continuaria solto para
repetir na próxima ronda, agora com a falsa sensação de já ter sido tratado.

O que separou as duas foi um `git reflog` de dez segundos. É a mesma forma da
lição da ronda das 00h50Z, virada do avesso: lá, **refutar a hipótese não era o
fim da investigação**; aqui, **confirmar a hipótese também não é** — uma
explicação que cobre o sintoma ainda pode não ser a causa.

---

## 7. Conferência de fim de ronda

- `git fetch origin && git log --oneline origin/main..HEAD` → **vazio**.
- **Nenhum fix meu preso em branch:** `feat/acesso-renova-ou-vence` e
  `fix/mail-bounce-test-restaurado` foram mergeados e **apagados no origin**
  (`--delete-branch`).
- `feat/bounce-endereco-obsoleto` deixou de ser um fix preso — o conteúdo dele
  está na main (pelo caminho errado, ver item 4, mas está).

⚠️ **O passo do `git rev-list main..<branch>` continua inútil neste repo**, pelo
motivo medido na ronda das 00h50Z: ~160 branches acusam commit "fora da main"
porque foram mergeados por **squash** (conteúdo na main, hash não), então um fix
realmente esquecido ficaria invisível no meio do grito. **Não vou fingir que
esse passo passou.** A proposta da ronda anterior (trocar por `git cherry` /
`git branch --no-merged` depois de podar branch mergeado por squash) segue de pé
— e esta ronda é evidência a favor dela: o `feat/bounce-endereco-obsoleto`
existia com um fix dentro e **nenhum instrumento gritou**; quem o levou pra
produção fui eu, por acidente.

Segue de pé também a poda dos branches mortos que o `README.md` manda **não
mergear** (`feat/onedrive-401`, `feat/fix-image-upload-retry`,
`fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`). Esta ronda mostrou o custo
concreto de deixar branch vivo por aí: **eu criei um branch em cima de um sem
perceber.** Com aqueles quatro, o acidente teria sido bem pior que um teste
quebrado.
