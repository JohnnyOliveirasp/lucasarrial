# Ronda das falhas — 10/09/2026, ~15h20–16hZ (12h20–13h BRT)

Dono da fila (14-A). Backlog **serial**. Repo em `main`, `pull --ff-only`.
Índice de ordens lido antes de tocar em nada. Ordem de **29/08** respeitada:
nada da planilha lido, escrito, classificado, avisado ou reprocessado; nenhum
chamado de causa-planilha aberto ou reaberto. Ordem de canal de **31/08**: os
avisos desta ronda foram pro **grupo**.

**Item serial:** continuei o `#344` (`b6486347`), que a ronda anterior deixou
**pela metade** — e ele rendeu a causa raiz de uma classe que estava aberta
desde 20/08.

---

## 0. Por que esta ronda começou consertando a anterior

O log das 17h (`2026-09-10_rotina_falhas_17h.md`) estava **inacabado no
disco**: a seção 3 era literalmente `_(preenchido abaixo)_`, sem nada abaixo, e
o arquivo estava **untracked** — não commitado. Ele dizia ter disparado as duas
refações e prometia: *"aviso aos dois só depois de conferir palavra a palavra o
áudio novo."*

Fui conferir quem tinha sido avisado:

| aluno | geração nova | avisado? |
|---|---|---|
| Gustavo | `e4d23ea9` | **sim**, 14:53Z (Enviados uid 1618) |
| Luís Felipe | `5f4165eb` | **não** — ninguém escreveu pra ele |

O Gustavo recebeu a verdade na hora (o áudio dele saiu pior; ver §2). O **Luís
Felipe ficou com boa notícia parada**: a geração dele saiu **certa** às 14h46Z e
ele não sabia. Pior: o último e-mail que ele tinha recebido, das 14:26Z, dizia
que refazer *"tem boa chance de repetir o mesmo defeito"* e que o certo era
esperar a correção. Ou seja — a casa entregou o que prometeu e deixou o aluno
achando que não tinha entregue.

**Lição de processo, não de código:** ronda que dispara GPU e morre antes de
escrever o log deixa aluno esperando sem ninguém saber. O disparo ficou
registrado no banco; a **obrigação de avisar**, só na cabeça de quem rodou.

---

## 1. Conferência dos dois áudios (método travado)

Baixei o MP3 do R2 e transcrevi o **arquivo inteiro**, não só as palavras-alvo.
Isso é consequência direta da armadilha que a ronda anterior registrou:
timestamp de largura zero no `--palavras` **não** é palavra ausente. Ausência de
verdade tem outra assinatura — **o token não aparece no texto cru**.

### 1.1 Luís Felipe (`5f4165eb`, 101,9s) — SAIU CERTO

A lista inteira está falada: *amor, dinheiro, família, sucesso, **Fé*** — e as
**3** ocorrências de "quem". O defeito de ontem (a "Fé" comida em `ea11989a` e
`873fcee4`) **não se repetiu**, e a intrusão do "Mas." que a `09f8f761` tinha
**também sumiu**.

Sobra **uma** intrusão nova: a voz acrescenta **"medo"** no meio da lista
("amor, dinheiro, família, **medo**, sucesso, fé"), palavra que não está no
texto dele. É intrusão, não omissão.

⚠️ **ARMADILHA DE MEDIÇÃO NOVA, pra ninguém repetir:** meu checador acusou
**"sessenta" como FALTANTE** e era **falso** — o whisper transcreve como
**"60"**, em dígito. É a mesma armadilha de dígito que a ordem de 20/08 manda
expandir (item 3, "re-medir com a régua corrigida, expandindo dígitos"). Quem
compara token cru sem expandir dígito **condena áudio bom**. Só não virou erro
porque eu li a transcrição inteira em vez de confiar no placar.

### 1.2 Gustavo (`e4d23ea9`, 22,4s) — SAIU PIOR QUE O ORIGINAL

| | |
|---|---|
| texto | "O cérebro **processa** o que repetimos. Repetir **cuidado treina** resiliência." |
| áudio novo | "**Vamos olhar para o estéril e** para o **processo** que repetimos. Repetir, **cuidar do trem na** resiliência." |

Além de continuar comendo "processa", **inventou uma oração inteira**. Perdeu
também "Segue pra" no fecho, o "Um" de "Um músculo" e o "é" de "Aqui é onde".
A Fast já tinha avisado o aluno disso às 14:53Z, com o texto certo e sem
maquiagem — esse e-mail está correto e bate com o que eu medi de forma
independente.

---

## 2. A causa raiz: a referência da voz está cortada no meio da frase

Isto é o achado da ronda, e ele **não precisa de "azar de síntese"** pra
explicar 4 de 4 tentativas quebradas.

A voz do Gustavo — **"Rogério Balbinot"** (`37cdb269`) — tinha
`reference_transcript` de 401 chars que **começa no meio de uma frase** e
**termina no meio de outra**:

> **início:** "…**ninguém, e nisso** conseguimos criar um grupo de SST das
> empresas pilotos…"
> **fim:** "…eu acabei criando um sistema, **e que hoje está…**"

É **exatamente** a assinatura do defeito Katia/Kessuly que o **item 2 da ordem
de 20/08** deixou em aberto, e que o próprio `fabricar_referencia.cjs` descreve
na sua documentação ("cortado no meio da frase", "começando no meio"). O VoxCPM
gera em modo **"continue este áudio"**: toda geração dessa voz herda o defeito,
e **retreinar não cura**, porque a LoRA está certa.

### 2.1 A telemetria já provava isso, e estava no banco desde ontem

O contraste está no `qa` das próprias gerações — ninguém tinha cruzado:

| voz | referência | `coverage_medio` | sintoma |
|---|---|---|---|
| Rogério Balbinot (Gustavo) | **cortada nas 2 pontas** | **0,866** | `faltantes_total=4`, `exhausted=2/3` (o QA **desistiu** de pedaço) |
| JRM (Luís Felipe) | **inteira** ("É o poder de criar autoridade…" → "Isso é métrica.") | **0,9845 / 0,9858** | sem palavra comida |

Duas vozes, **mesmo pipeline, mesma noite**: a de referência quebrada come
palavra, a de referência inteira não. E o mesmo texto de 421 chars no Gustavo
saiu **29,2s / 31,4s / 25,4s / 22,4s** — encurtando conforme perdia conteúdo.

### 2.2 Cura aplicada (sem GPU, sem crédito)

`fabricar_referencia.cjs 37cdb269 --sem-prompt --confirmar`

- 92 candidatas de **frase inteira** (18–30s, pausa ≤ 1,2s);
- escolhida a **#1**: 716,8s → 742,6s (**25,7s**), **−22,7 LUFS**, LRA 5,7,
  pausa máx **0,52s**, fronteira de frase **nas duas pontas**;
- backup do áudio antigo em `ref/auto.bak-2026-09-10-b8da.wav`, transcript
  antigo guardado em `_Bugs/chamado_108_referencias/37cdb269`.

**Conferido DEPOIS de gravar** (não confiei no "OK" da ferramenta): 1 linha
afetada; `reference_transcript` agora tem 477 chars, começa em *"Então nós
temos que estar preparados para tudo isso."* e fecha em *"…pode ter valores
diferentes?"*; o WAV novo está no R2 (835.918 bytes, 15:47:45Z) e o **backup
também existe** de fato.

---

## 3. Dinheiro conferido nos dois (regra canônica)

Conferido por **`ref_type='generation_refund'`**, nunca por `kind` — a
armadilha que quase pagou 13 alunos em dobro:

| aluno | estornos | valor | confere? |
|---|---|---|---|
| Gustavo | 1 | **1.269** | = 3 × 423 das três de 09/09 (`26bb4409`, `33613211`, `8062ac72`) ✓ |
| Luís Felipe | 1 | **3.844** | = 2 × 1.922 das duas quebradas (`ea11989a`, `873fcee4`) ✓ |

A boa das 17h44 do Luís Felipe (`09f8f761`, 1.922 cr) está **corretamente NÃO
estornada** — ela saiu certa, ele não foi pago por ela. **Nenhum dos dois pagou
em dobro** e **nenhuma geração da casa debitou nada**.

---

## 4. O que eu fiz de fato

1. **Escrevi pro Luís Felipe** (Enviados **uid 1628**, cópia CONFIRMADA):
   a refação saiu certa, a "Fé" está falada, **e a ressalva do "medo" dita na
   cara** — com outra rodada oferecida sem custo, porque palavra inventada
   continua sendo palavra errada e ele vai usar isso num vídeo de 60 anos.
2. **Curei a referência** da voz do Gustavo (§2.2), com backup e conferência
   depois de gravar.
3. **Disparei a regeração** pra *provar* a cura: `1425ca2f`, por conta da casa,
   **sem débito**.
4. **Anotei o `#344`** com a causa raiz, a telemetria comparada, a cura e a
   conferência de dinheiro.

---

## 5. Achado de processo: trabalho do SGP solto na árvore, em nenhum branch

`git status` na `main` mostra **~191 linhas não commitadas** do SGP —
`sessao.ts`, `page.tsx`, as rotas `sgp/inicio` e `sgp/codigo`,
`step-dados-form.tsx`, os 3 `messages/*.json` — mais arquivos **novos** que
nunca foram adicionados: `lib/sgp/retomada.ts`, `lib/sgp/destino.ts`, os dois
`.test.ts` e as rotas `api/v1/sgp/retomar/` e `api/v1/admin/sgp/[id]/retomada/`.

`git log --all` nesses caminhos volta **vazio**: esse trabalho **não existe em
branch nenhum**, nem local nem no origin. Mtime de 09/09 17:34–17:39 e 10/09
09:07 — está parado há um dia.

**Não commitei**: não é trabalho desta ronda, não passou por PR e eu não o
testei; código vai por branch `feat/` + PR, só o log vai na main. Mas fica
**escrito** porque é a mesma classe que em 19/08 deixou um fix de aluno 9h
preso e invisível — e aqui é pior, porque não está nem em branch: um
`git checkout` erra e o trabalho morre.

---

## 6. Fim de ronda

- Log commitado **na main** (nunca em branch de feature).
- `git log --oneline origin/main..HEAD` **vazio** após o push.
- Nenhuma migration, nenhum DDL, nada que gaste crédito de aluno.
- Grupo avisado dos fatos consumados (regra 7): e-mail ao Luís Felipe.
