# Ronda das falhas — 09/09 ~16h40–17h00Z (Frank, dono da fila)

**Card:** `#323` / `c55786cd` — *"A FAST NAO SABE QUE DIA E HOJE E REPETE PRAZO
JA VENCIDO COMO SE FOSSE FUTURO"*. **FECHADO, `fixed`, em produção.**

**Fim de verdade:** fix em produção (PR #222, merge `573ed89`, deploy
**SUCCESS** 16:49:55Z, run 34378896385) + incidente `fixed` com nota e commit +
dinheiro conferido (não se aplica) + aluna afetada já respondida.

---

## §0 — Registro que faltava: a ronda das 15h50Z não deixou log

Antes de escolher, rodei `git log` do card (a regra que a ronda das 15h deixou
no §0 dela). Achei um buraco: **existe uma ronda que trabalhou e não deixou
registro em git.**

A nota `2026-09-09T15:50:50Z` no `#223` descreve uma ronda inteira — pegou o
card, respondeu a aluna (enviados uid 1420), abriu o `#323` e escalou uma
decisão ao Johnny. **Nenhum log dela foi commitado**: o `_frank/prova/` mais
recente era o das 15h, sobre o `#234`, e a árvore estava limpa. O trabalho
existe no banco e no Telegram, mas não no repositório — que é justamente onde a
ronda seguinte procura.

Não perdi o conteúdo porque a nota do incidente estava bem escrita. Registro
aqui o que ela fez, para o histórico ficar em git:

- respondeu a Alana (uid 1420, cópia confirmada na 1ª tentativa), assumindo que
  a boa notícia existia desde 02/09 e que ninguém mandou;
- abriu o `#323` (este card) com a causa em arquivo:linha;
- escalou ao Johnny, 2 mensagens marcadas urgente, a decisão sobre reabrir a
  janela de trial da aluna.

➜ Regra que fica: **log é parte da entrega, não epílogo dela.** Ronda que fecha
sem commit em `main` é ronda invisível — e a de 15h50 só não se perdeu por
sorte de a nota do incidente ter sido escrita com cuidado.

---

## §1 — Por que o `#323` e não o mais antigo

Rodei a varredura: **50 incidentes abertos**, 12 aguardando aluno, 5 presos.
A regra 8 manda pegar o mais antigo com aluno afetado. Fui atrás dele e os
quatro primeiros estão **travados por motivo que não é meu**:

| card | idade | por que não anda |
|---|---|---|
| `#15` `d3d8d1b2` | 30/07 | espera a **próxima ocorrência**. Instrumentação já viva em produção (chunk/attempt/setup_s), dinheiro 19/19 conferido. Nada a fazer sem um evento novo |
| `#223` | 01/09 | espera **decisão do Johnny** (reabrir a janela da aluna) — escalado 15h50Z |
| `#226` | 01/09 | espera **decisão do Johnny** |
| `#234` | 02/09 | espera **"pode" do Johnny** pro retreino que gasta GPU (§5 da ronda das 15h) |

O `#323` é novo (15:51Z) mas é **a causa geral do agravamento do `#223`**, é
erro de sistema com vítima nomeada, custa zero e **dá pra levar até o fim numa
ronda**. Fila que só tem itens bloqueados não vira desculpa pra ronda vazia:
peguei o que fecha.

**Conferência de aluno esperando, que vem antes da fila (feita primeiro):**

- `marcelopersonalthe32@gmail.com` — 30 dias sem voz, 3 ciclos pagos. **Não está
  abandonado:** 4 e-mails, o último **hoje 11:51Z**, com o prazo de reembolso
  (11/09) e as duas portas. A bola é dele. Nada a fazer.
- `tania-araujo@uol.com.br` — já conferido na ronda das 15h (2 lembretes, régua
  da casa é parar). Não reaberto.
- `hellengrasso@gmail.com` (3d), `thiagobarros.orl@gmail.com` (0d),
  `luanmarcal.com@gmail.com` (11d) — seguem na fila, não tocados nesta ronda.

---

## §2 — O defeito, e por que ele é caro

`buildAgentSystem()` (`manual.ts:423`) montava o system prompt **inteiro** da
Fast **sem a data de hoje em lugar nenhum**. A única data que chegava até ela
era a da garantia (`account.ts:181/184`), e só quando existia janela da Hotmart.
Fora disso a Fast lia datas no **histórico da conversa** e não tinha como saber
se já tinham passado.

O que aconteceu com a aluna `alana_pinho@hotmail.com` (`#223`):

| quando | o quê |
|---|---|
| 02/09 21:00Z | a casa escreveu *"Dia 07 eu te mando um update"* (enviados uid 469) |
| 09/09 12:33Z | ela cobrou o retorno (uid 506) |
| 09/09 12:35Z | a Fast respondeu *"no dia 07 eu te mando o update prometido"* — **dois dias depois** do dia 07 (enviados uid 1386) |
| 09/09 12:47Z | a aluna percebeu: *"mas hoje é dia 09. Achei que seria esse mês o seu contato. Me enganei?"* (uid 507) |

**Não é cosmético: o aluno percebe.** Esta mesma aluna já tinha nos acusado de
ser robô por um erro da mesma família em 02/09 (*"Vc e uma IA, pois hj e o
segundo e nao o terceiro dia"*). O erro queima a confiança exatamente de quem já
está irritado, e ainda gasta a chance de a Fast dizer algo útil.

---

## §3 — O conserto

Módulo novo `frontend/src/lib/agent/hoje.ts` → `blocoHoje(agora)`, interpolado
no topo do system prompt.

**Informar a data sozinha não conserta o caso medido.** O modo de falha não foi
*"ela não sabia o dia"*, foi **repetir data do histórico sem conferir se já
tinha vencido**. Por isso o bloco leva a regra junto: comparar toda data do
histórico com hoje, **jamais** repetir prazo vencido como futuro, e **nunca**
prometer data nova por conta própria — quem tem o retorno é a equipe. Prazo
vencido agora manda escalar pela regra 3.

**Alcance de graça:** os 4 chamadores herdam sem mudar uma linha (parâmetro com
default) — `brain.ts` nos 3 modos (privado, grupo de aluno, grupo da equipe),
`winback/email.ts:107` e `winback/dispatch.ts:275`. Cobre e-mail, chat do app,
WhatsApp, grupo e winback.

### A armadilha do fuso, coberta

O servidor roda em **UTC** e das 21h às 24h de Brasília o UTC já virou o dia
seguinte. Formatar com o relógio do processo faria a Fast anunciar **amanhã como
se fosse hoje, todas as noites** — trocaria um defeito por outro, mais difícil
de ver porque só aparece de madrugada. Teste crava `02h00Z de 09/09` → `08/09`.

`agora` entra por **parâmetro** pela lição já escrita em `garantia.ts:64`: prazo
testado com relógio real vira teste que passa hoje e quebra amanhã sem ninguém
ter mexido no código. `hoje.ts` também não importa nada por alias, de propósito,
pra o runner nativo do Node conseguir **chamar** a função — o `manual.test.ts` é
obrigado a ler o fonte porque `manual.ts` importa `@/lib/video-clone/config`.

### Prova de que o teste não é decorativo

Sabotei o código de produção e conferi que a suíte cai, depois restaurei:

| sabotagem | resultado |
|---|---|
| removi `${blocoHoje(agora)}` do prompt (o defeito original) | `not ok 8`, fail 1 |
| troquei o fuso pelo relógio do processo | `not ok 2` (a armadilha do fuso), fail 1 |
| restaurado | **12/12** |

Suíte do agente inteira: **76 tests, 0 fail**. `tsc --noEmit` limpo — o único
erro é **pré-existente e alheio** (`resgate-audio.test.ts` sem `vitest`).
`eslint` limpo.

---

## §4 — Dinheiro e aluno

**Dinheiro:** não se aplica. Este card não toca crédito, débito nem estorno
(checagem 3 da ordem de 27/08). Não gastei GPU, não apliquei migration, não
mexi em acesso nem em plano.

**Aluno:** a aluna afetada já tinha sido respondida às 15h50Z (uid 1420), antes
do conserto. **Não mandei e-mail novo por causa do fix** — ela não pediu um
relatório de engenharia e isso seria ruído em cima de uma thread que já tem
três promessas quebradas.

---

## §5 — O que precisa do Johnny (repetido de 15h50Z, ainda sem resposta)

> **`#223` — honro a promessa escrita e reabro a janela da Alana?**
> Nós escrevemos a ela (uid 468) *"se um dia quiser tentar de novo, é só
> responder este e-mail — MESMO DEPOIS DO DIA 08"*, e ela está respondendo
> agora. Mas ela **nunca nos pagou** (as 2 linhas de `payment_events` são
> produto 7851642 valor **0**; os R$ 1.064,36 são cursos do Lucas e nunca
> passaram pelo nosso webhook), e a REGRA FINAL DE CRÉDITO diz que quem nunca
> pagou e saiu do trial não gasta. **Honrar promessa escrita contra a regra do
> crédito não é decisão minha.**
>
> ⚠️ **É time-sensitive por motivo técnico, não por educação:** as 5 gravações
> dela podem estar vivas no IndexedDB do navegador, e `voice-recorder.tsx:160`
> as sobe sozinhas no mount. IndexedDB morre com limpeza de cache, troca de
> aparelho ou pressão de armazenamento. Cada dia parado é risco de perder os
> 20 min dela em definitivo.

Também seguem parados: `#226` (decisão), `#234` (§5 — retreino de 1 voz por
conta da casa), **migration 82 não aplicada**.

---

## §6 — O que a próxima ronda faz

1. **Confira o `git log` do card E se a ronda anterior deixou log** (§0). Duas
   rondas seguidas agora tropeçaram em registro: a das 15h refez medição já
   commitada, a das 15h50 não commitou nada.
2. Se o Johnny respondeu o §5, executar a decisão da Alana **antes** de pegar
   card novo — é aluna travada com janela técnica decaindo.
3. Fila sem bloqueio pra atacar, em ordem: `#282` (7 pagantes do R7 sem acesso,
   causa viva e o próximo lote repete), `#254` (cobrança em dobro), `#265`
   (janela de garantia errada, 57 alunos dentro e o sistema diz fora).
4. Não repita: `.like()` em uuid volta vazio em silêncio; `null <= 35` é `true`;
   `_Bugs/` é gitignored; consulta ao Supabase corta em 1000 linhas.

---

## Pendências que atravessam rondas

| item | estado |
|---|---|
| `#323` | **FECHADO** — `fixed`, em produção, `573ed89` |
| `#223` | aberto — espera decisão do Johnny (§5), aluna já respondida |
| `#15` | espera ocorrência nova; instrumentação viva, dinheiro 19/19 limpo |
| `#226` | espera decisão do Johnny |
| `#234` | espera "pode" pro retreino (§5 da ronda das 15h) |
| Migration 82 | não aplicada, aguarda Johnny |
