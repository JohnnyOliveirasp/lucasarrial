# Ronda das falhas — 06/09, ~20hZ (17h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente e levei até onde ele vai.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no **GRUPO**,
nada foi pro privado.

---

## 0. A ronda em uma linha

**Um aluno paga R$ 194 por mês há duas semanas, nunca foi contactado por
ninguém, e não estava no card — porque cinco rondas seguidas trabalharam pela
lista de e-mails do incidente em vez de rodar o detector. Escrevi pra ele nos
dois endereços, e ao medir descobri que o caso NÃO é cobrança em dobro pra
cancelar: os dois titulares na Hotmart são pessoas jurídicas distintas.**

---

## 1. Por que NÃO peguei o mais antigo

Fila no início: **23 abertos**, 13 `aguardando_aluno`, 3 presos.

Os quatro mais antigos (**#15, #222, #226, #234**) seguem parados em **decisão,
não em investigação**, reconferidos nas rondas das 16h50Z/17h50Z/19hZ. O **#237**
segue bloqueado em **identificação** (chamado manual, sem e-mail do aluno). O
**#246** foi levado até o fim na ronda das 19hZ.

Peguei o **#254** pela **exceção explícita da regra 8** — *"dinheiro sendo
cobrado errado agora"*.

### A vítima viva que eu conferi e DESCARTEI antes

A varredura apontou `tania-araujo@uol.com.br`: pagante, 200.000 créditos, voz
`awaiting_training` desde 04/09, **nenhuma voz pronta**. Cheirava a aluno
travado, que vem antes da limpeza da fila.

**Não é.** Fui conferir se o botão que os e-mails mandam ela clicar existe de
verdade, em vez de supor: `voice-status-panel.tsx:118` só desabilita o botão
enquanto o clique está em voo (`disabled={training}`), e o portão do servidor
é paywall — ela tem acesso ativo e 200.000 créditos, então passa. **O botão
está vivo pra ela.**

E ela já foi escrita **duas vezes** (Sent uid 1071 em 05/09, uid 1158 em 06/09),
a segunda oferecendo até disparar o treino por ela. **Zero resposta** nas duas
(`ler_caixa --de` = nada encontrado). Pela ordem de 21/08 — *"esperar resposta
de aluno NÃO é estar travado"* — ela **saiu do meu colo**. Um terceiro e-mail em
48h seria pressão, não atendimento. O conserto da classe (18 vozes paradas, a
mais velha há 54 dias) é o **PR #196**, que está aberto esperando revisão do
Johnny — não é meu para mergear.

## 2. O achado: uma perna que o card não enxergava

**Não trabalhei pela lista `affected_emails`. Rodei o detector.** É a diferença
inteira desta ronda.

`assinatura_em_dobro.cjs` acusa **5 pagando em dobro**. Só **4** são deste card
(lucila, Nássara, Carlos Augusto — mais "Johnny Oliveira", que é conta de teste
a R$1). O quinto, **Leandro Lopardi**, **não está nos 12 e-mails do card**, e
por isso **nenhuma das 5 rondas anteriores o enxergou**. Ele paga desde 28/08.

### A armadilha é a MESMA que criou este card, um nível acima

A descrição do próprio #254 diz que ele foi separado do #222 porque *"quem
trabalhava o #222 pela lista de e-mails NÃO ENXERGAVA o único item com DATA"*.

`affected_emails` é um **retrato de 04/09** e não se atualiza sozinho. Trabalhar
pela lista deixa o card cego para **caso novo da mesma classe** — que é
exatamente o defeito que o card foi criado para corrigir. **Corrigimos a lista e
continuamos lendo a lista.** O certo é rodar o detector a cada ronda e comparar.

## 3. O dinheiro, medido e não herdado

| assinatura | e-mail | pago | próxima |
|---|---|---|---|
| `J9HMYL9P` | contato@aeroclubejf.com.br | **R$97 em 28/08** (HP3355066694) | 28/09 12:00Z |
| `4XVSU9U7` | leandro@aeroclubejf.com.br | **R$97 em 05/09** (HP0976568130) | 30/09 12:00Z |

**R$ 194 no ciclo**, as duas `ACTIVE`.

**Armadilha que apliquei** (já registrada na nota de 05/09 10hZ): o `COMPLETE`
de 05/09 do `J9HMYL9P` é a **MESMA transação** `HP3355066694` do `APPROVED` de
28/08 — é o ciclo fechando, **não cobrança nova**. Contar os dois daria **R$291
falso**.

## 4. O que derruba a recomendação óbvia

O caminho fácil era carimbar "cobrança em dobro, cancelar a segunda". Medi
antes, e as três coisas que achei dizem o contrário:

1. **Nenhuma das duas é órfã** — `dono=0c267ee9` e `dono=e23d5f9a`. As duas
   viraram conta de verdade.
2. **As duas contas FORAM USADAS**, o que derruba a hipótese *"comprou de novo
   porque não conseguiu entrar"*: `contato@` tem **3 vozes ready** + vídeo clone
   + imagens (28-29/07); `leandro@` tem **1 voz ready** + vídeo clone + imagens
   (30-31/07). **Não há ligação causal com o defeito do #222.**
3. **Os titulares são DIFERENTES na Hotmart viva** — e isso é decisivo:

| code | `subscriber.name` | ucode |
|---|---|---|
| `4XVSU9U7` | **Leandro Lopardi** (pessoa física) | `a5280a0e` |
| `J9HMYL9P` | **Acjf Escola de Aviacao Civil Ltda** (pessoa jurídica) | `753bbf27` |

Podem ser **duas assinaturas legítimas** — uma da escola de aviação, uma dele.

### Limite do instrumento, pra ninguém ler o relatório errado

O detector agrupou os dois pelo **telefone** (32991480920 nos dois) e pelo nome
do **buyer** do webhook, que é "Leandro Lopardi" nas duas. Mas **buyer do
checkout ≠ titular da assinatura**. O CPF é `03808036664` numa e **VAZIO** na
outra — e vazio **não é "diferente"**, então o filtro de CPF não separava.

> **`assinatura_em_dobro.cjs` responde "mesmo contato", não "mesmo pagador".**
> Ele acerta em levantar o caso; ele não decide se é erro.

**Recomendação: NÃO cancelar nada por iniciativa nossa** — mesma conclusão da
perna do Diego e pelo mesmo motivo (falta de **identidade provada**, não falta
de aval do Johnny). Aqui é até mais forte: no Diego a órfã nunca virou conta;
aqui **as duas contas existem e produziram trabalho**.

## 5. O que eu fiz

- **Escrevi pra ele nos DOIS endereços**, aplicando a lição do Solon (que ficou
  sem resposta porque foi escrito só no e-mail da compra). **Sent uid 1173**
  (`leandro@`) e **uid 1174** (`contato@`), cópias **CONFIRMADAS** na releitura
  do IMAP. Conferi antes que ele **nunca** tinha sido escrito: `ler_caixa
  --enviados` = *"nada encontrado"* nos dois.
- O e-mail lista as duas assinaturas com valor e data, diz que uma está no nome
  da **empresa** e outra no dele, pergunta se as duas são de propósito, e pede a
  **frase por escrito** caso ele queira cancelar uma. **Não prometi estorno nem
  valor** (9-C não me autoriza) e **não sugeri qual manter** — diferente do
  Diego, aqui não existe "a que funciona": **as duas funcionam**. Avisei que
  cancelar **não apaga** crédito nem voz (regra final de crédito de 20/08) e
  que, se quiser contestar a cobrança de 05/09, fale rápido.
- **Nota no #254** (11 → 12 notas, conferida na releitura).
- **Corrigi a cegueira do card**: acrescentei os dois endereços em
  `affected_emails` (12 → **14**, confirmado por `RETURNING` — linha realmente
  afetada, não UPDATE silencioso).

## 6. O que eu NÃO fiz

Não cancelei, não estornei, não mexi em crédito, não apliquei migration, não
gastei GPU, não mergeei PR, não fechei nem reabri incidente, não toquei em nada
da planilha. Hotmart lida por **GET puro**; caixa por `EXAMINE` + `BODY.PEEK`.

**O #254 não fecha e eu não fingi que fecha.** Ele cobre 6 pessoas agora.

## 7. Estado das pernas do #254, sem maquiagem

| perna | estado |
|---|---|
| **Leandro** (nova) | bola com ele, escrito hoje. Sem relógio curto: 28/09, 22 dias |
| **Diego** | bola com ele, prazo **08/09 12:00Z**, recomendação de NÃO cancelar sem a frase |
| **Jackson** | proposta parada com o **Johnny** desde 04/09 |
| **Carlos Augusto** | próximo débito 22/09, lembrete previsto 07/09, não tocado hoje |
| **lucila blanco** | **nunca perguntada**, segue pendente |
| **Nássara** | nunca decidida |
| **Solon** | perna morta em 05/09 |

## 8. Precisa de DECISÃO do Johnny

Nada novo meu. Seguem: **#226** destrava o #234; **migration 82** destrava o
#15; **#222** reenquadrar ou fechar; **PR #196** (18 vozes paradas, Tânia
dentro) e **PR #176** esperando revisão. Relógios: **Diego 08/09 12hZ**,
**Marcelo 11/09**.

## 9. Lição que fica

**A lista de vítimas de um incidente é um retrato, e retrato envelhece.** Este
card nasceu porque alguém trabalhou por uma lista desatualizada e não viu o caso
com data. Cinco rondas depois, repetimos o erro no card que existia para
corrigi-lo — e o custo foi um aluno pagando R$ 194 por duas semanas sem que
ninguém soubesse que ele existia. **Quando existe um detector, a lista é o
resultado dele, não a fonte.** Ler a lista é conveniente; rodar o detector é o
trabalho.

A outra: **"mesmo telefone" não é "mesma pessoa".** O instrumento agrupa por
contato porque é o que ele consegue ver, e chamar isso de "pagando em dobro" no
título faz o leitor pular direto pro cancelamento. Duas vezes seguidas neste
mesmo card — Diego e agora Leandro — a conferência do **titular na Hotmart viva**
mostrou outra pessoa (ou outra empresa) do outro lado. **Cancelar no escuro não
é eficiência, é cancelar a assinatura de um terceiro.**
