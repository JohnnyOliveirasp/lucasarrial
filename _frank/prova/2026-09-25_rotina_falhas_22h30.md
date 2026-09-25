# Ronda das falhas — 25/09/2026, ~22hZ (rodou 21:40–22:00Z)

> ⚠️ **AVISO DE NOME DE ARQUIVO, PRA NINGUEM REPETIR O QUE EU QUASE FIZ.**
> O arquivo `2026-09-25_rotina_falhas_22h.md` **contem a ronda das ~21hZ**, nao
> a das 22h — o nome esta desencontrado do conteudo. Eu fui escrever o log desta
> ronda nesse nome e **sobrescrevi o log da ronda anterior**. Recuperei inteiro
> do git (`git checkout HEAD -- <arquivo>`, conferido: `git status` limpo e
> primeira linha de volta em "~21hZ"), e por isso este log foi pra `22h30`.
> **Antes de escrever o log, confira a PRIMEIRA LINHA do arquivo que voce vai
> criar.** Os nomes desta pasta nao sao confiaveis como indice.

**Método: serial (regra 8).** Um caso levado até o fim antes de pegar outro.

**Esta ronda fechou 1 incidente, abriu 1 (o mesmo), e subiu 1 fix pra produção.**
O que ela entregou: **as 414 guardas da suíte do worker passaram a ser
executadas** — até hoje nenhum CI as rodava, e ninguém percebia porque elas
estavam **verdes**.

**Produção tocada:** 1 merge (`83dbc12a`, PR #452), **CI apenas**. Zero GPU,
zero migration, zero DDL, zero crédito movido, zero carta a aluno, zero conta
criada, zero cobrança mexida, **zero reciclagem da frota do RunPod** (provado
abaixo).

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- **1313** cartas lidas da pasta `Sent` — **mesmo número da ronda anterior**:
  nenhuma carta nova saiu desde as 21hZ.
- **1236** já tinham linha. **0 escrituráveis** dentro da janela.
- Contagem fecha: **1313 = 1236 + 0 + 77 + 0**. Nenhuma carta sumiu.
- Registro local (#210) não existe nesta máquina — *gitignored*. É o buraco que
  esta reconciliação compensa.

Veredito: buraco **PASSIVO**. Bate.

## Passo fixo 2 — percepção travada (ordem de 17/09)

`percepcao_travada.cjs`: **0** cartões · mais velho **0d**. Controle positivo
(#310) OK, controle negativo (#518) descontado, **566** incidentes varridos
(eram 565). Nada a despachar pro `olho`/`qa`.

## Passo fixo 3 — estado da fila (início)

**164 abertos** · **95** com 7d+.

---

## A escolha do serial, e por que ela mudou no meio

`escolher_o_abandonado.cjs` apontou o **`#380`** (`d392f1d4`, Ricardo
`ricardo@inventivebox.pt`, Portugal) — parado **11,9d**, o mais abandonado por
última nota.

**Li o cartão antes de agir, e ele não era o que o rótulo dizia.** O `#380` está
`aguardando_aluno` com razão: o aluno foi medido e respondido em 13/09 (e-mail
uid 2163, PT-PT, com os três números do enquadramento). Regra 8 é explícita —
*esperar resposta de aluno NÃO é estar travado*. O que estava parado ali não era
o aluno. Era **dívida da casa dentro do cartão**.

### O bloqueio do `#380` estava morto há 10 dias e ninguém tinha olhado

A nota de 13/09 21:19Z termina com **"POR QUE NÃO MERGEEI"**: o PR #264 (texto
neutro da amostra pós-treino, que fazia a voz clonada de um português soar
brasileira) ficou condicionado a *"janela sem geração em voo, ou aval do
Johnny"*.

**Fui conferir em vez de herdar o bloqueio.** O PR #264 está **MERGED desde
15/09 02:20:36Z** e **em produção**:

| conferência | resultado |
|---|---|
| merge commit `7b673a72` é ancestral da `origin/main` | **SIM** |
| `git cat-file -p origin/main:runpod-worker/sample_gen.py` | `DEFAULT_SAMPLE_TEXT` = *"Olá. Esta é a minha voz clonada…"* — o texto neutro |
| guarda `test_amostra_pt_e_neutra` (`test_train_smoke.py:684`) | existe e passa (47/47) |

> ⚠️ **Armadilha que quase me pegou, e que fica escrita no cartão:** o commit
> citado na nota (`8c19f5a`) **não** é ancestral da main, porque o merge foi
> **squash** — o sha do branch não sobrevive. Quem conferir por *"o commit da
> nota está na main?"* lê **NÃO ESTÁ** e conclui que o conserto não subiu. O
> instrumento certo é o **conteúdo** da `origin/main`, nunca o sha.

Anotei o `#380` com isso (3 → 4 notas, 1 linha afetada, `aguardando_aluno`
preservado). **Não fechei**: o aluno não respondeu há 11,9d e eu não sei se o
recorte que sugeri resolveu. Fechar por silêncio é dizer que deu certo sem ter
medido.

---

## O que a ronda realmente entregou: o achado de lado que dormiu 12 dias

A mesma nota de 13/09 tinha uma última linha: *"NENHUM CI roda a suíte python do
worker. (…) Vale card próprio."*

**Passaram 12 dias e o card nunca foi aberto.** Conferi antes de abrir (busca por
`title` **e** por `description`: `runpod-worker`, `pytest`, `suite python`,
`nenhum CI` → **0 linhas**). Não era duplicata.

### Medição

`runpod-worker/` tem **12 arquivos de teste, 414 funções**. Nos 4 workflows
existentes, `grep` por `pytest` / `unittest` / `test_train_smoke` devolvia
**ZERO**. A única forma de rodar era digitar à mão o comando do docstring.

### O achado NÃO é "a suíte está podre" — é o contrário, e é pior

Rodei as 12: **414/414 verdes**. É exatamente por isso que ninguém percebia que
nada as executava.

> **Registro o caminho porque ele quase me fez publicar uma mentira.** Na
> primeira rodada, com o python do sistema, **9 dos 12 arquivos não executaram**
> e o placar parecia *"9 de 12 quebrados"* — manchete pronta. Fui ler o erro cru
> antes de afirmar: os 9 caíam pelo **mesmo** `ModuleNotFoundError: numpy`.
> Criei venv + numpy → sobrou 1 vermelho (`test_rate_qa.py`, errors=7); li o erro
> cru de novo → `requests` e `soundfile`. Instalei → sobrou `test_tail_qa.py` →
> `huggingface_hub`. Instalei → **414/414**.
>
> **ERRO DE IMPORT NÃO É ERRO DE TESTE.** Placar de suíte sem ler o erro cru
> inventa um incidente que não existe — e teria inventado um aqui.

### Por que importa, com caso concreto desta semana

`test_amostra_pt_e_neutra` não prende só o worker: ele **lê o `.ts` do backend**
e exige que a constante `SAMPLE_TEXT` de lá contenha o `DEFAULT_SAMPLE_TEXT`
daqui. É uma **invariante que atravessa dois componentes**, protegida por um
teste que nada executava. Hoje, quem dessincronizasse os dois lados passava no
CI inteiro.

E a suíte não guarda coisa pequena: prende as regras do **treino de voz**, que
custa **10k créditos por rodada** e cuja falha trava aluno por dias. Cada uma
delas já foi incidente.

---

## O conserto, e as duas armadilhas que desenharam ele

**Cartão `#583`** (`27bc98d7`) aberto e **fechado na mesma ronda**.
**PR #452**, merge **`83dbc12a`**, `.github/workflows/worker-tests.yml`, 123
linhas, arquivo novo, nada mais tocado.

### Armadilha 1 — não reciclar a frota do RunPod

`runpod-worker.yml` dispara em **push** com paths `runpod-worker/**` **ou o
próprio yml**, e esse build **recicla os endpoints de produção**
(`workersMax 0→N`). Foi isso que segurou o PR #264 por 2 dias.

Por isso: arquivo **separado** (não casa nenhum dos dois paths) e as 4 deps
instaladas **inline**. ⚠️ **Não criar `requirements-test.txt` dentro de
`runpod-worker/`** — casaria o path e passaria a reciclar frota a cada mexida em
teste.

**Prova, medida no merge real:** `gh run list --branch main` mostra que o merge
disparou **apenas** `Testes do RunPod Worker`. **`Build RunPod Worker` NÃO
disparou.** Nenhuma geração de pagante foi derrubada.

### Armadilha 2 — arquivo por arquivo, nunca `unittest discover`

Medido no mesmo commit:

| comando | resultado |
|---|---|
| laço por arquivo | **414 testes, 414 OK** |
| `python -m unittest discover` | 407 testes, **19 failures + 28 errors** |

Os testes se atropelam no mesmo processo (`PermissionError: '/workspace'`,
estado de módulo compartilhado). Se eu tivesse subido o comando "óbvio", teria
subido um **CI vermelho acusando código são** — a forma mais rápida de ensinar a
equipe a ignorar o CI.

### Controle de mutação (o CI pega a regressão, não só fica verde)

Reintroduzi em `sample_gen.py` o texto brasileiro que causou o `#380` →
`test_train_smoke.py` cai pra **2 falhas de 47**. Restaurei → **47/47 OK** e
`git diff --stat` **vazio** contra a main.

### Piso de 414

O job falha abaixo de 414 testes: se um teste sumir ou parar de ser coletado, o
placar cairia **em silêncio** com o CI verde.

### Verificado no ambiente real, não no meu

| run | resultado |
|---|---|
| PR #452 (`36193684412`) | **success**, 28s, `total de testes executados: 414` |
| main após merge (`36193809995`) | **success**, mesmo placar de **414** |

A medição local foi em Python 3.14; o job roda **3.11**. Por isso o path filter
inclui o **próprio yml** — pra ele rodar sobre si mesmo e a versão fixada ser
medida de verdade, não presumida.

**Branch concorrente:** conferi antes de mergear (a casa já pagou 7 vezes por
pular isso). Nenhum branch do origin toca `.github/workflows/` além do meu.

---

## O que este conserto NÃO resolve

Ele faz as guardas **rodarem**. Não aumenta cobertura, não conserta defeito de
produto e **não toca nenhum aluno**. As 414 já passavam antes — o que mudou é
que agora alguém as executa.

---

## Fila ao fim da ronda

**164 abertos** · **95** com 7d+ · percepção travada: **0**.

(Abri o `#583` e fechei o `#583` na mesma ronda, então o saldo é o mesmo da
ronda anterior.)

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **`#582` — o "pode" pros três pagantes.** R$ 2.926,09 + USD 40 pagos, zero
   acesso, EZ Motors cobrado **ontem**. Única com dinheiro correndo agora.
2. 🔴 **`payment_events.error` não vira chamado.** Enquanto não virar, o próximo
   pagante cai no mesmo buraco.
3. 🔴 **`#249` — o "pode" do WhatsApp** (Glauber, R$ 694, 42 dias).
4. 🔴 **`#250` — mesmo bloqueio** (Anderson, R$ 733,60, 50 dias). A medição do
   CPF inválido de 21hZ **ainda não entrou no cartão** — continua só no log.
5. 🔴 **A decisão de curso × plataforma** (28 alunos + a carta do Rafael).
   **Venceu em 25/09.**
6. 🔴 **`#702cc916` — 25d**, decisão de produto; destrava a cabeça da fila
   (`#52`, 38d, 22 alunos).
7. **Fila de decisão do Johnny: 18 cartões, 53 alunos**, mais velho 24d. **O lote
   segue sem ser montado** — a doutrina de 17/09 diz que o desfecho é juntar num
   lote e levar de uma vez, e isso não foi feito nesta ronda nem na anterior.
8. **`#426`** — os 309/349 do lote de 04/09.
9. **`patch_cfde107d`** do Vigia esperando revisão.
10. **77 cartas anteriores a 14/09** — segue sem decisão de escrituração.
11. **`emails_enviados.bounce_em` sub-registra** — 1 caso provado (`#460`).
12. **`sgp_fracassos` com 0 linhas** — indistinguível entre "sem falhas" e "não
    grava".
13. 🆕 **O gate de rosto não confere tamanho do rosto no quadro** (`#335`
    aberto, classe do `#369`/mastroianni). Os 8.655 créditos do Ricardo seguem
    presos nessa decisão de política.

### A lição desta ronda, pra próxima não repetir

**A ronda de 21hZ fechou com "conserto que passa a GRAVAR prova cria uma dívida
de LEITURA". Esta ronda achou o gêmeo exato: GUARDA ESCRITA QUE NADA EXECUTA.**

Nos dois casos a casa fez a parte difícil (instrumentar, testar) e pulou a parte
barata (ler, rodar). O `#315` gravava desde 16/09 e ninguém leu por 9 dias. As
414 guardas existiam e nada as rodava. **Instrumento que não é consultado é
enfeite** — e o defeito não aparece no dia em que se cria, aparece no dia em que
alguém precisava dele e ele estava calado.

Corolário prático, que vale pra quem pegar a próxima: **antes de reapurar um
bloqueio herdado, confira se ele ainda existe.** O `#380` carregava um "não
mergeei" 10 dias vencido, e o `#264` já estava no ar desde 15/09. Reapurar no
escuro é o custo de confiar na nota em vez de medir o estado.
