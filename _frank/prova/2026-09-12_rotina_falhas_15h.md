# Ronda das falhas — 12/09/2026 ~14h40–15h00Z (11h40 BRT)

Canal: ordem de **31/08** — tudo de FastCloner vai pro **grupo**, e só pro grupo.
Este arquivo é o log técnico. **Uma** mensagem no grupo nesta ronda
(`notify-grupo.sh`, exit 0, confirmado): a retirada do pedido de e-mail em massa.
Nada mais foi postado, de propósito — ver a seção 5.

Repo em `main`, `pull --ff-only` limpo. Li `_frank/ordens/README.md`, a ordem de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou reprocessado.**

Fila na entrada: **80 abertos** (3 com 30d+, 33 na faixa 3–7d).

---

## 0. O que eu peguei, e por quê

Pela regra 8 os dois mais velhos (94,9d) empatam em `first_seen` 09/06. Desempate
por gente sofrendo: **`#312`** (`c726c5ae`, 19 pagantes sem conta) na frente do
**`#313`** (`2d0509b4`, 12 pessoas, e o que falta lá é **decisão comercial do
Johnny**, parada há 4 dias — não é minha e não anda comigo).

Peguei o `#312`. Ele **não fechou** e explico exatamente onde parou. Depois,
como o que sobra dele tem **data** (15/09) e saiu do meu colo, fui ao mais velho
seguinte, o **`#15`** (`d3d8d1b2`, 44d).

---

## 1. `#312` — o card estava produzindo o MESMO erro pela terceira vez

A nota de hoje 10:49Z afirmava: *"nenhuma destas 19 pessoas foi jamais
contatada"*. **É falso, e eu medi.**

Conferi as 19 uma a uma na pasta **Sent** (`ler_caixa.cjs --enviados --para`,
IMAP `EXAMINE` + `BODY.PEEK`, leitura pura — não marquei nada como lido):

| medido | resultado |
|---|---|
| têm e-mail enviado | **19 de 19** |
| 18 delas | 1 mensagem |
| `victor.inscriptio` | 8 mensagens (é o #309/#350, reembolso) |
| os 4 de 09/06 | uid **1345** 20:27:13Z, **1346** :17Z, **1347**, **1348** :23Z, todos 08/09 |

Li o corpo inteiro de um: é um e-mail **bom** — desculpa pelos 3 meses, explica o
que o SGP é, manda o link, lista o material, avisa explicitamente que *SGP não
inclui a assinatura da plataforma*, e oferece desistir sem discussão.

**Por que isso é grave e não é detalhe.** A nota de 08/09 20:50Z já tinha
afirmado a mesma coisa e foi **retratada** pela nota de 11/09 01:51Z, que nomeou
a armadilha: *afirmar silêncio da casa sem abrir a pasta de Enviados*. A nota de
hoje refez a dedução pelo mesmo atalho (ausência em `profiles` / `sgp_pedidos` /
`entitlements` / `last_seen_at` nulo). **Ausência no nosso banco não é prova de
que não falamos com a pessoa.**

E a consequência estava **em curso**: às 10:49Z foi ao grupo um pedido pro Johnny
autorizar contato **em massa** com as 19, sustentado em *"pagaram e não receberam
nada"*. Se ele tivesse dito "pode" nessa moldura, **19 clientes pagantes
receberiam um segundo pedido de desculpas por silêncio 4 dias depois do
primeiro** — a casa provando que não sabe com quem já falou.

**Retirei o pedido no grupo.** Não é primeiro contato, é **segunda tentativa**, e
ela vence **15/09** (08/09 + 7d, plano da nota de 11/09). Hoje é 12/09: não
venceu. Pela regra 8, aluno com data anotada não é estar travado.

### O que segue verdadeiro, remedido por mim
- as 19 continuam com **0 perfil e 0 pedido** (`profiles` paginado, 2.542 linhas;
  `sgp_pedidos`, 195), comparando por **chave normalizada** (ponto e `+alias` do
  Gmail), não por igualdade crua. Nada se resolveu sozinho.
- **medição nova que ninguém tinha feito aqui:** a porta que o e-mail indica
  **funciona** pra eles. Li no fonte da `origin/main` o `POST /api/v1/sgp/inicio`
  e o `pedidoDaSessao()` (`lib/sgp/sessao.ts`): o pedido nasce de um uuid em
  cookie `httpOnly`, **sem conta e sem validação de compra** — a conta só nasce no
  "Confirmar e Enviar" (Johnny, 29/08). O silêncio deles **não é porta trancada
  do nosso lado**. Não afirmo saber por que estão calados; a hipótese barata e
  **não verificada** é o tamanho do 1º passo: 4–6 fotos + 20–60 min de áudio.
- a causa do título segue **sem conserto de propósito**: widenar o `PRODUCT_ID`
  do `orphan-outreach.ts` é no-op pros 15 e **ativamente danoso** pros 4 (dispara
  o vitalício do `#313`). Vítima nova já está barrada desde `cc6edb2` (130/130).

---

## 2. `#15` — e um erro meu, pego antes de virar nota

Fui medir a cobertura de `qa.setup_s` e cheguei a **75,1%** (438/583), pronto pra
registrar "buraco permanente de 25%". **Estava errado, e já estava refutado no
cabeçalho do `execucao.ts`:** o quarto que falta são **142 linhas
`name="Amostra automática"` com `runpod_job_id` NULL**, que nunca foram à
inferência. População certa → **438/441 = 99,3%**. Caí exatamente na armadilha
que o arquivo avisa. É a 2ª vez que alguém infla esse denominador; por isso ficou
escrito na nota em vez de apagado.

**Estado:** zero ocorrência de `executionTimeout` desde 04/09 20:47Z — **7,7 dias
limpos**, 2,5 deles com a régua nova (#229, `3f25c18`). Pela taxa histórica
(~2/semana) isso **não é cura**; o critério (b) pede 30 dias.

### O achado que muda um argumento escrito no fonte
O `execucao.ts` trata o pico de setup como episódio isolado de 09/09 e usa
**"n=1 acima de 360s"** como razão pra não mexer na reserva. Medi o **máximo de
setup dia a dia**:

| dia | p50 | **máx** |
|---|---|---|
| 05→08/09 | 72–74s | 94–117s |
| 09/09 | 74,2s | **260,7s** |
| 10/09 | 76,1s | **376,3s** |
| 11/09 | 73,7s | 103,0s |
| **12/09 (hoje)** | 75,6s | **265,3s** |

O pico **não é episódio de 09/09: reapareceu em 10/09 e reapareceu HOJE.** O p50
não se move (72–76s todo dia) — o que anda é só a cauda. "n=1" descreve o
**recorde**, não a **frequência do regime**.

### Onde o risco mora — e não é onde as duas últimas rondas apontaram
Cruzei, por classe de chunk, quanto setup cada uma **tolera** (teto − inferência):

| chunks | teto | inf p95 | tolera | |
|---|---|---|---|---|
| 1 | 480 | 83,9 | 396,1s | ok |
| **2** | 480 | 106,7 | **373,3s** | ⛔ estoura no pico de 376,3 |
| **3** | 480 | 128,2 | **351,8s** | ⛔ estoura no pico de 376,3 |
| 4 | 520 | 143,3 | 376,7s | no fio |
| ≥5 | cresce 40s/chunk | | 387–600s | ok |

A classe frágil é **2–3 chunks (~160–480 chars)** — não o texto longo (nota de
10/09) nem o mais curto (nota de 11/09). É aritmética: o teto é
`max(480, 360 + chunks×40)`, então **de 1 a 3 chunks ele fica chapado no piso**
enquanto a inferência cresce (p50 31s → 92s). Sobra um vale onde o trabalho
cresce e o teto não.

**Tamanho do estrago:** aplicando o pico já observado (376,3s) contra a
inferência real das 438 gerações, **33 teriam estourado = 7,5% da frota**. Com o
pico de hoje (265,3s), **0 de 438**. Ou seja: 265s a frota absorve; 376s é
**evento coletivo**, não azar individual.

**O que eu não fiz, de propósito:** não subi régua. O próprio arquivo avisa que a
tentação é subir a reserva e repetir o ciclo (3ª vez que a cauda anda depois de
alguém fechar o número) e que a resposta provavelmente é *falhar rápido e
reenviar* ou observar o setup do lado do RunPod. O reenvio automático do #89 já
existe e explica o histórico de "refazer resolve". O que meu número muda é só o
**peso** do "n=1, não mexe". Isso é decisão de desenho e eu não tomo no susto no
fim de uma ronda.

---

## 3. Dinheiro e aluno

Nada a fazer nos dois cards, e digo por quê. No `#15`, zero ocorrência nova desde
04/09 e a ronda de 08/09 já conferiu **19/19 gerações com débito+estorno = 0**,
casadas por `ref_id`. No `#312`, as 19 estão contatadas e a 2ª tentativa tem
data. **Ninguém está esperando resposta nestes dois agora** — e-mail aqui seria
ruído. Não toquei em crédito, GPU, migration nem acesso.

---

## 4. O que fica pra próxima ronda

- **`#312`**: 2ª tentativa **vence 15/09**. Abrir **Enviados** antes de escrever
  qualquer frase sobre contato — o card já errou isso 3 vezes.
- **`#15`**: olhar o **máximo de setup do dia**. Passou de ~350s, a próxima
  ocorrência nasce na classe **2–3 chunks**. Ferramenta pronta:
  `_frank/ferramentas/medir_regua_15.cjs` (já filtra `runpod_job_id IS NOT NULL`).
- **`#313`**: item (a) parado com o Johnny há 4 dias (honrar ou revogar 15
  vitalícios). Não é meu.
- Seguem **4 patches do Vigia** sem tratar em `agent_state` (`7578c587`,
  `81438b60`, `3dbd2bf0`, `12d4db57`) — dívida registrada, não tratada aqui.

---

## 5. Fim de ronda

- **Nenhum card fechado.** Os dois que peguei seguem `investigating`, com nota
  dizendo em que passo pararam. `fixed` sem ter resolvido é a regra 14.
- **1 mensagem no grupo** (a retirada do pedido). Não postei a medição do `#15`:
  regra 7 proíbe progresso parcial, e o Lucas está no grupo.
- 2 notas gravadas, **1 linha afetada em cada**, conferido na releitura
  (`#312` 11→12 notas, `#15` 63→64).
- Não mexi em crédito, não rodei migration, não mexi na planilha, não gastei GPU,
  não escrevi pra aluno.
- Não commitei a árvore de trabalho do SGP (alteração de outra frente, não minha).
- `git log origin/main..HEAD` **vazio** ao fim; nenhum fix preso em branch.
