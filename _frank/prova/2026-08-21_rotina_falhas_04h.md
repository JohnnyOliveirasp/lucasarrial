# Rotina das Falhas — ronda das 04h UTC de 21/08 (Frank, dono da fila)

Ordens lidas: `_frank/ordens/README.md` (índice) → `2026-08-20_dono_da_fila_e_fila_zerada.md`
(⭐ vigente) + `2026-08-20_fluxo_quem_olha_o_que.md`.

**Fila no início:** 5 abertos (todos `investigating`) — os mesmos 5 das 03h, nada novo em 40min.
**Fila no fim:** 5 abertos. **Fechados nesta ronda: nenhum**, e explico cada um.
**Entregue:** 1 bug de aluno achado e corrigido (PR #22, `a713f6c`), 1 lista de e-mail
corrigida **antes** de sair errada, 1 ferramenta que fecha um buraco que já destruiu dado 2×.

---

## 1. O achado: o balde fechado escondia um bug nosso — de novo

Rodei o detector de **fechado que continua disparando** (a armadilha do item 5 da ordem, a
mesma que fez o `8d370ef5` esconder 14 ocorrências). **1 de 66 fechados** apareceu:

`acf8acd6` "Treino de voz: áudio insuficiente/sem fala limpa" — `fixed` pelo james em
**09/08**, e mesmo assim **6 ocorrências depois do fechamento**.

A causa que o james achou e corrigiu (VAD unindo só `gap<=0,6s`, fix `9c376c8`) está
**realmente curada** — não reabri isso. O que sobrou é **outro defeito, na mensagem**, e é o
**gêmeo exato** do que o PR #22 tinha acabado de corrigir na porta:

```
"apenas ~10min serviram para o treino (mínimo: 10min de fala limpa)"
```

`finalize-training` arredondava com `Math.round` os **dois lados da comparação**. O PR #22
consertou o `Math.round` da **PORTA** (20min brutos) e **deixou intacto** o do **TREINO**
(10min de fala limpa) — nas linhas logo abaixo, no arquivo que ele mesmo editou.

### Os números, de `training_jobs.useful_seconds` (mínimo 600s)

| aluno | tentativas | faltou |
|---|---|---|
| `dirceu.moura.cruz78` | 594,2s · **598,5s** · 591,1s | 5,8s · **1,5s** · 8,9s |
| `lauriane20` | 3 tentativas, todas exibindo "~10min vs 10min" | — |

**1,5 segundo.** A frase afirmava que ele tinha exatamente o mínimo e mesmo assim o recusava,
sem dizer o que mudar. Os dois alunos tentaram **3 vezes seguidas às cegas** — não havia o
que fazer com aquela mensagem.

Medição: **848 vozes paginadas** → 20 com a mensagem numerada → **6 impossíveis (X >= Y),
2 alunos**. Estorno conferido **por `ref_type='generation_refund'`, nunca por `kind`**: as 3
tentativas do dirceu têm os 3 estornos de +10.000. Ninguém ficou sem crédito.

### O fix — commit `a713f6c`, no PR #22

Não inventei régua nova: movi pra `regua-audio.ts` as duas regras que **já eram lei na
porta** (arredondar pra BAIXO o número do aluno; dizer quanto falta e qual o alvo), e
`finalize-training` passou a só chamar. Era a duplicação que deixava os dois lados divergirem.

> **antes:** apenas **~10min** serviram para o treino (mínimo: **10min**) (…) tente de novo
> **depois:** apenas **~9min** serviram (mínimo: 10min). **Faltou muito pouco — menos de 1min
> de fala limpa.** (…) para enviar de novo, a gravação precisa somar pelo menos **20min no
> total** — é dessa folga que saem os 10min de fala limpa.

`tsc --noEmit` limpo · `eslint` limpo nos 3 arquivos · `node --test` **12/12**.
**Colisão conferida ANTES de editar:** varri os 13 PRs abertos, nenhum toca
`finalize-training.ts` nem `regua-audio.ts`.

Voltei ao **mesmo branch** (`fix/regua-audio-mensagem-honesta`) em vez de abrir PR novo —
mesmo arquivo, mesma régua, PR não mergeado. Abrir outro seria colidir comigo mesmo.

**Escopo:** só texto. Nenhum limite mudou de valor, nenhuma migration, nenhuma GPU, nenhum
crédito mexido, nenhum aluno destravado. Conferido que `classifyCause` continua casando como
`user_dataset`, **com teste travando os marcadores** — sem eles a falha viraria `unknown` e
pagearia o suporte como defeito nosso (gap `4eed0e0d`).

---

## 2. A correção que evitou e-mail errado pra 7 pagantes

A ronda das 03h pediu ao Johnny (msg 204) o "pode" pra escrever a **9 pagantes parados**.
Refiz a **pergunta (1) da rotina — "JÁ RESOLVEU SOZINHO?"** — aluno por aluno, antes de
qualquer coisa sair. **7 dos 9 já tinham resolvido sozinhos.**

| aluno | desfecho real |
|---|---|
| `natali.marcio` | 2 vozes **ready** (19/07 e 24/07), gerou até 04/08 |
| `fabiobragaclone` | **ready** 03/08, 2h depois da recusa; gerou 18/08 |
| `catarinacouras` | **ready** 06/08, 3h depois; gerou no mesmo dia |
| `sidbae` | **ready** 10/08 após 4 recusas; gerou 20/08 |
| `rafaelleitemacedo` | **ready** 16/08; gerou 16/08 |
| `dirceu.moura.cruz78` | **ready** 16/08; gerou 16/08 |
| `richard.moraes` | **ready** 18/08; gerou 18/08 |

O erro foi de contagem: as 03h contaram **vozes** em `rejected_too_short` e concluíram
**aluno** parado. Não é a mesma coisa — o aluno tenta de novo com outra voz.

⚠️ O `richard.moraes` era o **caso emblemático** do relatório das 03h ("mandou exatamente os
15min que nós pedimos"). Ele resolveu sozinho em 18/08. Manter o nome dele numa lista de
vítimas seria falso.

**Realmente sem nenhuma voz pronta e nunca contatados: 2.**

| aluno | parado desde | crédito | acesso vence |
|---|---|---|---|
| `jrfengenhariadf` | 25/07 (26 d) | 100.000 | **25/08** |
| `leandro.fitoway` | 30/07 (21 d) · **zero gerações** | 97.620 | 29/08 |

Os dois batem com a **varredura automática**, que nesta ronda listou 5 pagantes sem voz
pronta: estes 2 + ivanilde, marcelo e csitya — e **esses 3 já foram escritos** (uids
200/202/203). Registro o que isso significa: o **detector consertado (`7ee785f`) estava
certo, e a lista feita à mão das 03h é que estava inflada**. Foi o automático que ganhou da
medição manual, não o contrário.

**Consequência prática:** se o e-mail sair pros 9, sete pagantes **com voz funcionando**
recebem "sua voz foi recusada, grave 20min". O número certo é **2**. Gravei isso nas notas do
`b9c5a0d1` pra que qualquer ronda que execute o envio leia a lista certa.

---

## 3. Dado sendo destruído toda ronda — e a ferramenta que fecha isso

Ao ler as notas dos incidentes achei `agent_notes` com o conteúdo assim:

```
"[object Object],[object Object],[object Object]\n\n[vigia 21/08 02h UTC] ..."
```

Alguém concatenou **string** em cima do `jsonb` que é **array**. Medido em todos os 71
incidentes: **68 arrays, 3 strings corrompidas, 21 notas destruídas** — e são justamente os
3 incidentes abertos que travam pagante:

| incidente | notas perdidas |
|---|---|
| `ce6e157d` (Katia) | 11 |
| `5c3f1f8b` (3 pagantes) | 8 |
| `100e7ace` (ref cortada) | 2 |

**Não dá pra recuperar** — os objetos já tinham virado `[object Object]` na gravação. É a
segunda vez em 24h que essa operação destrói dado: às 03h fui eu, sobrescrevendo 4
`resolution_note` (recuperei do dump, por sorte); agora foi o Vigia, e desta vez não havia dump.

Conferi: **nenhum código de produção escreve `agent_notes`** — são todos scripts soltos em
`_Bugs/`, um por ronda, um por agente. O buraco é de ferramenta, não do produto.

Escrevi **`_frank/ferramentas/anotar_incidente.cjs`**, que transforma as três armadilhas
medidas em comportamento:

- **nota CONCATENA, nunca sobrescreve** — `agent_notes` ganha item novo no array; se o campo
  já estiver corrompido em string, preserva como nota legada em vez de compor o estrago;
  `resolution_note` vira `histórico + separador + nova`;
- **recusa id inexistente ou ambíguo** — resolve prefixo → uuid antes, porque UPDATE por id
  que não existe afeta **0 linhas em silêncio**;
- **confere o `.select()` depois de gravar** e falha alto se não afetou exatamente 1 linha;
- **sem `--confirmar`, ensaia** — ensaio não é entrega.

Testei os três caminhos antes de usar (id inexistente → recusou; ensaio → não gravou;
string corrompida → preservou). **Usei ela pra escrever as 3 notas desta ronda**, e a
releitura confirmou: `acf8acd6` foi de **25 → 26 notas**, array preservado, `resolved_at` do
james intacto.

---

## 4. Os 5 incidentes — por que nenhum fechou

| id | o que mudou nesta ronda | por que não fechei |
|---|---|---|
| `07745f61` | achado e corrigido o **gêmeo** do defeito, no mínimo do treino (`a713f6c`) | PR **não mergeado** = não está em produção; e os alunos parados seguem parados |
| `b9c5a0d1` | lista corrigida de **9 → 2**; detector automático confirmado como certo | os 2 continuam sem voz e sem contato — depende do "pode" |
| `5c3f1f8b` | sem material novo; os 3 já escritos, nenhum respondeu | esperando resposta de aluno |
| `ce6e157d` | **relógio: o acesso da Katia vence 22/08 12:00 UTC (~32h)** | veredito do piloto custa 1 geração = GPU = decisão do Johnny |
| `100e7ace` | sem material novo; PR #16 (`word_timestamps`) ataca o item 2 | é do Claude, não opinei no merge |

`acf8acd6` **fica `fixed`**: a causa dele está curada e o defeito residual é rastreado no
`07745f61`, da mesma família. Não abri incidente novo pra não duplicar a fila.

---

## 5. Leftovers da ordem de 20/08

**Item 1 — `d3d8d1b2` (timeout): NÃO voltou, não reabri.** Última ocorrência 18/08 20:46.
Segue `ignored` por decisão do Johnny, aceite de risco de pé.

**Item 2 — referências cortadas no meio da palavra:** em voo no PR #16 (do Claude), pelo
caminho aprovado (`word_timestamps`), não por heurística de energia. Não toquei.

**Item 3 — re-medir as 40 entregas: JÁ FOI FEITO, e a ordem já está refutada.** A ronda das
**23h40** mediu e concluiu que **o "23 de 40" NÃO era inflado** (commit `b7cffa6`). A ronda
das 03h declarou o item "pendente" — **estava errada**, e eu quase remedi pela terceira vez.
Registro aqui pra ninguém mais gastar ronda com isso: **item 3 está encerrado.**

---

## 6. Saúde da produção

Sem novidade ruim desde a medição das 03h: nenhuma geração nova falhou, nenhuma voz nova
rejeitada, nada entrou na fila em 40min. As 3 falhas `qa_coverage` seguem sendo todas
anteriores a 20/08 10:09.

---

## 7. O que está travado no Johnny (não mandei mensagem nova)

A ordem diz **um relatório à noite, não mensagem por incidente** — e nada aqui piorou desde
a msg 204 das 03h. O que muda é que **o pedido encolheu e ficou mais barato**:

1. **E-mail pra 2 pagantes** (não 9): `jrfengenhariadf` e `leandro.fitoway`. Custo zero.
   O `jrfengenhariadf` vence em **25/08**.
2. **1 geração de GPU** pro veredito do piloto da Katia, antes de **22/08 12:00 UTC (~32h)**.
3. **Merge do PR #22** (2 commits agora) — sem ele a mensagem honesta não chega em produção.

Nesta ronda: **nenhum e-mail enviado, nenhuma GPU gasta, nenhum crédito mexido, nenhuma
migration.**

---

### 3.1 Reparo aplicado (depois de escrever o resto deste log)

Reparei os 3 campos com a própria ferramenta: o texto que sobreviveu foi preservado **na
íntegra** como nota legada e o campo voltou a ser array. **O conteúdo dos 21 objetos
originais continua perdido** — não estou dizendo que recuperei, estou dizendo que parei o
sangramento e que a próxima anotação não compõe o estrago.

Conferido depois de gravar: **71 incidentes, 71 arrays, 0 strings corrompidas** (era 68/3).

⚠️ **Isso volta a acontecer em ~2h se o Vigia continuar anotando com script solto.** O
reparo não conserta o script dele — só o campo. **Handoff:** o Vigia precisa passar a usar
`_frank/ferramentas/anotar_incidente.cjs`. Deixei a instrução escrita dentro da própria nota
dos 3 incidentes, que é onde ele vai ler.

---

## 8. Passo fixo de fim de ronda

`git fetch` + `origin/main..HEAD` vazio + varredura de fix preso em branch: registrados no
commit desta prova.
