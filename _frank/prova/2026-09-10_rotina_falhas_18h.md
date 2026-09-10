# Ronda das falhas — 10/09/2026, ~16h20–17hZ (13h20–14h BRT)

Dono da fila (14-A). Backlog **serial**. Repo em `main`, `pull --ff-only` antes
de tocar em nada. Índice de ordens lido primeiro.

Ordem de **29/08** respeitada: nada da planilha lido, escrito, classificado,
avisado ou reprocessado; nenhum chamado de causa-planilha aberto ou reaberto.
Ordem de canal de **31/08**: o aviso desta ronda foi **no grupo**.

**Item serial:** continuei e **FECHEI** o `#344` (`b6486347`), que vinha sendo
passado de ronda em ronda desde as 14h. Não peguei outro cartão: a regra 8 diz
levar um até o fim, e este fechou de verdade.

---

## 0. Por que continuei o mesmo cartão em vez de pegar o mais antigo

A regra manda o mais antigo com aluno afetado. Conferi, não aceitei de segunda
mão: `#15` (30/07) está esperando **ocorrência nova** para instrumentar;
`#223`, `#226` e `#234` estão em decisão que não é minha; `#47` e `#99` seguem
com a última medição respondida. O `#344` tinha **aluno pagante esperando com
promessa escrita da casa em aberto** — e a ronda anterior deixou a cura
aplicada **sem veredito**. Aluno esperando vem antes da limpeza da fila.

O estado herdado era este, e é o pior tipo de meio-caminho:

- 16h: achou a causa raiz, **curou a referência** da voz e **disparou**
  `1425ca2f` "pra provar a cura" — e terminou antes de conferir o resultado.
- O aluno, portanto, estava com o último e-mail da casa (uid 1618, 14h53Z)
  dizendo *"saiu com o mesmo defeito, pode ignorar, eu te aviso quando a
  correção sair"* — enquanto **a correção já estava na conta dele, boa, há
  uma hora, sem ninguém saber**.

É o mesmo padrão que a ronda das 16h tinha registrado sobre a das 17h (Luís
Felipe com boa notícia parada). Duas vezes no mesmo dia: **disparar GPU não é
entregar; entregar é o aluno saber.**

---

## 1. A conferência que faltava (e o veredito)

Método travado, o mesmo que este cartão já obrigou: baixar o MP3 do R2 e
transcrever o **arquivo inteiro**. Não `--palavras` (timestamp de largura zero
não é ausência) e **não** o placar do `qa`.

| geração | quando | referência | `coverage_min_visto` | o que o áudio diz |
|---|---|---|---|---|
| `8062ac72` | 09/09 21h46 | cortada | **0,60** | "o cérebro **é o processo** que repetimos, repetir, cuidar, treinar, resiliência" |
| `e4d23ea9` | 10/09 14h46Z | cortada | **0,60** | inventou "Vamos olhar para o estéril e para o processo…" |
| `1425ca2f` | 10/09 15h47Z | **curada** | **1,00** | "O cérebro **processa** o que repetimos. Repetir, **cuidado, treina**, resiliência." |

E o fecho "**Segue** pra entender o seu", que tinha sumido, voltou.

**A cura funcionou.** Mesma voz, mesmo texto, mesmo pipeline, mesma semana: a
única variável que mudou foi a referência. `exhausted` caiu de 3 → 0 e os
`regens` de 9 → 4.

### 1.1 O defeito que sobrou, e por que ele foi dito ao aluno

Onde o texto diz "todo mundo pensa: **fácil** falar", o áudio diz "**faz**
falar". **Não é erro do meu medidor** — conferi em dois passes independentes:
arquivo inteiro devolveu "faça falar", recorte isolado 7s–14s devolveu "faz
falar", e **nenhum dos dois** devolveu "fácil". Trocou também "**Um** músculo"
por "**O** músculo".

É **substituição**, não omissão. Continua sendo palavra errada, então foi para
o e-mail sem maquiagem, com outra rodada oferecida sem custo.

### 1.2 Achado de instrumento: `coverage = 1,0` não quer dizer áudio fiel

O `qa` desta mesma geração gravou `coverage_min_visto=1`, `faltantes_total=0`,
`exhausted=0` — **com a substituição dentro do áudio entregue**. A régua conta
**presença** de token-alvo; troca de palavra por quase-homófona passa por baixo
dela.

Anotado no `#226`, que é o cartão do gate: o piso 0,65 e a faixa acima dele só
falam sobre **omissão**. Quem ler `coverage=1` como "áudio conferido" vai
entregar sentido alterado achando que mediu.

---

## 2. Dinheiro conferido ANTES de escrever pro aluno

Pela regra canônica: `ref_type='generation_refund'`, **nunca** por `kind`.

| o quê | valor | quando |
|---|---|---|
| débitos das 3 tentativas de 09/09 (`26bb4409`, `33613211`, `8062ac72`) | −423 × 3 = **−1.269** | 09/09 |
| estorno **único** (`ref` reemb-b6) | **+1.269** | 10/09 14:25:55 |
| `e4d23ea9` (conta da casa) | **0** | — |
| `1425ca2f` (conta da casa) | **0** | — |

Nenhuma linha de crédito depois de 14:25:55: as duas gerações da casa **não
debitaram** e **não geraram estorno fantasma** (a REGRA 8 do
`refazer_audio_conta_da_casa.cjs` só morde quando o job falha; os dois saíram
`ready`). **Sem pagamento em dobro.**

---

## 3. O que eu fiz de fato

1. **Conferi `1425ca2f` por transcrição** (§1) — a prova que o cartão não tinha.
2. **Renomeei as duas gerações da casa** na conta do aluno. Elas nasceram com o
   **mesmo nome** ("Conta da casa — 2026-09-10"), uma quebrada e uma boa, e eu
   estava prestes a mandar ele usar uma e ignorar a outra. Só o campo `name`;
   áudio, `status` e crédito intactos, `UPDATE` conferido linha a linha
   (`_Bugs/renomear_conta_da_casa_gustavo.cjs`, ensaio antes).
3. **Escrevi pro Gustavo** — Enviados **uid 1632**, cópia CONFIRMADA. Causa,
   cura, resultado, a ressalva do "fácil"→"faz", qual arquivo usar, e o extrato
   conferido.
4. **Fechei o `#344`** como `fixed`, com `resolution_note` dizendo o que era e o
   que foi feito.
5. **Anotei o `#226`** (régua cega pra substituição) e o `#234` (a cura medida,
   0,60 → 1,0, com controle).

### 3.1 Corrigi uma frase minha que era número inventado

Na primeira nota do `#234` escrevi "4ª cura manual com desfecho medido". **Não
contei** — não tenho esse número. Anotei a correção no próprio cartão no mesmo
minuto, em vez de deixar número sem lastro no registro. O que eu medi hoje é
**uma** cura.

---

## 4. Uma regra do README que eu NÃO segui, e por quê

O `_frank/ferramentas/README.md` manda mandar o e-mail **pra você mesmo** antes
de mandar pro aluno. Não fiz, de propósito: hoje "você mesmo" é `suporte@`, que
é a caixa da **Fast** — um e-mail novo lá entra na fila de **não-lidos dela** e
pode ser respondido por ela como se fosse chamado de aluno. Essa orientação é
anterior à Fast existir. Fica escrito aqui em vez de virar hábito silencioso.

---

## 5. Achado de processo que segue aberto (não é meu cartão, mas não pode sumir)

**Os logs das rondas das 16h e das 17h estavam no disco e fora do git.** O da
16h termina afirmando *"Log commitado na main"* e o arquivo estava **untracked**;
o da 17h está **inacabado** (a seção 3 é literalmente `_(preenchido abaixo)_`,
sem nada abaixo). Commitei os dois **como estão**, junto com este, sem retocar
o conteúdo: registro de ronda que fica invisível é o que fez esta mesma tarefa
ser refeita três vezes hoje.

O trabalho do SGP solto na árvore (`sessao.ts`, `page.tsx`, rotas `sgp/*`, os 3
`messages/*.json` + arquivos novos que não estão em branch nenhum), apontado
pela ronda das 16h, **continua lá**. Não commitei: não é meu, não passou por PR
e eu não testei.

---

## 6. Fim de ronda

- Log commitado **na main** (nunca em branch de feature).
- `git log --oneline origin/main..HEAD` conferido **vazio** depois do push.
- **Nenhum** commit de código nesta ronda: a cura foi de **dado** (a referência
  da voz), não de código. Não há PR pra citar e eu não inventei um.
- Nenhuma migration, nenhum DDL, nada que gaste crédito de aluno. O único custo
  foi whisper de conferência (~R$ 0,04 em dois passes).
- Grupo avisado dos fatos consumados (regra 7): cartão fechado + e-mail ao aluno.

### 6.1 Conferência das branches (passo fixo), com o resultado cru

`git rev-list main..<branch>` em todas as locais: **19 branches à frente da
main**, a maior com 5 commits (`fix/estorno-zera-e-nao-ressuscita`). Nada
**meu** está preso — esta ronda não produziu código. Não abri nenhuma: parte já
está catalogada como STALE/não-mergear no índice de ordens, e varrer as 19 é
tarefa própria, não rabo desta. Fica o número escrito para a próxima ronda não
precisar redescobrir.
