# 14/09 ~23h40Z–00h15Z — Rotina das falhas

Fila **81 abertos** na abertura. **2 fechados** (`#281` e `#244`), **1 aberto por
mim** (`#404`) → fecha em **80**.

Método serial (regra 8): o `#281` foi levado até o fim antes de eu pegar
qualquer outro. O segundo caso entrou pela **única exceção que a ordem de 21/08
admite** — dinheiro sendo cobrado errado *agora* — e a exceção se justificou: a
falha aconteceu **durante** a ronda, e o status do job no RunPod expira em
30 min–2h. Se eu tivesse esperado a próxima ronda, a evidência não existiria
mais.

Repo em `main`, `pull --ff-only` limpo (já estava em dia). `_frank/ordens/README.md`
lido antes de tocar em qualquer coisa, mais a ordem de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou reprocessado.**
Ordem de canal de **31/08**: o aviso desta ronda foi **no grupo**, com
`notify-grupo.sh`, e só lá.

Varreduras fixas, antes de tudo:

- **Travados:** 3 em "acesso vivo, com crédito e sem voz pronta", **nenhum
  novo** — Marcelo (36d, já tratado), Eric e Euneiva em `awaiting_training`
  esperando o clique **deles** (2d e 0d). Mais 1 `training_jobs` obsoleto (voz
  já `ready`, ninguém esperando). Nada a fazer.
- **Estorno:** 13 devolução + 13 não-devolução cadastrados, 3.252 linhas
  varridas, nenhum tipo por classificar.

## Qual peguei, e por que

Os mais velhos por `created_at` seguem em decisão alheia ou prazo datado e foram
reconferidos pelas rondas de hoje. Mantive o critério que a ronda das 22h
estreou e a das 23h usou: ordenar por **data da última nota** — quem está aberto
e ninguém encosta.

Deu o **`#281`** (`6da9056e`, u.brunojorge@gmail.com): última anotação **06/09
13:27Z**, **8,4 dias parado**, o campeão da fila. Aluno pagante esperando =
prioridade máxima, então não havia o que discutir.

## O que era, de verdade

**Não era bug nenhum, e o aluno já tinha resolvido sozinho — 55 minutos antes de
eu responder pela primeira vez.**

O chamado nasceu em 06/09 12:31Z: Bruno comprou curso + assinatura e ficou "sem
créditos". A causa era conta duplicada — comprou com `brunno.lopes@live.com` e
criou conta com `u.brunojorge@gmail.com`; o vínculo casa por e-mail e nada casou.

Medido agora, no banco:

| medição | resultado |
|---|---|
| `profiles` brunno.lopes@live.com (`7e36ec57`) | `plan=pro`, `access_source=hotmart`, `access_until=06/10`, **200.000 cr**, last_seen **11/09 15:58** |
| `profiles` u.brunojorge@gmail.com (`45f3f349`) | `free`, **0 cr**, last_seen 06/09 12:32 — duplicata morta, sem dinheiro em cima |
| `entitlements` | **uma só** (`18d00572`), `active`, **já vinculada** ao user_id certo, criada 06/09 12:10 |
| `credit_transactions` | 2× `subscription_grant` de 100.000 (`HP2643264260` 06/09 12:33 + `HP3815308904` 13/09 14:19) = os 200.000 do perfil, **zero débito** |

O perfil certo foi criado **06/09 12:33:04** — 2 min depois do chamado abrir.

## O erro que eu corrijo de mim mesmo

Minha nota de **06/09 13:27Z** dizia ao aluno que o acesso *"vai aparecer assim
que a conta certa for usada"*. Ele **já tinha usado**, às 12:33. Eu respondi em
cima de um retrato velho: medi o estado da abertura do chamado, não o estado do
momento em que escrevi.

Não causou dano (a carta mandava fazer exatamente o que ele já tinha feito), mas
é a mesma família de erro que o passo (1) da rotina existe pra evitar — *"já
resolveu sozinho? confira o estado ATUAL antes de qualquer coisa"*. Registro
aqui porque o caso só ficou 8 dias parado por isso: a nota dizia "esperando
resposta do aluno" quando não havia mais nada a esperar.

## O que MUDOU desde então, e por isso escrevi de novo

**O trial de R$ 0 virou assinatura paga.** `pagou_de_verdade` em
`brunno.lopes@live.com`:

- curso *Fábrica de Conteúdo Invisível* — **R$ 368,64 COMPLETE**, 06/09;
- assinatura FastCloner rec#1 — **R$ 0** COMPLETE, 06/09 (o trial);
- assinatura FastCloner rec#2 — **R$ 97,00 APPROVED**, **13/09** (`HP3815308904`).

Ou seja: ele agora é assinante **pagante da plataforma**, não só do curso — o
oposto do que a minha carta de 06/09 afirmava (e que, na data, estava certa).
Deixar isso sem aviso é o roteiro pronto de uma contestação daqui a uma semana.

Ele **nunca respondeu**: `ler_caixa --de` nos **dois** endereços = vazio, com
contraprova (`--ultimos 3` devolve normal, fila da Fast = 0). E **não gastou um
crédito sequer** desde que pagou.

## O que fiz

1. **E-mail ao Bruno** (Enviados **uid 2361**, bcc suporte@), com quatro pontos:
   qual conta usar; que a conta antiga do gmail vai mostrar zero crédito **pra
   sempre** e isso não é defeito novo; que o teste virou **R$ 97 cobrados em
   13/09**, com acesso até 06/10 e 200.000 cr; e que, se a cobrança não foi
   intencional, **basta responder que eu cancelo e trato a devolução aqui** —
   ainda dentro do prazo de arrependimento.
   **Não** mandei ele se virar no painel da Hotmart: isso é a regra 9-C, e é
   exatamente o defeito que está aberto contra `manual.ts:396-403`.
   Regra 8: e-mail individual sobre caso que estou tratando, decido sozinho.
2. **`#281` → `fixed`**, com `resolution_note` dizendo o que era, o que o banco
   confirma hoje e o que eu escrevi. Fechado porque o defeito relatado **não
   existe mais e está medido**, não porque o prazo venceu.
3. **Recado `para_frank_6da9056e` drenado** da `agent_state` (8,4 dias na fila).
   O roteiro dele — conferir entitlement, vincular se órfã, creditar, responder
   por e-mail — está **inteiro satisfeito**: entitlement única, já vinculada,
   crédito lá, aluno respondido. Deletado com `returning` e releitura: 1 linha
   apagada, 0 restantes.

Escritas conferidas na releitura: `#281` 1 linha afetada, `agent_notes` 4→5
(array preservado), `resolution_note` 0→981 chars (concatenado).

## O que NÃO fiz, e por quê

- **Não vinculei nem apaguei a conta duplicada do gmail.** Ela é gratuita,
  zerada e sem dinheiro em cima; juntar contas por semelhança de nome continua
  proibido, e ele não pediu.
- **Não toquei em crédito.** Não havia nada a estornar nem a liberar.
- **Não abri incidente novo** pelo "retrato velho". É lição de método, não
  defeito de sistema — fica registrada aqui e na nota do `#281`.

---

# SEGUNDO CASO — peguei um ao vivo, e a exceção da regra 8 se aplica

Fechado o `#281`, a regra serial manda pegar o próximo. Peguei um fora da ordem
de antiguidade, e o motivo é a única exceção que a ordem de 21/08 admite:
**dinheiro sendo cobrado errado agora.** A varredura da abertura mostrava um
`[open]` com `last_seen` de **20 minutos antes**: *"Vídeo Clone iniciado às 18:19
(14/09) há mais de 40 min ainda em generating"*.

Era o **`#244`** (`f5325bf7`, daniel@dlima.adv.br), e o aluno estava **logado
naquele instante** (`last_seen_at` 23:46:38Z).

## Primeiro, re-medi o aluno — e ainda bem

A nota de 11/09 deste mesmo cartão diz: *"ele é lead, não pagante, então não há
dinheiro nem crédito envolvido neste cartão"*. Medido hoje:

`plan=pro`, `access_source=hotmart`, **acesso até 19/09**, 43.222 cr.
**Ele virou pagante.** Reusar a medição de 11/09 teria tratado pagante como lead
— que é exatamente a lição que este cartão já carrega de 11/09, quando uma
varredura correta morreu em 41 segundos e a carta saiu errada.

## Peguei a falha ao vivo, dentro da janela que expira

O único job em voo da plataforma inteira era o dele: `6e3fa73c`, 63 min em
`generating`, 9.135 cr já debitados. Consultei o RunPod direto:

- **23:48:03Z** → `IN_PROGRESS`, worker `ee1x0kn9lqbsxw`. Não era órfão: estava
  rodando de verdade, e o sweeper de 5 min agiria certo em deixá-lo correr.
- **23:48:48Z** → `FAILED`, `executionTimeout exceeded`,
  **`executionTime = 3.812.998 ms`**.

Teto que o **nosso próprio código** calcula (`cloneExecutionTimeoutMs`,
`config.ts:96-101`) para 86,82 s de áudio: **3.810 s**. Morreu **3,0 s além**.

Capturar isso na hora não é detalhe: o `finalize.ts` documenta que o status do
job expira no RunPod (404 em ~30 min–2h). **Quem não captura agora não captura
mais** — foi assim que 9 falhas de 22/08 ficaram sem causa.

## As duas gerações reclamadas NÃO são o mesmo caso

O chamado dizia "2 travadas". Medido:

| geração | tier | áudio | desfecho |
|---|---|---|---|
| 21:19:45Z (`87a8b099`) | **Turbo** (480p-v2) | 86,82 s | **`ready`, entregue** |
| 22:44:50Z (`6e3fa73c`) | **Padrão 2.0** (480p-v3) | 86,82 s | **morreu no teto** |

Mesmo aluno, mesma noite, **mesmo tamanho de áudio**, tiers diferentes,
desfechos opostos. Virou o contorno que ofereci a ele — e o Turbo ainda é mais
barato (80 cr/s contra 105).

## Dinheiro: conferido, e quase errei

Débito 9.135 às 22:44:50 (`ref_type='video_clone'`), estorno 9.135 às 23:48:30
(`ref_type='video_clone_refund'`, mesmo `ref_id`). **1:1.** Conferido por
`ref_type` e **nunca** por `kind` — o estorno grava `kind='extra_purchase'`.

⚠️ **Quase publiquei "sumiram 9.135 créditos".** Li só
`credits_subscription` (43.222) contra a soma do extrato (52.357) e a diferença
batia **exatamente** no valor do estorno. Antes de afirmar, reli as duas colunas:
`credits_extra` = **9.135**. O estorno cai no balde **extra**, não no de
assinatura, e 43.222 + 9.135 = 52.357 = extrato inteiro. **Não sumiu nada.**

## O achado da ronda: `#404` aberto

Puxei o dia inteiro em vez de olhar só o caso dele, e o quadro é maior do que a
ronda das 22h tinha medido (lá eram 2 casos; o vigia contou 4 alunos):

| aluno | áudio | teto | `elapsed` | excesso |
|---|---|---|---|---|
| welrisson 16:06 | 53,01 s | 2820 | 2831,831 | +11,8 s |
| welrisson 16:55 | 53,01 s | 2820 | 2829,136 | +9,1 s |
| leonice 19:01 | 63,26 s | 3120 | 3127,566 | +7,6 s |
| danicale 20:45 | 28,44 s | 2070 | 2074,944 | +4,9 s |
| claytonpc10 20:48 | 74,30 s | 3450 | 3459,396 | +9,4 s |
| alcinalivre 21:48 | 46,54 s | 2610 | 2612,762 | +2,8 s |
| daniel 22:44 | 86,82 s | 3810 | 3812,998 | +3,0 s |

**7 falhas, 6 alunos, todas `executionTimeout`, todas 480p-v3.**
Soma: **5h45min** de espera de seis pessoas, hoje, por zero vídeo entregue.

**E é de HOJE.** `executionTimeout` por dia nos últimos 30: 18/08 → 0 · 01/09 →
0 · 05/09 → 0 (as 24 falhas daquele dia são do apagão, outra causa) · **14/09 →
7**. A classe estreou hoje. O código do teto está intocado na main desde
**07/08** (`a1a2c51`).

Registrei a correlação **sem** transformar em causa: 14/09 é o dia de maior
volume da série (64 entregas v3, contra 28 em 13/09). Não li o worker, não medi
a fila do RunPod, não sei qual GPU pegou cada job, e é **um** dia de observação.

### O que NÃO se pode concluir do "+3 s", e por isso o cartão não pede subir o teto

Tentador ler "faltava quase nada". É falso **por construção**: o RunPod mata
exatamente no `executionTimeout`, então `elapsed ≈ teto` para **qualquer** job
que estoure, precisasse ele de mais 3 segundos ou de mais 3 horas. O excesso
mede a precisão do carrasco, não a distância que faltava.

### O buraco que impede decidir

`video_clones.elapsed_seconds` em 30 dias: **`ready` → 1.986 linhas, 0 com
duração registrada**; `failed` → 35 linhas, 32 com. **A casa só mede quanto o
job demorou quando ele fracassa** — logo não consegue responder "quão perto do
teto roda um job saudável?", que é a única pergunta que decide se o teto está
apertado ou se o job trava.

E o número **chega na nossa mão e é jogado fora**: `sweep-clones/route.ts:61-70`
passa `st.executionTimeMs` para qualquer status terminal, mas
`finalize.ts:38-46` (ramo `COMPLETED`) grava `status:'ready'` e **retorna**; a
escrita de `elapsed_seconds` está em `finalize.ts:75-80`, **depois** do gate de
falha. Único passo que o cartão propõe: **persistir no `ready` também.** Uma
semana disso responde a pergunta com dado em vez de aposta.

### Por que este cartão não existia

O detector de rajada conta **2 ocorrências em 6h por aluno**. Hoje foram 6
alunos com 1 falha cada e 1 com 2 — só o welrisson cruzou a régua (virou o
`#398`). **A régua mede reincidência individual; este defeito é coletivo.**

## O que fiz no segundo caso

1. **E-mail ao Daniel** (Enviados **uid 2362**), de propósito **antes de ele
   tentar de novo**: a culpa é de um limite nosso e não do arquivo dele, os
   9.135 já voltaram, use o **Turbo** para áudio longo (ou encurte), e **sem
   promessa de data**. A pressa tem medição: o welrisson repetiu o mesmo áudio
   49 min depois e morreu no mesmo teto.
2. **`#244` → `fixed`**, com a medição inteira e ponteiro pro `#404`.
3. **`#404` aberto** (`7405e5aa`), `kind=system`, os 6 alunos como afetados.

## O que NÃO fiz no segundo caso

- **Não subi código nem mexi no teto.** Sem saber a folga dos jobs saudáveis,
  mexer no número é aposta.
- **Não escrevi pros outros 5.** Todos já foram estornados automaticamente;
  carta a 5 de uma vez é envio em massa e depende do "pode" do Johnny (regra 8).
  Foram pro grupo.
- **Não toquei em crédito.** Os 7 estornos são da própria casa e batem 1:1.

## Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` — conferido no fim.
Nenhum fix desta ronda ficou preso em branch (não houve código: a entrega foi
e-mail + escrituração).

### ⚠️ ERRO MEU NESTA RONDA, corrigido antes de fechar: o `#402` não sumiu

**Primeiro eu escrevi que o trabalho em voo do `#402` tinha sido descartado. Era
falso, e a falha foi de método — minha.**

A ronda das 23h registrou `mail-bounce.ts` modificado e não commitado (+35
linhas, o tipo `VeredictoDns`). Abri esta ronda com o working tree **limpo** e
concluí "evaporou", em cima de duas medições que **não cobriam a pergunta**:

- `git log -- <arquivo>` — mas **só da main**, sem `--all`;
- `grep VeredictoDns` — mas **só no working tree**, que é justamente o que muda
  quando alguém commita.

As duas dão "não existe" mesmo quando o código está vivo num branch. Conferi
antes de fechar a ronda e o quadro real é o oposto:

| medição correta | resultado |
|---|---|
| `git log --all -S"VeredictoDns"` | commit **`f386bb9`**, *"#402: quem julga falha de MX é o DNS, não a frase do bounce"* |
| branch | **`feat/bounce-mx-pelo-dns`**, 1 commit à frente da main |
| no origin? | **sim** — `git ls-remote` bate no mesmo sha |
| PR | **#284, OPEN**, aberto **14/09 22:55Z** |

Ou seja: entre a ronda das 23h e esta, o trabalho foi **commitado, empurrado e
virou PR** — o caminho certo. Nada foi perdido.

O que **continua valendo** do alerta, sem exagero: o `#402` está em **PR aberto,
não em produção**. Card/PR não deploya, só a main deploya (lição de 19/08). O
defeito segue vivo pro aluno até o merge — mas isso é um PR esperando revisão,
não trabalho destruído, e a diferença entre as duas coisas é enorme.

Deixo o erro escrito em vez de apagar a seção porque a lição é reaproveitável:
**"não achei" só vira "não existe" depois de procurar em `--all`.** Foi por um
fio que eu não acusei alguém de apagar trabalho alheio.
