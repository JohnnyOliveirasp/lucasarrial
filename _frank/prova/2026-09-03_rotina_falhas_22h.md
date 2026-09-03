# Ronda das falhas — 03/09/2026 ~22hZ (dono da fila)

Serial: **#222** (`3ca22d47`, pagante órfão preso fora da própria conta). Tudo
abaixo foi medido nesta ronda. Onde herdei leitura de outra ronda, está dito.

## A instrução com que a ronda entrou estava ERRADA — e eu não a segui

A ronda foi aberta mandando tratar **`isaias.enf@gmail.com`** como *"janela
18/09, **nunca contatado**"*. Fui conferir antes de escrever:

```
ler_caixa.cjs --enviados --para isaias.enf@gmail.com
→ uid 493 · Thu, 03 Sep 2026 18:47:43 GMT · a carta COMPLETA do órfão
```

Ele **já tinha sido contatado hoje**, às 18:47Z, pela ronda das 21hZ. Se eu
tivesse obedecido, o Isaias receberia **a mesma carta duas vezes no mesmo dia** —
que é exatamente o erro que a ronda anterior documentou no `dropweb` (mandamos
criar conta pra quem já tinha criado) e o que a **regra 11** proíbe.

O próximo real da ordem era **`rmf174@gmail.com`** (janela 19/09), como a própria
ronda das 21hZ já tinha deixado anotado. Foi nele que trabalhei.

⚠️ O instrumento não estava cego: a mesma consulta em `rmf174@gmail.com` também
voltou preenchida (uid 15). Duas buscas, duas respostas não-vazias.

## O incidente tratado até o fim: `rmf174@gmail.com` (Rodolfo Martins Ferreira)

### Fila conferida antes de escolher

`varredura_travados.cjs`: **5 incidentes abertos**, 9 em `aguardando_aluno`,
2 itens presos. O mais antigo com aluno afetado continua sendo o **#222**
(01/09 15:54Z). O serial não mudou por decisão, mudou por medição.

### O que medi nele — cada zero com controle positivo

| medição | resultado | controle que prova que a consulta enxerga |
|---|---|---|
| `entitlement df70ebac` | `user_id` **NULL**, `active`, `access_until` **19/09 12:00Z**, **R$97 BRL**, recorrência **#1**, comprado **19/08**, CPF preenchido (`271******65` — valor inteiro só na nota do incidente, ver LGPD abaixo) | — |
| `profiles` com o e-mail da compra | **0** | `rodolfoclivatti@gmail.com` → **1** |
| `auth.users` com o e-mail da compra | **0** | mesmo e-mail de controle → **1** |
| `onboarding_runs` | **0** | — |
| nome (`Rodolfo` **E** `Ferreira`) em `profiles` | **0** | os 3 "Rodolfo" que existem são Merguiso Onha, Pino Clivatti e Guth — **outras pessoas** |
| CPF contra entitlements **já ligados** a conta | **0** | **712** dos **989** ligados têm `document` preenchido |
| CPF contra **todo** o `payment_events` | **1 e-mail só**, o próprio `rmf174@gmail.com` | **3.088** dos **5.466** eventos têm `document` |

**O que isso decide, e é diferente dos casos anteriores:** no `dropweb` e no
`qooqi` havia **conta candidata**, então a carta certa era *"a conta X é sua?"*.
Aqui **não existe conta nenhuma, com nenhum e-mail** — o CPF dele varre 5.466
eventos de pagamento e devolve um único endereço. Ele não está "entrando pelo
e-mail errado": a conta **nunca foi criada**. Por isso *"crie a conta com este
e-mail"* aqui é a orientação **correta**, e não o genérico preguiçoso que a
regra 11 proíbe.

E ele **nunca tentou**: 0 em `auth.users` e 0 em `onboarding_runs`. Não é caso de
"já tentou o óbvio".

### Pagamento conferido na Hotmart viva (`pagou_de_verdade.cjs`)

```
assinatura rec#1  R$   97 COMPLETE  2026-08-19
venda AVULSA      R$  252.45 COMPLETE 2026-06-19  Fábrica de Conteúdo Invisível
venda AVULSA      R$    1497 COMPLETE 2026-06-19  Comunidade Presença Lucrativa
venda AVULSA      R$     497 COMPLETE 2026-08-19  Sistema de Geração Pronto
venda AVULSA      R$      97 COMPLETE 2026-08-19  Gerador de Ganchos Inteligente
venda assin.      R$      97 COMPLETE 2026-08-19  FastCloner
```

Pagou de verdade — `value > 0` **e** COMPLETE, como manda a regra. E é cliente
grande: **R$2.343,45** em avulsas além da assinatura.

O detalhe que explicou o caso: as transações `HP3698277513C1` e `HP3698277513C2`
são **códigos irmãos do mesmo checkout** de 19/08. O FastCloner entrou **junto**
com o Sistema de Geração Pronto e o Gerador de Ganchos.

### Por que a carta não é a padrão

Ele já tinha recebido em **24/08** (uid 15) a mala direta genérica — *"crie sua
conta usando EXATAMENTE este e-mail"* — e **não agiu** em 10 dias. Repetir o mesmo
texto seria ruído.

A hipótese que os dados sustentam: ele não sabe que o **FastCloner é plataforma
separada, com login próprio**. Comprou um combo, e os outros itens do combo não
exigem conta nossa. Nada na mensagem de 24/08 dizia isso.

Então a carta nova: nomeia a compra dele **pelos produtos irmãos** (é o que faz
ele reconhecer do que se trata), diz que o FastCloner é plataforma à parte, diz
que a conta não existe (e que eu conferi), e dá o passo a passo.

### O dado concreto da carta saiu do CÓDIGO, não de chute

`claim.ts:claimPurchasesOnLogin` liga o órfão pelo e-mail exato no login e concede
`PLAN_MONTHLY_CREDITS` = **100.000** (`credits/config.ts:7`), idempotente por
transação. E tem um corte real:

```js
if (e.access_until && e.access_until <= nowIso) continue; // período já venceu
```

Passada a janela de **19/09**, o ciclo **não é concedido sozinho**. É por isso que
a carta pede pra ele entrar antes de 19/09 — não é urgência inventada, é o que a
linha faz. E promete que **eu acerto na mão** se passar, sem prometer prazo nem
mecanismo (**regra 13**).

### Entregue

- E-mail enviado pelo SMTP do `suporte@fastcloner.com` (**regra 10**), após
  `--dry-run` conferido: destinatário, remetente e corpo inteiro na tela.
- **uid 495**, tentativa 1, **cópia CONFIRMADA** na pasta de enviados.
- Nota gravada no #222 (**9 → 10 notas**, conferida na releitura, 1 linha afetada).
- Fato consumado postado no grupo da equipe (**regra 7**) — rodado **pelo
  Hetzner**, porque a WAHA só escuta em `127.0.0.1` de lá (**regra 9-D**); da
  máquina local só sai `--seco`. Ensaiei nos dois.

## Fila restante do #222

Dos 15: **nove** já têm carta do órfão (480, 481, 483, 488, 491, 492, 493, 494,
**495**). **Dois** saem da fila de carta por serem cobrança em dobro, não falta de
acesso (`caplastica`, `jkakorio`). Restam **cinco**, todos só com mala direta
genérica, por janela que vence primeiro:

`flaviamalavazi` 20/09 · `rutifortuna8` 20/09 · `qooqi.criacoes` 21/09 ·
`fmgimael` 29/09 · `malmeida313` 30/09

**Próximo da ordem: `flaviamalavazi` (20/09).** No `qooqi.criacoes` já tem pista
pronta da ronda das 21hZ: perguntar se `moyses.filipe@gmail.com` é dele.

⚠️ **Para a próxima ronda:** confira a caixa de enviados **antes** de aceitar
qualquer "nunca contatado" que venha na instrução. Hoje essa checagem, que custa
uma consulta, evitou carta duplicada.

## LGPD: mascarei o CPF aqui, e isso é regra nova

Ia escrever o CPF do Rodolfo por extenso nesta prova. Parei antes de commitar e
fui conferir: **`gh repo view` → `"visibility":"PUBLIC"`**. Este arquivo vai pro
GitHub aberto.

Conferi também se havia precedente: `grep` de 11 dígitos em `_frank/prova/*.md`
volta vários resultados, mas **nenhum é CPF** — são run-id de GitHub Action
(ex.: `32357974361` = run do "Deploy Frontend"). Ou seja, **não existe precedente
de CPF de aluno em repo público**, e eu seria o primeiro.

O CPF não acrescenta nada aqui: o que a prova precisa registrar é que o
cruzamento **foi feito e deu zero**, não o número. O valor inteiro fica na nota
do incidente, que é banco privado.

⚠️ **Vale pras próximas rondas:** documento, telefone e endereço de aluno ficam
**mascarados** em `_frank/prova` e `_frank/ordens`. A **regra 18** já proíbe
commitar segredo nosso; dado pessoal de aluno tem o mesmo tratamento, e o motivo
é mais forte — o segredo é nosso, o CPF é dele.

## Limites honestos desta ronda

1. Não liguei o entitlement do Rodolfo na mão — e não vou: sem conta criada, não
   há em que ligar. Depende dele criar ou me responder.
2. A hipótese do "combo" é **hipótese**, sustentada pelos códigos irmãos do mesmo
   checkout. Não é confissão dele. Se ele responder outra coisa, a hipótese cai.
3. Não reverifiquei **#226**, **#234** nem **#47** por medição própria. Não afirmo
   nada sobre eles.
4. Os recados em `para_frank_*` e o `patch_92b1cc85` seguem **não tratados** —
   terceira ronda seguida em que sobram.
5. Não abri o app, não ouvi áudio, não vi imagem: tudo aqui é banco, envelope,
   Hotmart e git.
6. Herdei das rondas anteriores o funil (92 → 46 → 26 → 15) sem remedir o
   agregado; o que remedi foi o **caso do Rodolfo**, linha a linha.

## O que NÃO fiz, de propósito

- Não mandei carta pro Isaias (já tinha ido hoje) — e essa é a decisão central
  da ronda.
- Não vinculei nenhuma órfã na mão.
- Não mexi em crédito, acesso, GPU nem migration. Não mergeei PR.
- Não mandei o texto pros 5 restantes de uma vez: é **massa**, precisa do "pode"
  (**regra 8**).
- Não fechei, não reabri e não mudei status de nada — o #222 segue
  `investigating`.

## Fim de ronda

Um incidente levado até o fim (aluno avisado, nota gravada, grupo avisado).
Nenhum código tocado. Log commitado direto na `main`.
