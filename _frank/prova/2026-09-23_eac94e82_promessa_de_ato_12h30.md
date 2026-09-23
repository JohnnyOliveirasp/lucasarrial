# Incidente eac94e82 — promessa de ato não praticado — 23/09 12h30Z

Recado do Vigia pediu três ações. **Duas das três premissas estavam erradas**, e
foi a medição que mostrou isso. Registro o que mediu o quê, porque o valor desta
passagem está aí, não no conserto.

(Não confundir com `2026-09-23_rotina_falhas_12h.md`, que é a ronda anterior.)

---

## Ação 3 (a que ninguém tinha medido) — o defeito NÃO é sistêmico

O recado supunha uma fila de alunos calados: *"se houver, cada um desses alunos
está calado esperando agora — é o tipo de dano que não reclama"*. Fui medir.

Instrumento novo: `_frank/ferramentas/2026-09-23_promessa_de_ato_nas_cartas.cjs`.
Varre a pasta remota `Sent` (EXAMINE + BODY.PEEK, tripwire contra verbo de
escrita) atrás de frases em que a casa afirma um ato **já consumado**.
Deliberadamente NÃO procura promessa de futuro ("vou rodar"): promessa de futuro
não engana ninguém sobre o estado atual — o que prende o aluno calado é
acreditar que a coisa JÁ está acontecendo.

**CONTROLE POSITIVO EMBUTIDO, e é o que faz o número valer:** a carta do Diego
(22/09, "coloquei pra rodar") é conhecida e TEM que aparecer; se não aparecer o
script sai com código 2 gritando "INSTRUMENTO CEGO" em vez de imprimir um zero.
Existe por causa da lição de 18/09: a primeira versão do `dump_enviada` só
desfazia quoted-printable, as cartas da casa saem em **base64**, e ela devolveu
"0 cartas com link" em 2819 varridas — zero falso que por acaso CONCORDAVA com a
hipótese de quem media.

Resultado: **3.254 cartas desde 01/08 · 21 candidatas · controle ✓ (uid 3245)**.

Das 21, só 7 afirmam ato **na conta do aluno** (o resto é conserto de produto:
verificável, mas ninguém fica esperando). Conferidas uma a uma no banco:

| aluno | prometeu | banco | veredito |
|---|---|---|---|
| neilamagalhaes79 | devolver 10.525 | `+10525` 12:51:06, carta 12:51 | ✓ |
| tonimekautocenter | devolver 1.320 | `+1320 ref_type=image_video_refund` 16:46:55, carta 16:47:43 | ✓ |
| godoyalessandroadv | ajustar a voz | voz `updated_at` 15:48:23, carta 15:51 | ✓ agiu 3 min ANTES de escrever |
| joaosoareskco | treino rodando | 1 `training_job` na janela | ✓ |
| cdmarciofernandes | creditar o mês | `+100000` | ✓ |
| ftfranzolin | creditar o mês | `+100000` | ✓ |
| **diegoavnunes** | **"já coloquei pra rodar"** | **0 geração depois da carta** | **✗** |

**1 falsa em 7. Não há fila de alunos calados.** A prática normal da casa é
agir-e-depois-escrever — o godoyalessandro é a prova: ato às 15:48, carta às
15:51. O recado acertou em mandar medir e errou na suposição.

Repare no tonimek: o estorno dele tem `kind='extra_purchase'`. Quem conferisse
por `kind` concluiria que esse aluno nunca foi estornado. É a armadilha da ordem
de 20/08, viva e passando na frente.

### Erro meu no caminho, medido e corrigido

A primeira consulta usou janela `carta -2h … +6h` e devolveu para o Diego
`geracao_na_janela: 3` — ou seja, **o instrumento disse que a promessa dele foi
cumprida**, quando eu sabia de fato que não foi. A janela contava o que o aluno
fizera sozinho ANTES da promessa como se fosse a casa cumprindo. Refiz com
fronteira estrita (depois da carta) e o Diego foi a 0, batendo com a verdade
conhecida. Régua que fica: janela que começa antes do fato mede o passado, não a
promessa — e instrumento que confirma o que você já sabe ser falso está
quebrado, mesmo quando o resto da tabela parece plausível.

---

## Ação 2 — já estava feita ANTES do recado existir

O recado diz *"ninguém escreveu pro Diego explicando"*. Falso: carta uid **3254**
saiu às **11:54:48Z**, 24 minutos ANTES de o recado ser gravado (12:18Z). Li a
carta inteira: pede desculpa pela promessa falsa, conta que rodou duas vezes hoje
e que o QA barrou as duas, e lista item por item o que sumiu do áudio de ontem —
inclusive o fecho "minha maneira de me comunicar", que bate **exatamente** com o
`faltantes_amostra` do `qa` no banco. Carta honesta e correta; nada a refazer.

Mas ela deixou uma promessa em aberto: *"os créditos do áudio que saiu com
defeito continuam debitados (…) eu te retorno sobre isso"*. Deixar isso aberto
transformaria a carta em mais uma promessa não cumprida — o defeito exato deste
incidente. Foi o que fechei.

---

## O achado que não estava em recado nenhum: o QA entregou áudio reprovado

`qa` da geração `1c761a52` (22/09 21:47Z, status **ready**, entregue, cobrada -1.944):

```
coverage_min ...... 0.85      <- o piso que a própria casa define
coverage_medio .... 0.8376    <- ABAIXO do piso
faltantes_total ... 18
faltantes_amostra . ["minha","maneira","de","me","comunicar"]
```

O sistema mediu o defeito, registrou 18 palavras faltando, e **marcou como
pronto assim mesmo**. A passagem anterior concluiu "0 de 4, o texto não gera"; o
quadro real é pior e mais útil: o mesmo texto **passa** (essa passou, com
`regens: 41`), só que raspando — e quando passa, passa entregando defeito. Não é
"impossível gerar", é **portão de qualidade inconsistente**.

**Estorno feito:** `2026-09-23_estornar_audio_entregue_com_defeito.cjs`, RPC
`add_extra_credits`, `ref_type='generation_refund'` casado com o `ref_id` da
geração. Conferido NO BANCO depois de gravar: `+1944`, saldo 76.536 → 78.480,
delta bate. O script exige `faltantes_total > 0` no qa antes de devolver — para
não virar régua de estornar áudio bom — e pareia por `ref_id`, nunca por valor
nem por `kind`: os dois débitos do Diego têm o MESMO valor (-1944), e conferir
por `kind` acharia o estorno do irmão e concluiria, errado, que já foi devolvido.

Decisão de devolver é minha (1.944 « 20.000, fora da lista curta do Johnny),
amparada na regra #960: estorna quando o sistema não entregou o que promete.

**Carta ao aluno:** uid **3255**, com o resultado na mão e sem prazo inventado.
Sem bounce (varredura conferida). Diz o que continua em aberto (a causa) e diz
explicitamente que não vai dar prazo, porque foi o prazo inventado de ontem que
o deixou esperando 13h.

---

## Ação 1 — patch da regra 9, no ar

PR **#413**, merge `db310741`, deploy SUCCESS.
Regra dura 9 em `buildAgentSystem` — o texto que o modelo obedece em TODOS os
canais (e-mail, chat, grupo, winback), em vez de ficar arquivada sob `## Créditos`
como a guarda antiga de estorno, que por isso nunca alcançaria este caso.

Verificação **refeita por mim**, não herdada do relatório de quem montou o patch:
tsc 0, eslint 0, `manual.test.ts` 18/18, e **prova de mutação** (removi a regra 9
do fonte → 1 teste cai; restaurei → 18/18).

Aqui também errei e corrigi: a primeira rodada de `tsc` caiu no `npx` sem
typescript na worktree e eu li `exit=0` — que era do `tail`, não do compilador.
Repeti apontando o `node_modules` certo e capturando o código de saída real.
**Segunda vez hoje que `$?` depois de um pipe quase virou prova falsa**; vai como
régua: exit code depois de `|` é do último comando do pipe, não do que interessa.

Prova em produção: md5 de `manual.ts` local == servidor, regra 9 presente no
bundle compilado (`.next/server/chunks/9038.js`), processo no ar desde 12:36:07Z.

---

## Fica aberto (não escondo)

- **A causa do Diego continua viva**: `coverage_alucinado` no texto com listas
  longas de palavras soltas. Não consertada. O aluno sabe disso por escrito.
- **O portão de qualidade que entrega áudio reprovado** é defeito próprio, maior
  que este incidente e ainda sem cartão de conserto.
- Os outros 14 candidatos da varredura (conserto de produto afirmado) não foram
  conferidos um a um — ali o dano não é aluno calado esperando, mas "já
  corrigimos" que não subiu também é mentira. Não medido, então não afirmo.
