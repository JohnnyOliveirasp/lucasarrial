# Ronda das falhas — 20/09, ~17h40–18h15Z (Frank)

Item serial: **#371 / `23f8123d`** (Alice Silveira) — **terceira ronda seguida**
com o mesmo item, porque o fim não tinha chegado. Hoje chegou **metade dele**:
o defeito provado subiu pra produção e está rodando. O cartão **não fecha**, e
o §4 diz exatamente por quê.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — **nada no privado do Johnny**; o post
do grupo saiu e está no §6.

## Placar

- Fila: **90 abertos** no início da ronda (era 90 às 16h30: **estável**).
- Fechados `fixed`: **0** — e é honesto, não omissão (§4).
- **Fix em produção: 1** — PR #373, merge `e5c5b2e1`, deploy run `35526995318`
  SUCCESS, `pm2 aiverse` reloaded **17:50:37Z**.
- Alunos respondidos: **0**. A dívida declarada com a Alice **continua** e
  segue registrada na nota do incidente (§5).
- Crédito devolvido: **0** — não havia o que devolver (o gate roda **antes** da
  cobrança; recusa não cobra).
- Passo fixo dos envios: **864 lidas, 0 carta fora da tabela** depois do corte.
- Percepção travada: **1** pelo instrumento (falso positivo conhecido, o #450).
- Pagante trancado: **0** · fronteira **0** · sem prova **1**
  (`drfabiovilhena29@gmail.com`, sem subscriber code no payload).
- Cartões: **1 aberto** (`8aed2e1c`, coder) · **1 modelo trocado** (§6).

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **864**
cartas lidas da pasta `Sent`, **787** já tinham linha, **77** fora da janela do
corte, **0 escrituráveis, 0 recusadas**. A contagem fecha (864 = 864).

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

(Ronda das 16h30: 860 lidas / 783 com linha. **+4 cartas, todas já com linha.**)

As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão, como o README manda.

**Percepção travada:** instrumento **1** — o #450, falso positivo já declarado
em 18/09; o casador continua re-levantando cartão que já saiu da classe. Idade
da nota parada: **2,2d**. Não há caso de percepção real represado.

---

## 1. O que subiu, e a prova de que é defeito

A chamada do `face-gate.ts` ia **sem `temperature`** e o default da API é
**1.0**. Um classificador **binário**, que decide se o aluno pode usar um
produto pago, estava **sorteando**.

**A prova é aritmética, não interpretação de foto** — e isso importa neste
cartão mais do que em qualquer outro, porque foi interpretação de foto que o
fez inverter duas vezes: `5f610dda` e `8cd4c73c` são **byte a byte o mesmo
arquivo** (md5 `73c4cc82bc77168e3897502168ef45ce`, 116.869 b nos dois) e
tiveram **placar diferente entre si**.

Alcance medido: **31 recusas, 20 alunos distintos**, 15→19/09.

---

## 2. A medição, e o que ela refuta

Instrumento: `_Bugs/2026-09-13_gate371_determinismo.cjs`, **5 rodadas × 9
imagens**, carregando os dois gates por `jiti` de árvores separadas. Não
reimplementei régua — usei a que existe, que já tem a trava contra
"controle segurou, logo aprovado" nascida de um erro de uma ronda anterior.

| papel | imagem | ANTES (main) | DEPOIS | |
|---|---|---|---|---|
| **negativo** | itamar `8cd37f59` | 0/5 | **0/5** | ✅ segurou |
| **positivo** | itamar `40b59813` | 5/5 | **5/5** | ✅ passou |
| alvo | alice `128b3050` | 0/5 | **5/5** | destravou |
| alvo | alice `4100fc07` | 4/5 ⚠️ flipa | **5/5** | destravou + estabilizou |
| alvo | alice `0e6a538a` | 0/5 | **5/5** | destravou |
| alvo | alice `b5c6dea7` | 0/5 | 0/5 | **segue barrada** |
| alvo | alice `5f610dda` | 0/5 | 0/5 | **segue barrada** |
| alvo | alice `8cd4c73c` | 0/5 | 0/5 | **segue barrada** |
| alvo | alice `2b274f51` | 0/5 | 0/5 | **segue barrada** |
| | **ALVO total** | **4/35** | **15/35** | |
| | **imagens que sorteiam** | **1** | **0** | |

`tsc --noEmit` no `frontend`: **0 erro**.

**A cláusula de gaze ficou de fora, e agora isso está MEDIDO.** O branch STALE
`feat/371-gate-deterministico` alegava que *"a cláusula do olhar é o que segura
o controle negativo"*. Nas rondas anteriores eu **argumentei** que não segurava.
Hoje eu **medi**: sem cláusula de gaze nenhuma, o negativo continua barrado
**0/5**, por **pose**, e a própria recusa diz *"a cabeça está virada para baixo
e para o lado, ultrapassando 30 graus"*. **Não mergear aquele branch.**

---

## 3. Um falso "verde" que eu quase escriturei

Rodei `tsc --noEmit` no worktree e ele voltou **limpo**. Era mentira: o
worktree **não tem `node_modules`**, o binário não existia, e o `grep` que eu
usei pra filtrar a saída **engoliu o "No such file or directory"**. Um
`| grep face-gate | head` transforma "não rodou" em "rodou e passou" — os dois
imprimem nada.

Peguei porque fui contar as linhas em vez de confiar no vazio. Só depois de
linkar o `node_modules` real é que houve typecheck de verdade: **0 erro em todo
o frontend**. Registro aqui porque é a mesma família do "deploy verde com a
ferramenta quebrada": **saída vazia não é prova de sucesso enquanto ninguém
provar que o instrumento rodou.**

Pelo mesmo motivo não aceitei o tique verde do deploy como prova: fui no log do
run e confirmei o `pm2` reiniciando o `aiverse` (uptime 0s, online, 17:50:37Z).

---

## 4. Por que o #371 continua `investigating`

**4 das 7 fotos da Alice seguem barradas 5/5.** O que mudou foi a **natureza**
da falha, não a falha: antes era **sorteio**, agora é **recusa estável e
declarada** (*"passa de 30 graus de inclinação"*). Isso é progresso real e é
melhor pra todo mundo — mas a dona do incidente continua sem conseguir usar o
produto, e **regra 14 não afrouxou**: fix parcial não vira `fixed`.

**Passo que falta, nomeado:** **medir o ângulo** de pitch/yaw dessas 4 fotos com
instrumento **geométrico** (landmarks faciais), não com julgamento visual.
- Se o ângulo **couber** nos 30°, o modelo superestima e o conserto é de critério.
- Se **passar** dos 30°, o gate está certo pelo contrato e a conversa vira
  **produto**: o contrato é apertado demais pra selfie de queixo recolhido.

**Não afrouxar o texto por tentativa e erro.** Foi julgamento visual que fez
este gabarito inverter **duas vezes em sete dias**, inclusive entre dois
leitores independentes — eu e o `olho` — que divergiram no olhar em **4 das 9**
imagens e ainda assim chegaram ao mesmo veredito pelo contrato.

---

## 5. A aluna: a dívida não foi paga hoje, e eu não finjo que foi

Estado reconferido: cortesia, **não pagante**, acesso expirou **20/09 12:00Z**,
zero `video_clones`. `pagante_trancado.cjs`: **0 trancados, 0 na fronteira**.

A carta das 15h30 (Enviados **uid 3022**) disse a ela que o gate **"acerta"** ao
barrar as fotos em que o olhar dela vai pro lado. **Pelo contrato isso é falso**
— direção do olhar nunca foi critério, e a medição de hoje confirma que o
portão funciona sem ela.

**Não escrevi hoje**, e mantenho a razão da ronda anterior com um dado novo a
favor: 3 das 7 fotos dela passaram a funcionar, mas o **acesso dela expirou
hoje ao meio-dia**, então ela não consegue usar isso agora. Uma carta dizendo
"consertamos metade" pra quem está com a porta fechada é ruído, não serviço.

A correção **não fica enterrada**: está escrita na nota do incidente com a
instrução explícita de que a próxima carta pra ela **tem que corrigir isso na
cara**. Se alguém discordar e quiser a carta hoje, o caso está documentado pra
isso ser **decisão**, não esquecimento.

---

## 6. Frota e canal

**`coder` falhou DUAS vezes no mesmo dia** (`9c2f6751` e `8dbdf34f`), as duas
com *"worker não entregou saída"*, as duas em `claude-opus-5`. Pela regra da
frota, assumi o item (cartão `19e9917b`, `--agent main`) **e troquei o modelo**:
`coder` → **`claude-fable-5`**. Lição no banco (`remember-cli` **#1745**),
incluindo a de ontem que eu tinha violado: **tarefa que exige julgar imagem
nunca vai pro `coder`** — vai pro `olho`, e o `coder` entra depois com o
veredito na mão.

**Achado da fila que virou cartão: `anotar_incidente.cjs` grava no cartão
ERRADO e imprime `GRAVADO`.** O `resolverId` só casa prefixo de **uuid** e não
conhece a coluna `incidents.numero`: `"427"` é prefixo de exatamente **um**
uuid (o **#138**), então `hits.length === 1`, a recusa por ambiguidade **não
dispara**, e o update vai pro cartão de outra pessoa em silêncio. **65 dos 481
números** têm a mesma armadilha; o Vigia caiu nisso ao vivo hoje ~12hZ.

Isso é grave porque essa é a **única via segura** de anotar/fechar incidente e
roda **toda ronda** — toda anotação feita **por número** até o conserto pode
estar no cartão errado. Cartão **`8aed2e1c`** despachado pro `coder` (já no
modelo novo), com o teste que tem que falhar no código velho e passar no novo,
e com a limpeza do dado do #138 → #427 por último e só depois do ensaio.

⚠️ **Eu mesmo usei essa ferramenta nesta ronda** — mas resolvendo por **prefixo
de uuid** (`23f8123d`), que é o caminho **não** afetado, e conferi o título
impresso antes do `--confirmar`. A gravação voltou conferida na releitura:
**1 linha afetada, `agent_notes` 14 → 15**.

**`critic` segue fora do ar** (*"Not logged in"*), como registrado às 16h30 —
instrumento de revisão que a casa acha que tem e não tem.

**Post no grupo: houve.** Regra 7 manda postar fato consumado, e desta vez
existe um — **fix em produção**. Saiu uma mensagem com o que era, o PR, o
deploy, os números antes/depois e a ressalva de que o cartão **não** fechou.
Nada de log de terminal, nada de progresso parcial.
