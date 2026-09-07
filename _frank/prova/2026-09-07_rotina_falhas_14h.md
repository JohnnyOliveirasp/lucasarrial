# Ronda das falhas — 07/09, ~13h40-14h10Z (10h40 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only`, veio 2 commits atrás) e
`_frank/ordens/README.md` lido antes de tocar em qualquer coisa. Nada da planilha foi
lido, classificado, aberto ou reaberto (ordem de 29/08). Canal: ordem de 31/08 — aviso
no **GRUPO**, nada no privado. Turno 10h40 BRT, **dentro** da janela 08h–23h.

---

## 0. A ronda em uma linha

**Levei o #290 até onde dá sem o Johnny: confirmei os 8 um a um na Hotmart viva, achei
o agravante que faltava (a última carta que eles receberam traz o link de senha E o
parágrafo falso na mesma mensagem) e medi o custo — 7 dos 8 NUNCA entraram. O texto da
correção está escrito e conferido; falta só o "pode".**

## 1. Sozinho no quadro (o risco de ontem não se repetiu)

A ronda das 11hZ achou DUAS rondas vivas no mesmo quadro e quase mandou e-mail em
dobro. Conferi antes de agir: `ps` traz só o meu PID (970696, de 13:40:22Z). A nota das
12:46Z no #254 e a do Vigia às 12:16Z são de rondas que **já terminaram**. Não há
segundo dono agora.

## 2. Fila: 41 não-fechados

| status | agora | 11hZ |
|---|---|---|
| investigating | 28 | 25 |
| aguardando_aluno | 12 | 12 |
| open | 1 | 3 |
| | **41** | **40** |

(`fixed` **198** · `ignored` **44**.)

⚠️ **Discrepância que eu não sei explicar e não vou inventar:** a ronda das 11hZ
registrou `fixed` **199**; agora são **198**, com o total geral idêntico (283). O padrão
bate com "1 saiu de fixed para investigating", mas **procurei e não confirmei**: nenhum
`investigating` tem `resolved_at` preenchido, e não há nota de `REINCIDÊNCIA` nova
depois de 06/09. Ou a contagem anterior saiu errada, ou um reabrir limpou o
`resolved_at`. Fica registrado como pendência de medição, não como fato.

**Nada fechado voltou a disparar:** varri `fixed`/`ignored` com `last_seen_at >
resolved_at`. Sai **um só**, o **#8** (fechado 09/08, último disparo 22/08) — antigo,
conhecido, não disparou nesta janela. Décima terceira ronda igual.

## 3. Por que NÃO peguei a cabeça da fila (e não é desculpa)

O serial manda o mais antigo com aluno afetado. Conferi os quatro primeiros e os quatro
estão presos em decisão que não é minha:

- **#15** (39d, 18 afetados) — preso na **migration 82** não aplicada. Confirmei por
  `ddl_aplicado.cjs`: `generations.delay_seconds` e `execution_seconds` não existem no
  banco (junto com a 96 e a 106, 8 colunas ao todo). A ordem de 19/08 que se chama "DDL
  aprovado" aprova o **script 79**, não a 82 — não serve de aval. **Passo que falta: o
  "pode" do Johnny.**
- **#265** (43 dentro da garantia) — o defeito de código está **curado e no ar** (PR
  #191). O que sobra é **política de dinheiro** (renovação reabre garantia?), parada com
  o Johnny.
- **#254 / Diego** — a ronda das 12:46Z reconferiu na fonte hoje: nada mudou, ele não
  respondeu nos dois endereços. A recomendação de **não** cancelar a órfã `4UKYMN4L` sem
  pedido escrito segue de pé (CPF e titular Hotmart diferentes). Relógio: 08/09 12:00Z.
- **#222** — os pagantes órfãos foram vinculados e o acesso restituído em 06/09.

Peguei então o **#290**, que é da mesma família e onde eu **podia** avançar.

## 4. O item da ronda: #290, os 8 assinantes a quem dissemos que não têm a plataforma

### O que eu confirmei (não herdei)

Os 8 compraram **SGP + assinatura FastCloner no MESMO checkout**. A prova não é o
`entitlements` (que é justamente a armadilha do #282, e levaria a concluir "não tem
plataforma" para quem tem): é o **código da transação em par C1/C2** na Hotmart viva —
`HP3698277513C1` (Gerador de Ganchos) + `HP3698277513C2` (FastCloner), e o mesmo padrão
em `HP1035474703`, `HP2524342389`, `HP1087998124`, `HP1348994675`. Todos
`price.value > 0` e `COMPLETE/APPROVED`. **Para os 8 o parágrafo era falso.**

### O agravante que nenhuma ronda tinha visto

A última palavra nossa para eles **não** é o e-mail de boas-vindas do card. É o *"Sua
conta do Sistema de Geracao Pronto esta pronta"* (04/09 ~15h30Z; conferi os corpos, uid
749 do fmgimael e uid 725 do malmeida313). Essa carta traz **as duas coisas juntas**:
o link pessoal de definir senha **e** o parágrafo falso. A mesma mensagem abre a porta e
manda a pessoa não entrar.

E o link é `type=recovery` emitido em **04/09** — 3 dias. **Não medi a expiração no
Supabase** e não vou afirmar que morreu; mas token de recovery de 3 dias não é caminho
confiável, por isso o texto que escrevi manda usar "Esqueci minha senha", que vale
sempre. Os 8 têm senha (do lote) e `email_confirmed_at` preenchido: o fluxo certo é
redefinição, **não** cadastro novo.

### O custo, medido

**7 dos 8 nunca logaram** (`auth.users.last_sign_in_at` nulo; a única exceção é
`max@md2net.com.br`, 04/09 16:48:08Z). Os 8 têm entitlement ativo, `access_until` futuro
(13/09 a 02/10) e **100.000 créditos cada**, parados.

### Código: curado, e conferido no ARQUIVO

Não aceitei "o PR mergeou". Li `frontend/src/lib/payments/sgp-boas-vindas.ts` na main: o
bloco agora é condicional em `temAssinaturaFastcloner`, e o ramo verdadeiro diz *"A SUA
ASSINATURA DA PLATAFORMA FASTCLONER TAMBÉM ESTÁ ATIVA … não precisa contratar nada à
parte"*. O parágrafo falso só sai para quem realmente não tem. **Sem vítima nova.**

### O que fiz e o que deliberadamente não fiz

**Não enviei.** São 8 com o mesmo texto: é lote, e lote precisa do "pode" (REGRA 8).
Deixei pronto em `_frank/rascunhos/2026-09-07_290_correcao_8_assinantes.md`, com tabela
por pessoa (nome, fim da assinatura, se já logou) e **uma versão separada para o Max**,
que já entrou e portanto não pode receber o texto de "você nunca acessou". Nota gravada
no card (5 → 6, 1 linha afetada, conferida na releitura).

## 5. 🔴 O mais urgente do quadro agora: Elane (#293), com promessa correndo

Não é meu item serial, mas passa na frente de qualquer limpeza e o próximo que sentar
aqui precisa ver isto primeiro:

- **11:31Z — a aluna REFUTOU por escrito** o diagnóstico que o nosso e-mail das 11:28Z
  vendeu como "o motivo principal". Textual (uid 463): *"Eu já fiz 4 vídeos com essas
  duas vozes e saíram horríveis. ENTÃO fui atrás de uma voz de outra pessoa"*. A voz de
  catálogo foi **consequência**, não causa — bate com a medição da ronda das 11h40Z (8
  gerações com as próprias vozes antes da stock). **O e-mail inverteu causa e efeito.**
- **A Fast prometeu duas vezes** (11:38Z e 11:45Z) retorno "nas próximas horas". **O
  relógio começou 11:38Z** — no fim desta ronda, ~2h30.
- **7 mp3 que ela mandou como prova (uids 460 e 466) seguem sem ninguém medir.**
- O pedido dela, textual: *"preciso que me ajude a curar minha voz, sotaques e pausas
  longas"*.

### O que EU acrescentei de medição nesta ronda

1. **DESCARTEI o defeito da Katia** (referência cortada no meio da palavra) para ela: os
   dois `reference_transcript` terminam em frase completa com ponto — *"…Boa noite."* e
   *"…para que eu pudesse fazer roteiro."* — e começam em fronteira de palavra. **Não é
   esse o problema dela**, e isso poupa a próxima ronda de ir pelo caminho errado.
2. **A pista que sobra é o ESTILO da referência.** A referência da voz "Elane" é um
   texto de **telejornal** (*"…nos próximos telejornais. Por enquanto, é tudo da
   redação. Boa noite."*) — leitura formal e cadenciada. O modelo continua o estilo da
   referência, e isso é coerente com "fala arrastada". A outra voz ("Elane ckis") é fala
   espontânea e mede 2,59 contra 2,44 da formal.
3. **`reference_rate_wps` é NULL nas duas** — a régua da referência nunca foi calculada
   para ela, então ninguém mediu a entrada.

Somado ao que a ronda das 11h já tinha medido (2,44 e 2,59 wps contra média 2,905 e
p10 2,303 nas 154 vozes prontas), **a queixa dela é real e mensurável**, e é sobre os
clones dela.

**Não escrevi para ela nesta ronda**, e digo por quê sem enfeitar: a promessa ainda está
dentro da janela ("próximas horas", ~2h30), e um segundo e-mail meu que dissesse só
"ainda estamos vendo", logo depois de ela ter escrito *"você não entendeu"*, piora. O
que falta para a resposta ficar boa é medir os 7 mp3 dela — e isso eu não terminava
dentro desta ronda. **Deixo como o item nº 1 da próxima**, com a causa provável já
isolada e o defeito errado já descartado.

## 6. Alunos parados: os 3 estão cobertos, conferido um a um

A varredura acusou 3 com acesso vivo, crédito e nenhuma voz pronta. Fui ver se era
abandono e **não é** — os três já foram respondidos:

- **marcelopersonalthe32** (28d): **4 e-mails**, o último em 05/09, explicando que o
  áudio de 47min é entrevista com duas pessoas e dando o prazo de reembolso **11/09**.
  Bola com ele. ⏰ O prazo dele vence em 4 dias.
- **tania-araujo** (3d, `awaiting_training`): **2 e-mails à mão** (05/09 uid 1071, 06/09
  uid 1158) explicando o clique.
- **hellengrasso** (1d, `rejected_too_short`): e-mail honesto em 06/09 23:48 assumindo
  que 5 dos 7 arquivos se perderam por culpa nossa.

### Falso alarme que eu quase reportei como bug (registro pra ninguém repetir)

Vi **16 vozes paradas em `awaiting_training`, a mais velha há 55 dias**, e a leitura
óbvia era "detector que nunca executa". **Fui conferir antes de escrever e a hipótese
caiu:** `awaiting_training` é o estado de quem **precisa clicar** para treinar (a própria
tela diz "ficaram até 43 dias em awaiting_training sem clicar"); o lembrete existe
(`lembrete-treino-sweep.ts`), está plugado no sweep de 5 min, e tem corte deliberado em
`SEM_LEMBRETE_ANTES_DE = 2026-09-06` porque as anteriores **foram triadas à mão**. As 16
são todas anteriores ao corte, e `agent_state.lembretes_treino` está vazio porque
nenhuma voz pós-corte emperrou ainda. **É desenho, não defeito.**

## 7. Fim de ronda — passo fixo

- `git fetch origin && git log --oneline origin/main..HEAD` → conferido no commit desta
  ronda (§8 abaixo, saída no relatório do grupo).
- **Não abri branch e não escrevi código** nesta ronda: não há fix preso em branch.
- Árvore local suja na `main` (6 modificados + `audio-eligibility.ts`/`.test.ts` não
  rastreados) — **segue lá, não é meu, não commitei e não descartei**. Terceira ronda que
  registra isso.

## 8. O que eu NÃO fiz

Não fechei incidente, não reabri, não mexi em crédito/acesso/plano, não estornei, não
apliquei migration, não mergeei PR, não disparei GPU nem geração de teste, **não
respondi aluno** e não toquei em nada da planilha. Leitura do `Sent` foi só para saber o
que já tinha sido dito aos 8 e aos 3 parados — não é triagem de caixa. **As escritas
foram: 1 nota no #290 e 2 arquivos no git.**

## 9. Precisa de DECISÃO do Johnny

1. 🔴 **O "pode" dos 8 do #290.** É a decisão mais barata e mais atrasada da lista
   (pendente desde 04/09) e agora tem número: **7 dos 8 nunca entraram**, cada um com
   100.000 créditos parados e a última carta nossa dizendo que não têm o que pagaram.
   Texto pronto e conferido, é só dizer "pode".
2. 🔴 **Elane (#293)** — promessa de retorno correndo desde 11:38Z; falta medir os 7 mp3.
   Causa provável já isolada (estilo telejornal da referência), defeito da Katia já
   descartado.
3. 🔴 **`migration 82`** — destrava o #15 (39 dias, 18 afetados). A ordem de 19/08 NÃO
   cobre a 82. Junto vão a 96 e a 106 (8 colunas).
4. 🟡 **#254 / Diego** — relógio em 08/09 12:00Z (~22h). Sem pedido escrito dele, a
   recomendação é não mexer.
5. 🟡 **#265** — a política ("renovação reabre a garantia?") segue parada; o código já
   está curado.
6. 🟡 **#226 / #234** — cobrar ou estornar as gerações reprovadas pelo nosso QA.
7. 🟡 **marcelopersonalthe32** — prazo de reembolso dele vence **11/09**.
