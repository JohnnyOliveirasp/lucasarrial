# Ronda das falhas — 20/09, ~02hZ

Item serial: **#249 / `132f7808`** (o mais velho com aluno que eu podia mover:
15,4d). **Não fechado** — fechei, estava errado, reabri. É o assunto desta ronda.

O que sobrou de verdade: **dois alunos pagantes**, R$ 694,00 e R$ 733,60,
**36 e 44 dias** sem receber nada, que a casa tinha classificado como
"endereço morto" e "caixa cheia".

---

## 0. Passos fixos

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`):
776 cartas lidas da pasta `Sent`, 699 já tinham linha, 77 fora da janela do
corte, **0 escrituráveis, 0 recusadas**. A contagem fecha (776 = 776). O
instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue PASSIVO.
(Ronda anterior: 771 lidas / 694 com linha. +5 cartas, todas já escrituradas.)

**Percepção travada** (ordem de 17/09): **2 cartões**, mais velho parado há
1,5d — os mesmos dois da ronda anterior, nenhum é parada nova:
`#450` já despachado e resolvido como falso positivo do varredor; `#473`
(Katia) espera a aluna ouvir o áudio refeito. Espera legítima, com data.

**Placar:** 83 abertos (era 82) · 39 com 7d+ · 2 patch do Vigia · 117 recados.

---

## 1. #15 / `d3d8d1b2` — item (a) fechado, e a consulta que EU deixei estava errada

**Entregue até o fim.** O merge de ontem (PR #329, `d49837ff`, 23:45:33Z) virou
imagem e virou endpoint:

| etapa | quando | resultado |
|---|---|---|
| build (run `35476982295`) | 00:19:07Z | success |
| `deploy-runpod` | 00:20:16Z | success |

O `deploy-runpod` não recria endpoint: aponta o template pra tag imutável do
commit e recicla os workers (0 → N). Então o item (a) **não** está mais "na main
esperando build". Está servindo.

**O erro que eu ia repetir.** A ronda das 00hZ deixou escrito que, enquanto
`qa->'fase_corrente'->'meta' ? 'regens'` não devolvesse linha, o item (a) estaria
"não provado em job real". Essa consulta **não pode** devolver linha num sistema
saudável:

- `qa.fase_corrente` existe em **10 de 5.560** gerações da base inteira;
- as 10 são **`status='failed'`. Todas.** Nenhuma `ready`.

E é por construção, não por acaso: o caminho de FALHA
(`webhooks/runpod/route.ts:267`) chama `preservaFaseCorrente()` e guarda a fase;
o de SUCESSO reescreve `qa` com a telemetria de saída e a fase some.
`fase_corrente` é um artefato de geração **que falhou**. Como não há uma geração
`failed` desde **17/09 22:08Z** (520 ready / 16 failed na semana), a consulta
responderia vazio todo dia — e cada ronda leria isso como "não provado" ou, pior,
"quebrado". **Ausência de linha ali mede a saúde do sistema, não a telemetria.**

Mesma família do erro de denominador que já me pegou em 12, 14, 15 e 16/09.
A consulta certa ficou escrita no cartão: só `failed` depois de `00:20:16Z`.

**Cobertura do canal, medida** (falhas/dia × quantas gravaram fase):
04/09 2/2 · 11/09 1/1 · 16/09 4/4 · 17/09 3/12. Os 9 sem fase são jobs que
morreram antes do primeiro heartbeat (~30s) — esperado, não defeito. O que
importa pro #15: **as 2 ocorrências de executionTimeout de 04/09 gravaram fase
as duas.** O canal cobre a classe deste cartão.

**Dormência:** zero timeout desde 04/09 20:47:50.38824Z — **15,2 dias**.
Dormente, **não curada**: a causa do hang segue desconhecida, então não vira
`fixed` (regra 14). **Dinheiro:** 19 de 19 com estorno, conferido por
`ref_type='generation_refund'` (nunca por `kind`). `SEM_ESTORNO = 0`.

(b) e (c) seguem parados em #226 e #234 — decisão de produto, 3 dias sem
resposta no grupo. Não decido no lugar do Johnny. Serial seguiu.

---

## 2. O item serial: #249, e o erro que eu cometi nele

`132f7808` estava **15 dias em `investigating` com `resolution_note` NULA**.
O cartão pedia uma coisa: *"confirmar o e-mail real do aluno no cadastro/Hotmart"*.

O problema é que todo instrumento da casa pra "pagou?" é indexado por **e-mail**
— e o e-mail é justamente o que está quebrado (`glaubermed@ig.com.br` devolve
550 5.1.1 permanente). O próprio `pagou_de_verdade.cjs` manda, no cabeçalho,
"procurar a pessoa por nome/CPF/prefixo antes de decidir", e **não existia com o
que fazer isso**. Escrevi o `2026-09-20_achar_compra_por_nome.cjs`.

Ele devolveu **0 compras**. Escrevi isso como achado em dois cartões, fechei o
#249 como `ignored`, e escrevi no #426 que aquilo era contraprova da estimativa
de R$ 166 mil.

**Estava tudo errado.** Conferi por e-mail antes de seguir:

```
Glauber  (#249)  R$ 694,00  COMPLETE  15/08   SGP R$397 + Fábrica R$297
Anderson (#250)  R$ 733,60  COMPLETE  06-07/08 SGP R$420,96 + Fábrica R$312,64
```

### Por que o instrumento mentiu (medido, com o nome lido do próprio registro)

Três defeitos do `/sales/history`, somados, **todos silenciosos** (HTTP 200,
lista vazia):

| defeito | medição |
|---|---|
| nome COMPOSTO devolve 0 **até no casamento exato** | nome gravado: `Anderson Silvestre`. `buyer_name=Anderson Silvestre` → **0**. `buyer_name=Anderson` → **12**. (`Glauber jiordany` → 0; `Glauber` → 1. Mas `Maria Luiza` → 2: não é um prefixo coerente.) |
| sem `start_date`/`end_date` a API corta a janela e **não avisa** | `Anderson` sem datas → `total_results` **12**; com 01/2025–09/2026 → **93**. 87% invisível. |
| sem paginar, só a 1ª página | o balde do `Anderson` tem 2 páginas |

Corrigido: primeiro token + janela larga + paginação + casamento do resto do
nome feito localmente. Controle positivo refeito **nos dois alunos do caso**:
acha as 2 compras do Anderson e as 2 do Glauber, com o e-mail certo.
(Janela default 2025-01-01 também por medição: com 2024-01-01 a API devolve
HTTP 400 — e o script trata isso como **falha de instrumento**, nunca como
"não pagou".)

### A lição, que vale além do cartão

Eu usei um instrumento que **eu mesmo tinha acabado de escrever** e aceitei o
primeiro zero dele como achado. E eu *tinha* rodado um controle positivo —
`buyer_name=Maria` → 42 compras. Ele deu a **sensação** de instrumento validado
e não exercitava nada do que quebrou: nome de um token só, dentro da janela
padrão, primeira página. **Controle positivo tem que usar um caso cuja resposta
você já sabe — e ser a resposta que você quer que ele encontre.** Um controle
que passa em tudo não mede nada.

---

## 3. O achado que sobrou, e é melhor que o errado

### 3.1 As duas folhas CONFIRMAM o #426, não o contrariam

O #426 estima "da ordem de R$ 166 mil" a partir de 12/12 amostrados pagos.
As duas folhas que peguei hoje são pagantes: **2 de 2**. A amostra vai a
**14/14**. Retratei a nota errada lá dentro.

Os dois são dos 309, conferido e não suposto: contas criadas na janela
15h00–17h30Z de 04/09 (`origem='sgp_hotmart'`), `last_sign_in_at` **NULL**,
sem entitlement, sem pedido no `/sgp`, sem voz, zero linha em
`credit_transactions`. E a janela reconferida hoje dá **349** contas, o mesmo
número do cartão.

### 3.2 "Não há segundo canal" era falso — quem vendeu guarda telefone

Eu tinha escrito que o Glauber era incontactável: e-mail morto, `whatsapp`
NULL, nunca logou, nenhum chat vinculado. Tudo verdade — **sobre o nosso banco**.

`/sales/users?transaction=<HP...>` devolve, no papel `BUYER`: nome, e-mail,
**telefone** e CPF. Medido: telefone presente e preenchido **nos dois**, desde a
data da compra (Glauber DDD 38, Anderson DDD 11). Escrevi o
`2026-09-20_contato_do_comprador.cjs` pra isso.

O aluno que a casa classificou como incontactável tinha telefone a uma chamada
de distância desde 15/08. **"Não temos" não é "não existe".**

Isso vale pras 309: a frase "não tem como avisar" não se sustenta. E vale em
dobro porque a lista do lote de 04/09 **contém e-mail que não existe** — pra
esses, nenhum reenvio resolve e o telefone é o único caminho.

### 3.3 #250 mudou de assunto

`ficha_bounce.cjs` recalculado: a última carta (14/09 19:45Z, "4ª tentativa")
**não voltou bounce em 5 dias** — o 552 over-quota era temporário e passou. O
bounce acabou; o aluno não. Mesmo que ele leia e clique, cai numa conta **SEM
ACESSO e 0 crédito** — que é provavelmente por que 4 tentativas não viraram
login. Uma 5ª cópia não resolve. Reclassificado como folha do #426.

---

## 4. Dinheiro, acesso e o que eu NÃO fiz

Não dei acesso nem crédito a ninguém. O que a compra avulsa dá direito dentro do
FastCloner é **decisão comercial**, não de script — o próprio
`pagou_de_verdade.cjs` avisa isso (#173), e vale igual pros dois.

Não reenviei e-mail pro Anderson (a ficha proíbe, e a mensagem útil seria mentira
enquanto a conta estiver vazia). Não gerei link de recovery novo — sobrescreveria
`auth.users.recovery_sent_at`, a única prova da entrega. Não liguei pra ninguém:
ligação pra aluno é ação externa, vai ao grupo primeiro.

Não gastei GPU, não virei chave, não toquei em migration. Fora o banco de
incidentes, as escritas desta ronda são os dois arquivos novos de ferramenta.

## 5. Proposto ao Johnny (não feito)

O #426 já pedia "medir a população inteira antes de decidir dinheiro". Agora
existe com o que:

1. medir as **309** contra a Hotmart viva — quanto, por quem, em que produto;
2. levantar **telefone** dos que têm e-mail que bounceia, a fatia que nenhum
   reenvio alcança.

As duas ferramentas estão prontas e com controle positivo. Não fiz porque é
decisão de dinheiro somada a contato em massa com aluno — precisa do "pode".

## 6. Limite declarado

Ainda não houve **nenhuma** geração `failed` depois do recycle do endpoint
(00:20:16Z), então o `regens` no heartbeat **está em produção mas não foi visto
em job real** — e, pelo que está na §1, só será numa falha de mais de ~30s.
Enquanto não houver, não há o que conferir: isso é notícia boa, não pendência.
