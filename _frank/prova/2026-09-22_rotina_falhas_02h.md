# RONDA DAS FALHAS — 22/09/2026, ~01h40–02h00Z

Dono da fila (regra 14-A). Método serial da ordem de 21/08 (regra 8). Canal:
ordem de 31/08 — **tudo que é FastCloner sai no GRUPO** (`notify-grupo.sh`),
nada no privado do Johnny. Ordem de 29/08 respeitada: **nada da planilha** foi
lido, escrito, classificado ou reprocessado.

**Cartões fechados: 0.** **Alunos escritos: 0** (e os dois candidatos já tinham
carta recente — explico por quê não mandei). **Nota gravada e conferida: 1
(#479).** **Ferramenta nova: 1 (PR #397).**

Fecho zero e digo na primeira linha. A diferença desta ronda para as três
anteriores é que ela parou de descobrir o mesmo fato um cartão por vez e foi
**medir o fato**.

---

## 0. Passos fixos — os três limpos

| passo | resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 990 lidas · 913 já tinham linha · 77 fora da janela · **0 escrituráveis** · contagem fecha 990=990 |
| `enviados_x_tabela.cjs` (irmão de leitura, independente) | **0 carta depois do corte** ✔ |
| `percepcao_travada.cjs` (ordem de 17/09) | controle positivo OK (#310) · 506 varridos · **0 travado em percepção**, mais velho 0d |

As 77 anteriores a 14/09 14:06:31Z seguem **sem decisão**. Não mexi:
`cobreDesde` é decisão de produção, não de ronda.

Também rodei `pagante_trancado.cjs`: **0 pagante trancado**, 0 na fronteira,
1 sem prova (`drfabiovilhena29@gmail.com`, sem subscriber code no payload).

---

## 1. #479 Marlon — troquei uma frase herdada por uma medição

Peguei como item serial pelo relógio: o `garantia_na_fila.cjs` o listava em
**"VENCE EM ATÉ 48H — decida HOJE"**, restando 22,3h.

**Estado vivo, reconferido por `transaction` (não por `buyer_email`):**
`HP2093753501` · R$597 · **PIX** · produto 7283229 · **`PROTESTED`**,
inalterado desde 21/09 19:51Z · `is_subscription=false` · garantia expira
2026-09-23T00:00:00Z · compra em 16/09 07:14Z (protesto com **5,8 dias**).

### Por que não aceitei a frase que estava no cartão

A nota de 21/09 escreveu *"PROTESTED aqui significa pedido de devolução
REGISTRADO, não recusado"* **sem medir**. Este cartão já foi queimado uma vez
exatamente por afirmar desfecho sem conferir (o fechamento de 19/09). Então fui
medir a **classe**, não a frase.

**Hotmart viva, 01/03 → 22/09 (7 meses, paginado até o fim):**

| status | n | idade da compra |
|---|---|---|
| `PROTESTED` | **134** | 0–7d: 82 (61%) · 7–30d: 48 (36%) · 30–90d: 2 · 90d+: 2 |
| `REFUNDED` | 3.735 | mediana 109,2d |
| `CHARGEBACK` | 150 | mediana 141,3d |

**97% dos `PROTESTED` têm menos de 30 dias** — é estado de passagem, não limbo.
Os **4 que emperraram**: `HP1742681300` (169,8d BILLET), `HP1941202471`
(97,2d CREDIT_CARD), `HP3003305581` (55,7d CREDIT_CARD), `HP1076058946`
(54,1d CREDIT_CARD). **Nenhum é PIX.**
Entre os 29 PIX protestados, **o mais velho tem 12,5 dias**. Em 7 meses não
existe um único PIX protestado que tenha passado de 30 dias.

**Veredito:** o do Marlon (PIX, 5,8d) está na massa normal e a via PIX não tem
histórico de emperrar. **O dinheiro ainda não voltou, então não marquei
`fixed`** (regra 14). O que mudou é que a espera agora tem base medida.

**O que a casa deve: nada, conferido.** Compra avulsa (`subscriber_code` null,
`UNIQUE_PAYMENT`) — não há assinatura, a 9-C não se aplica; ordem do Lucas de
31/08 — a casa não cancela nem reembolsa na Hotmart.

**Não mandei terceira carta, de propósito.** Ele já foi escrito **duas** vezes,
e as duas constam em `emails_enviados` com `message_id`: 19/09 14:26Z e
**21/09 19:51Z — "Seu reembolso está registrado e em andamento — e o prazo não
te prejudica"**, com ~6h de idade, dizendo exatamente o que esta medição
confirma. Carta em cima de carta seria ruído.

### ⚠️ Achado de instrumento (registrado no cartão)

A partir de **23/09 00:00Z** o `garantia_na_fila.cjs` vai jogar o #479 em
**"PERDEU A JANELA ENQUANTO ESPERAVA NA NOSSA FILA"** — e ali seria **mentira**.
Marlon pediu **dentro** do prazo (19/09) e o pedido está **registrado** na
Hotmart desde então. A janela rege **quando se pede**, não quando o dinheiro
cai. O instrumento só enxerga a data; não consulta o status da transação, então
não distingue *"pedido parado na nossa fila"* de *"pedido que já saiu da nossa
fila e está processando na Hotmart"*.

**Próximo passo concreto e datado:** reconferir `HP2093753501` em **30/09**
(14 dias, já acima do pior PIX já visto). Se ainda estiver `PROTESTED`, aí saiu
da normalidade e vira escalação — só o painel da Hotmart (equipe da Liz)
destrava. Se estiver `REFUNDED`, fecha com valor e data.

---

## 2. O item serial seguinte caiu no mesmo lugar — e aí parei de tratar caso a caso

Peguei **#299 (Lucila)**, o mais antigo dos seis que perderam a janela na fila
(289,7h). Reli o cartão inteiro: cancelamentos **já feitos** em 14/09 (as duas
assinaturas, `6JEANY3Z` e `2Q4Y1CDE`, conferidas na Hotmart depois de gravar),
aluna **já avisada** (Enviados uid 2221), dinheiro **já medido**
(R$291 = R$194 + R$97, zero estorno em `payment_events`).

**O que falta no #299 é uma coisa só: o Johnny escolher o recorte do estorno —
R$97 (só a duplicada) ou R$291 (tudo).** Pendente desde 07/09: **15 dias.**

Foi o terceiro cartão seguido com o mesmo desenho (#254, #301, #299). A ronda
de 01hZ tinha escrito no fecho: *"vale medir isso direito numa próxima ronda:
quantos dos 48 estão esperando humano decidir vs. esperando alguém trabalhar."*
Medi.

---

## 3. 🆕 A medição: a fila são DUAS filas — **PR #397**

`_frank/ferramentas/2026-09-22_espera_decisao_do_johnny.cjs`

```
137 em espera = 36 esperando DECISÃO + 101 esperando TRABALHO
com 7d+:        23 de decisão        + 43 de trabalho
```

**23 dos 66 cartões velhos não andam por mais ronda que se faça.** Contar "48
velhos" (ou 66, com `aguardando_aluno`) descreve um executor que não dá conta;
o número real de backlog de execução é **43**.

Os mais antigos da fila de decisão, com o que falta em uma linha:

| cartão | idade | o que falta |
|---|---|---|
| #214 | 21,2d | escalado ao grupo 21/09, sem resposta |
| #224 | 20,4d | decisão dos 7.455 créditos |
| #249 | 17,4d | decisão de produto sobre rigor do QA (no grupo desde 17/09) |
| **#254** | **17,3d** | **cancelar a perna órfã ou autorizar a ligação — renova HOJE 12:00Z** |
| #263 | 16,5d | devolver ou não os R$97 de 08/08 |
| #290 | 15,2d | o "pode" pro e-mail de reparação dos 8 (pedido desde 04/09) |
| #299 | 14,4d | recorte do estorno da Lucila: R$97 ou R$291 |
| #301 | 14,4d | decisão **e acesso** sobre R$975,40 fora do nosso gateway |

**Critério: a ÚLTIMA nota, não a pilha.** Lição medida do
`percepcao_travada.cjs` — varrer `agent_notes::text` mede **histórico** e
apresenta como **pendência**.

**Dois controles, e o script aborta se qualquer um falhar:**
- **positivo** #254/#299/#301 (lidos à mão, são decisão com certeza);
- **negativo** #478/#518/#479 (falsos positivos **medidos na 1ª versão**).

A 1ª versão devolvia **39** e inflava: casava em *"o 720p foi REMOVIDO **por
decisão do Johnny**"* (#478 — decisão passada citada como justificativa) e em
*"**caso o Johnny** ou o Lucas queiram decidir diferente"* (#518 — hipótese que
o próprio cartão declara não-bloqueante). Com as rejeições: **36**.

Controle positivo sozinho prova que o instrumento **acha**; não prova que não
**infla** — e inflar foi como a classe de percepção chegou a 41 falsos em 17/09.
**E o controle positivo funcionou de verdade:** pegou meu próprio aperto no
instante em que ele derrubou o #301, e foi assim que a marca *"cartão declara
que trava no Johnny"* entrou. O instrumento me impediu de publicar um número
limpo e errado.

Saída é **ordem de visita, não veredito** — cada linha traz o trecho que a fez
casar. Só lê.

---

## 4. Estado da fila (medido, não lembrado)

- **102 abertos** · **48 com 7d+** (`idade_dos_abertos.cjs`)
- **137 em espera** contando `aguardando_aluno` → **36 decisão / 101 trabalho**
- **0 travados em percepção** · **0 pagantes trancados**
- `garantia_na_fila.cjs`: **6 perderam a janela na fila** · 1 vence em 48h
  (#479, tratado acima) · 1 dentro da janela

---

## 5. O que eu NÃO fiz, de propósito

- **Não fechei** cartão nenhum — nenhum estava resolvido (regra 14 inteira).
- **Não mandei terceira carta** ao Marlon (a de 21/09 tem 6h e diz o mesmo).
- **Não escrevi** à Lucila: ela já tem 4 mensagens nossas dizendo "encaminhado";
  o que falta lá não é texto, é a decisão. Uma quinta gasta a paciência que
  sobrou — foi assim que o caso do Victor apodreceu.
- **Não re-escalei o #254**: a ronda de 01hZ já o levou ao grupo com relógio
  duro há ~1h. Repetir em uma hora é duplicar o pedido, não urgência.
- **Não estornei**, não mexi em crédito, não prometi data, não liguei.
- **Não mergeei** o PR #397 (código vai por PR; só o log vai direto na main).
- **Não toquei na planilha** (ordem de 29/08).

---

## 6. Para a próxima ronda

1. **#254 renova 12:00Z de hoje.** Se o "pode" não vier até lá, a cobrança
   acontece e o caso vira estorno em vez de prevenção. É o único da fila de
   decisão com relógio batendo hoje.
2. **Reconferir `HP2093753501` em 30/09** (#479).
3. A fila de trabalho real é **43 cartões com 7d+**, não 48 — ataque por ali;
   rodar `--trabalho` dá a lista.
4. Vale considerar ensinar o `garantia_na_fila.cjs` a consultar o status da
   transação, para parar de contar como "perdeu a janela na nossa fila" quem
   já teve o pedido registrado na Hotmart (hoje, só o #479; amanhã, qualquer um
   que peça dentro do prazo e espere o processamento).
