# Ronda das falhas — 25/09, ~12hZ (Frank, dono da fila)

## Passos fixos da ronda

**Reconciliação dos envios (#101)** — `2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar`:
1269 cartas lidas da pasta `Sent`, 1192 já tinham linha, **0 escrituráveis dentro
da janela**, 0 recusadas, contagem fechando 1269 = 1269. As 77 anteriores ao corte
seguem sem decisão (é o que o `--corte` exclui), como manda o índice.

**Irmão de leitura** — `2026-09-18_enviados_x_tabela.cjs`: veredito **0 carta depois
do corte** fora da tabela. O buraco segue passivo.

**Percepção travada (doutrina 17/09)** — `percepcao_travada.cjs` (controle positivo
#310 OK, negativo #518 OK, 555 incidentes varridos): **1 cartão**, o #571, parado há
**0,0d** (nasceu nesta mesma manhã). Não é resíduo: é o cartão que eu trabalhei
abaixo, e o bloqueio de percepção dele está declarado com motivo concreto e data.

## Estado da fila

162 abertos: 114 `investigating`, 36 `aguardando_aluno`, 12 `open`.

⚠️ **Falso zero que quase entrou no relatório.** A primeira consulta da fila voltou
`[]` e eu ia ler isso como fila vazia. Era flag errada minha (`--file` em vez de
`--arquivo`): o `sql.cjs` tratou a string `--file` como a própria query. O zero
concordava com uma leitura cômoda, e é exatamente aí que se desconfia — mesma
família dos zeros de 18/09 e 23/09. **Régua: zero que agrada se confere pela
ferramenta, não pela vontade.**

## Cartão que peguei primeiro: #52 — NÃO fechou, e digo onde travou

Mais antigo com aluno afetado (37 dias, 22 alunos, ainda disparando em 23/09).

**Passo em que travou:** a decisão do Johnny no **#226** (`702cc916`) — (a) manter /
(b) falhar sem cobrar / (c) entregar avisando — escalada desde **21/09 18:59Z**, sem
resposta.

Conferi que o bloqueio ainda vale em vez de repetir a nota anterior: dos 4 cartões
que bloqueavam a cabeça da fila, **três já saíram** (`c726c5ae`/#312, `d3d8d1b2`/#15,
`b706b32e`/#469, todos `fixed`). Sobrou só o #226. A fila destravou por fora; o que
resta é **uma decisão humana**.

Não acrescentei investigação nova de propósito: a nota 67 já refutou 4 remédios
técnicos com número e mostrou que a coverage por chunk já é calculada em 100% das
linhas (`loop.py:536`). O que falta não é medição, é política. Uma 5ª medição não
entrega áudio bom para ninguém.

## Cartão que levei até o fim: #571, perna (1) — EM PRODUÇÃO

**O defeito:** em `_ajustar_ritmo_global` (`runpod-worker/jobs/inference.py`), quando
o fator necessário passa do teto (`max_stretch=0.85`), o `max()` clampa, a correção
para no meio do caminho, e o áudio sai **fora da tolerância declarada sem registrar
nada** — `ready` deixando de significar "dentro do critério da casa". Medido neste
cartão: **115 gerações, 70 alunos distintos**, a pior a +89% da velocidade natural.

**O que subiu:** PR **#444**, squash **`f6dc4f5d`** na main. `generations.qa` passa a
receber `rate_clamp_mordeu` (os dois lados, rápido e lento) e
`rate_fora_da_tolerancia` (desvio final) quando mesmo após o ajuste o desvio
continua fora. Chave ausente = teto não mordeu, mesma convenção do
`rate_global_fator`.

**Conferido no CONTEÚDO da `origin/main`** (`git cat-file`), não no rótulo do PR, e
`f6dc4f5d` confirmado ancestral de `origin/main`. **Sem migration**: `generations.qa`
é `jsonb` (conferido no `information_schema`); não criei coluna — logo não há o risco
de "DDL commitado não é DDL aplicado".

**Prova que rodei (saída real, não plano):**

| Controle | Resultado |
|---|---|
| 5 testes novos | 5/5 OK |
| Suite inteira do arquivo | 56/56 OK |
| Mutante 1 (`desvio_final` ignora o fator) | 3 falhas ✔ o teste morde |
| Mutante 2 (`teto_mordeu` nunca dispara) | 2 erros ✔ o teste morde |
| Fonte restaurada | `git diff` limpo |

Os números batem com a produção medida no próprio cartão: `3.14 → fator 0.85 →
desvio_final 0.247` (os +24,7% do `741f30f3`) e `2.69 → 0.85 → 0.068` (os +6,8% do
`b7fa1c38`). A implementação **reproduz a medição do incidente** — é isso que
transforma "passou nos testes" em prova.

**Declarado, não omitido:** `test_rate_qa.py` dá 7 erros (`soundfile` sem `write`).
Conferi rodando **na main sem a minha mudança**: os mesmos 7. É falta de dependência
no venv descartável, não regressão minha.

**Limite declarado:** `desvio_final` é **estimativa** (`wps_final = medido * fator`),
não re-medição pós-stretch (custaria outro whisper por job). É a mesma conta que
mediu as 115 gerações, então é comparável com a medição — mas não é medida nova.

**O que isto NÃO faz:** não conserta áudio de ninguém e não avisa aluno nenhum.
Torna a classe **visível dentro do produto**, que era o buraco: até hoje o tamanho
dela só existia como foto de script de ronda. Não subi o `max_stretch` — continua
reprovado (esticar demais soou "bêbado", caso Johnny 25/08, está no docstring).

Perna (2) é decisão do Johnny (áudio fora da tolerância pode sair `ready` e ser
cobrado?). Perna (3) é causa e precisa de **ouvido**, que a casa hoje não tem.

## Fleet: uma lição minha, e ela estava ERRADA na primeira versão

A delegação ao `coder` voltou "VAZIO, 0 tokens" em **303s**. Troquei o modelo
(`claude-fable-5` → `claude-sonnet-5`), o prompt trivial respondeu em **6s**, e eu
gravei a lição "fable-5 morto".

**Estava errada.** A tarefa real abortou de novo em **exatamente 303s no sonnet-5**.
Dois modelos diferentes, a mesma duração exata: não é provedor morto, é **teto de
duração no caminho de delegação síncrona**. Apaguei a lição errada
(`forget-cli`) e gravei a certa. Fica a régua: **duração idêntica em falhas
diferentes acusa o harness, não o modelo** — e trocar modelo por causa disso é
tratar sintoma.

Detalhe que só apareceu porque fui olhar o repositório em vez de acreditar no
"vazio": o worker **tinha feito o trabalho** e commitado na branch antes de ser
abortado — o que morreu foi a mensagem final, não a entrega. O PR #444 já existia.
Minha contribuição virou a **verificação** (rodar, mutar, conferir na main), que é
justamente o que não se pode terceirizar.

## Fim de ronda

- `git log --oneline origin/main..HEAD` → vazio (confirmado abaixo no commit deste log)
- Nenhum fix preso em branch: `feat/571-sinal-clamp-de-ritmo` foi mergeada e apagada
- Build do worker (`runpod-worker.yml`) disparou sozinho no merge — anotado o
  resultado no grupo quando fechar
- Não gastei GPU, não mexi em crédito, não mandei carta em massa, não toquei em
  migration, não mergeei nenhuma das branches STALE do índice
