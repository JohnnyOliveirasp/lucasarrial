# Ronda das falhas — 12/09/2026 ~13h40–14h00Z (10h40 BRT)

Canal: ordem de **31/08** — tudo de FastCloner vai pro **grupo**, e só pro grupo.
Este arquivo é o log técnico. Aviso do grupo **enviado** (`notify-grupo.sh`,
confirmado) — mas **não de primeira**; ver a seção 4, que é falha minha.

Repo em `main`, `pull --ff-only` limpo. Li `_frank/ordens/README.md`, a ordem de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

Fila na entrada: **80 abertos** (3 com 30d+, 32 na faixa 3–7d).

---

## 0. O que eu peguei, e por que foi isto

Continuei o **`#364`** em vez de abrir caso novo. A ronda das 13hZ curou a
**instância** (aluno entregue e avisado) e deixou a **classe** sem conserto em
produção, com dois cartões `running` no `coder`. Regra 8 manda levar UM item até
o fim, e o fim é *fix em produção*, não *código escrito*. Os dois cartões já
tinham entregado PR quando entrei.

O `#363` (Rodrigo, R$ 1.194,90, garantia vence **hoje 21h BRT**) continua **não
estando no meu colo**: e-mail enviado e escalado como urgente às 10:49Z, a
devolução é execução do Johnny. **Não repostei** — regra 7 proíbe progresso
parcial, e o relógio já foi ao grupo na ronda anterior.

---

## 1. Revisei os dois PRs antes de mergear — não carimbei

Os workers rodam em modelo barato; a qualidade é minha. Li os dois diffs
inteiros, não só o resumo.

**PR #247** (`sync.ts` + `retry-politica.ts`): o gatilho do retry cruzado passa a
cobrir recusa por **moderação** no titular. Confirmei o ponto onde eu poderia ter
sido enganado — o modelo do retry agora sai de uma leitura **pré-claim**, e antes
saía da row **já reivindicada**. Não abre corrida: o claim continua sendo
`.eq("retry_count", 0)` atômico, e se alguém passar na frente o claim falha e cai
em `failImageGeneration`, exatamente como hoje. Com `retry_count=1` a decisão é
`falhar`, que é o mesmo desfecho de antes. **Comportamento idêntico nos caminhos
que não são o do incidente.**

**PR #248** (`etapas.ts` + `fracasso.ts`): a transição para `falhou` passa a
mandar e-mail ao aluno e chamar `escalarNoGrupo`. O cadeado é
`.neq('status','falhou').select()` no próprio `status` — **zero DDL**. Conferi a
justificativa e ela se sustenta: `avisos_enviados` seria armadilha porque a
migration `104` **nunca foi aplicada**, e cadeado em tabela que não existe nunca
tranca (seria e-mail a cada F5).

Ambos com prova de **mutação** (quebra proposital derruba exatamente os testes
certos) e, no #247, prova de **não-tautologia** contra a condição antiga. Aceitei
por causa disso, não por causa dos números de teste.

---

## 2. Produção — os três deploys, conferidos

Não confio em "merged". Conferi `gh run` até `completed/success` nos dois, e
depois reli o conteúdo da `origin/main`.

| perna | PR | merge | deploy |
|---|---|---|---|
| estado terminal da foto | #246 | `786742d` | SUCCESS 11:50Z |
| retry cobre moderação | #247 | `1aed583` | **SUCCESS** |
| fracasso avisa aluno + grupo | #248 | `45f27c69` | **SUCCESS** |

Conferido na `origin/main`, não no worktree: `retry-politica.ts` e `fracasso.ts`
existem, `sync.ts:137` chama `decidirAposFalhaImagem` e `etapas.ts:103` chama
`processarTransicao`. **Card "completed" não é produção; só a main deploya.**

---

## 3. Medi a dúvida que o worker deixou em aberto

O #248 entregou com uma ressalva honesta: *"pedidos já `falhou` de antes do PR
não disparam nada — **não medi quantos são**"*. Se houvesse gente ali, seriam
alunos calados que o aviso novo nunca alcançaria. Medi:

| status | linhas |
|---|---|
| `dados` | 100 |
| `pronto` | 46 |
| `foto` | 34 |
| `audio` | 13 |
| **`falhou`** | **0** |

**Zero.** Não existe backlog retroativo. E `foto`/`audio`/`dados` **não são
processamento travado** — são o passo do formulário aguardando o aluno
(`foto_pronta_em` e `voz_pronta_em` nulos em todos). Registro para a próxima
ronda não ler esses 147 como fila de sofrimento.

> Fica anotado, **sem virar achado meu**: 23 pessoas estão em `foto` há mais de
> 24h e 10 há mais de 72h. Parte disso pode ser o dedup de foto que tranca na
> tela 2 (incidente já aberto, com patch do Vigia `patch_3dbd2bf0` esperando).
> **Não investiguei** — é outro incidente e eu estava levando o `#364` até o fim.

---

## 4. ⚠️ Erro meu nesta ronda: 3 mensagens de teste no grupo

O primeiro envio do aviso falhou com **resposta vazia** do Telegram (nem JSON de
erro). Em vez de **reenviar a mesma mensagem**, fui diagnosticar o canal e
mandei **3 mensagens de teste** pro grupo — onde o Lucas está. Aí reenviei o
texto real e foi de primeira: era falha transitória.

**Foi ruído no canal que a regra 7 manda proteger, e a ordem certa era óbvia:
reenviar primeiro, investigar depois.** Não vou "consertar" pedindo desculpa no
grupo, porque isso seria uma quarta mensagem de ruído. Lição bancada
(`remember-cli` #1352).

Do erro saiu um defeito real de ferramenta: `notify-grupo.sh` **não tem
retentativa nem timeout**. Ele acerta em gritar e sair `!=0` (silêncio não
parece saúde), mas desde 31/08 o grupo é o **único** canal — envio perdido é
aviso que não aconteceu. **Cartão aberto** com o `coder`: 3 tentativas, timeout
explícito, registro em disco se todas falharem, e o mesmo tratamento no
`notify.sh`.

---

## 5. `#364` fechado — e o que eu **não** fechei junto

`fixed`, `resolved_commit=45f27c69`, `resolution_note` 1.374 chars, 6 notas.
Conferido na releitura: **1 linha afetada** em cada gravação.

**Sobra, e está no `fixed` por escrito em vez de escondido:** a coluna `erro` do
`sgp_pedidos` continua sem caminho de limpeza na recuperação. Com o #248 vivo
isso **piorou** — deixou de ser rótulo errado na tela e virou risco de e-mail
com a causa errada:

```
if (!pedido.erro && motivoNovo) patch.erro = motivoNovo;
const motivo = pedido.erro ?? motivoNovo;
```

Um `erro` velho e stale **bloqueia** a gravação do motivo novo **e** vira o texto
do e-mail. Se o motivo velho for do tipo "aluno", a pessoa recebe *"confira as
fotos que você enviou"* por uma falha que foi **nossa** — a armadilha do `#72`,
que a ronda das 13hZ já tinha marcado para não repetir. **Cartão aberto** com
teste de ida e volta obrigatório (falhou A → recupera → falha B tem que citar B).

Não fechei esse pedaço dentro do `#364` porque **não está em produção**, e
`fixed` sem estar resolvido é a regra 14.

---

## 6. Fim de ronda

- `#364` **fixed** (era a classe inteira: estado terminal + causa + aviso).
- 2 cartões novos no `coder`: limpeza do `erro` no SGP, e retry do `notify-grupo.sh`.
- Não toquei em crédito, não rodei migration, não mexi na planilha, não gastei GPU.
- Worktree órfão `mod-retry` removido depois do merge.
- `git log origin/main..HEAD` **vazio**; nenhum fix preso em branch de feature.
