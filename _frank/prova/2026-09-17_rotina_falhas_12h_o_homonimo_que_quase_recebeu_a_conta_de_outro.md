# Ronda das falhas — 17/09/2026, ~12hZ (09h BRT)

Dono da fila (14-A). **Não fechei incidente nesta ronda**, e digo em que passo
cada um emperrou — a regra 14 continua inteira: a ordem de 21/08 é pra fechar
*mais*, não pra fechar mais rápido do que se resolve.

O que esta ronda entrega: **matei uma pista que ia entregar a conta de um
pagante na caixa de um estranho**, classifiquei um bounce que estava como
"desconhecido" e **remedi a classe inteira**, que cresceu. O aviso saiu **no
grupo**, com `notify-grupo.sh`, como manda a ordem de 31/08.

Ordens lidas antes de tocar em qualquer coisa: `_frank/ordens/README.md`, a de
**29/08** (planilha desligada) e a de **31/08** (canal). **Nada da planilha foi
lido, escrito, classificado ou reprocessado.**

---

## 1. Qual item peguei, e por quê

Regra 8 manda o mais antigo **com aluno afetado**. Conferi os mais velhos na
fonte, não no título, e os quatro acima dele estão presos em decisão que **não
é minha** — com isso escrito nos próprios cartões:

| cartão | idade | onde trava |
|---|---|---|
| `#15` `d3d8d1b2` | 48,9 d | risco aceito pelo Johnny; só reabre se voltar |
| `#99` `6c38c99d` | 24,8 d | resposta **comercial** do Johnny/Lucas, pedida em 24/08 |
| `#226` `702cc916` | 15,7 d | decisão de **produto** (falhar × avisar × manter); o custo das 3 opções já está medido |
| `#234` `f8587cef` | 14,8 d | espera **aval de GPU** pra virar a chave |

O mais antigo onde a bola ainda é **nossa** é o **`#249` `132f7808`** — Glauber,
`glaubermed@ig.com.br`, **13 dias** de cartão e **33 dias** desde que pagou
R$ 694,00 sem receber absolutamente nada. Peguei esse.

---

## 2. A rota que ninguém tinha tentado em 13 dias

O cartão inteiro depende de uma frase: *"não existe outro e-mail"*. Mas o
padrão do `#222` **já voltou sete vezes** nesta casa — o aluno compra num
endereço e aparece em outro. Se o Glauber tivesse qualquer compra sob outro
e-mail, esse endereço seria canal **vivo**, e e-mail é **pré-autorizado** pra
mim (regra 8): o caso se resolvia hoje, sem aval de ninguém.

Ninguém tinha feito essa pergunta. Fiz, só leitura, no `/sales/history` por
`buyer_name`.

**Voltou uma pista boa demais:** `"Glauber"` devolve **11 transações de 6
endereços**, e um deles é **`glauber.neurologia@gmail.com`** — endereço vivo, e
`med` → `neurologia` casa com a profissão. Era o final feliz.

---

## 3. E então derrubei a minha própria pista, com CPF

**Não é ele.** Cruzado por documento no `/sales/users`, que é a única coisa que
decide identidade:

| e-mail | nome na Hotmart | CPF | telefone |
|---|---|---|---|
| `glaubermed@ig.com.br` | Glauber jiordany o lopes | **006.687.686-90** | 38 99919-8156 |
| `glauber.neurologia@gmail.com` | Glauber Fernandes de Oliveira | **033.602.975-63** | 31 99759-0202 |

CPF diferente, sobrenome diferente, DDD diferente. Os outros quatro homônimos
(`g.mendes@creci.org.br`, `glauber@jgaprojetos.com.br`,
`glauber@sindicoadvanced.com.br`, `feniciabh@gmail.com`) também têm CPF próprio
e nenhum bate.

> **Registro isso em voz alta porque é uma armadilha armada pra quem vier
> depois.** Uma ronda com pressa acha `glauber.neurologia` numa busca por nome,
> acha que resolveu, e manda o **link de definir senha** da conta de um pagante
> pra dentro da caixa de um estranho. Nome parecido não é prova. Domínio
> parecido não é prova. **CPF é.** Se alguém reabrir a pista, a resposta já
> está medida no cartão: **não é ele.**

A perna de e-mail do `#249` está **esgotada por medição**, não por suposição.

---

## 4. O instrumento tem um vão, e o controle positivo pegou

A **primeira** rodada da sonda devolveu **zero** pro Glauber — que tem duas
compras `COMPLETE`. O controle positivo que pus no script abortou a execução em
vez de me deixar escrever "não tem". **Duas causas medidas**, as duas viram
regra pra próxima ficha:

1. **`/sales/history` sem `start_date` usa janela curta.** Com ela, Anderson
   (06/08) e Eliane (5 compras desde 23/04) **sumiam inteiros**. Com
   `start_date` explícito voltam todos.
2. **`buyer_name` casa por PREFIXO do nome inteiro**, case-insensitive.
   `"Glauber jiordany"` acha 2; **`"Glauber jiordany o lopes"` acha ZERO** — e
   esse é exatamente o nome que o `/sales/users` devolve. **As duas pontas da
   mesma API divergem no nome.**

Sem o controle eu teria escrito "sem segundo endereço" pros 8 e estaria
**mentindo em 3 deles**.

**Declarado como NÃO MEDIDO, não como ausência:** o Valdeni
(`valdene_marques@msn.com`) devolve zero em **todas** as formas do nome
testadas. A busca por nome é cega pra ele e eu **não** concluo nada sobre
segundo endereço dele.

---

## 5. A classe cresceu — e é o fato novo que justificou reescalar

Remedido hoje (`contato_hotmart.cjs --fichas`). Em 13/09 eram **7 pagantes e
R$ 6.012,27**. Hoje são **8 fichas de bounce com compra paga, R$ 7.103,82**, e
**8 de 8 têm telefone** na Hotmart:

| aluno | telefone | pago | desde |
|---|---|---|---|
| Anderson | (11) 97397-4029 | R$ 733,60 | 06/08 — **42 d** |
| Glauber | (38) 99919-8156 | R$ 694,00 | 15/08 — **33 d** |
| Sunesa | (15) 99653-4224 | R$ 849,45 | 07/09 |
| Renato | (22) 97403-4515 | R$ 1.038,00 | 09/09 |
| Valdeni | (62) 98464-1654 | R$ 1.054,32 | 10/09 |
| Ulysses | (21) 97926-3535 | R$ 993,45 | 10/09 |
| Sheila | (31) 98449-6405 | R$ 649,45 | 13/09 |
| Eliane | (55) 99169-7201 | R$ 1.091,55 | assinante; quicou **hoje** 11:35Z |

A 9ª ficha (`luctec@gmail.com`) **não tem compra paga nenhuma** e fica **fora**
da conta de propósito.

A ronda de 16/09 decidiu **não** repetir o pedido de aval, e estava certa:
repetir sem fato novo é ruído (regra 7). **Hoje há fato novo** — a classe subiu
de 7 pra 8 e de R$ 6.012 pra R$ 7.104, e a rota alternativa de e-mail morreu
**com prova**. Reescalei ao grupo, **uma linha**, com a decisão pronta pra um
sim ou não.

---

## 6. Achado lateral que classifiquei: `#374`, a Sheila

O cartão dizia bounce **"desconhecida"**. Fui ao DNS em vez de interpretar a
prosa do servidor:

```
dig MX gmail.com.br  ->  0 .
```

Isso é **NULL MX da RFC 7505**: o domínio **declara, por norma, que não aceita
e-mail nenhum, de ninguém, nunca**. Comparado no mesmo instante pra não virar
afirmação solta: `ig.com.br` → `mx-ha.skymail.net.br`, `icloud.com` → `mx01/
mx02.mail.icloud.com`, `msn.com` → proteção da Outlook, `ollem.com.br` →
`smtprin1.f1.k8.com.br`. **Só o `gmail.com.br` é nulo.**

Isso **muda a classe do caso**: diferente do Anderson (`#250`, caixa cheia, que
*pode* esvaziar) e do Glauber (`#249`, mailbox inexistente num servidor que
aceita outros), aqui **não existe cenário de melhora**. Retentar é inútil hoje,
amanhã e daqui a um mês.

**Não "consertei" o endereço chutando `gmail.com`**, e o motivo está no cartão:
`horta.pericias@gmail.com` pode existir e ser de **outra pessoa** — um RCPT 250
provaria que a caixa existe, nunca que é dela. É a mesma armadilha do item 3,
duas horas depois.

### O defeito de sistema por trás já estava corrigido — por 44 minutos

| quando | o quê |
|---|---|
| 13/09 **13:55Z** | a carta da Sheila sai pro domínio nulo e some |
| 13/09 **14:39Z** | sobe `b6b6a7d` *"detectar domínio que NÃO ACEITA e-mail antes de dar o envio por feito"* |

`classificarMx()` (`sgp-boas-vindas.ts:220-234`) trata NULL MX explicitamente, e
a consulta mora isolada em `sgp-mx.ts` (só `node:dns`, testável de verdade).
**Conferido que está na main**, não que "tem PR": `git merge-base --is-ancestor
b6b6a7d origin/main` = SIM, e `classificarMx` aparece no arquivo da main.

Ela foi **a última a cair no vão** — provavelmente foi este caso que gerou o
conserto. **Não há código a escrever ali.**

---

## 7. O passo exato em que tudo isto trava

Falta **uma palavra**: aval do Johnny pra falar com esses pagantes por
**WhatsApp ou ligação**. O canal existe e foi medido (`WAHA` = `WORKING` em
06/09, telefones conferidos). É ação **externa**, com **8 pessoas de uma vez** —
isso é contato em massa, e a regra 8 só me pré-autoriza **e-mail individual**.

**Não decido isso sozinho**, e não é falta de ação minha: o conjunto de
caminhos que são da minha alçada está **vazio e medido**.

---

## 8. O que eu NÃO fiz

Não liguei, não mandei WhatsApp, não escrevi pro endereço morto, não chutei
domínio parecido, não mandei nada pro `glauber.neurologia`, não troquei o e-mail
de conta de ninguém, não mexi em crédito, acesso, assinatura ou entitlement, não
gastei GPU, não apliquei migration, não abri PR, não mergeei nada, não li a
caixa do `suporte@` pra triagem e não toquei em nada da planilha.

**Não marquei nada como `fixed`.** Dois cartões ganharam nota (`#249` e `#374`),
os dois seguem `investigating` com o passo nomeado — porque o Glauber e a Sheila
continuam sem o que pagaram, e fechar diria que foram atendidos.

---

## 9. Lição

**"Não existe" e "eu não achei" são frases diferentes, e o controle positivo é
a única coisa que sabe qual das duas você está escrevendo.**

Hoje a mesma ronda quase cometeu os **dois** erros opostos, com uma hora de
intervalo:

- A sonda me deu **zero** pro Glauber e o zero era **meu**, não dele — janela
  de data curta e um filtro de nome que casa por prefixo. Sem controle, viraria
  *"não tem segundo endereço"* pros 8, e estaria errado em 3.
- Logo depois a mesma sonda me deu um **achado** — `glauber.neurologia`, vivo,
  nome certo, profissão certa. Sem o CPF, viraria *"achei o canal"*, e o link
  de senha de um pagante iria pra caixa de um estranho.

O instrumento errou pros **dois lados no mesmo dia**. O que separou as duas
conclusões erradas das duas certas não foi cuidado nem desconfiança genérica:
foi ter **uma resposta conhecida** pendurada no instrumento antes de olhar o
resultado — o controle positivo que aborta, e o CPF que decide identidade.

A forma disso é a mesma da lição de ontem (*"isso ainda é verdade agora?"*), um
degrau acima: ontem a pergunta era sobre o **dado**; hoje é sobre o
**instrumento**. **Fonte viva decide — desde que o instrumento que lê a fonte
tenha provado, naquela mesma execução, que enxerga.**

E a terceira, que é a mais barata de esquecer: **parecido não é prova.** Domínio
parecido, nome parecido, profissão que combina. Três vezes hoje o caminho fácil
apontou pra entregar a conta de quem pagou na mão de quem não pagou.
