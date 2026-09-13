# Ronda das falhas — 13/09/2026, ~17hZ (14h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais a ordem de **27/08**
(só erro de sistema vira chamado), a de **29/08** (planilha desligada) e a de
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

**Item serial único do turno: `#ce6e157d` (Katia).** Escolhido pela regra 8 — o
mais antigo com aluno afetado. Não fechei, e explico por quê.

Fila: **80 abertos**. O mais velho é o `d3d8d1b2` (45,2d), mas ele não tem aluno
esperando (todos estornados automaticamente, aceite de risco do Johnny em 20/08).
O `ce6e157d` é o mais antigo **com gente esperando resposta**: 25,2d, e com o
relógio de acesso dela vencendo em **15/09**.

---

## 0. Por que não abri exceção à regra serial

Antes de travar no item, conferi a única coisa que autoriza largar o serial:
dinheiro sendo cobrado errado agora. **Não está.** Cobrança de geração viva e
estável nos últimos 4 dias (09/09 a 13/09: 48/72, 63/90, 78/99, 56/75, 11/17
cobradas). A proporção é constante, então não há queda de cobrança. Segui no
serial.

---

## 1. ⏰ A promessa que estava vencendo era nossa, e eu não sabia dela

A primeira coisa útil da ronda veio de conferir a caixa de **Enviados** antes de
escrever (regra da ronda: conferir na caixa, não na palavra de ninguém). Achei
o que não estava em lugar nenhum do card:

| uid | quando | o que |
|---|---|---|
| 2040 | 12/09 22:53Z | diagnóstico "3 palavras não foram faladas" |
| 2041 | 12/09 22:55Z | **retratação** 2 min depois: "não sumiram, foram trocadas" |
| **2075** | **13/09 11:10Z** | ela respondeu, e a Fast prometeu: *"vou escalar pra equipe técnica... eles vão ouvir o áudio com atenção e te retornam aqui"* |

**Essa equipe técnica sou eu, e a promessa estava 6h parada.** Ela ainda gerou
mais dois áudios às 13:50 e 13:53 — depois da promessa, testando de novo. É o
caso clássico de aluno esperando, que a ordem manda pôr antes de limpar fila.

A queixa dela de hoje, nas palavras dela: *"as frases terminam abruptas, como se
estivessem no meio"* e *"a palavra Morgana está cortada no final"*.

---

## 2. As duas hipóteses que este card perseguia há semanas: as duas CAÍRAM

Medi as duas gerações de hoje (`60cf27fa` 13:50:08Z e `ed61d09c` 13:53:37Z,
mesmo texto de 121 chars). **Rodei o `--ensaio` da régua de envelope antes de
medir qualquer coisa** — ela reproduziu a classificação feita à mão nos 3 casos
de referência. Só depois apontei pro caso dela.

| hipótese | veredito | a medida |
|---|---|---|
| **Decapitação de envelope** (`#234`/`f8587cef`) | **CAIU** | `60cf27fa` release **175ms** plató **-56,4dB**; `ed61d09c` release **125ms** plató **-49,4dB**. A régua é `release<=35 E plató>-40`. Nenhuma marca, com folga larga. |
| **Palavra que não foi gerada** | **CAIU** | whisper palavra a palavra: **as 24 palavras estão presentes nas duas**. |
| **"Morgana" cortada** (a queixa literal de hoje) | **CAIU** | é a palavra **mais longa** dos dois arquivos: **580ms** (2,07x a mediana) e **600ms** (2,73x). Inteira, com alongamento final normal. |

A telemetria confirma a lição de 12/09 de novo: o `ed61d09c` reporta
`faltantes_amostra=["para","vinda","vinda"]` e **nenhuma das três sumiu** — saiu
"pra" por "para" e "vindo" por "vinda". `coverage`/`faltantes_*` continuam lendo
**troca** como **omissão**.

---

## 3. ✅ O achado que vale, e que ela pode usar hoje

**A troca de gênero é sorteio, e ela não tem como consertar escrevendo.**

Mesmo texto, mesma voz, **3min29s de intervalo**:

- `60cf27fa` (13:50) → *"Bem-**vinda** ao seu portal"* nas duas vezes — **certo**
- `ed61d09c` (13:53) → *"Bem-**vindo** ao seu portal"* nas duas vezes — **errado**

Ela já tinha tentado resolver sozinha tirando o hífen de "Bem-vinda", e não era
isso. **Apontei a ela qual dos dois arquivos usar** — é a coisa concreta que saiu
desta ronda pro lado dela.

---

## 4. 🟠 Ritmo: defeito nosso, com classe grande e número

As duas de hoje saíram **fora da régua da própria voz dela**
(`voices.speech_rate_wps = 2,97 pal/s`, gravada em 04/09):

| geração | articulação | desvio |
|---|---|---|
| `60cf27fa` | 3,58 pal/s | **+20,6%** |
| `ed61d09c` | 4,29 pal/s | **+44,3%** |

E o `qa` das duas **não tem nenhum campo `rate_*`**: o gate de ritmo não rodou.
Causa: desde 29/08 ele é **opt-in** (`route.ts`, `body.rate_qa === true`) e a
tela **nasce desligada a cada carregamento** (`voice-generator.tsx:66`,
`useState(false)`).

**A casa mede a régua da pessoa, mede que a saída está fora dela, e entrega assim
— sem corrigir e sem avisar.**

**Classe medida** (gerações `ready` de vozes **com régua**, desde 29/08):

- **849** gerações · **229** alunos · **280** vozes
- só **306 (36%)** rodaram o gate → **543 entregues sem correção nenhuma**
- das **258** com fator gravado, **151 (58,5%)** bateram no **teto** (0,85) e
  foram entregues **ainda fora da régua, em silêncio** — **95 alunos**

É a dívida (a) nomeada em 12/09, agora com número.

**NÃO mexi no default.** Ligá-lo é decisão de produto do Johnny, que a fixou em
29/08 (*"o padrão do worker é desligado, quem decide é o aluno"*). Levei ao grupo
como decisão dele.

---

## 5. ⚠️ Falso alarme que eu mesmo derrubei ANTES de reportar

Medi `voices.tts_silence_ms` **NULO em 1212/1212** vozes `ready` e quase levei ao
grupo como "o pacing do 080dd74 morreu em produção".

**Não é bug.** `finalize-training.ts` documenta: o pacing foi **DESLIGADO em
24/08 por ordem do Johnny** (caso Kessuly — pausa + crossfade 0 deixou a voz
*"horrível, muito pior"*), e as 93 vozes treinadas desde 21/08 foram **zeradas de
propósito** (backup em `_Bugs/chamado_108_referencias/`). O worker ainda **mede**
`reference_pause_ms`; só não aplica. **Zero em 1212 é o estado correto.**

Registro porque o número é assustador e vai reaparecer: ler a coluna sem ler a
decisão faz parecer regressão. Fui no código antes de abrir a boca.

---

## 6. ❌ O que continua SEM CAUSA — e por isso não fechei

A queixa principal dela, *"as frases terminam abruptas"*, **eu não expliquei**.

Testei a hipótese de o alongamento final estar sendo comido pelo ritmo alto:
**caiu** — o alongamento está lá (2,07x e 2,73x).

Sobrou **uma pista aberta**: a palavra **"Bem" sai com 0ms / 20ms / 40ms** nas 4
ocorrências, contra 120–600ms de toda outra palavra. Tentei separar
"artefato do tokenizador" de "fala engolida" com uma sonda acústica de energia, e
**a sonda não serve**: ela acende **idêntica** em palavra boa conhecida
("portal", "Morgana", "você" também dão 200ms de fala na janela anterior), porque
a fala é contínua e não há silêncio entre palavras pra usar de marco.

**Sonda que não separa o positivo conhecido não vale nem zero nem um.** Não
concluí nada dela. Quem pegar este card a seguir: a pista do "Bem" de 0ms segue
aberta e precisa de instrumento que não seja energia bruta — alinhamento forçado
por fonema, provavelmente.

---

## 7. O e-mail que saiu

**uid 2108, CONFIRMADO em Enviados.** O que eu disse a ela, e o que não disse:

- Abri reconhecendo que ela recebeu **3 explicações em 2 dias, 2 erradas**, e que
  a culpa é nossa. Sem isso o resto não tem crédito.
- Dei o que é **concreto e usável hoje**: qual dos dois arquivos está com o
  gênero certo.
- Dei o que é **acionável**: o botão "Ajustar ritmo", que nasce desligado — e
  disse na mesma frase que ele **tem teto e não fecha a distância toda**, pra não
  vender como solução completa o que eu já medi que é parcial.
- Disse **"eu ainda não sei"** sobre a abruptez, com todas as letras, e **não dei
  prazo**. Uma quarta teoria confiante seria dano, não atendimento.
- Ofereci refazer **por conta da casa**, e **não executei** — GPU só com o aluno
  pedindo.

---

## 8. Placar honesto

- **Incidentes fechados: 0.** O backlog não baixou nesta ronda.
- Alunos escritos: **1** (Katia, uid 2108 confirmado em Enviados).
- Incidentes anotados: **1** (`ce6e157d`, nota longa com o que foi descartado).
- Hipóteses derrubadas com régua: **3** (envelope, palavra faltando, alongamento).
- **Falso alarme meu, pego antes de reportar: 1** (pacing nulo em 1212 vozes).
- **Sonda minha reprovada por mim: 1** (energia bruta na janela do "Bem").
- Classe nova medida: **1** (gate de ritmo opt-in — 543 sem correção, 95 alunos
  entregues no teto em silêncio).
- Créditos gastos de aluno nesta ronda: **0**. GPU disparada por mim: **0**.
- Código em produção: **0 merges** (não havia fix pronto pra subir).

**O que emperrou, dito na cara limpa:** eu fechei 3 hipóteses e não achei a
causa. O card `ce6e157d` fica `investigating` porque **`fixed` sem resolver viola
a regra 14**, e a ordem de 21/08 é pra fechar mais, não pra fechar mais rápido do
que resolve. O passo que emperrou tem nome: falta instrumento que separe fala
engolida de artefato de transcrição.

**A decisão que não é minha:** ligar o ajuste de ritmo por padrão quando a casa
já mediu a régua do aluno. É produto, o Johnny fixou o contrário em 29/08, e
está no grupo com o número.

**O que eu NÃO fiz:** não fechei incidente sem resolver, não toquei em crédito de
ninguém, não disparei GPU, não mudei default de produto por conta própria, não
mergeei branch STALE, não li a caixa do suporte@ pra triagem (só Enviados e o fio
da aluna que eu estava tratando, `EXAMINE` + `BODY.PEEK`), não toquei em e-mail
não lido, e não inventei causa pra parecer produtivo.
