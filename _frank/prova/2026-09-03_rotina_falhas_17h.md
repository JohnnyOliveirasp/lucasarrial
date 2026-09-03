# Ronda das falhas — 03/09/2026 ~17hZ (dono da fila)

Serial: **#234** (`f8587cef`, palavra decapitada), que é o que **bloqueia o #47**
(Katia, o mais antigo com aluno esperando). Tudo abaixo foi medido nesta ronda.
Onde não medi, está escrito que não medi.

## Por que #234 e não o #47 direto

O #47 é o mais antigo com aluno esperando e continua sendo. Ele está travado
**dentro do #234**: o que conserta o caso dela é o gate da fronteira INTERNA, que
segue em sombra. Trabalhar o #234 **é** trabalhar o #47 — não é troca de assunto.
A aluna não está no escuro (retratação uid 461, 02/09 17:44Z) e nada novo dela
desde 02/09 15:40Z, conferido.

## O achado da ronda: a "precisão ~57%" não era uma precisão

Esse número vinha sendo citado desde 02/09 — em **cinco rondas seguidas** — como a
razão de não virar `TTS_TAIL_QA_INTERNO_MODO`. Fui medir e ele não se sustenta,
por dois motivos que conferi um a um:

**(a) O numerador era o contador errado.** Usava `tail_interno_flagged`, que é
**por TENTATIVA**, inclusive tentativa descartada. O próprio docstring de
`registrar_tail_interno` diz que esses contadores *"NÃO descrevem o áudio que o
aluno recebeu"*. Tentativa reprovada e jogada fora não chega no aluno — o mp3 sai
limpo e a conta marca "falso positivo" onde o QA **acertou**. Assinatura disso na
própria tabela de 02/09: `7bac4fb9` com `regens`=33 e `chk`=48.

Conferido no banco: **nenhuma** das 8 gerações daquela medição tem a chave
`tail_interno_entregue_n`. Ela não existia — a primeira é de **03/09 04:01**.
Aquela medição não tinha como usar a régua certa.

**(b) O denominador tratava cegueira como erro.** O mp3 só enxerga fronteira que
virou silêncio digital ≥120ms; emenda de chunk que não deixa silêncio é
**invisível** ali. A nota de 02/09 registrou esse limite e a conta depois o
ignorou. Caso mais claro: `c71d516e` com `regens`=**0** (logo, sem inflação por
tentativa), `chk`=9, `flag`=4, e o mp3 com **2** fronteiras visíveis. As outras ~7
emendas não podiam ser confirmadas nem refutadas. Foram contadas como erro.

## O que medi, e a amostra que dobrou

`--ensaio` rodado **antes** de acreditar em qualquer resultado: a régua reproduz
os 3 casos classificados à mão (`81d4f3f4` cortado; `47dc0f6e` e `1498fbe5`
limpos).

| régua | o que mediu | resultado |
|---|---|---|
| worker (`tail_interno_entregue`) | 19 gerações ready, 191 fronteiras com veredito | **18 reprovadas = 9,42%** |
| mp3 entregue (`cauda_decepada.cjs`) | as MESMAS 19 gerações, 156 fronteiras visíveis | **16 decapitadas = 10,26%** |

No nível de geração, **17 das 19 concordam** (7 positivas nas duas, 10 negativas
nas duas). O n=7 da ronda das 12h30Z virou **n=19**.

### E eu NÃO troco 57% por 87%

A conta de hoje daria 7/8, mas ela sofre do **mesmo defeito (b)**: as duas réguas
não julgam a mesma **população** de fronteira — a sombra julga emenda de chunk, o
mp3 julga todo silêncio, inclusive pausa natural de frase. Concordância entre dois
instrumentos imperfeitos **não é ground truth**. Precisão de verdade exige veredito
por fronteira e nenhum dos dois entrega isso. O que afirmo é mais fraco e aguenta:
as réguas concordam em **ordem de grandeza** no alcance e discordam em 2 de 19.

As 2 discordâncias, sem escolher a que me favorece:

- **`4ef43a69`** — sombra 4 de 8; mp3 com 1 fronteira visível, 0 decapitada.
  **Não é refutação**: 7 das 8 emendas eram invisíveis pro mp3.
- **`eb9810ff`** — sombra 0 de 14; mp3 achou 1 decapitada em t=22,253s
  (release 35ms, platô −28,1dB, sinal **forte**). Ou a sombra perdeu, ou aquele
  ponto é pausa de frase e não emenda. **Não sei distinguir** com o que tenho, e
  não vou chutar a favor da sombra.

## A decisão estava mal posta — e é isso que destrava

"Virar a chave" nunca dependeu de precisão: depende de **custo**, e custo se mede
direto, sem ground truth. `tail_interno_sombra` é exatamente *"quantas tentativas
ganhariam +100 se a chave virasse"*.

| janela | regens hoje | extras se virar | aumento |
|---|---|---|---|
| n=19 (régua de entrega) | 165 | +27 | **+16,4%** (10 das 19 gerações) |
| n=65 (desde 01/09) | 407 | +79 | **+19,4%** |

Bate com o "~15%" que o próprio código carrega no comentário. **Ressalva:** não é
soma exata — virar a chave muda **qual** tentativa vence, então o custo real não é
"hoje + 27". É ordem de grandeza, não orçamento.

**Alcance e custo agora estão os dois medidos, na mesma janela, por instrumentos
separados.** A pergunta pro Johnny deixa de ser técnica e vira troca: pagar ~1/6 a
mais de regen para parar de entregar palavra decepada em ~1 de cada 10 fronteiras.

## O 3bc1535 continua sem um único teste em produção

Confirmo por consulta própria o que o vigia mediu às 16hZ: **15 gerações** depois
do build das 12:23:08Z, **zero** com `coverage_rescue`. A predição segue com
**n=0** — não há resultado a favor nem contra. "Build success" continua sem provar
que o worker adotou a imagem.

## O aluno que a varredura acusou, e por que NÃO escrevi

`marcelopersonalthe32@gmail.com` apareceu como "acesso vivo, com crédito, sem voz
pronta" (24 dias). Conferi antes de agir:

- **Já foi avisado 3×**, não 0: Enviados uid **58** (24/08), **182** (27/08) e
  **341** (29/08) — o de 29/08 inclusive já escutou o áudio dele e confirmou que
  são duas pessoas na gravação. Um 4º e-mail repetiria o que ele já sabe: seria
  ruído (regra 27), não atendimento. **Silêncio dele não é abandono nosso.**
- **Não é pagante travado.** `pagou_de_verdade`: pagou (R$97 rec#2 12/08 +
  R$368,64 avulsa). No `entitlements`: `status`=active, `access_until`=**05/09
  12:00Z** e `date_next_charge`=**05/09 12:00Z** — a mesma data. A assinatura está
  ACTIVE; o 05/09 é a renovação, não um corte. **Não abri chamado por isso.**
- **Fica marcado para 05/09**: se o webhook da renovação não rolar o
  `access_until` pra frente, aí sim vira pagante trancado. É verificação da ronda
  daquele dia, não incidente de hoje.

## Passo em que emperrou

**Autorização, não medição.** Virar `TTS_TAIL_QA_INTERNO_MODO=reprovando` força
regen e gasta GPU — não é minha decisão. Está pedida no grupo nesta ronda, agora
com os dois números na mão em vez de um número inválido. Até haver resposta, o
#234 não fecha e o #47 continua atrás dele.

## Limites honestos desta ronda

1. Nenhuma das duas réguas é ground truth. O que eu tenho é **concordância**, não
   verdade — e disse onde elas discordam.
2. Os limiares do `cauda_decepada.cjs` seguem calibrados em **um** positivo
   conhecido (o caso Katia). Isso não mudou hoje; o que vale é ordem de grandeza.
3. O custo "+27 regens" é estimativa por contador, **não** simulação.
4. Não consigo afinar o limiar da sombra pelo banco: as features por fronteira só
   existem no log do worker, não em `qa`. Fica como limite de instrumento.
5. Não reverifiquei o #222 nem os 12 pagantes órfãos nesta ronda — seguem como a
   ronda das 13hZ deixou, esperando o mesmo "pode" do Johnny.

## O que NÃO fiz, de propósito

- **Não virei a chave** — muda produção e gasta GPU.
- Não fechei, não reabri e não mudei status de nada.
- Não refiz áudio, não gastei GPU, não gastei whisper, **não ouvi áudio nenhum**
  (tudo aqui é envelope e banco — não afirmo nada sobre som).
- Não mexi em crédito nem em acesso, não apliquei migration, não mergeei PR.
- Não escrevi para nenhum aluno nesta ronda, e disse acima por quê.
