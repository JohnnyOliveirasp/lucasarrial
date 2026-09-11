# Ronda das falhas — 11/09/2026, 16h52Z (13h52 BRT)

Frank, dono da fila. Método serial (regra 8): peguei **um** card e levei até onde
ele dá pra levar hoje.

**Card da ronda: `#350` `3a9a4854`** — *a casa só olha a garantia quando vai
responder, nunca enquanto o pedido espera na fila.*

## Por que este card, e não o mais antigo

Os cinco mais antigos seguem travados em palavra do Johnny — conferi o estado de
cada um nesta ronda, não herdei a conclusão da ronda das 15h:

| card | idade | onde emperra |
|---|---|---|
| `#313` `2d0509b4` | 94d | 12 pessoas **ganhando** plataforma de graça — a casa é que sangra, não o aluno |
| `#15` `d3d8d1b2` | 43d | zero ocorrência sob a régua nova; relógio dos 30 dias limpos corre desde 10/09 |
| `#47` `ce6e157d` | 23d | repor `tts_silence_ms` contraria ordem vigente ⇒ palavra do Johnny |
| `#99` `6c38c99d` | 18d | decisão comercial Johnny/Lucas |
| `#223` `506b7c3a` | 10d | decisão do Johnny sobre a Alana |

O `#350` é o mais antigo onde **a bola é nossa**, e é o único da fila onde havia
**dinheiro de aluno com relógio virando dentro das próximas 7 horas**. A regra 8
manda romper o serial justamente quando há dinheiro errado correndo agora.

## O que era

`janelaGarantia()` (`garantia.ts`) tem **um único chamador** em produção:
`account.ts:174`, dentro de `linhaGarantiaHotmart()`. Esse caminho só roda quando
a Fast vai **montar uma resposta** para o aluno.

Ou seja: a casa só olhava a garantia no instante em que falava com a pessoa —
**nunca enquanto o pedido dela estava parado esperando atendimento**. O relógio
corria dentro da fila e ninguém via. Ninguém decidiu negar prazo a aluno nenhum;
faltava instrumento. É a mesma forma do `detector_preso_fora_da_conta.cjs`: a
classe não some porque alguém promete olhar, some quando vira medição que roda
toda ronda.

## O que fiz

`_frank/ferramentas/garantia_na_fila.cjs` — **PR #239**, branch
`feat/garantia-na-fila`. **Ainda NÃO mergeado**, então **não está em produção**, e
por isso o card **continua `investigating`**.

Avalia a **mesma função de produção em dois instantes**: `first_seen_at` do
incidente (estava dentro **quando pediu**?) e agora (está dentro **hoje**?).
Dentro-depois-fora é dívida da fila. Só lê: não estorna, não escreve no banco,
não manda e-mail.

Três guardas, cada uma paga com erro já cometido nesta casa:

- **Consome `garantia.ts` por jiti e aborta se o export sumir.** Não copiei a
  regra — foi a CÓPIA da regra de MIME que criou o vão do `#351`.
- **Controle positivo que ABORTA se zerar.** Obrigada a reencontrar Victor e
  Lucila antes de afirmar qualquer coisa. "Zero" de instrumento cego foi o que
  fez a casa reportar *"pagante sem acesso: zero"* em 07/09.
- **Separa, SEM decidir, a perna da renovação** (os 54 do `#265`). Rotular ≠ decidir.

## O instrumento corrigiu o próprio card, nas duas direções

Medido 11/09 16:47Z, não herdado. O `#350` dizia *"Alana, Lucila, Victor"*.

**Tirou quem não era.** `alana_pinho@hotmail.com` **não tem nenhuma compra paga**
— o único `PURCHASE_APPROVED` dela é `value = 0` (adesão R$0). `janelaGarantia`
devolve `null` → ESCALAR. **Não havia janela porque não havia dinheiro.** O título
do card afirma "Alana venceu 08/09" e está errado; o caso dela é promessa escrita
(`#223`), não garantia.

**Achou 3 pessoas que ninguém sabia que existiam:**

### 🩸 Perderam a janela dentro da nossa fila (pediram dentro, hoje estão fora)

| pessoa | pago | pediu | janela | virou há |
|---|---|---|---|---|
| `victor.inscriptio@` | **R$397** | 08/09 (`#309`) | 11/09 00:00Z | **16,8h** |
| `contatoecocannabis@` (Lucila) | **R$291** | 07/09 (`#299`) | 10/09 00:00Z | **40,8h** |
| `atendimento@dropweb.com.br` | **R$610,88** | 06/09 (`#282`) | 09/09 00:00Z | **64,8h** |

O **Dropweb não estava em card nenhum desta classe.** Pagou R$97 (assinatura) +
R$397 (SGP) + R$116,88 (Gerador de Ganchos) em 02/09; conta hoje ativa até 02/10,
100.000 créditos e **zero vozes**.

**O R$291 da Lucila confere, e é por DUAS contas** — `blancolucila539@` pagou
R$97 (30/07) + R$97 (23/08), `contatoecocannabis@` pagou R$97 (03/09). Só a
última estava dentro da janela; as outras duas já tinham vencido quando ela pediu.
A reclamação dela nunca foi inflada.

### 🔴 Vencendo

- **`marcelopersonalthe32@`** — perna da **renovação**: produção ancora na 1ª
  compra (janela fechou 19/08), mas a cobrança de R$97 de **05/09** tem
  `warranty_date` **12/09 00:00Z** — fecha em ~7h. Ele pediu saída em 09/09,
  dentro dessa janela, e o pedido foi **engolido pelo defeito do `#337`**.
- **`leandro@aeroclubejf.com.br`** — janela até 12/09 00:00Z (~7h).
- **`rodrigo.limas.1978@`** — janela até 13/09 00:00Z (~31h), `#306`.

## Duas coisas que eu ia repetir errado, e não repeti

**1. O Leandro NÃO foi cobrado em dobro.** A varredura o trouxe pelo `#254`
("cobrança em dobro"), mas ele tem **uma** cobrança paga (R$97 APPROVED 05/09);
as `rec#2`/`rec#3` estão **OVERDUE**, e OVERDUE **não é pagamento** — a armadilha
exata do `#138`. Se eu tivesse levado o rótulo do card ao Johnny, teria pedido
autorização pra devolver dinheiro que nunca entrou.

**2. Não escrevi pra ninguém hoje, de propósito.** Conferi a pasta Enviados
**antes** de redigir: Marcelo já recebeu o aviso do prazo de hoje (**uid 1715**,
11/09 10:47Z) e o Leandro também (**uid 1698**, 11/09 00:44Z, com a hora certa,
21h). Marcelo levou **3 e-mails em 2 dias**. Um quarto hoje seria ruído, não
cuidado. **0 e-mails enviados nesta ronda** — e isso é a decisão certa, não
omissão.

## Armadilha nova, plantada por nós, anotada antes de explodir

O e-mail **uid 1719** (hoje 11:26Z) promete ao Marcelo: *"os seus 47 minutos de
áudio continuam guardados e intactos… eu mando treinar a sua voz de novo por conta
da casa… é só responder 'pode treinar'"*.

Só que a `resolution_note` do `#65` já registra a medição que diz o contrário: o
retreino **já foi feito** e a F0 provou que o arquivo **não produz a voz dele** —
saiu 197,5Hz mediana, 91,6% em faixa feminina, porque **há 2 locutores** (o `#128`
descreve o mesmo arquivo como gravação de entrevista). O arquivo é um só:
`000_Avaliacao_e_reabilitacao_apos_AVC_isquemico_(1).mp3`, 47min05s.

Se ele responder *"pode treinar"* e alguém obedecer o e-mail ao pé da letra, a
casa queima GPU pra entregar **pela segunda vez** uma voz feminina que não é a
dele — terceira decepção do mesmo aluno, agora causada por promessa nossa.

⚠️ **O `listar_arquivos_da_voz.cjs` não enxerga isso**: carimbou *"✅ PORTÃO DE
20min: passa com 27min05s de folga"*. O portão mede **duração**, não **quantos
locutores** tem dentro. Anotado no `#65` (nota 24) pra quem pegar a resposta dele.

## Também anotei: `#265` estava com conserto no ar e ficha em branco

O `#265` estava `investigating` **sem nenhuma `resolution_note`** — enquanto a
perna de código dele **está em produção há 6 dias**: commit `ed0f266` na main
(conferido hoje com `git log origin/main`, não em relatório herdado). A constante
de 7 dias saiu; `janelaGarantia` lê `warranty_date`, que vem pronto nas **694**
compras pagas (6d→648, 7d→17, 14d→24, 15d→3, 30d→1).

Sobra a **perna 2**: *renovação reabre a garantia?* É **política de dinheiro**,
não conta — 54 dos 57 dependem só dela. Segue com o Johnny. Anotei as duas pernas
(nota 14) pra parar de ser trabalho invisível.

## Escalado ao Johnny — no grupo, na hora

Postei no grupo às ~16h50Z, marcado urgente, com valor e prazo de cada um, porque
**é dinheiro e não é minha alçada**: honrar os 4 reembolsos de quem pediu
**dentro** e viu o prazo virar **na nossa fila**?

**Minha recomendação, registrada: sim.** O atraso foi nosso, não deles. O do
Marcelo é o único com hora marcada (~7h).

**Não prometi nada a nenhum aluno.**

## Números da ronda

- **72 incidentes** em `open`/`investigating` — **72 → 72. Nenhum fechado, e não
  vou maquiar isso.** O que entreguei foi o instrumento que faltava (PR #239) e
  a medição que destrava a decisão; fechar exige merge + a palavra do Johnny +
  escrever pros alunos. Marcar `fixed` hoje seria mentira (regra 14).
- **5 ocorrências / 3 pessoas** perderam a janela dentro da fila · **2** vencem
  em 48h · **1** na perna da renovação. **3 dessas pessoas eram desconhecidas**;
  **1 que constava não tinha compra paga**.
- **1 PR aberto** (#239) · **3 incidentes anotados** (`#350`, `#265`, `#65`).
- **0 e-mails** (decisão medida, ver acima) · **0 GPU, 0 crédito, 0 visão paga.**
  Não toquei em voz, saldo, acesso, assinatura nem migration.
- 🧹 Higiene, **inalterada**: seguem **10 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais não rastreados em
  `_frank/rascunhos/`. **Décima quinta ronda seguida.** Não são meus, **não
  toquei**. Meus scripts de investigação ficaram em `/tmp/frank/`, fora do git.

## O que a próxima ronda pega

1. **Resposta do Johnny sobre os 4 reembolsos.** Se vier "pode", executar e
   escrever pros 4 — os valores e datas já estão apurados na nota do `#350`.
2. **Merge do PR #239** e rodar `garantia_na_fila.cjs` **toda ronda** — é o único
   jeito de a classe não voltar.
3. **Se o Marcelo responder "pode treinar"**: não retreinar o arquivo de 47min.
   Ver nota 24 do `#65`.
