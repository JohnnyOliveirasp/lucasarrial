# Rotina das Falhas — 30/08/2026, ~19h40–20h UTC (= 16h40 BRT) — dono da fila

> ✅ **RESOLVIDO NA RONDA DAS 21h.** Este log ficou sem commit porque a Bash do
> ambiente morreu no meio da ronda (detalhe no §6). Na ronda seguinte (21h) o
> commit saiu por um caminho de execução alternativo (terminal do MCP `ruflo`,
> já que a Bash continua morta). O conteúdo abaixo é o da ronda das 20h, **como
> foi escrito na hora** — não reescrevi nada com o que aprendi depois.

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia
(`5b7d363`). Índice de ordens lido antes de tocar em qualquer coisa. Ordem de
29/08 (`desligar_vigia_e_frank`) relida: **nada nesta ronda encostou na
planilha** — não li, não escrevi, não classifiquei, não reprocessei, e não abri
chamado com causa nela.

Ronda anterior: **falhas às 19h UTC** (`5b7d363`).

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **2** (#192, #200) |
| Em `aguardando_aluno` | **3** (#99, #196, #197) |
| Incidente que eu **peguei** | **1** (#192) |
| **Medição nova, que ninguém tinha feito** | **1** (§2 — derruba a hipótese principal do #192) |
| Incidentes que eu FECHEI | **0** — motivo no §5 |
| Fechados que voltaram a disparar | **0** |
| Crédito / GPU / migration tocados por mim | **nada** |
| Custo da ronda | ~R$ 0,15 de whisper. Zero GPU, zero crédito de aluno. |
| **Ronda interrompida por falha de ambiente** | **sim** (§6) |

---

## 1. Qual peguei, e por quê

Pelo serial (regra 8): o mais antigo com aluno afetado. O **#192** (Robert Ros,
`70rrosusa@gmail.com`, aberto 29/08 21:23Z) é o mais velho e está na **décima
ronda no mesmo passo**: "alguém OUVIR os áudios".

O **#200** eu conferi primeiro, porque o passo dele era verificável em um
comando: **PR #132 continua `OPEN`, não mergeado.** Enquanto não for mergeado e
deployado, o seletor segue mentindo na tela — segue `investigating`, sem eu
tocar. Nada mudou desde as 19h.

Nas nove rondas anteriores o #192 foi registrado como travado e **passado
adiante sem andar**. Eu não aceitei isso nesta ronda, porque "falta ouvido" é
verdade sobre o **veredito**, não sobre a **medição** — e havia medição por
fazer.

## 2. O que eu medi, e por que isso muda o caso

O buraco: o #192 vinha sendo medido por **% de silêncio** (nota das 00:37Z), que
é uma régua **diferente** da que colocou a Ellen no PR #92 e tirou o Leonardo da
classe (nota 10, 17h30Z). Comparar caso medido numa régua com caso medido em
outra é fabricar resultado. **Rodei no Robert o MESMO código, nas MESMAS duas
definições de articulação** (`_Bugs/2026-08-30_ritmo_leonardo/medir.cjs`):

- **A)** palavras ÷ soma da duração das palavras (`medir_velocidade_voz.cjs`, #165)
- **B)** palavras ÷ (duração − pausas ≥ 0,15s) (`_words_per_second` do PR #92)

### Resultado — voz `1d332ef0` (dataset de 3.597s, 1 arquivo)

| peça | duração | palavras | A | B |
|---|---|---|---|---|
| referência `ref/auto.wav` | 29,99s | 45 | **2,06** | **2,06** |
| fala real dele (3 janelas de 30s) | — | — | mediana **3,20** | mediana **3,19** |
| saída clonada `b298e5be` | 26,18s | 79 | — | **3,95** |

Janelas da pessoa: `3,20 / 1,58 / 4,18`.
Banco: `speech_rate_wps = 3,08` (bate com a minha mediana — corroboração
independente), `reference_rate_wps` **nulo** (a coluna do PR #92 segue desligada).

**Razão referência ÷ pessoa = 0,64x** — a referência dele é ~36% **MAIS LENTA**
que ele fala.

### O que isso significa, e é o achado da ronda

1. **O Robert NÃO é da família Ellen.** Lá a referência era 2,6x mais **rápida**
   que a pessoa. Aqui é 0,64x, ou seja o **lado oposto**. Ele está na mesma
   direção do Leonardo (0,88x), mas muito mais extremo. **O PR #92 não teria
   salvado o caso dele** — pelo mesmo motivo, agora medido, que já tinha tirado o
   Leonardo da classe.

2. **A hipótese principal do incidente NÃO se sustenta nesta medida.** A nota das
   00:37Z propôs que o clone copiou o trecho arrastado da referência, e a cura
   seria trocar a referência. Mas o clone saiu a **3,95** palavras/s — **1,92x
   mais rápido que a referência** (2,06) e **acima** da mediana da pessoa (3,19).
   **O clone não herdou a lentidão da referência.**

3. **As duas réguas concordam.** Em silêncio (nota 00:37Z): referência 41%,
   pessoa 22–27%, clone 23,6% — o clone acompanhou a **pessoa**, não a
   referência. Em articulação (esta medição): mesma conclusão. Duas réguas
   independentes dizendo a mesma coisa é o mais perto de sólido que dá pra chegar
   sem ouvido.

4. **Consequência prática, e é dinheiro:** trocar a referência do Robert — a cura
   proposta e registrada — **gastaria GPU pra provavelmente não mudar o que ele
   reclamou**. Registro isso ANTES de alguém executar a cura, que é o único
   momento em que o registro serve pra alguma coisa.

### O limite da minha afirmação, dito na cara

**A mediana da pessoa é frágil e eu não vou vendê-la como firme.** As 3 janelas
espalham de **1,58 a 4,18** — 2,6x **dentro da mesma pessoa**. Com isso:

- **Está estabelecido:** o clone (3,95) é mais rápido que a referência (2,06).
  Ambos são medidas exatas de peças inteiras — a referência tem 30s e é a
  referência toda; a geração tem 26s e é a geração toda.
- **NÃO está estabelecido:** "o clone é mais rápido que a pessoa". 3,95 cai
  **dentro** da faixa observada dele (1,58–4,18). Afirmar isso com 3 janelas
  seria decidir no ruído.

Eu estava **no meio de amostrar 10 janelas** pra fechar exatamente esse buraco
(script `_Bugs/2026-08-30_ritmo_robert/medir10.cjs`, escrito e em disco, imprime
mediana + quartis + min/max justamente pra a fragilidade ficar visível) quando o
shell morreu. **O script nunca chegou a rodar.** É o primeiro item da próxima
ronda: um comando, ~R$0,25 de whisper.

## 3. O que eu NÃO fiz, e por quê

- **Não dei veredito sobre a qualidade da voz.** Eu não ouço (14-C §4). Nada
  acima é gosto; é número. A pergunta "o áudio 3 parece a pessoa do áudio 2?"
  continua **inteira** e continua sendo de ouvido humano.
- **Não anotei no incidente.** `anotar_incidente.cjs` precisa de shell. A
  medição do §2 **não está no #192** — está só aqui. **Anotar é obrigatório na
  próxima ronda**, senão a décima primeira ronda repete a hipótese que esta
  medição enfraqueceu.
- **Não escrevi pro aluno.** O e-mail de 00:51Z dele diz "te escrevo de volta com
  o resultado". Eu ainda não tenho resultado — tenho uma hipótese enfraquecida.
  Escrever agora seria trocar uma hipótese por outra na caixa dele, e a promessa
  registrada é de **resultado**.
- **Não mudei status, não mergeei, não gastei GPU nem crédito, não toquei em
  migration.**

## 4. Estado dos outros

- **#200** — PR #132 `OPEN`, não mergeado. Segue `investigating`. Correto.
- **#99 (Luciano)** — `aguardando_aluno`. **A garantia vence 02/09, em 2 dias.**
  R$ 97 APPROVED em 26/08. Falta **decisão comercial**, não atendimento. Escalado
  em 29/08 e em 01h, 02h, 10h, 12h, 14h, 16h, 18h, 19h — **nove vezes sem
  resposta**. Digo o que a nona escalação não disse: **o canal de escalação está
  falhando.** Repetir a mesma mensagem pelo mesmo canal uma décima vez não é
  diligência, é ritual. Depois de 02/09 devolver deixa de ser opção e a decisão
  passa a ser tomada pelo silêncio.
- **#196, #197** — bola com o aluno. O curso do Natanael (#197) depende de alguém
  nosso levar a quem cuida do curso, não do aluno.
- **#192 + PR #92** — 25h e 2 dias, travados no **mesmo** ouvido.
- **Presos** (Marcelo, Kelin, Luan) — todos já avisados, bola com eles. Não
  reescrevi: aviso repetido é ruído.

## 5. Por que fechei ZERO

Nenhum dos dois abertos é meu pra encerrar: **#200** está esperando merge (fechar
com PR aberto é o "done falso" que a regra 14 proíbe) e **#192** está esperando
ouvido (fechar seria inventar veredito). A regra 8 manda fechar **mais**, não
mais rápido do que se resolve. Aqui o passo que emperra está escrito, item por
item, no §4.

## 6. A falha de ambiente — o que quebrou e quando

A ferramenta **Bash parou de funcionar por completo** às ~19h55Z, logo depois de
eu escrever o `medir10.cjs`. Não é o script: **`echo hello` também retorna exit 1
com stdout e stderr vazios**, com e sem sandbox. Nenhum comando chega a iniciar —
o erro vem da camada de execução, antes do shell. Confirmei por um segundo
processo (subagente), que reproduziu idêntico.

**O que isso me impediu de fazer nesta ronda:** rodar o `medir10.cjs`, anotar a
medição no #192, postar no grupo (regra 7) e **commitar este log**.

Não tenho como abrir chamado disso pela fila (o script de incidente também
precisa de shell). Fica registrado aqui e vai por Telegram.

## 7. Regra 7 — grupo

**Não postei.** Não houve fato consumado nesta ronda: não fechei incidente, não
subi fix e não escrevi pra aluno. A medição do §2 é insumo, não fato consumado —
e ronda vazia no grupo é exatamente o ruído que a regra proíbe. Além disso, o
canal também depende de shell.

## 8. Primeiro item da próxima ronda, em ordem

1. **Commitar este arquivo na `main`.**
2. `node frontend/_Bugs/2026-08-30_ritmo_robert/medir10.cjs 1d332ef0-1061-4d65-9bee-3f697e5853ef 10`
   — fecha o buraco da mediana frágil (§2).
3. **Anotar a medição do §2 no #192** com `anotar_incidente.cjs`, incluindo o
   limite do §2 — não só o achado.
4. Conferir se o PR #132 foi mergeado (destrava o #200).
5. `git fetch origin && git log --oneline origin/main..HEAD` vazio, e conferir
   que nada ficou preso em branch `feat/`.
