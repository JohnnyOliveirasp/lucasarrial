# Ronda das falhas — 17/09/2026, ~14hZ (11h BRT)

Dono da fila (14-A). Esta ronda foi **revisão de patch do Vigia** (regra 14-B,
que manda fazer isso antes do resto). Resultado: o patch subiu pra **produção**
(deploy SUCCESS), mas **com um conserto meu em cima**, porque a guarda que ele
criou sumia exatamente na hora em que precisava existir.

Ordens lidas antes de tocar em qualquer coisa: `_frank/ordens/README.md`, a de
**29/08** (planilha desligada) e a de **31/08** (canal). **Nada da planilha foi
lido, escrito, classificado ou reprocessado.** Aviso no **grupo**, com
`notify-grupo.sh`.

---

## 1. O que eu peguei, e por quê não foi o mais velho da fila

A fila tem **85 abertos**. A regra 8 manda o mais velho **com aluno afetado**, e
os de cima seguem travados em decisão que não é minha — conferido na ronda das
13hZ de hoje, não herdado de semanas atrás (`#15`, `#99`, `#226`, `#234`,
`#249`/`#250`, `#254`, `#263`).

Mas a §1-B é explícita: **patch do Vigia se trata ANTES do resto**. Ele não
consegue subir código; se ninguém lê, o trabalho dele morre igual. Havia
**1 patch** esperando: `patch_75c33ee1`, do `#439` — *"Animar Imagem apaga o
vídeo que o aluno já pagou"*, cartão que eu mesmo abri às 00h50Z de hoje.

Então o item desta ronda foi esse, e ele não é desvio de prioridade: o `#439` é
dano a aluno pagante **acontecendo agora**, como a medição da seção 4 mostra.

---

## 2. Antes de revisar, quase criei um branch duplicado

O `git worktree list` mostrou `feat/animar-imagem-aviso-honesto`. Meu primeiro
reflexo foi tratar como **branch concorrente** — a armadilha que já mordeu a
casa três vezes (`feat/fix-image-upload-retry`, `feat/onedrive-401`,
`fix/referencia-fronteira-de-frase-por-palavra`).

Fui conferir antes de agir, e era outra coisa: **o patch já tinha sido
aplicado**. Branch no origin (tip `88c3feb`, autor `vigia`, committer `Frank`) e
**PR #326 aberto**. Mesma mensagem, mesmos 4 arquivos, mesmo `57 insertions(+),
7 deletions(-)`.

O que sobrou errado foi o passo 6 da §1-B: **a chave não foi apagada do
`agent_state` depois de aplicada**. Por isso ela reapareceu hoje como "patch
esperando revisão" e esta ronda re-investigou do zero um patch já aplicado.
Apagada agora com `DELETE`, e conferido na releitura (`ainda_la = 0`) — porque
`agent_state.value` é NOT NULL e `set_state` com null volta `23502` deixando a
chave no lugar, que foi o que fez três rondas "limparem" sem limpar.

Se eu tivesse criado `vigia/75c33ee1` e mergeado, teria virado o **quarto**
branch concorrente da casa — e desta vez por cima de um PR meu, aberto.

---

## 3. O defeito que achei na revisão

O patch acerta o diagnóstico e acerta, principalmente, **no que recusou fazer**:
o Vigia se negou a versionar a key do R2 agora, e a razão dele é medida, não
palpite — `chavesApagaveisDoHistorico` (`refs-pure.ts:43-57`) monta o DELETE do
histórico **pelas colunas da row, nunca por prefixo**. Key versionada sem coluna
de histórico trocaria destruição silenciosa por **retenção silenciosa**: vídeo
que o aluno mandou apagar ficaria no R2 pra sempre, sem rastro. Recusa correta.

O problema estava na guarda. `image-animate.tsx:57`:

```
const temVideoPronto = status === "ready" && !!videoUrl;
```

`videoUrl` é uma **URL presignada gerada na hora**, e ela vira `null` em
silêncio quando o presign falha — catch nu nos dois lugares:

```
api/v1/images/route.ts:74-81       catch { video_url = null }
api/v1/images/[id]/route.ts:73-80  catch { video_url = null }
```

Os dois dentro de `if (video_status === "ready" && video_path)`. Ou seja: o
vídeo **está lá**, o `video_path` **está lá**, e mesmo assim a URL volta nula.

Quando essa porta abre, **as duas pernas do patch evaporam juntas**:

| | o que acontece |
|---|---|
| perna (a) | o bloco "Resultado pronto" (`status === "ready" && videoUrl`) não renderiza → sem player, sem Baixar, **sem o retryHint novo** |
| perna (b) | `temVideoPronto` fica false → **a confirmação não aparece** |
| mas | o botão **continua** rotulado "Gerar de novo", porque o rótulo decide por **outro critério** (`status === "ready" \|\| status === "failed"`) |
| resultado | despacha no **primeiro** clique, sobrescreve o `video_path`, e o vídeo pago morre sem uma palavra |

**A assimetria é o defeito: o rótulo decide por `status`, a guarda decide por
`status && videoUrl`.**

E o que torna isso grave não é a probabilidade, é a **correlação**: o modo de
falha da guarda é o mesmo evento que produz o comportamento que ela existe pra
impedir. É exatamente quando o vídeo não carrega que o aluno pensa *"não veio,
vou gerar de novo"*. **A proteção some no único momento em que seria usada.**

População exposta, medida no banco vivo: `image_generations` tem **1690** linhas
`ready`, **todas** com `video_path` (`ready_sem_path = 0`), de **603** alunos.
A única porta pro `video_url` ser nulo é aquele catch, e ela vale pros 1690.

---

## 4. O tamanho do estrago, e por que ele foi medível

A row não guarda histórico — o UPDATE sobrescreve `video_path`,
`video_kie_task_id` e `video_credits_cost` **na mesma linha**. Mas o débito grava
`refType='image_video'` com `refId` = **id da imagem**
(`images/[id]/video/route.ts:161-172`), e o `credit_transactions` guarda **uma
linha por despacho**. O razão de créditos é a testemunha que sobrou.

Controles que rodei **antes** de acreditar no número:

- `ref_type='image_video'` tem **um único** escritor de débito. O estorno usa
  ref_type próprio, `image_video_refund` (`video-sync.ts:128-129`) — débito e
  estorno não se confundem na contagem. *(Essa é a armadilha do estorno de
  agosto, ao contrário: lá filtrar por `kind` escondeu estorno; aqui checar o
  `ref_type` certo foi o que impediu de contar estorno como perda.)*
- A aritmética fecha sozinha: **2303** débitos − **1853** imagens distintas =
  **450** despachos não-finais. Bate com a contagem por janela (`rn > 1` = 450).
- Os **86** estornos `image_video_refund` do banco inteiro caem **todos** dentro
  deste grupo (86 de 86) — nenhum ficou de fora da conta.

```
BRUTO:    450 despachos pagos sobrescritos · 1.121.620 créditos · 194 alunos
          de 11/07/2026 até 17/09/2026  <- a data final é HOJE
LÍQUIDO
DE ESTORNO: 402 despachos · 283 imagens · 183 alunos
```

**O que esse número não é.** É um **teto**, não o número exato. Despacho que
falhou e não foi estornado entra aqui como perda sem ter havido vídeo pra
destruir — e eu **não consigo separar**, porque a row foi sobrescrita e o
desfecho de cada despacho anterior foi apagado junto. **O defeito destrói a
própria prova.**

Procurei fonte local pra reconstruir despacho a despacho: **não existe**. Não há
tabela de log de tarefa/webhook do Kie no schema (só `payment_events`), e o
`video_kie_task_id` de cada despacho anterior também foi sobrescrito — então nem
pela API do provedor dá pra reconsultar, porque os ids se foram.

E também **não é** "número de aluno revoltado". Reanimar é ação que o aluno
escolheu. O defeito não é ele ter reanimado; é ter escolhido **sem ser informado**
de que o vídeo que pagou sumiria sem recuperação.

---

## 5. O conserto, e as verificações que são minhas

Card `ed80301d` no Mission Board → `coder` → commit **em cima** do `88c3feb`, na
**mesma** branch, atualizando o PR #326 (nada de branch nova — e o worktree
dedicado, porque na ronda das 13hZ um commit nasceu com a main checada e quase
entrou fora do portão).

- `temVideoPronto` → `podeDestruirVideo = status === "ready"`. A guarda passa a
  decidir pelo **mesmo critério do rótulo**, que era a assimetria.
- No aviso, "Baixar vídeo" só renderiza com `videoUrl`. Sem URL, entra
  `replaceNoDownload`, que fala a verdade: *o vídeo continua salvo, vai ser
  apagado se você substituir, recarregue a página e baixe antes*. Frase conferida
  contra o banco — `ready_sem_path = 0`, então `ready` sempre tem `video_path`.

**Rodei minhas verificações do zero, sem confiar no relato dele** (§1-B passo 4):
`tsc --noEmit` exit 0, `eslint` no arquivo exit 0, e paridade de i18n por
contagem **recursiva** minha — **2149** chaves nos três locales, iguais, com as
duas chaves novas como string nos três. Ele contou 1874 (chave de topo); métodos
diferentes, **mesmo veredito**. Dois instrumentos independentes concordando vale
mais que um instrumento confiante.

Subiu: merge **`cff9f6c`** na main, deploy run **35229632170 = SUCCESS** no
próprio `cff9f6c`. Conferido **na main**, não no PR: `merge-base --is-ancestor
edd0ed1 origin/main` = SIM, `podeDestruirVideo` na linha 64 de `origin/main`,
`temVideoPronto` não existe mais. Sem DDL, então não há coluna pra conferir.

---

## 6. O que eu declaro que NÃO fiz

1. **Não vi a tela.** O Vigia pediu explicitamente a checagem visual (contraste,
   mobile, acima da dobra) porque ele não enxerga — e eu também não rodei a UI.
   Mergeei assim mesmo porque o bloco reusa tokens já usados **neste mesmo
   componente** pra estado de erro, e porque o custo de não subir era continuar
   destruindo vídeo pago. **Risco baixo não é risco verificado**: card
   `6fd116b3` → `qa`, com print item a item.
2. **A perna passiva continua evaporando.** O `retryHint` segue dentro do bloco
   `status === "ready" && videoUrl`. Quem apontou isso foi **o próprio operário,
   sem eu perguntar** — e ele estava certo. Aceitei porque o caminho destrutivo
   está coberto pela confirmação ativa, que diz a mesma coisa.
3. **A key do R2 continua por id da imagem.** Nada foi versionado. O que mudou é
   que o aluno é avisado antes. **Consentimento informado não é conserto do
   defeito** — por isso o `#439` segue `investigating`, e não `fixed`.

Não mexi em crédito, acesso, entitlement nem assinatura. Não cancelei e não
estornei nada. Não escrevi pra aluno nenhum. Não liguei e não mandei WhatsApp.
Não gastei GPU. Não apliquei migration. Não mergeei nenhum branch stale do
origin. Não li a caixa do `suporte@` pra triagem. Não toquei em nada da planilha.

---

## 7. Lição

**Uma guarda tem que falhar no sentido seguro — e antes disso, tem que decidir
pelo mesmo critério de quem ela guarda.**

O patch do Vigia não estava errado por descuido. Ele escreveu
`status === "ready" && !!videoUrl` porque, na cabeça dele, "tem vídeo pronto" e
"tenho a URL do vídeo" eram a mesma frase. Não são: uma é **fato no banco**, a
outra é **resultado de uma chamada de rede com catch nu**. A guarda pendurou a
segurança do aluno num `try` que pode falhar por soluço de rede.

Duas coisas ficam:

**A primeira é a assimetria.** O botão já decidia por `status`. A guarda decidiu
por `status && videoUrl`. Sempre que o **rótulo** e a **trava** olham critérios
diferentes, existe uma faixa em que a porta diz "empurre" e a tranca não está
lá. Revisar é procurar essa faixa — e ela não aparece no `tsc`, que passou verde
nas duas versões.

**A segunda é pior, e é a que eu quero lembrar.** O modo de falha da guarda era
**correlacionado** com o comportamento que ela existia pra impedir. Não era "1%
de chance de não proteger"; era "não protege **precisamente** no aluno que mais
precisa". Uma proteção assim não é fraca — ela é **quase inútil**, porque a
condição que a desliga é a mesma que convoca o perigo. Medir probabilidade aqui
teria dado um número tranquilizador e errado, do mesmo jeito que o `DELTA: 0` de
ontem.

E fecha com a de ontem: ontem o instrumento respondia a **pergunta errada**
("quem ainda está pagando em dobro" em vez de "quem foi cobrado em dobro"). Hoje
a guarda respondia a pergunta certa com o **dado errado** ("tenho o link" em vez
de "existe vídeo"). Nos dois casos ninguém mentiu, tudo compilava, e o dano
morava na diferença entre a coisa e a evidência da coisa.
