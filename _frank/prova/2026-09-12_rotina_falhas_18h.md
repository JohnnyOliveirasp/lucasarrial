# Ronda das falhas — 12/09/2026 ~17h40–18h20Z (14h40 BRT)

Canal: ordem de **31/08** — tudo de FastCloner vai pro **grupo**, e só pro grupo
(`notify-grupo.sh`). Este arquivo é o log técnico da ronda, não mensagem pro Johnny.

Repo em `main`, `pull --ff-only` limpo. Li `_frank/ordens/README.md`, a ordem de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha desligada).
**Nada da planilha foi lido, escrito, classificado ou reprocessado.**

Fila na entrada: **79 abertos** (3 com 30d+, 3 na faixa 15–30d, 14 na 7–15d, 31 na
3–7d, 28 com menos de 3d). 4 patches do Vigia em `agent_state` seguem sem tratar.

---

## 1. Item serial: `#226` (`702cc916`) — a parte AUTORIZADA está em produção

Continuação direta da ronda das 17hZ, que abriu o cartão `487deab7` pro `coder`.
Regra 8 (serial): peguei o que já estava no meu colo e levei até onde ele podia ir.

**Revisei eu mesmo antes de mergear** — a entrega era do `coder`, a qualidade é
minha. Worktree próprio em `146f271`:

- `node --test qa-veredito.test.ts` → **23/23 pass**, rodado por mim.
- **Mutação minha:** neutralizando a trava `chunks <= 0` caem **4 dos 23**. Os
  testes de controle (`qa` nulo, `{}`, sem a chave, `exhausted = 0`) são reais,
  não decorativos. Era a trava que eu **exigi** no cartão: ressalva **falsa**
  faria a Fast acusar defeito onde não houve — regressão pior que o silêncio.
- `npx tsc --noEmit` → **só** o erro pré-existente da main (`resgate-audio.test.ts`,
  vitest). Zero novo.
- Rodei o `qa_esgotado.cjs` contra **produção** (read-only): **583 gerações com
  ressalva em 30 dias**, linha saindo no formato certo (`ycarlosk@gmail.com`,
  11/09 11:05, geração `0e268739`, `status ready`, 1 trecho esgotado, cobertura
  95,7%).

**Merge `999aeb4` 17:42Z (PR #253). Deploy `Deploy Frontend (production)` run
`34709021034` CONCLUÍDO `success`, sha `999aeb4`** — conferido por *run concluído*,
nunca por PR verde nem por cartão "completed".

O conserto: `lib/generations/qa-veredito.ts` lê o jsonb `generations.qa` e devolve
linha **só** quando `exhausted > 0`; `account.ts:208` passou a pedir a coluna e
pendura a ressalva na geração, mais um aviso único no fim da lista. Antes disso a
string `exhausted` aparecia **zero** vezes em `frontend/src`: o dado estava no
banco e ninguém lia.

**Fraseado conferido por mim no código:** a linha diz o **fato do worker**
("esgotou as tentativas de refazer N trecho(s) e o áudio foi entregue assim
mesmo"). Não diz "áudio ruim" e não diz "áudio conferido". O aviso que acompanha
explicita que **ausência de ressalva não é prova de áudio fiel** — cobertura é
cega a **substituição** (geração `1425ca2f`: "faz falar" onde o texto dizia "fácil
falar", com `coverage_min_visto = 1`).

### 1-B. Por que o `#226` continua `investigating` (regra 14)

Isto corrige a **cegueira do atendimento**, não o defeito. O worker segue
entregando chunk reprovado (`tts_qa/loop.py:341-344`). A decisão de produto —
falhar sem cobrar × entregar avisando × manter — é do Johnny e **não foi tomada no
lugar dele**. Crédito intocado: 290 ocorrências passam fácil de 20k créditos.

### 1-C. O que NÃO está coberto (escrito pra não inflar a entrega)

O `.cjs` de `_frank/` **não tem teste nem lint** — o eslint recusa (`outside of
base path`, a config vive em `frontend/`). A prova dele é a **execução contra
produção** acima, não uma suíte. Vale pra pasta inteira, não é regressão do PR.

---

## 2. Segundo item: `#234` (`f8587cef`) — o cartão fechou, o achado virou nota, e a
medição deu NEGATIVO

O `#226` saiu do meu colo (o resto é decisão do Johnny), então corri a fila por
idade. Os mais velhos seguem bloqueados pelo mesmo motivo da ronda anterior
(`#312` vence 15/09; `#313` é decisão comercial; `#15` fecha com 30 dias limpos;
Katia é ouvido humano; Luciano espera frase do Johnny e a data dele é 19/09; Alana
está com a bola). Sobrou o **`#234`** (10,1d, **609 ocorrências, 237 alunos, 272
vozes**) — de longe o que tem mais gente sofrendo, e **destravado**: o cartão
`77354ee2` fechou às 12:57.

**Primeiro achado, do cartão, trazido pra dentro do incidente.** Achado que só vive
em cartão do Mission Board ninguém lê na ronda seguinte — e este não estava no
`#234` (últimas notas eram de 10/09).

`train_reference.py:170-181` (`_cobertura_do_previsto`): denominador é só o
previsto e `rl` é um `set`, então a checagem é **contenção unidirecional**
(`previsto ⊆ real`). O `real` pode **ganhar** palavras sem limite e a cobertura
fica 1,0 — e em `:244` essa cobertura é o **único** critério de rejeição. Única
defesa é `_podar_cauda_fantasma` (`:184-198`): lista **fechada** de 11 frases
(`:149-161`), no máximo **8 tokens finais** (`:193`), **igualdade exata** (`:196`).
Rodando as funções reais: +5 palavras inventadas → 1,000, não rejeitado; +12 →
1,000, não rejeitado; + "Obrigado por assistir e até a próxima" (fantasma conhecido
**fora** da posição final exata) → não podou, 1,000, não rejeitado. Importa porque
o VoxCPM **continua** o texto da referência (`:131-133`): cauda inventada vira
artefato no começo de toda geração daquela voz.

**Segundo achado, MINHA medição em produção — e ela deu negativo.**
`_frank/rascunhos/2026-09-12_cauda_fantasma_producao.cjs`, read-only, paginado (sem
teto de 1000): varri as **1.170 vozes** com `reference_transcript` não-nulo atrás
das 11 frases-fantasma **fora** da posição final exata. Bruto: 19 com alguma frase,
16 fora do fim. **Conferi os 16 um a um e os 16 são falso positivo da minha própria
consulta** — caudas de UMA palavra (`musica`, `risos`) casando com uso legítimo no
meio da frase: *"duas versões da mesma musica"*, *"devolver sorrisos"*, *"pus uma
musica boa tocando"*. Casos reais de fantasma conhecido escapando da poda: **zero**.

**Por que NÃO abri incidente novo:** ordem de 27/08 — só erro de **sistema** vira
chamado. Tenho o `arquivo:linha`, mas **não tenho uma ocorrência em produção**.
Abrir seria virar chamado sem vítima e inflar a fila.

**E a limitação, registrada porque o contrário também não vale:** minha consulta só
acha as 11 frases que a gente **já conhece**. A cegueira do item anterior é pra
palavra **arbitrária** inventada, que eu não tenho como procurar porque não sei o
que procurar. **Ausência de achado aqui não é prova de ausência do defeito.**
Detectar de verdade exigiria 2ª transcrição do áudio da referência — whisper por
voz, custo real.

**Engano meu, corrigido antes de virar nota errada:** li "assinatura `corte_seco:
true`" no cartão e achei que era detector de graça no banco. Não é — é medida
**derivada** no script de rascunho (`folga < FOLGA_MIN_S`), não um flag que o
worker grava. Fica escrito pra ninguém repetir.

A automação da detecção continua travada onde sempre esteve: exige **timestamp de
palavra**, e heurística por energia foi reprovada 2x — **não subir**.

---

## 3. Recado velho conferido: `para_frank_17887155` estava obsoleto

Passo 1 da rotina ("já resolveu sozinho?") antes de qualquer coisa. O recado de
06/09 pedia pra fechar `#287`/`#253` (`acalbamonte@gmail.com`). **Os dois já estão
`fixed` desde 06/09 17:31**, com nota minha e a ressalva de que o `fixed` vale pro
caso dele e não pra classe. Nada a fazer — **conferido no banco, não presumido**.

---

## 4. O que eu fiz, em uma lista

1. Revisei, rodei testes + mutação e **mergeei o PR #253**; confirmei o deploy por
   run concluído (`success`, sha `999aeb4`).
2. Nota 50 no `#226` com o que subiu, a prova que rodei e o critério de por que não
   fecha. 1 linha afetada, conferida na releitura.
3. Nota 34 no `#234` com a cegueira do portão (`arquivo:linha`) **e** minha medição
   negativa em produção, com a limitação escrita.
4. Conferi no banco o recado `para_frank_17887155` (obsoleto).
5. Grupo avisado — fato consumado: fix em produção + PR + por que o `#226` não
   fechou.

## 5. O que eu NÃO fiz, e por quê

- **Não fechei nenhum incidente.** Nenhum dos dois que peguei atingiu o critério
  de fechamento escrito neles. Regra 14 inteira: a fila não baixou porque os casos
  são difíceis, não porque eu deixei de olhar.
- **Não abri incidente** pra cegueira do portão de cura: sem ocorrência medida em
  produção, seria chamado sem vítima (ordem de 27/08).
- **Não escrevi pra aluno nesta ronda.** Nenhum caso individual novo nos dois itens.
- **Não repeti o aviso do Rodrigo no grupo.** É decisão do Johnny, está na coluna
  do Vigia e já foi postada 4 rondas seguidas; a 5ª cópia seria exatamente o ruído
  que a regra 7 proíbe. A janela dele fecha hoje 21h BRT.
- Não mexi em crédito, GPU, migration, acesso nem voz. **Nada da planilha.**
- Não commitei a árvore de trabalho do SGP (frente de outra pessoa).

## 6. Dívida que segue registrada e não tratada aqui

- 4 patches do Vigia sem tratar em `agent_state`: `7578c587`, `81438b60`,
  `3dbd2bf0`, `12d4db57`.
- `6c38c99d` (Luciano): próxima cobrança de R$ 97 em **19/09** (7 dias); a decisão
  pedida em 24/08 tem **19 dias**.
- `#226`: decisão de produto do Johnny (falhar sem cobrar × avisar × manter) segue
  pendente — o que subiu hoje só faz a Fast **enxergar**.
- `#234`: automação da detecção travada em timestamp de palavra.
- Resíduo do gate do `#52` (ronda 17hZ, seção 1-B): janela curta do submit,
  conhecida e não coberta.
