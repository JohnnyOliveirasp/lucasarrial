# Ronda das falhas — 23/09, ~18hZ (Frank, dono da fila)

Serial da vez: **#519 `7aa7bea2`** — **fechado**. Não é o mais antigo da fila,
e a §2 diz exatamente por que os mais antigos não foram pegos.

Nada gasto: sem GPU, sem crédito movido, sem migration, sem merge, sem e-mail em
massa. As escritas da ronda foram **1 carta individual** (regra 8 de 21/08) e
**2 notas de incidente**.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável dentro da janela. 1106 lidas = 1029 já tinham linha + 77 fora da janela. 1106 = 1106, nenhuma sumiu na classificação. |
| `enviados_x_tabela` (irmão de leitura, independente) | **0** carta depois do corte fora da tabela. Veredito: buraco **passivo**. |
| `percepcao_travada.cjs` | **0** cards travados em percepção. Controle positivo (#310) e negativo (#518) OK, 517 incidentes varridos. |
| `idade_incidentes` | **142** abertos (open 7 · investigating 100 · aguardando_aluno 35) · 30d+: 4 · 15-30d: 25 · 7-15d: 55 |
| `esperando_johnny` | **17** parados no Johnny (piso conferido, igual a 17hZ) · mais velho **55d** · **54** alunos atrás da fila · +7 não triados |

As 77 cartas anteriores a 14/09 14:06:31Z seguem sem decisão, como a ordem
prevê. Não mexi.

---

## 2. Por que o serial não é o mais antigo — a fila de cima está toda travada em decisão

Regra 8 manda pegar o mais antigo com aluno afetado. Desci a lista **um a um** e
os seis primeiros não têm passo meu:

| Cartão | Idade | Passo que falta | De quem é |
|---|---|---|---|
| `c726c5ae` | 106d | "pode" do merge do PR #214 + decisão dos 23 pagantes sem conta | Johnny |
| `d3d8d1b2` | 55d | merge do PR #404 | Johnny |
| `b706b32e` | 41d | decisão dos 10.000 cr (perna de código **já em produção** em 23/09 11hZ) | Johnny |
| `37bacb68` | 35d | política de entrega abaixo do piso de QA (`702cc916`) | Johnny |
| `af06731f` | 26d | aluno gravar o áudio novo | aluno (legítimo) |
| `99a20692` | 23d | aluna terminar o formulário do SGP | aluna (legítimo) |

O sétimo é o `f1ada07e` (18,9d, 17 e-mails), a classe da **cobrança em dobro** —
e ele está travado nas mesmas duas coisas de sempre (frase escrita do titular
pelo 9-C, ou o "pode" do Johnny pro reembolso). Medi o que dava pra medir nele
(§4) e fui pro primeiro cartão que eu conseguia levar **até o fim** nesta ronda.

Isso é o que a regra 8 manda fazer quando trava: dizer em QUE passo parou e
seguir. Registro para a próxima ronda não "descobrir" de novo que a fila de cima
está parada — ela está, e o número que mede isso é o 17 do `esperando_johnny`.

---

## 3. Serial: `7aa7bea2` (#519, Bárbara) — **fechado**, e o que a casa devia era uma retratação

**Ela estava 30h sem resposta** numa pergunta de 22/09 11:55Z. Pior: a pergunta
existia porque a carta da casa, 1h antes, **ofereceu uma coisa que não existe**.

### O que a casa ofereceu e não tinha

A carta de 22/09 10:44Z (uid 3167) dizia, com estas palavras, que migraria tudo
pro outro e-mail *"SE você fizer questão"*. Ela **fez questão** às 11:55Z. E as
duas notas do vigia das 12:13Z e 12:17Z, do mesmo dia, já tinham medido que
**não existe mecanismo de transferência**: nenhuma rota (`api/v1/account/` só
tem `delete`; `admin/users` só exporta GET), nenhuma das 59 ferramentas, e
`updateUserById`/`email_change` com **zero** ocorrência no repo — o e-mail mora
no auth do Supabase e nada do nosso código o altera.

Ou seja: a medição que desmentia a oferta **já estava escrita no cartão** e
ficou 30h sem virar carta. O que a casa devia não era uma migração. Era uma
**retratação**.

### Medido vivo antes de escrever (não aceitei nota de ontem)

```
barbaramclone  bdea7677 · pro · 90.000 cr · acesso ate 29/09 12:00Z · 1 voz · 1 geracao · FU0CVMYR ACTIVE
barbaramuller  24ade116 · pro · 100.000 cr · acesso ate 24/09 12:00Z · 0 voz · 0 geracao · 7BETGK84 CANCELED
```

Detalhe que a nota de 22/09 10:45Z não podia ter: o saldo da clone **caiu de
100.000 para 90.000** (o treino da voz consumiu). Carta que repete número velho
vira a próxima dúvida do aluno.

### A carta (uid **3276** confirmado na pasta Enviados)

`msgid <frank-1790185728447-m9lgrwy1659@fastcloner.com>`, linha **conferida em
`emails_enviados`** depois de gravar (23/09 17:48:51Z, origem `ronda-manual`).

Diz: (a) transferência não existe, e **o erro de ter oferecido foi meu**,
assumido por escrito; (b) **não assinar de novo em paralelo**, com o motivo
concreto — é assim que nasce a cobrança em dobro do `f1ada07e`, 4 pessoas
medidas hoje; (c) o estado das duas contas com as **duas datas reais** (24/09
09h BRT termina o acesso da muller; 29/09 09h BRT nasce o R$97 da clone); (d) a
recomendação de ficar na conta que tem o material; (e) se ela fizer questão
mesmo assim, eu **registro o pedido sem prazo** e nunca com duas assinaturas
ativas ao mesmo tempo.

**Não prometi prazo** pra uma operação manual que eu não posso garantir. Foi
exatamente a promessa fácil que criou este caso.

### Por que `fixed` e não `aguardando_aluno`

A dúvida está respondida e a casa não deve mais nenhuma ação. Cartão aberto
**trava a Fast de responder** (está escrito no "O QUE FAZER" do próprio
cartão), e se ela responder o cartão **reabre sozinho** — mecanismo provado no
`99a20692` em 22/09. Gravado e conferido na releitura: 1 linha afetada, 12
notas, `resolution_note` 940 chars, `resolved_at` 17:50:14Z.

---

## 4. `f1ada07e` — dois relógios medidos, e um deles já passou

Nota gravada no cartão (47 notas, 1 linha afetada). Não mexi em status, dinheiro
nem assinatura.

**O relógio do Carlos passou sem cobrança nova.** Quatro rondas seguidas (20 a
22/09) escreveram *"Carlos cobra nas DUAS pernas em 22/09 12:00Z"*. Passaram-se
~30h e a Hotmart viva não mostra terceira cobrança paga: `MY5O3KWB` segue com as
pagas de 13/08 e 28/08, `UMJP7PDY` com a de 28/08, e as duas `access_until`
venceram em 22/09 com `updated_at` parado em 05/09 (nenhum webhook desde então).

> ⚠️ **Não afirmo "não cobrou em definitivo".** Cobrança pode estar falhando ou
> em retentativa e aparecer depois. O que está medido é: até 23/09 17:55Z não
> existe 3ª cobrança **paga**, e as duas pernas venceram. O que sobra do Carlos
> é o **reembolso** dos R$194 já tirados na perna órfã, que é do Johnny.

**O relógio vivo agora é o Leandro** — e é o único com cobrança dupla **futura**:
`J9HMYL9P` ativa até 28/09 (pagou R$97 em 28/08) e `4XVSU9U7` ativa até 30/09
(pagou R$97 em 05/09). São 5 e 7 dias. Ele foi escrito em 20/09 nos dois
endereços (uid 3047/3048) pedindo a frase do 9-C e **não respondeu** (cartão não
reabriu, sem nota nova). Falta a frase dele **ou** o "pode" do Johnny.

Nassara: `4C8EVSH4` vence 24/09 e é a **única** perna viva dela — a dupla dela é
histórica, o que resta é reembolso, também do Johnny.

**Caso novo evitado hoje:** a Bárbara tinha proposto assinar uma **terceira** vez
em paralelo. Se a casa tivesse respondido "pode", nascia mais um caso desta
classe — desta vez **por resposta nossa**, não por cancelamento que pegou na
conta errada.

---

## 5. Resíduo estrutural que não fecha em cartão de atendimento

O curso manda o aluno criar um segundo e-mail, e o sistema **não amarra os dois
nem sabe transferir**. Três alunos disseram a mesma frase em 24h — Bárbara
(#519), Luis (#522) e Wallana (`99a20692`). Enquanto não existir transferência,
todo aluno que obedecer a instrução do curso ao pé da letra cai no mesmo lugar.
É item de **produto**, levado ao grupo; não é defeito que a ronda conserta.

---

## 6. Fim de ronda

- Log commitado na **main** (regra 25-B).
- Nenhum fix preso em branch de feature: **nenhum código de produção foi tocado**
  nesta ronda.
- Escritas: carta à Bárbara (uid 3276, linha conferida em `emails_enviados`);
  nota + fechamento do `7aa7bea2`; nota no `f1ada07e`.
- Grupo: postado (fechamento do #519, a carta, a medição dos dois relógios do
  #254 e o item de produto).
