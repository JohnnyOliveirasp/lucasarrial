# Ronda das falhas — 03/09/2026, 22:59Z (19:59 BRT)

Serial: **#222** (`3ca22d47`) — sexta ronda no mesmo serial. Segue sendo o
aberto mais antigo com aluno afetado (01/09 15:54Z).

Item levado até o fim: **Fernanda Franzolin** (`ftfranzolin@gmail.com`). É o
**3º aluno consertado** do #222, e o **2º de 2** do Grupo B que **não é
assinante pagante** — o que a ronda anterior tratou como exceção do Marcio
agora é padrão medido, não palpite.

## Fila conferida antes de escolher

`varredura_travados.cjs`: **5 abertos** (igual), **12 em `aguardando_aluno`**
(igual), 2 presos. Nada fura o serial — não há produção fora do ar nem dinheiro
sendo cobrado errado agora.

Antes de tocar em qualquer coisa, reconferi o conserto da ronda anterior:
`aluno.cjs cdmarciofernandes@gmail.com` → *"acesso: ATIVO até 2026-09-10"*.
**Segurou.**

## Por que a Fernanda, e não os outros 2 do Grupo B

Restavam 3 órfãos. O critério do serial (mais antigo com aluno afetado; empate,
quem tem mais a perder) aponta ela sem ambiguidade:

| aluno | entitlement criado | janela fecha | conta |
|---|---|---|---|
| **Fernanda Franzolin** | **11/08 13:54** | **11/09** (8 dias) | `ftfranzolin@gmail` |
| Jesus Peres | 18/08 13:27 | 18/09 | `diretoria@grupoperes` |
| José Carlos (`dropweb`) | 02/09 18:32 | 02/10 | `jose@dropweb` |

A ronda anterior tinha nomeado o `dropweb` como candidato natural, pela carta
errada (uid 494) ainda não corrigida. **Fui medir antes de aceitar a herança**:
`select count(*) from auth.users where email='atendimento@dropweb.com.br'` →
**0**. Ele não obedeceu a carta, não criou 2ª conta, e a janela dele fecha só em
02/10. O dano da carta dele é **potencial**; o da Fernanda era **em curso e com
prazo**. Ela fica.

## `pagou_de_verdade` ANTES de escrever qualquer coisa

Pré-requisito desde a ronda z2246, e de novo foi ele que definiu o tratamento.

| evento | data | valor | status |
|---|---|---|---|
| `PURCHASE_CANCELED` ×2 | 11/08 13:51 | R$ 0 | CANCELED (2 tentativas em 6s) |
| `PURCHASE_APPROVED` FastCloner | 11/08 13:54 | **R$ 0** | APPROVED (**trial**) |
| `PURCHASE_BILLET_PRINTED` | 18/08 14:37:34 | R$ 97 | boleto **impresso** |
| `PURCHASE_DELAYED` | 18/08 14:37:46 | R$ 97 | **DELAYED**, 12s depois |
| `PURCHASE_COMPLETE` | 19/08 09:38 | R$ 0 | assinatura **PAST_DUE** |

**Não é assinante pagante.** O que ela pagou de verdade foram **R$ 313,32 em
10/08** na *Fábrica de Conteúdo Invisível*, produto **avulso** (decisão
comercial #173 — **não mexi**).

### A linha do tempo do prejuízo

```
10/08          paga R$313,32 na avulsa (outro produto)
11/08 13:48    cria a conta (gmail)
11/08 13:51    duas compras CANCELADAS em 6 segundos
11/08 13:54    entra no trial do FastCloner  -> entitlement ORFAO (hotmail)
11/08 14:40    ultima vez que abriu           (52 min, zero acesso na tela)
18/08 14:37    IMPRIME BOLETO de R$97         (ela quis pagar)
18/08 14:37    boleto nao compensado -> DELAYED (12 segundos depois)
```

**O padrão do Marcio se repete inteiro**: olha uma conta que não mostra acesso
nenhum, e dias depois imprime um boleto que não compensa. Dois de dois no Grupo
B. Não afirmo que uma coisa causa a outra — não tenho como medir isso —, mas a
sequência agora aconteceu duas vezes igual, e isso muda o que a carta pode
dizer.

## Identidade: provada, e mais limpa que a do Marcio

- `profiles.display_name` = **"Fernanda Franzolin"** == `buyer.name` do evento.
- **1 único perfil** com "franzolin" em **1.828**. Controle contra zero cego:
  "fernanda" devolve **9** — o instrumento enxerga, o 1 é real.
- **CPF 27986297808** aparece em **1** entitlement só: ela não tem outra compra
  escondida em outro endereço.
- `auth.identities` = **google** → a carta manda *"Entrar com Google"* e desvia
  do #243/#244.

⚠️ O local-part **não** é idêntico: `fnfranzolin`@hotmail → `ftfranzolin`@gmail,
muda a 2ª letra. Por isso a prova aqui não se apoia no e-mail, e sim em nome +
CPF + unicidade no banco. Foi o cruzamento por nome que quase produziu o falso
positivo do Marcio (`marciofcorreia`) e o do `allan_air`; aqui não há segundo
candidato para confundir.

## A decisão de vincular (mesma do Marcio, e pelo mesmo motivo)

O entitlement está **`active` com janela aberta até 11/09**. A fonte de verdade
do acesso é o entitlement, e o único motivo de ele não estar na conta é o nosso
bug (`claim.ts:39` casa só por e-mail exato).

**Vinculei.** Recusar por "não pagou a assinatura" repetiria a classe de erro do
`ja_pagou`: negar acesso a quem o sistema diz que tem. O vínculo entrega o trial
que ela já tinha direito, **se auto-expira em 11/09** e **não move dinheiro**.

## O conserto, medido

- `entitlements.user_id` `null` → `10bec0b4`, UPDATE guardado por
  `and user_id is null`, com `RETURNING`: **1 linha**.
- Cache do perfil recomposto **como o `recomputeProfileAccess` escreve** —
  reli o código (`entitlements.ts:198-215`): `plan='pro'`,
  `access_source = active.provider` (li o `provider` do entitlement antes de
  escrever: `hotmart`), `access_until='2026-09-11 12:00Z'`. `RETURNING`:
  **1 linha**.
- Conferido por **instrumento independente**, não pelo eco do meu UPDATE:
  `aluno.cjs ftfranzolin@gmail.com` → *"acesso: ATIVO até 2026-09-11"*,
  *"compras: 2026-08-11 active"*.

**Não creditei na mão, de propósito.** O `claim.ts` concede os 100k
(`PLAN_MONTHLY_CREDITS`, conferido em `credits/config.ts:7`) no próximo login.

## 🔴 Armadilha de instrumento: o teste de crédito em dobro das duas rondas anteriores era CEGO

As rondas z2140 e z2246 registraram, como prova de que não haveria crédito
duplicado, ter conferido **zero `subscription_grant`**. Fui repetir a conferência
e ela volta zero **para qualquer pessoa**:

| consulta | resultado |
|---|---|
| `ref_type = 'subscription_grant'` | **0 de 15.000+ linhas** (o valor não existe nessa coluna) |
| `kind = 'subscription_grant'` | **1.977** ← a chave real |
| `ref_type` gravado pelo grant | `payment_event` (`claim.ts:73-77`) |

O `claim.ts` dedupe por `kind='subscription_grant'` **e** `ref_id in
(transação, external_id)`. Perguntar por `ref_type` devolve zero sempre, e
"zero" ali seria lido como "não há risco de dobra" — a mesma família da
armadilha do `grep` no bundle (regra 5-B) e do "consulta que erra volta vazia".

Refeito com a chave certa e **controle positivo**: `kind='subscription_grant'`
com `ref_id in ('HP0304698101','C6NHRRMM')` → **0**, contra 1.977 existentes na
tabela. Aí sim: **não há risco de crédito em dobro**. O resultado das rondas
anteriores continua provavelmente certo (aqueles usuários tinham 0 transações de
qualquer tipo), mas a **prova** que elas registraram não provava nada.

## A 4ª carta errada da classe — e ela é da MESMA leva da do Marcio

A carta de **01/09 (uid 433)** para a Fernanda erra **as duas coisas**, palavra
por palavra, que a uid 434 do Marcio errou:

1. **"a sua assinatura está paga e ativa"** e *"paga até 11/09"* — **falso**.
   Trial R$0 com boleto vencido.
2. **"crie uma conta usando o fnfranzolin@hotmail.com"** — a instrução que
   fabrica segunda conta, que é o mecanismo que embananou o `qooqi`.

**Conferido: ela NÃO obedeceu** — `auth.users` com `fnfranzolin@hotmail.com` →
**0**.

### O tamanho da leva errada, medido (e é bom)

uid 433 (21:43:26) e uid 434 (21:43:32) saíram com **6 segundos** de diferença:
é uma leva, não dois acasos. Fui ver quantas são. Nas **80 últimas enviadas**
(uid 424–503), as cartas com esse assunto são **exatamente 2** — 433 e 434.
**As duas agora estão corrigidas** (uid 502 ontem, uid 503 hoje).

E as 4 cartas de **hoje** que também afirmam "sua assinatura está paga"
(uid 492 `josephgois`, 493 `isaias.enf`, 495 `rmf174`, 496 `flaviamalavazi`)
não são da mesma doença: rodei `pagou_de_verdade` nas quatro e **as quatro
PAGARAM assinatura de verdade** (além de avulsas de R$1.4k–2.3k cada). A
afirmação "está paga" está certa nelas. O defeito ficou contido em 01/09.

⚠️ Limite desta contagem: procurei **por aquele assunto exato**, nas 80 últimas.
Carta com outro assunto afirmando pagamento inexistente não apareceria aqui.

### Carta de correção — uid 503, cópia CONFIRMADA na tentativa 1

Corrige as duas afirmações de frente ("o erro foi meu"), manda **entrar com
Google na conta que ela já tem**, aponta a diferença `fn`/`ft` (para ela
entender o que houve, não para se culpar), diz que os créditos caem sozinhos, e
**avisa que a janela fecha em 11/09 e por quê** — para ela não ser cortada de
surpresa em 8 dias. Cita a avulsa como produto separado e **oferece confirmar
com o time**, sem prometer nada (#173). Sem promessa de extensão.
`--dry-run` conferido antes (destinatário, remetente, corpo inteiro).

## Regra 7 — fato consumado postado no grupo

Via `avisar_grupo.cjs --fato`, por ssh no Hetzner (a WAHA só escuta em
`127.0.0.1` de lá). Não pede resposta.

⚠️ **O ensaio pegou um erro que teria ido pro grupo**: passando o corpo entre
aspas duplas, o bash expandiu `R$0` → `/bin/bash`, `R$97` → `R7` e `R$313,32` →
`R13,32`. Uma mensagem sobre dinheiro com os valores comidos. Refeito com aspas
simples e reconferido no `--seco`. **Cifrão em `--corpo` sempre em aspas
simples.**

## O que isso muda no #222

1. **O Grupo B é, até aqui, 2 de 2 não-pagantes.** A classificação original
   ("consertável na mão, igual ao qooqi") continua valendo para o *conserto*,
   mas **não** para o que a carta afirma. `pagou_de_verdade` antes do vínculo
   segue sendo pré-requisito.
2. **A leva errada de 01/09 está fechada**: 2 cartas, 2 correções, nenhum aluno
   criou a segunda conta que elas mandavam criar.
3. **Causa estrutural intacta**: `claim.ts:39 → reconcileUserEntitlements` casa
   só por e-mail exato. Incidente segue **`investigating`** — de propósito.

Nota no #222: **19 → 20**, 1 linha afetada, conferida na releitura.

## Para a próxima ronda (medido hoje, não tratado)

- **Jesus Peres** é o próximo pela janela (18/09), mas **não vincule no
  automático**: a conta dele (`diretoria@grupoperes`) tem entitlement
  **próprio**, já ligado, `canceled` e vencido em **25/08** — comprado
  13:23, **4 minutos antes** da órfã (13:27). Cheira a compra em dobro
  (padrão `qooqi`), e isso muda o tratamento. Medir antes.
- **`dropweb`**: carta errada uid 494 ainda de pé. Sem 2ª conta criada até
  agora; janela 02/10.
- 🔴 **`para_frank_a6e3288b`**: *"Vinicius quer o dinheiro de volta (R$ 2.697,60,
  3 compras Hotmart) — janela de 7 dias vence 05-06/09"*. **Dinheiro com prazo
  batendo na porta.** Não é do meu serial e não tratei, mas não pode esperar
  mais duas rondas: avisei o Johnny.

## Limites honestos desta ronda

1. **Não consertei a causa do #222** — remediei o 3º aluno e corrigi a 2ª (e
   última) carta da leva errada. O bug do `claim.ts` está de pé.
2. Não toquei nos outros 2 do Grupo B nem nos 2 casos de estorno (Jackson,
   Carlos): serial e alçada.
3. Os recados em `para_frank_*` (**9**) e o `patch_92b1cc85` seguem **não
   tratados** — oitava ronda seguida. Hoje pelo menos os **li e contei**, em vez
   de só registrar que existiam.
4. Não reverifiquei **#226**, **#234**, **#47**, os dois de áudio nem a Katia.
   **Não afirmo nada sobre eles.**
5. Não escrevi para o Marcelo (acesso vence **05/09**) nem para o Luan (import
   quebrado há 6 dias).
6. Não abri o app, não ouvi áudio, não vi imagem: banco, envelope, Hotmart e
   código lido.
7. Não sei **por que** ela não compensou o boleto, nem por que houve duas
   compras canceladas em 6 segundos antes da que valeu. A sequência sugere,
   não prova.
