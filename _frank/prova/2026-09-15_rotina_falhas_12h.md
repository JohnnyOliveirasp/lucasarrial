# Rotina das falhas — 15/09/2026, 12hZ (09h BRT)

Dono da fila (14-A). Repo em `main`, `pull --ff-only` limpo antes de tocar em
nada. Li `_frank/ordens/README.md`, a ordem de **20/08** (regra final de
crédito), a de **27/08** (só erro de sistema vira chamado) e a de **29/08**
(planilha desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Canal: por ordem de **31/08**, os dois avisos desta ronda
saíram **no grupo**, e só no grupo.

Abertura **11:40Z**, fechamento **12:0xZ**. A ronda anterior foi a das **11hZ**,
vinte minutos antes — esta é continuação dela, não recomeço.

Peguei o backlog serial onde a ronda das 11hZ parou. O `#15` continua travado na
mesma linha de env (22 dias), então segui para **o próximo mais velho com aluno
afetado: o `#99`, 22,8 dias**. Levei até onde dá sem decisão humana, e encostei
no `#101` com o que mediu de graça no caminho.

A lição desta ronda é de novo sobre instrumento, e é a mais perigosa das três
seguidas: **uma tabela nova responde "zero" para o passado inteiro, e zero se
parece com inocência.**

---

## 1. 🔴 `#99` — LUCIANO DE PINHO: PAGANTE DE R$ 991, 22 DIAS ESPERANDO DECISÃO, E A PRÓXIMA COBRANÇA CAI EM 4 DIAS

**Anotado no `#99` (`6c38c99d`). NÃO fechei** — a decisão comercial que ele
pediu em 24/08 continua de pé. Escrevi para ele e levei ao grupo como urgente.

### 1.1 Por que este cartão, e o que ele escondia

Escolhido pela regra 8: o mais antigo com aluno afetado depois do `#15`.
A nota de 29/08 dizia *"STATUS aguardando_aluno de propósito"* — **e o cartão
está em `investigating` até hoje**. Não sei dizer se o UPDATE falhou em silêncio
ou se alguém reverteu, e **não invento causa**. O fato registrável é que o status
divergiu da própria nota por **17 dias**, e por isso o caso reapareceu na lista
de ataque em vez de ficar no balde de espera.

### 1.2 A armadilha que eu quase publiquei

Perguntei ao `emails_enviados` se a casa tinha escrito para ele. Voltou **vazio**.
A leitura óbvia — e errada — era *"nunca respondemos este aluno"*, que é
exatamente a acusação que eu fiz contra o nosso próprio time no caso do Rodrigo
em 14/09.

Fui conferir antes de falar: a tabela tem **primeiro registro em 14/09 14:06**.

> **Tabela nova responde "zero" para o passado inteiro. O zero é de nascimento,
> não de silêncio.** Conferir `min()` da coluna de data ANTES de ler ausência
> como prova.

É a terceira do mesmo formato em duas rondas, ao lado do `ref_type` por tabela e
do `access_until` que espelha fatura: **a consulta responde, responde rápido, e
responde errado.**

O e-mail existia. Achei na pasta de enviados: **uid 323 (29/08)**, mais os
follow-ups **uid 365 (31/08)** e **uid 1075 (05/09)**. Lido com
`ler_caixa.cjs --enviados`, que abre com `EXAMINE` e `BODY.PEEK` — **não
atropelei a fila da Fast e não marquei nada como lido.**

### 1.3 O que a fonte diz

| fato | valor | onde eu li |
|---|---|---|
| já pagou | **R$ 991** (297 Fábrica + 597 SGP em 18/08, + 97 assinatura 26/08) | `pagou_de_verdade.cjs`, todas COMPLETE |
| próxima cobrança | **19/09 12:00Z**, R$ 97, rec#3 | `payment_events`, `date_next_charge` |
| assinatura | **ACTIVE** — ninguém cancelou | payload da Hotmart |
| última mensagem dele | **28/08 20:53** (uid 372) — 18 dias | caixa |
| última geração dele | **28/08** — parou de usar | `aluno.cjs` |
| créditos | **166.035**, intactos; estorno dos 630 confirmado | `ref_type`, **nunca** por `kind` |

Li a data da cobrança no **payload**, não no `profiles.access_until` — de
propósito. O `access_until` dele também é 19/09, mas ele só **espelha a fatura**
(armadilha do Mastroianni, medida na ronda das 11hZ de hoje). Fosse pelo
`profiles`, eu teria "descoberto" um prazo que não é decisão de ninguém.

### 1.4 O risco, em uma frase

Em agosto ele **foi cobrado enquanto esperava resposta nossa**, e a casa pediu
desculpa por isso por escrito. A garantia daquela cobrança fechou em 02/09.
Se ninguém decidir até sábado, **acontece de novo** — segunda cobrança em cima
de um produto que ele parou de usar esperando a gente. É a classe do `#350`: o
relógio correndo dentro da nossa própria fila.

### 1.5 O que eu fiz, e o que eu me recusei a fazer

**Escrevi para ele** (regra 8, decido sozinho): cumpri a promessa feita em 05/09
de avisar perto do dia 19. Só fatos meus — a data, a pergunta única (encerro
antes de sábado ou mantenho), que os créditos ficam se encerrar, e que a
garantia de 26/08 fechou. Ensaiado em `--dry-run` e lido inteiro antes de sair;
endereço conferido contra `profiles` (há **oito** homônimos parciais de "Luciano"
e "Pinho" na base — o exato é um só). Enviado, **cópia confirmada nos enviados,
uid 2412**.

Escrevi o corpo em **UTF-8 limpo, sem entidade HTML**, e conferi com `grep` antes
de enviar: o e-mail de 05/09 saiu com `&atilde;` e `&ccedil;` **na cara do
aluno**. Eu mesmo digitei um `&ndash;` no rascunho e tirei antes do envio.

**NÃO cancelei a assinatura.** Ele escreveu *"não vou desistir ainda"*. Cancelar
sem pedido do titular é decidir no lugar dele — e a ordem de 21/08 diz que a casa
cancela **a pedido**, não por conta própria.

**NÃO disse a ele que ficou sem resposta do Lucas e do Johnny.** O `ja_falaram`
deu "SEM REGISTRO", e a própria ferramenta manda não tratar isso como silêncio:
eu não leio a caixa `suporte@lucasarrial.com`. Perguntei ao grupo **antes** de
falar. Esse é literalmente o acidente de 14/09 com o Rodrigo, e desta vez a
ferramenta me segurou.

**NÃO estornei e NÃO prometi devolução:** fora da garantia, virou decisão
comercial. Não é minha para prometer.

### 1.6 Por que segue `investigating` e não `aguardando_aluno`

O cartão não espera só o aluno — espera **decisão humana com prazo de sábado**.
Jogá-lo no balde de espera o faria sumir da lista de ataque justo na semana em
que ele precisa aparecer. É a objeção do Vigia de 25/08: *honesto não pode
significar invisível*. Deixei carimbado no cartão um **⏰ antes de 19/09 12:00Z**
para quem pegar a fila.

---

## 2. `#101` — AS DUAS METADES MUDARAM DE ESTADO, MAS EU NÃO FECHO COM MEIA MEDIÇÃO

**Anotado, NÃO fechado.** Encostei nele porque a medição do `#99` já respondia
metade da pergunta de graça.

1. **"não existe registro do que foi enviado"** — resolvido em dois lugares: a
   cópia na pasta Enviados desde 24/08, e agora a tabela `emails_enviados`
   (145 envios, 44 destinatários, desde 14/09).
2. **"os 17 bounces não viram nada"** — hoje bounce **vira incidente**: 13
   chamados abertos (3 na semana de 31/08, 9 na de 07/09, 1 na de 14/09).

**Achado novo, e é por isso que não fecha:** os dois caminhos de bounce
**discordam**. Os incidentes carregam classe boa no título (`caixa-cheia`,
`inexistente`, `bloqueio-destino`), mas `emails_enviados.bounce_classe` está
**"desconhecida" em 2 de 2**. Quem classifica para o incidente não é quem grava a
coluna. **Amostra de 2 é pequena e eu não cravo causa em cima dela** — fica como
fio para puxar, não como diagnóstico.

E **não conferi** se os 17 bounces originais de agosto, os que abriram o cartão,
chegaram a ser tratados um a um. É a pergunta que falta para decidir o
fechamento, e eu não a respondi.

---

## 3. Estado da fila no fechamento

- **78 abertos** + **20 em `aguardando_aluno`** = 98. Eram 79+20 nas 11hZ; a
  diferença é do movimento normal da fila, não de fechamento meu.
- **2 presos** pela varredura. **0 patches do Vigia** esperando.
- **82 recados `para_frank_*`**, o mais velho com **11,6 dias**. Não os tratei
  nesta ronda e não vou fingir que tratei — é dívida declarada, e o volume já é
  grande o bastante para merecer ronda própria.
- **Fechei nesta ronda: 0.** Onde cada um emperrou, como manda a regra 8: o
  `#99` **não fecha** porque a decisão comercial é do Lucas e do Johnny e tem
  prazo de sábado; o `#101` **não fecha** porque falta conferir os 17 bounces
  originais; o `#15` segue travado na env, sem novidade desde as 11hZ.
- **2 alunos com acesso vivo, crédito e nenhuma voz pronta** (`ericb.malzone`
  2 dias, `euneivaprestes` 1 dia), herdados da varredura. **Não investiguei** —
  fora do serial desta ronda, ficam anotados para a próxima.

---

## 4. O que esta ronda diz

As três rondas de hoje encontraram a mesma coisa em três roupas: **um número
lido fora do contexto dele.** O `access_until` que era fatura. O commit mergeado
que era feature desligada. E hoje a tabela recém-nascida cujo "zero" parecia
inocência da casa.

A diferença desta é o que quase aconteceu. As outras duas custaram atenção. Esta
ia custar **confiança**: eu estava a uma frase de escrever para um cliente de
R$ 991 que ninguém da casa tinha respondido — a mesma acusação falsa que eu fiz
ao nosso próprio time há um dia. O que me segurou não foi cuidado, foi
**ferramenta**: o `ja_falaram.cjs`, escrito ontem por causa daquele erro, imprime
o aviso na saída de propósito. O erro de 14/09 pagou por si mesmo hoje.

O resto é o de sempre, e é honesto dizer: **fechei zero**. O cartão que eu levei
até o fim parou onde o meu alcance acaba — numa decisão comercial que não é
minha. O que estava ao meu alcance era não deixar o aluno ser pego pela data
outra vez, e isso saiu.

---

**O que eu NÃO fiz:** não fechei incidente, não reabri incidente, não mudei
status de cartão nenhum, não cancelei assinatura, não mexi em crédito, não
estornei nada, não prometi devolução, não afirmei ao aluno que ele ficou sem
resposta, não li a caixa de entrada para triagem (só a pasta de enviados e a
thread dele, em modo somente-leitura), não toquei nos 82 recados, não investiguei
as 2 vozes paradas, não mexi em branch, não abri PR, não mergeei, não subi
migration, não rodei nada que gastasse GPU ou crédito de aluno, e **não li nem
reprocessei nada da planilha** (ordem de 29/08).
