# Ronda das falhas — 11/09/2026, 20h00Z (17h00 BRT)

Frank, dono da fila. Método serial (regra 8). Esta ronda **não fechou
incidente**. Entregou: **o item (b) do `#313` em produção e conferido por
mim**, **uma divergência que eu achei revisando o patch e que não estava
nele**, **um rótulo mentiroso corrigido** e **um achado de passagem que podia
ter custado R$ 2.809 a uma aluna**.

Repo em `main`, `pull --ff-only`. `_frank/ordens/README.md`, a ordem de **27/08**
e a de **29/08** lidas antes de tocar em qualquer coisa. Nada da planilha foi
lido, escrito ou reprocessado. Canal de **31/08**: o aviso foi pro **grupo**.

`now()` medido no banco = **2026-09-11 19:41:09Z** no início.

---

## 1. Peguei o mais antigo, que é o que a regra manda — e era dívida de 3 rondas

`#313` (`2d0509b4`), nascido em **09/06**, **12 pessoas afetadas**. A ronda das
19hZ registrou que ele, o `#15`, o `#47` e o `#99` estavam há três rondas sem
ninguém tocar. Desta vez não desviei: é o mais antigo com aluno afetado, e a
regra 8 não tem cláusula de "é chato".

O que tornava o desvio ainda mais caro: **o patch do item (b) existia desde
09/09**, escrito pelo Vigia, guardado em `agent_state.patch_2d0509b4`, e ficou
**67h parado sem virar PR**. Havia trabalho pronto apodrecendo na prateleira.

## 2. O defeito

`reconcileUserEntitlements` (`payments/entitlements.ts`) casava **toda** órfã do
e-mail com `.is(user_id,null).ilike(buyer_email)` e **não olhava
`product_code`**. O `recomputeProfileAccess` da linha seguinte virava a linha
adotada em `plan=pro` + `access_until` + crédito.

Os eventos dos produtos de curso de **09/06** passaram pelo `grantAccess` antes
de existir o roteamento por produto (`route.ts`: *"SGP: CURSO, não
assinatura"*), então nasceram `active` com `access_until` NULL = **vitalício**.
Quem comprou **só o curso** ganhava a plataforma **para sempre** no primeiro
login.

## 3. O que eu medi no banco, em vez de herdar do card de 08/09

| | |
|---|---|
| `7283335` + `7283229` com `access_until` NULL | **16 linhas / 13 pessoas** |
| órfãs `active` | **14** (11 pessoas; 3 têm os dois cursos) = **a um login** |
| já com conta | `drfabiovilhena29@` → **2030-01-01**, **100.000** cr, `pro` |
| `chargeback` | 1 (`adriannklismann@`) |

**Nenhum outro produto tem `active` + vitalício** — confirma a assinatura do
bug: vitalício em produto de curso é anomalia, não regra.

**A conferência que decidia se o conserto funciona:** `product_code` está
**populado** nas 16 linhas. Isso importa porque `entitlementDaPlataforma`
devolve `TRUE` para `product_code` nulo, de propósito (princípio do `#222`:
ausência de informação não é a informação "é curso"). Se essas linhas viessem
sem produto, **o conserto seria um no-op silencioso** e eu teria anunciado
conserto que não conserta. Conferi **antes** de mergear.

## 4. A divergência que eu achei revisando — e que não estava no patch

O patch do Vigia deixava a lista de curso **privada** no `entitlements.ts`
(lendo `HOTMART_SGP_PRODUCT_ID`) enquanto o detector
`sgp/reconciliacao.ts::orfasQueSobraram` chamava `entitlementDaPlataforma` com
a lista **PADRÃO**.

As duas coincidem hoje (`SGP_PRODUCT_ID_PADRAO` = `7283229` já está no padrão),
então **nada estava quebrado agora** — e digo isso em vez de vender o achado
como incêndio. Mas um SGP novo em ambiente faria o conserto **pular** a órfã por
ser curso enquanto o detector a contava como **plataforma**, abrindo *"sobrou
compra paga sem dono"* exatamente na linha que o conserto decidiu não ligar. É
o *"casa mais que o reconcile"* que o comentário do próprio arquivo existe para
impedir.

`produtosDeCurso()` foi para o módulo **puro** `acesso-regra.ts` e os **dois**
consumidores chamam a mesma função. O id do SGP fica repetido lá como literal
para o módulo seguir **zero-import** (é o que o deixa rodável em `node --test`,
e a razão de ele existir); a cópia ficou **travada por teste**.

## 5. O que subiu, e o que eu conferi com a mão

**PR #242** → merge **`b97e9f4`** na `main` → deploy run `34640964159`
**completed success**, conferido **depois** de terminar, não no ato do merge.

**Não aceitei o relatório do Vigia.** Rodei tudo de novo, em worktree isolado:

- `tsc`: **1 erro, o mesmo** de `origin/main` `0c59494` (`resgate-audio.test.ts`,
  `vitest` ausente) — conferido rodando `tsc` **na main limpa**, não de memória.
  **Zero erro novo.**
- **O `tsc` pegou um `TS2559` que EU introduzi** (`ProcessEnv` num parâmetro de
  tipo fraco). Corrigido antes do commit. Registro porque é a prova de que a
  conferência não foi teatro — se eu não tivesse rodado, subia quebrado.
- `node --test` payments: **135 pass / 0 fail** (130 + 5 novos).
  sgp: **104 pass / 0 fail / 7 skip** (integração que pede `.env.local`, já
  pulados na main — não são meus).
- `eslint`: exit 0 nos 5 arquivos.
- **Mutação:** trocando o literal do SGP por um id errado, **2 dos testes novos
  falham**. A trava morde; não é teste tautológico.
- **Controle de não-tautologia:** um teste prova que, com SGP de ambiente, a
  lista PADRÃO e a VIGENTE dão respostas **opostas** para a mesma linha.

## 6. Por que o card continua `investigating` (regra 14)

Falta o **item (a)**, que é **decisão comercial do Johnny/Lucas**: honrar ou
revogar os 15 vitalícios. A torneira fechou; **quem já passou por ela continua
do outro lado** — `drfabiovilhena29@` segue com a plataforma até 2030 sem nunca
tê-la comprado. Fechar este card agora seria marcar `fixed` sem ter resolvido.
Acionei o Johnny **no grupo**.

**Desbloqueio:** a nota de acoplamento de 11/09 01:51 mandava consertar este
antes de mexer no filtro do `#312`. Tecnicamente destravado — mas **destravado
não é liberado**: widenar o `orphan-outreach` antes da decisão (a) ainda
convidaria essas pessoas a ativar o que o (a) talvez revogue.

## 7. O rótulo que mentia — dívida de duas rondas, agora paga

`garantia_na_fila.cjs` classificava como `SEM_COMPRA_PAGA` com o texto *"Sem
compra PAGA (adesão R$0 / e-mail da compra diferente) — **nada a reembolsar**;
se contesta, escale"*.

A ferramenta **não sabe** isso. Tudo que ela sabe é que não achou
`PURCHASE_APPROVED` casando por `buyer_email`. Virou
`SEM_LINHA_NO_NOSSO_BANCO`, dizendo explicitamente que **não é o mesmo que "não
pagou"** e mandando conferir no `detector_preso_fora_da_conta.cjs` antes de
responder.

## 8. O achado de passagem que justifica sozinho o item 7

Rodando a ferramenta corrigida, o `#356` salta: **Teresa**
(`tuquinha36@hotmail.com`), *"reembolso total confirmado — 5 compras, **R$
2.809,32**"*, com comprovante do parcelamento já enviado.

**`payment_events` para o e-mail dela: ZERO linhas.** De qualquer `event_type`.
Busca por `%tuquinha%` também vazia.

Com o rótulo **antigo**, quem pegasse esse chamado leria *"nada a reembolsar"* e
responderia isso **a uma aluna com comprovante na mão**. É a assinatura da
classe do `#222` (pagou com um e-mail, pediu com outro), que já voltou 7 vezes.

**Não peguei o chamado** (método serial — eu estava no `#313`). **Anotei** com o
número medido e o roteiro do que fazer antes de responder. Não escrevi para ela,
não mexi em dinheiro.

## 9. A armadilha nova, que quase me pegou

`anotar_incidente.cjs` recebe **`<id|prefixo de uuid>`, NÃO o `#numero`**. Passar
`356` resolveu silenciosamente para o uuid `3565a46b` — que é o **`#259`**, outro
chamado. **O ensaio por padrão foi o que salvou**: o dry-run mostrou o título
errado antes de gravar. Quem rodar com `--confirmar` direto escreve nota em
chamado alheio. Sempre resolver `numero → uuid` antes.

## 10. Números da ronda

- **73 incidentes abertos → 73. Nenhum fechado.** O `#313` segue aberto de
  propósito (item (a) não é meu).
- **1 PR mergeado** (#242 → `b97e9f4`, deploy success) · **2 incidentes
  anotados** (`#313` 3→4 notas, `#356` 10→11) · **1 ferramenta corrigida**.
- **0 e-mail** para aluno · **0 GPU, 0 crédito mexido, 0 estorno, 0
  cancelamento, 0 migration.**
- **Fila de patches parados: 3 → 2.** Sobraram `patch_3dbd2bf0` (dedup de foto
  do SGP) e `patch_81438b60` (face-gate do Vídeo Clone, 24h+). Os dois aplicam
  limpo e continuam necessários.
- **Relógio do Leandro** (`#254`, R$97 de 05/09, vence **12/09 00:00Z**): **~4,3h
  restantes**. Segue sem movimento, já com o Johnny desde as 18hZ. Pela 9-C não
  cancelo assinatura de titular sem pedido escrito. Não repeti o ping.
- 🧹 Higiene, **inalterada**: seguem **10 arquivos** modificados não commitados
  em `frontend/**/sgp*` e `frontend/messages/*`, mais não rastreados em
  `_frank/rascunhos/`. **Décima oitava ronda seguida.** Não são meus, **não
  toquei**. Meus arquivos de trabalho ficaram em `/tmp`, fora do git, e os dois
  worktrees que criei foram removidos.

## O que a próxima ronda pega

1. **Os outros 2 patches parados** — `3dbd2bf0` e `81438b60`. Aplicam limpo,
   seguem necessários, e a lição desta ronda é que patch parado é conserto que
   não existe.
2. **Os antigos que continuam sem andar**: `#15` (30/07), `#47`, `#99`. O `#313`
   saiu da lista pela metade; estes três não saíram de lugar nenhum. **Quatro
   rondas.**
3. **O `#356`** (Teresa, R$ 2.809,32) — anotado, não tratado. Rodar o
   `detector_preso_fora_da_conta.cjs` nela antes de qualquer resposta.
