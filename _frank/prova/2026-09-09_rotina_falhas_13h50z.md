# Ronda das falhas — 09/09 13h41–13h55Z (Frank, dono da fila)

**Card:** `#320` / `8135ff66` — *"A FAST LÊ O ALUNO COM O TEXTO CORROMPIDO EM 25
DE 60 E-MAILS"*, aberto pelo Vigia hoje ~12hZ. **FECHADO nesta ronda** (`fixed`),
com fix **em produção**.

**Escolhido por quê (regra 8, e é uma mudança de alvo — leia).** As duas rondas
anteriores estavam em `#234`. Eu **não** continuei nele, e o motivo não é
preferência:

1. O passo fixo de fim de ronda (`git rev-list main..<branch>`) achou o **PR
   #220 ABERTO desde 12:54Z** com o fix do `#320` pronto. Fix escrito e não
   mergeado = **não está em produção** = o incidente não está fechado, por
   definição da própria regra 8 (*"fim = fix em produção + aluno avisado"*).
   Em 19/08 um fix de aluno ficou **9h preso** exatamente assim.
2. O `#320` estava causando dano **agora**: 25 de 60 e-mails lidos corrompidos,
   e um **pagante ameaçando cancelar** 4 minutos depois de a casa mandar ele
   reenviar a própria mensagem.
3. O `#234` é investigação de causa não identificada, sem aluno esperando
   resposta. A ordem é explícita: *"aluno esperando vem ANTES da limpeza da
   fila"*.

Ou seja: o `#320` já **era** o item serial em curso — a ronda das 12h54Z o pegou,
escreveu o fix e parou antes do fim. Terminá-lo é o método serial, não um desvio.

**O que NÃO fiz:** não toquei em crédito, estorno, acesso, voz nem plano; não
gastei GPU nem whisper; não apliquei migration; não reabri incidente fechado;
não escrevi pra aluno (justificado no §4); não mexi no `#234`.

---

## §1 — Não aceitei o corpo do PR: refiz a medição

O PR #220 afirmava "ANTES 25 · DEPOIS 0". **Corpo de PR não é prova**, então
rodei eu mesmo, com a **mesma ferramenta**, os **mesmos 60 e-mails**, na **mesma
sessão**, trocando só o código de produção sob ela:

| | `main` (sem fix) | PR #220 |
|---|---|---|
| **CORROMPIDO** (dava pra ler e não leu) | **25** | **0** |
| corrompido-total | 2 | 2 |
| **ok** (acento correto) | **16** | **42** |
| sem acento | 17 | 16 |

Os 25 migraram pra `ok` (16 → 42, +26; o 26º veio de `sem-acento`, um e-mail cujo
acento estava sendo *destruído* e por isso o texto parecia ASCII). O delta é
interno e consistente.

Testes, rodados por mim:

| verificação | resultado |
|---|---|
| `node --test mail-charset.test.ts` | **23/23** |
| suíte agent inteira (7 arquivos) | **68 pass · 0 fail · 3 skip** |
| `gh pr view 220` mergeable | CLEAN / MERGEABLE |
| merge | `857986c`, 13:45:18Z |
| **deploy** `Deploy Frontend (production)` run `34359118897` | **SUCCESS 13:48:00Z** |

⚠️ Deploy conferido no run, **não presumido** — a regra da casa é que merge não é
deploy e "build verde" não é "funciona". Aqui quem prova que funciona é a tabela
acima, não o run.

---

## §2 — A causa era mais funda que o card dizia, e isso importa

O card acusava a guarda tudo-ou-nada do `mailText` (`mail-respond.ts:86-91`). Ela
era o **segundo** elo. A raiz:

```js
.replace(/\s+/g, " ")   // rodava sobre a string de BYTES
```

Em JavaScript `\s` casa **U+00A0**, e `0xA0` é o **único** byte de continuação
UTF-8 (0x80–0xBF) que cai nessa classe. O colapso de espaço comia o segundo byte
do **`à`** (`C3 A0`) — o acento mais comum do português — e deixava o `0xC3`
órfão. **O U+FFFD nascia dentro do nosso próprio código**, não vinha do aluno.
Só *depois* a guarda binária via aquele U+FFFD (quase sempre na **citação** do
e-mail anterior, 0,03%–0,24% do texto) e condenava a mensagem inteira.

Consertar só a guarda, como o card sugeria, deixaria o `à` **permanentemente
perdido**. A correção certa foi de ordem: **bytes → texto pelo charset DECLARADO
no MIME → só então operações de texto**, com a decisão sobre byte ruim virando
**fração**, nunca tudo-ou-nada.

---

## §3 — Resíduo, sem maquiagem

A ferramenta de medição ainda acusa **2** casos (`uid 492`, `uid 508`) como
`corrompido-total`. **Os dois são falso positivo dela, não defeito remanescente**
— e eu confirmei lendo o código dela antes de afirmar isso:

- o heurístico `/Ã.|Â./` dispara em texto **já correto**;
- a ferramenta então reconverte `latin1→utf8` **em cima do que já está certo**,
  fabricando os U+FFFD que em seguida conta;
- na saída dos dois, a **fala do aluno sai com acento correto** (*"Olá, fiz o
  pedido…"*, *"Eu já havia feito…"*).

**A ferramenta é que ficou obsoleta com o fix.** Quem reusá-la precisa saber
disso, senão lê o número dela como dano vivo. Fica registrado aqui e na
`resolution_note`.

---

## §4 — Aluno: por que NÃO escrevi

O único dano com consequência **observada** era o `uid 503`, **Duarte Soares**
(`duartesoaresconsultor@gmail.com`), pagante em Portugal:

| hora | o quê |
|---|---|
| 11:21Z | escreve *"Não consigo pagar"* — `text/plain` UTF-8 **bem formado**, 3357 bytes |
| — | o `mailText` entrega ao cérebro da Fast: *"NA£o consigo pagar…"* |
| 11:25Z | a Fast responde que o corpo *"parece estar vazio ou com problema de codificação"* e **pede reenvio** |
| 11:29Z | ele responde: *"Vejam se conseguem resolver caso contrário **CANCELO SUBSCRIÇÃO**"* |

O e-mail dele não tinha problema nenhum. **Quem não conseguiu ler foi o nosso
código, e o aluno é que foi mandado repetir.**

**Ele já foi atendido e resolvido às 11:43Z pela ronda anterior** (`#318`):
conferi a cópia em Enviados antes de decidir. Pagamento confirmado em **3 fontes
independentes** (comprovativo multibanco, Hotmart `HP3384777202`, recarga do
ciclo às 11:38Z), conta reactivada, 100.000 créditos, acesso até 30/09, com
desculpas escritas em português europeu.

**Não escrevi de novo, de propósito.** O caso dele está resolvido; um terceiro
e-mail hoje para explicar a causa técnica seria **ruído, não reparo** — a regra
da casa é *"aviso repetido é ruído, silêncio é abandono"*, e aqui não há
silêncio. Registro a decisão em vez de escondê-la.

⚠️ E não afirmo mais do que medi: **o card não diz 25 alunos prejudicados e eu
também não.** O medido é que o cérebro leu texto degradado em 25 mensagens;
quantas respostas ficaram piores por isso **não foi medido**.

---

## §5 — Dinheiro

**Nada tocado.** Nenhum estorno, crédito ou acesso alterado por este card —
como a própria descrição exigia (*"NÃO afirma cobrança indevida… NADA deve ser
estornado por este card"*, a armadilha que produziu o #100, o #125 e o #152).

---

## §6 — O defeito estava prestes a voltar, por outra porta

O card avisava, e conferi: **PR #41 e PR #42, ambos ABERTOS**, reescrevem a
**mesma decisão binária** noutro caminho de leitura (`textoDoBuffer`, e-mail
acima do teto de 2MB):

```js
const utf8 = buf.toString("utf8");
return /�/.test(utf8) ? buf.toString("latin1") : utf8;
```

Mergeados como estão, **a correção nasce já contornada** — mesmo risco que
`feat/onedrive-401` e `feat/fix-image-upload-retry` já criaram. Comentei nos dois
pedindo rebase na main e uso do `decodificarBytes()` do `mail-charset.ts`, que
preserva o mérito real deles (o teto de 2MB) sem trazer a regra velha junto.

---

## §7 — O que a próxima ronda faz

1. **Voltar ao `#234`** — ele volta a ser o item serial. O §8 da nota das 13h19Z
   deixou o passo cravado: **faixa dinâmica da referência das 99 vozes elegíveis
   × taxa de decapitação da entrega** (detector absoluto, sem polo, sem detector
   relativo, sem o viés circular do §3 daquela nota).
2. **Não reabrir** a comparação de polos com o detector relativo: está medido que
   é circular e que nenhum limiar a conserta.
3. `request_params` segue sem ser olhado no `#234`.
4. Se PR #41/#42 forem retomados, conferir que usam `decodificarBytes()`.

---

## Pendências que atravessam rondas

| item | estado |
|---|---|
| `#320` | **FECHADO** — fix em produção, medido 25→0, aluno já atendido |
| PRs #41/#42 reintroduzem a lógica binária | **anotados**, não mergeados |
| ferramenta `medir_mojibake_na_caixa.cjs` | **obsoleta pós-fix** — acusa 2 falsos positivos; não ler como dano vivo |
| `#234` fechado | **não** — volta a ser o item serial na próxima ronda |
| `#226` (290 gerações que o QA reprovou) | espera decisão do Johnny |
| Migration 82 | não aplicada, aguarda Johnny |
