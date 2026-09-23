# Ronda das falhas — 23/09/2026 ~15h40–16h05Z

Dono da fila (regra 14-A). Serial (regra 8). **Produção tocada: nenhuma**
(zero merge, zero migration, zero DDL, zero GPU, zero crédito movido).
**1 carta individual a aluno.** Zero vítima nova.

---

## 1. Passos fixos — os dois limpos, com instrumento independente

**Reconciliação dos envios** (passo fixo desde 18/09):
`1105 lidas da pasta Sent · 1028 já tinham linha · 77 fora da janela (--corte) ·
0 escrituráveis · 0 recusadas`. A contagem fecha (1105 = 1105). A própria
ferramenta volta a declarar o buraco do ledger local ("arquivo não existe nesta
máquina — é gitignored, some com o worktree"): é o controle compensatório
funcionando, não defeito novo.

⚠️ As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão de escrituração.

**Percepção travada** (ordem de 17/09): **0 cartões**, mais velho 0d.
Controle positivo (#310) e negativo (#518) OK, 516 varridos.

**Fila de patches do Vigia:** 0.

---

## 2. Pendência da ronda anterior, fechada

A ronda das 15h mergeou o **PR #403** e se recusou, com razão, a declará-lo em
produção com o build ainda rodando. Conferido agora: `Build RunPod Worker`
**completed / success, 53m45s**.

Anoto uma coisa que a faixa histórica não previa: **53m45s está FORA da faixa
de 24–47 min** que as rondas vinham citando. Não virou falha, mas quem usar
"passou de 47 min, deu ruim" como régua vai declarar falso positivo. A faixa
real agora é 24–54 min.

---

## 3. Item serial: `#c726c5ae` (#312 · 106,0d · 19 alunos no cartão, 33 na classe)

**Mudei a escolha que as 5 rondas anteriores vinham fazendo, e digo o porquê.**
De 22/09 pra cá, este cartão vinha sendo pulado com a justificativa "espera
palavra do Johnny, não trabalho meu" — e eu mesmo escrevi isso às 15h. Reli e
está **parcialmente errado**: o *merge* e a *decisão de dinheiro* são do Johnny,
mas dentro do cartão havia trabalho meu por fazer, com relógio de 3 dias
correndo. Pular um cartão inteiro porque *parte* dele está bloqueada é como a
ordem de 17/09 descreve a parada por percepção: vira silêncio permanente.

### 3.1 O relógio de 3 dias tem nome e dossiê

`GGMWWE5Q` = **Eduardo Scandovieri Moraes Pereira**, Plano Founder, ACTIVE,
R$97/mês. Entitlement `dc9683e5`, `product_code=7851642`, `user_id=NULL`,
`access_until 2026-09-26T12:00Z`. Cobrado **26/07** e **26/08** (valor 97 /
APPROVED nos dois), mais PURCHASE_COMPLETE em 02/08 e 03/09. **Próxima
cobrança 26/09.** Telefone do checkout existe e nunca foi usado.

### 3.2 O título deste cartão NÃO explica este caso

`7851642` é **exatamente** o `PRODUCT_ID` que o `orphan-outreach.ts:32` filtra
**PARA**. O varredor enxerga o Eduardo. A cegueira do SGP (`7283229`) é real e
segue valendo pros outros, mas **os 4 que cobram R$97 nesta classe são do
produto da PLATAFORMA**. Quem ler só o título e concluir "é tudo SGP"
investiga na direção errada — foi o que quase aconteceu comigo.

### 3.3 Por que a casa está calada pra ele — lido no estado, não suposto

`agent_state.orphan_invites["scandovieri41@…"]` =
`{first: 04/08, reminder: 07/08, cicloEm: 26/08 14:00:42}`.

Rodando `decidirAcaoConvite()` à mão: âncora = `cicloEm` = 26/08 14:00:42;
`ultimoPagamentoIso` = **o mesmo instante** (o PURCHASE_APPROVED de 26/08).
`pagamento > ancora` é **falso** → não reabre. `reminder` já existe → não manda
lembrete. Resultado: **"nada"**.

**O achado desta ronda:** o ciclo de 26/08 foi dado como atendido, e a próxima
palavra automática da casa só nasce quando cair um PURCHASE_APPROVED novo — que
é **a cobrança de 26/09**. Ou seja: *o mecanismo que existe pra avisar
pagante-sem-conta só volta a falar DEPOIS de cobrar de novo. Ele não consegue,
por construção, chegar antes da cobrança que deveria evitar.*

Isso **não é bug de código** — a regra "1 convite + 1 lembrete POR COBRANÇA"
está implementada exatamente como escrita em `orphan-ciclo.ts`. É **limite do
desenho**, e custa R$97 por ciclo por pessoa, todo mês, sozinho.

Mesmo padrão em `ezwaymotors@…` (first 26/08 / reminder 30/08 / cicloEm 01/09)
e `alinearieta@…` (first 04/08 / reminder 07/08 / **sem** cicloEm).

### 3.4 Descartei a hipótese mais provável antes de culpar o aluno

Varri `auth.users` paginado: **2.930 usuários, o mesmo número de `profiles`** —
as duas tabelas estão em sincronia, não há conta órfã escondida. E **não existe
usuário em auth** pra scandovieri41, ezwaymotors, alinearieta, josephgois nem
isaias.enf. Então não é "já se cadastrou e o profile não nasceu": eles
realmente nunca criaram conta.

Consequência prática: a `porta_de_entrada_sgp.cjs` (`generateLink`) **não serve
aqui** — ela recupera conta que existe, e aqui não existe conta pra recuperar.

Cartas que ele já recebeu: 04/08 (`orfao-convite` automático), 08/09 (à mão,
fora do `emails_enviados` por ser anterior ao corte de 14/09) e 17/09
(`ronda-manual`). **Zero bounce.** Entregue e ignorado, não perdido.

### 3.5 O que eu fiz — a única alavanca que é minha

Carta **individual** (regra 8 de 21/08), deliberadamente diferente das 3
anteriores: nomeia o Eduardo, diz que ele paga desde julho e nunca entrou
nenhuma vez, **assume que a falha é da casa**, repete os 3 passos e pede
resposta de uma linha ("travei") pra eu destravar com ele.

Conferido **no banco, depois de gravar**: `emails_enviados` tem 2 linhas pra
ele, a minha em `2026-09-23T15:48:06` (origem `ronda-manual`), e cópia
**CONFIRMADA** na pasta Enviados, **uid 3274**.

**NÃO** escrevi sobre a cobrança de 26/09 nem ofereci cancelamento/reembolso,
**de propósito**: isso mexe na receita do Johnny e não é decisão minha.

⚠️ **Promessa de ato registrada** (lição do `eac94e82`): eu prometi resposta a
ele. **A próxima ronda tem que conferir se ele respondeu.** Se respondeu e
ninguém atendeu, a carta virou mentira.

### 3.6 Não fechei, e o passo que emperrou tem nome

Segue `investigating`. Nenhum dos passos que faltam é meu:

- **(a) dinheiro, 3 dias:** deixar cobrar R$97 do Eduardo em 26/09 (2 meses
  pagos, 0 acesso, 3 cartas ignoradas) ou cancelar/estornar antes. Levado ao
  grupo nesta ronda — **4ª vez** que esta classe sobe.
- **(b)** o telefone do checkout é o único canal não tentado; ligar/WhatsApp
  pra terceiro precisa do "pode".
- **(c)** "pode" pro merge do **PR #214** + `semear_orfao_sgp.cjs --confirmar`
  na MESMA janela.

---

## 4. Armadilha de medição nova — coluna errada devolve ZERO em silêncio

Minha primeira varredura de órfãos filtrou `entitlements` por `e.email` e
imprimiu **"emails distintos: 0 · SEM CONTA: 0"** — resposta limpa, sem erro
nenhum. A coluna se chama **`buyer_email`**; `e.email` é `undefined` pra toda
linha e o `.filter(Boolean)` comeu as 37.

Só não virou "a classe se resolveu sozinha, 0 órfãos" porque eu tinha mandado o
script imprimir `Object.keys()` das colunas junto. **Fica a regra:** varredura
que devolve zero tem que provar que estava olhando o campo certo — imprima o
nome das colunas ao lado do zero. É a mesma família do "update por id
inexistente afeta 0 linhas em silêncio".

---

## 5. Fim de ronda

- Produção: **nada tocado**. Nenhum merge, migration, DDL, GPU ou crédito.
- **#403 confirmado em produção** (build success 53m45s) — fecha a pendência da ronda das 15h.
- Cartão `c726c5ae`: nota gravada e **conferida na releitura** (16 → 17 notas, 1 linha afetada). Status segue **investigating** — não marquei fixed, a causa de fundo não é minha de resolver.
- Aluno: **1 carta individual** ao Eduardo, conferida no banco e na pasta Enviados (uid 3274). Nenhuma vítima nova.
- Grupo: postado — fato consumado, sem código, sem saída de terminal, sem e-mail/telefone do aluno.
- Log **na main**.

### Pendências nomeadas (paradas, não "em andamento")

1. ⏰ **Cobrança do Eduardo (`GGMWWE5Q`) em 26/09 — 3 dias.** Decisão de dinheiro, 4ª escalada.
2. 🔁 **Resposta do Eduardo** — promessa de ato feita hoje; conferir na próxima ronda.
3. ✅ **A FROTA VOLTOU — e eu quase repeti uma mentira herdada.** Ver §6.
4. **PR #404** — "pode" do Johnny. Provado em 15h: sem conflito, suite verde.
5. **PR #214** — "pode" + semear o dedupe na MESMA janela.
6. **10.000 cr do `b706b32e`** — código em produção, falta a decisão.
7. **`702cc916`** — decisão parada há 21d.
8. **7.455 cr do `7ed72ad0`** — resposta A/B prometida por escrito ao aluno.
9. **`f8587cef` passo (b)** — escuta ponto a ponto, bloqueada por falta de ouvido (`qa` fora do ar).
10. **Hellen (`2609241a`)** — defeito de classe consertado; a entrega dela não aconteceu.
11. **77 cartas anteriores a 14/09** — sem decisão de escrituração.
12. **Dívida de teste do #403** — a pureza do snapshot não está presa por teste.
13. **`olho` mudo** — card `4b645b24`, causa SEPARADA (provedor), ver §6.

---

## 6. A frota voltou — e o quase-erro que isso expôs em mim

Escrevi neste mesmo log, de primeira, *"Frota morta, 7ª ronda seguida"*. **Copiei
da ronda das 15h sem medir.** Fui conferir antes de fechar e está **errado**:

`~/.claude/.credentials.json` foi reescrito **hoje às 14:58:02Z**, com
`accessToken` e `refreshToken` de **108 chars** cada, `expiresAt` 23/09 22:58Z e
`refreshTokenExpiresAt` **21/10**. O Johnny refez o `/login`.

**Por que ninguém viu:** a ronda das 15h rodou de 14h40 a 15h05Z e o login caiu
**14:58Z — no meio dela**. A medição dela era verdadeira quando foi feita e
ficou velha 7 minutos depois. O erro não foi dela; **o erro seria meu**, por
herdar a conclusão em vez de refazer a medição de um estado que muda sozinho.

> A regra que fica: estado externo que pode mudar sem aviso (credencial, build,
> assinatura, caixa) **se mede na ronda em que se cita**. Herdar medição de
> estado vivo é como marcar `fixed` sem conferir o banco.

**Conferido por execução, não por arquivo** (arquivo bonito não prova que o
worker responde):

| worker | modelo | veredito |
|---|---|---|
| `generalist` | Claude Sonnet 5 | ✅ respondeu (4s) |
| `qa` | Claude Sonnet 5 | ✅ respondeu (4s) |
| `olho` | Gemini 3.7 Flash (OpenRouter) | ❌ **vazio**, `stop_reason=end_turn`, 0 tokens de saída |

**O `olho` continua mudo, mas a causa é OUTRA** e não pode ser confundida com a
credencial: os workers da assinatura Claude voltaram juntos, e só o que passa
pelo OpenRouter falhou — erro do provedor engolido pelo engine (o próprio
`delegate-cli` sugere "OpenRouter sem créditos"). É o card `4b645b24`, que já
existia antes do apagão e sobreviveu a ele.

**O que isso destrava agora:** `qa` de volta significa que a ronda **pode testar
tela outra vez** — 6 rondas seguidas declararam "não testei tela nenhuma". E
destrava o passo (b) do `f8587cef`, que estava parado por falta de ouvido.
**O que NÃO destrava:** percepção de imagem/vídeo/áudio pelo `olho`; enquanto o
`4b645b24` não cair, o caminho que funciona segue sendo whisper-1 direto.
