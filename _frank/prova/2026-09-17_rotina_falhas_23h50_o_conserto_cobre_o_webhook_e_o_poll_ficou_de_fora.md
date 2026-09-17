# Ronda das falhas — 17/09, 22h50Z (rótulo "23h50" só pra manter a ordem da pasta)

> Nota de relógio, terceira ronda seguida a registrar isto: os rótulos de hora
> desta série estão adiantados em relação ao UTC real. Esta ronda começou
> **22:47Z** e fechou **23:05Z**. O carimbo que vale é o de cima.

**Item serial: `#457` (`e811cbc7`), "Geração de áudio: RunPod COMPLETED".
NÃO FECHADO — mas o conserto que estava pendurado entrou, e eu achei o buraco
que ele não cobre.**

Em uma linha: **o conserto conserta o caminho do webhook, o poll grava outro
nome pra mesma falha e fica de fora — e isso já pegou um aluno hoje.**

---

## 0. A ronda começou conferindo, e foi isso que salvou o turno

A ordem do dia (`percepcao_nao_e_desculpa_pra_parar.md`) e o log das 22h
deixaram duas marcas que eu segui à risca. A segunda é que valeu:

> *"O trabalho pode já estar feito e o card não saber. Antes de executar o plano
> escrito num cartão, confira se ele já foi executado."*

O Vigia das 22hZ escalou, em vermelho, **"PARA DECISÃO DO JOHNNY: dar o 'pode'
no PR #331"**, com a frase *"é um 'pode' pendente, não trabalho pendente"*.

**Quando cheguei, o PR já estava MERGEADO.** Merge `95f36a67` às **22:26:48Z**,
deploy `35282060262` **success** às **22:29:50Z**. O recado do Vigia nasceu às
22:14Z e envelheceu em 12 minutos.

Se eu tivesse agido pelo recado, teria ido pedir ao Johnny uma autorização que
já não era necessária. **Terceira vez hoje que um pedido escalado estava velho
quando chegou.**

## 1. Não acreditei na nota anterior — conferi cada afirmação

A nota das 22:30Z no cartão dizia ter feito quatro coisas. Refiz as quatro por
fora, porque nota é alegação até alguém medir:

| afirmação da nota | como conferi | resultado |
|---|---|---|
| conserto em produção | `grep` na main + `gh run list` | **confere** — `"runpod completed"` na TRANSITORIAS, deploy success 22:29:50Z |
| carta à Roseni saiu | IMAP Enviados, `EXAMINE`+`BODY.PEEK` | **confere** — uid **2733**, 22:30:09Z, texto honesto, li inteiro |
| semeador conseguiu áudio | `generations` | **confere** — `e58008e3` ready 22:14:21Z, arquivo no R2 |
| dinheiro dos dois fechado | ref_id + soma do sinal | **confere** — soma 0 nos quatro pares |

**As quatro eram verdadeiras.** Registro isso porque na ronda das 22h a lição
foi o oposto (trabalho feito e não carimbado); aqui o carimbo existia e estava
certo. O hábito de conferir não é desconfiança do colega, é o que permite
assinar embaixo.

## 2. Os 425: mantive o NÃO ESTORNAR, e agora com prova, não com inferência

A nota anterior recusou estornar `b54c8045` (425 cr) por confiabilidade do
estorno automático (7/7 em 13–37s). Isso é **inferência estatística** — o mesmo
tipo de argumento que o PR #331 chamou de fraco no próprio corpo.

Achei evidência independente e categórica, no registro do próprio Vigia:

- `b54c8045` foi **debitado 22:09:26Z** e o Vigia o viu **`pending` às
  22:11:13Z** → **107 segundos de execução, ainda rodando**.
- Faixa de **cold start** (as falhas desta classe): **10,3 a 16,2 s**.
- Faixa de **sucesso** do mesmo texto: **135 a 223 s**.

**107s é ~7× o teto da faixa de falha.** Ele não morreu no cold start — estava
em trajetória de sucesso. Entregou e o aluno apagou do histórico: **débito
órfão**, exatamente como a ordem de 20/08 descreve.

> **A inferência dizia "provavelmente entregue". O relógio diz "não falhou".**
> São coisas diferentes, e só a segunda aguenta ser escrita numa nota.

Conferi **todos** os refs pendurados dos dois alunos, não só o citado — 13 no
total. **Nenhum é dívida:** os que têm row estão `ready` com arquivo (cobrança
de coisa entregue); os 3 sem row são órfãos documentados, incluindo o treino de
voz de 10.000 que **funcionou**. **Nenhum centavo a devolver.**

## 3. O achado da ronda: o conserto cobre o webhook e o poll ficou de fora

Fui ler os dois caminhos que gravam a falha, e eles divergem:

| caminho | arquivo | string gravada | entra na lista? |
|---|---|---|---|
| **webhook** | `webhooks/runpod/route.ts:222-224` | `` `RunPod ${payload.status}` `` → **"RunPod COMPLETED"** | **sim** → reenvia |
| **poll** | `generations/[id]/route.ts:146-155` | `out.error ?? "unknown"` → **"unknown"** | **não** → **não reenvia** |

E o **gate de sucesso é idêntico nos dois**: `COMPLETED && !out.error &&
out.uploaded`. É a mesma falha com **dois nomes, dependendo de quem observou**.

O PR #331 previu o buraco e mediu: *"**0 linhas** com `error_message = 'unknown'`
na tabela inteira — nunca disparou na prática."* Por isso, com razão, não
acrescentou `"unknown"` na lista.

**Essa medição ficou velha 17 minutos depois de ser escrita.**

Medido por mim agora, tabela inteira: existe **exatamente 1** linha com
`error_message = 'unknown'`:

```
9ada4b25 · 17/09 21:25:16Z · semeadorriquezas@gmail.com
elapsed_seconds = 11,479   (faixa de cold start: 10,3–16,2s)
request_attempts = 1       (não houve reenvio)
```

O PR abriu **21:07:56Z**; a linha nasceu **21:25:16Z**. **O PR não mentiu — ele
nasceu certo e envelheceu.** Mas o buraco é real, é a mesma falha, e já custou
uma tentativa a um aluno no primeiro dia dele.

**Cartão aberto pro `coder`: `acdae9ff`.** O conserto certo é o poll gravar a
**mesma string** do webhook — **não** pôr `"unknown"` na lista, que casaria erro
alheio demais (argumento do próprio #331). Avisei no cartão que trocar a string
**muda a assinatura** daquela linha, e que ele tem que dizer no PR o que isso
faz com o histórico do `#457` em vez de descobrir depois.

> **Padrão do dia, terceira aparição: toda medição publicada hoje envelheceu
> em minutos.** O recado do Vigia (12 min), a contagem de percepção 41 vs 1, e
> agora o "0 linhas de unknown" (17 min). Número medido não é número verdadeiro
> — é número **daquele instante**, e quem age por ele horas depois age no
> escuro. Por isso a conferência virou o primeiro passo da ronda, não o último.

## 4. Por que este cartão NÃO fecha hoje

O conserto está em produção, mas **a cura é INCONCLUSIVA**, e digo o limite:

**Zero ocorrências novas** de `"RunPod COMPLETED"` desde o deploy (22:29:50Z).
**Ausência de falha não é prova de cura** — pode ser só ausência de tráfego às
23h. Nenhuma ocorrência exercitou o reenvio ainda. Fechar como `fixed` agora
seria fechar mais rápido do que resolvo (regra 14).

**O critério que fecha, escrito pra próxima ronda não redescobrir:**

> uma ocorrência de `"RunPod COMPLETED"` criada **depois de 2026-09-17T22:29:50Z**
> com **`request_attempts >= 2`**. Isso prova que a string casou e o reenvio
> disparou.

Virou ferramenta, não consulta solta:
**`_frank/ferramentas/2026-09-17_runpod_completed_curou.cjs`** — separa
antes/depois do deploy, e **diz `INCONCLUSIVO` em vez de fingir cura** quando o
denominador é zero. Ela também audita o dinheiro dos envolvidos pelo método
certo (casar `ref_id` + somar o **sinal**, nunca só `ref_type`), e classifica
cada ref negativo em *entregue* / *órfão* / *investigar*.

## 5. Dois erros meus nesta ronda, os dois de medição

Registro porque zero falso é o veneno da casa e eu produzi dois:

1. **`LIKE` em coluna `uuid`** devolveu "SUMIU" pra 5 refs — inclusive um que
   eu **acabara de ver `ready`**. O Postgres recusa (`operator does not exist:
   uuid ~~ unknown`) e eu tinha engolido o erro num `catch`/`continue`. A
   contradição com a medição anterior foi o que me fez desconfiar. Refiz com
   UUID completo e erro impresso.
2. **`credit_ledger` não existe** (é `credit_transactions`). O script morreu
   alto, que é o comportamento certo — mas eu escrevi o nome de cabeça em vez
   de conferir.

> Os dois erros tinham a mesma forma: **eu supus o esquema em vez de medir o
> esquema.** Os dois só não viraram conclusão publicada porque o resultado
> brigou com algo que eu já tinha medido antes.

## 6. Estado da Roseni

Continua com **zero áudio na vida**: 2 gerações, as 2 falhadas, **nenhuma
tentativa desde 21:55:14Z**. Recebeu a carta às 22:30:09Z pedindo que tente de
novo e avise a hora se falhar. **Não está travada** — é espera legítima de
resposta de aluna, com data anotada. Se não voltar nem responder até **19/09**,
a ronda daquele dia cobra de novo.

## 7. A lição

> **Um conserto pode estar certo e mesmo assim deixar a falha viva, porque
> cobre o caminho em que ela foi VISTA e não o caminho em que ela ACONTECE.**
> A mesma condição de erro tinha dois observadores e dois nomes; a lista só
> conhecia um. Quem valida o conserto pelo sintoma que originou o cartão
> ("parou de aparecer RunPod COMPLETED?") nunca encontra o irmão gêmeo dele
> chamado "unknown".
>
> E a vizinha, que já é padrão do dia: **medição publicada envelhece.** Três
> recados hoje estavam errados quando foram lidos, todos certos quando foram
> escritos. A defesa não é medir melhor — é **remedir antes de agir**.

## 8. Estado e dinheiro

Não mexi em crédito, acesso, assinatura, plano nem entitlement. **Não estornei
nada** (e conferi 13 refs pra ter direito de dizer isso). **Não gastei GPU e não
gerei nada.** Não subi código, **não abri PR**, não apliquei migration. Não
respondi aluno nesta ronda. Não li, escrevi, classifiquei nem reprocessei nada
da planilha (ordem de 29/08). IMAP aberto com `EXAMINE` + `BODY.PEEK`, nenhum
e-mail marcado como lido.

**Nenhum incidente fechado nesta ronda** — e isso é resposta legítima: a cura
não está provada e o conserto tem buraco conhecido. `#457` segue `investigating`
com o critério de fechamento escrito. Um cartão aberto pro `coder` (`acdae9ff`).
Uma ferramenta nova commitada.
