# Ronda serial 21/09 ~20h40–21h15Z — FastCloner

Serial (regra 8), a partir de `origin/main 9075906a`.

**Resumo em uma linha:** o item serial de hoje descobriu que a casa **escreveu
para um aluno que tinha devolvido 5.680 créditos e não tinha** — ele passou 20
dias no negativo confiando na nossa frase. Devolvi e avisei. E a mesma coisa já
tinha acontecido com a Katia há dois dias: **duas vezes em dois dias, as duas
pegas à mão, nunca por detector.** Abri o `#517` com o tamanho suspeito da
classe (18 pares, piso e não lista provada).

---

## 1. Passos fixos

### 1.1 Reconciliação de envios — fecha, com os dois instrumentos concordando

Medido 20h42Z, `--corte=2026-09-14T14:06:31Z` (merge do PR #311) nos dois.

**Instrumento 1** — `2026-09-18_reconciliar_envios_da_pasta.cjs` (ENSAIO, nada
gravado, porque não havia o que gravar):

| | |
|---|---|
| lidas da pasta "Sent" | 970 |
| já tinham linha (por Message-ID) | 893 |
| fora da janela (`--corte`) | 77 |
| recusadas (defeito da carta) | 0 |
| **dentro da janela sem linha** | **0** |

`970 = 970`: nenhuma carta sumiu na classificação.

**Instrumento 2** — `2026-09-18_enviados_x_tabela.cjs`, leitura independente:
970 lidas, **893 casadas por Message-ID + 4 por destinatário+janela de 10 min**,
**0 buracos depois do corte**, +73 anteriores. Veredito: o buraco é **PASSIVO**.

O resíduo continua sendo 77 × 73 pelo motivo já apurado na ronda das 22h (é a 4ª
casa, e `893+77 = 970` fecha dos dois lados). O número que decide — carta depois
do corte sem linha — é **0 nos dois**.

*(955 → 970 desde a ronda das 22h: 15 cartas novas, todas já nascidas com linha.
A minha carta pro Lucas Medeiros, abaixo, é a uid 3139 e saiu **depois** desta
medição — entra na conta da próxima ronda, não desta.)*

### 1.2 Percepção — o número cru é 6, a classe real segue ZERO

`percepcao_travada.cjs`: controle positivo OK (#310 reencontrado pela marca),
**502 incidentes varridos**, **6 cartões** (investigating 4 · aguardando_aluno 2).

São **exatamente os mesmos 6 da ronda das 22h**, e reli a última nota de cada um
para confirmar que nenhum mudou de forma nesta janela: `#450` e `#438` são falso
positivo, `#406` / `#455` / `#216` são percepção **cumprida** (o relato do que
já foi visto casa o filtro), e `#226` está esperando decisão do grupo — que pela
regra 8 §4 não é estar travado. **Número honesto pro relatório: 0 cartão travado
em percepção.**

⚠️ O **PR #393** (o conserto que derruba os falsos residuais e leva a classe
crua a 0 sem qualificação manual) segue **ABERTO**, agora com **~2h de vida**.
Ainda não é PR apodrecendo; a ronda das 22h pediu pra cobrar se passar de um
dia, e essa cobrança **continua de pé para a próxima ronda**.

### 1.3 Fila

Medido 20h41Z, antes de eu mexer em qualquer cartão, já com o filtro corrigido
de 22h (incluindo `aguardando_aluno`):

| status | abertos | com 7+ dias |
|---|---|---|
| `investigating` | 96 | 45 |
| `aguardando_aluno` | 33 | 18 |
| `open` | 3 | 0 |
| **total honesto** | **132** | **63** |

Bate com os 131/63 de 22h (o +1 é o `#517` que **eu** abri nesta ronda, depois
da medição).

---

## 2. Escolha do item serial, e por que NÃO foram os dois mais velhos

Os três mais velhos com aluno afetado são `#172` (24,2 d), `#206` (21,3 d) e
`#224` (20,2 d). A ronda das 22h deixou escrito que nos dois primeiros a bola
seria do aluno, mas com uma dúvida honesta pendurada: *"vale medir se a carta
chegou a sair, e a `emails_enviados` não responde isso (ela nasce em 14/09)"*.
**Medi antes de pular os dois**, porque pular por herança é como o `#214`
passou 21 dias escondido.

- **`#172` (José Ricardo, `jrsolucoescorporativas@gmail.com`)** — li as 5 notas.
  O protocolo de gravação saiu **duas vezes** (28/08 uid 287 e 01/09 uid 424) e
  o que falta é **ele** gravar o áudio novo. `last_seen_at` parado em 01/09 com
  `occurrences=3`: se ele tivesse re-cobrado, o sensor teria batido de novo.
  Bola dele, legitimamente.
- **`#206` (Wallana, `wallanadaphiny@icloud.com`)** — aqui a nota era só um
  roteiro de atendimento ("o que dizer pra aluna"), que **não é prova de envio**.
  Fui na pasta remota com o `2026-09-21_cartas_para_o_aluno.cjs`: **9 cartas**
  para ela, e a que interessa é a **uid 371 de 31/08 13:51Z** ("Seus áudios
  chegaram — e o caminho mais curto pra destravar a sua voz"), seguida da uid
  373 com o código do SGP às 14:02Z. Confirmei o outro lado no banco: o pedido
  SGP `0fd2845a` nasceu 31/08 14:02, **parou no passo `foto` com 0 áudios** e
  não se mexe desde 14:07. Ou seja: pedimos, ela começou e parou. Bola dela.
  **A dúvida herdada das 22h fica MEDIDA e encerrada.**

Sobrou o **`#224`**, e foi ele.

---

## 3. O item serial: `#224` — e a casa tinha mentido por escrito

`7ed72ad0-f97d-43f6-bd80-5c7b80d41d4e` · Lucas Medeiros Azevedo,
`grupohcmarketing.comercial@gmail.com` · aberto 01/09, 20,2 dias.

Ele gerou **dois** Vídeo Clone de 70,02s no mesmo dia: `f028733d` (480p-v2
Turbo, **5.680 cr**, 15:00) e `93895b06` (480p-v3, **7.455 cr**, 17:13, gerado
**depois** que o primeiro falhou). A nota de 02/09 registra os dois assistidos
frame a frame: deriva de identidade confirmada nos dois.

### 3.1 O que eu medi

A nota de 01/09 dizia *"os 5.680 cr JÁ foram estornados, então não há pendência
financeira"*. Fui ler a carta que saiu pra ele — Enviados **uid 443**, 02/09
01:20Z — e ela repete isso **pro próprio aluno**, com todas as letras:

> *"Isso aconteceu no Turbo (o que você reportou, **e que já foi estornado**)"*

Ledger inteiro dele, 21/09 20h40Z — **6 linhas, nenhuma positiva**:

| | | |
|---|---|---|
| +100000 | subscription_grant | 01/09 12:59 (HP110549) |
| −10000 | training/voice | 01/09 14:26 |
| −1191 | generation | 01/09 14:52 |
| **−5680** | **video_clone** | **01/09 15:00 — `f028733d`** |
| −1767 | generation | 01/09 17:08 |
| −7455 | video_clone | 01/09 17:13 — `93895b06` |

Débitos somam **26.093**. Saldo antes de eu mexer: **73.907 = 100.000 − 26.093,
exato**. A aritmética do saldo prova o que o filtro já dizia: **estorno nenhum
entrou, de `ref_type` nenhum.**

⚠️ **Conferi com a lista INTEIRA de `REF_TYPES_ESTORNO`, não só
`generation_refund`** — e isso não é preciosismo: a mesma pergunta feita só por
`generation_refund` respondeu *"0 devolvido hoje na casa"*, quando o número real
do dia era **20.000 em 2 linhas**. Quem medisse teto diário pelo caminho curto
teria medido errado nesta mesma ronda.

### 3.2 O que eu fiz

**ESTORNO EXECUTADO, 20:45:56Z.** +5.680 cr pela RPC de produção
`add_extra_credits`, `ref_type=video_clone_refund` casado com o `ref_id` do
vídeo. **Conferido no banco depois de gravar**, não na fala da RPC: 1 linha de
estorno, `saldo_apos=79.587`; perfil relido **73.907 → 79.587**, delta 5.680 =
esperado. Ferramenta versionada e com ensaio por padrão:
`_frank/ferramentas/2026-09-21_estornar_turbo_que_a_carta_disse_que_voltou.cjs`
(rodei de novo depois: agora ele diz *"JÁ ESTORNADO — não devolvo em dobro"*, a
trava funciona).

Autoridade: **regra 9-B** (*estorno de falha nossa até 20.000 cr por caso →
você, sozinho*). Teto **diário** conferido no banco **antes** de gravar, com a
lista inteira: 20.000 já devolvidos hoje + 5.680 = **25.680 de 100.000**.

Isto **não** é estorno por insatisfação e **não** julga a qualidade do vídeo: é
honrar uma frase que a casa já tinha posto no e-mail dele. Mesma doutrina do
estorno dos 400 cr da Katia (`#473`).

**ESCRITO PRA ELE, 20:50Z**, SMTP do `suporte@fastcloner.com` (regra 8/10):
*"Os creditos do seu primeiro video nao tinham voltado - voltaram agora"*.
Registrado em `emails_enviados` (origem `ronda-manual`) e **cópia CONFIRMADA na
pasta Enviados, uid 3139**. Rascunho em
`_frank/rascunhos/2026-09-21_lucas_medeiros_estorno_que_nao_tinha_saido.html`.
A carta corrige a informação errada, **dá o saldo antes e depois** pra ele poder
conferir sozinho, e promete retorno sobre o segundo vídeo de qualquer jeito,
inclusive se for não.

**Status `aguardando_aluno` → `investigating`.** O rótulo mentia: desde 02/09
nada estava sendo esperado **dele**. Nota completa gravada (`agent_notes` 4 → 5,
conferido na releitura).

### 3.3 O que eu NÃO fiz, e por quê

**Não estornei os 7.455 do 480p-v3.** Ele deriva igual — está medido frame a
frame na nota de 02/09 — mas a casa **nunca escreveu** que esse tinha sido
estornado. Devolvê-lo é decisão **nova** sobre limite técnico do produto e vale
pra classe inteira (`#494` tem 9 cartões abertos), não só pra ele. Cabe no teto
da 9-B, então **não é dúvida de valor, é dúvida de política** — e o README manda
perguntar em vez de escolher em silêncio quando envolve dinheiro de aluno.

**Escalado (9-D)** pelo `ask_humans.cjs`: `HTTP 200`,
`sent_to 120363428193217427@g.us`. Pergunta binária, com a minha recomendação:
**(B)** estornar, **só pra ele** e só porque faltou o aviso — o que resolve a
classe é mergear o **PR #351** (*"o aviso de deriva de rosto passa a valer nos
dois tiers e na hora de gerar"*), aberto desde 19/09.

⚠️ **"PENDÊNCIA JOHNNY" escrita em nota de cartão NÃO é escalação.** A nota de
02/09 já dizia *"estornar ou não é dele"* — e ficou **19,8 dias** ali sem que
ninguém fosse perguntado, porque ninguém lê nota de cartão. É a mesma família do
`#207`, em que o aviso ficou na nota, a garantia venceu e o aluno perdeu R$97.

**Não marquei `fixed`** (regra 14): falta a decisão dos 7.455 e falta o conserto
de classe (o #351 não está mergeado).

---

## 4. O achado de classe: `#517`

Se aconteceu com a Katia em 19/09 e com o Lucas hoje, a pergunta óbvia é quantos
mais. Varri os **239 cartões** que mencionam estorno; filtrando só os que
**afirmam no passado** (*"foi estornado"*, *"foram estornados"*) e cruzando o
aluno nomeado com o ledger dele pela lista inteira de `REF_TYPES_ESTORNO`:

> **18 pares cartão/aluno em que o cartão afirma que estornou e o aluno nunca
> recebeu estorno de `ref_type` nenhum, em toda a vida da conta.**
> 3 estão em cartão **aberto** hoje: `#311` (hugo.correa@aol.com), `#371`
> (alicearnaldo@gmail.com), `#446` (paula@handelhomes.com). Os outros 15 estão
> em `fixed`/`ignored` — e **fechado não quer dizer pago**.

⚠️ **Esse 18 é um PISO DE SUSPEITA, não uma lista provada, e erra nos dois
sentidos.** Está escrito assim no cartão de propósito:

- **Infla:** o cartão pode só *discutir* estorno (*"vale estornar?"*, *"não
  houve estorno"*) e casar no texto sem nunca ter afirmado nada ao aluno.
- **Esconde:** **a Katia não estaria nesta lista.** Ela tem 6 estornos — de
  *outras* gerações. Contar estorno **por aluno** é exatamente o erro que a
  ordem de 20/08 manda evitar; a única prova é casar `ref_type` **com `ref_id`**
  do objeto que falhou. O universo real é **≥ 18** e pode ser bem maior.

Abri o **`#517`** (`dd1764e9`, `open`) com a medição, os dois casos provados e a
receita do instrumento que falta: a varredura tem que sair da **pasta Enviados**
(é o que o aluno leu, é remoto, sobrevive a worktree), não das notas de cartão —
casar carta → objeto cobrado → `ref_id` no ledger. Postado no grupo.

⚠️ Se a lista final for grande, a 9-B manda **PARAR e chamar**, não devolver em
massa: devolução em massa é sintoma de bug, e o conserto é o bug.

---

## 5. O que NÃO fiz nesta ronda

Não mexi em plano, acesso, assinatura, migration, nginx, endpoint do RunPod nem
GPU. Nenhum merge, nenhum PR novo. Nada da planilha de SGP (ordem de 29/08). As
escritas em banco foram **três**: o estorno de 5.680 cr do `#224` (conferido), a
nota+status do `#224`, e a criação do `#517`. A única carta a aluno foi a uid
3139.

## 6. O que a próxima ronda herda

1. **`#517` é o item serial candidato**: é dinheiro declarado por escrito e não
   pago, com 3 alunos em cartão aberto. Começar pelos 3 abertos, por `ref_id`.
2. **PR #393** — hoje com 2h. Se amanhecer com mais de um dia aberto, cobre.
3. **A resposta A/B do Johnny sobre os 7.455 do `#224`** — e **eu prometi por
   escrito ao aluno** que volto com ela. Chegando a resposta, escreva pra ele no
   mesmo dia, inclusive se for não.
4. **`#494`**: o Lucas Medeiros reabriu em 20/09 com a queixa de corpo parado.
   O `#494` registra que faltam **7 alunos da classe com vídeo ainda não
   assistido**, e ele é um deles pela lente **nova** — o vídeo dele só foi visto
   pela lente velha (deriva de identidade).
5. **PR #351** (aviso de deriva nos dois tiers) é o conserto de classe do `#224`
   e está aberto desde 19/09.
6. Seguem de pé de 22h: **140 recados `para_frank_*`** (o mais velho ~429 h) e
   os **18 cartões `aguardando_aluno` com 7+ dias** ainda não triados — dos 3
   mais velhos, `#172` e `#206` foram medidos hoje e a bola é do aluno nos dois.
