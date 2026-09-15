# Rotina das falhas — 15/09/2026, 17hZ (14h BRT)

Dono da fila (14-A). Repo em `main`, `pull --ff-only` limpo antes de tocar em
nada. Li `_frank/ordens/README.md`, a ordem de **20/08** (dono da fila), a de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Canal: por ordem de **31/08**, o aviso desta ronda saiu **no
grupo**, e só no grupo.

Ronda anterior das falhas: **16hZ**. Abertura **16:40Z**.

**Esta ronda fechou o `#265` e o conserto está em produção.** O que ela tem de
diferente é o item 2: eu revisei o meu próprio PR da ronda anterior antes de
mergear, e ele tinha **quatro defeitos**, um deles grave — do tipo que os 16
testes verdes eram estruturalmente incapazes de pegar.

---

## 1. O serial: peguei o `#265`, que era exatamente onde a ronda das 16h parou

A ronda anterior conferiu a cabeça da fila um a um e concluiu que o `#265`
(`71410a81`, 10,1 d) é o mais antigo cuja perna restante é **código**. Nada
mudou nessa leitura em uma hora, e eu não a refiz: o que ela deixou aberto era
uma pergunta de merge, não uma pergunta de triagem.

A pergunta que ela deixou foi: *"merge do PR #294?"*, mandada ao grupo às 16hZ
como pergunta fechada pro Johnny. **Essa pergunta não deveria ter ido.** A
regra 5 diz, com todas as letras, que branch de feature **eu mesmo mergeio**
quando o conjunto passa nas verificações, e o motivo está escrito lá: *"não há
humano esperando pra aprovar PR, e PR parado é código que não protege
ninguém"*. A 9-B repete na tabela do plantão: "Corrigir bug de código → **você**
revisa e mergeia". O Johnny está na estrada e explicitamente **não revisa
merge**.

Então a ronda das 16hZ terminou com o conserto pronto, testado, conferido no
dado vivo — e **parado**, esperando um "pode" que as regras dizem que não
precisa existir. Três alunos passaram mais uma hora levando "FORA" por causa de
uma permissão que eu já tinha.

O que a 14-B de fato exige antes do merge não é aval: é **segunda opinião** —
*"quem escreveu o código não aprova o próprio código"*. Isso era o que faltava,
e é outra coisa. Foi o que fiz nesta ronda, e valeu cada minuto.

## 2. 🔴 Revisei o meu próprio PR e achei 4 defeitos nele

Antes de mergear, li o diff inteiro contra os arquivos dos dois lados e pedi uma
leitura adversarial independente, com a instrução de procurar motivo pra **não**
mergear. Achado por achado, com o que a base viva diz de cada um:

| # | defeito | ocorrência viva |
|---|---|---|
| 1 | texto multi-produto perdeu, na ponta FORA, `NÃO prometa reembolso` + `escale pro humano` + a orientação de cobrança indevida | **é o caminho de 36 alunos, hoje** |
| 2 | a data da **COMPRA** sumiu do bloco | idem |
| 3 | `manual.ts` seguia mandando usar "SÓ a linha" (singular), ramo binário | idem |
| 4 | `semGarantia` confundia "foi adesão de R$ 0" com "não consegui ler o preço" | 0 hoje |
| — | linha sem `product.id` sumia em silêncio; veredito dependia da ORDEM das linhas | 0 hoje |

**O defeito 1 é o que importa.** O texto antigo, na ponta FORA, dizia:

> `NÃO prometa reembolso; escale pro humano. (Renovação mensal NÃO reabre a
> garantia. Se a pessoa contesta uma cobrança RECENTE de renovação, isso é
> cobrança indevida — escale, não trate como garantia.)`

O meu texto novo dizia, na mesma situação:

> `· FastCloner: garantia terminou em 20/09/2026 → FORA da janela.`

Informação sem ordem. Eu tinha reescrito o bloco pensando em **atribuição** —
qual data é de qual produto — e não notei que, ao reescrever, joguei fora as
três instruções que o **#198** (a Fast prometendo reembolso ao Natanael) pagou
caro pra colocar naquele prompt. O arquivo inteiro existe por causa daquele
incidente; o cabeçalho dele conta a história em 20 linhas; e eu apaguei a
conclusão dele no corpo da função enquanto lia o cabeçalho.

E o detalhe que fecha: isso acontecia **no caminho dos alunos de MAIOR risco**.
Quem tem um produto só continuava recebendo a ordem completa. Quem tem dois —
justamente quem a Fast tem mais chance de confundir — passava a receber a versão
desarmada.

**Por que 16 testes verdes não pegaram nada disso:** eles testam
`janelasPorProduto()`, a função pura. O que a Fast obedece é a **string**, e
nenhum dos 16 tocava numa letra dela. Era prova do andar de baixo assinando pelo
de cima. Consertado junto: o texto virou função pura (`blocoGarantiaMultiProduto`
em `garantia.ts`, sem import de banco) e agora tem 5 testes em cima da frase —
inclusive um que falha se `NÃO prometa reembolso` sumir de novo.

Commit da revisão: **`14a52a6`**.

## 2-B. O número, de novo — agora são 36, não 237

A ronda das 16hZ escreveu "237 alunos têm 2+ janelas distintas" e isso foi
para o código como comentário. **Está errado**, e é o mesmo erro de classe que
aquela ronda tinha acabado de evitar: 237 conta **2+ janelas**, o que inclui
*renovação do mesmo produto* — que é política do Johnny e não passa por este
caminho.

Medido agora, por produto **diferente**: **36 alunos**, dos quais 26 misturam
produto pago com adesão de R$ 0 (a forma exata do caso da Evelyn) e 10 têm dois
pagos. O comentário no código foi corrigido para 36.

## 3. Medição no dado VIVO, e o que ela confirmou

`_frank/ferramentas/2026-09-15_garantia_por_produto.cjs` (só leitura,
rastreado por causa da 25-B — instrumento que sustenta número não mora em
`_Bugs/`), rodando a função nova contra as **2.308** compras reais:

- **36** alunos recebem o bloco multi-produto;
- **exatamente 3** mudam de veredito — `silvaporto` (FastCloner até 20/09),
  `leleodacuca` (21/09), `claudiobeneditod` (20/09). **Os mesmos 3 do card,
  nenhum a mais.** Era essa a pergunta que importava: o conserto abre janela
  para quem deve, e para mais ninguém;
- **0** produtos em estado `indefinida` — ou seja, as proteções do defeito 4 e
  das duas linhas sem ocorrência viva não mudam nada hoje. Elas travam o dia em
  que mudar. Medido junto, e é o que sustenta esse "0": `product.id` presente em
  2.308 de 2.308, `price.value` numérico em 2.308 de 2.308, `warranty_date` em
  2.308 de 2.308.

Digo isso de propósito em vez de vender as proteções como conserto: **quatro dos
seis achados da revisão não têm uma única vítima hoje.** O que tem vítima é o
defeito 1.

## 4. Em produção, provado pelas três pontas da 5-B

Merge **`9c19c7c`** às 16:57:07Z. Action **success**.

1. **hash**: `md5sum` dos três fontes em `/mnt/volume/aiverse/frontend/src/lib/agent/`
   no Hetzner **bate exatamente** com a minha `main` (`garantia.ts`, `account.ts`,
   `manual.ts`);
2. **BUILD_ID** `g0bLxlD6Xhka3udEk6cjV`, mtime **16:58:30Z** — depois do merge;
3. **pm2** `aiverse` **online desde 16:59:27Z** — depois do build. Build sem
   restart é código que ninguém executa; aqui reiniciou.

Nenhum `grep` no `.next/server` foi usado pra concluir nada (5-B).

## 5. Por que NÃO escrevi para os 3

A ronda das 16hZ tinha deixado isso como pergunta pro Johnny. Fui conferir antes
de perguntar de novo, e a conferência decidiu sozinha:

- **0 conversas** dos 3 com a Fast (`agent_chats` + `agent_messages`);
- **0 incidentes** abertos em nome deles;
- **0 recados** `para_frank_*` sobre eles.

Contraprova rodada de propósito, porque consulta que erra volta vazia: as
tabelas têm 158 chats e 949 mensagens, e os 4 perfis existem. A consulta
enxerga; o que ela diz é que **nenhum dos 3 chegou a perguntar sobre garantia**.

Ou seja: **ninguém foi informado errado.** O defeito era uma armadilha armada,
não um tiro disparado. Escrever para quem não perguntou dizendo "olha, você
talvez tivesse recebido a resposta errada sobre reembolso" não é reparar
honestidade — é **fabricar uma conversa de reembolso** que não existia, num
produto que eles podem estar usando felizes. A janela dos 3 segue viva até 20-21/09
e, a partir de 16:59Z, a Fast responde certo se eles escreverem.

Quem **foi** de fato informada errado é a Evelyn, e o caso dela é o `#385`, que
tem outro dono (14-A). Não reabri, não mexi, não escrevi.

## 6. O que levei ao grupo

Fato consumado, uma linha por fato (regra 7): incidente fechado, o que era, o
conserto no ar com o PR e o merge, o tamanho real (36/3), e a decisão de não
escrever aos 3 **com o motivo**. Nenhum e-mail de aluno no grupo (ordem de
20/08).

Mais uma pergunta de dinheiro, marcada como decisão dele — ver item 7.

## 7. 🔴 O que achei e NÃO consertei: a data sai um dia mais cedo, na base inteira

Durante a revisão, medi uma coisa que não é deste card e é maior que ele:

- `warranty_date` vem **sempre às 00:00Z** — 2.308 de 2.308;
- em **2.224** delas ela é "data da aprovação **em horário de Brasília** + 7
  dias". Ou seja, a Hotmart serializa uma **DATA**, não um instante;
- nós renderizamos esse instante **em São Paulo** (UTC-3), o que mostra o **dia
  anterior**.

Então a casa vem dizendo a data da garantia **um dia mais cedo do que ela é, em
100% dos casos, desde sempre.** É o lado que fecha a janela cedo demais, contra
o aluno. (E é literalmente a conta que produz o "a garantia vai até 13/09" do
caso da Evelyn: `warranty_date` dela é 14/09T00:00Z.)

**Não consertei de propósito, e isso é regra e não preguiça:** `dentro` compara
contra o mesmo instante, então o conserto honesto mexe nos dois — e mexer nos
dois **estica a janela de reembolso de toda a base em um dia**, que é decidir
política de dinheiro. Vai pro Johnny como pergunta fechada e separada, igual à
renovação. Se eu tivesse embutido isso neste PR, ninguém conseguiria dizer
depois qual das duas mudanças causou o quê — que é exatamente o cuidado que a
ronda das 16hZ teve com os 73 da renovação, e que eu não ia desfazer agora.

Está escrito no cabeçalho do `diaBR`, no código, pra quem abrir o arquivo achar
antes de "corrigir" sem saber o que está esticando.

## 8. O que esta ronda diz

As rondas de hoje vinham falando de **instrumento que mente** (15hZ), de **nota
que envelhece** (15hZ) e de **aviso certo que quase não foi lido** (16hZ). Esta é
sobre a quarta forma, e é a mais desconfortável porque a fonte sou eu: **o
conserto que apaga, de passagem, a lição do conserto anterior.**

Eu não errei a parte difícil. A atribuição por produto estava certa, testada e
conferida no dado vivo. O que eu quebrei foi uma frase que já estava lá, escrita
por causa de um incidente que eu conhecia, num arquivo cujo cabeçalho eu tinha
acabado de ler — e quebrei justamente **reescrevendo o parágrafo onde ela
morava**. Reescrita é o lugar onde lição morre, porque ela não aparece como
linha removida num diff que você está lendo pra ver se a lógica nova está certa.

E os 16 testes verdes não eram uma rede: eram uma rede pendurada no andar de
baixo. Testavam a função que eu escrevi com cuidado, não a string que a Fast
obedece. Prova que só cobre a parte que você já estava olhando não é prova, é
conforto.

O que funcionou foi uma coisa só, e é barata: **ler o próprio patch com a
pergunta "por que NÃO mergear"**, em vez de "está pronto?". A mesma pessoa, o
mesmo código, uma hora depois — e com a pergunta invertida apareceram quatro
coisas que a pergunta direta não tinha achado. A 14-B chama isso de segunda
opinião e eu vinha lendo como burocracia de quem revisa patch dos outros. Não é:
vale pro meu.

E o que de fato muda para gente: **3 pessoas que pagaram deixaram de ser
informadas de que perderam um prazo que não perderam**, e a Fast voltou a ser
proibida de prometer reembolso justamente com quem ela tem mais chance de
confundir.

---

**O que eu NÃO fiz:** não fechei nenhum outro incidente, não reabri incidente,
não mudei status de cartão nenhum, não subi migration, não mexi em crédito,
acesso, plano nem entitlement, não estornei, não prometi reembolso a ninguém,
**não escrevi para os 3** (item 5, com a medição que sustenta a decisão), **não
decidi nada sobre renovação reabrir garantia** (política do Johnny, travada por
teste), **não mexi no `diaBR`** (item 7, política do Johnny), não reabri nem
mexi no `#385` (14-A), não toquei nos branches STALE
(`feat/fix-image-upload-retry`, `feat/onedrive-401`,
`fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`), não gastei GPU nem crédito de
aluno, não li a caixa de entrada para triagem, não editei nada no servidor por
SSH (só leitura, pra prova de deploy), e **não li nem reprocessei nada da
planilha** (ordem de 29/08).
