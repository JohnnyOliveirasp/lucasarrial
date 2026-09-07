# Ronda das falhas — 07/09, ~00hZ (21h BRT de 06/09)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** item e levei até onde ele dá pra ir — e digo exatamente em que passo ele
parou e por quê.

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no
**GRUPO**, nada foi pro privado. Turno: 21h BRT, dentro da janela 08h–23h.

---

## 0. A ronda em uma linha

**O #265 dizia "57 alunos dentro da garantia e o sistema diz fora". Medi: são
43, e nenhuma delas depende de bug — o bug foi corrigido e está no ar desde
05/09. As 43 dependem só de uma decisão de dinheiro do Johnny, e essa decisão
apodrece sozinha: 7 pessoas perdem a garantia amanhã.**

---

## 1. Por que peguei o #265 e não um mais velho

Fila no início: **37 não-fechados** — 25 `investigating`, 12 `aguardando_aluno`,
0 `open`. Bate com o Vigia das 00hZ.

Pela regra 8 eu pego o mais antigo com aluno afetado. Fui conferir os mais
velhos **antes** de escolher, em vez de assumir:

| # | idade | por que não é ele agora |
|---|---|---|
| #15 | 39d | preso na **migration 82** — decisão do Johnny |
| #47 / #99 / #172 | 19d / 15d / 10d | `aguardando_aluno` — bola com o aluno (ordem 21/08) |
| #222 | 6d | espera reenquadrar-ou-fechar — decisão do Johnny |
| #226 | 6d | cobrar/estornar 290 gerações — decisão do Johnny |
| #234 | 5d | destravado pelo #226 |
| #237 | 5d | aluno não identificado, 1 pessoa |

Todos os mais velhos que eu **poderia** fechar estão parados em decisão de
terceiro. O #265 não estava: é dinheiro, são dezenas de pessoas, e ninguém
precisava me destravar pra eu medir. Escolhi por isso, não por ser mais fácil.

## 2. Primeiro conferi o estado atual — e metade já estava resolvida

Passo (1) do manual: *já resolveu sozinho?* Já, metade. O `account.ts` não tem
mais a constante — existe um `garantia.ts` novo citando o próprio #265.

**Não aceitei o comentário como prova.** Conferi as três pontas que o manual
manda conferir:

- **Está na main?** `ed0f266` é ancestral de `origin/main`. Sim.
- **Está em PRODUÇÃO?** `Deploy Frontend (production)` do merge `b4a7a390`
  (PR #191) = **SUCCESS 05/09 22:48Z**. Conferi o **desfecho** do run, não o
  disparo — "deploy feito" não é "funciona" (lição do apagão de 05/09).
- **Depende de migration?** Não. `janelaGarantia()` é função pura, sem coluna
  nova. Não cai no *DDL commitado ≠ DDL aplicado*.
- **Os testes passam?** Rodei eu mesmo: `account-garantia.test.ts` **10/10**.

Então o defeito **(2) CONSTANTE** (`GARANTIA_DIAS=7` fixo) está resolvido e no
ar: a janela agora vem de `payload.data.product.warranty_date`.

## 3. O número do título estava errado — e errado de um jeito que importa

O título fala em **57**. Remedi hoje replicando a lógica de produção sobre
`payment_events`, em SQL cru pela Management API — **sem o teto de 1000 do
PostgREST**, que é a armadilha registrada na ordem de 20/08.

| grupo | quantos |
|---|---|
| sistema diz **DENTRO** | 114 |
| diz **FORA** tendo garantia viva numa compra mais nova | **43** |
| **FORA** de verdade | 409 |
| universo de e-mails pagantes | 566 |

**São 43, não 57.** E o mais importante: **as 43 são 100% política e 0% defeito.**
Todas têm 2+ compras pagas (42 com duas, 1 com três). Quem tem uma compra só
tem `min(warranty) = max(warranty)` e é **aritmeticamente impossível** cair
neste balde. O `garantia.ts` anotou "54 política + 3 defeito" em 05/09; os 3 do
defeito saíram do balde porque o fix subiu. A conta fecha.

## 4. O que o título exagera — e o que ele esconde

**Exagera:** o ramo FORA não nega reembolso a ninguém. Ele manda *"NÃO prometa
reembolso; escale pro humano"*. Ninguém está sendo recusado automaticamente;
quem decide é gente. Risco residual honesto: a Fast recebe "FORA da janela"
como fato e pode verbalizar isso ao aluno antes de escalar.

**Esconde:** a decisão tem prazo, e o prazo é curto.

| garantia viva até | pessoas |
|---|---|
| 08/09 (**amanhã**) | **7** |
| 09/09 | 5 |
| 10/09 | 8 |
| 11/09 | 8 |
| 12/09 | 8 |
| 13/09 em diante | 7 |

**Não decidir até a semana que vem é decidir "não" para 40 das 43.** Foi isso
que eu levei ao grupo, marcado como urgente.

## 5. Aluno concreto por trás do número

Das 43, só **2** têm chamado aberto, e nenhum dos dois pede reembolso — ou seja,
não há ninguém batendo na porta agora. Mas um dos dois é o próprio afetado
registrado no #265: garantia viva até 12/09, quase 300 mil créditos e **sem voz
pronta há 28 dias por erro nosso** (voz `f6f82819`, falhou em 10/08). Se alguém
das 43 tiver motivo pra querer o dinheiro de volta, é ele.

## 6. Por que NÃO fechei

Regra 14, inteira: **não marco `fixed` sem ter resolvido.** O chamado descreve
dois defeitos; só um era código. A metade que atinge as 43 pessoas não está
resolvida — e ela não é minha pra resolver, é política de dinheiro.

Ficou `investigating` **com nota** (`agent_notes` 4 → 5, gravação conferida na
releitura, 1 linha afetada). `investigating` sem nota é o mesmo que não ter
olhado.

**Passo que emperrou:** decisão do Johnny — renovação mensal reabre a garantia
ou não?

## 7. O que eu NÃO fiz

Não gastei GPU nem crédito, não mexi em crédito/acesso/plano/entitlement, não
apliquei migration, não escrevi pra aluno (nenhum dos 43 pediu nada), não
escrevi em lote, não fechei nem reabri incidente, não mergeei branch nenhum e
não toquei em **nada** da planilha (ordem de 29/08).

Também **não** mudei o comportamento da âncora por conta própria. Mudar isso
move dinheiro de 43 pessoas com base num palpite meu sobre política — é
exatamente o tipo de coisa que a regra manda escalar, não resolver sozinho.

## 8. Registro: a Hellen já estava resolvida quando cheguei

A varredura acusou `hellengrasso@...` como pagante viva sem voz pronta (5 de 7
arquivos perdidos no envio). **Não era caso novo:** a ronda anterior já tinha
escrito pra ela às 23:48Z e o fix da tela muda subiu hoje (`1ba71a5`, deploy
SUCCESS 23:44Z). Conferi antes de agir — aviso repetido é ruído.

## 9. Continua precisando de DECISÃO do Johnny

Nada novo meu além do #265. Seguem de antes: **#222** reenquadrar ou fechar;
**#226** destrava o **#234**; **migration 82** destrava o **#15**; WhatsApp pra
Glauber e Anderson (#249/#250); e-mail em lote pros 8 do #290. Relógios: Diego
**08/09 12hZ**, Marcelo **11/09**, **13/09** pros dois do #290 — e agora
**08/09** pras 7 primeiras do #265.

⚠️ Repito o alerta da ronda das 23h porque ele não melhorou: **a fila está
travada em decisão, não em trabalho.** Dos 6 incidentes mais antigos que eu
poderia atacar, 4 esperam o Johnny. Eu consigo medir e preparar; não consigo
decidir por ele.

## 10. As lições

**Número herdado é dívida, não fato.** O "57" vinha sendo repetido desde 05/09 e
hoje valia 43 — e, pior, não significava o que aparentava: zero eram bug. É a
segunda vez em duas rondas que um número herdado cai ao ser medido (o Vigia
derrubou o "18" do #15 às 00hZ). **Meça o número do título antes de agir sobre
ele**, mesmo quando quem escreveu foi você.

**Chamado com dois defeitos vira meia verdade.** O #265 juntou um bug de código
e uma política de dinheiro sob um título só. O bug foi corrigido e o chamado
continuou parecendo um bug de 57 pessoas. Quando um chamado mistura "está
errado" com "não decidimos ainda", o pedaço decidido some e o pedaço pendente
se disfarça de defeito.

**Decisão adiada não fica parada, ela expira.** Aqui o adiamento não preserva as
opções: 7 pessoas saem da janela amanhã e 28 em cinco dias. Escalar sem o
relógio junto teria deixado o Johnny achar que dava pra ver na segunda.
