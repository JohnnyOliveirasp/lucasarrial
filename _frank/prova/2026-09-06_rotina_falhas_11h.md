# Ronda das falhas — 06/09, 11hZ (08h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente e levei até o fim.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08).

---

## 0. A ronda em uma linha

**Os dois itens que o Vigia das 10hZ marcou como urgentes eram os dois falsos:
os 4 alunos "nunca avisados" já tinham sido avisados DUAS vezes, e o #261
("aluna escreveu e ninguém respondeu em 20h") é uma autorresposta vazia que o
nosso filtro descartou corretamente. Fechei o #261 e NÃO escrevi para os 4.**

---

## 1. O que eu NÃO fiz, e por quê — os 4 alunos queimados

O Vigia das 10hZ pediu, como item 🔴 1 de decisão: *"Avisar os 4 alunos
queimados de que o Vídeo Clone voltou… nenhum avisado de que o produto voltou."*

**Fui checar antes de escrever, e a afirmação é falsa.** `ler_caixa.cjs
--enviados --para <email>`, um a um: os **4** receberam aviso de que voltou, e
receberam **duas vezes**:

| aluno | "Voltou: voce ja pode gerar…" | "Vídeo Clone voltou a funcionar…" |
|---|---|---|
| `costa.anaelson@gmail.com` | uid 1104 · 00:36:52Z | uid 1115 · 01:08:10Z |
| `rafaluanravi29@gmail.com` | uid 1099 · 00:36:36Z | uid 1116 · 01:08:13Z |
| `clayton@arcoiristintas.com` | uid 1105 · 00:36:56Z | uid 1117 · 01:08:16Z |
| `lux.neuropsi@gmail.com` | uid 1100 · 00:36:39Z | uid 1118 · 01:08:19Z |

Um **terceiro** e-mail era exatamente o acidente que o **PR #193**
(`trava(email): o mesmo aviso não sai duas vezes pro mesmo aluno`) existe para
impedir — e que já aconteceu com eles às 00:36 e 01:08. **Não mandei.**

Isso é regra 14-A funcionando: a objeção do Vigia é **insumo**, não ordem.

**Crédito conferido na fonte** antes de qualquer conclusão, pelo `ref_type`
certo (`video_clone_refund` — filtrar por `kind` daria falso negativo, e o
`kind` aqui é `extra_purchase`):

| aluno | débitos `video_clone` | estornos `video_clone_refund` | líquido | saldo hoje |
|---|---|---|---|---|
| Anaelson | 6 · −23.310 | 6 · +23.310 | **0** | 153.759 |
| Clayton | 4 · −19.425 | 4 · +19.425 | **0** | 153.565 |
| Rafaela | 5 · −7.185 | 5 · +7.185 | **0** | 86.575 |
| Luciano | 3 · −8.610 | 3 · +8.610 | **0** | 82.090 |

**Ninguém perdeu crédito, e todos foram avisados.** Os 4 não voltaram a gerar
porque escolheram não voltar, não porque ficaram sem informação. Não há ação
técnica pendente aqui — e não é caso de e-mail novo.

---

## 2. O incidente que levei até o fim — #261 → `ignored`

Peguei o **#261** (`ab485826`) porque tinha aluna nomeada, fix pronto em PR
(**#188**) e cabia fechar de ponta a ponta. **Fechou — mas pelo motivo
oposto ao esperado.**

Antes de mergear, baixei o **MIME cru** do uid 436 (`ler_caixa.cjs --mime`,
`EXAMINE` + `BODY.PEEK`; flags `[\Seen]` intactas antes/depois, fila de
não-lidos 0 → 0). As **três** afirmações do card são falsas:

**1) O mecanismo do título não se aplica.** `plainIdx = -1`, `htmlIdx = 6839`,
`/multipart/` não casa em lugar nenhum: é **singlepart `text/html`**. Pelo
código *antigo*, `idx = htmlIdx` → `stripHtml` → o html **era** olhado.

**2) A aluna não escreveu.** O corpo inteiro, cru, é
`<div dir="ltr"><br></div>`. Os cabeçalhos de topo dizem o que é:

```
Precedence: bulk · X-Autoreply: yes · Auto-Submitted: auto-replied
In-Reply-To: <frank-1788537978383-cpha68u7aaw@fastcloner.com>
```

O `In-Reply-To` é do **nosso próprio** e-mail de onboarding. É a autorresposta
do provedor dela. Não havia pergunta.

**3) O silêncio foi o filtro acertando.** `shouldSkip` casa duas vezes
(`:75` auto-submitted, `:76` bulk). Rodado contra o MIME real →
`shouldSkip => "auto-submitted"`. Responder autorresposta `bulk` é como se
fabrica **laço de e-mail**.

### Por que NÃO mergeei o PR #188

Rodei o gate novo contra o MIME real: `skip="auto-submitted"` → `!skip` false →
**`responderCorpoIlegivel` não dispara**. O PR se justifica por um caso em que
ele não atua — e faz certo em não atuar.

O PR tem duas metades de risco diferente, e deixei o parecer nele
([#188 comment](https://github.com/JohnnyOliveirasp/lucasarrial/pull/188#issuecomment-5558705454)):

- ✅ `mail-corpo.ts` (parser tenta plain, cai pro html): melhora latente boa e
  inofensiva — com plain preenchido a saída é byte a byte a de antes;
  `node --test mail-corpo.test.ts` **9/9 ok**.
- ⚠️ `responderCorpoIlegivel()`: caminho **automático** de responder aluno +
  abrir incidente para toda mensagem `>= 2KB` sem texto legível, desenhado
  contra um dano que não existiu. Autoresponder sem os cabeçalhos padrão passa
  pelo `!skip`.

Subir resposta automática com a premissa derrubada não é conserto de rotina.
**Não fechei o PR** — sugeri separar as metades.

`tsc --noEmit` na branch: **1 erro pré-existente e alheio**
(`resgate-audio.test.ts` importa `vitest`, é o que o **#185** conserta).

**Gravação conferida** (`anotar_incidente.cjs`, releitura): `status =
investigating → ignored`, `agent_notes 2 → 3`, `resolution_note 796 chars`,
**1 linha afetada**. Não é `fixed` de propósito: não houve conserto porque não
havia defeito. **#248 segue `ignored` e não foi reaberto.**

---

## 3. O que eu decidi NÃO pegar, e por quê

**#222** (5 alunos presos fora da própria conta) é o card mais grave da fila,
mas está **parado em decisão de produto do Johnny**, não em investigação. As
notas de 04/09 e 05/09 já mediram e fecharam: e-mail exato **0 de 42**, e-mail
normalizado **0 de 42**, CPF **2 de 42** com 9 ambíguos. A nota pede
explicitamente que a próxima ronda **não gaste o turno redescobrindo as mesmas
chaves**. Obedeci. Ele não avança sem o Johnny.

---

## 4. Precisa de DECISÃO do Johnny

1. 🔴 **PR #188: separar as duas metades?** O parser entra sozinho; a rede de
   resposta automática precisa de outro gate. Parecer completo no PR.
2. 🔴 **21 PRs abertos e ainda ZERO commit na main.** O #188 saiu da conta
   (não deve subir como está), mas **#186** (#259/#260), **#176** (#226) e
   **#90** (#15) seguem fechando chamado aberto **agora**. Continua represado
   no merge.
3. **#222** — vínculo por confirmação é decisão de produto. Sexta ronda parada.
4. Itens 3–9 do Vigia das 10hZ (Solon/#254, Vinícius, Regis/#263, Katia/#47,
   `victor@`, SGP com 40% de abandono, Marcelo e Luciano) **seguem todos de
   pé** — nenhum foi tocado nesta ronda.

---

## 5. Lição registrada (para a próxima ronda não repetir)

**`"(sem corpo em texto)"` na saída do `ler_caixa` tem duas causas opostas e a
mesma aparência:** *"o parser não conseguiu ler"* (bug nosso) e *"o aluno não
escreveu texto"* (filtro certo). Antes de cravar causa em `arquivo:linha`,
**baixe o MIME cru (`--mime <uid>`) e leia `Precedence` / `Auto-Submitted` /
`X-Autoreply`.** Foi essa checagem que impediu esta ronda de mergear uma
resposta automática e de mandar um terceiro e-mail para 4 alunos.

Vale a mesma coisa para relatório de ronda: **"não foi avisado" precisa ser
medido em `--enviados`, não inferido de "não voltou a gerar".**

---

## 6. O que eu NÃO fiz

Não escrevi para aluno (não havia o que responder), não mexi em crédito, não
estornei, não mergeei PR, não apliquei migration, não disparei geração de
teste, não reabri incidente e não toquei em nada da planilha. Leitura da caixa
com `EXAMINE` + `BODY.PEEK`; flags e fila de não-lidos conferidas intactas
antes e depois.
