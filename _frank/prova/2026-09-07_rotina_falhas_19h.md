# Ronda das falhas — 07/09, ~19h40–19h55Z (16h40 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only`, já estava em dia) e
`_frank/ordens/README.md` lido antes de tocar em qualquer coisa. Nada da
planilha foi lido, classificado, aberto ou reaberto (ordem de 29/08). Canal:
ordem de 31/08 — avisos no **GRUPO**, nada no privado. Turno 16h40 BRT,
**dentro** da janela 08h–23h.

---

## 0. A ronda em duas linhas

**Não fechei incidente nesta ronda, e digo isso primeiro porque o placar não
mudou: 32 abertos na entrada, 32 na saída.** O que a ronda produziu foram três
coisas que valem mais que um fechamento de fila: matei uma hipótese que ia
custar dinheiro e ia ser confirmada por um par de controle enganoso; cumpri uma
verificação de DINHEIRO que estava marcada para "a próxima ronda" desde 06/09 e
que ninguém tinha feito; e descobri, de raspão, que uma decisão parada há 3 dias
está provavelmente segurando 8 assinantes pagantes fora do produto.

---

## 1. Serial: por que estes, e por que nenhum fechou

Varredura: **32 abertos**, 12 aguardando aluno, 4 presos, 0 fechado sem retorno.

Subi a fila do mais antigo. Os quatro primeiros continuam **presos em decisão do
Johnny** e eu não repeti a conferência da ronda anterior sem motivo — reli o
#222 inteiro (33 notas) para checar se "preso em decisão" ainda era verdade ou
se era herança preguiçosa. Ainda é verdade: a nota 33 recomenda REENQUADRAR ou
FECHAR e o passo que emperra é decisão, não investigação.

- **#15** (39d) — migration 82, decisão.
- **#222** (6d) — reenquadrar ou fechar, decisão. Reconferido hoje.
- **#226** (6d) — cobrar ou estornar, decisão de dinheiro.
- **#234** (5d) — parte técnica não está presa. Foi onde eu comecei.

O primeiro NÃO-preso era o **#234**, que a ronda das 18h40 deixou com um passo
seguinte cravado. Peguei ele.

## 2. #234 — hipótese nova, testada de graça, **REFUTADA**

### 2.1 Não fiz o que estava mandado, e explico

A nota das 18h40 mandava medir a referência das duas vozes do par de controle
com `medir_ritmo_das_vozes.cjs` + `medir_velocidade_voz.cjs` (whisper,
~R$0,10/voz). **Não paguei.** A própria nota anterior já tinha refutado
velocidade ("não é monótona": a pior voz tem 4,32 wps, mas vozes de 3,78 e 3,56
estão em 4,3% e 0,0%). Pagar whisper para remedir a variável que a ronda
anterior já descartou é queimar dinheiro para confirmar um "não".

### 2.2 A hipótese que eu troquei no lugar

O VoxCPM gera em modo *"continue este áudio"*. Está **provado** que ele copia o
NÍVEL da referência (caso Pepe) e que continua o TEXTO da referência (caso
Negrini `#124`). Se copia nível e texto, ninguém tinha perguntado se copia a
**forma de terminar** — uma referência que acaba com a voz ainda alta ensinaria
a voz a fechar todo chunk assim, que é exatamente o defeito do card e exatamente
o motivo de ele se concentrar POR VOZ.

Custo: **zero**. Script `_Bugs/2026-09-07_cauda_da_referencia.cjs` (uso único,
fora do git) baixa `ref/auto.wav` e aplica ao fim do arquivo a **mesma régua** do
`cauda_decepada.cjs`, calibrada nos 3 arquivos que o Johnny classificou à mão.

**Armadilha que tive que corrigir no meio:** `plato_db` cru não compara vozes —
cada referência tem volume diferente (LUFS de −14,9 a −33,6 nesta população) e
uma ref alta "termina alto" só por ser alta. A régua honesta é `plato_db − LUFS`.

### 2.3 O par de controle sustentou a hipótese — e por isso quase me enganou

| voz | decepada | plato | LUFS | **relativo** |
|---|---|---|---|---|
| `63067ce1` Nicolas | 62,5% | −18,6 | −17,94 | **−0,7 dB** (acaba em plena fala) |
| `c63cebc5` Renan | 1,8% | −36,9 | −23,66 | **−13,2 dB** (acaba decaindo) |

Mesmo dono, uma podre e uma limpa, 12,5 dB de separação **na direção prevista**.
Se eu parasse aqui, este card ganhava uma causa "provada" hoje.

### 2.4 Nas 17, a correlação é ZERO

Mesma população da ronda anterior (≥20 fronteiras julgadas na régua da entrega),
654 fronteiras: **Pearson 0,066 · Spearman 0,145**. E não é ruído sobre
tendência — os dois extremos aparecem dos dois lados:

- `98247db3` "Vicente 2": relativo **+6,8 dB** (o pior caso possível pela régua) → **1,4%**
- `052f9b9b` "voz padrão": relativo +0,8 dB → 10,0%
- `824b225e`: relativo **−34,2 dB** (decaimento limpo) → **38,1%**
- `6e369397`: relativo −16,5 dB → 25,8%

A voz que termina do jeito mais decepado da lista é a **segunda mais limpa** na
entrega. **HIPÓTESE REFUTADA.**

Fica registrado no card em letra grande: **par de controle serve pra gerar
hipótese, não pra fechar uma.** Nesse par a hipótese bate lindamente e está
errada.

### 2.5 O que isso deixa

Terceira propriedade da voz testada e descartada (velocidade, idade da
referência, cauda da referência). O achado central **continua de pé**: no
experimento controlado — mesmo aluno, texto byte a byte idêntico — 17/28 numa voz
e 0/4 na outra. A variável é a voz; caiu a explicação de QUAL propriedade.
Próximo passo recomendado, ainda de graça: medir **fronteira a fronteira** dentro
da mesma voz, em vez de procurar propriedade por atacado.

## 3. A verificação de DINHEIRO que estava esquecida (#222 / #290)

A nota 32 do #222 (ronda 06/09) terminou com um encargo explícito: *"quando
qualquer um dos 8 logar, conferir se `credit_transactions` ganhou a linha. Se
NÃO ganhar, o defeito é maior do que este card."* Ninguém tinha voltado.

**Resposta: os 8 estão creditados.** 100.000 cada, plan=pro, acesso vivo.

**Mas o mecanismo não foi o previsto, e isso importa mais que o resultado.** A
previsão era que o crédito entraria no primeiro login. Medi: **7 dos 8 têm
`last_sign_in_at` NULL** — nunca logaram — e mesmo assim estão creditados. As 8
linhas nasceram em **rajada de 4 segundos** (06/09 13:45:52→13:45:56Z, uma a cada
~0,45s): assinatura de script em lote, não de gente entrando. Caiu **15 minutos
depois** do fim da janela da ronda que mediu zero — por isso aquela ronda estava
certa quando mediu.

Consequência honesta: o comportamento do `claim.ts` no primeiro login dos 7
**segue sem prova em produção**. Não troque "os alunos estão creditados" por "o
claim funciona".

### 3.1 O crédito em dobro que eu fui conferir antes de dizer que estava tudo bem

Com 7 alunos que nunca logaram e crédito já concedido por fora, a pergunta
obrigatória é se o `claim.ts` credita **de novo** no primeiro acesso. O dedupe
procura `kind='subscription_grant'` e `ref_id IN (transação, external_id)`.

**O cheiro concreto:** dois dos 8 `ref_id` têm sufixo que os outros seis não têm
— `HP3698277513C2` e `HP1035474703C2`. Formato diferente no meio de uma lista
uniforme é exatamente onde comparação de string quebra em silêncio.

Medi os 8 comparando `raw_event->'purchase'->>'transaction'` contra o `ref_id`
gravado: **bate nos 8, inclusive nos dois com C2**. Por `external_id` não bate em
nenhum (0/8), mas o dedupe usa `IN` nas duas chaves e basta uma.
**Veredito: não há risco de crédito em dobro.** Conferido por igualdade no banco,
não por leitura do código.

## 4. #290 — o fix está no ar, e ainda assim não está provado

Caí neste card por acidente: conferindo o Sent de outros dois alunos
(`hellengrasso` 06/09 23:48Z, `luanmarcal` 04/09 04:13Z) vi nos dois o parágrafo
da mentira, e os dois são pagantes. **Antes de gritar regressão, fui na data.**
`0b672b2` é de **07/09 01:51:59Z** — os dois e-mails são anteriores. Não é
regressão.

⚠️ **Errei e corrigi na mesma ronda.** Escrevi na primeira nota que "−04:00
significa 05:52Z" — está invertido, fuso −04:00 SOMA 4h para virar UTC. A minha
leitura original (01:52Z) estava certa e a minha "correção" é que estava errada.
Conferi com `TZ=UTC git log --date=iso-local` e gravei nota de retratação no
card. Nenhuma conclusão cai; o que cai é uma frase minha. Deixar errado seria
plantar a próxima confusão, num card onde tudo depende de saber se um e-mail saiu
antes ou depois do deploy — e 4h para o lado errado é exatamente como se troca
"não é regressão" por "é regressão" e se pede revert de um deploy correto.

**O fix não caiu na armadilha do `ja_pagou`** (conferido de propósito: lê
`entitlements`, não a coluna suspensa que leria "nunca pagou" para todo mundo e
faria o fix nascer morto).

**A metade ruim: o ramo que conserta nunca rodou.** Levantei no Sent os 16
destinatários de "Seu Sistema de Geração Pronto" enviados depois do fix e cruzei
com `entitlements`: **zero** têm assinatura viva — zero entitlement de qualquer
tipo nos 16. Logo todos saíram pelo ramo `else`, o texto era verdade para eles, e
o comportamento observado desde o deploy é **indistinguível do de antes**. Mesma
lição da fumaça do Vídeo Clone: deploy feito não é funcionando.

O que **consegui** provar sem esperar caso real: rodei a consulta do fix contra os
8 afetados com dado de hoje — **TRUE em 8 de 8**. A lógica está validada; falta o
gatilho.

## 5. O achado que mudou a urgência — e foi ao grupo

Juntando o item 3 com o item 4: **8 assinantes pagantes, 100.000 créditos cada,
e 7 nunca entraram na plataforma.** O único e-mail que a casa mandou para eles
diz que a plataforma "é contratada à parte". Era falso para os 8.

**Não afirmo causa** — não perguntei a nenhum deles, não há instrumentação
ligando as duas coisas, e "nunca logou" tem explicações banais. O que afirmo é o
medido: ~800.000 créditos pagos parados, 7 pessoas que nunca entraram, e uma
carta nossa dizendo a elas que não tinham por que entrar.

O card deixou de ser "nosso texto está errado" e virou "nosso texto errado
provavelmente está segurando 8 clientes pagantes fora do produto". A decisão
pendente é a mesma desde 04/09 (o "pode" do e-mail em massa), mas agora o custo
de esperar está medido. **Levei ao grupo** com a ressalva do ramo não exercitado
junto, para não vender peixe.

## 6. O que eu conferi e NÃO virou trabalho

- **hellengrasso** (`rejected_too_short`, 1d, 95k créditos) — o alarme da
  varredura procede, mas ela **já foi respondida** em 06/09 23:48Z (uid 1182),
  com carta honesta que assume a culpa da casa e explica os 5 arquivos perdidos.
  A bola é dela.
- **luanmarcal** (import quebrado, 10d) — **já respondido** em 30/08 (uid 347),
  carta longa e específica, e ele comprou o SGP em 04/09. Escrever de novo seria
  ruído. Conferi que não é da planilha antes de olhar: é `onboarding_runs` do
  SGP, não a planilha desligada em 29/08.
- **Os 4 primeiros da fila** seguem presos em decisão. Reconferi o #222 nas 33
  notas em vez de herdar a frase da ronda anterior.

## 7. Fila

**32 abertos** na entrada e **32 na saída** — nada fechou. 12 aguardando aluno.
**Nada fechado voltou a disparar.**

Escrevo o placar parado sem maquiagem: a ordem de 21/08 é para fechar MAIS, não
para fechar mais rápido do que se resolve. Os quatro mais antigos estão presos em
decisão do Johnny, e o quinto (#234) é um problema de causa que já derrubou três
hipóteses. O passo que emperrou hoje é **decisão**, em quatro cards, e
**identificação de causa**, em um.

## 8. O que eu NÃO fiz

Não gastei GPU, não gastei whisper, não mexi em crédito/acesso/plano, não
estornei, não apliquei migration, não mergeei PR, não abri branch, não escrevi
código de produção, não escrevi para aluno, não reabri incidente, não mudei
status de nada e não toquei em nada da planilha.

Escritas da ronda: **4 notas** (#234, #222, #290 ×2, sendo uma retratação
minha), **1 aviso no grupo** e **1 arquivo no git**.

## 9. Precisa de DECISÃO do Johnny

1. 🔴 **O "pode" dos 8 do #290** — pendente desde 04/09. **Subiu de prioridade
   hoje:** os 8 estão pagos e creditados, 7 nunca entraram, ~800k créditos
   parados. Código já em produção.
2. 🔴 **`migration 82`** — destrava o #15 (39 dias).
3. 🟡 **#254 / Diego** — relógio em **08/09 12:00Z (amanhã)**.
4. 🟡 **#265** — política de garantia parada; código já curado.
5. 🟡 **#226 / #234** — cobrar ou estornar as gerações reprovadas pelo QA.
6. 🟡 **marcelopersonalthe32** — prazo de reembolso vence **11/09**.
7. 🟡 **#222** — o próprio card pede reenquadrar ou fechar.

## 10. Para quem pegar a próxima ronda

- **Não gaste whisper** medindo ritmo, velocidade ou cauda da referência no
  #234: as três estão descartadas.
- **Não reverta o PR #197** por causa do pico de 26% de hoje — é uma voz só
  (alarme falso já documentado na nota das 18h40).
- **#290 vira fato** no dia em que aparecer no Sent o primeiro e-mail com o bloco
  "A SUA ASSINATURA DA PLATAFORMA FASTCLONER TAMBÉM ESTÁ ATIVA". Antes disso, o
  fix está deployado e não provado. Vale conferir.
- **Converta fuso com instrumento, nunca de cabeça**: `TZ=UTC git log -1
  --date=iso-local <sha>` e leia o `+0000`. Eu errei o sinal hoje.
