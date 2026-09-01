# Rotina das Falhas — 30/08/2026, 17h20–18h UTC (= 14h20 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido antes de tocar em qualquer coisa. A ordem de 29/08
(`desligar_vigia_e_frank`) relida: **nada nesta ronda encosta na planilha** — não
li, não escrevi, não classifiquei, não reprocessei, e não abri chamado com causa
nela.

Ronda anterior: **falhas às 15h30Z** (Frank) e **Vigia às 16h UTC** (sensor).

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **1** (#192) |
| Em `aguardando_aluno` | **3** (#99, #196, #197) |
| **Alunos para quem escrevi** | **1** (Leonardo Fink, `leonardo.fink@icloud.com`) |
| Hipótese da ronda anterior que eu DERRUBEI com medição | **1** (Leonardo como "3º caso da classe") |
| Buraco de medição declarado impossível que eu FECHEI | **1** (`reference_rate_wps` nulo) |
| Defeito novo medido | **1** (mesma entrada → 1,9× de duração) |
| Armadilha de "duas contas" pega ANTES de mandar e-mail | **1** (`lhfink@gmail.com`) |
| Incidentes que eu FECHEI | **0** — e o motivo está no §5 |
| Fechados que voltaram a disparar | **0** |
| Crédito / GPU / migration / status de incidente tocados por mim | **nada** |

---

## 1. Confirmei o #199 antes de aceitar que estava fechado

A ronda das 15h30 deixou o #199 `investigating` dizendo "fecha na próxima se o PR
estiver na main". Ele chegou a mim já `fixed` (16:40:45Z). **Não herdei o status —
conferi os três degraus**, porque card "completed" e commit na main não são deploy:

1. `48401bf` está na `main` e em `origin/main`.
2. O teto existe no arquivo que roda: `MAX_REFERENCE_BYTES = 150 * 1024 * 1024`
   e o `if (totalBytes > MAX_REFERENCE_BYTES)` em
   `frontend/src/app/api/v1/images/generate/route.ts:60,204` — **antes** do débito.
3. Deploy: run `33322988664`, *Deploy Frontend (production)*, **success**, 16:37:38Z.

Os três batem. O `fixed` do #199 está **legítimo**. Registro porque a regra 14
exige que alguém confira, e a conferência não tinha sido feita por ninguém.

## 2. O caso que eu peguei: Leonardo Fink

O #192 segue travado em passo humano (§4), então pelo serial fui pro próximo com
aluno afetado. Ele veio da nota do Vigia das 16h26Z: `leonardo.fink@icloud.com`
reclamou às **15h46Z** no chat do app que o áudio saiu "um pouco rápido" e pediu
um controle de velocidade 0,8. Assinou **hoje**. Ninguém tinha escrito pra ele.

### O buraco que o Vigia declarou impossível, e por que ele não era

O Vigia foi honesto e explícito sobre o limite dele: *"eu NÃO medi a referência do
Leonardo contra a fala dele. Não posso: `reference_rate_wps` é nulo pra ele como
pra todo mundo"* (925 de 925 vozes).

Isso é verdade **da coluna, não do áudio**. A coluna está desligada porque o PR #92
nunca subiu — mas o `ref/auto.wav` e o dataset estão os dois no R2. Medi direto
(`_Bugs/2026-08-30_ritmo_leonardo/medir.cjs`, só leitura, ~R$0,10 de whisper,
**zero GPU e zero crédito de aluno**).

**Cuidado de método, que é o que faz a medida valer:** existem no projeto DUAS
definições de articulação e elas não são a mesma coisa — comparar uma com a outra
fabricaria o resultado. Então medi **os dois lados com o mesmo código, nas duas
definições**:

- (A) palavras / soma da duração das palavras — `medir_velocidade_voz.cjs` (#165)
- (B) palavras / (duração − pausas ≥ 0,15s) — `_words_per_second` do PR #92

| | A | B |
|---|---|---|
| **Ele**, mediana de 3 janelas de 30s (janelas 2,69 / 2,74 / 3,83) | **2,74** | **2,74** |
| **A referência** que o sistema escolheu (`ref/auto.wav`, 23,38s, 43 palavras) | **2,42** | **2,42** |
| razão referência / pessoa | **0,88×** | **0,88×** |

### O resultado derruba o enquadramento — e derruba na direção que importa

**A referência dele é 12% mais LENTA que ele**, não mais rápida. É o oposto do caso
Ellen do PR #92 (referência 3,7 contra pessoa 1,4 = 2,6× mais rápida). O Leonardo
**não é** da família "a referência não representa o ritmo da pessoa".

Isso não derruba o PR #92: a medição da Ellen continua de pé e o defeito que ele
conserta é real. O que fica medido é que ele é **incompleto** — existe pelo menos
um caminho pro mesmo sintoma que a escolha da referência não cobre. Levei ao Johnny
por Telegram, porque **a decisão de merge é dele** e essa informação muda a decisão.

### O que achei no lugar (e é ruler-free: duração é duração)

O **mesmo texto**, conferido por **md5 do `text_normalized`**, gerado 3× na mesma
voz em 5 minutos:

| geração | hora | duração |
|---|---|---|
| `4a4b92ad` | 15:56:52 | **3,392s** |
| `71d4ed19` | 15:57:41 | **6,476s** |
| `91d0f306` | 16:01:01 | **4,251s** |

**1,91× de espalhamento na mesma entrada.** Pela régua da entrega: `4a4b92ad` tem
0 pausa ≥0,15s e articulação 2,331; `71d4ed19` tem 4 pausas, mediana 816ms, 2,48s
de silêncio, articulação 1,986. Dos 3,07s de diferença, **2,48s (81%) são silêncio**
que apareceu num e não no outro.

**Limite da minha afirmação, dito na cara:** a instabilidade **não é uniforme** e eu
não vou vendê-la como maior do que é. O outro par idêntico do mesmo aluno (hash
`d1abdf23`, 72 chars) saiu **4,464s e 4,279s — 4% de diferença, estável**. Então o
que está medido é *"o mesmo texto pode variar 1,9×"*, **não** *"toda geração varia"*.
**Não sei a causa e não inventei uma.** E não julgo se a voz dele está rápida:
eu não ouço (14-C §4). O que eu afirmo é número, não gosto.

### Uma observação sobre o instrumento (não mexi, só registro)

O veredito binário do `medir_pausas_da_entrega.cjs` classificou o par
`4a4b92ad × 71d4ed19` como *"é RITMO DE FALA, não montagem"*, mas a decomposição
que ele mesmo imprime mostra **2,48s de silêncio contra 0,60s de tempo falando**.
Os dois olham pro mesmo dado e apontam pra lados diferentes. **Não mudei a
ferramenta e não descartei o veredito dela** — registro pra quem for mexer no ritmo
não decidir em cima só da frase final.

## 3. O que eu fiz pelo aluno

E-mail individual (regra 8, decido sozinho): SMTP do `suporte@`, bcc
`suporte@lucasarrial.com`, **ensaiado em `--dry-run` e lido inteiro antes de sair**,
assinado "Suporte FastCloner" — não assinei como Johnny.

Ele estava em silêncio de e-mail: **ZERO** em `Sent` pra ele, **ZERO** no INBOX
vindo dele. A única resposta que existia era a do chat do app, que sugeriu
**pontuação ou REGRAVAR**.

**Corrigi essa orientação, e esse é o ponto do e-mail.** Mandar o Leonardo regravar
35 minutos seria empurrar pra ele um teto que é **nosso** — a referência dele já é
mais lenta que a fala dele, regravar não mexe nisso. É o mesmo erro que este time
cometeu com o Luciano no #99 (pedir a quarta foto quando a terceira já estava certa).

O que **não** fiz no e-mail, de propósito: não prometi data, não prometi botão de
velocidade, e **não mandei "tenta de novo"** — cada tentativa gasta crédito dele, e
foi exatamente a frase *"tente de novo em alguns minutos"* que gerou a rajada do
#199. Não vou repetir o defeito que a ronda anterior acabou de consertar.

**Armadilha pega antes de mandar:** conferi o endereço contra `profiles` (lição do
Cladio Sitya) e apareceram **duas contas** com o nome dele — `lhfink@gmail.com`
(vazia, 0 crédito, sem acesso) e `leonardo.fink@icloud.com` (85.040 créditos, voz,
acesso até 06/09). É o caso Túlio (#195), que custou uma ronda inteira pra
diagnosticar. **Avisei ele no próprio e-mail** em qual conta está o material dele.

**Dinheiro:** nada devido. As 7 gerações dele estão `ready` com áudio entregue —
não há cobrança sem entrega nem estorno pendente. Saldo **85.040** conferido em
`profiles` (`credits_subscription` 85.040 + `credits_extra` 0), acesso até 06/09.
Eventual compensação pelos 2.000 créditos que ele gastou tentando **depois** de
reclamar é decisão **comercial, não minha** — registro e não executo, mesmo critério
dos 3.885 do Luciano.

Registrei tudo como nota no **#192** (nota 10), que é onde o Vigia já vinha
registrando a classe. **Não abri chamado novo**: a ordem de 27/08 §3 manda não
duplicar classe que já tem chamado aberto, e inflar a fila é o oposto do trabalho.

## 4. `#192` (Robert Ros) — oitava ronda no MESMO passo, e eu não fingi que andou

**Passo que falta: alguém OUVIR os áudios.** No grupo desde 30/08 02:03Z (~15h30),
queixa de 29/08 21:23Z (~20h). Veredito de qualidade de voz não é meu (14-C §4).
Dataset, referência e treino já foram medidos e estão íntegros — o gargalo não é
medição, e a minha medição do Leonardo **não substitui esse ouvido e não tenta**.

O mesmo ouvido destrava **duas** coisas: este chamado e o merge do PR #92 (draft há
2 dias, e o corpo dele diz que o que decide o merge é o antes×depois da Ellen).

## 5. Por que fechei ZERO incidentes, e por que isso não é ronda vazia

Os 4 itens da fila estão, cada um, num estado que **não é meu pra encerrar**:

- **#192** — falta ouvido humano. Fechar seria inventar veredito.
- **#99** (Luciano) — tecnicamente não há o que fazer; falta **decisão comercial do
  Johnny** e a **garantia vence 02/09, em 3 dias**. Escalado de novo hoje.
- **#196, #197** — `aguardando_aluno` desde hoje de manhã. A bola está com eles.

Regra 14 continua inteira: a ordem de 21/08 é pra fechar **mais**, não pra fechar
mais rápido do que se resolve. Quando o backlog não baixa porque os casos são
difíceis, a resposta legítima é dizer **qual passo emperrou em cada um** — é o que
está acima.

## 6. Varredura de saúde da fila

- **Fechados que voltaram a disparar: 0.** Conferi os `fixed`/`ignored` com
  `last_seen_at` nos últimos 3 dias. O **#6** (R2, `occurrences=7`) chama atenção,
  mas **não é reincidência**: último disparo 29/08 **15:50Z**, fechamento 29/08
  **17:44Z** — ele parou antes de ser fechado, não depois.
- **Os 3 alunos parados com crédito e sem voz não estão abandonados** — conferi
  `Sent` de cada um antes de escrever, pra não mandar aviso repetido:
  **Luan Marçal** (link do Drive fechado) escrito hoje 01:46Z; **Marcelo** escrito
  24/08, 27/08 e 29/08 23:50Z; **Kelin** escrita 4×, a última 29/08 23:54Z. A bola
  está com os três. **Não reescrevi ninguém: aviso repetido é ruído.**
- Nada com causa na planilha foi aberto, reprocessado ou reaberto.

## 7. Limites e o que eu NÃO fiz

- **Não li a caixa do `suporte@` pra triagem.** Só `--enviados --para <aluno>` e
  `--de <aluno>` nos casos que eu já estava tratando. A fonte foi a fila de incidents.
- **Não gastei GPU nem crédito de aluno.** O custo desta ronda foi ~R$0,15 de
  whisper (leitura de áudio), e nenhuma geração foi disparada.
- **Não mudei status de incidente nenhum.** O #192 sai `investigating` porque
  **está** investigating.
- **Não mexi no PR #92 e não mergeei nada.** A decisão é do Johnny; eu levei a
  medição, não a conclusão.
- **Regra 7, canal:** o post no grupo do WhatsApp **falhou por limite de máquina** —
  `avisar_grupo.cjs` aborta fora do Hetzner (`WAHA_API_URL/WAHA_API_KEY ausentes`,
  a WAHA só escuta em 127.0.0.1). **Medi, não supus.** Montei a mensagem com
  `--fato --seco` e levei os fatos pelo Telegram (message_id 651), que é o canal que
  a ordem de 20/08 define pra "alguém precisa SABER". O buraco é o mesmo registrado
  em 24/08 e continua aberto.
