# Ronda das falhas — 23/09, ~20hZ (Frank, dono da fila)

**Desfecho da ronda: o LOTE de decisão foi ao grupo.** Não fechei incidente, e a
§3 explica por quê — a fila de cima não espera trabalho meu, espera palavra do
Johnny, e a doutrina de 17/09 aplicada a decisão manda **juntar num lote**, não
re-escalar um caso por ronda.

Nada gasto: sem GPU, sem crédito movido, sem migration, sem merge, sem código de
produção tocado, sem carta a aluno. As escritas foram **1 nota de incidente**
(`df008dcf`) e **1 card ao `coder`** (defeito de instrumento).

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1115 = 1115**, nenhuma sumiu (1038 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | **0** carta depois do corte fora da tabela. Buraco **passivo**. |
| `percepcao_travada.cjs` | **0** travados. Controle positivo (#310) e negativo (#518) OK, 518 varridos. |
| Censo da fila | **141** abertos (investigating 100 · aguardando_aluno 33 · open 8) · mais velho 55,3d |
| `esperando_johnny` | **17** conferidos pelo script — **20 na verdade**, ver §4 |

As 77 cartas anteriores ao corte seguem sem decisão, como a ordem prevê.

---

## 2. Quem eu descartei como serial, e com que medição

Refiz a descida em vez de herdar a conclusão da ronda das 19h. Os candidatos de
cima, um a um:

- **`8b8fc4c8` (Fabiana, 22,3d)** — o que falta é **mão humana no painel da
  Hotmart** (cancelar a assinatura dela). Já escalado em 21/09, e a casa deve a
  ela uma carta de confirmação **quando estiver feito**. Não é trabalho meu.
- **`52b22304` (Igor, 19,9d)** — veredito do `olho` já arquivado na nota em
  22/09, aluno já respondido por carta em 20/09. O que resta é decisão de
  crédito (está no lote).
- **`ff95507f` (Leonice, 15,9d)** — respondida e estornada em 19/09; o que
  sobrou é decisão de produto (botão de desfazer).
- **`59ef0ee2` (appseguropt, 5,4d)** — aparece como silêncio no recorte de
  "zero cartas", mas **não é**: o `suporte@lucasarrial.com` deu baixa em 18/09
  ("respondido via email"). É o **mesmo falso positivo da Leiliane** registrado
  na ronda das 19h — carta do time humano não passa pelo nosso SMTP, então nunca
  tem linha em `emails_enviados`. Registro de novo porque o recorte vai
  continuar produzindo esse falso positivo até alguém consertá-lo.
- **`dd1764e9` (estorno afirmado sem linha no ledger, 2,0d)** — parecia dinheiro
  devido, e **não é**: os 3 casos foram conferidos um a um em 21/09 e os três
  são falso positivo. Detector já despachado ao `coder`. **Não creditar
  ninguém.**

Ou seja: o topo da fila está bloqueado em terceiros, e o que parecia silêncio ou
dívida já tinha sido medido e descartado. Sobrou o lote.

---

## 3. O caso que andou hoje: `df008dcf` (André, `contatogrupoavip`)

Não fechei. Anotei, e a nota é **medição nova**, não repetição.

### O aluno voltou hoje, e perguntou exatamente a decisão que está parada

O cartão irmão `9eeb46dd` reabriu sozinho às **19:10:04Z** com a fala dele:
*"Comprei o curso onde vocês criam o clone e mesmo assim tenho que fazer a
assinatura? Então qual é a vantagem de comprar o produto pronto?"*

### A Fast já respondeu, e a resposta está certa — conferida no FONTE

Enviados **uid 3280**, 23/09 19:10:22Z. Ela diz: o curso inclui a **montagem**
do clone (feita); para **usar** precisa dos créditos da assinatura; a vantagem
do produto pronto é não configurar nem treinar.

Conferi contra o código, porque **carta não se audita por carta**:
`avisoOkMasAssine` (`frontend/src/lib/onboarding/avisos.ts:263-299`) manda
literalmente *"Seus arquivos estão prontos — falta só o acesso"* + link de
checkout, e a régua de acesso mora em `entitlements.ts`/`acesso-regra.ts`. **A
resposta bate com o desenho.** Registro de propósito: o item 5 da nota de 16/09
não escreveu por medo de contradizer a decisão pendente — **não houve
contradição**.

### O fato novo que muda a urgência escrita em 16/09

A nota de 16/09 disse *"ele NÃO está sofrendo — o SGP dele está andando"*. Ele
**andou até o fim**:

- `sgp_pedidos aeafd4a0` · status **pronto** · voz 22/09 19:16:54Z · foto 22/09 19:18:46Z
- `profiles contatogrupoavip` · plan **free** · access_until **null** · **0** crédito
- `profiles andreviana07` · plan free · sem acesso · **100.000** cr (a conta do trial que ele cancelou)

O e-mail que **pagou R$ 2.824,10** tem os arquivos prontos, zero crédito e
nenhuma porta. Em 16/09 isso era teórico; hoje o produto que ele comprou está
entregue e ele não consegue usar.

### O que isto NÃO é

**Não é bug.** O gate está certo por desenho, e ele nunca pagou pela plataforma
(o webhook só concede pelo produto 7851642). Também **não é o #290**: ele não
comprou SGP + assinatura no mesmo checkout, então não é carta de venda mandada a
quem acabou de pagar.

### Por que não escrevi pra ele

A Fast já respondeu hoje, corretamente. Uma segunda carta minha sobre o mesmo
assunto, **antes** da palavra do Johnny, é que criaria a contradição — o erro do
Jutaí (#246, duas cartas opostas com 2 minutos de diferença). A decisão foi no
lote.

---

## 4. O número do `esperando_johnny` está SUBCONTADO — medido, não suspeitado

O script devolveu **17 conferidos + 7 não triados**. Triei os 7 à mão, como o
próprio script manda:

**São decisão do Johnny e ficaram fora do número (3):**

| Cartão | Idade | O que trava |
|---|---|---|
| `ce8ba48b` | 3,7d | O **título** diz literalmente *"DECISÃO DO JOHNNY: 62.040 cr acima do teto"*. Não cai em **nenhum** balde do script — some. O Vigia já tinha anotado isso às 16hZ. |
| `b706b32e` | 5,2d | Nota de hoje 11hZ: *"falta DECISÃO DO JOHNNY sobre os 10.000 cr"*. Caiu em "não triado". |
| `df008dcf` | 17,1d | O item 6 da nota de 16/09 é pergunta de decisão explícita. Fora de todo balde. |

**NÃO são decisão — são trabalho ativo das rondas de hoje (4):** `37bacb68`,
`f8587cef`, `f1ada07e`, `719c9af6`. Estes o script acertaria em deixar fora.

> **Portanto o número certo desta ronda é 20, não 17.** Subcontar aqui é o pior
> defeito possível neste instrumento: faz **decisão parada parecer saúde**, que
> é exatamente como um cartão chegou a 55 dias. Card aberto ao `coder`
> (`1af718bb`) com os 3 como **controle positivo** e os 4 como **controle
> negativo** obrigatórios.

---

## 5. O lote que foi ao grupo

20 cartões, o mais velho há **55 dias**, **54 alunos** atrás da fila. Agrupado
por tipo de decisão para ele resolver vários com poucas palavras (doutrina de
17/09 aplicada a decisão: o desfecho não é re-escalar um caso por ronda):

- **Dinheiro a devolver (5):** CDC art.49 15d dormindo (risco jurídico) ·
  R$1.109,64 (garantia venceu no nosso silêncio) · R$97 de 08/08 · reembolso
  fora da garantia · 7.455 cr.
- **Crédito acima do teto (6):** 1.010.200 cr / 183 alunos (+DDL) · 762.695 cr ·
  157.875 cr · 84.720 cr · 62.040 cr · 10.000 cr.
- **Código pronto esperando aval (3):** PR #404 (55d, 19 alunos) · PR #355 ·
  PR #42 (aberto desde 24/08).
- **Mão no painel (2):** cancelar a assinatura da Fabiana (prometido por
  escrito, 22d) · destravar acesso de quem pagou outro produto.
- **Produto (2):** entrega abaixo do piso de QA · retentativa automática de
  treino (gasta GPU).
- **Caso de hoje (1):** o André da §3.

---

## 6. Fim de ronda

- Log commitado na **main** (regra 25-B).
- **Nenhum código de produção foi tocado**, logo não há fix preso em branch de
  feature.
- Escritas: nota em `df008dcf` (conferida na releitura, 1 linha afetada, 4→5
  notas); card `1af718bb` ao `coder`.
- Grupo: **lote postado** (as 6 famílias de decisão + o caso do André + o
  achado do instrumento).
