# Rotina das Falhas — 26/08/2026, ronda das 19h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → já em dia (`a1f4125`).
Índice de ordens lido. Ronda anterior: 18h UTC (0 fechado, 1 fix em produção).

**Placar honesto: 1 aluna destravada e avisada (Ivanilde), 0 incidente fechado,
0 código escrito, 0 crédito devido. O achado da ronda é que uma promessa nossa
tinha sido CUMPRIDA e nunca contada — a voz dela estava pronta há 41h e ela não
sabia.**

Digo já o que não fiz: não fechei chamado nenhum, porque nenhum dos abertos
estava resolvido e o serial que peguei tem um terceiro aluno ainda sem voz.

---

## 1. O serial: `#65` (`5c3f1f8b`) — o mais antigo com aluno esperando por NÓS

Escolhi pelo critério da regra 8. O `#47` é mais velho (19/08), mas a Kátia
recebeu entrega **e** e-mail em 25/08 22:48/22:55Z — a bola é dela há ~20h, e
esperar aluno não é estar travado. O `#65` (20/08) tinha 3 pagantes, e eu fui
conferir o estado de cada um antes de qualquer coisa — passo (1) da rotina,
*"já resolveu sozinho?"*.

Resultado: **dos 3, dois já estavam resolvidos e um estava esperando só um
aviso que ninguém mandou.**

### 1.1 Ivanilde — o buraco, e é o tipo que dói

O e-mail de 24/08 21:52Z (Enviados uid 57) prometeu **duas** coisas: reprocessar
o áudio por conta da casa, e *"assim que a sua voz estiver pronta, você recebe um
aviso"*.

| promessa | estado medido |
|---|---|
| reprocessar por nossa conta | **CUMPRIDA.** Voz `4c2c4abc` "IVA voz" virou `ready` em **24/08 22:53 BRT** (25/08 01:53Z), 1843s, com amostra automática `28e817cd` (5,6s, `audio_path .../sample.wav`) no mesmo minuto |
| avisar quando ficasse pronta | **NÃO CUMPRIDA.** Até hoje os Enviados dela tinham **um único** e-mail, o uid 57 |

Ou seja: o trabalho técnico saiu **4 horas depois** do e-mail, e ela ficou ~41h
com a voz pronta sem saber. É o padrão do caso Katia — promessa de refazer que
fica sem dono — só que aqui a parte cara já tinha sido feita e o que faltava
custava um e-mail.

**Crédito conferido no extrato INTEIRO (6 lançamentos, não amostra):** os dois
treinos de 08/08 (-10.000 cada, ref `4c2c4abc` e `4b4567fe`) têm os dois estornos
correspondentes (+10.000, **`ref_type='voice_train_refund'`**, 17:19 e 17:22). O
retreino da casa **não gerou débito nenhum**. Saldo 200.000 intacto, acesso até
08/09. **Nada a devolver.** (Conferido por `ref_type`, não por `kind` — a
armadilha medida na ordem de 20/08.)

**Ação:** e-mail enviado — **Enviados uid 152, 26/08 18:45:11Z**, assunto
*"Ivanilde, a sua voz ficou pronta (e nao custou credito)"*. Conferido **nos
Enviados depois de enviar**, não no retorno do script.

O e-mail assume o atraso do aviso como falha nossa, dá o saldo e a data, não
promete que a voz ficou perfeita (pede que ela ouça e responda), e resolve uma
armadilha de tela que eu medi no código:

> Ela vê **duas linhas com o nome idêntico "IVA voz" e a MESMA data 08/08/2026**
> em Clonagem de Voz — `voice-cloning/page.tsx` ordena por `created_at desc` e
> mostra só nome + data, então a que **falhou** (criada 17:21) fica **em cima** e
> a boa (17:18) embaixo. A única coisa que as separa é o badge `Falhou` × `Pronta`.
> Escrevi no e-mail qual é qual. Não é bug de dado — o histórico está certo — é
> aresta de leitura. **Não mexi em código por isso nesta ronda**; fica registrado
> na nota do chamado para quem tratar a tela.

### 1.2 Cláudio Sityá — resolveu sozinho, e nunca precisou de nós

Voz **nova** "Cláudio Sityá" `ready`, 35min, treinada 22/08 18:26. Está
**produzindo**: áudios 22/08 18:33, 24/08 01:47 e 24/08 16:34; vídeo clone 24/08
02:23. A voz que falhou em 15/08 — a dos 20 arquivos do Drive, 19 deles não-áudio,
descrita na ordem de 21/08 — foi estornada no mesmo minuto (+10.000, 15/08 18:35).
Saldo 182.992, acesso até 13/09.

Registro uma coisa que estava mal contada: **nunca lhe foi enviado e-mail nenhum**
(busca nos Enviados por `csitya100@`, `csitya@csitya.com`, `sitya` e `csitya`:
zero resultados). E hoje **não cabe mais escrever** — seria remexer num caso que
ele mesmo fechou há 4 dias. A armadilha das duas contas registrada na ordem de
21/08 fica sem efeito porque não há e-mail a mandar.

### 1.3 Marcelo — continua sem voz, e a bola é dele

Voz `f6f82819` segue `failed`; a `error_message` atual diz *"O áudio enviado tem
mais de uma pessoa falando (gravação de entrevista)"*. Respondido em 24/08 21:52Z
(Enviados uid 58) com o estorno confirmado. **~45h** — o gatilho de segunda
tentativa é 7d+. É o **único** dos 3 que ainda aparece na varredura de "acesso
vivo sem voz pronta".

**Ressalva honesta:** eu **não re-medi** o áudio dele nesta ronda; aceito a
medição da ronda que reescreveu a mensagem. Se ele responder dizendo que só ele
fala na gravação, o diagnóstico precisa ser refeito do zero antes de repetir a
orientação.

### 1.4 Por que NÃO fechei o `#65`

2 de 3 resolvidos não é 3 de 3. O título diz *"3 alunos sem voz pronta"* e o
Marcelo continua sem. Mantive `aguardando_aluno`, que é o estado honesto (a bola
está com ele), em vez de marcar `fixed` com um aluno ainda sem voz — **regra 14**.

Nota gravada: `#65`, **18 → 19 notas**, `.select()` conferido na volta, **1 linha
afetada**.

---

## 2. O susto que eu fui conferir antes de agir — e que teria virado 5 e-mails de ruído

Vindo do achado da Ivanilde, fui aplicar o mesmo teste no `#72` (upload
silencioso, **7 alunos**, `aguardando_aluno` desde 21/08 — o maior grupo de gente
afetada da fila). Busquei os Enviados dos 7:

| aluno | e-mail nosso |
|---|---|
| `leandro.fitoway` | uid 67, 25/08 00:47Z |
| `jrfengenhariadf` | uid 65 (24/08 23:50Z) + uid 79 (25/08 12:52Z) |
| `dirceu.moura.cruz78` | **nenhum** |
| `fabiobragaclone` | **nenhum** |
| `catarinacouras` | **nenhum** |
| `natali.marcio` | **nenhum** |
| `sidbae` | **nenhum** |

**Cinco de sete sem e-mail nenhum, num chamado marcado `aguardando_aluno`** — um
status que afirma que a bola está com o aluno. A leitura óbvia era "cinco pessoas
esperando em silêncio", e a tentação era escrever para as cinco na hora.

**Fui medir antes, e a leitura óbvia estava errada: as 5 se resolveram sozinhas.**

| aluno | voz `ready` | quando |
|---|---|---|
| `catarinacouras` | 1211s | 06/08 18:08 (3h após a recusa) |
| `fabiobragaclone` | 1498s | 03/08 16:01 (2h após) |
| `sidbae` | 2174s | 10/08 12:15 (após 4 recusas) |
| `dirceu.moura.cruz78` | 1646s | 16/08 21:17 |
| `natali.marcio` | 1804s e 2291s (duas) | 19/07 e 24/07 |

Escrever para elas seria exatamente o ruído que a ronda das 18h evitou no caso
do Leandro. **Não escrevi para nenhuma.**

E confirma, por medição independente, o que o Vigia já tinha anotado em 25/08
16h16Z (*"dos 7, exatamente 2 seguem com zero voz pronta"*). Bate. Sem objeção.

### 2.1 A única pergunta de dinheiro que isso levantou — e está limpa

O `dirceu` chamou atenção porque, **depois** de já ter voz pronta em 16/08, ele
teve mais **3 treinos `failed`** (17/08 21:42, 17/08 21:45, 18/08 00:21). Três
débitos de 10.000 = 30.000 créditos.

Conferido no extrato, por `ref_type`: os **três** têm estorno
`voice_train_refund` de +10.000, **no mesmo minuto** de cada débito. **Nada
devido.** Saldo 164.286, acesso até 15/09.

---

## 3. Os 4 abertos: nenhum avançou, e digo em que passo cada um trava

Não toquei em nenhum. O diagnóstico das 17h/18h continua de pé e eu não tenho
trabalho técnico disponível em cima deles:

- **`52`** — trava em **esperar um treino NOVO passar pelo worker novo** e ler o
  ramo no log (`voice.train.transcript_cura`). Sem isso, as duas hipóteses
  seguem sendo chute. **Sem falha nova**: a última continua sendo a `03af4c2b`
  das 15h47Z, e nas ~3h desta ronda não houve nenhuma.
- **`97`** — decisão de produto do Johnny, formulada em 24/08. ~**54h**. Os 3
  afetados já foram estornados e respondidos.
- **`99`** (Luciano) — decisão comercial. Aluno já avisado. O prazo de garantia
  medido pelo Vigia às 18h (`warranty_date` = **02/09**, campo em `data.product`)
  dá ~6 dias de janela.
- **`143`** — precisa de **uma linha** de decisão sobre o cron, não de
  investigação. Não mexi em agendamento: muda o custo da operação e a ordem é do
  Johnny.

---

## 4. Duas coisas na mão do Johnny que a lista das 18h NÃO citou, e têm gente esperando

Isto é o acréscimo desta ronda ao que já estava escalado. Ambas saíram do exame
dos `aguardando_aluno`:

1. **`#120` — Sandra Diniz, PRÉ-VENDA, ~54h.** Ela quer **assinar o Pro** e fez 7
   perguntas. Os itens 1–4 foram respondidos em 24/08 12:50Z (Enviados uid 8). Os
   itens **6 (política de reembolso pós-treino)** e **7 (versão final dos Termos)**
   estão parados esperando Johnny/Lucas — responder é escrever política pública da
   empresa, e não é minha para tomar. É a única da fila com **dinheiro entrando**
   do outro lado.
2. **`#133` — Giovanna, ~21h.** O e-mail de 25/08 21:49Z prometeu, com todas as
   letras: os **30.000 créditos** dos três treinos e os **7 dias extras** estão
   *"com o meu sócio para decidir"* e *"assim que ele decidir, eu te escrevo"*.
   Ela não está travada (70.000 créditos, acesso até 12/09), mas a promessa tem
   dono e o dono é o Johnny. Ela também ainda não respondeu o *"pode retreinar"*.

---

## 5. Fila conferida no fim

- **Abertos: 4** (`52`, `97`, `99`, `143`) — mesmo número da entrada, ninguém
  entrou, ninguém saiu.
- **`aguardando_aluno`: 7** — inalterado.
- **Falhas de geração nas últimas 4h: 3**, todas anteriores a esta ronda
  (15h01, 15h06, 15h47). **Nenhuma nova.**
- Nota gravada nesta ronda: `#65` (19 notas), 1 linha afetada, conferida na
  releitura.

---

## 6. Placar, sem inflar

- **1 aluna destravada e avisada** (Ivanilde) — a única entrega de verdade da ronda.
- **1 promessa cumprida-mas-não-contada** achada e fechada.
- **0 incidente fechado** — o `#65` tem um terceiro aluno ainda sem voz.
- **5 e-mails que eu NÃO mandei** porque medi antes e as pessoas já tinham se
  resolvido sozinhas.
- **30.000 créditos conferidos** (dirceu) e **200.000** (Ivanilde): **nada devido**.
- **2 pendências do Johnny** que não estavam na lista das 18h, uma delas com
  venda parada há 54h.
- **0 código, 0 PR, 0 migration aplicada, 0 cron tocado, 0 crédito, 0 GPU, 0 whisper.**

---

## 7. Para quem pegar a próxima ronda

- **Não redesigne o `#72` como "5 alunos sem resposta".** Eles não têm e-mail
  nosso porque **não precisam** — os cinco têm voz `ready` e se resolveram
  sozinhos. Está medido na seção 2.
- O **serial vivo** é o Marcelo (`#65`). Bola com ele desde 24/08 21:52Z; só vira
  nosso de novo se ele responder, ou em 7d+ (ou seja, a partir de **31/08**).
- Se o Johnny liberar, o `#120` (Sandra) é o próximo com valor: é venda parada,
  não conserto.
