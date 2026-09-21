# Ronda das falhas — 21/09 ~15h30–16h20Z

Ronda dentro da janela do turno (08h–23h BRT). Alvo serial: **#254 `f1ada07e`**,
cobrança em dobro — 17 dias, o mesmo cartão das rondas de 00h30, 14h e 15h.

**Uma carta a aluna que nunca tinha sido avisada, DUAS correções de valor de
dinheiro no mesmo cartão, um fix em produção com deploy SUCCESS, e a classe de
percepção triada até o fim.** Zero GPU, zero crédito tocado por mim, zero
migration, zero assinatura cancelada. O cartão **não** fechou, e a seção 6 diz
por quê.

Ordem de 29/08 respeitada: nada da planilha foi lido, escrito ou reprocessado.
Canal (ordem de 31/08): **postei no grupo**, 3 mensagens, fato consumado + dois
itens marcados como urgentes.

---

## 1. Passos fixos

**Reconciliação dos envios** (passo fixo desde 18/09):

| | |
|---|---|
| lidas da pasta `Sent` | 923 |
| já tinham linha | 846 |
| fora da janela (`--corte`) | 77 |
| **RECUSADAS (defeito)** | **0** |
| **escrituráveis dentro da janela** | **0** |

Fecha 923 = 923. Irmão de leitura independente
(`2026-09-18_enviados_x_tabela.cjs`): **0 carta depois do corte**, veredito "o
buraco é PASSIVO". As 77 anteriores a 14/09 14:06:31Z seguem sem decisão
(inalterado desde 18/09).

Nota de saúde: a pasta foi de 918 → 923 desde a ronda das 15h, e as 5 novas
**já tinham linha**. O ledger continua sendo escrito na hora.

**Fila:** 95 abertos, 41 com 7d+.

---

## 2. A classe de PERCEPÇÃO: o detector da ordem de 17/09 está gritando falso

A ronda das 15h reportou **2 cartões**. Rodei a consulta da ordem e vieram
**18**; trocando `%assistir%`/`%ouvir%` por `%olho humano%` vieram **31**. Antes
de acusar a ronda anterior de ter subcontado, fui conferir — e quem estava certo
era ela, pelo resultado, não pela consulta.

**Triado cartão a cartão (despachado ao `generalist`, card `2776351f`), o
veredito dos 31 é:**

| categoria | n |
|---|---|
| FALSO_POS (palavra bateu por acaso) | 9 |
| OUTRO_BLOQUEIO (dinheiro do Johnny / espera aluno) | 11 |
| JA_FEITO (perícia já despachada, laudo já voltou) | 11 |
| **TRAVADO de verdade** | **0** |

**Conferi dois por mim antes de aceitar o relatório do operário**, e bati com
ele nos dois: o `6fabb64a` (Alexandre) já tinha laudo do `olho`, instrumento
próprio com 4 controles e carta enviada — e o `f8587cef`/`702cc916` casam só
porque o whisper alucina a frase *"obrigado por assistir"*, que aparece citada
na nota.

**O defeito do detector, que vale registrar porque vai enganar a próxima ronda:**
ele casa com notas que **registram perícia JÁ FEITA** — quanto mais a casa
despacha, mais o contador sobe. E a frase *"precisa de olho humano"* dos recados
da Carol quer dizer "precisa de um humano", não "precisa de visão". Hoje o
detector é ~100% falso positivo. **Uma conferência que sempre grita é uma
conferência que ninguém lê** — exatamente o que a ronda das 15h escreveu sobre a
checagem de branches do manual. Proposta, não aplicada: excluir nota que já
contenha veredito (`%laudo%`, `%veredito%`, `%despachado%`) e a frase da Carol.

O grosso do trabalho é de ONTEM, não meu: o card `ddfaf5e5-esc` (20/09) despachou
7 com artefato aberto e declarou 7 bloqueios reais. **Mérito da ronda de 20/09.**

**Idade do mais velho da classe crua: 20d** (`702cc916`, #226) — mas ele está
parado em **decisão do Johnny**, não em falta de olhar.

---

## 3. Herineth: a dívida é o DOBRO do que o cartão registrava, e ela nunca soube

Item nomeado #2 da ronda das 15h (regra das 24h: escrever mesmo sem o "pode").

Fui escrever e descobri que o valor estava errado. Medido em `payment_events`
**por assinatura**, não por e-mail:

| assinatura | e-mail | estado |
|---|---|---|
| `PPEVZBRG` | `herysilva.27@` (COM ponto) | **cancelada**, acesso até 21/09 |
| `FKJBI6C2` | `herysilva27@` (SEM ponto) | **ativa**, acesso até 21/10 |

São o **mesmo Gmail** — o provedor ignora o ponto, a mesma caixa recebe as duas.
Duas inscrições em 21/07 com 70 min de diferença.

**Pago na perna DUPLICADA, as duas COMPLETED:** `HP1645104140` 22 USD (18/08) +
`HP1422712698` 22 USD (30/08) = **44 USD, não 22.** Total pago por ela: 110 USD.

**Por que o erro passou, e onde ele ainda mora:** `pagou_de_verdade.cjs`
consultado por UM dos endereços devolve só as transações daquela perna. Quem
mediu por e-mail viu **metade da conta**. Medir por **assinatura** é o recorte
que fecha. Não remedi os outros 4 do cartão — fica nomeado.

**Carta enviada** (a 1ª sobre dinheiro em 17 dias; a única anterior, de 17/09,
era sobre outro assunto). Três pernas conferidas: **uid 3096** + linha em
`emails_enviados` + chave `dobro-254-herineth-44usd`. Ela é de **Angola**
(checkout AO, moeda USD), carta em português. Dei o valor medido, disse que a
duplicada já está cancelada, e disse **sem data** que devemos — porque não tenho
data. Não a empurrei pra Hotmart.

---

## 4. Nassara: pagou 3 ciclos, recebeu 1 — e caiu no ponto cego da remediação de hoje

Mesmo padrão, segundo cartão de dinheiro corrigido na mesma ronda.

Duas assinaturas, **o mesmo `user_id`** (`af1fcbce`): `ZKJBP56C`
(`nassaramesquita@`, e-mail da conta) e `4C8EVSH4` (`nassarab@`, outro e-mail).

| pago (tudo COMPLETE) | assinatura |
|---|---|
| `HP1724745592` 97 BRL (30/07) | ZKJBP56C |
| `HP2852243759` 97 BRL (31/07) | 4C8EVSH4 |
| `HP0163870136` 97 BRL (24/08) | 4C8EVSH4 |

**291 BRL pagos, 3 ciclos. Creditado: UMA linha, 100.000 cr em 07/08.**
(`HP3381746828` ficou DELAYED e **não** foi pago — não entra na conta.)

Os dois ciclos da `4C8EVSH4` nunca creditaram: é **exatamente o defeito do #381**,
que mergeei nesta ronda. Ela é a mesma família do Marcio e da Fernanda, que o
Johnny mandou creditar hoje 13:53 (commit `225954a9`, autorização explícita
registrada no corpo do commit) — **mas ficou de fora**, porque aquela varredura
pegou quem tinha **ZERO** linha no ledger, e ela tem uma, da outra perna.

**Ponto cego registrado:** o recorte "zero linha no ledger" perde quem tem duas
assinaturas e foi creditado só numa. **Não varri** se há outros nesse ponto —
fica nomeado, não afirmado.

**A perna dela é 194, não 97**, e o remédio é **UM só**: devolver R$194 **ou**
creditar 200.000 cr, nunca os dois. Não decidi e não executei: reembolso não
está na 9-B em valor nenhum, e 200.000 cr estoura meu teto de 20.000 cr.

---

## 5. PR #381 revisado e em produção

Item nomeado #6 da ronda das 15h. Regra 14-B: código sem DDL, quem pega **revisa
e mergeia**.

**Conferido por mim, não herdado do corpo do PR:**

| verificação | resultado |
|---|---|
| `credito-assinatura.test.ts` | 9/9 pass |
| pasta `src/lib/payments` inteira | 244/244 pass |
| `tsc --noEmit` | exit 0 |
| **mutação reproduzida** (`doEmail ?? doEntitlement` → `doEmail`) | **derruba 5 de 9**, restaurado 9/9 |

Li o módulo: é puro, sem import, e com entitlement nulo devolve
`creditar`/`refId`/`avisarOrfa` **idênticos** ao que o `route.ts` fazia antes —
equivalência conferida na leitura, não suposta. A leitura que falha **lança**
(500 → Hotmart reenvia), então blip de rede não vira "compra órfã".

Merge **`24e42a00`** na main, **deploy SUCCESS** (run 35621561547, 2m47s).
Sem `.sql` e sem migration: não depende de DDL aplicado.

**Não paga em dobro** com a remediação de hoje: a chave é a TRANSAÇÃO e a RPC
`grant_subscription_credits` deduplica por `(user_id, kind, ref_id)` — conferido
no corpo do commit `225954a9`, que usou o mesmo par.

---

## 6. Por que o cartão NÃO foi pra `fixed`

Das 5 vítimas, Solon (13/09) e Jackson (15h de hoje) têm desfecho. Sobram três, e
as travas são as de sempre — agora **com os valores corrigidos**:

1. **REEMBOLSO** — Carlos R$97, Leandro R$97, **Nassara R$194** (era 97),
   **Herineth 44 USD** (era 22), Jackson R$97. Devolver dinheiro de cartão **não
   está na 9-B em valor nenhum**. Pedido no grupo em 04/09 ~20hZ → **17 dias**.
2. **A frase do 9-C** de Carlos (6 cartas, prazo **amanhã**) e Leandro (2 cartas,
   prazo 28–30/09).

Status: `investigating`, **duas** notas gravadas (39 → 40 → 41, 1 linha afetada
cada, conferidas na releitura).

---

## 7. Carlos: escalado como urgente, porque o relógio vence amanhã

Remedido vivo (`assinatura_em_dobro.cjs`): `MY5O3KWB` (`caplastica@`, dono
**ÓRFÃO**) e `UMJP7PDY` (`gutoassuncao16@`) as **duas active até 2026-09-22 —
amanhã**. R$291 já pagos no total.

**Não respondeu, e isto é conclusivo, não limite de ferramenta:** `ler_caixa
--de` nos dois endereços = nada, e `--fila` (não-lidos no INBOX) = **0**. Com a
fila vazia, não há resposta por ler. Nenhum cartão novo dele na fila.

**Postei no grupo como URGENTE** pedindo o "pode" pra cancelar a órfã sem o
pedido dele. Não cancelei por conta própria: a 9-C autoriza cancelar **a pedido
do titular**, e ele não pediu. **O preço está escrito:** sem resposta hoje, a
casa cobra R$194 amanhã e vira caso de devolução.

---

## 8. O que eu NÃO afirmo

- **Não afirmo que os outros 4 do #254 têm o defeito de medição da Herineth.**
  Só remedi a dela e a da Nassara. Os outros seguem com o valor antigo.
- **Não afirmo que a Nassara é a única no ponto cego** do filtro "zero linha no
  ledger". Não varri a base.
- **Não afirmo que o Carlos vai responder a tempo.** Seis cartas, zero resposta.
- **Não afirmo que a Herineth ficou satisfeita** — dei o valor e a parte sem data.
- **Não afirmo que a triagem dos 31 está isenta**: 29 dos 31 vieram do parecer do
  `generalist`; conferi 2 por mim e bati com ele nos 2.

---

## 9. O que fica nomeado pra próxima ronda

1. **Carlos** — se respondeu, cancelar na hora pelo 9-C. Se não e a cobrança
   dupla saiu, a perna dele vira devolução.
2. **Varrer o ponto cego da Nassara**: quem tem 2+ assinaturas e foi creditado
   só numa. O filtro de hoje não pega.
3. **Re-medir as outras 3 pernas do #254 por ASSINATURA**, não por e-mail — dois
   de dois que remedi estavam pela metade.
4. **Consertar o detector de percepção** da ordem de 17/09 (seção 2): hoje é
   ~100% falso positivo.
5. **#226** — não falta medição, falta a escolha do Johnny.
6. **PR #382** e os outros — ver seção 10.
7. **`feat/resumo-diario-grupo-suporte`** (seção 10): decidir o destino da
   decisão do Lucas de 04/09 que nunca subiu, e tirar 9 arquivos de prova de
   dentro do branch pra `main`, que é onde o manual manda registro morar.

---

## 10. Passo fixo de fim de ronda

Registro vai **direto na `main`**. O código desta ronda saiu por **PR mergeado**
(#381), não por commit direto.

**51 PRs abertos** no repositório. Revisei e mergeei **1**. Não inflo o número:
os outros 50 seguem sem revisão, e isso é backlog real, não ruído.

Conferência de branches pelo recorte que responde à pergunta ("ficou fix DESTA
ronda preso?"), filtrando por data do tip — **não** pela contagem do manual, que
a ronda das 15h mediu dar ~190 falsos positivos por causa de squash. Sobram 3:

| branch | situação |
|---|---|
| `feat/510-assinatura-constante-infra-storage` | **PR #382 OPEN** — em revisão, não invisível |
| `feat/credito-cai-pro-dono-do-entitlement` | **mergeado por mim** (`24e42a00`); branch já apagado no origin |
| `feat/resumo-diario-grupo-suporte` | ⚠️ **23 commits, SEM PR** — ver abaixo |

### ⚠️ Achado do passo fixo: tem decisão do Lucas presa em branch há ~17 dias

O `feat/resumo-diario-grupo-suporte` tem **23 commits, nenhum PR**, tip de HOJE
15:11Z (alguém ainda escreve nele). São **8.421 linhas em 51 arquivos**, e não é
só log:

- **Registro de ronda** — 9 arquivos de `_frank/prova/` (17/09 a 21/09:
  relatório noturno, cancelamentos, 4 medições da promessa do Video Clone).
  O manual é explícito: *"Registro que fica em branch feat/ é invisível pra todo
  mundo, inclusive pra você na ronda seguinte."* **Essas provas estão invisíveis.**
- **CÓDIGO VIVO** — `escalate.ts` (16 linhas), `escalate-canais.ts` novo, mais
  dois arquivos de teste e dois loaders.

O que o código faz, lido no diff: **decisão do Lucas de 04/09** — o time passou a
analisar os casos no painel do FastCloner, então o aviso automático de escalação
no WhatsApp virou ruído e foi desligado (`AGENT_ESCALATION_WHATSAPP`, padrão
OFF). **Isso nunca chegou em produção.** A main ainda manda o zap que o Lucas
mandou parar, há ~17 dias.

**NÃO mergeei, e digo por quê** em vez de só deixar passar: são 8.421 linhas sem
revisão, misturando prova e código, e o pedaço de código **muda comportamento de
produto por decisão de sócio** — não é o "código sem DDL" que a 14-B me manda
mergear sozinho; é da mesma família do #226, que a ronda das 15h deixou com o
Johnny. Merger a coisa toda no fim da ronda seria exatamente o atropelo que a
regra tenta evitar. **Fica nomeado na seção 9 e foi pro grupo.**

Não confundir com falso positivo de squash: aqui o `git ls-remote` confirma o
branch **vivo no origin** e o `gh pr list --head` devolve **vazio** — não há PR
nenhum, nem aberto nem fechado. É invisibilidade real, não artefato da contagem.
