# Ronda das falhas — 20/09, ~18h30–19h15Z (Frank)

Item serial: **#371 / `23f8123d`** (Alice Silveira) — **quarta ronda seguida**.
Esta ronda **refuta a conclusão da ronda anterior**, que era minha. O conserto
das 17h40 continua em produção e continua certo no que prometia; o que caiu foi
a leitura de que o portão passou a **acertar**.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — **nada no privado do Johnny**; o post
do grupo saiu e está no §7.

## Placar

- Fila: **92 abertos** no início da ronda (era 90 às 17h40: **+2**).
- Fechados `fixed`: **0** — honesto, não omissão (§4).
- **Fix em produção: 1** — PR #376, merge `0ea25ab4` (dinheiro, §1).
- Alunos respondidos: **0**. A dívida com a Alice **continua** e **cresceu** um
  item (§5).
- Crédito devolvido: **0** — nada a devolver; o gate roda antes da cobrança.
- Passo fixo dos envios: **878 lidas, 0 carta fora da tabela** depois do corte.
- Cartões: **1 verificado e cobrado** (`8aed2e1c`) · **1 novo** (`a082b41a`).

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **878**
cartas lidas da pasta `Sent`, **801** já tinham linha, **77** fora da janela,
**0 escrituráveis, 0 recusadas**. A contagem fecha (878 = 878).

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

(Ronda das 17h40: 864 lidas / 787 com linha. **+14 cartas, todas já com linha.**)

As **77 anteriores ao corte** seguem sem decisão, como o README manda.

---

## 1. Dinheiro: um ref_type de estorno nasceu fora da lista — pela QUINTA vez

A varredura acusou `image_refund_gate371` como **ref_type que nenhuma das duas
listas classifica**. Isso é dinheiro e **erra pros dois lados**.

Apliquei o critério do próprio arquivo (casar `ref_id`, somar o sinal):

```
ref_id 4100fc07…  image_generation      -525
ref_id 4100fc07…  image_refund_gate371  +525
                              soma  =      0   -> É devolução
```

Cadastrado em `REF_TYPES_ESTORNO`. **PR #376, merge `0ea25ab4`.** Testes
`_estornos.test.cjs` **10/10** (inclui o controle positivo dos 25 tipos de
10/09); varredura reconferida depois: o bloco 🚨 **sumiu**.

Sem isso, "a imagem `4100fc07` da Alice já foi ressarcida?" lia **NÃO** e a casa
pagaria em dobro (#185, #342).

**O que este caso acrescenta aos quatro anteriores.** As notas de #185, #342,
`edicao_broll` e `video_clip` todas culpam *"quem escreve o `refundRefType` não
sabe que esta lista existe"*. **Aqui não cabe: quem escreveu fui eu**, que
mantenho a lista — e 13h depois de cometer o mesmo erro às 03h. Conhecer a regra
não bastou. Só o guarda por **exclusão** pegou, e só na varredura. Enquanto for
varredura e não gravação, existe uma janela entre gravar e acusar, e nela cabe um
pagamento em dobro. Registrado no código como próximo passo; não subi produto.

---

## 2. Dois registros que não existiam em git nenhum

`git status` na árvore: **dois arquivos untracked**, um deles o **log da ronda
das 15h30 (189 linhas)**. Não estava na main *nem em branch* — não chegou a
entrar em commit nenhum. É a falha que a ordem de 19/08 manda evitar, em versão
pior: não ficou invisível numa branch, ficou fora do git.

Commitado na main (`4023389e`), junto com a régua `2026-09-20_regua_gate_rosto_371.cjs`.

---

## 3. O #371: o que eu medi, e o que isso derruba

### 3.1 A frase das 17h40 que eu tratei como medição e não era

A nota das 17h40 (minha) diz: *"sem cláusula de gaze nenhuma, o negativo
continua barrado 0/5, **por pose**, e a própria recusa diz 'a cabeça está virada
para baixo e para o lado, **ultrapassando 30 graus**'"*.

Eu usei **o texto que o modelo escreveu** como se fosse a medição do ângulo.
Não é. Fui medir.

### 3.2 Geometria, com controles (`2026-09-20_angulo_da_cabeca_371.py`)

MediaPipe FaceLandmarker (478 pontos) → matriz de transformação → Euler. O
contrato cita ~30° (`face-gate.ts:73`).

| imagem | pitch | yaw | roll | pior | gate hoje |
|---|---|---|---|---|---|
| itamar 40b59813 | 1,1 | -0,4 | 0,3 | **1,1** | PASSA 5/5 (controle+) |
| itamar 8cd37f59 | 9,8 | -17,4 | 6,4 | **17,4** | BARRA 0/5 (controle−) |
| alice 4100fc07 | 30,9 | -1,4 | -1,1 | 30,9 | PASSA 5/5 |
| alice 128b3050 | 27,4 | -3,3 | 3,2 | 27,4 | PASSA 5/5 |
| alice 0e6a538a | 34,3 | -4,7 | 4,9 | 34,3 | PASSA 5/5 |
| alice b5c6dea7 | 30,3 | -1,9 | -1,2 | 30,3 | BARRA 0/5 |
| alice 2b274f51 | 27,6 | -1,5 | 10,2 | 27,6 | BARRA 0/5 |
| alice 5f610dda | 29,8 | -3,8 | 6,7 | 29,8 | BARRA 0/5 |
| alice 8cd4c73c | 29,8 | -3,8 | 6,7 | 29,8 | BARRA 0/5 |

**A régua se reprovou sozinha no controle negativo — e isso é o achado.** O
`8cd37f59` mede **17,4°** de pior eixo, **dentro** dos 30, enquanto a recusa dele
alega *"ultrapassando 30 graus"*. O modelo **cita um número que a geometria
desmente**. O controle **positivo** bateu (1,1°), então não é offset grosseiro
do instrumento.

E não há correlação entre passar e ângulo: as **barradas** medem em média
**~29,4°**, as **aprovadas ~30,9°**. As aprovadas estão **mais** inclinadas.

### 3.3 A prova que não depende de gabarito (`2026-09-20_par_contraditorio_371.cjs`)

Como os dois gabaritos do cartão discordam entre si (§4), construí uma régua que
**não usa gabarito**. Ela pergunta só: *duas fotos quase idênticas podem receber
vereditos opostos?* Rodada contra o gate da **main**, 5 rodadas:

```
alice b5c6dea7 (olhos NA lente) .... 0/5 PASSA
     razao: "A cabeça está inclinada para baixo, afastando-se da posição frontal necessária."
alice 0e6a538a (olhar DESVIADO) .... 5/5 PASSA
```

Mesma pessoa, mesma roupa, mesmo sofá, mesmo enquadramento, minutos de
diferença. **Vereditos opostos.** E a barrada é a **mais frontal das duas**
(olhos na lente; na aprovada o olhar desvia). A razão fala em inclinação para
baixo, e a geometria diz que a **barrada está menos inclinada** (30,3 contra
34,3).

Isso vale **independente de qual gabarito está certo** — não é preciso decidir
se a foto "deveria" passar pra ver que duas fotos iguais não podem receber
respostas opostas.

---

## 4. Por que os dois gabaritos existentes não servem pra aprovar conserto

São **dois, e discordam**:

- `_Bugs/2026-09-13_gate371_determinismo.cjs` — as 7 fotos da Alice = **"alvo"**.
- `_frank/…/2026-09-20_regua_gate_rosto_371.cjs` — 3 "alvo" + **4 "negativo"**.

A segunda marca as 4 como negativo porque *"a Alice olha para o lado"*. O
contrato **aceita** isso com todas as letras — `face-gate.ts:74`, lista de
aceitar: `"eyes narrowed, closed, or pointing away from the lens"` → **true**. E
`face-gate.ts:64` resume: *"O contrato, portanto, é POSE DA CABEÇA + BOCA
VISÍVEL. Direção do olhar não entra."*

Ou seja: **a régua reprova por olhar exatamente o que o contrato manda aceitar.**
Usar aquele gabarito pra aprovar conserto faz um conserto **certo** parecer
errado. Ela foi commitada (pra ficar auditável) **com o aviso no commit**.

### O controle negativo histórico está mal rotulado

Olhei o `8cd37f59`: homem **de frente pra câmera**, os dois olhos visíveis,
**boca visível**, queixo recolhido olhando uma tábua nas mãos. Pelo contrato
escrito isso é **aceitar** (*"chin tucked down… while the face still faces the
camera"*). Medido: **17,4°**.

Se isso se confirmar, há 7+ dias toda versão do gate vem sendo "validada" pela
propriedade de **continuar recusando uma imagem que o contrato manda aceitar** —
o critério de aprovação estava premiando o erro.

**Não mudei o rótulo por conta própria**: isso altera o significado de todas as
medições anteriores do cartão. Fica como a pergunta a decidir (§6).

---

## 5. O que NÃO muda, e a aluna

**O fix das 17h40 fica.** `temperature=0` (PR #373, merge `e5c5b2e1`) entregou o
que prometia: o sorteio acabou — hoje tudo deu 0/5 ou 5/5, **zero imagem
instável**. O que está refutado é a conclusão de que o portão passou a
**acertar**: ele ficou **determinista e continua errando**, agora sempre igual.

**Alice Silveira:** cortesia, **não pagante**, acesso expirou **20/09 12:00Z**,
zero `video_clones`. Nada preso a devolver. O único crédito do caso já foi
estornado (+525, §1).

A dívida de comunicação **continua e cresceu**: a carta das 15h30 (Enviados
**uid 3022**) disse a ela que o gate **"acerta"** ao barrar as fotos em que o
olhar dela vai pro lado. Isso é falso **pelo contrato** e agora também **pela
medição**. A próxima carta pra ela tem que corrigir isso na cara. **Não escrevi
hoje** — o acesso dela expirou ao meio-dia, e "consertamos metade" pra quem está
com a porta fechada é ruído, não serviço. É escolha registrada na nota do
incidente, não esquecimento.

`pagante_trancado.cjs`: **0 trancados, 0 na fronteira**.

---

## 6. Passo que falta no #371 (nomeado)

1. **Decidir o rótulo do `8cd37f59`**: é aceitar (contrato) ou recusar (intenção
   de produto)? **Enquanto isso não for decidido, nenhuma medição do #371 tem
   gabarito válido.** É decisão, não apuração.
2. Só depois: se o contrato vale como está escrito, o defeito é que **o modelo
   não cumpre o próprio prompt**. E aí o conserto **não** é afrouxar texto por
   tentativa e erro (já inverteu o gabarito 2× em 7 dias) — é **parar de
   perguntar "frontal?" a um modelo de visão** e medir o ângulo com landmarks,
   que é determinístico e custa zero por chamada. A geometria desta ronda mostra
   que é viável: o controle positivo deu **1,1°**.

`fixed` **não** foi marcado. Regra 14: fix parcial não vira `fixed` — e o que
está provado hoje é que o cartão está **mais longe do fim** do que a nota das
17h40 sugeria. Nota gravada e conferida na releitura (`agent_notes` **15 → 16**,
1 linha afetada), resolvida por **prefixo de uuid**.

---

## 7. Frota e canal

**Cobrei a entrega do `8aed2e1c`** (o resolvedor do `anotar_incidente.cjs`).
O `coder`, já no `claude-fable-5`, **entregou o conserto e ele está na main e
funciona** — verifiquei rodando: `anotar_incidente.cjs 427` agora resolve pro
**#427** (`168e8269`) e ainda **avisa** que "427" é também prefixo de
`42741499` (#138). O dado do #138 está honesto: o Vigia anotou ali por engano às
12:15Z e **marcou o próprio erro** na mesma nota.

**Mas o teste não veio.** O card pedia *"o teste que tem que falhar no código
velho e passar no novo"* e não existe `anotar_incidente*.test.cjs`. Card
**`completed` não é card entregue** — conferi em vez de aceitar o tique. Como
esta é a **única via segura de anotar e fechar incidente** e roda **toda ronda**,
abri o card **`a082b41a`** pro `coder` só pra rede de segurança, com os 4 casos
que o teste tem que cobrir e a exigência de provar que ele **falha** no código
velho.

⚠️ Usei o `anotar_incidente.cjs` nesta ronda por **prefixo de uuid**
(`23f8123d`) e conferi o título impresso antes do `--confirmar`.

**Post no grupo: houve.** Fato consumado — fix de dinheiro em produção (§1).
Uma linha, sem log de terminal, sem progresso parcial.
