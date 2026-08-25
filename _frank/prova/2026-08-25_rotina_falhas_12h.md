# Rotina das Falhas — 25/08/2026, ~12h UTC (Claude, dono da fila)

`git checkout main && git pull --ff-only origin main` → já estava em dia (40876cc).
Índice de ordens lido. Método serial (regra 8): peguei **um** incidente, o mais
antigo com aluno esperando, e levei até o fim antes de olhar o próximo.

## Placar

| | |
|---|---|
| Fila no início | **7** abertos (o vigia das 06h contou 6; o `128` nasceu às 10:51, depois da ronda dele) |
| Fila no fim | **5** |
| Fechados por mim | **2** — `65` (aguardando_aluno) e `128` (ignored) |
| Alunos avisados por mim | **0** — os 3 em jogo já tinham e-mail recente e correto (§1, §4) |
| Escalado ao Johnny na hora | **1** — jrf, acesso vence HOJE (§4) |
| Cards abertos pro coder | **2** — `c5502a7c` e `04cd3bcf` |
| Crédito/acesso que eu mexi | **nenhum** |
| GPU que eu queimei | **nenhuma** |

---

## 1. Incidente escolhido: `5c3f1f8b` (#65) — pagantes sem nenhuma voz pronta

Mais antigo com aluno afetado (113h). Estado medido hoje, aluno por aluno:

| aluno | hoje |
|---|---|
| csitya100 | voz `7b60fd7a` **ready**, 3 gerações (últ. 24/08 16:34) → **resolvido** |
| ivanildezuca | voz `4c2c4abc` **ready**, 1 geração 25/08 01:53 → **resolvido** |
| marcelopersonalthe32 | voz `f6f82819` **failed** desde 10/08 → era o que faltava |

### O que a ronda anterior deixou no meio

Achei a ronda das ~10h **sem log e sem commit**: uma branch
`feat/guarda-voz-multi-locutor` **vazia** e uma pasta de análise em
`frontend/_Bugs/marcelo_pitch/` (ignorada pelo git). O que ela fez está no banco:
rodou o resgate na voz `f6f82819` **em cima do arquivo que a ronda de 24/08 22h
já tinha VETADO** por conter 2 pessoas, e depois devolveu a voz pra `failed` na
mão. Retomei daí em vez de refazer o caminho.

### O veto estava certo, e agora tem número

O treino **completou** (`training_jobs` `08a1322b`, 500 steps, 330s,
`useful_seconds` 2399). Medi F0 por autocorrelação nos arquivos que ela baixou:

| arquivo | F0 mediana | p25 / p75 | IQR | masculino |
|---|---|---|---|---|
| `sample.wav` (saída do clone) | **197,5 Hz** | 186,0 / 219,2 | 33 | **8,4%** |
| `ref/auto.wav` (referência que o treino escolheu) | 192,8 Hz | 97,6 / 250,0 | **152** | 46,3% |
| `origem.mp3` (o que o aluno enviou) | 161,6 Hz | 101,3 / 210,5 | 109 | 49,5% |

Leitura: a referência automática pegou **os dois locutores no mesmo clipe** e o
clone saiu **mulher** — 91,6% das janelas na faixa feminina. Entregar aquilo pro
Marcelo seria entregar a voz da entrevistadora. **Não é cautela, é medição.**

Varri **60 vozes `ready`** da base com o mesmo critério: **0 suspeitas**, IQR
**máximo 82 Hz** entre as limpas contra **152 Hz** na do Marcelo. Classe **n=1**
— não inflei em incidente novo, e o corte de 100 Hz do card cai no vazio entre
as duas populações.

### O estrago que essa mesma ronda criou, e que eu consertei

O `finalize-training` faz o que sempre faz quando o treino conclui: grava a
amostra automática como linha **`ready`** em `generations` (`0fc7b84c`, 10:49:04).
A voz voltou pra `failed` às 10:50:48 — **mas a linha ficou**.

E `GET /api/v1/generations` lista **por `user_id`, sem olhar o status da voz**.
Ou seja: o Marcelo abrindo o histórico tinha um áudio **tocável**, com o nome
"VOZ MARCELO", que **é a voz de outra pessoa**. Voz `failed` no banco não esconde
nada do aluno.

Apaguei a linha e o objeto no R2, conferindo **depois** de gravar: 1 linha
apagada, `HeadObject` confirma ausência, 0 linhas com o id. Ferramenta nova
`_frank/ferramentas/retirar_amostra.cjs`.

**Medi a classe antes de sair varrendo:** 3 linhas nesse estado na base inteira,
e **só a do Marcelo** é de voz `failed` com locutor errado provado. As outras
duas (`anderferri85`, `institutoforumpublico`) são de voz `awaiting_training` —
amostra da voz do **próprio** aluno, de um treino que deu certo antes. **Não
toquei.** A ferramenta é por id de propósito, não tem modo varredura.

### Por que `aguardando_aluno` e não `fixed`

O Marcelo **segue pagante sem voz pronta**. Do nosso lado não há mais nada
pendente: a falha de 10/08 era `[Errno 28] No space left on device`
(`training_jobs` `76cdefc2`, morreu antes de treinar), **n=1 na base**, não é bug
vivo; o estorno está confirmado **por `ref_type=voice_train_refund`** (+10.000 em
10/08 10:43) com saldo 198.950 intacto; e ele foi avisado com a verdade em **24/08
21:52** (uid 58 em Enviados), com as duas réguas certas — 20min de áudio somado e
10min de fala limpa. O único passo que falta é ele enviar gravação só com a voz
dele.

**Não reescrevi pra ele.** O retreino de hoje não muda nada do que ele precisa
fazer, e um segundo e-mail contando que treinamos escondido e produzimos a voz de
outra pessoa só confunde quem já recebeu a orientação certa.

Marcar `fixed` seria carimbar resolvido em cima de um pagante sem produto.
`aguardando_aluno` diz a verdade: **a bola não está mais comigo**.

## 2. `128` — a fila inventou um incidente sozinha, e a culpa é nossa

Aberto automaticamente **25/08 10:51:00**, doze segundos depois de a ronda das 10h
escrever **à mão** o `error_message` da voz (`updated_at` 10:50:48).
`occurrences=1`, `last_seen_at=10/08` (o `created_at` da voz): **zero falha nova
em produção**.

O detector não distingue explicação que um humano escreveu pro aluno de erro que
o worker cuspiu — qualquer texto gravado em `voices.error_message` vira incidente.
Fechado como **`ignored`**, duplicata do `65`.

## 3. Duas correções de campo (nenhuma muda diagnóstico)

**`anotar_incidente.cjs` recusava `aguardando_aluno`.** O status já existia no
banco (`120`, `124`) e a ferramenta não deixava gravar — o que empurra quem fecha
um caso desses pro `fixed`, carimbando "resolvido" onde só se espera o aluno.
Adicionado, e **fora de `STATUS_FECHADO` de propósito**, pra não carimbar
`resolved_at`.

**Incidente aberto com carimbo de resolvido.** Ao mover o `65` percebi que ele
carregava `resolved_at=21/08 18:41` do fechamento antigo, porque a ferramenta só
mexia no carimbo ao **fechar**. Qualquer relatório que leia `resolved_at` mente.
Corrigido na ferramenta (sair de fechado → apaga o carimbo) e limpei os que já
estavam assim: `65`, `72`, e mais **`97`, `99` e `108`** (`UPDATE ... RETURNING`,
3 linhas confirmadas). Deixei `resolved_commit` onde estava: aponta pra commit que
existiu de verdade, é história, não mentira de data.

## 4. Próximo da fila: `2c5bab42` (#72) — e um relógio que fecha hoje

Medi os 7, um por um: **5 se recuperaram** e estão produzindo (fabiobragaclone,
catarinacouras, sidbae, dirceu.moura.cruz78, natali.marcio). **Sobram 2 com zero
voz `ready`:**

| aluno | preso desde | acesso vence |
|---|---|---|
| **jrfengenhariadf** | 25/07 (31 dias) | **HOJE, 25/08** |
| **leandro.fitoway** | 30/07 | 29/08 |

Os dois já foram avisados (jrf uid 65 em 24/08 23:50; leandro na ronda das 00h).
**Não reescrevi:** nada mudou desde então, e repetir e-mail não é progresso.

**Escalei ao Johnny na hora, não esperei este relatório** (Telegram, message_id
420): o acesso do jrf vence hoje, ele pagou **2 ciclos**, tem 100.000 créditos
intactos, nunca foi cobrado, e **nunca recebeu o produto**. Mais grave: o e-mail
que a casa mandou pra ele **promete** que ele seria avisado assim que houvesse
definição. A promessa foi feita no nosso nome e o prazo é hoje. Estender acesso é
decisão dele — **não toquei em `entitlements`**.

### Achado novo, e este é bug vivo atingindo aluno que ainda nem chegou

`frontend/src/lib/voices/regua-audio.ts`, `mensagemEnvioIncompleto()`, termina
**sempre** com *"Não é que você gravou pouco — a MESMA gravação serve. Envie de
novo"*.

Pro jrf isso é **mentira**, e a aritmética dele prova: chegaram 4 de 7 arquivos =
617s; projetando os 7 pela média, 617/4×7 ≈ **1080s = 18min**, e o portão exige
**20min** (`MIN_DURATION_SECONDS`, `voice-creator.tsx:11`). **Mesmo se os 7
tivessem chegado inteiros ele seria recusado.** A mensagem manda o aluno reenviar
exatamente a mesma coisa e ser recusado pela **terceira** vez achando que a culpa
é dele.

É a armadilha da ordem de 21/08 (mandar a régua errada) escrita **dentro do código
de produção**, e atinge **todo** aluno que cair nesse caminho, não só estes 7.
**Não mexi em produção nesta ronda** — virou card.

O `72` **segue `investigating`** de propósito: 2 pagantes ainda sem voz e o defeito
ainda está no ar. Já descartei: não é portão de duração errado (conferido, 20min) e
não é falta de estorno (nenhum dos dois foi cobrado).

## 5. Cards abertos (código vai por branch + PR, nunca na main)

| card | dono | o que é |
|---|---|---|
| `c5502a7c` | coder | Gate de multi-locutor no `resgatar_voz.cjs`: recusa **antes** da GPU quando a referência tem 2 locutores (IQR>100Hz e os dois lados do corte de 160Hz >20%). Escopo fechado: **só a ferramenta interna**, proibido tocar no treino de produção — bloquear aluno de verdade com heurística é decisão do Johnny. PR tem que trazer a saída recusando a `f6f82819` e passando numa voz limpa. |
| `04cd3bcf` | coder | Projetar o total antes de prometer que "a mesma gravação serve", com teste pros dois ramos usando os números do jrf. |

Nenhum dos dois entrou em produção nesta ronda. **Card "completed" no board não é
produção — só a main deploya.**

---

## O que eu NÃO fiz

- Não queimei GPU e não mexi em crédito nem em acesso de ninguém.
- Não escrevi pra aluno: os 3 em jogo já tinham e-mail recente, correto e com as
  réguas certas. Mandar de novo seria ruído, não atendimento.
- Não mergeei nada na main além deste log e das duas correções de ferramenta.
- Não toquei nas 2 amostras órfãs de voz `awaiting_training` — não são o defeito
  que medi.
- Não postei no grupo do WhatsApp: `WAHA_API_URL/WAHA_API_KEY` não existem nesta
  máquina (a WAHA só escuta em 127.0.0.1 no servidor). Usei o Telegram, que é o
  canal que eu tenho aqui. **Fica registrado que o canal do Lucas não sai desta
  máquina** — quem rodar a ronda daqui não consegue cumprir a regra 7 por WhatsApp.

## Fila no fim: 5

`72` (2 alunos, o de hoje escalado) · `97` · `99` · `108` · `123`
