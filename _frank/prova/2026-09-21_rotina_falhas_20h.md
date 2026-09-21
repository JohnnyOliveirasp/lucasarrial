# Ronda das falhas — 21/09, ~19h30–20h15Z

Dono da fila: Frank. Metodo serial (regra 8 de 21/08).

---

## 1. Passos fixos da ronda

**Reconciliacao dos envios (passo fixo desde 18/09).** Rodada com
`--corte=2026-09-14T14:06:31Z --confirmar`.
962 cartas lidas na pasta remota "Sent" = 885 ja tinham linha + 77 fora da
janela (decisao do `--corte`) + **0 escrituraveis**. A contagem fecha
(962 = 962) e o veredito e **0 carta sem linha depois do corte**. Nada a fazer.
As 77 anteriores a 14/09 seguem sem decisao, como a ordem preve.

**Percepcao travada.** `percepcao_travada.cjs`, controle positivo OK (#310
reencontrado), 502 incidentes varridos: **7 cartoes**, o mais velho parado ha
**6,3 dias** (#406). Os tres mais velhos da fila geral (#214, #216, #226) estao
com nota do mesmo dia — ja foram mexidos nas rondas de hoje e aguardam decisao
humana registrada, nao estao em silencio.

---

## 2. O ACHADO DA RONDA: o cartao #446 deixou de ser contabil e virou caixa

Este e o item que importa desta ronda.

O `#446` (`vigia:estorno-rpc-ausente-webhook-500`) esta aberto desde **17/09**
esperando decisao do Johnny. Desde 18/09 ele vinha sendo **de-escalado — por mim
e pelo Vigia** — com a frase "consumo ZERO, o prejuizo e CONTABIL, nao caixa
escorrendo". **Essa frase deixou de ser verdade hoje.**

### A sequencia, toda medida, toda no dia 21/09

```
14:01:05Z  +100.000 cr   credit_transactions ref_type=payment_event ref_id=HP2319839714
17:18:18Z  PURCHASE_PROTEST da MESMA transacao HP2319839714 (R$97)
           -> payment_events.processed_at NULL, erro "Could not find the function
              public.zero_subscription_credits_on_refund(...)"
17:38:31Z  -1.960   generation
17:42:51Z  -550     studio_audio
17:46:28Z-17:46:57Z  20 x -1.800 studio_scene  (= 36.000)
17:48:25Z  entitlements.status -> 'chargeback', access_until NULL  (revokeAccess RODOU)
17:54:01Z  -1       studio_scene_improve   <-- gasto DEPOIS da revogacao
```

Total gasto **depois** do evento de dinheiro devolvido: **38.511 creditos em 23
lancamentos**. Saldo restante: 149.006.

### Por que isto e importante alem do valor

Eu vinha escrevendo, desde 17/09, que "revogar acesso NAO protege credito, porque
o portao do app e o SALDO e nao o acesso". Ate hoje isso era **leitura de
codigo**. Agora esta **medido em producao**: a porta fechou as 17:48:25Z e o
aluno seguiu gastando as 17:54:01Z. Acesso revogado e saldo intacto convivem, e
quem manda e o saldo.

### Alcance atualizado

6 eventos presos, **4 pessoas**, **589.102 creditos** (antes: 5 eventos, 3
pessoas, 440.096).

| quando | evento | pessoa | saldo | gasto pos-evento |
|---|---|---|---|---|
| 16/09 08:38Z | PROTEST | paula@handelhomes.com | 171.029 | 0 |
| 16/09 09:03Z | REFUNDED | paula@handelhomes.com | | |
| 17/09 14:18Z | REFUNDED | core@frentestudio.com.br | 169.067 | 0 |
| 17/09 15:00Z | CHARGEBACK | core@frentestudio.com.br | | |
| 18/09 19:23Z | REFUNDED | vazilg@gmail.com | 100.000 | 0 |
| **21/09 17:18Z** | **PROTEST** | **mkt.drrigatti@gmail.com** | **149.006** | **38.511** |

Os tres primeiros seguem com consumo zero — a de-escalada estava certa **para
eles**. O que estava errado era tratar *"ninguem gastou ainda"* como *"ninguem
vai gastar"*.

### Janela da regressao, fechada por medicao

Ultimo evento de dinheiro devolvido que processou limpo: `vazilg` PROTEST
**11/09 20:29:41Z**. Primeiro preso: `paula` **16/09 08:38:05Z**. Desde 16/09 e
**6 de 6, 100%**. Antes de 11/09 a regra 9 tambem nao tinha efeito (a funcao
nunca existiu), mas falhava em **silencio**; o que mudou em ~15-16/09 foi o
**chamador subir** (`refund.ts:33` lanca -> `route.ts:433` -> 500 ->
`processed_at` NULL e Hotmart reenviando).

Funcao conferida no **catalogo**, nao no log: `pg_proc` x `pg_namespace`,
`proname ilike '%zero_subscription%'` -> **0 linhas** (21/09 19h4xZ).
`scripts/111_estorno_zera_credito.sql` segue com o cabecalho "NAO APLICADA".

### Decisao (nao e minha) — postada no grupo como urgente

1. Aplicar a `scripts/111`? (para de sangrar + libera reprocessar os 6 eventos)
2. Zerar os 589.102 ja acumulados? (retirada de credito de aluno)

E a pergunta que o Vigia levantou em 18/09 e ninguem respondeu: a REGRA FINAL DE
CREDITO de 20/08 diz *"parou de pagar, usa os que tem ate acabar"*. Estorno e
chargeback contam como isso? **Quem aplicar a migration responde isso em
silencio.** Hoje o custo de nao responder ficou visivel.

**NAO apliquei DDL, NAO zerei credito de ninguem, NAO reprocessei evento.**

---

## 3. Serial: #479 (Marlon) — conferido ate o fim e devolvido pra investigating

O `garantia_na_fila.cjs` acusou o Marlon no bloco "VENCE EM ATE 48H" (restavam
28,3h). O cartao estava **fixed** desde 19/09 com a premissa "pedido feito pelo
proprio aluno na Hotmart, automatico" — desfecho **afirmado sem ter sido
conferido**. Fui conferir.

**Hotmart viva, consultada por `transaction` (nao por `buyer_email`):**
`HP2093753501` · R$597 · PIX · SGP (7283229) · `is_subscription=false` ·
garantia ate 23/09 00:00Z · **status = PROTESTED**. Ou seja: pedido de devolucao
**registrado**, dinheiro **ainda nao devolvido**.

**A garantia fechando NAO o prejudica — medido, nao suposto.** As 2 transacoes
da Evelyn (`HP2585148563` R$672 e `HP3361171770` R$252,45) estavam PROTESTED com
garantia vencida em **14/09** e hoje, 21/09, estao **REFUNDED**. E a sequencia
PROTEST -> REFUNDED aparece em 6 casos nossos, de **25 minutos a 7 dias**.
Pedido aberto dentro da janela sobrevive ao fim da janela.

⚠️ **Alarme falso, e o instrumento vai repetir.** O `garantia_na_fila.cjs`
compara **datas** e nao olha o status da transacao na Hotmart, entao acusa como
"vai perder a janela" quem **ja tem devolucao em andamento**. E a familia da
armadilha do estorno conferido por `kind` em vez de `ref_type` ("quase pagamos
em dobro pra 13 alunos"): **quem agir so pelo bloco de 48h pode pagar duas
vezes**. Antes de agir num nome que ele acusa, conferir o status na Hotmart viva.

**O que descobri e nao e culpa dele:** pagou 16/09 07:17Z, recebeu boas-vindas
07:17:46Z, pediu codigo **duas vezes** na mesma manha (07:20:30Z e 08:03:38Z) e
o `last_sign_in_at` dele e **19/09 13:41:39Z**. Ficou **3 dias e 6 horas** sem
conseguir entrar no que pagou; quando entrou, pediu cancelamento **3 minutos
depois**. A desistencia tem causa nossa.

**Feito:** carta enviada (uid **3133** na pasta Enviados) dizendo que o pedido
esta registrado e em andamento, que o prazo de 22/09 nao o prejudica mais, que o
dinheiro ainda nao caiu e que isso e normal nesta fase, e assumindo os 3 dias de
porta fechada. Cartao **fixed -> investigating**: fecha quando `HP2093753501`
virar REFUNDED.

---

## 4. Dois compradores do SGP sem acesso — e um erro meu no meio

`boas_vindas_sgp_nao_saiu.cjs` (controle positivo 2/2 OK) acusou 2 compradores
cujo e-mail de boas-vindas **falhou na saida**:

- **marcio.laosa@trialseguros.com.br** · HP0040311395 · **R$597** · pago
  12/09 21:24:56Z · causa **"SMTP timeout"**
- **amanda.rosaleal@gmail.com** · HP1053950724 · **R$633,81** · pago
  13/09 13:55:18Z · causa **"read ECONNRESET"**

Mandei pros dois uma carta de reparo com link de primeiro acesso no formato
`token_hash` (o que aponta pro `/auth/callback`, **nao** o `action_link` do
Supabase, que queima o token e cai em erro). Enviadas e confirmadas na pasta
Enviados: **uid 3134** (Marcio) e **uid 3135** (Amanda).

### ⚠️ E entao eu errei, e o erro foi pra caixa de uma aluna

A carta da Amanda afirmava que ela "nunca recebeu nada" e ficou "8 dias sem
noticia". **As duas coisas sao falsas.** Conferindo a pasta Enviados **depois**
de mandar, achei:

```
uid 2098 · 13/09 14:24:52Z · "107044 e o seu codigo do Sistema de Geracao Pronto"
uid 2102 · 13/09 15:32:18Z · "Corrigido - pode clicar em Continuar, voce estava certa"
uid 2146 · 13/09 22:26:20Z · "Faltou eu te contar das 5 caixinhas..."
```

Ela foi atendida **no mesmo dia da compra, tres vezes, por gente de verdade**. E
o pedido dela andou: `sgp_pedidos 86add20a`, status **'audio'**, **6 fotos**, 0
audios, ultima mexida 14/09 11:12Z.

**De onde veio o erro (importa mais que o erro).** O detector imprime
`login=NUNCA`, e eu li isso como "nunca teve contato". Para comprador de SGP
essa leitura e **errada**: `login` ali e o `last_sign_in_at` do **aplicativo**, e
o SGP tem **outra porta** — o portal do pedido, que entra por **codigo no
e-mail**, sem login no app. Por isso a Amanda tem `last_sign_in_at` NULL **e**
6 fotos enviadas ao mesmo tempo. O detector mede *"o e-mail automatico falhou no
SMTP"* e **so isso**; eu transformei em *"a pessoa ficou sem contato"*.

**Consertado:** correcao enviada na hora (uid **3136**), assumindo o erro, mandando
ignorar o link do app (que nao e o bloqueio dela) e dizendo o que e verdade — o
pedido esta parado na etapa do **audio**, com as 6 fotos salvas.

**Regra que passo a seguir:** antes de escrever a um aluno **qualquer** frase
sobre silencio ou abandono, rodar `2026-09-21_cartas_para_o_aluno.cjs <email>` e
olhar o que ja foi dito. A propria saida do `aluno.cjs` avisa isso em caixa alta
e eu passei por cima do aviso.

### O Marcio se sustenta, e e o caso grave

Conferido **depois**, pelo mesmo instrumento: **1 carta no total**, a minha de
hoje. Pagou **R$597** em 12/09, `last_sign_in_at` NULL, `pedido_sgp=0`, **ZERO
cartoes em `incidents`** e **zero cartas** antes de hoje. Ficou **9 dias no
vacuo** e **nao existia em fila nenhuma** — se eu nao tivesse rodado o detector,
ninguem o acharia.
⚠️ Risco especifico: dominio corporativo (`trialseguros.com.br`). Se for
Microsoft, o **Safe Links faz prefetch e queima** o link de uso unico antes do
clique — armadilha que o proprio `link_de_primeiro_acesso.cjs` documenta. Por
isso a carta dele leva dois caminhos alternativos ("Esqueci minha senha" e
responder o e-mail).

---

## 5. O que NAO foi feito, declarado

- **Nao apliquei** `scripts/111` nem nenhuma DDL (regra 21).
- **Nao zerei** credito de ninguem (regra 9-A).
- **Nao reprocessei** os 6 eventos presos (so faz sentido depois da DDL).
- **Nao afirmo** que Marcio ou Amanda entraram: afirmo que as cartas sairam e
  estao na pasta de enviados. `last_sign_in_at` dos dois era NULL as 19h5xZ.
- Os 3 cartoes mais velhos da fila (#214, #216, #226) **nao avancaram nesta
  ronda** — estao em decisao humana ja registrada, nao em silencio novo.
