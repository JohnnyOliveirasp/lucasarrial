# 17/09 ~01hZ — Relatório noturno do dia 16/09 (consolidado)

Ronda noturna. Varredura rodada do zero (`varredura_travados.cjs`, saída inteira
em `/tmp/varredura_1609.txt`), patch do Vigia revisado e mergeado, fila de
recados limpa, números conferidos no banco. Mensagem do dia postada **no grupo**
(ordem de canal de 31/08).

---

## 1. O que eu resolvi nesta ronda

### 1.1 O aviso interno da casa não chega em ninguém — e agora eu sei por quê

O cartão `#305/e8885d03` estava **ininvestigável**: 19 de 19 avisos de compra
órfã saíram sem o canal `email`, e ninguém sabia se era env ausente, recusa do
provedor ou exceção de rede — porque as três saídas do `sendEmail` eram mudas.

**O que eu fiz, na ordem:**

1. **Revisei o patch do Vigia** (`patch_e8885d03`, PR #319). Ele importava
   `emailConfigured()` de `resend.ts` **sem adicionar a função no diff** — se ela
   não existisse, o `tsc` verde dele seria mentira. Conferi na fonte: já existe,
   `resend.ts:21`. Patch coerente.
2. **Rodei as MINHAS verificações do zero**, em worktree isolado (a árvore tinha
   2 arquivos modificados que não são meus): `npx tsc --noEmit` → **0 erros**;
   `npx eslint` nos 2 arquivos → **limpo**. Não confiei no que ele reportou.
3. **Mergeei** (`0863bb90`) e **apaguei a chave** `patch_e8885d03` com `DELETE`
   (não com `set_state` null — a coluna é NOT NULL e o update volta `23502`
   deixando a chave no lugar).
4. **Provei o deploy pelas 3 provas da regra 5-B, não pela Action verde:**

| prova | valor |
|---|---|
| md5 do fonte no servidor | `dc37b775…` (resend.ts) · `bf9d06de…` (route.ts) |
| md5 do commit `0863bb90` | **idêntico aos dois** |
| `BUILD_ID` | `31fNJdq4pDhJIQlOkUHHg`, compilado **17/09 01:07:46Z** (merge foi 01:05Z) |
| pm2 `aiverse` | `online`, recém-reiniciado |

5. **Perguntei à produção** com o instrumento novo
   (`_Bugs/e8885d03/perguntar_notify.cjs`):

```
{"ok":true,"email":false,"email_configured":true}
```

**Isso REFUTA a hipótese principal do Vigia** (perna Resend morta por env
ausente). O env está lá. Quem recusa é o Resend — e o motivo agora aparece no
log, porque o patch passou a escrevê-lo:

```
[resend] envio RECUSADO: HTTP 403 — corpo={"statusCode":403,
"message":"The fastcloner.com domain is not verified.
Please, add and verify your domain on https://resend.com/domains"}
```

**Alcance:** é o choke point dos **13 chamadores de aviso interno**. Explica os
19 avisos de compra órfã, e explica que **todo `notify` do Vigia pro Johnny desde
03/09 devolveu `ok:true` e não chegou em ninguém**. O canal por onde o Vigia
avisa estava morto, e a resposta dizia que estava vivo.

⚠️ **Aluno NÃO é afetado:** e-mail de aluno anda por SMTP (`sendSupportMail`),
comprovadamente vivo. Quem estava cego é a equipe.

**Não fechei o cartão** (regra 14): a causa está provada, a entrega não está
consertada. O conserto é decisão do Johnny — vai como pergunta binária.

### 1.2 A fila de recados: 105 → 80, com conferência caso a caso

A fila vinha **piorando sozinha** (64 em 10/09 → 96 em 15/09 → **105** hoje).
Medi a causa em vez de só repetir o número: **25 recados apontavam para
incidente já FECHADO** — trabalho já feito que voltava em toda ronda e escondia
o que dava pra resolver (a armadilha do "registro velho entope a fila").

Antes de apagar (regra 19), **preservei o conteúdo inteiro no repo**:
`_frank/prova/2026-09-17_recados_mortos_apagados.json` (42 KB, 25 recados com
recado, incidente e nota de resolução).

E **não confiei no status**: 2 desses recados eram de **cancelamento de
assinatura** fechados **sem nota de resolução** — se o fechamento fosse falso, a
aluna continuaria sendo cobrada. Conferi os dois na Hotmart viva (ensaio, nada
executado):

| aluno | Hotmart | crédito preservado |
|---|---|---|
| `luizreis.despertar@` | `CANCELLED_BY_SELLER` | 59.775 cr até 19/09 |
| `elianecaurim@ig.com.br` | `CANCELLED_BY_SELLER` | 300.000 cr até 08/10 |

Os dois cancelados de verdade, e os dois **mantendo o crédito pago** — regra 9
respeitada. Fechamentos honestos. Só então apaguei.

**Restam 80**, o mais antigo de 315h (13d) — esse é trabalho real, não entulho.

### 1.3 Os 3 "pagou e não tem conta" NÃO são abandono

Os recados mais velhos da fila assustam: *"Compra paga SEM conta na plataforma"*,
parados há 10–12 dias. Confirmei que os três **continuam sem perfil** no banco.

Mas fui atrás antes de chamar de negligência, e a casa **convidou cada um duas
vezes** (`orphan_invites`):

| aluno | 1º convite | lembrete |
|---|---|---|
| `neto_rocha@hotmail.com` | 28/08 | 01/09 |
| `caplastica@hotmail.com` | 04/08 | 07/08 |
| `herysilva.27@gmail.com` | 08/09 | 12/09 |

Convite entregue por SMTP (vivo). Eles não criaram a conta. É estado conhecido,
não fila esquecida.

⚠️ **Mas isso expõe um ponto cego real:** o `pagante_trancado.cjs` reportou
**"0 pagantes trancados"** — e ele só enxerga quem **existe em `profiles`**. Quem
pagou e nunca criou conta é invisível pra ele **por construção**. O "0" dele é
verdadeiro e incompleto ao mesmo tempo. É a mesma classe do cartão #312.

---

## 2. Armadilhas que pegaram de novo nesta ronda

1. **Quase acusei o Vigia de inventar medição.** Ele cita `orphan_alerts` e
   `orphan_invites`; procurei no `information_schema` e voltou **vazio** nas
   duas. Rodei a contraprova da regra 5-B (procurar algo que EU SEI que existe:
   `incidents`/`profiles` → apareceram), então o instrumento enxergava. Só que
   **não são tabelas: são chaves do `agent_state`**
   (`aviso-orfao-canal.ts:30`). A medição dele estava certa; **a minha pergunta
   é que estava errada.** Se eu tivesse reportado, teria sido acusação falsa.
2. **`trial_expiry` devolve `ok:false` no sweep e NÃO é sweep quebrado** — é a
   desativação deliberada de 18/08 ("detecção de pagante errada, zerou 14
   pagantes"). Ler como falha teria virado alarme falso.

---

## 3. O que subiu pra produção

- **`0863bb90`** (PR #319) — avisos internos param de falhar calados: o `resend`
  loga o motivo da recusa e o `notify` devolve se o e-mail saiu.
  **No ar, provado:** `BUILD_ID 31fNJdq4pDhJIQlOkUHHg`, 17/09 01:07:46Z.
- **No dia 16/09:** 11 PRs mergeados (#304, #305, #306, #308, #310, #311, #312,
  #313, #314, #315, #318) e **14 incidentes fechados**.

---

## 4. Estado geral (medido nesta ronda)

| número | agora | ontem | leitura |
|---|---|---|---|
| incidentes abertos | **87** | 84 | 16 nasceram no dia, 14 fecharam |
| aguardando aluno | **26** | 24 | 7+ parados há 7d+ pedem 2ª tentativa |
| recados na fila | **80** | 96 | **melhorou**: −25 entulho, mas entram ~6–13/dia |
| itens presos na varredura | **0** | 1 | 1 de escrituração (`training_jobs ebf5cc56`, voz já `ready`), ninguém esperando |
| pagante trancado | **0** | 0 | ⚠️ cego pra quem pagou e nunca criou conta |
| lista de estorno | em dia | em dia | 10 tipos, 3.326 linhas, nenhum tipo desconhecido |
| sweeps | vivos | — | `errors: 0` em todas as pernas |
| GPU | ok | — | Vídeo Clone com `throttled=3` (datacenter sem GPU livre, nada a fazer no código) |

### 4-B. O número grande do dia: crédito de quem nunca pagou

`backlog_trial.cjs` (só leitura, com controle próprio: 7.525 eventos lidos):

- **118 pessoas já passaram do dia 10 e continuam com o crédito: 8.930.125 cr.**
  O mais antigo venceu em **31/07**.
- Somando quem ainda não venceu: **146 pessoas, 10.930.793 cr**.
- Cancelamentos de 16/09: 5 pessoas, sendo **1 pagante de verdade**
  (`portalenfermagemquantica@`, R$97 aprovado no dia — mantém tudo, regra 9) e
  **4 que cancelaram no trial sem nunca pagar** (317.021 cr somados).

⚠️ **Eu não toquei em nada disso, e não vou tocar**: retirar/zerar crédito é
**sempre** decisão do Johnny, em qualquer valor (regra 9-A).

⚠️ **E tem um detonador escondido:** a ferramenta reporta
**`allowlist da equipe (bypasses_billing): 0`**. A allowlist está **vazia**. Foi
exatamente essa a causa do desastre de 18/08, quando a varredura zerou 14
pagantes — **inclusive a conta do Lucas**. Religar a varredura hoje, do jeito que
está, repetiria o acidente. A regra 9-A é explícita: *"a allowlist da equipe tem
que estar dentro do SQL"*.

---

## 5. O que eu NÃO fiz, de propósito

- **Não zerei um único crédito** — regra 9-A, sem exceção de valor.
- **Não religuei a varredura de trial** — a allowlist vazia faria dela a mesma
  arma de 18/08.
- **Não troquei o transporte do aviso interno pra SMTP** por conta própria:
  conserta em ~1 linha, mas contraria o desenho escrito em `02_ACESSOS.md`
  (Resend = aviso interno) e mexe em produção fora do fluxo normal.
- **Não fechei o `#305`** — causa provada não é entrega consertada (regra 14).
- **Não mandei e-mail pros 3 sem conta** — já foram convidados 2× cada; insistir
  uma 3ª vez sem fato novo é ruído.
