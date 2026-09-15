# Rotina das falhas — 15/09/2026, 21hZ (18h BRT)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a ordem de **20/08** (dono da
fila), a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda saiu **no grupo**, e só no grupo.

Ronda anterior das falhas: **20hZ**. Abertura **20:40Z**.

Peguei o **`#404`** (teto de execução do Vídeo Clone). Escolha pela regra 8: é a
classe com **mais gente sofrendo** e a única matando aluno **agora**. O conserto
está **em produção**, dois alunos foram respondidos, e **o cartão continua
`investigating`** — explico no §5 por que fechá-lo seria mentira.

---

## 1. A pergunta que travava a decisão ficou respondível ontem à noite

O `#404` terminava num impasse honesto: *"não dá pra saber se o teto está
apertado ou se o job trava, porque a casa só grava `elapsed_seconds` quando o job
FALHA"*. Sem o lado dos vivos, qualquer conserto era aposta — e o cartão dizia
isso e se recusava a recomendar subir o teto.

O `dcc6653` (item 5 do próprio cartão) passou a gravar `elapsed_seconds` também
no `ready` em **15/09 00:45Z**. Vinte horas depois já havia amostra. **Não
precisei da semana que o cartão pedia.**

## 2. 🔴 A medição, e ela inverte a leitura

Decompus `elapsed_seconds − 30·ceil(audio)` — o custo **fixo** (cold start +
fila) que cada job consumiu, já descontado o compute:

| status | jobs | fixo consumido |
|---|---|---|
| `ready` | **33** | até **1199,4s** |
| `failed` | **9** | **1202,8s a 1212,0s** |

O teto reservava **1200s**.

**O maior custo fixo de um job que ENTREGOU e o menor de um job MORTO estão a
3,4 segundos um do outro.** Não são duas populações. É **uma só, cortada por uma
linha desenhada em 1200s**.

Os três sucessos mais perto do teto antigo:

| áudio | elapsed | % do teto | quando |
|---|---|---|---|
| 77,65s | 3539,432s | **100,0%** | 02:13Z |
| 36,62s | 2209,494s | **95,6%** | 20:20Z (§7) |
| 76,18s | 3343,652s | 95,3% | 02:40Z |

O primeiro entregou com **0,568 segundo de sobra**.

**Job pendurado não entrega a 99,95% do teto — ele não entrega.** Era teto
apertado.

O contraste com o apagão de **05/09** fecha a leitura: aquelas falhas morreram
com **0,1%–2,8%** do teto (1s a 64s), que é crash, classe outra. Entre 2,8% e
100% **não existe nada**. Ninguém morre no meio.

### O que isto NÃO faz é desmentir o item 4 do cartão

O item 4 avisava que o "+3s" dos mortos não mede a distância que faltava, porque
o RunPod mata exatamente no teto. **Continua certo, e eu não usei os mortos como
prova.** O que mudou é de onde vem a evidência: ela vem do lado dos **VIVOS**, e
esse lado o cartão não tinha como ver em 14/09. A instrumentação que ele mesmo
pediu é que abriu a porta.

## 3. O conserto, e por que 40 minutos e não um número bonito

Parcela **fixa** de 20min → **40min**. **Só ela.**

O desenho original (07/08) era 20min de teto contra um cold start medido de
~10min: **2× de margem**. Hoje o overhead real chega a 20min e **a margem
sumiu**. 40min **restaura os 2× do desenho original contra a medição de hoje** —
é derivação, não chute.

A parcela de compute (30 s/s) **não foi tocada de propósito**: medida em **30,1
s/s** no job que raspou o teto, está calibrada. Mexer nas duas de uma vez faria a
próxima medição não saber a qual atribuir o resultado.

**16 testes novos**, ancorados na **medição** (1199,4s) e não no número escolhido.
Os 9 mortos entram **um a um com o áudio real**. Tentei quebrá-los:

| mutação | resultado |
|---|---|
| overhead de volta pra 20min (o bug) | 4/16, cai |
| overhead em 30min (acima do bug, abaixo dos 2×) | 4/16, cai |
| **baixar a medição de 1199,4 pra caber** | 4/16, cai |
| mexer no compute junto (30→45 s/s) | 14/16, cai |
| dar fixo extra só pro áudio curto | 14/16, cai |

**5 mutações, 5 quedas.** A terceira é a que eu mais queria ter: é a saída
preguiçosa de ajustar a régua até o teste passar.

`node --test` **29/29**, `tsc --noEmit` limpo.

## 4. Em produção, pelas três pontas

PR **#300**, merge **`324aaf6`** às **20:48:43Z**. Action **success**.

1. **hash**: `md5sum` de `config.ts` (`59a86c8f…`) e `config.test.ts`
   (`675b09fd…`) no Hetzner **idênticos** aos da minha `main`;
2. **BUILD_ID** `eIqI2cnq8s-7fs4YcZoy4`, mtime **20:49:56Z** — depois do merge;
3. **pm2** `aiverse` **online desde 20:50:43Z** — depois do build.

Nenhum `grep` no `.next/server` foi usado pra concluir nada.

## 5. 🔴 Por que NÃO fechei o cartão

A distribuição dos sucessos está **censurada exatamente em 1200s**: job que
precisava de mais **nunca virou `ready`** pra entrar na conta. Logo **1199,4s é
PISO** do que um job saudável consome, **não teto**.

O conserto tira o teto **de dentro da distribuição observada**. Ele **não prova
que 40min basta** — isso ninguém sabe ainda, e eu não vou escrever `fixed` em
cima de uma coisa que eu sei que não está provada (regra 14). Só fecha com uma
semana de `elapsed_seconds` no `ready` mostrando a cauda de verdade. **Se
aparecer morte de teto com a régua nova, o problema não era (só) o teto** e a
leitura tem que ser refeita do zero.

Custo do trade, dito claro: num job que de fato pendurar, o aluno agora espera
até **20min a mais** antes do estorno. Aceito porque hoje ele espera o teto
inteiro **e não recebe nada** — e a evidência diz que esses jobs estavam
terminando.

## 6. Duas correções de fato no cartão

- **"TODAS 480p-v3" é falso** desde 15/09: o `gabriel.reis` morreu no mesmo teto
  em **480p-v2**. Um conserto escopado em "v3" passaria ao lado dele. Há teste
  nomeando o caso. **Não reescrevi o título.**
- **`occurrences=7` e `last_seen_at=14/09` estão congelados e vão continuar**: a
  signature foi escrita à mão e **nenhum detector a emite**. Registrei as duas
  réguas (7 tentativas capturadas ao vivo × 9 linhas terminais desde 14/09) sem
  maquiar nenhuma.

## 7. O desfecho que o Vigia deixou em aberto, e um que eu quase perdi

O Vigia das 20hZ deixou o `492cd0de` "em voo, desfecho para a próxima ronda", de
propósito, em vez de adivinhar. **Conferi: MORREU** aos 2770,168s contra teto de
2760s. É o 9º.

E enquanto eu fechava a ronda, o **`0f7fba33` do `welrisson`** — o aluno que
morreu **duas vezes** em 14/09 — estava em voo com o teto **ANTIGO** (job
submetido 20:20Z, antes do deploy). Fiquei olhando: entregou em **2209,494s
contra 2310s**. **100 segundos de sobra.** Seria a 10ª morte e o terceiro tombo
do mesmo aluno.

Isso vale registrar por dois motivos. O óbvio: por pouco. O que interessa: **o
conserto não salva job já submetido** — o `executionTimeout` vai no job na hora
do envio. Quem estava na fila às 20:50Z ainda corre pela régua velha.

## 8. Os alunos, e o que eu me recusei a dizer a eles

**Dinheiro conferido por `ref_type`, nunca por `kind`.** Os 4 mortos de hoje
(`wendellaraujo` 6.090 cr, `nettosl` 1.575, `gabriel.reis` 1.600, `alexandre`
5.460) **estornados 1:1**. Nada a devolver.

**`gabriel.reis2212.pt@gmail.com`** (Enviados **uid 2466**), pagante. Ele é o
`#416`, que a Fast arquivou como atendimento: *"como faço 90 vídeos se um demora
20 minutos?"*. **O Vigia leu certo: ele não pedia informação, descrevia um
defeito.** Respondi as duas coisas.

A parte que exigiu cuidado foi a primeira: **geração em lote NÃO existe no acesso
dele**. Conferi em código antes de escrever — `/app/videos/estudio` e
`/app/videos/studio` têm guard `isAdmin` (`page.tsx:37` e `:43`), o menu do
Estúdio só aparece com `isAdmin` (`sidebar-tree.tsx:404-412`), e o que é público
é só `/app/videos/clone` e `/app/videos/edicao`. **A tela existe, só que não pra
ele** — que é a armadilha do `#392` na forma mais fácil de cair: eu tinha uma
resposta boa e verdadeira pra dar, e ela o mandaria procurar uma coisa que ele
nunca ia achar. Disse com todas as letras: hoje são 90 gerações, uma a uma.

E **não ofereci o Turbo como contorno**, apesar de ser o que o item 8 do cartão
recomenda: **ele já estava no Turbo, foi nele que morreu.** Seguir a receita do
cartão aqui seria mandar o aluno para o lugar onde ele já está.

Disse também, explicitamente, que o conserto **não vai deixar os vídeos dele mais
rápidos** — só para de matar no meio. A lentidão continua em aberto e prefiro que
ele saiba disso por mim.

**`alexandre@novaconexao.com`** (Enviados **uid 2467**), pagante. 46 minutos
perdidos, não tinha perguntado nada e **ainda não tinha repetido**. Escrevi
**antes** de ele repetir — é o item 7 do cartão, que o `welrisson` pagou pra
aprender queimando o mesmo áudio duas vezes.

**Não afirmei a nenhum dos dois que ninguém os respondeu:** o `ja_falaram.cjs`
diz "sem registro", e sem registro não é prova de silêncio (lição do Rodrigo,
14/09).

## 9. 🟠 Para o Johnny — o que esta ronda põe na mesa e não é meu

- **O curso promete 90 vídeos; a plataforma entrega 1 clique = 1 vídeo.** Sem
  lote, com 7 a 25 min cada. Isso não é bug e não inventei resposta pro aluno:
  ou o curso ajusta a promessa, ou o produto ganha lote. **É decisão comercial.**
- **Reenfileirar sozinho no timeout** eu **não** implementei: gasta GPU sem o
  aluno pedir. A evidência do `nettosl` (mesmo áudio, 1654s morreu × 344s
  entregou) diz que uma retentativa teria boa chance. **Sua decisão.**
- Segue tudo do §3 do Vigia: **Gregório** (prazo legal correndo), **Maria
  Teresa**, **Valdir** (3º pedido), **bounces** parados na 17ª ronda,
  **`wallanadaphiny`** no 16º dia.

## 10. 🔴 Um susto de infraestrutura que vale mais que o incidente

No meio da ronda o `git` trocou de branch **debaixo de mim**: o `reflog` mostra
`checkout: moving from fix/404-… to feat/trial-por-produto` e logo em seguida
`reset: moving to origin/main`, **que não fui eu**. Há outros agentes rodando no
**mesmo working tree**.

**O meu trabalho sobreviveu porque estava commitado.** Eu tinha acabado de
commitar o conserto antes de sair mutando arquivo — não por disciplina abstrata,
mas porque a ronda das **20hZ** escreveu no §6 dela, com todas as letras:
*"commitar antes de experimentar, não depois"*, depois de um `git checkout`
apagar o conserto dela.

**A lição de ontem salvou o trabalho de hoje, uma ronda depois de ser escrita.**
Se eu tivesse deixado o conserto na árvore enquanto rodava as 5 mutações, o
`reset` de outro agente teria levado tudo, e eu descobriria pelo teste passando
contra código que não era mais o meu.

Fica o alerta, porque é maior que esta ronda: **duas ou mais rondas escrevendo no
mesmo clone se atropelam em silêncio.** Não perdi nada e por isso não abri
chamado, mas quem trabalhar aqui sem commitar cedo vai perder.

## 11. Placar

- **105 não-fechados**: `investigating` **80** · `open` **1** ·
  `aguardando_aluno` **24**.
- **Fechados por mim nesta ronda: 1** — `#416` (atendimento do `gabriel.reis`,
  respondido de verdade).
- **`#404` segue `investigating`**, com nota nova e `resolved_commit` gravado.
- **Em voo no fechamento: 2** — `775d8739` (régua velha, vence 21:18Z) e
  `a989ca2f` (**o primeiro job sob a régua nova**, teto 5010s). Deixo os dois
  para a próxima ronda **conferir em vez de adivinhar**.

---

## O que esta ronda diz

O `#404` foi escrito em 14/09 por alguém que fez a coisa difícil: mediu bem,
enxergou que não tinha como decidir, **disse que não tinha**, e propôs UM passo
pequeno — gravar o tempo do job que dá certo. Não recomendou subir o teto.
Recusou-se a chutar.

Vinte horas depois esse passo pequeno respondeu a pergunta inteira. **A cautela
de ontem não atrasou o conserto de hoje; ela é o motivo de ele existir.** Se o
cartão tivesse chutado "sobe o teto" em 14/09, teria acertado o quê — o número?
E ninguém saberia por quê, nem teria como saber quando parar.

A parte que eu quase errei é a mesma de todas as rondas desta semana, só que com
a máscara trocada. Eu tinha, para o Gabriel, uma resposta boa: *existe um Estúdio
que faz várias cenas.* Verdadeira. Útil. E ele **nunca** ia encontrar, porque tem
guard de admin. Não é mentira — é pior, é uma verdade que só funciona pra quem a
escreve. Trinta segundos de `grep` no `page.tsx` foi o que separou "te respondi"
de repetir o `#392` com uma tela diferente.

E fica a nota de rodapé que é quase piada: o que salvou o trabalho desta ronda
não foi esperteza minha, foi um parágrafo que a ronda anterior escreveu sobre o
próprio tropeço. Registro de erro só vale se alguém ler — **hoje alguém leu, e
eram quarenta minutos de trabalho.**

---

**O que eu NÃO fiz:** não fechei o `#404` (§5), não reescrevi título nem
signature de cartão nenhum, não mexi em `occurrences`, não mexi em crédito (os 4
estornos saíram sozinhos e conferi por `ref_type`), não implementei
reenfileiramento automático (gasta GPU sem o aluno pedir — decisão do Johnny),
não mexi no `perAudioSecond`, não subi migration, não mandei e-mail em massa (2
individuais, sobre 2 casos que eu estava tratando), não li a caixa de entrada
para triagem, não toquei em e-mail não lido, não editei nada no servidor por SSH
(só leitura, pra prova de deploy), não toquei nos branches STALE
(`feat/fix-image-upload-retry`, `feat/onedrive-401`,
`fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`), não mexi no `diaBR` nem na
política de renovação, não gastei GPU nem crédito de aluno, não liguei nem mandei
WhatsApp pra ninguém, e **não li nem reprocessei nada da planilha** (ordem de
29/08).
