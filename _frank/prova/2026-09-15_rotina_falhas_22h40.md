# Rotina das falhas — 15/09/2026, 22h40Z (19h40 BRT)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a de **20/08** (dono da fila),
a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda saiu **no grupo**, e só no grupo.

Ronda anterior das falhas: **21hZ**. Vigia mais recente: **22hZ**. Abertura
**22:40Z**.

Peguei o **`#420`** (Ricardo Olito, SGP). Escolha pela regra 8: é o único aberto
com aluno parado **agora**, e o `#404` — a outra classe viva — estava com o
conserto já em produção e amostra em maturação, sem nada a decidir nesta hora.

**Fechei o `#420` de verdade** (aluno com a voz pronta, avisado, zero cobrança) e
**abri o `#421`** para a classe que o caso revelou e que não morre com ele. E
**respondi as duas perguntas que as rondas anteriores deixaram em voo**, em vez
de passá-las adiante pela terceira vez.

---

## 1. 🔴 O `#420` estava esperando uma ação que o aluno NÃO TINHA COMO EXECUTAR

Quando cheguei, o cartão estava em `aguardando_aluno`, com a causa raiz já
descoberta por uma ronda paralela (**CUDA out of memory**, transitória, não é o
áudio do aluno) e com esta frase gravada no pedido:

> *"Frank devolveu a voz para awaiting_training em 15/09, então o retreino está
> disponível."*

**Não estava.** Conferi as três portas em código, uma a uma, antes de afirmar
qualquer coisa — e as três estão fechadas para um comprador do SGP:

| # | caminho | o que acontece | onde |
|---|---|---|---|
| 1 | aluno, pelo SGP | `400 "Complete as etapas anteriores antes de enviar."` — o pedido está `falhou`, a rota exige `revisao` | `sgp/enviar/route.ts:29` |
| 2 | aluno, pelo app | `402 insufficient_credits` — treino custa **10.000** e o comprador do SGP tem **0 por desenho** | `voices/[id]/start-training/route.ts:104`, `credits/config.ts:10` |
| 3 | suporte / admin | **não existe** — as duas rotas dizem no próprio cabeçalho que **não mexem no `status`**, são anotação | `admin/sgp/[id]/erro:16`, `.../conclusao:12` |

A porta 2 é a pior das três, e não por ser fechada: **o único botão que o aluno
enxerga cobraria 10.000 por uma falha nossa**, de alguém que tem zero e que, por
regra da casa, **não deve pagar nada** — `deveCobrarOnboarding({origem:"sgp"})` é
`false` porque o clone é entrega do produto que ele já comprou
(`credits/onboarding-cobranca.ts`, o defeito medido em 09/09 que levou 12 perfis
a −126.300).

Por isso devolvi o cartão para `investigating` antes de agir: `aguardando_aluno`
estava contando o tempo contra um aluno que não tinha o que fazer.

## 2. 🟢 Destravei, e o que eu afirmo é o que o BANCO diz depois de gravar

Escrevi `_frank/ferramentas/2026-09-15_retreinar_sgp.cjs` (commit **`e4b8f05`**,
na **main**). Ele carrega `dispararTreinoOnboarding` de **produção por jiti** e
aborta se o export sumir — **não há cópia da receita aqui**, que é a lição do
`#351`. Simula por padrão; só age com `--confirmar`.

| | |
|---|---|
| `voices.status` | `awaiting_training` → `training` → **`ready`** |
| `trained_at` | **22:53:07,036Z** |
| job RunPod | **novo** `683f0d28…u2` (o `b8d3e030` era o que morreu de OOM) |
| `sgp_pedidos.status` | `falhou` → **`pronto`**, sozinho, 22:53:14Z |
| `erro` do pedido | limpo para `null`, `voz_pronta_em` 22:53:08Z |
| `credit_transactions` por `ref_id` | **0 linhas antes, 0 linhas depois** |

**Dinheiro conferido por `ref_id`, nunca por `kind`.** Não houve cobrança em
momento nenhum, então **não havia nada a estornar** — e é assim que tem que ser:
a GPU do retreino é conta da casa porque **a falha foi nossa**. Não toquei no
pedido: a produção inteira se recuperou sozinha assim que o treino entrou.

**O aluno foi avisado duas vezes.** A régua automática disparou 4 s depois do
treino terminar (*"Sua voz clonada ficou pronta"* e *"Seus arquivos estão
prontos"*, 22:53:11Z, bounce nulo). E escrevi pessoalmente (Enviados **uid
2480**) — porque a mensagem que ele recebeu às 21:52 dizia *"não conseguimos
finalizar o seu clone — **precisamos de você**"*, pedindo uma ação que ele não
podia executar. Sem uma correção explícita ele reenviaria áudio à toa achando que
tinha errado. Disse com todas as letras: a falha foi nossa, os áudios dele
estavam bons, ele não precisa fazer nada, e não foi cobrado.

### 2.1 Um tropeço meu, registrado porque a próxima ronda não precisa repetir

O primeiro disparo levou **`RunPod 400: invalid webhook url`**. Causa: o
`.env.local` local tem `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, e
`webhookUrlFor()` (`runpod/client.ts:183`) lê **essa antes** de `SITE_URL`.
**Não é bug de produção** — produção treina normal (o `b93dab50` treinou às
22:29Z hoje). Redespachei com `NEXT_PUBLIC_SITE_URL=https://fastcloner.com`.

O que importa é o que conferi **antes** de tentar de novo: fui ao banco na hora e
a voz estava **intacta** — mesmo status, mesmo job antigo, zero linhas de
crédito. O submit ao RunPod acontece **antes** de qualquer escrita, então a falha
foi limpa. Se eu tivesse assumido o contrário e "consertado" o estado, teria
estragado um registro que estava bom.

## 3. 🔴 Abri o `#421` — a classe, que não pode morrer junto com o caso

`1fbdba8f` (**#421**, `frank:sgp-pedido-falhou-sem-caminho-de-retentativa`,
`investigating`, `categoria='tecnico'`).

O `#420` é o **caso**; o vão é a **classe**: quando um pedido do SGP vai para
`falhou`, **ninguém** consegue refazer a entrega — nem o aluno, nem o suporte,
nem o admin. O único caminho que funciona é
`dispararTreinoOnboarding(..., "sgp")`, que tem **dois chamadores em produção**:
`onboarding/import.ts:465` (planilha, **desligada** por ordem de 29/08) e
`sgp/processar.ts:273`, alcançável só por `enviarPedido()` — que por sua vez só
roda vindo do `:29` que recusa `falhou`. **Não há entrada HTTP para um pedido que
falhou.**

O SGP substituiu a planilha em produção em 29/08 **por ordem do Johnny**. Na
primeira falha dele, o comprador ficou num estado sem saída, e **a única razão de
ter sido destravado hoje foi uma ronda passar por ali por acaso de horário**.

**Alcance honesto: 1 caso.** E é 1 porque o SGP só falhou uma vez desde 29/08,
**não** porque o defeito seja estreito: o gatilho é "qualquer pedido ir para
`falhou`", e a causa de hoje (CUDA OOM) é transitória e volta quando a GPU
estiver disputada. A fila do SGP agora é `dados` 103 · `pronto` 83 · `foto` 63 ·
`audio` 19.

**Não prescrevo a cura.** As opções óbvias (rota de retentativa no `/admin/sgp`;
aceitar `falhou` no `:29`; reenfileirar sozinho) têm trade-offs diferentes, e uma
delas gasta GPU sozinha — o que o Johnny já disse que é decisão dele (§9 da ronda
21hZ). Registro o vão e as três portas fechadas; quem consertar decide qual abrir.

## 4. 🔴 A evidência se apagou sozinha — de novo, e por outro caminho

Isto eu só enxerguei **depois** de consertar, e é o achado que eu levaria adiante.

Assim que o retreino entrou, o próprio sistema limpou o rastro:

```
select count(*) from sgp_pedidos where erro is not null   ->  0
select count(*) from sgp_pedidos where status = 'falhou'  ->  0
```

Uma hora antes as duas devolviam **1**, e era a **primeira falha do SGP desde
29/08**. **Hoje não há no banco vestígio nenhum de que o SGP já falhou alguma
vez.** Quem medir a saúde do SGP por essas colunas vai ler *"nunca falhou"*.

O Vigia das 22hZ mediu **exatamente o mesmo defeito de instrumento** por um
caminho completamente diferente: linhas de `video_clones` apagadas, com a morte
do aluno visível só pelo rastro do dinheiro. **Duas medições independentes, no
mesmo dia, em tabelas diferentes, chegando na mesma conclusão:** a casa apaga a
própria evidência ao se recuperar, e sobra um placar que diz zero. Está escrito
no `#421`.

## 5. 🟢 As duas perguntas em voo, respondidas — e a do `#404` é a melhor notícia do dia

As rondas das 20hZ, 21hZ e 22hZ deixaram desfechos em aberto de propósito, para
não adivinhar. **Eu esperei os dois** (poll com teto duro de 10 min) em vez de
passar a pergunta adiante pela terceira vez.

### 5.1 `52f242b1` — o primeiro job sob a régua nova ENTREGOU, e por larga margem

`patriciapiocoachoficial`, 480p-v3, áudio 78,48s, despachado **21:36:09Z**
(depois do deploy das 20:48:42Z). **`ready`**, `elapsed_seconds` **4216,847s**,
`raw_error` nulo.

| régua | teto | desfecho |
|---|---|---|
| **antiga** (1200 + 30/s) | 3570s (59,5 min) | **teria MORRIDO** — estourou em **646,8s (10min48)** |
| **nova** (2400 + 30/s) | 4770s (79,5 min) | **entregou** com **553,2s (9,2 min)** de sobra |

**Isto não é um sobrevivente raspando o limite.** É um job que passou quase
**onze minutos além do teto antigo** e ainda assim terminou bem. Pela régua
velha a aluna teria recebido estorno e nenhum vídeo, e a tabela registraria mais
uma morte "inexplicada".

Vale mais que a corroboração das 21hZ: o `0f7fba33` entregou com 100,5s de sobra
**dentro** do teto antigo — mostrava que o teto estava *encostado* na população
dos sucessos. Este mostra o passo seguinte: **existe massa de jobs saudáveis
vivendo do lado de fora do teto antigo**, que a régua velha cortava sem ninguém
saber. É a confirmação direta do §5 da ronda 21hZ — 1199,4s era **piso**, não
teto, porque a distribuição estava censurada em 1200s.

**Placar da régua nova** (desde 20:48:42Z): **4 entregues** (`a989ca2f` 3609,628s
· `82b3c532` 1403,111s · `105c9fc1` 1111,909s · `52f242b1` 4216,847s), **zero
mortes de teto**, conferido também pelo dinheiro (`ref_type`, nunca `kind`):
nenhum `video_clone_refund` com cobrança posterior ao deploy.

**O que eu continuo NÃO afirmando: que o `#404` pode fechar.** São ~2h e 4 jobs.
E tem um detalhe que corta contra o otimismo e que eu não vou esconder: 4216,847s
já é **88,4% do teto novo**. A cauda real ainda não foi vista, e pode existir job
saudável que precise de mais que 4770s. Mantive `investigating`, com a nota.

### 5.2 A 10ª morte, que nenhuma ronda tinha contado

`ea0ddd9f` (`gabriel.reis2212.pt`), despachado **19:29:09Z**, **antes** do fix —
fora da janela do Vigia das 22hZ e por isso invisível para ele. `raw_error`
**`executionTimeout exceeded`**, `elapsed` **1808,584s** contra teto antigo de
**1800s** = **+8,6s**, dentro da banda de controle (+6,3s a +117,9s).

Dinheiro por `ref_type`: cobrado **−1600** às 19:29:10Z, estornado **+1600** às
19:59:39Z, **1:1, nada a devolver**. É **480p-v2**, o que reforça a correção do
§6 da ronda 21hZ: *"TODAS 480p-v3"* é falso, e um conserto escopado em "v3"
passaria ao lado deste.

## 6. 🟠 Para o Johnny — o que continua precisando de gente (nada disto é chamado)

Herdado das rondas anteriores, **sem mudança na minha janela**:

- **Gregório / `karabachiang`** (`#409`) — notificação extrajudicial, **prazo de
  5 dias úteis correndo desde 12:03Z**, agora **~11h** dentro. Continua **zero
  e-mail nosso**. É o mais urgente da lista e não é técnico.
- **Maria Teresa** (`#356`, `#408`, `#412`, `#415`) — segue sem desfecho.
- **Fichas de bounce: 9** — aval de telefone parado pela **19ª ronda**.
- **`wallanadaphiny`** — **16º dia** parada na tela de foto do SGP.
- **13 vozes em `awaiting_training`** (fora a do Ricardo, que saiu hoje), a mais
  velha de **14/07 (63,8 d)**. Continua sendo o que o **PR #15** cobre, aberto há
  **26 dias**. ⚠️ **Registro uma leitura que quase me fez errar:** olhei essa fila
  como "cemitério" antes de ler o código. Ela **não é** — `awaiting_training` é
  estado legítimo de espera (`lembrete-treino.ts` manda lembrete), e boa parte
  ali é aluno que não iniciou o treino. **A do Ricardo era diferente** porque no
  SGP quem dispara é a casa, não ele. Não transformei a fila inteira em acusação.

## 7. Placar

- **107 não-fechados**: `investigating` **81** · `open` **2** ·
  `aguardando_aluno` **24**.
- **Fechados por mim nesta ronda: 1** — **`#420`** (`fixed`, `resolved_commit`
  `e4b8f05`).
- **Abertos por mim: 1** — **`#421`** (a classe do `#420`).
- **Corte dos abertos por `categoria`:** `atendimento` **42** · `tecnico` **41**.
- ⚠️ **A aritmética NÃO fecha por +1 e eu não vou maquiar:** partindo do Vigia das
  22hZ (81 abertos, `open` 1) e somando só o que eu fiz (+1 `#421`, −1 `#420`
  para `fixed`), eu deveria medir **82 abertos com `open` 1**. Medi **83 com
  `open` 2** — um cartão (`#11` ou `#101`) passou para `open` **fora da minha
  mão**. Há **ronda paralela ativa no mesmo clone** (§8), e atribuo a ela. Não
  reclassifiquei nada para forçar o número a bater.
- **Produção desde 22:16:46Z:** `generations` 6 prontas · `image_generations` 2 ·
  `video_clones` 1 · `voices` 2 — **11 entregas, zero falhas**, e desta vez o
  "zero" foi conferido também pelo dinheiro, não só pela tabela.
- **Fila do SGP:** `dados` 103 · `pronto` **83** (+1, o Ricardo) · `foto` 63 ·
  `audio` 19 · **`falhou` 0**.
- **`#404`** segue `investigating`, com nota nova (13 notas).

## 8. 🔴 A colisão de agentes virou prejuízo de verdade nesta ronda

A ronda das 21hZ avisou (§10) que **outro agente troca de branch debaixo de
quem está trabalhando**. Hoje isso me pegou: commitei a ferramenta e ela foi
parar em **`feat/sgp-gerado-vs-entregue`**, não na `main` — o `checkout` de
outro agente aconteceu **entre** o meu `git checkout main` da abertura e o meu
commit. O `reflog` mostra `moving from main to feat/sgp-gerado-vs-entregue` sem
que eu tivesse pedido.

**É exatamente o defeito que o manual manda conferir no fim de toda ronda** —
*"em 19/08 um fix de aluno ficou 9h preso assim"*.

Como resolvi **sem atropelar o outro agente**: o meu commit tinha ficado em cima
de um `wip` alheio, então **não** dava pra empurrar direto (levaria o WIP dele
junto pra `main`). Criei um **worktree separado** a partir de `origin/main`,
cherry-pick só do meu commit, e empurrei de lá — `62c3c32..e4b8f05`. A árvore do
outro agente não foi tocada em momento nenhum, e este log foi escrito no mesmo
worktree pelo mesmo motivo.

Fica o alerta, mais forte que o da 21hZ porque agora tem prejuízo medido: **não
basta commitar cedo, tem que conferir em QUE BRANCH o commit caiu.** O passo fixo
de fim de ronda (`git log --oneline origin/main..HEAD` vazio) pegou isto — e é a
segunda ronda seguida em que trabalho bom quase fica preso fora do `origin`.

---

## O que esta ronda diz

O `#420` chegou até mim com a causa raiz já descoberta e uma frase tranquilizadora
no pedido: *"o retreino está disponível"*. Era o tipo de coisa em que dá vontade
de confiar — vinha de uma ronda que tinha feito o trabalho difícil de achar o
CUDA OOM e tinha razão em tudo o mais. Se eu tivesse confiado, o cartão ficaria em
`aguardando_aluno` contando o tempo contra um homem que não tinha botão nenhum
para apertar, e a fila mostraria um caso "esperando o aluno" que era, na verdade,
um caso esperando a gente.

Trinta minutos de `grep` nas três rotas foi o que separou isso de acontecer. É a
mesma lição que a ronda das 21hZ escreveu sobre o Gabriel — ela tinha uma
resposta boa e verdadeira (*"existe um Estúdio que faz várias cenas"*) que o
aluno nunca ia encontrar, porque tem guard de admin. **Duas rondas seguidas, o
erro quase cometido foi o mesmo: acreditar numa verdade que só funciona pra quem
a escreve.** Não é descuido de ninguém; é o formato natural de quem conhece o
sistema por dentro. O antídoto também é o mesmo nas duas: abrir o arquivo e ler a
linha que decide, antes de dizer ao aluno que ele tem uma saída.

A outra metade do dia é boa e merece ser dita sem ressalva defensiva: **o
conserto do teto salvou uma entrega hoje**, e deu pra provar. Não com argumento,
com um número — um vídeo que a régua velha teria matado dez minutos e quarenta e
oito segundos antes do fim, e que entregou. O cartão do `#404` foi escrito em
14/09 por alguém que se recusou a chutar e pediu uma instrumentação pequena; 24
horas depois essa instrumentação respondeu a pergunta, e 26 horas depois ela
mostrou a primeira aluna que não perdeu o trabalho por causa disso. Continua sem
poder fechar — 88,4% do teto novo num único job é aviso, não vitória — mas é a
primeira vez na semana que essa classe produz uma notícia boa medida.

E fica o incômodo que eu não consigo arrumar sozinho, porque apareceu duas vezes
hoje em lugares que não se falam. O Vigia achou mortes de aluno que só existem no
rastro do dinheiro, porque a linha do vídeo tinha sido apagada. Eu achei que a
primeira falha da história do SGP deixou de existir no banco no instante em que
foi consertada. **Nos dois casos o sistema não mentiu: ele leu a régua que tinha,
e a régua conta o presente.** Uma fila que só sabe dizer como as coisas estão
agora não consegue dizer o que deu errado no caminho — e é exatamente isso que
esta fila existe pra saber. Foi por sorte de horário que as duas descobertas
aconteceram hoje. Não dá pra fazer política de sorte de horário.

---

**O que eu NÃO fiz:** não fechei o `#404` (§5.1 — 4 jobs e 2h não é amostra, e
88,4% do teto novo é aviso), não afirmei que o `#404` curou, não afirmei que o
`52f242b1` prova o teto certo (disse o contrário: a cauda ainda não apareceu),
não reescrevi título nem signature de cartão nenhum, não mexi em `occurrences`,
não estornei nada e **não afirmei cobrança indevida em lugar nenhum** (no `#420`
medi 0 linhas por `ref_id` antes e depois; no `ea0ddd9f` o estorno saiu 1:1),
não cobrei o Ricardo pelo retreino (`origem:"sgp"` não debita, e conferi no
extrato depois), não implementei reenfileiramento automático (gasta GPU sozinho
— decisão do Johnny), não prescrevi a cura do `#421`, não transformei a fila de
`awaiting_training` em acusação (§6 — li o código e ela é estado legítimo de
espera), não mandei e-mail em massa (1 individual, sobre o caso que eu estava
tratando), não li a caixa de entrada para triagem, não toquei em e-mail não
lido, não subi migration, não abri PR, não mergeei, não toquei nos branches STALE
(`feat/fix-image-upload-retry`, `feat/onedrive-401`,
`fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`), não toquei na árvore de
trabalho do agente paralelo (§8 — usei worktree separado), não liguei nem mandei
WhatsApp pra ninguém, e **não li nem reprocessei nada da planilha** (ordem de
29/08).
