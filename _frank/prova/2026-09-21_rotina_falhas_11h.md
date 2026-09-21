# Ronda das falhas — 21/09 ~11hZ

Ronda dentro da janela do turno (08h–23h BRT). Alvo serial: **#505**.

**Fechei 0 incidente.** Digo primeiro pra não ficar escondido. Mas a ronda não
foi vazia: **derrubei a premissa do #505 e o defeito real encolheu de 39 para
12** — 12 alunos nomeados, 7 deles pagantes, que a casa nunca avisou.

Ordem de 29/08 respeitada: nada da planilha foi lido, escrito ou reprocessado.
Canal: tudo que é aviso saiu **no grupo** (`notify-grupo.sh`), nada no privado.

---

## 1. Passos fixos

**Reconciliação dos envios** (passo fixo desde 18/09):

| | |
|---|---|
| lidas da pasta `Sent` | 898 |
| já tinham linha | 821 |
| fora da janela (`--corte`) | 77 |
| **RECUSADAS (defeito)** | **0** |
| **escrituráveis dentro da janela** | **0** |

Fecha 898 = 898. Instrumento independente (`enviados_x_tabela.cjs`): **0 carta
depois do corte** sem linha. Veredito dele: o buraco segue **PASSIVO**.
As 77 anteriores a 14/09 14:06:31Z continuam sem decisão (inalterado desde 18/09).

**Percepção** (ordem de 17/09): `percepcao_travada.cjs`, controle positivo OK,
491 varridos. **2 travados**, os mesmos de sempre: **#450** (falso positivo,
sexta ronda seguida que registro isso) e **#234** (já com laudo de 20/09).
**Classe de percepção real em `open`/`investigating`: ZERO.**

⚠️ Terceira ronda em que registro: o **SQL literal da ordem de 17/09 conta 18**
porque casa qualquer nota que *mencione* ver/ouvir; o instrumento da casa conta
quem **só para** por isso e dá 2. A ordem precisa da correção de texto
apontando pro `percepcao_travada.cjs`. Segue pendente.

**Fila:** 96 abertos (4 `open` + 92 `investigating`), sem movimento desde a
ronda do Vigia das 10hZ. 299 fixed · 60 ignored · 36 aguardando_aluno.

---

## 2. #505 — a premissa estava errada. Não são 39, são 12

O Vigia abriu às 10hZ: *"entregamos o clone e trancamos a porta"* — 39 alunos
com pedido do SGP em `pronto` e zero acesso. Ele entregou a população, o
dinheiro conferido e a reprodução, e declarou honestamente o que **não** mediu:
*"não achei o ponto no código que deveria gravar o entitlement. Não procurei:
isso é investigação, e investigação tem dono."*

Sou o dono. Fui procurar, e o que achei inverte o cartão.

### 2.1 Refiz a contagem por conta própria — bate com a do Vigia

| | |
|---|---|
| pedidos `pronto` (por e-mail) | 117 |
| sem entitlement | 53 |
| sem crédito | 42 |
| **trancados** (sem ent. + sem crédito + sem porta) | **40** |
| … reais (fora a conta `.invalid` da casa) | **39** |
| … com `PURCHASE_APPROVED` value>0 no nosso banco | **20** |
| mais velho · média · mais novo | 11,5 d · 5,6 d · 20/09 23:43Z |

### 2.2 Não é "trancamos a porta". É regra comercial, deliberada e escrita

Despachei card `4877e513` pro `coder` (investigação só-leitura) e **conferi eu
mesmo as afirmações que sustentam a conclusão** — não colei o laudo dele.

`frontend/src/app/api/v1/webhooks/hotmart/route.ts:205-211` desvia `rota==="sgp"`
**antes de qualquer concessão**, com o comentário no fonte:

> *"SGP: CURSO, não assinatura. Desvia ANTES de tudo. Regra do Lucas (31/08):
> comprar o SGP não dá o FastCloner; quem quiser a plataforma assina à parte.
> Um `grantAccess` aqui entregaria o produto pago de graça pra 129 pessoas por
> semana."*

E `route.ts:414-418` declara o contrato de `processarCompraSgp`: *"Continua SEM
acesso, SEM crédito e SEM entitlement"*. O custo do clone é da casa **de
propósito** (`lib/credits/onboarding-cobranca.ts:1-33`,
`lib/sgp/processar.ts:256-268`).

**Controle que sustenta a leitura** (medido no banco, não inferido do código):
entitlements com `product_code='7283229'` são **4, todas de 09/06**, o dia do
lançamento, nenhuma desde então — contra **352 compras aprovadas** do produto.
Nunca houve caminho de concessão. **Não é regressão.**

O `coder` acrescentou o mapa completo da cadeia e um achado que eu não tinha: o
filtro por produto não está só no varredor de órfãs — está em **três camadas
independentes**, inclusive no resgate de compra órfã no login
(`entitlements.ts:267-270` filtra por `PRODUTOS_DE_CURSO_PADRAO = ["7283229",
"7283335"]`, `acesso-regra.ts:114`). E **não existe mapa produto → plano/créditos**:
o crédito é uma constante única atrelada à assinatura (`PLAN_MONTHLY_CREDITS`).

### 2.3 A maioria foi avisada — e corretamente

Dos 39, **27** receberam `sgp_foto_pronta` + `sgp_voz_pronta` +
`onboarding_ok_mas_assine` (assunto literal: *"Seus arquivos estão prontos —
falta só o acesso"*), todos `ok=true`. Para esses 27 o sistema fez o que promete
**e disse isso ao aluno por escrito**. Não é defeito.

A própria Rita, que motivou o cartão, recebeu **os seis avisos**, o último em
20/09 18:24:07Z.

### 2.4 O defeito de verdade: 12 alunos que a casa nunca avisou

**12 têm ZERO linha em `avisos_enviados`.** Não é envio que falhou — é **nenhuma
linha**. A casa construiu o clone e nunca contou.

**Causa medida, não suposta:** o primeiro `sgp_foto_pronta` que existe no banco
é de **2026-09-14 14:06:33Z**. A maquinaria de aviso subiu nesse instante — o
mesmo deploy que criou o ledger de envios (cujo corte é 14/09 **14:06:31Z**, dois
segundos antes; é a mesma subida). Os 12 tiveram o clone concluído **entre 10/09
e 14/09 14:06Z**, ou seja **antes do aviso existir**. Como o aviso dispara no
instante da conclusão, esse instante passou e **nada vai avisá-los sozinho**.

| | |
|---|---|
| nunca avisados | **12** |
| … com compra paga conferida | **7** |
| mais velho com o clone pronto sem saber | **10,8 dias** |

Os 12 (pg = compra paga conferida): `contato@luzadvogado.com`,
`clonedoigor@gmail.com`, `soleideritter@gmail.com` (pg),
`djrobertocarvalho@gmail.com` (pg), `walsicleia_kaka@hotmail.com`,
`rafaelzan@me.com` (pg), `cazanna1@hotmail.com` (pg),
`rafael.oliveira@v4company.com`, `jlzpasqual@gmail.com`,
`franklindfreis@gmail.com` (pg), `annagalaggi.adv@outlook.com.br` (pg),
`sjhonattast@gmail.com` (pg).

**Cruzamento com cartão já aberto:** `walsicleia_kaka@hotmail.com` é o **#1a37605a**,
lido como *"não consegue login, código não chega"*. Ela está nos 12 que nunca
foram avisados — *"não chega o código"* pode estar escondendo *"ninguém nunca
escreveu pra ela"*. Não mexi no status (é cartão de outro dono de leitura).

### 2.5 Por que NÃO fechei o #505

O conserto dos 12 é mandar a carta de recuperação que eles deveriam ter
recebido. **12 cartas de uma vez é envio em MASSA**, e pela regra 8 (21/08) isso
precisa do "pode" do Johnny. **Não mandei nenhuma.** Foi pro grupo como pergunta.

Nota longa gravada no cartão (1 linha afetada, conferida na releitura).

### 2.6 O que eu NÃO medi — declarado

- Não fui na Hotmart **viva** para os 39; usei o nosso `payment_events`. Os 19
  sem compra neste endereço **não estão provados como não-pagantes** (armadilha
  #214/#218: compra num e-mail, entrada com outro).
- Não verifiquei se o clone dos 12 ainda está **recuperável** no portal `/sgp`.
  Se algum expirou, a carta de recuperação precisa de mais do que um aviso.

---

## 3. O conflito de ordem que eu não resolvi sozinho

`lib/payments/trial-prazo.ts:1-7` registra: **regra do dono, weekly 14/09** — o
trial passa a depender do produto: FCI 7 · **SGP 30** · CPL 30 · AI Content 90.

Isso é **mais novo** que a regra do Lucas de 31/08 ("SGP não dá acesso nenhum"),
e o índice de ordens diz que **ordem mais nova vence**. Só que:

- a regra pura foi escrita e testada, e **nenhum dos 4 exports tem consumidor**
  fora do próprio arquivo e dos testes (conferi o grep: zero call site);
- a tabela onde a data-fim moraria, `trial_periods` (**migration 115**), **não
  existe no banco** — conferido no `information_schema`, não no arquivo. O
  cabeçalho dela diz, com todas as letras: *"ESPELHO — NÃO APLICADO. DDL
  aguardando aprovação do Johnny (regra 21)"*. A 117 está igual.

É exatamente a armadilha do manual: **DDL commitado não é DDL aplicado.**

Enquanto isso o produto **vendeu 352 vezes** (348 desde 04/09, a última **hoje
09:36Z**). Pela regra do README — *"na dúvida entre duas, pergunte; nunca
escolha em silêncio quando envolve dinheiro de aluno"* — **não escolhi**. Foi
pro grupo como decisão do Johnny.

---

## 4. Aluno atendido: Rita Bernardino (#503)

Aluno esperando vem antes da limpeza da fila. Ela escreveu **08:54:30Z**, levou
uma resposta automática 9 segundos depois prometendo que a equipe responderia, e
às 11hZ ninguém tinha respondido.

Escrevi (chave `sgp-505-rita-acesso`, bcc suporte@, **cópia confirmada na pasta
de enviados, uid 3068**): o clone dela está pronto desde 20/09 e onde pegar
(`fastcloner.com/sgp`), por que a plataforma aparece travada, e o pedido de que
reenvie as perguntas. **Não prometi acesso** — depende da decisão da §3.
Cartão → `aguardando_aluno`.

**O caso dela conferido na Hotmart viva:** duas compras em 05/09 —
HP1202030985 **131,61 EUR** "Sistema de Geração Pronto" (7283229) e
HP2427056159 **56,46 EUR** "Fábrica de Conteúdo Invisível" (7283335). **Nenhuma
das duas é o 7851642 (FastCloner).** Ou seja: ela comprou **dois cursos**, e a
conta vazia dela é o comportamento que a regra de 31/08 descreve.

### Dois achados laterais, anotados e não tratados nesta ronda

1. **A compra HP2427056159 (FCI, 56,46 EUR) não existe no nosso
   `payment_events`** — só a do SGP entrou. Somos cegos pra essa venda. Não
   investiguei o porquê.
2. **A resposta automática do chat disse a ela** *"você pode continuar usando a
   plataforma normalmente"* — **falso** para quem tem 0 crédito e `access_until`
   NULL. Provavelmente aumentou a confusão. Não abri cartão separado.

---

## 5. O que eu errei

**Ia deixar o `coder` procurar sozinho uma coisa que eu tinha como achar em um
grep.** Abri o card `4877e513` e só depois rodei `grep -rn "7283229"`, que
devolveu em segundos o comentário de `processar.ts:260` — a resposta central.
O card não foi desperdício (ele trouxe a cadeia completa, as três camadas de
filtro e a ausência de mapa produto→plano, que eu não tinha), mas a ordem certa
era **grep barato primeiro, card depois, com a pergunta já afiada**. É a mesma
família do erro de ontem, invertida mais uma vez: ontem confiei na nota velha
sem olhar a `main`; hoje quase paguei caro por não olhar a `main` antes de
escrever o enunciado.

---

## 6. Passo fixo de fim de ronda

Conferência de branch preso na seção de commit. **Código desta ronda: nenhum.**
O único trabalho de código possível (a carta de recuperação dos 12) está
**travado esperando o "pode" do Johnny**, por ser envio em massa. O que vai pra
`main` aqui é **só este registro**.
