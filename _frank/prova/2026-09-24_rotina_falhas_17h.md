# Ronda das falhas — 24/09 ~16h41–17h10Z (Frank, dono da fila)

**Desfecho: 1 voz de aluno pagante CURADA em produção com consentimento escrito
dele, 1 carta enviada, 1 chamado novo (`#553`), e o instrumento da própria ronda
consertado depois de 4 dias abortando — incluindo a descoberta de que a minha
primeira prova desse conserto não provava nada.**

Gasto: **zero GPU, zero retreino, zero crédito de aluno movido, zero migration,
zero DDL, zero merge, zero assinatura tocada.** Gasto real: transcrições Whisper
de uma gravação de 28,8 min e de 6 clipes (~centavos). Escritas: 1 referência de
voz trocada (com backup), 1 incidente aberto, 1 nota, 1 carta, 1 branch + 1 PR,
1 recado no grupo, este log.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=…14:06:31Z --confirmar` | **0** escriturável. **1205 = 1205**, nenhuma carta sumiu (1128 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controles positivo (#310) e negativo (#518) OK, 538 varridos. |
| `pagante_trancado.cjs` | **0** pagante trancado · **0 na fronteira** · 1 sem prova (`drfabiovilhena29@`, 5º dia) |
| Censo da fila | **118** abertos (+1) · 69 com 7d+ |
| `esperando_johnny` | **17** parados em decisão · mais velho **56d** · **54 alunos** atrás da fila |
| `conserto_pronto_e_parado` | **40** mergeáveis parados (+1) · 24 há 3d+ · **19** apodrecidos · mais velho 35d |

---

## 2. O instrumento da ronda: 4º dia abortando, consertado — e a prova que eu quase escrevi errado

### 2.1 O defeito

`conserto_pronto_e_parado.cjs` **abortou na 1ª execução**, com **59 PRs em
`UNKNOWN`**. É o **4º dia seguido** (21, 22, 23 e 24/09: 57, 58, 59). As três
rondas anteriores anotaram e seguiram.

A causa: o `gh pr view` **não responde** a mergeabilidade, ele a **encomenda**. O
GitHub calcula o merge de teste em background e devolve `UNKNOWN` enquanto não
termina. Numa rajada de ~60 views em segundos, quase todos chegam antes da conta
ficar pronta.

> **A ferramenta só funcionava porque era rodada duas vezes, por acidente.** O
> número da ronda dependia de alguém ter a paciência de repetir o comando.

O conserto **não afrouxa a trava do zero cego** — dá ao GitHub o tempo que ele
pediu: reconsulta **só** os `UNKNOWN`, em até 4 passadas (2s, 4s, 8s, 16s).
Sobrou `UNKNOWN` depois disso, morre igual antes.

### 2.2 A prova que não provava nada

Rodei o script consertado contra o GitHub: passou, 40 limpos / 19 podres. **Ia
escrever isso como prova.** Antes disso rodei o mutante (`ESPERAS = []`, o script
**sem** o conserto) e **ele passou também**.

Motivo: a execução que falhou minutos antes já tinha encomendado os 59 cálculos,
e a resposta veio do **cache quente**. **A execução ao vivo não distingue o
script consertado do script quebrado** — ela mede o estado do cache do GitHub,
não o meu código. Chamar aquilo de prova seria o "done falso" da ordem de 19/08.

Por isso a prova virou um `gh` **falso**: 1º `pr view` de cada PR devolve
`UNKNOWN`, do 2º em diante o valor real. Não depende de rede, cache nem hora.

| caso | esperado | resultado |
|---|---|---|
| com a reconsulta | não morre; 3 PRs, 2 limpos + 1 podre | ✅ |
| **MUTANTE sem a reconsulta**, mesmo `gh` falso | **MORRE** | ✅ **o teste discrimina** |
| `UNKNOWN` eterno | morre mesmo com reconsulta | ✅ trava do zero cego viva |

`node --test` → **3 pass / 0 fail**. **PR #430**, não mergeado.

---

## 3. Item serial: `#537` / `cfa488b5` — Christian — **CURADO E RESPONDIDO**

### 3.1 Por que este e não um mais velho

Fila lida por `first_seen_at`. Os mais velhos **não estão no meu colo**:

| cartão | idade | por que não é este |
|---|---|---|
| `0e04bd97` | 57,7d | conserto já escrito, PR #429 |
| `d3d8d1b2` | 56,2d | marcado esperando merge/decisão do Johnny (PR #404) |
| `132f7808` (Glauber) | 20,0d | depende do aval de telefone/WhatsApp — lote do **#249**, na mesa do Johnny desde 19/09 |
| `8c29740f` (Andy) | 20,0d | idem |
| `94d3015d` (Sunesa) | 17,2d | idem |

Este tinha um fato novo de 3h antes: o **consentimento do aluno, por escrito**.
O Vigia registrou às 16:21Z que o Christian respondeu 13:21Z *"Pode trocar o
pedaço da voz por outro trecho da gravação, por favor."*

> **Consentimento parado apodrece igual card parado.** A casa ofereceu às 11:50Z,
> ele disse sim às 13:21Z. Não executar hoje seria repetir, em miniatura, os 16
> dias de silêncio que a ordem de 17/09 existe pra proibir.

### 3.2 A ferramenta de cura da casa não conseguiu curar esta voz

Rodei o caminho provado — `_heal_ref_boundary.cjs`, o mesmo que curou a Aline em
23/09. **Abortou:** `pausas naturais detectadas: 0` em **28,8 min de fala**.

Zero pausa em 28,8 minutos é implausível. Fui medir o **arquivo** antes de
culpar o áudio, que é o que a armadilha do "TREINO QUE FALHA" manda fazer:

```
volumedetect : mean_volume -12,9 dB · max 0,0 dB · 53.389 amostras estourando em 0 dB
silencedetect d=0,35s :  -35 dB → 0 · -40 → 0 · -45 → 0 · -50 → 0 · -55 → 0 · -60 → 0
silencedetect d=0,20s :  -35 → 0 · -30 → 0 · -25 → 1 pausa
RMS por janela de 60s :  travado entre -17,0 e -12,1 dB pelos 28,8 min
```

**Diagnóstico: AGC / compressor do aparelho.** O ganho automático *preenche* o
silêncio com ruído de sala no mesmo nível da voz. Não há vale de energia pra
detectar, e **não existe limiar que resolva** — a -60 dB ainda dá zero.

Não é bug do `_heal_ref_boundary`: é uma **premissa** dele ("pausa é um trecho
quieto") que esta gravação viola. Virou o chamado **`#553`** (§4).

> **Armadilha de medição que eu mesmo pisei, e registro:** minha 1ª passada rodou
> `volumedetect` com `-v error`, que **suprime a saída do filtro**. Eu li a
> ausência de saída como ausência de som. **Número que não aparece não é número
> que vale zero.** Refiz com `-v info`.

### 3.3 O caminho que funciona, e o controle que reprovou metade das candidatas

`fabricar_referencia.cjs` corta por **timestamp de palavra** (whisper-1,
`timestamp_granularities=word`), não por energia — o AGC não o cega. É o caminho
que a casa já tem em produção (`marcarFimDeFrase`, PR #151/#379).

O instrumento tem **controle atômico**: corta o clipe e **re-transcreve o clipe
cortado**, comparando a borda real com a janela escolhida.

| candidata | score | veredito do controle |
|---|---|---|
| #1 | 2,33 | ❌ clipe termina em "mas…", janela dizia "né" |
| #2 | 2,28 | ❌ mesma borda |
| #3 | 2,22 | ❌ início "que" vs "o", fim "mas" vs "né" |
| #4 | 2,09 | ✅ passou, mas termina em reticências |
| #5 | 2,04 | ✅ passou, termina em reticências |
| **#6** | **2,04** | ✅ **passou e fecha em pergunta** |

Escolhi a **#6** pela pontuação terminal: o VoxCPM gera em modo *"continue este
áudio"*, então cauda inacabada é risco.

> **Que o controle tenha REPROVADO 3 de 6 é o que me deixa confiar no "passou"
> das outras.** Controle que aprova tudo não mede nada — foi a lição da ronda das
> 11h50Z neste mesmo cartão, aplicada de volta.

### 3.4 O score pelo worker de verdade — e por que ele **não** é a prova

Rodei `score_reference_transcript` direto de `runpod-worker/voice_pipeline/reference.py`
(com stub das libs de áudio, só a função de texto):

```
9,0  ref ANTIGA (o encerramento)   ← reproduz EXATAMENTE o 9,0 da nota de 11h50Z
3,0  #4     3,4  #5     2,5  #6    ← a aplicada é a #6
```

**Ressalva na frente do número, e ela é o próprio achado deste cartão:** o corte
de candidata ruim é **25**, e a referência podre tirava **9,0**. A heurística
**aprovava o defeito**. A prova é o **conteúdo** (deixou de ser ele administrando
arquivo) e a **borda** (§3.5). O score entra como corroboração, não como veredito.

### 3.5 O ouvido faltou — declarado, não disfarçado

Ordem de 17/09: percepção é **despacho**, não parada. **Despachei** — montei par
**cego** (A = ref atual, B = ref nova, sem dizer qual é qual) e mandei pro `olho`.

**Falhou: retornou VAZIO, 0 token de saída, 4s.** Testei os outros dois workers
do mesmo modelo: `social` VAZIO 3s, `pesquisa` VAZIO 3s. **3 de 3** → é o
**crédito do Gemini**, que já está na lista do Johnny, **não a tarefa**. Bloqueio
REAL, com motivo concreto e data.

Sem ouvido, medi a borda por energia, que é objetiva (`mean_volume` dos 120 ms de
cada ponta contra o corpo):

| | início | fim | corpo | leitura |
|---|---|---|---|---|
| ref **antiga** | -12,4 dB | -10,5 dB | -14,3 dB | pontas **mais altas** que o corpo → começa e termina no meio de fala alta |
| ref **nova** | -30,4 dB | -42,2 dB | -22,7 dB | pontas em vale → fronteira natural |

Isso **mais** a re-transcrição atômica (frase inteira, começa em maiúscula, fecha
em `?`) é o que sustenta a decisão. **Não afirmo que ouvi. Não ouvi.**

### 3.6 O que foi escrito em produção, conferido DEPOIS de gravar

Voz `8225f199-e0d6-4e1f-af5d-10929fd7a4ff` ("CHRIS 03").

- `reference_transcript`: 368 chars (o encerramento) → **347 chars / 60 palavras**.
  `updated_at` **2026-09-24T16:56:47Z**.
- R2 `ref/auto.wav` sobrescrito. **Conferido por leitura independente:** baixei o
  objeto de volta do bucket e o **md5 bate com o clipe** (`ce322b188eb824e3811594e0a590e1e4`), 25,6s.
- Releitura do banco **por id inteiro** confirma o texto novo e a ausência de
  "encerrar essa gravação".
- **Reversível:** backup em `ref/auto.bak-2026-09-24-xxi2.wav` + transcript antigo
  em disco.

> **Segunda armadilha pisada e registrada:** minha 1ª releitura usou
> `.limit(5000)` + filtro por prefixo no cliente e **voltou vazia** — é o corte de
> 1000 linhas do Supabase que as minhas próprias ordens documentam. Refiz com
> `.eq()` no id inteiro. **Quase li "sumiu" onde estava escrito "paginação".**

### 3.7 A carta (regra 8: individual, decido sozinho)

Enviados **uid 3375**, cópia **CONFIRMADA** na 1ª tentativa, registrada em
`emails_enviados` (chave `referencia-trocada-chris-cfa488b5`).

Diz: (a) cita **literalmente** o trecho velho e o novo, pra ele conferir sem
depender da minha palavra; (b) não custou crédito, não regravou, não retreinou;
(c) gerações **antigas não se refazem sozinhas** — só as novas herdam; (d)
**declara que eu não ouvi** e pede que ele gere algo curto e responda se
melhorou/igual/piorou; (e) oferece **desfazer** ou trocar de trecho; (f) sobre os
30.000 cr, repete que está com quem decide, **sem prometer valor nem data**.

Não é promessa de ato: **o ato já estava feito e conferido quando a carta saiu.**

### 3.8 O fix de código: entregue, conferido, e parado

O card `41e23505` (@coder) consta **"completed"** no Mission Board — **e eu não
aceitei isso como entrega.** Conferi: **PR #427** existe, está **OPEN** e
**MERGEABLE**, 2 arquivos. Medição dele: os 4 casos reais sobem acima do corte
(Aline 21,7→91,7; CHRIS 12,3→82,3), os 6 falsos positivos nomeados **não** ganham
a penalidade, mutação derruba exatamente os 4 subtests, suíte do worker **375 OK
(main) → 389 OK (branch)**, zero regressão.

**Não está em produção.** Entra na pilha dos 40.

### 3.9 Por que segue `investigating`

(a) o PR #427 não foi mergeado — e enquanto isso **a próxima voz treinada nasce
com o mesmo defeito**, que é exatamente o que aconteceu com a Aline depois da
cura de 13/09; (b) a bola do teste está com o Christian; (c) os 30.000 cr dele e
os 50.000 da Aline seguem na mesa do Johnny.

As 3 vozes antigas da Aline continuam **intactas de propósito** — são o controle
positivo do instrumento. **Não curar é decisão, não esquecimento.**

---

## 4. Chamado novo: `#553` (`37c2b55c`)

**A ferramenta de cura de referência da casa é cega em gravação com AGC.**

Checagem 1 da ordem de 27/08 feita: varri os 538 incidentes paginando; 3 casam a
classe "cura de referência / pausas" (`#293`, `#393`, `#289`) e **nenhum é este**
— o `#393` é sobre pausa na SAÍDA do TTS, não sobre a ferramenta cegar.

O que mais importa no cartão, além da medição: **a mensagem de erro culpa o
aluno.** O script morre dizendo *"áudio corrido demais"*, o que leva quem ler a
pedir regravação — instrução impossível, porque o AGC é do aparelho dele e vai
fazer de novo. Mesma família do "tente de novo" do `#344` e da foto do `#346`.

**Alcance honesto: 1 caso medido. O denominador NÃO foi medido e eu não finjo que
foi** — saber quantas vozes da base têm AGC exige baixar o bruto de cada uma, que
é ferramenta que não existe. O que dá pra dizer sem medir: AGC é o padrão de
gravador de celular, então a chance de ser 1 só é baixa.

---

## 5. O que eu **não** fiz, de propósito

- **Não curei as vozes CHRIS 01 e CHRIS 02** — ele não pediu, e mexer em voz que
  o aluno talvez use é o erro que a ronda de 23/09 evitou com a Aline.
- **Não mexi em crédito**, nem nos 30.000 dele nem nos 50.000 da Aline.
- **Não afirmei ter ouvido** nada. O `olho` caiu e isso está escrito na carta, na
  nota e aqui.
- **Não consertei o `_heal_ref_boundary.cjs`** nesta ronda: a perna (b) do `#553`
  (aposentar ou não) é **decisão**, não conserto de ronda.
- **Não mergeei nada.**

---

## 6. O que precisa do Johnny

Sem novidade estrutural. Repetindo o lote (doutrina de 17/09: juntar, não
re-escalar um por ronda):

1. **WhatsApp/telefone** para os pagantes do `#249` (R$ 8.250,27) — **trava 3
   cartões da fila de hoje** (Glauber 20d, Andy 20d, Sunesa 17d). O mesmo aval
   destrava o `94d3015d` (Sunesa, R$597).
2. **Crédito do Gemini** (`olho`, `pesquisa`, `social`) — hoje custou a escuta de
   uma cura de voz; **3 de 3 workers voltaram vazios**.
3. Decisão (c) do `#234` (`TTS_TAIL_QA_INTERNO_MODO=reprovando`).
4. **Quem mergeia conserto pronto** — **40** parados, 19 podres. **5º dia
   seguido** em que o gargalo é entrega, não investigação. Os PRs #427 e #430
   entram nessa pilha.
5. `#426`: as 3 perguntas comerciais de 14hZ seguem abertas.
6. Os **40.000 cr** do `#469` — recolher dos 4 alunos ou perdoar.
7. Os **30.000 cr** do Christian e os **50.000** da Aline (mesma classe do item 6).
8. `#494`: travado na **sua** decisão de produto, medição 100% concluída.

---

## 7. Fim de ronda

- Log commitado na **main** (regra 25-B). Código foi por branch + **PR #430**.
- Recado no **grupo** via `notify-grupo.sh` (regra de canal de 31/08). Nada no
  privado do Johnny.
- Escrita conferida na **releitura independente**: voz `8225f199` com transcript
  novo (banco) e md5 batendo (R2), `#553` gravado com `numero` 553, cartão
  `cfa488b5` com 4 notas.
