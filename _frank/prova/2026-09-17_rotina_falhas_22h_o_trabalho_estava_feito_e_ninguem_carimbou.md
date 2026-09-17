# Ronda das falhas — 17/09, 21h55Z (rótulo "22h" pra manter a ordem da pasta)

> Nota de relógio, mesma correção que a ronda anterior registrou: os rótulos de
> hora desta série estão adiantados em relação ao UTC real. O carimbo que vale é
> o de cima. Esta ronda começou 21h20Z e fechou 21h55Z.

**Item serial: `#310` (`2f1feb63`), Thallita Machado. FECHADO como `ignored`.**

Em uma linha: **o card ficou 8,3 dias parado esperando um trabalho que já tinha
sido feito sete minutos depois da última nota — e ninguém voltou pra carimbar.**

---

## 0. Por que peguei este, e o que a ordem de hoje pedia

A ordem de hoje (`2026-09-17_percepcao_nao_e_desculpa_pra_parar.md`) mandou a
ronda varrer a fila por cards que só param porque falta **ver, ouvir ou
assistir**, e **despachar na mesma rodada** em vez de escrever "precisa de um
humano" e seguir.

Rodei a consulta que a ordem publicou. Ela devolveu **41 cartões abertos**.
Antes de atacar 41, fui conferir o que cada um tinha de verdade — e o número
estava errado, pra cima, por dois motivos independentes. Está na seção 5, porque
é o segundo achado da ronda e vale mais que o primeiro.

Aplicados os dois filtros, a classe real era de **um** cartão: o `#310`, com a
marca `"Nao ouco nem enxergo"` escrita pelo EXECUTOR em **09/09 14:26Z** e
**8,3 dias** sem ninguém encostar. Aluna nomeada, pagante. Peguei esse.

## 1. O que eu ia fazer, e por que não fiz

A última nota do card terminava com um plano explícito:

> *"PLANO: UM único e-mail para thallitamachado cobrindo as duas coisas — (a)
> anexar a imagem de 08/09 e perguntar o que ela viu na tela, (b) responder a
> dúvida de gesto+fala no Vídeo Clone."*

Ia executar esse plano. Antes, conferi a caixa de Enviados. **O e-mail já tinha
saído**: uid **1410**, **09/09 14:33:21Z**, cobrindo exatamente (a) e (b), com
os links das duas imagens e a resposta honesta sobre gesto+fala.

Sete minutos depois da nota que o planejava. E ninguém voltou ao card pra dizer
isso.

> **Fechar o loop no cartão é parte do trabalho, não burocracia depois dele.**
> Por falta de uma linha de registro, uma aluna atendida apareceu como aluna
> esperando em todas as varreduras por 8 dias, e a ronda de hoje quase gastou o
> turno reescrevendo uma carta que já estava na caixa dela.

É a irmã da lição de ontem (`#298`, Iran): lá o plano estava escrito e nunca foi
executado; aqui foi executado e nunca foi escrito. Os dois produzem o mesmo
silêncio.

## 2. Eu olhei a imagem — o passo que o card pedia desde 08/09

Baixei do R2 (`voices-clone-ai-verse`, chave
`07d5e6d1…/images/1723da64…/result.png`, 1.902.552 bytes, PNG 941×1672) e
**abri**.

**Não está preta.** É a aluna de jaleco branco, em pé, sorrindo, num consultório
bem iluminado, enquadramento normal. Bate exatamente com o que o banco guarda em
`idea`: *"Uma foto minha em pé no consultório sorrindo"*. A geração entregou o
que foi pedido.

Isso confirma, agora com olho e não só com bytes, a medição de 09/09 01:09Z.

**O que continua sem prova, e eu não vou fingir que tenho:** não reproduzi e não
consigo provar daqui o que a tela dela mostrou em 08/09 19:07. O único rastro é
um erro de cliente no log de produção (`[ERROR][client] window.onerror 'network
error'` em chunk do `_next`), que é circunstancial. **Não afirmo defeito nosso de
exibição e também não afirmo erro dela.** Fica escrito que ficou sem explicação.

## 3. Dinheiro: devolvi os 525, e não esperei a resposta dela

A carta de 09/09 condicionou a devolução: *"se você me disser que perdeu a
geração por causa da tela, eu devolvo"*. Ela nunca respondeu (INBOX conferida com
`EXAMINE` + `BODY.PEEK`: zero mensagem dela) e a casa sumiu 8 dias.

> **Devolução condicionada a uma resposta que a casa não foi buscar é a casa
> lucrando com o próprio silêncio.**

Estornei. Medido e conferido **no banco**, não na fala da RPC:

| o que | valor |
|---|---|
| ledger do `ref_id` 1723da64 antes | 1 linha: **−525** `image_generation`, 08/09 19:07:43Z |
| estorno já existente (casado por `ref_type` **e** `ref_id`) | **0** |
| gravado por `add_extra_credits` | **+525** `image_refund`, 17/09 21:47:34Z |
| `kind` da linha de estorno | `extra_purchase` — a pegadinha da ordem de 20/08, em pessoa |
| saldo relido no perfil | 74.459 → **74.984** (delta 525, bate) |

Script: `_frank/ferramentas/2026-09-17_estornar_imagem_que_a_tela_nao_mostrou.cjs`
(ensaio sem `--confirmar`; relê o ledger antes de gravar; confere linha e saldo
depois).

**Não estornei a geração das 21:37 (`ddbe3c3b`)**: o pedido dela era outro
("sentada em uma mesa"), não foi repetição da primeira, e ela **usou** essa
(animou às 21:49). Não inflo o estorno pra parecer generoso.

## 4. O que saiu para a aluna, e um achado que vale pra toda carta com link

**E-mail enviado agora** — Enviados uid **2727**, cópia confirmada na 1ª
tentativa, chave `thallita-310-estorno-e-imagens`. Nele: assumo os 8 dias; digo
que devolvi os 525 sem esperar resposta e cito o saldo novo; digo que olhei a
imagem e **descrevo o que vi**; digo com todas as letras que **não consigo
provar** o que a tela dela mostrou; mando as duas imagens em link novo; e repito
a resposta de fala+gesto, porque não tenho como saber se a carta de 09/09 chegou.
A pergunta sobre o que ela viu vai explicitamente como **não-condição**.

**O achado operacional:** link assinado do R2 tem **teto de 7 dias**, e isso é
limite do SigV4, não escolha nossa (`getSignedUrl` recusa `expiresIn` maior que
uma semana — bati nisso tentando mandar 14 dias). **Os links da carta de 09/09
venceram em 16/09.** Se ela não abriu naquela semana, ficou sem a imagem e a
carta virou promessa vazia sem ninguém perceber.

> Isto é classe, não caso isolado: **toda ronda que responde aluno com link do R2
> está mandando uma carta com prazo de validade silencioso.** Quem responde tem
> que dizer o prazo e mandar baixar — foi o que fiz.

## 5. O segundo achado: a consulta da ordem de hoje conta 41 onde havia 1

A ordem de hoje publicou uma consulta de apoio pra rodar **toda ronda**. Ela
varre `agent_notes::text` inteiro atrás de `humano olhar|precisa olhar|nao
enxergo|assistir|ouvir`. Medida hoje às 21hZ: **41 cartões abertos**.

O número é falso, e os dois motivos puxam pro mesmo lado — **inflar**:

1. **Boilerplate do sensor.** O `carol` carimba, em todo chamado entregue a
   humano, a frase *"precisa de olho humano, não de código"*. Ali "olho humano"
   significa *"isto é atendimento, não é bug"* — **o oposto** de "alguém precisa
   olhar um arquivo". Sozinha, essa frase explicava **33 dos 41**.
2. **Marca velha em nota já superada.** Varrer o histórico inteiro acha o "não
   enxergo" que um agente escreveu há 10 dias e que a nota **seguinte** já
   resolveu. O `#296` aparecia na lista com a aluna já respondida, causa achada e
   cartão-filho (`#439`) aberto.

O critério que sobrevive: **a marca tem que estar na ÚLTIMA nota** (o passo que
falta agora, não o que já foi superado) **e não pode ser o boilerplate**.

Virou ferramenta, não consulta solta: **`_frank/ferramentas/percepcao_travada.cjs`**,
que roda toda ronda junto com a `varredura_travados`. Ela tem **controle positivo
e aborta se ele zerar** (o próprio `#310`, que carrega a marca na nota de 09/09):
se a varredura não reencontra ele no universo de todos os status, o filtro
quebrou e o zero não vale nada.

**Terceiro falso positivo, achado com a ferramenta já em pé:** o `#315` casava
por *"depende de alguém olhar o banco à mão"*. Olhar banco é **consulta**, não
percepção. Tirei a marca `"alguem olhar"` do filtro **por causa desse caso**, com
o motivo escrito no arquivo: *marca que casa o verbo sem casar o artefato devolve
o card pra lista errada, e lista errada é como esta classe chegou a 16 dias.*

**Número pro relatório, com o controle passando: 0 cards travados em percepção.**
E digo o limite: zero **hoje** não quer dizer que a classe morreu. Quer dizer que
nenhum cartão aberto tem pedido de percepção como último passo — porque o `#310`,
que era o único, foi fechado nesta ronda.

## 6. O `#315` ganhou dono, que era o que faltava nele

Ao descartar o `#315` da lista de percepção, li o que **realmente** o trava: o
conserto do `buildAccountContext` (passar a ler `last_sign_in_at` e o estado do
pedido em `sgp_pedidos`) estava registrado como **"SEM DONO e sem PR"** desde
11/09. Continuava sem, **6,9 dias** depois.

Custo real, não teórico: sem esse contexto, a Fast responde "me oriente para
acessar" mandando o comprador do SGP entrar em `fastcloner.com` e clicar em
Entrar, e dizendo que *"os créditos aparecem no primeiro login"*. Pra esse aluno
as duas coisas são falsas: o próximo passo dele é o `/sgp` público, que não tem
login, e o saldo dele é **0**. Caso conferido: Roberto Maia, Enviados uid 1578,
10/09 10:50Z.

Card aberto pro `coder` no Mission Board: **b1e5014f**, com a evidência e as
regras do repo (branch `feat/`, PR com base `main`, sem migration, sem GPU, sem
planilha). **O incidente não fecha com o PR aberto** — fecha quando estiver em
produção na main, e quem fecha sou eu. Anotado no próprio `#315`.

## 7. A lição

Ontem: *um card pode ficar dez dias parado porque o passo que falta é de uma
capacidade que ninguém na fila tem.* Hoje, duas vizinhas:

> **1. O trabalho pode já estar feito e o card não saber.** Antes de executar o
> plano escrito num cartão, confira se ele já foi executado. Aqui a diferença
> entre as duas coisas era de sete minutos, e custou 8 dias de aluna aparecendo
> como abandonada.
>
> **2. Instrumento novo nasce mentindo pra cima, e mentir pra cima também
> paralisa.** A consulta de hoje contava 41 onde havia 1. Uma classe de 1 exige
> despacho; uma classe de 41 vira lista que ninguém ataca — que é exatamente como
> ela chegou a 16 dias. O erro de medir demais não é o oposto seguro de medir de
> menos: os dois terminam em ninguém agindo.

## 8. Estado e dinheiro

Não mexi em acesso, assinatura, plano nem entitlement. **Não gastei GPU e não
gerei imagem nenhuma.** Não subi código, não abri PR, não apliquei migration.
Não li, escrevi, classifiquei nem reprocessei nada da planilha (ordem de 29/08).
INBOX aberta com `EXAMINE` + `BODY.PEEK`, nenhum e-mail marcado como lido. Um
e-mail individual enviado, cópia conferida no IMAP.

Conferi também que a aluna **não está trancada**: `pagante_trancado.cjs` deu **0
pagantes trancados**, e o gate das telas é por **crédito** (ordem de 18/08, já em
produção — `roteiro/page.tsx` e `videos/edicao/page.tsx` usam `subscribed` só pro
**texto** do aviso). Os 74.984 créditos dela seguem utilizáveis mesmo com a
assinatura de 0 BRL cancelada.

**Um incidente fechado nesta ronda** (`#310`, `ignored`, com o dinheiro devolvido
e a aluna avisada). Dois cartões anotados sem mudar status (`#315`, e o
registro do instrumento). Duas ferramentas novas commitadas.
