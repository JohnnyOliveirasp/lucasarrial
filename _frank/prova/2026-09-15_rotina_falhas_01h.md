# 15/09 ~00h40Z–00h55Z — Rotina das falhas

Fila **79 abertos** na abertura, **79 no fim**. **Nenhum fechado, nenhum aberto.**
A entrega da ronda foi **código em produção**: o `#404` ganhou o passo que
faltava (PR **#285**, merge **`06c28de`**, deploy **SUCCESS ~00h50Z**), provado
de ponta a ponta antes de eu fechar a ronda.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa, mais a ordem de **29/08** (planilha desligada).
**Nada da planilha foi lido, escrito, classificado ou reprocessado.** Ordem de
canal de **31/08**: o aviso desta ronda foi **no grupo**, com `notify-grupo.sh`,
e só lá.

Varreduras fixas, antes de tudo:

- **Travados:** 3 presos, **nenhum novo** — os mesmos já tratados nas rondas
  anteriores. Nada a fazer.
- **Estorno:** 13 devolução + 13 não-devolução cadastrados, **3.255 linhas**
  varridas, nenhum tipo por classificar.

## O que eu NÃO deixei passar na varredura de estorno

O `estorno_confere` fecha com **`SEM ESTORNO CASADO: 4`**. Isso *parece* quatro
alunos cobrados e não devolvidos, que seria a exceção da regra 8 (dinheiro
errado agora) e furaria a fila na hora. Fui conferir em vez de assumir os dois
lados:

| generation | aluno | status | lançamentos no extrato |
|---|---|---|---|
| `dd4b98a3` 20/08 | johnny.oliveirasp (conta da casa) | failed | **0** |
| `db811e2f` 20/08 | serescastro6 | failed | **0** |
| `678267fe` 24/08 | kessulyl | failed | **0** |
| `e0de4212` 24/08 | kessulyl | failed | **0** |

**Zero lançamentos nos quatro: ninguém foi debitado, então não há estorno a
casar.** "Sem estorno casado" aqui significa *sem cobrança*, não *cobrado e não
devolvido*. **Nenhum aluno está no prejuízo.** Registro porque o rótulo do
próprio instrumento induz à leitura oposta, e ler errado custaria pagar em dobro
— a mesma família de erro que a armadilha do `ref_type` × `kind` já cravou.

## Qual peguei, e por que

**O `#404`, que eu mesmo abri na ronda passada — e peguei por regra, não por
gosto.** A regra 8 manda levar UM incidente **até o fim**; o `#404` tinha um
passo único e já identificado (*persistir `elapsed_seconds` também no `ready`*),
e o Vigia tinha deixado o **patch pronto** (`patch_7405e5aa`, 0,5h na fila).
Largar um cartão meu com o conserto na mão pra ir buscar outro é exatamente o
abandono no meio que a regra proíbe.

Tem um segundo motivo, e ele é medido, não retórico: **o valor deste fix decai
por hora.** Ver abaixo.

## Não aceitei o diagnóstico do Vigia de graça

Ele é **sensor**: abre e anota. A decisão é minha, e o patch é insumo. A
afirmação que sustentava o patch inteiro era *"os três chamadores já passam
`executionTimeMs` no COMPLETED"* — se fosse falsa, o fix gravaria `null` pra
sempre e eu teria subido código inútil. Li os três:

- `sweep-clones/route.ts:63-67` — passa `st.executionTimeMs` em **qualquer**
  status terminal ✔
- `webhooks/runpod/route.ts:169-176` — passa `payload.executionTime` ✔
- `video-clone/[id]/route.ts:44-51` — passa `st.executionTimeMs` ✔

Verdadeira. E `finalize.ts:39-47` de fato faz `update {status:'ready'}` e
**`return`** antes do bloco que grava a evidência (`:74-96`), que só roda depois
do gate de falha da linha 49. O número chegava e era jogado no lixo.

Conferi também o que ninguém tinha afirmado: **a coluna `elapsed_seconds` já
existe** (mig 90, checada no `information_schema`). **Nenhuma migration foi
necessária** — portanto nada que dependesse de aval.

## A verificação que o Vigia registrou como impossível pra ele, e que eu fiz

O próprio patch trazia a confissão: *"não há credencial de banco no sandbox,
então não vi uma linha `ready` com `elapsed_seconds` preenchido"*. Esse era o
risco real do patch — gravar `null` eternamente. Fui no RunPod direto, nos jobs
`ready` ainda dentro da janela:

| clone | áudio | teto | `executionTime` | % do teto |
|---|---|---|---|---|
| `53987ca8` 00:21Z (v3) | 12,98 s | 1590 s | **1.164,0 s** | **73,2%** |
| `cb701165` 23:51Z (v3) | 49,29 s | 2700 s | **2.181,7 s** | **80,8%** |

**O `executionTime` vem no sucesso.** O fix tinha onde morder.

## Por que era urgente — e isto é medição, não pressa

O status do job **expira no RunPod**. Varri as **últimas 5h** de `video_clones`
e consultei o RunPod **job a job**:

> **24 de 28 já estavam EXPIRADOS.** Só os 2 `ready` mais recentes ainda tinham
> o dado.

Os `failed` daquele intervalo **têm** duração (o código grava na falha); os
`ready` **perderam todos**. São ~5-6 medições destruídas por hora de atraso —
o mesmo mecanismo que deixou **9 falhas de 22/08 sem causa atribuível**, e que o
próprio `finalize.ts` documenta em comentário. Adiar este fix não era neutro:
era continuar queimando a evidência que decide o cartão.

## O que fiz

1. **Patch revisado linha a linha** e aplicado em `vigia/7405e5aa` (regra 14-B).
   Escreve **só quem venceu o gate idempotente** (dentro do `applied`) — webhook,
   poll e sweep disputam a mesma row —, em `UPDATE` separado com `try/catch` +
   `logger.warn`: **telemetria não pode derrubar a transição pra `ready`**, o MP4
   do aluno já está no R2.
2. **Verificação local, não a do sandbox dele:** `eslint` nos 2 arquivos tocados
   **limpo (exit 0)**; `tsc` com 4 erros, **todos pré-existentes e nenhum nos
   arquivos tocados** — 3 são artefatos velhos em `.next/types` apontando pra uma
   rota que **não existe mais em `src`** (conferi que sumiu) e 1 é `vitest`
   ausente (conferi que não está instalado). Não chamei de pré-existente sem
   olhar.
3. **PR #285 → merge `06c28de` → deploy SUCCESS ~00h50Z.** Card/PR não deploya,
   só a main deploya (lição de 19/08): esperei o workflow **terminar** em vez de
   dar o merge por entregue.
4. **Patch drenado** do `agent_state` (`--apagar`, 1 linha), conferido na
   releitura: `nenhum patch do Vigia esperando`.
5. **Nota no `#404`** com tudo isto. Cartão segue **`investigating`** — ver
   abaixo.

## A prova de ponta a ponta — e uma correção minha, dentro da própria ronda

Na primeira nota eu escrevi que nenhum job em voo tinha fechado a tempo e que a
confirmação ficaria pra próxima ronda. **Estava desatualizado em minutos:** um
dos dois fechou logo depois e o código novo pegou ele.

| | |
|---|---|
| clone | `ea85eab2` (480p-v2 Turbo, áudio 75,6 s), finalizado **depois** do deploy |
| RunPod `executionTime` | **2.048.750 ms = 2.048,75 s** |
| Banco `elapsed_seconds` | **2.048,75 s** |
| bate? | **idênticos** |

É **exatamente** a checagem que o Vigia listou como *"o que eu não consegui
verificar"*. O fix **não grava `null` e não grava número errado**. O buraco de
1.986 `ready` sem duração **parou de crescer às 00h50Z de 15/09**.

Voltei na nota e corrigi em vez de deixar a versão velha de pé: a ronda passada
ficou 8 dias presa num caso justamente por responder em cima de retrato velho.

## O achado — com o tamanho de amostra dito na cara

Amostra sobe pra **n=3**:

| tier | áudio | % do teto usado |
|---|---|---|
| 480p-**v3** Padrão 2.0 | 12,98 s | **73,2%** |
| 480p-**v3** Padrão 2.0 | 49,29 s | **80,8%** |
| 480p-**v2** Turbo | 75,6 s | **58,9%** |

Duas coisas, e nenhuma delas é conclusão:

1. **Job saudável não termina "bem antes" do teto.** O comentário do próprio
   `config.ts` afirma que o teto é *"rede de segurança, não meta — job saudável
   termina bem antes"*. Medido hoje, roda a 59–81% dele. Um áudio de **13 s**
   levou **19,4 min**, quase todo o orçamento **fixo** de 20 min de setup (o
   design assumia ~10 min de carga de modelos). Se isso se confirmar, a causa
   muda de *"teto apertado"* pra *"setup dobrou de custo"* — **conserto
   diferente**.
2. **O risco parece concentrado no fluxo v3, não no tamanho do áudio.** O Turbo
   gastou **menos** orçamento (58,9%) com o áudio **mais longo** dos três. Isso
   conversa com o que o `#244` mediu ontem, no mesmo aluno e na mesma noite:
   86,82 s no Turbo **entregou**, os mesmos 86,82 s no Padrão 2.0 **morreram no
   teto**. E as **7 falhas de 14/09 foram TODAS 480p-v3**.

## O que NÃO fiz, e por quê

- **Não mexi no teto.** `n=3` não decide teto. E se a causa for o fluxo v3 e não
  a régua, **subir o teto só faz o aluno esperar mais antes de falhar** — o item
  4 do cartão continua valendo, agora com um motivo a mais.
- **Não fechei o `#404`.** Este PR **não conserta** o cartão: ele só para de
  jogar fora o dado que decide o conserto. Marcar `fixed` aqui seria violar a
  regra 14. Segue `investigating`, **com nota do que já foi descartado**.
- **Não persisti o `delayTime`** (fila do RunPod), que também chega de graça:
  exigiria coluna nova, e **DDL sem aval não sai**.
- **Não escrevi pra aluno nenhum.** Os 6 afetados pelo `#404` já foram estornados
  1:1 pela própria casa e já foram avisados/registrados na ronda anterior; carta
  a 5+ de uma vez é envio em massa e depende do "pode" do Johnny (regra 8).

## Recado pra próxima ronda que pegar o `#404`

Olhe a distribuição **por TIER**, não só por tamanho de áudio. A partir de agora
`ready` e `failed` saem da **mesma fonte** (`executionTime` do RunPod), então
`elapsed_seconds / teto` é comparável direto entre os dois — não repita no Vídeo
Clone a armadilha do `generations`, onde `elapsed_seconds` significa duas coisas
(sucesso = tempo do worker **sem** setup; falha = RunPod **com** setup) e
comparar os dois falseia a régua.

## Fim de ronda

- `git fetch origin && git log --oneline origin/main..HEAD` → **vazio**.
- `git branch` → nenhum fix preso: `vigia/7405e5aa` foi **mergeada e apagada**
  no merge do PR #285.
- Deploy do `06c28de`: **conferido SUCCESS**, não presumido.
- Único trabalho em voo ao fechar: 1 clone `generating` (`e4f55e36`), dentro do
  teto, sem nada a fazer.
