# Rotina das Falhas — ronda das 06h UTC de 21/08 (Frank, dono da fila)

Ordens lidas: `_frank/ordens/README.md` (índice) → `2026-08-20_dono_da_fila_e_fila_zerada.md`
(⭐ vigente) + `2026-08-20_fluxo_quem_olha_o_que.md` + `2026-08-20_canal_telegram.md`.

**Fila no início:** 6 abertos (todos `investigating`). **No fim:** 6. **Fechados: nenhum.**
**Zero incidente novo. Zero vítima nova em 24h.**

**O que esta ronda entrega:** um argumento meu da ronda das 05h **refutado e corrigido**,
a contagem da classe **desinflada de 26 para 21**, uma vítima que nenhuma lista tinha, e um
**prazo de 4 dias** num pagante que hoje ninguém estava contando.

---

## 1. Corrigi um argumento meu da ronda das 05h

Na ronda das 05h eu escrevi, sobre a `casatumca`:

> *"ela tentou 5× e perdeu 6 de 8 em todas. Isso **derruba** a explicação 'a aba fechou'."*

**O argumento está errado.** Não foram 5 tentativas. Foi **uma** seleção de arquivos,
reenviada 5× em 50 segundos. As 5 linhas são idênticas: mesmos 2 nomes de arquivo, mesmos
índices `006`/`007` de 8 slots, mesma duração 824s.

E as 5 linhas existirem **não é defeito aberto**: a trava de treino duplicado entrou em
**22/07** (`4848826`), no dia seguinte. Antes dela, clicar de novo criava linha nova. Já
resolvido — não reabri nada.

### A conclusão sobrevive, por um caminho melhor

Conferido **no R2, não só no banco**: os 5 prefixos têm exatamente os mesmos 2 objetos, com
os **mesmos tamanhos** (6692KB e 6385KB), nos mesmos índices, nas 5 execuções.

Cinco execuções de upload em 50 segundos, o mesmo par subindo e os mesmos 6 falhando,
**resultado idêntico byte a byte**. Aba fechada ou perda aleatória de rede não produz
resultado idêntico 5× em 50s. É falha **determinística**, do lado do cliente.

Ou seja: a frase da ronda das 05h estava certa no destino e errada no percurso. Registro a
correção porque **um raciocínio errado que dá a resposta certa volta depois dando a errada**.

**O que isso ainda NÃO prova, e digo:** continua sem log do cliente, então segue sem saber
*por que* aqueles 6 falham. Descartei tamanho como causa — no mesmo dia ela subiu 9 arquivos
de 9–15MB e 8 de 10–19MB, todos completos. Não cravo causa sem o dado; foi exatamente assim
que dois agentes cravaram o endereço errado neste mesmo incidente.

## 2. A numeração é confiável — testei a hipótese que a derrubaria

Antes de seguir usando "buraco na numeração" como impressão digital, levantei a hipótese que
**anularia toda a medição**: e se o índice fosse cumulativo da sessão da página? Aí todo
buraco seria falso positivo e a classe inteira evaporava.

**Refutada no código, não suposto:** `createUploadSlots()` (`lib/r2/presigned.ts:139`) numera
`i = 0..n-1` sobre `body.files`, e cada submissão cria uma `voice` nova. O índice é por
submissão e **sempre começa em 000**. A impressão digital vale.

## 3. A contagem estava inflada: 26 vozes → **21 eventos**

Dedupliquei por `user + conjunto exato de nomes de arquivo`. Dois grupos são a mesma
submissão gravada em várias linhas — `natali.marcio` (2 linhas em 27s, 19/07) e `casatumca`
(5 linhas em 50s, 21/07). **Ambos anteriores à trava de 22/07.**

| | ronda 04h/05h | agora |
|---|---|---|
| vozes com buraco | 26 | 26 |
| **eventos reais** | (não medido) | **21** |

O "26" não estava errado como contagem de linhas — estava errado como contagem de **fatos**.

## 4. Vítima que nenhuma lista tinha: `luisa13ra@icloud.com`

3 de 5 arquivos, 14/08, única voz, `failed`, sem voz pronta.

**Não é pagante** (`compras: NENHUMA`; os 10.000 de crédito são estorno do próprio treino) —
e é por isso que ela nunca apareceu: **todo detector da classe filtra por pagante**. Não é
emergência, e não trato como se fosse. Registro para a classe ficar completa.

## 5. 🔴 O achado da ronda: `jrfengenhariadf` está a 4 dias de virar a `casatumca`

Não é analogia. É a mesma trajetória com 4 dias de diferença:

| | pagou | voz pronta | acesso |
|---|---|---|---|
| `casatumca` (Kharen) | 21/07 | nunca | **venceu** → hoje invisível, 140k parados, nunca contatada |
| `jrfengenhariadf` (Joab) | 25/07 | nunca | **vence 25/08 — 4 dias** |

O mecanismo que apagou a Kharen está documentado na ronda das 05h: todo detector de
"pagante travado" filtra por **acesso vivo**, então no instante em que o acesso vence a
pessoa sai das listas. **Quem esperou mais é exatamente quem some primeiro.**

**O que isto NÃO é:** não é pedido de destrave, não mexi em acesso, e não reabro as
trancadas (ENCERRADAS por ordem de 20/08). É **prazo** de uma decisão que **já está com o
Johnny** desde a ronda das 05h — o texto do e-mail dos 2 pagantes. O que mudou é que esse
pedido agora tem data de validade.

**Uma ressalva honesta, contra o meu próprio alarme:** o Joab não vai literalmente sumir —
o e-mail dele continua funcionando, e eu acabei de fixá-lo no `b9c5a0d1` com a data. O que
vence é a janela dos **detectores**, não o contato. Por isso isto é item de relatório, e não
motivo para acordar ninguém.

## 6. Por que NÃO mandei mensagem agora

A ordem manda avisar **na hora** quando há pagante travado sem solução, e manda **acumular**
o resto para um relatório único. Os dois se aplicam aqui, então decidi explicitamente:

- O gatilho do "na hora" **já foi honrado na ronda das 05h** — Johnny já sabe dos 2 pagantes.
- O que tenho hoje não muda **o que** ele deve fazer, só **até quando**. E são 4 dias.
- A ronda das 05h mandou uma linha porque o pedido ia causar **dano** se executado como
  estava (o e-mail mandava regravar quem não gravou pouco). Não é o caso agora.
- Ping a cada ronda mata o sinal que a regra existe para proteger.

**Se o prazo estivesse abaixo de 24h eu teria mandado.** Fica como item de abertura do
relatório da noite.

## 7. `ja_pagou`: **não é achado novo**, e digo que não é

Medi `profiles.ja_pagou`: **false em 1.339 de 1.339**, `ja_pagou_em`/`origem` nulos em 100%.
Nenhum código de produção lê a coluna (grep no repo inteiro: só docs e o próprio SQL).

**Isto já estava documentado em 18/08, no relatório noturno de 19/08 e na ronda das 00h de
20/08**, com a mesma conclusão ("inerte hoje, perigoso no dia em que alguém escrever a regra
antes do backfill"). Não vou vender como descoberta.

O que é meu nesta ronda são duas coisas pequenas:

1. **O buraco cresce sozinho:** 1.244 (19/08) → 1.293 (20/08) → **1.339 (hoje)**, todos
   `false`. O backfill que a mig 79 prometeu "em commit separado" segue sem existir.
2. **Deixou de ser risco futuro e me pegou:** meu próprio censo de pagantes nesta ronda
   devolveu **"0 pagantes sem voz pronta"** — resposta que eu sabia ser falsa, porque tinha
   acabado de ver 3 na tela. A coluna responde *"ninguém nunca pagou"* em silêncio.

→ **Vai para as armadilhas** (seção 9). Nada executado: rodar backfill é escrita em 1.339
linhas de status de pagamento, precisa de aval.

## 8. Os 6 incidentes — por que nenhum fechou

Pergunta 1 da rotina (*"já resolveu sozinho?"*) conferida **ao vivo** em todos.

| id | já resolveu? | o que mudou nesta ronda | por que não fechei |
|---|---|---|---|
| `2c5bab42` | não | contagem 26→21; argumento das 05h corrigido; numeração validada no código; +`luisa13ra` | **PR #22 sem merge = não está em produção** |
| `b9c5a0d1` | não | **prazo de 4 dias** no `jrfengenhariadf` (acesso vence 25/08) | os 2 seguem sem voz e sem contato |
| `5c3f1f8b` | não | ivanilde 2 vozes/0 ready (12,5d), csitya 1/0 (5,5d); ninguém respondeu; 0 estornos | esperando resposta / decisão |
| `ce6e157d` | não | **relógio: 30,3h**; última geração da Katia há 32,6h, **anterior à cura** | veredito custa 1 geração = GPU = Johnny |
| `100e7ace` | n/a | 4ª ronda sem material; ref agora **termina com pontuação** → premissa segue refutada | é do Claude; PR #16 ataca a classe |
| `07745f61` | não | objeção do Vigia **segue de pé** e não é respondida pelo PR #22 | mesmo motivo: PR sem merge |

**Regra 14 respeitada: nada marcado `fixed` sem estar resolvido.** Card "completed" não é
produção — só a main deploya.

## 9. Armadilhas — uma nova, medida hoje

Somando às de 20/08 (estorno por `ref_type` nunca por `kind`; débito órfão é normal; listar
os ARQUIVOS antes de olhar worker/ffmpeg; paginar e imprimir `error` cru):

- 🆕 **`profiles.ja_pagou` é `false` em 100% da base e responde "ninguém pagou" em silêncio.**
  Não use em detector nem em censo. Pagante de verdade se confere por `access_until` +
  compra, como o `aluno.cjs` faz. Me custou um "0 pagantes travados" falso nesta ronda.
- 🆕 **Coluna inexistente no `.select()` do Supabase derruba a query inteira e volta vazia.**
  Pedi `char_count` (que não existe) junto das gerações da Katia e recebi "nenhuma geração" —
  ia virar "ela não gerou nada desde sempre". Com o `error` cru impresso: 10 gerações.
  É a armadilha de 20/08 (*"imprima o `error` cru antes de acreditar em qualquer zero"*)
  aparecendo numa forma nova: **o zero veio de coluna errada, não de filtro errado.**
- 🆕 **Linha duplicada infla contagem de incidente.** Antes de 22/07 um clique repetido criava
  `voice` nova. Conte **eventos** (user + conjunto de arquivos), não linhas.

## 10. Saúde da produção

Últimas 6h: **11 gerações, 11 `ready`. 3 vozes, 3 `ready`. Zero falhas.**
**0 vozes em estado intermediário agora** (nenhuma presa em `uploading`/`validating`/`training`).

## 11. Zumbis e integridade

- **1 zumbi, o mesmo de sempre:** `acf8acd6`, `last_seen` há **77,3h**, nada nas últimas 48h.
  Segue `fixed`, sem ação. Nenhum zumbi vivo. `fechados_sem_resolved_at = 0`.
- **`d3d8d1b2` (timeout) NÃO voltou:** `last_seen` há 56,9h, **anterior** ao fechamento de
  26,1h atrás. Segue `ignored` por decisão do Johnny. Não reabri — e se voltar, o combinado é
  instrumentar o handler para logar em qual fase o chunk pendura.
- **`agent_notes`: 72 incidentes, 72 arrays, 0 strings corrompidas.** O reparo segurou. Todas
  as 6 anotações desta ronda foram feitas com `anotar_incidente.cjs`, nenhuma com script solto.

## 12. O que está travado no Johnny (para o relatório da noite)

1. 🔴 **Texto do e-mail dos 2 pagantes** — e agora **com prazo**: `jrfengenhariadf` perde
   acesso em **25/08**. O texto aprovado-pendente ainda manda "regrave até somar 25min", e
   eles não gravaram pouco (4 de 7 e 6 de 14 arquivos não chegaram).
2. **1 geração de GPU** para o veredito do piloto da Katia, antes de **22/08 12:00 UTC (30,3h)**.
3. **Merge do PR #22** (3 commits) — sem ele, nenhuma mensagem honesta chega em produção, e
   dois incidentes ficam abertos só por isso.
4. *(sem pedido)* `casatumca` — pagante confirmada, sem acesso, 9 vozes mortas. Fato registrado.
5. *(sem pedido)* Backfill do `ja_pagou` segue inexistente, agora com 1.339 linhas.

**Nesta ronda: nenhum e-mail enviado, nenhuma GPU gasta, nenhum crédito mexido, nenhum acesso
alterado, nenhuma migration, nenhuma mensagem no grupo.**

## 13. Passo fixo de fim de ronda

`git fetch` + `origin/main..HEAD` vazio + conferência de fix preso em branch: registrados no
commit desta prova.
