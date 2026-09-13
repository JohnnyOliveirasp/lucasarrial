# Ronda das falhas — 13/09/2026, ~12h50Z (09h50 BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais a ordem de **27/08**
(só erro de sistema vira chamado), a de **29/08** (planilha desligada) e a de
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito ou reprocessado.**
`now()` no banco = **2026-09-13 12:41:35Z**.

**Fechei 2 incidentes: `#369` e `#331`.** O aluno que esperava há ~14h recebeu o
que foi prometido.

---

## 1. ✅ O item serial: `#369` (mastroianni) levado até o fim

Peguei o mais antigo com aluno afetado e não larguei até fechar. Fim de verdade:
**entrega provada + aluno avisado + ferramenta em produção + incidente fechado
com nota e commit.**

### O vídeo já existia, e o board dizia que não

Primeira coisa da rotina (*"já resolveu sozinho?"*) e foi ela que resolveu a
ronda: o raio-x do aluno mostrou um Vídeo Clone **`ready` de hoje 11:58Z**.

O card `411efb5f` foi marcado **`failed` / "NÃO foi feito" às 11:01Z** — e o
operário **tinha feito tudo**: branch às 10:59Z, PR #259 às 11:01Z, e a
ferramenta **rodou às 11:58Z**. É a **terceira** confirmação hoje do mesmo
defeito (o Vigia mediu 2 casos às 12hZ). **Eu não gerei nada nesta ronda** e não
gastei um crédito de GPU: o trabalho estava pronto e invisível.

### Não aceitei "ready" como prova — a lição de 12/09 é exatamente essa

`status='ready' AND video_path IS NOT NULL` já mentiu uma vez porque a rota
grava `video_path` no INSERT. Então medi o arquivo, não a linha:

| o que | medido |
|---|---|
| R2 `HeadObject` (`voices-clone-ai-verse`) | **13.772.974 bytes**, `video/mp4`, **11:58:37Z** |
| ordem dos fatos | MP4 gravado **4s ANTES** da linha (11:58:41Z) — a invariante que a ferramenta promete funcionando de verdade |
| `ffprobe` do arquivo baixado | h264 **480x832**, 25fps, **1817 frames**, **72,68s**, com faixa **AAC** 48kHz de 72,66s |
| `silencedetect` -40dB/2s | nenhum trecho mudo |
| 5 frames olhados (1s/18s/36s/54s/71s) | é ele, enquadramento cabeça-e-ombros **estável do início ao fim**, boca em movimento |
| áudio × o que ele aprovou | casa por **chave**: `281495cc…mp3` = generation *"Conta da casa — 2026-09-12 — #369"*, 70,6s |
| cauda (classe do `#234`) | whisper nos últimos 15s: *"…como foi preservada e se permaneceu íntegra até a conclusão da análise. É isso que transforma um dado digital em uma evidência tecnicamente defensável."* — **bate palavra por palavra** com o fim de `text_raw`. Nada decepado. |
| custo ao aluno | `credit_transactions` após 11/09 = **0 linhas**; **0** linhas com o `ref_id` do clone; saldo **874** intacto |

**Divergência menor, registrada pra não virar achado falso amanhã:** a linha diz
`num_frames=1775`/70,6s e o MP4 saiu com **1817 frames**/72,68s. O worker entrega
um pouco mais longo que o pedido. Não afeta a entrega e **não investiguei**.

### O aluno foi avisado, e eu disse o que a casa errou

E-mail *"Seu vídeo de teste está pronto"* — cópia em Enviados **confirmada, uid
2081**. Link assinado do R2, 7 dias, **testado por mim antes de mandar** (GET
HTTP 206, `video/mp4`).

Duas coisas ditas na cara limpa, porque nenhuma das duas melhora escondida:

1. **Não é Drive.** Ele pediu Drive e a Fast prometeu Drive. **Esta máquina não
   tem Drive** (sem `rclone`, sem CLI) — a ronda das 11hZ já tinha medido. Em vez
   de prometer de novo, expliquei que é link direto, que vence em 7 dias, que
   baixe se quiser guardar e que pode pedir link novo.
2. **A demora foi nossa.** Prometido ontem à noite, entregue hoje de manhã. Sem
   desculpa inventada e **sem prazo que eu não controlo**.

### A ferramenta entrou em produção

**PR #259 revisado e mergeado — merge `244c086` na `main`.** Revisão: **2
arquivos, só `_frank/ferramentas/`, ZERO código de produto**. Rodei a suíte
antes: **44/44 passando**, incluindo as 4 travas de crédito e *"áudio de OUTRO
aluno é recusado"*. Sem isso, a próxima ronda refaria 1.460 linhas que já
existiam.

### `#331` fechado junto

É o gêmeo de atendimento do `#369` (mesmo aluno, mesma promessa: vídeo da casa +
link do Drive). As duas ocorrências do pedido foram cumpridas pela mesma entrega.
A lição que ele deixa: **não prometer canal de entrega que a casa não tem.**

---

## 2. 🟠 `#341` — recontei o número que estava decaindo há 2 dias

**Não executei devolução, não creditei ninguém, não mudei status.** Continua
aguardando o *"pode"* do Johnny — é decisão dele, não minha. O que eu podia fazer
sem tocar em dinheiro era impedir que ele decidisse em cima de número velho.

**Número de hoje: 12 ainda negativos × 10.525 = 126.300 créditos.** Não os
**136.825** de 11/09, e muito menos os **168.400** do título.

- **Já perdoados (4):** `neilamagalhaes79@`, `carlaneavatar@`, `evelyn.cheida@` e
  **`welrisson@` (11/09 17:30:30Z)** — este é o novo desde a última contagem.
- **Ainda em −10.525 (12):** `francaanampf@`, `otnielbarbosa@`, `iran@ogr.com.br`,
  `patriciapio007@`, `mateusanalistadenegocios@`, `frfaria.1980@`, `schiavojr77@`,
  `souzaprado@`, `danilo.cntcont@`, `jasf.junior@`, `drbrunoa@`, `edust@live.com`.

Quem executar pela lista do título paga **em dobro para 4 pessoas (42.100 cr)**.
O decaimento não é mistério: é o próprio código (`perdoarNegativoDoOnboarding` no
momento da assinatura). No `welrisson@` dá pra ver na linha — `subscription_grant`
*"recarga do ciclo"* às 17:30:30.328Z e o `adjustment` de +10.525 às 17:30:30.949Z,
**0,6s depois**. Ninguém pagou na mão.

### ⚠️ A armadilha da ronda: eu quase caí nela

Sondei o perdão por `note ilike '%perdao_negativo_onboarding%'` e voltou **ZERO
para os 16 — inclusive para os 4 que FORAM perdoados.** O marcador vive em
**`ref_type`**, e o `note` é texto corrido em português.

É **a mesma classe** da armadilha já medida do estorno (`ref_type='generation_refund'`,
nunca por `kind`), **numa coluna diferente**. A sonda errada afirma *"ninguém foi
perdoado"* e manda pagar 42.100 em dobro. Promovi a lição de caso particular pra
regra geral em `_frank/04_PLAYBOOKS.md`: **marcador de dinheiro vive em `ref_type`,
nunca no `note` — e valide a sonda num positivo conhecido antes de confiar no seu
zero.** Se ela não acende no positivo, o zero não vale nada.

---

## 3. Correção de uma leitura minha

Abri a ronda achando que o `#341` era *"a garantia da Evelyn vencendo"*. **Não
é.** O `#341` é o bug do onboarding do SGP que debitava 10.525 da carteira do
comprador, e a Evelyn é **uma das 16 vítimas** — e já foi perdoada em 10/09. O
que o `garantia_na_fila.cjs` mostra é a janela de garantia dela, outro assunto.
Registro porque eu levei essa confusão pro grupo antes de medir, e número errado
no grupo é ruído que mata o canal.

---

## 4. Dinheiro — nada decidido por mim

1. **`#341`: 126.300 cr** para 12 alunos, aguardando o *"pode"* do Johnny.
2. **mastroianni (`#329`): 48.025 cr** gastos em Vídeo Clone em 09-10/09, sem
   estorno. Decisão do dono. **Não fecha com o `#369`** e tem casa própria — por
   isso fechei o `#369` sem tocar nisso.

O único número que eu afirmo ter conferido é o do `#341`, e conferi pela coluna
certa depois de errar a sonda.

---

## 5. Placar honesto

- **Incidentes fechados: 2** (`#369`, `#331`). O backlog baixou.
- Alunos escritos: **1** (mastroianni, uid 2081 confirmado em Enviados).
- Incidentes anotados: **1** (`#341`, recontagem).
- **Código em produção: 1 merge** — PR #259 → `244c086` (44/44 testes).
- Créditos gastos de aluno nesta ronda: **0**. GPU disparada por mim: **0**.
- Manual corrigido: **1 regra** (armadilha `ref_type` × `note`).
- **Premissa minha derrubada: 1** — "o `#341` é a garantia da Evelyn".

**O que emperrou:** nada travou na entrega. O que continua parado são as **duas
decisões de dinheiro** (126.300 do `#341` e 48.025 do `#329`), e as duas são do
Johnny — eu não posso destravar e não vou fingir que posso.

**O que eu NÃO fiz:** não toquei em crédito de ninguém, não executei devolução,
não disparei GPU, não mergeei nenhum branch marcado STALE, não li a caixa do
suporte@ pra triagem (só o fio do aluno que eu estava tratando, `EXAMINE` +
`BODY.PEEK`), não toquei em e-mail não lido, não reabri incidente fechado e não
prometi ao aluno prazo que eu não controlo.
