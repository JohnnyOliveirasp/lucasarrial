# Fecho do dia — relatório noturno de 07/09 (escrito 08/09 ~01:00–01:30Z)

Consolidado das ~24h desde o relatório anterior (07/09 01:00Z → 08/09 01:20Z).
Tudo aqui foi **medido nesta ronda de fecho**, com o instrumento nomeado em cada
linha. Onde eu só repito número de outra ronda, digo que estou repetindo.

---

## 1. O que eu resolvi hoje

### 1.1 Dez merges em produção, todos confirmados no servidor

| commit | hora | o que corrige |
|---|---|---|
| `0b672b2` | 01:51Z | e-mail do SGP para de dizer ao assinante **pagante** que ele não tem a plataforma (`#290`) |
| `216417c` | 11:46Z | áudio acima do teto para de sumir calado da lista do Vídeo Clone (`#292`/`adc3ed99`) |
| `a7fbfb0` (PR #206) | 17:54Z | `fabricar_referencia`: candidata não pode dividir nome; `--arquivo` escolhe a gravação |
| `2697d95` (PR #205) | 20:48Z | SGP para de engolir o motivo de a compra paga não entrar na conta (`#282`) |
| `8405eb0` (PR #207) | 20:51Z | a Fast para de prometer estorno automático em **toda** falha (`ce6e157d`) |
| `de3eabe` (PR #208) | 20:54Z | a Fast passa a enxergar estorno no extrato — `ref_type` no contexto (`#260`) |
| `b55db26` (PR #209) | 00:06Z | heartbeat de fase leva `chunk`/`attempt` ao banco (`#15`) |
| `d2dc5fa` (PR #210) | 00:46Z | reporte manual do admin deixa de nascer irrespondível (`#237`) |

Também subiu a telemetria do `#234` (build de worker `34124001025`, SUCCESS 13:36Z).

**Prova de que está no ar, e é do servidor, não do GitHub:** `BUILD_ID`
`g6f-cPG2G50TlGTCcV0hy`, gerado **08/09 00:48:44Z**, depois do último merge
(00:46:55Z). `pm2` com o `aiverse` **online**. Todos os runs de deploy do dia
terminaram `success`.

⚠️ **Uma coisa NÃO está provada e eu não vou dizer que está.** A imagem nova do
worker do `#15` construiu com sucesso às **00:35:58Z**, mas desde então rodou
**1** geração (00:49Z) e ela **não** carrega o campo `meta`. Com n=1 não dá pra
separar "endpoint ainda não trocou de imagem" de "essa fase não tinha meta
mesmo". Detalhe em `2026-09-08_rotina_falhas_00h_15.md` §7.

### 1.2 O prazo falso da Leonice — o erro foi nosso, e custou crédito dela

Nosso e-mail das **14:27Z** (uid 1243) disse à aluna que o acesso dela ia "até
09/09", em tom de prazo acabando. `HCIA7GIM` está **ACTIVE**: 09/09 é a
**renovação**, não o vencimento. Nas 8h seguintes o saldo caiu de **149.049**
para **121.613** — **27.436 créditos** queimados. Nexo causal não está provado;
a sequência e o tamanho estão.

- Escrevi de novo às **~22:5xZ** (uid 1285) desfazendo o prazo e pedindo desculpa.
- Dinheiro dela conferido e limpo: 5× `studio_audio` −550 com 5× `studio_audio_refund`
  +550, **líquido zero**; 5 Vídeo Clone `ready`; 1 `image_video` entregue.
- A causa virou card: **`#303`** — `account.ts:258-263` monta "ativo até <data>"
  **sem o status da assinatura**. Exposição medida: **265 de 661** contas com
  acesso vivo têm `access_until` dentro de 7 dias. Vítima confirmada: **1**.

### 1.3 Herineth: nosso e-mail contou metade do dinheiro dela

O e-mail das 04h09 mandava ela pedir estorno de **US$22** citando 18/08. São
**US$44 em duas transações** (`HP1645104140`, `HP1422712698`). Corrigido por
e-mail (Sent uid 1203) e ela entrou no `#254` (`affected_emails` 14 → 15).
Os outros 4 eventos são `DELAYED`, não pagamento — não são US$132.

### 1.4 Elane (`#293`): a causa é NOSSA, e eu corrigi um diagnóstico meu

Medi os 7 mp3 que ela recebeu: 6 únicos, **todos das vozes dela** — nenhum da
voz de catálogo que um e-mail anterior tinha apontado como "motivo principal".
A referência `ref/auto.wav` da voz dela mede **2,067 pal/s**, 15 pausas ≥0,15s,
**7,44s de silêncio (26%)**. E ela **não fala devagar**: os takes 000–007 passam
de 3 pal/s, chegando a 3,92; a régua caiu porque os takes 008–019 são lentos.

**Defeito de classe que isso expôs:** `fabricar_referencia.cjs:196` escolhe **o
maior arquivo bruto**, sem olhar ritmo. Chamado fechado como `fixed` (17:05Z),
com 2 e-mails à aluna assumindo o erro (Sent uid 1245 e 1246).

### 1.5 Cinco chamados fechados

| # | desfecho | nota |
|---|---|---|
| `#292` | `fixed` | corrigido em produção (`216417c`) |
| `#293` | `fixed` | Elane — causa nossa, aluna avisada |
| `#231` | `fixed` | Sidney: já respondido nas 2 ocorrências, **ninguém tinha conferido o Sent** — 5 dias parado por isso |
| `#295` | `ignored` | rajada de falhas do Vídeo Estúdio (Leonice) |
| `#302` | `ignored` | duplicata do `#296`, mesma aluna, aberto 25min antes |

Abriram **12** (`#292`–`#303`). Fechei **5**. Saldo do dia: **+7**. Não escondo o sinal.

### 1.6 O armário do Vigia estava mentindo — 4 patches, todos já no ar

A ronda das 00h se acusou de **84h de dívida** por causa do `patch_ce6e157d`.
**Ele tinha subido 4 horas antes** (PR #207, 20:51Z). O que estava velho era a
**ficha**, não o trabalho.

Conferi os 4 contra a `origin/main`, um por um, no código e não na ficha:

| chave | onde está o código na main | veredito |
|---|---|---|
| `patch_92b1cc85` | superseded pela `_v2` | aplicado |
| `patch_92b1cc85_v2` | `admin/incidents/route.ts:80` (`reported:manual:`) e `:97` (`has_email`) | aplicado |
| `patch_ce6e157d` | `lib/agent/manual.ts:147-157` — a regra categórica virou condicional + "nunca afirme estorno sem ver a linha" | aplicado |
| `patch_446c3ae4` | `sgp-boas-vindas.ts:393` (`blocoAssinatura = temAssinaturaFastcloner ? …`) | aplicado |

**Apaguei as 4 chaves com `DELETE`** (não com `set_state` null — a armadilha de
30/08). Sobraram **0**.

### 1.7 Fila interna de recados: 44 → 35

Achei **9** recados apontando para chamado **já fechado** (`#240`, `#248`,
`#252`, `#218`, `#261`, `#253`, `#283`, `#292`, `#293`) e apaguei com `DELETE`.
Ontem eu disse que não tinha drenado nada. Hoje drenei um terço. **A mais velha
continua com 151h (6 dias) e continua sendo dívida minha.**

### 1.8 Nenhum dos 4 alunos presos está abandonado — conferido um por um

Não confiei na varredura: abri a caixa de **Enviados** de cada um.

| aluno | situação | último contato nosso |
|---|---|---|
| Tânia Araujo | pagante, 30min de áudio enviados 04/09, voz parada em "falta treinar" | **2 e-mails** (05/09 e 06/09) — ela não clicou |
| Marcelo | voz falhou 10/08 por erro nosso, 29 dias | 4 e-mails, o último 05/09 (prazo de reembolso **11/09**) |
| Hellen Grasso | 5 dos 7 arquivos não chegaram (culpa nossa) | 06/09 23:48 |
| Luan Marçal | import quebrou 29/08 (link do Drive fechado) | 4 e-mails, o último explicando como reenviar — ele não reenviou |

---

## 2. O que está parado esperando o Johnny

Ontem eu mandei **8 perguntas** e recebi **0 respostas**. A lição não é
"insistir mais alto", é que **8 é lista demais pra quem lê dirigindo**. Hoje
mando **4**, todas binárias, todas com recomendação, ordenadas por relógio. As
outras continuam registradas aqui e nos cards; não vou repetir a lista inteira
todo dia.

1. **Diego (`#254`) renova 08/09 12:00Z, R$194.** Deixo cobrar?
   *Recomendo sim* — a assinatura órfã `4UKYMN4L` está em CPF e titular
   **diferentes**, e não existe pedido escrito. Cancelar sem pedido é mexer no
   dinheiro de alguém que não pediu.
2. **Garantia (`#265`): renovação mensal reabre a janela?** 43 pessoas dentro,
   **7 saem em 08/09**. Esta pergunta já venceu um prazo sem resposta ontem.
3. **`#290`: mando o e-mail de correção pros 8 assinantes** que receberam a
   carta dizendo que não têm a plataforma? 7 dos 8 nunca entraram. É lote, por
   isso pergunto.
4. **Tânia:** ela pagou, mandou 30 minutos de áudio, foi avisada 2× e não
   clicou em "Treinar". **Eu clico por ela?** Gasta ~10.000 dos 200.000
   créditos **dela**. *Recomendo sim* — é exatamente o que ela comprou.

**Continuam paradas, sem relógio novo:** migration 82 (destrava o `#15`, 40
dias); estornar ou não as gerações que o nosso QA reprovou (`#226`/`#234`);
reenquadrar ou fechar o `#222`; o guarda do `app/layout.tsx`; e a decisão de
produto do `#296`/`#303`.

---

## 3. Estado geral, medido agora

- **46 chamados não fechados**: 34 em investigação + 12 esperando aluno.
- **Correção de contagem minha, de ontem.** Reportei 37 ontem. Fazendo a conta
  pra trás — 34 hoje, menos 8 abertos hoje que continuam investigando, mais o
  `#231` que fechei — ontem eram **27 em investigação, não 25**. O número certo
  de ontem era **39**. Conferi que **nenhum chamado fechado reabriu** (zero
  linhas com `status='investigating'` e `resolved_at` preenchido), então não é
  reincidência: foi contagem minha errada pra menos.
- **Produção 24h: 280 entregas, ZERO falha.** 86 áudios, 108 imagens, 67 Vídeo
  Clone, 19 vozes — todos `ready`, nenhuma linha `failed` nas 4 tabelas.
- **Dinheiro:** 19 tipos de lançamento nas 24h, nenhum desconhecido. O único
  estorno do período é o da Leonice (5 linhas, líquido zero). 40 `payment_event`
  somando +4.100.000 créditos entregues.
- **GPU:** 3 endpoints saudáveis — 0 na fila, 0 `throttled`, 0 `unhealthy`.
- **Sweeps vivos, provado no log do servidor:** **288 rodadas** do varredor de
  e-mail em 07/09 (12 por hora, nenhuma perdida) e 14 hoje, **0 erro** em todas.
- **A caixa do suporte está sem e-mail novo desde 17:30Z** (~7h30). O Vigia
  marcou isso 4 rondas seguidas. **Não é cron morto** — o varredor conecta e
  volta `scanned:0, errors:0` a cada 5 minutos. É silêncio real, e hoje é
  **7 de setembro, feriado**. Registro a hipótese como hipótese.
- **Pagante sem acesso: zero.**
- **Varredura:** 4 presos (1 é só escrituração, sem ninguém esperando) + 1 fora
  da fila (import quebrado há 10 dias). Todos escritos e recentes (§1.8).
- **Números meus que mudaram:** armário de patches 4 → **0**; fila de recados
  44 → **35**.

---

## 4. O que eu errei hoje

1. **A contagem de ontem estava 2 a menos** (§3).
2. **O prazo falso da Leonice saiu daqui** (§1.2) e antecedeu 27.436 créditos
   queimados.
3. **Deixei o armário do Vigia apodrecer** — o patch do `#237` ficou 5 dias
   parado e o Vigia rebaseou 2× esperando. Isso é o modo de falha de 19/08 com
   o `agent_state` no lugar do branch.
4. **Duas rondas trabalharam no mesmo quadro às 11h** e quase mandaram um
   segundo e-mail para a mesma aluna. Só não mandou quem conferiu o Sent. Não
   existe trava nem posse de incidente.
5. **Dois arquivos de prova diferentes nasceram com o mesmo nome hoje**
   (`2026-09-08_rotina_falhas_00h.md`, do `#237` e do `#15`). Renomeei o
   segundo para `_15`; sem isso um dos dois registros era perdido.

## 5. A lição do dia

> **Ficha não apagada vira dívida imaginária.**

O armário dizia 84h de atraso num trabalho que já estava em produção há 4 horas,
e uma ronda inteira se acusou por isso. É a mesma família da lição de ontem
("número herdado é dívida, não fato"), com uma régua nova e específica:

**patch se confere contra a `main`, nunca contra a ficha do `agent_state`.**
E, aplicado ou recusado, a chave se apaga com `DELETE` no mesmo passo — quem
deixa pra depois cria trabalho falso pra quem vem atrás.
