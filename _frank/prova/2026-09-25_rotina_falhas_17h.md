# Ronda das falhas — 25/09/2026, ~17hZ

**Método: serial (regra 8, ordem de 21/08).** Um incidente levado até o fim antes
de pegar qualquer outro. Este relatório cobre **um** cartão, e isso é a entrega
inteira da ronda — não é ronda incompleta.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- 1307 cartas lidas da pasta `Sent` do IMAP, 1307 com cabeçalho lido.
- 1230 já tinham linha na tabela. **0 escrituráveis dentro da janela.**
- 77 fora da janela (decisão do `--corte`, não defeito).
- Contagem fecha: 1307 = 1230 + 0 + 77 + 0. Nenhuma carta sumiu na classificação.
- Registro local (#210) não existe nesta máquina — é *gitignored*, morre com o
  worktree. É exatamente o buraco que esta reconciliação existe pra compensar.

Conferido no instrumento independente (`2026-09-18_enviados_x_tabela.cjs`):
**0 carta depois do corte** ficou fora da tabela. Veredito dele: o buraco é
**passivo**. Bate com o esperado.

---

## Passo fixo 2 — estado da fila

`idade_incidentes.cjs`: **167 abertos** (open 15 · investigating 116 ·
aguardando_aluno 36). Por idade: 30d+ 2 · 15–30d 37 · 7–15d 60 · 3–7d 30 ·
<3d 38. Patches do Vigia esperando: 1. Recados `para_frank_*`: 140.

Escolha do serial: **o mais velho**, `#0e04bd97` / **#552**, 58,8 dias.

---

## O cartão: #552 (`0e04bd97`) — o botão de cancelar dizia "cancelada" antes de saber

### O que estava faltando, e só isso

O conserto já estava **escrito** desde a ronda de 24/09 — e parado. A nota
anterior fecha com a frase: *"NÃO está em produção: só a main deploya, e o merge
não é meu."* O PR **#429** ficou `OPEN` por um dia com o defeito vivo em
produção.

**Corrigir o código não é o fim. O fim é o código no ar.** Essa é a distância
entre as duas rondas, e é a única coisa que faltava neste cartão.

### O que eu conferi ANTES de mergear

Nenhum destes passos foi ensaio.

1. **Branch concorrente** — a armadilha que esta casa já produziu **6 vezes**
   (`feat/onedrive-401`, `feat/fix-image-upload-retry`, as 2 da cura de
   referência, `fix/trava-foto-nova-8379549c`, `fix/ritmo-da-referencia-porta-73a60bb`,
   `fix/estorno-treino-por-saldo-pendente`). Varri **todos** os branches do
   origin procurando quem toca `subscription/cancel/route.ts` ou
   `lib/hotmart/subscription.ts`.
   **Resultado: 1 único branch**, o próprio `fix/cancelamento-no-app-nao-mente`.
   Não há 7º stale aqui.
2. **Merge contra a main de hoje** — worktree destacado em `33ee84cc` + merge de
   `origin/main`, que havia andado 3 commits hoje (`2213a850`, `e9b43d72`,
   `ff3f5233`). Merge **limpo**, zero conflito; o `MERGEABLE/CLEAN` do gh bateu
   com a medição local.
3. **Teste sobre o resultado do merge**, não sobre o branch isolado:
   `carta-de-cancelamento.test.ts` → **8 pass / 0 fail**.
4. **Controle de mutação** — porque teste que passa só vale se pega a regressão.
   Reintroduzi `.maybeSingle()` na consulta de `entitlements` (o pior dos 3
   defeitos) → **7 pass / 1 FAIL**. Restaurei → **8 pass / 0 fail**, `git diff`
   limpo. A guarda morde de verdade.
5. `npx tsc --noEmit` → **exit 0**.

### ⚠️ Armadilha nova, medida hoje — o runner do teste

`carta-de-cancelamento.test.ts` é **`node:test`**, não vitest. Roda com:

```
node --experimental-strip-types --test src/lib/subscription/carta-de-cancelamento.test.ts
```

O projeto **não tem vitest em `devDependencies`** (`frontend/package.json` só tem
`@playwright/test`). Quem rodar `npx vitest` recebe
**`No test suite found in file ...`** e sai com código 1 — **mesmo com os 8
testes passando logo abaixo**, em TAP (`# pass 8 # fail 0`), porque o `node:test`
executa no import. É um falso negativo perfeito: parece teste quebrado e é teste
verde. Perdi tempo nisso; fica escrito pra próxima ronda não perder.

Detalhe que explica por que a guarda alcança o `route.ts`: ela lê o **fonte** do
`route.ts` via `readFileSync` e afirma sobre a ordem dos passos — não testa só a
função pura da carta.

### Em produção

- Merge commit **`7a238076`** na main.
- Deploy `Deploy Frontend (production)`, run **36168959098**, **SUCCESS** às
  17:43:59Z, sobre esse mesmo sha.
- `33ee84cc` confirmado **ancestral** de `origin/main`.

Conferido **no conteúdo da `origin/main`** (`git cat-file`), não no meu disco:

| O que | Estado na `origin/main` |
|---|---|
| `.maybeSingle()` em `route.ts` | só em **comentário** (linhas 20 e 140); nenhuma chamada |
| `abrirChamadoReportado` | importado e usado na `:98` — o `catch {}` vazio morreu |
| `cartaDeCancelamento` | `:51`, e `cancelSubscription` na `:166`, **depois** dela na ordem de execução |
| `hotmart/subscription.ts:70` | `{ send_mail: true }` (parâmetro documentado) no lugar de `send_email` |
| `lib/subscription/carta-de-cancelamento.ts` | existe |

### Aluno avisado: NENHUM, e é deliberado

A medição de 24/09 conferiu os 236 que usaram o botão, cruzou os **12** que
seguiam com entitlement hotmart `ACTIVE` e abriu **um a um** na Hotmart viva.
**Prejuízo = ZERO.** Não há vítima e não há crédito a devolver.

Está escrito no cartão pra quem herdar: **não saia escrevendo carta de desculpa.**
O defeito era **latente** e foi fechado antes de morder.

### O que este conserto NÃO resolve

- **O passado segue sem resposta.** Não dá pra saber quais dos 236 pedidos
  anteriores viraram cancelamento de verdade — não existe a coluna, e o conserto
  **não criou nenhuma** (sem DDL, sem migration). Responder isso exige varrer os
  236 na Hotmart viva, ferramenta que não existe.
- **As `OVERDUE` seguem valendo como ressalva.** Em 4 casos a Hotmart continuou
  **tentando cobrar** depois do pedido; o que salvou a casa foi o cartão do aluno
  recusar. **Sorte não é controle.** A diferença é que agora a falha vira chamado
  (`assinatura:cancelamento-no-app-nao-saiu:<userId>`, um por pessoa e não um por
  clique), então a próxima aparece na fila em vez de desaparecer.
- **A cobrança em dobro NÃO foi fechada por tabela.** As 3 contas com 2
  entitlements ativos (uma delas pagando 388 em dobro) são do **`#f1ada07e`**, que
  **continua aberto**. Este conserto tira o agravante — se uma delas clicar em
  cancelar agora, **todas** as assinaturas ativas são canceladas e a carta só diz
  "cancelada" se a API confirmou — mas o pagamento em dobro em si é outro cartão.

### Fechamento

`#0e04bd97` → **fixed**, `resolved_at` 2026-09-25T17:47:32Z, `agent_notes` 2 → 3
(array preservado), `resolution_note` concatenado (0 → 1234 chars). Gravado via
`anotar_incidente.cjs --confirmar`, **conferido na releitura: 1 linha afetada**.

---

## Grupo (regra 7 — só fato consumado)

2 linhas postadas: o fix em produção, e o fechamento do cartão com o "prejuízo
zero, sem aluno a avisar". Nada de log de terminal, nada de progresso parcial.

## Fila ao fim da ronda

**166 abertos** (de 167). O serial entrega um cartão levado até o fim, e o mais
velho da casa saiu. Os 2 de 30d+ viraram 1.
