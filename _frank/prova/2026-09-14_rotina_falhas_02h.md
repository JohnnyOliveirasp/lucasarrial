# Rotina das falhas — 14/09 ~02hZ

Ronda serial (regra 8). Peguei **um** item e o levei até onde ele podia ir.
Não fechei nenhum incidente hoje e não vou fingir progresso que não houve — o
que esta ronda entregou foi **destravar duas coisas que estavam paradas por
motivo errado** e **abrir um defeito que ninguém tinha visto**.

---

## Estado na entrada

| | agora | ronda anterior (01hZ) |
|---|---|---|
| incidentes abertos | 81 | 80 |
| aguardando aluno | 14 | 14 |
| recados `tell_frank` | 73 (o mais velho 12,3d) | 73 |
| **patches do Vigia parados** | **1** | 1 |
| itens presos na varredura | 1 obsoleto (ninguém esperando) | 3 |

---

## 1. O patch parado há 4 dias estava MORTO — e a fila mentia sobre isso

`patch_7578c587` aparecia como "patch do Vigia esperando" em toda ronda desde
10/09. O manual (§1-B) manda tratar patch **antes do resto**, então toda ronda
pagava esse pedágio.

Ele **não precisava de revisão nenhuma**: o próprio Vigia o matou em 10/09
00:30Z, porque o `#320` resolveu o mesmo mojibake na main por um caminho melhor
(`mail-charset.ts`, decodifica pelo charset declarado antes de qualquer operação
de texto). Ele marcou `OBSOLETO=SIM` no valor da chave — **mas não apagou a
chave**, e o §1-B passo 6 é explícito: aplicado ou recusado, `DELETE`.

Conferi antes de apagar, não aceitei o recado dele como prova:

- `git merge-base --is-ancestor 857986c main` → **está na main** (PR #220).
- `mail-respond.ts:40` → `import { mailText, header } from "./mail-charset"`.
  O caminho novo está de fato em uso, não só commitado.

`DELETE` executado e **conferido por contagem** (`ainda_la = 0`), não por
"o comando não deu erro". **Fila de patches: 1 → 0.**

Custo real disso: 4 dias × toda ronda lendo "tem patch esperando" e indo
verificar um patch que já estava enterrado.

---

## 2. O serial da ronda: `7578c587` — Emanuel Guerreiro

Escolhi este porque tinha as duas coisas que o manual manda priorizar: um
**patch preso** (§1-B) e um **aluno pagante esperando**, e os dois estavam
pendurados no mesmo cartão.

### Medido agora, não herdado de nota

- Hotmart viva: 2 avulsas COMPLETE em 12/05/2026 — `HP3234138926` Sistema de
  Geração Pronto **113,16 EUR** + `HP3485749383` Fábrica de Conteúdo Invisível
  **67,65 EUR** = **180,81 EUR**. Assinaturas: **0**. Stripe: 0.
- `aluno.cjs`: SEM ACESSO, 0 créditos, "compras: NENHUMA", perfil de 14/08.
  Voz `799edf73` em `awaiting_training` com ~5 min de fala contra os 20 min que
  o SGP exige. **Entrega do SGP: inexistente. 125 dias.**

### Por que eu NÃO escrevi pra ele — e essa foi a decisão da ronda

Fui conferir os Enviados **antes** de redigir. Ele **já foi respondido**:
uid 1716, 11/09 11:10Z, **um minuto** depois do pedido dele — *"Recebido. Vou
levar o seu pedido de restituição a quem tem autoridade para decidir e retorno
com a posição, seja ela qual for."*

O acuse existe e está correto. Ele não escreveu mais nada desde 11/09 12:09.

Um quarto e-mail meu dizendo "continuo sem resposta" **não traz informação
nova** e confirmaria por escrito exatamente a queixa dele (*"atrasos e
informação menos correcta e coerente"*). O que foi prometido a ele foi **a
posição** — e a posição não é minha. Escrevo no minuto em que o Johnny decidir,
com o desfecho, não com mais um encaminhamento.

Registro isto com todas as letras porque "não escrevi ao aluno" normalmente é
falha, e aqui foi decisão. Se eu estiver errado, o erro é meu e está datado.

### O que está travado: só a decisão de dinheiro

Garantia da Hotmart vencida há muito → **não existe caminho automático, não há
prazo correndo e não há script que resolva**. Ou é cortesia comercial do Johnny,
ou a resposta é não. **Escalado ao grupo nesta ronda** com as duas transações,
pedindo sim/não e o valor (só o SGP não entregue, 113,16, ou os 180,81).

É a **terceira vez** que este caso sobe. Registro que subiu de novo em vez de
deixar envelhecer em silêncio.

**Status segue `investigating`, não `aguardando_aluno`**: a bola não está com o
aluno, está com o Johnny. Marcar `aguardando_aluno` aqui seria pendurar no aluno
uma espera que é nossa.

---

## 3. Achado novo: a Fast responde e-mail sem memória nenhuma — `#387`

Saiu de dentro do fio do Emanuel. Em 11/09 ele exigiu devolução às 11:09Z, foi
acusado às 11:10Z, e às 14:15Z recebeu da casa um e-mail inteiro de *"refaça o
envio em fastcloner.com/sgp"* — o caminho técnico que ele **acabara de recusar
por escrito**. Três e-mails nossos no mesmo dia, um corrigindo o outro.

Fui ver o código. `mail-respond.ts:291-293`:

```ts
const history = [
  { content: `Assunto: ${subject}\n\n${text}`, from_me: false, ... },
] as unknown as AgentMessageRow[];
```

**A variável se chama `history` e não é histórico.** É um array de UM elemento —
a mensagem que acabou de chegar. O `as unknown as` cala o compilador que
reclamaria da forma. É provavelmente por isso que ninguém viu: o nome mente.

A assimetria é a prova de que é defeito e não decisão de projeto:

| canal | history |
|---|---|
| WhatsApp (`respond.ts:264`) | `((rows ?? []) as AgentMessageRow[]).reverse()` — conversa inteira do banco |
| Chat do app (`help/route.ts:288`) | linhas do banco |
| SGP (`sgp/ajuda/route.ts:169`) | history próprio |
| **E-mail** (`mail-respond.ts:291`) | **array de 1, fabricado à mão** |

**O único canal cego é justamente onde moram reembolso, cancelamento e cobrança
em dobro** — os casos graves, que quase sempre são fios longos.

**Ressalva honesta, pra ninguém superdimensionar:** o aluno costuma **citar** o
e-mail anterior no corpo, então a Fast enxerga por acidente o que o cliente
dele citou. O que ela nunca enxerga é (a) o que a casa mandou depois da citação,
(b) mensagens paralelas do mesmo dia, (c) as notas do incidente. E no caso das
14:15Z o e-mail nem era resposta (assunto sem `Re:`) — ali a causa é outra e
some junto: **nenhum disparo pro aluno confere se existe pedido de reembolso
aberto**.

**Não medi quantos alunos foram atingidos.** É diagnóstico de código com **1
caso confirmado**. Quem pegar o `#387` começa pela varredura, e **não afirme
número antes de medir**.

Não toquei no código: o serial da ronda era o `7578c587` e este achado saiu de
dentro dele. Cartão aberto pra não virar conhecimento que morre no log.

---

## 4. O que eu NÃO fiz

- **Não fechei nenhum incidente.** Nenhum dos que olhei estava resolvido.
- **Não mexi em dinheiro, crédito, acesso nem entitlement.**
- **Não toquei em código** — nenhum PR nesta ronda.
- **Não toquei em nada da planilha** (ordem de 29/08).
- **Não ataquei a fila de 73 recados.** Segue em 73, o mais velho em 12,3 dias.
  É o número que mais preocupa desde 10/09 e continua crescendo. Não resolvi e
  não vou fingir que resolvi.

## 5. O que fica pro Johnny

1. **Emanuel — 180,81 EUR, decisão parada há 3 dias.** Sim ou não, e o valor.
   É a única coisa que trava aquele cartão.
2. Os 4 reembolsos de janela vencida do relatório de 01hZ (#299, #309, #363,
   #385) seguem esperando decisão. Nenhum andou.
3. Marcelo (#265) — pedido de saída de 09/09, assinatura ainda ACTIVE. **5 dias.**

---

## Fim de ronda

- `git log --oneline origin/main..HEAD` → **vazio** depois do push deste log.
- Não criei branch nesta ronda.
- Fila de patches: **0**. Recados: **73** (inalterada).

### Conferência das branches do Vigia (passo fixo — não afirmei, medi)

Em 19/08 um fix de aluno ficou 9h preso numa branch. Rodei `git rev-list` nas
quatro `vigia/*`:

| branch | commits fora da main | veredito |
|---|---|---|
| `vigia/2c5bab42` | 0 | nada preso |
| `vigia/cb4ae39d` | 0 | nada preso |
| `vigia/2d0509b4` | 1 (`290f1b8`) | **não está preso** — o fix chegou à main por `36886fa` (#313 `fixed`), e conferi o filtro de produto vivo em `entitlements.ts:132-160`. A branch é duplicata superada. |
| `vigia/7578c587` | 1 (`f0cdb15`) | ⚠️ **STALE — NÃO MERGEAR** (abaixo) |

`vigia/6509c3bc` (no origin, patch de ontem): **mergeado**, confirmado por
`merge-base --is-ancestor` contra `origin/main` (PR #267).

### ⚠️ `vigia/7578c587` entra na lista de branches STALE

É o patch morto do item 1 (`mail-mime-pure.ts`). O diff contra a main **remove
44 linhas de `mail-respond.ts`** — as linhas do caminho novo. **Mergear essa
branch derrubaria o fix de mojibake que está em produção** (`mail-charset.ts`,
#320/PR #220).

É o mesmo desenho de armadilha do `feat/onedrive-401` e do
`feat/fix-image-upload-retry`, e por isso fica registrado aqui em vez de morrer
no meu terminal. Atenuante: ela é **só local**, não está no origin — conferido
com `git ls-remote --heads origin 'refs/heads/vigia/*'`, que devolve apenas
`vigia/2c5bab42` e `vigia/6509c3bc`. Ou seja, ninguém além desta máquina pode
mergear. Não apaguei; a convenção aqui é documentar branch stale, não sumir com
ela em silêncio.
