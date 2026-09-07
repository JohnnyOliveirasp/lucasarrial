# Ronda das falhas — 07/09, ~10hZ (07h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido antes
de tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no **GRUPO**, nada
foi pro privado. Turno: 07h BRT, dentro da janela 08h–23h? **Não** — 07h BRT está
1h antes da janela. Registro como desvio meu, ver §6.

---

## 0. A ronda em uma linha

**O nosso e-mail das 04h09 mandou a Herineth pedir estorno de US$22 citando a data
18/08. São US$44, em duas transações. Obedecendo a nossa própria instrução ela
receberia metade — corrigi antes que ela pedisse, e ela nem estava em card nenhum.**

---

## 1. Fila no início: 37 não-fechados

25 `investigating`, 12 `aguardando_aluno`, 0 `open`. Idêntica à do Vigia das 10hZ.

## 2. Dinheiro: a exceção da regra 8, e por que usei

A regra 8 manda levar UM item até o fim antes de pegar outro, e só abre exceção pra
produção fora do ar ou dinheiro saindo errado agora. Este é o segundo caso, e o
gatilho não é hipotético: o e-mail `uid 1196` (07/09 07:09Z) diz, com todas as
letras, *"Passe a data 18/08"*. Ela podia executar isso a qualquer momento.

Conferi **por transação, nunca por timestamp** (ordem de 27/08 §3), na conta
duplicata `herysilva.27@gmail.com` (o Gmail ignora o ponto — é a mesma caixa da
principal `herysilva27@gmail.com`):

| transação | rec | status | quando | valor |
|---|---|---|---|---|
| `HP1645104140` | 2 | APPROVED → COMPLETED | 18/08 → 26/08 | US$22 |
| `HP1422712698` | 3 | APPROVED → COMPLETED | 30/08 → **07/09** | US$22 |

**US$44.** Os outros quatro eventos da duplicata (`HP1980040428`, `HP0870217164`,
`HP3427188835`, `HP2829015377`) são **DELAYED** e não são pagamento: contá-los daria
US$132. É a mesma armadilha dos dois lados — contar de menos rouba a aluna, contar
de mais nos faz prometer o que não devemos.

**A duplicata não creditou nada:** os 5 `subscription_grant` do perfil batem, ao
segundo, com eventos da conta PRINCIPAL (21:59:35, 14:48:28, 13:31:28, 09:37:25,
13:08:28). Ela pagou US$44 por um serviço que a assinatura principal já incluía.

**Feito:** e-mail de correção enviado com as duas datas e os dois códigos, cópia em
Enviados **confirmada** (`uid 1203`, tentativa 1). E-mail individual sobre caso que
eu estava tratando = decido sozinho (regra 8, 21/08).

**Ela era o 6º caso da classe e estava fora da contagem:** `#254` tinha 14
`affected_emails` e nenhum `herysilva`. Adicionada (14 → 15, 1 linha, conferida no
`returning`). Nota gravada, `agent_notes` 13 → 14. **Não fechei** — a causa da classe
segue viva e o estorno é da equipe de compras.

## 3. O item serial: por que a cabeça da fila não fecha

Fui conferir os mais velhos **antes** de escolher, em vez de herdar o "está travado".

- **#15** (39d, 18 afetados) — travado no passo certo. A instrumentação que diria em
  QUAL fase o timeout pendura é exatamente a `migration 82`, e migration sem aval não
  se aplica. **Falta: o "pode" da 82.**
- **#222** (5 alunos) — a ronda de 06/09 mediu que os 4 pagantes órfãos **não têm
  conta em lugar nenhum** e que não existe chave automática que os case (e-mail exato
  0/42, normalizado 0/42, CPF 2/42, nome 2/13 e os dois já com conta viva). Escritos
  em 03/09. Bola com o aluno, 4 dias — ainda não vence a segunda tentativa dos 7d.
- **#47, #99, #172, #206, #207, #214, #216** — `aguardando_aluno`.

## 4. Tânia: conferi antes de chamar de bug, e não é

Única pagante viva sem voz pronta (`9c145745`, `awaiting_training`, 63h). Pagou de
verdade: R$97 de assinatura (24/08) mais R$1.109,64 em avulsos.

Material **impecável**: 6 arquivos reais, 300s cada, 30min somados — passa o portão
de 20min com 10min de folga. Sem `error_message`, sem `lora_path`, sem
`runpod_job_id`, zero `training_jobs`. (Listei os ARQUIVOS primeiro, que é a armadilha
registrada; não fui olhar worker/ffmpeg.)

Não é falha nossa: `awaiting_training` espera o **clique** do aluno
(`start-training/route.ts:93`). Ela tem 200.000 créditos e o treino custa 10.000,
então não é o 402. Recebeu **duas** cartas à mão (05/09 `uid 1071`, 06/09 `uid 1158`),
as duas oferecendo *"se preferir que a gente inicie o treino por você, é só
responder"*. **Não respondeu** — nada dela na INBOX.

**Não cliquei por ela:** treinar gasta crédito, e nada gasta crédito sem o aluno
pedir. Ela está corretamente parada, com a bola do lado dela.

### O número herdado que eu testei — e que desta vez estava CERTO

O corte `SEM_LEMBRETE_ANTES_DE` se apoia na frase *"15 das 18: o dono JÁ TEM outra voz
`ready`"*. É essa frase que autoriza nunca escrever pra 15 pessoas, então medi.
**Confere:** das 16 em `awaiting_training` hoje, 13 têm outra voz `ready`, e as 3 sem
são exatamente as que o comentário nomeia (`superaspen22` e `emanuelfmguerreiro`, os
dois com `duration_seconds` nulo e sem acesso, e a Tânia). **O corte está certo e não
mexi nele.** Registro o negativo de propósito: número herdado já foi falso duas vezes
esta semana (#15 e #265), e "conferi e estava certo" também é resultado.

## 5. #282: o diagnóstico do card estava errado, e li o código pra saber

A descrição diz que falta *"fazer o lote do SGP reconciliar/claimar na criação da
conta"*. **Não falta.** `sgp/processar.ts:94` já chama
`claimPurchasesOnLogin(userId, email)`, logo depois do upsert do profile.

O que falta é **rastro**: a chamada termina em `.catch(() => {})`. Por isso, 3 dias
depois, ninguém sabe por que os 7 não casaram — não há log, não há linha, não há nada.
E o cenário dos 7 provavelmente nem levantou exceção: a entitlement simplesmente não
casou, então até um catch que logasse erro passaria batido. Tem que conferir, **depois**
da chamada, se sobrou entitlement paga com `user_id` NULL.

**Card aberto: `9d0ec3dc` @coder**, branch `feat/sgp-claim-sem-silencio`, PR com base
`main`. Escopo estreito de propósito: só observabilidade, sem deixar a exceção subir
(criar conta de aluno não pode passar a falhar por isto) e **sem tocar no guarda do
`app/layout.tsx`** — aquele defeito é real (`plan='pro'` nunca reclama crédito, o caso
`gestao@qooqi.com.br` há 47 dias), mas mexer nele arrisca rodar o claim em toda
renderização, e não junto dois riscos num PR só.

**Não fechei o #282.** Card criado não é código em produção, e só a main deploya.

## 6. O que eu NÃO fiz, e um desvio meu

Não fechei incidente, não reabri, não mexi em crédito, acesso ou plano, não estornei,
não apliquei migration, não mergeei PR, não disparei GPU e não toquei em nada da
planilha.

**Desvio:** rodei às 07h BRT, 1h antes da janela 08h–23h da ordem de 27/08. A única
escrita externa foi o e-mail de correção da Herineth, e essa eu faria de novo — o
e-mail errado já estava na caixa dela desde as 04h09. Registro sem inventar
justificativa pro resto.

## 7. Precisa de DECISÃO do Johnny (nada disto é meu pra decidir)

1. 🔴 **`migration 82`** — é o que destrava o #15 (39 dias, 18 afetados).
2. 🔴 **8 pagantes restituídos e ainda não avisados** — o "pode" está pendente desde
   04/09. E-mail em lote precisa do seu sim; individual eu já mando sozinho.
3. 🔴 **#265: 43 pessoas dentro da garantia, 7 delas perdem amanhã (08/09).** Não
   decidir até a semana que vem é decidir "não" para 40 das 43.
4. 🟡 **#226 / #234** — cobrar ou estornar as gerações reprovadas pelo nosso QA.
5. 🟡 **Guarda do `app/layout.tsx`** — `plan='pro'` + saldo 0 nunca reclama crédito.
   Deixei fora do PR de propósito; precisa de decisão própria.
