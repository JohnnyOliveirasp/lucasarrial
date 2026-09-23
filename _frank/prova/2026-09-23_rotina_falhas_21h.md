# Ronda das falhas — 23/09, ~21hZ (Frank, dono da fila)

**Desfecho: 1 incidente FECHADO — `#223` (`506b7c3a`, Alana), 22,2 dias aberto.**
Fechado porque acabou, não porque cansei: o passo que faltava não tinha dono
nosso, e o motivo estava num fato que **16 notas anteriores nunca mediram**.

Nada gasto: sem GPU, sem crédito movido, sem migration, sem merge, sem código de
produção tocado, sem carta a aluno. As escritas foram **1 nota + fechamento de
incidente** e **1 recado ao grupo**.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1115 = 1115**, nenhuma sumiu (1038 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | **0** carta depois do corte fora da tabela. Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho 0d. Controle positivo (#310) e negativo (#518) OK, 520 varridos. |
| Censo da fila | **143** abertos (investigating 101 · aguardando_aluno 33 · open 9) · mais velho 55,3d |
| `fechados_que_disparam` | 16 fechados com sinal de vida, **1** nas últimas 48h — e conferido um a um, **nenhum é classe fechada que segue disparando**: nos 7 com `last_seen_at` nas últimas 48h o `resolved_at` é POSTERIOR ao disparo. Sem bug escondido aqui. |

As 77 cartas anteriores ao corte seguem sem decisão, como a ordem prevê.

---

## 2. Como escolhi o serial, e o que declarei bloqueado

Refiz a descida em vez de herdar a conclusão da ronda das 20hZ. Do topo pra
baixo, quem **não** era acionável e por quê:

- **`d3d8d1b2` (#15, 55,3d)** — espera merge/decisão do Johnny. Marca recolocada
  pelo Vigia hoje 16hZ.
- **`37bacb68` · `f8587cef` · `f1ada07e`** — trabalhados hoje, nas rondas de 17h,
  13h45 e 18hZ.
- **`af06731f` (26,2d)** — 2ª tentativa saiu **ontem** (22/09, uid 3178). Bola
  dela, 1 dia. Fora do meu colo pela regra 8.
- **`99a20692` (23,3d)** — respondida 22/09 (uid 3197). Bola dela.
- **`8b8fc4c8` (22,3d)** — mão humana no painel da Hotmart, já escalado.
- **`7ed72ad0` (22,2d)** — os 5.680 cr foram devolvidos em 21/09.
- **`b0ddd483` (22,0d)** — respondido 21/09 (uid 3141).
- **`702cc916` (22,1d)** — decisão de produto sobre rigor do QA, na mesa do Johnny.
- **`132f7808` (19,2d) e `8c29740f` (19,1d)** — **reli as duas notas inteiras
  hoje**, não herdei o rótulo. Continuam travadas em autorização de WhatsApp
  (10 pagantes, R$ 8.250,27) e na entrega do `#426`. Sem fato novo desta ronda.

Sobrou o **`506b7c3a`**: `aguardando_aluno` desde 16/09, **sem carta desde
13/09**, aluna nomeada, e o único do topo sem dono em terceiro.

---

## 3. O caso: `#223` / `506b7c3a` — Alana Barboza, `alana_pinho@hotmail.com`

### 3.1 O que o cartão era

Ela entrou em 01/09, gravou 5 áudios no Gravador, as gravações sumiram (o
Gravador salvava no navegador, não na conta) e em ~1h20 ela escreveu pedindo
cancelamento *"da compra feita hoje mesmo por não corresponder"*. 21 cartas na
história do caso.

### 3.2 O fato que ninguém tinha escrito: **ela cancelou, e antes das nossas duas últimas cartas**

`payment_events` — os **dois únicos** eventos dela, mesma transação
`HP4076199980`, oferta `ewxrfw9j`, produto 7851642:

| Recebido | Evento | purchase.status | subscription | price.value |
|---|---|---|---|---|
| 01/09 14:28:45Z | PURCHASE_APPROVED | APPROVED | **ACTIVE** | **0** |
| 09/09 09:31:10Z | PURCHASE_COMPLETE | COMPLETED | **CANCELED** | **0** |

O cancelamento entrou **09/09 09:31Z**. Nossas cartas **uid 1420 (09/09 15:49Z)**
e **uid 2150 (13/09 22:48Z)** saíram DEPOIS dele. E **nenhuma das 16 notas do
cartão tem a palavra "cancelamento"**.

O rótulo `aguardando_aluno` estava certo por acaso e pelo motivo errado: não era
formulário pela metade, era **aluna que foi embora**. É a mesma doença que a
ordem de 21/09 já pegou nesse rótulo — ele mente sobre quem deve o próximo passo.

### 3.3 Dinheiro: **zero**, e conferi a armadilha antes de afirmar

`price.value = 0` nos dois eventos. `pagou_de_verdade.cjs` na Hotmart viva:
**sem pagamento** neste endereço (assinatura rec#1 0 BRL COMPLETE, venda 0 BRL
COMPLETE). `ewxrfw9j` é a oferta de **teste gratuito** — a mesma que aparece no
caso Neto Rocha, também em R$ 0.

A armadilha do README ("compra num e-mail, app em outro") foi medida, não
presumida: busca por `alana%` e `%barboza%` em `profiles` devolve 4 perfis e os
outros 3 são **gente diferente** (`correabarbozaadv@hotmail`,
`correabarbozaadv@gmail`, `alana.rossi@gmail`). Ela nunca foi cobrada um
centavo, logo o pedido de cancelamento de 01/09 **não tinha estorno atrás dele**.

### 3.4 O que a casa devia foi entregue, e está em produção

- **Defeito do Gravador:** `fb06a43a` *"gravador: gravou = salvo na CONTA, nao
  no navegador (caso Allan/Alana)"* + merge `4782871d`. Conferido **hoje** com
  `git merge-base --is-ancestor`: os **dois são ancestrais de `origin/main`**.
  Card "completed" não conta; isto conta. O commit foi escrito com o nome dela.
- **As 5 gravações:** confirmadas no R2 em 16/09 (5 ETags distintos) e contadas a
  ela por carta em 13/09 (uid 2150, cópia confirmada na pasta remota).
- **O cancelamento:** concedido (§3.2).

### 3.5 A porta que prometemos continua aberta — conferida no CÓDIGO

A nota de 16/09 disse *"porta de treino aberta"* olhando **só o saldo**. Fui ver
o portão de verdade, porque prometer porta aberta seria a 5ª promessa deste
cartão (ele já tem duas quebradas na história: o *"dia 07 eu te mando um update"*
que nunca saiu, e o *"já foi estornado"* do cartão irmão que não tinha sido):

- `frontend/src/app/api/v1/voices/[id]/start-training/route.ts:100-121` — o
  **único** gate é `getBalance() < TRAINING_CREDIT_COST`. `hasActiveAccess()`
  aparece ali só pra escolher o texto do CTA no 402; **não tranca**.
- Ela tem **99.475 cr** (100.000 `subscription_grant` 01/09 − 525 de uma imagem
  em 02/09) e `access_until = null` **não** bloqueia treino.
- E o crédito não evapora: `expire_trial_credits` está **desligada no banco
  desde 18/08** e a v2 (`scripts/85_trial_expiry_v2.sql`) é **espelho, não
  aplicada** (`_frank/prova/trial_expiry_v2/ANALISE.md`).

Conclusão: a carta de 13/09 era verdadeira **e continua verdadeira**. Registro
de propósito, porque o caminho fácil aqui era fechar sem conferir e deixar uma
promessa não auditada de pé.

### 3.6 Por que não escrevi uma 22ª carta

A régua dos 7d+ pede segunda tentativa pra aluno que **espera a casa**. Ela não
espera nada: a última palavra dela foi 09/09 (`last_seen_at` do cartão
09/09 12:50Z), **na mesma manhã em que cancelou**, e a nossa resposta final saiu
depois disso. Escrever agora pra quem cancelou um teste gratuito é
**reconquista, não suporte** — e reconquista sobre ex-aluno não é decisão minha
de ronda.

### 3.7 Fechamento

`status = fixed`, `resolved_at = 2026-09-23T20:47:33Z`, `resolved_commit =
fb06a43a`, `agent_notes 16 → 17`, `resolution_note 4759 → 5477 chars`
(**concatenado**, não sobrescrito). Gravação **conferida na releitura, 1 linha
afetada** — não é o que o script planejava, é o que o banco devolveu.

---

## 4. Fila do Johnny

Sem mudança desta ronda: o lote de **20 decisões** foi ao grupo às ~20hZ e
continua na mesa dele. Não re-escalei nada — a doutrina de 17/09 aplicada a
decisão manda juntar num lote, não repetir um caso por ronda. O `#223` **sai**
da conta de abertos sem entrar na dele: não gerou decisão nenhuma.

---

## 5. Fim de ronda

- Log commitado na **main** (regra 25-B).
- **Nenhum código de produção foi tocado**, logo não há fix preso em branch de
  feature. Conferido com `git log origin/main..HEAD` e `git branch`.
- Escritas: nota + fechamento em `506b7c3a` (conferido, 1 linha afetada).
- Grupo: **1 linha postada** (fato consumado: o `#223` fechado e por quê).
  Nenhuma ronda vazia, nenhum log de terminal, nenhum progresso parcial.
