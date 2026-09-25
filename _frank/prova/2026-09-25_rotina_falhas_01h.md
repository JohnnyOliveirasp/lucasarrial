# Ronda das falhas — 25/09, ~00:40–01:05Z

**Item serial (regra 8):** o **#340** (Ulysses, `5886e58f`) — o cartão mais
abandonado da fila com aluno nomeado, **parado 11,2 dias**. A ronda anterior o
nomeou por escrito: *"o #340 é barato e tem aluno com nome"*, e registrou que
era **a terceira ronda seguida** em que a cabeça da fila de ALUNOS não andava.
Andou hoje.

**Não fechei o #340** — e o motivo está declarado com data, não é "precisa de
um humano" jogado no vazio. Mas a ronda achou uma coisa que ninguém tinha
medido, e ela tem prazo: **a classe inteira estava perdendo a janela de garantia
em silêncio, e sobrou exatamente UMA pessoa que ainda dá pra salvar.**

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1265 lidas · 1188 já tinham linha · **0 escrituráveis**. Contagem fecha **1265 = 1265**. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | **RODADO** — a pendência que a ronda anterior declarou está **paga**. Veredito: **0 carta depois do corte** fora da tabela. O buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho **0d**. Controles positivo (#310) e negativo (#518) OK, **550** varridos. |
| `2026-09-24_escolher_o_abandonado.cjs` | **157 abertos** (open 12 · investigating 110 · aguardando_aluno 35) · 146 com aluno nomeado · mais abandonado **11,2d (#340)**. |

As **77 cartas** anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — inalterado, continua decisão de produção, não de ronda.

> A pendência de ontem foi a primeira coisa da ronda, antes de escolher item.
> Dívida declarada por mim mesmo se paga antes de arrumar trabalho novo.

---

## 2. O item serial: o #340, e o relógio que ninguém tinha olhado

### 2.1 O que o cartão já sabia (13/09) e por que travou

Ulysses Monteiro Machado pagou e **nunca recebeu nada**. A carta de acesso
quicou com `550-5.1.1 NoSuchUser` — endereço morto, reenvio nunca entrega. Em
13/09 uma ronda achou o **telefone** dele na Hotmart e parou ali, porque
telefone é **canal EXTERNO** e falar por ele em nome da casa não é alçada de
ronda. O aval foi pedido em **13/09, 17/09 e 19/09**. Não foi respondido.

**Foram esses 11 dias de espera que produziram o fato abaixo.**

### 2.2 O fato novo: a garantia dele venceu enquanto ele esperava na nossa fila

```
warranty_date (Hotmart) = 2026-09-17T00:00Z
hoje                    = 2026-09-25
→ VENCIDA há 8 dias
```

Ele pagou **R$ 993,45** (SGP R$ 741,00 `HP2326756448` + Fábrica R$ 252,45
`HP2327895371`, ambas COMPLETE em 10/09) e a entrega é **ZERO**: `last_seen_at`
NULL (nunca logou), `access_until` NULL, 0 crédito, `sgp_pedidos` 0, `voices` 0.
**Ele não pode mais pedir o dinheiro de volta sozinho.**

É o **mesmo desfecho do #207** (o Vigia avisou 11,7h antes, ninguém viu, a
garantia venceu e o aluno ficou com R$ 97 sem devolução) e do **#363**. A
diferença é a ordem de grandeza.

### 2.3 ⚠️ Uma hipótese de bug que eu levantei e a medição REFUTOU

O `garantia_por_produto.cjs` imprime, pro Ulysses, `ANTES: fim 16/09 FORA` e
`DEPOIS: (bloco null)`. Eu li isso como **defeito** — a função nova devolvendo
`null` (= ESCALAR) apesar de existir `warranty_date` legível. Ia virar achado.

**Não é defeito, e os dois sinais têm explicação boa:**

| sinal | o que eu achei | o que é |
|---|---|---|
| `DEPOIS: bloco null` | função nova não lê a data | é o bloco **MULTI-produto**, `null` **por design** em quem tem 1 produto — cai na linha única, como o próprio texto diz |
| `fim 16/09` vs `17/09` | erro de um dia | é `2026-09-17T00:00Z` renderizado em **BRT** (−3h) |

Registro porque **quase virou acusação**. Concluir pela leitura da superfície
sem abrir a função seria deduzir e chamar de medido — o erro que esta casa já
documentou contra si mesma. E registro pra que **ninguém "ache" esse bug de
novo** na próxima ronda.

Pelo mesmo motivo não usei a conta de *"compra + 7 dias"*: essa constante foi
**removida no #265** por estar errada em 648+24+3+1 compras. A data vem do campo
da **Hotmart** (`payload.data.product.warranty_date`), não de conta nossa.

### 2.4 A perna de e-mail está esgotada COM PROVA

Segundo endereço: **não existe**. Medido hoje no `segundo_email_por_cpf.cjs`
(controle positivo OK) — nenhum outro endereço sob o nome dele. Isto é negativo
**conferido**, não suposto. Não reenviei pro endereço morto e **não adivinhei
domínio parecido** — endereço parecido não é identidade, e o palpite entrega a
compra de um pagante na caixa de outra pessoa.

Ou seja: o bloqueio do #340 é **real**, tem data, e não é preguiça de canal.

---

## 3. O que a ronda entregou de novo: a classe inteira, com relógio

O pedido de aval vinha falhando há 11 dias porque era uma pergunta **sem
prazo** — *"pode falar com eles?"* — e pergunta sem prazo espera para sempre.
Então medi o que faltava: **quem já perdeu a janela, e quem ainda dá pra salvar.**

Ferramenta nova, commitada, só leitura, com controle positivo:
`_frank/ferramentas/2026-09-25_garantia_da_classe_de_bounce.cjs`

```
⛔ JÁ PERDERAM a janela: 5
    34d atrás · elianecaurim@ig.com.br      · FastCloner            (fim 22/08)
    11d atrás · sunesacristina01@gmail.com  · Sistema de Geração Pronto (fim 14/09)
     8d atrás · valdene_marques@msn.com     · Sistema de Geração Pronto (fim 17/09)
     8d atrás · ulyssemmachado@gmail.com    · Sistema de Geração Pronto (fim 17/09)
     5d atrás · horta.pericias@gmail.com.br · Sistema de Geração Pronto (fim 20/09)

✅ AINDA DENTRO: 1
   faltam 2d · alinedutra_@hotmail.com.br · Sistema de Geração Pronto (fim 27/09)

❓ NÃO MEDIDAS: 5
```

**O custo de não decidir parou de ser teórico: já aconteceu 5 vezes nesta
classe.** E sobrou **uma** chance de a decisão chegar a tempo.

### 3.1 A ALINE — R$ 849,45, vence 27/09, faltam 2 dias

Ela pagou em **20/09** (SGP R$ 597 + Fábrica R$ 252,45) e a carta de acesso
quicou **3 minutos depois da compra** (`550 5.5.0 mailbox unavailable`,
Outlook). `last_seen_at` NULL, 0 crédito, `sgp_pedidos` 0.

**Ela nem sabe que existe uma carta perdida — por isso nunca reclamou.** Silêncio
dela não é satisfação; é a aluna não saber que foi deixada de fora.

O trabalho pesado do caso dela **já estava feito desde 20/09**: bounce duro
confirmado, ausência de 2º endereço **conferida por nome na Hotmart**, telefone
localizado e **texto de WhatsApp escrito e pronto** no cartão. Falta **só alguém
apertar enviar**. A ronda de 20/09 não tinha como saber o prazo; agora tem.

Anotei o relógio no cartão dela (**#493**, `80a93595`) e no **#340**.

---

## 4. Escalado ao GRUPO hoje, marcado como urgente

Postado via `notify-grupo.sh` (canal de 31/08). Nada no privado.

O pedido foi ao grupo pela **4ª vez**, mas desta vez **com prazo e com duas
saídas concretas**, em vez de "pode falar com eles?":

1. um humano manda o WhatsApp — **o texto já está escrito** no cartão; ou
2. **me autorizam e EU LIGO** — ligação por telefone eu **consigo** fazer.

O caminho (2) é novo no pedido. As rondas anteriores registraram *"não tenho
sessão de WhatsApp nesta máquina"* e pararam aí — mas **WhatsApp não é o único
canal**: ligação eu tenho. Isso transforma o aval numa palavra que eu executo na
hora, em vez de tarefa que depende da agenda de alguém.

**Não liguei e não mandei nada.** Contato externo em nome da casa continua não
sendo minha alçada, e aval não se presume por urgência.

---

## 5. Achado lateral, registrado e NÃO consertado

A Hotmart confirma **2 compras pagas** do Ulysses; o nosso `payment_events` tem
**1 linha só** (o SGP). A compra da Fábrica **nunca chegou por webhook**.

Na mesma classe, **3 de 11** endereços têm **0 linha de webhook** apesar de
`contato_hotmart.cjs` achar compra paga viva em pelo menos 2 deles
(glaubermed R$ 694,00 · andy.silvestre R$ 733,60).

⚠️ **Não estou chamando isso de bug.** Há explicação concorrente e plausível: a
conta do Glauber foi criada pelo **lote de 04/09** (`origem='sgp_hotmart'`), e
conta que entra por importação não passa por webhook. **Separar "buraco de
webhook" de "entrou por outro caminho" exige medição que eu não fiz nesta
ronda** — e afirmar sem isso seria exatamente o erro do §2.3.

Fica como **pergunta nomeada** pra próxima ronda, não como achado. O que **está**
medido e vale desde já: **quem medir garantia pelo nosso banco enxerga menos do
que a Hotmart** — e a ferramenta nova diz isso na cara, imprimindo a contagem de
linhas e marcando `NÃO MEDIDA` em vez de "sem garantia".

---

## 6. Dinheiro, GPU, aluno

- **Não mexi** em crédito, acesso, plano, assinatura, saldo nem status de pedido.
- **Não estornei** nada, e **não decidi reembolso** de ninguém — os 5 que
  perderam a janela são decisão do Johnny, não de ronda.
- **Não gastei GPU**, não pedi retreino, não regenerei áudio de ninguém.
- **Não escrevi pra aluno nenhum.** Nos dois casos da ronda o e-mail está
  **morto com prova**, e o canal vivo é externo. A regra 8 me pré-autoriza
  e-mail **individual**; ela não me autoriza telefone.
- **Não reenviei** pro endereço que quicou e **não adivinhei** endereço parecido.
- **Não apliquei migration**, não abri PR, não mergeei nada.
- **Não apaguei branch**, **não toquei** nos 6 branches STALE do índice.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não li** a caixa do suporte@ pra triagem (a Fast marca como lido).
- **Não fechei** os dois cartões. Nenhum dos dois está resolvido, e `fixed` sem
  resolver é a regra 14, que continua inteira.

---

## 7. Fim de ronda

- Log e ferramenta nova commitados na **main** (registro em branch `feat/` é
  invisível pra próxima ronda — foi o que custou 9h em 19/08).
- **Nenhum código de produção** nesta ronda, logo nada preso em branch.
- `git log --oneline origin/main..HEAD` conferido **vazio** no fim.
- Recado no **grupo** via `notify-grupo.sh`. Nada no privado.

### O que fica pra próxima ronda, com nome

1. 🔴 **A ALINE VENCE 27/09.** Se a palavra não tiver vindo, ela vira a **6ª**
   da lista e a classe passa a ter **zero** salváveis. É o item mais urgente da
   fila, acima de qualquer PR.
2. **Os 5 que já perderam a janela** precisam de uma decisão de reparação do
   Johnny (é dinheiro, não é alçada de ronda). Hoje eles estão num limbo:
   pagaram, não receberam, e não podem mais pedir de volta.
3. **A pergunta nomeada do §5**: separar "buraco de webhook" de "entrou por
   importação" nas 3 fichas com 0 linha. Não fechar pelo sinal.
4. **`#332` é o próximo PR a vencer** (era 7d ontem), depois `#330`, `#328`,
   `#325`. Herdado da ronda anterior, **não trabalhado hoje** — escolhi aluno
   esperando, que é a prioridade escrita.
5. **Os 13 candidatos a remédio obsoleto** seguem por examinar, um a um.
6. A fila de alunos **andou** hoje, mas os outros 156 abertos continuam lá — o
   segundo mais abandonado é o **#380** (11,1d, lip-sync).

### Sobre o passo fixo do `git rev-list` (repito, porque continua valendo)

Ele acusa ~193 branches e boa parte é falso positivo (squash-merge deixa o
conteúdo na main com sha diferente); `git cherry` distingue, `rev-list` não.
Segue **proposto e não aplicado** — corrigir ordem não é alçada de ronda.
