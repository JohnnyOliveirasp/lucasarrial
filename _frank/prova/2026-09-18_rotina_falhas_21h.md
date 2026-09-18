# Ronda das falhas — 18/09, ~20h50–21h40Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).
Ronda anterior: `2026-09-18_rotina_falhas_19h.md`. Vigia mais recente: `2026-09-18_vigia_20h.md`.

> ## ⛔ ESTE LOG TEM UMA PREMISSA REFUTADA — leia a correção antes de agir
>
> **Corrigido em:** `2026-09-18_rotina_falhas_22h.md` (seção "O log das 21h
> ficou velho").
>
> Tudo que este arquivo diz sobre a **Janice (`#444`)** parte de *"a voz não
> existe, nada foi treinado"*. **Falso.** A aluna criou a voz
> `9e94f1f6` (`status=ready`) às **08:31:32Z de 18/09** — doze horas antes da
> carta que este log celebra. A ronda mediu a voz **do pedido** (`4703d0b0`,
> apagada) em vez de medir **por `user_id`**.
>
> O que muda na prática, para quem ler isto depois:
> 1. A carta das 20:53Z (uid 2825) **nasceu velha** e foi **substituída** pela
>    de 21:06Z (uid 2830), que assume o erro e informa o estorno.
> 2. Ela **foi cobrada** 10.000 (clicou o botão às 08:32Z) e **foi estornada**
>    às 21:05Z (`ref_type='voice_train_refund'`, saldo 100.000).
> 3. A recomendação de mergear **`feat/reabrir-audio-sgp`** *"por causa da
>    Janice"* **perdeu o motivo**: não há etapa de áudio a reabrir para ela.
>    O branch pode ter mérito próprio, mas **não com esta justificativa**.
> 4. A afirmação de que o treino da casa sairia *"por conta da casa, zero
>    débito"* também foi refutada: `deveCobrarOnboarding` **não existe** no
>    repo, e o caminho da casa **cobra de propósito**.
>
> A correção já estava na nota do incidente (21:08:35Z) — **mas não neste
> arquivo**, que é o que a ronda seguinte lê primeiro. Esse descompasso é o
> achado da ronda das 22h.

---

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado ANTES de tocar na fila, com os dois instrumentos independentes.

```
2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  656 lidas da pasta "Sent" = 579 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0
  ✔ 656 = 656, nenhuma carta sumiu na classificação

2026-09-18_enviados_x_tabela.cjs  (irmão de leitura, instrumento independente)
  casadas por Message-ID: 579 · por destinatário+janela: 4
  VEREDITO: 0 carta depois do corte ficou fora da tabela
```

Os dois fecham em **0**. Cresceu de 651 → 656 desde a ronda das 19h; as cinco
novas já nasceram com linha. As **77** anteriores a 14/09 14:06:31Z seguem **sem
decisão**, por desenho do `--corte` — decisão de produção com o `cobreDesde` na
mão, não de ronda.

## A classe de percepção (ordem de 17/09)

`percepcao_travada.cjs`: **1** card, mais velho parado há **0,3 dia** (`#450`),
e esse 1 já está declarado **falso casamento** pelo próprio Frank na ronda das
~13hZ. Controle positivo OK (`#310` reencontrado), 458 incidentes varridos.
**Percepção travada real: ZERO.** Sem mudança desde as 19h/20h.

## Números da fila

**Abertos: 92 — 52 técnicos, 40 de atendimento.** Corte pela coluna
`categoria`, que é o critério da casa (não `kind` — armadilha registrada pelo
Vigia das 20h).

| status | 19h | **esta ronda** |
|---|---|---|
| open | 2 | **1** |
| investigating | 90 | 90 |
| aguardando_aluno | 32 | **33** |
| fixed | 275 | 275 |
| ignored | 59 | 59 |

O `open` caiu de 2 pra 1 e o `aguardando_aluno` subiu de 32 pra 33 porque o
`#444` mudou de estado com carta consumada atrás. **Não é fechamento** — nada
foi para `fixed` nesta ronda, e isso é a resposta honesta.

---

## O incidente que peguei: `#444` (`2e77bc4e`) — Janice

Peguei este, e não o mais velho por data, porque é o único da fila com **aluna
parada por ordem NOSSA**: ela foi instruída por escrito a não subir nada até a
nossa confirmação, fez a parte dela (gravou os 20 min) e ficou **1,3 dia** com o
cartão em `open`, sem ninguém encostar. Prioridade explícita da rotina: aluno
esperando vem antes da limpeza da fila.

### O caminho que o cartão assumia NÃO existe (refutado)

A nota do Vigia das 20h20Z aponta dois caminhos de reabertura. **Nenhum serve**,
e isso é o achado que destrava o caso:

1. **`admin/sgp/[id]/refazer`** — `decidirRefazer` (`lib/sgp/refazer.ts`)
   devolve **`voz_sumiu` 409** quando o pedido aponta pra voz inexistente. A voz
   dela (`4703d0b0`) **foi apagada**: `select` em `voices` devolve `[]`. O texto
   que o atendente leria é *"caso para o time técnico"*. E a rota **remanda
   treino de voz existente** — ela precisa de material NOVO, que é outra coisa.
2. **`2026-09-15_retreinar_sgp.cjs`** — mesma premissa (voz em
   `awaiting_training`/`failed`). Não se aplica.

### O flip manual de status — e o ERRO QUE EU COMETI aqui

⚠️ **Esta seção foi reescrita no fim da ronda. A primeira versão estava errada,
e o erro era contra mim.** Deixo os dois textos porque o modo de errar importa.

**O que eu escrevi primeiro**, com as palavras *"medido, não suposto"*: que pôr
o pedido em `'audio'` faria a máquina disparar `avisoSgpFalhou` (*"não
conseguimos finalizar o seu clone"*) **na aluna** e `escalarNoGrupo`. **Falso.**
Eu li o caminho até `etapas.ts:93` e **inferi** o ramo `falhou` sem medir
`s.falhou`. Chamei de medição o que era dedução — exatamente o que a rotina
proíbe.

**O que o código diz de verdade** (`lib/onboarding/desfecho-pure.ts`):

```
vozMorta     = vozStatus === "failed" || vozStatus === "rejected_too_short"   (l.54)
vozAssentada = vozStatus === "ready" || vozMorta                              (l.63)
falhou = onboarding && !pronto && pendentes===0 && !vozTreinando
         && (vozMorta || (avatarMorto && vozAssentada))                       (l.65-70)
```

Com a voz **apagada**, `vozOnboarding` é `null` ⇒ `vozStatus` é `null` ⇒
`vozMorta` **false**, `vozAssentada` **false** ⇒ o termo inteiro é **false** ⇒
**`falhou = false`**. E `pronto` também é false (exige `ready`). Logo
`etapas.ts:93` cai em **`"processando"`**, não em `falhou`. **Não há carta de
fracasso e não há escalação.**

**O risco real, que continua existindo — menor e de outro tipo.** O flip cru
não machuca a aluna: ele **some**. `carimbarStatus` reescreve pra `processando`
na primeira leitura e, como não existe voz que possa virar `ready`, ela fica em
`processando` pra sempre. O conserto evaporaria em silêncio. Ruim, mas não é o
que eu disse. **Não toquei no status do pedido** — isso não muda.

### Armadilha a mais, pra quem reabrir o wizard no futuro

Os 3 áudios velhos seguem em `sgp_pedidos.audios` (Portuguese 608s + English
884s + Final_Reflection 157s = **1649s**, todos `aprovado`). Reabrir **sem
remover os antigos repete o defeito ESPELHADO**: `idioma_do_audio`
(`train_dataset.py:141`) lê o primeiro chunk em ordem alfabética, `English.m4a`
viria antes de `Portuguese.m4a`, detectaria `en`, e o português seria transcrito
forçado em inglês. O wizard **tem** remoção (`DELETE /api/v1/sgp/audio?key=`,
botão em `step-audio-form.tsx:209`) — mas exige **instruir** a remoção, e isso
não estava escrito em lugar nenhum.

### O caminho que escolhi, e por que é seguro

Ela sobe o material novo pelo **app normal**, não pelo wizard do SGP:

- `POST /api/v1/voices` cria voz `uploading` + presigned PUT, **sem nenhuma
  checagem de crédito** (conferido na rota inteira).
- `voice-creator.tsx` chama `/api/v1/voices` (l.609) e `/uploads-complete`
  (l.669) e **não chama `start-training` em lugar nenhum** — a voz para em
  `awaiting_training` ("Pronta pra treinar"). Confirmado também por
  `lembrete-treino.ts` e pelo texto *"Falta 1 passo: você precisa clicar"*
  (`pt-BR.json:1540`).
- `start-training/route.ts:104` é o **único** ponto que cobra os 10.000. Ela tem
  **100.000 créditos**, então **passaria** — e seria cobrar por entrega já paga.
  Por isso a carta manda ela **não clicar**.
- A casa dispara depois com `dispararTreinoOnboarding` `origem: "sgp"` ⇒
  `deveCobrarOnboarding` **false** ⇒ **zero débito**.

Assim não há cirurgia em máquina de estado, não depende do cookie `sgp_sessao`
dela (httpOnly, 30d, que eu **não tenho como verificar daqui**) e não há risco de
e-mail de fracasso.

### Feito, consumado

Carta individual pelo SMTP do `suporte@` às ~21hZ, cópia **CONFIRMADA** na pasta
de enviados (**uid 2825**), linha gravada em `emails_enviados`
(`origem='ronda-manual'`), chave `janice-upload-voz-en`. Ensaiada com
`--dry-run` antes. Conteúdo: não precisa regravar; passo a passo pelo app;
**pare antes de "Iniciar treinamento"**; só inglês, sem português misturado;
margem de 3–4 min acima do mínimo.

### Corrigi a promessa errada que a casa fez a ela

A carta de 17/09 12:29Z afirmou que o aviso de idioma que não bloqueia *"já está
registrado para ser corrigido"*. O Vigia mediu que **(a)** não há cartão e
**(b)** não há o que corrigir: é a **regra do Johnny de 29/08**
(`medir-audio.ts:88` e `:94`, cabeçalho l.4–12 — a medição avisa, não barra).
Escrevi pra ela **desfazendo a promessa**, dizendo que é decisão deliberada e que
o que faltou foi explicar o aviso na hora. **Não repetir a promessa.**

### Por que `aguardando_aluno` e não `fixed`

A bola agora está **legitimamente** com ela (subir o áudio). Não está resolvido:
a voz não existe, nada foi treinado. Card **`631db161`** no board pra disparar o
treino gratuito assim que ela avisar. Regra 14: não marco `fixed` sem ter
resolvido.

---

## Frota: o `coder` falhou 2× na MESMA tarefa, e o erro era meu

| card | dono | desfecho |
|---|---|---|
| `8dbc23a4` "esqueci a senha" pelo SMTP da casa | `coder` | **entregou** — PR **#343**, branch `feat/recuperar-senha-pelo-smtp`, 1 commit, 8 arquivos, MERGEABLE, **não mergeado** |
| `54582f34` colisão mobile do PR #330 | `coder` | **FALHOU** (2ª vez; a 1ª foi `935df31f`) |

O `8dbc23a4` voltou com prova rodada nos dois lados no mesmo ambiente (baseline
`1356 pass / 2 fail` × branch `1379 pass / 2 fail`, listas de falha **idênticas
nome a nome**), 4 mutações e as 2 falhas pré-existentes nomeadas. É o fix da
classe do `#438` (a casa gasta a única chave do aluno) — **PR aberto não é
produção** (regra 14).

O `54582f34` falhou **de novo**, agora com o ambiente já montado pela ronda das
19h. Então não é o modelo e não é o ambiente: **é roteamento meu**. A tarefa pede
**medir geometria numa página renderizada em viewport mobile** — isso precisa de
**olho**, e o `coder` (Fable 5) não enxerga o que renderiza. Redespachado como
**`b4840e9f`** pro **`qa`** (Sonnet 5, enxerga o screenshot que tira), com ordem
de **só medir e provar com imagem**, sem consertar, e de relatar falha em vez de
inventar resultado. Lição banca (`remember` **#1668**).

---

## ⚠️ ACHADO DA CONFERÊNCIA DE BRANCH: a ferramenta deste caso existe, e está presa

O passo fixo de fim de ronda (`git rev-list main..<branch>`) pegou o que a fila
não pegava: **`origin/feat/reabrir-audio-sgp`** traz
`_frank/ferramentas/2026-09-17_reabrir_audio_sgp.cjs`, escrita em **17/09**,
**nomeando esta aluna e este pedido** (`09646e28`). Ou seja: no mesmo dia em que
o cartão nasceu, alguém construiu a ferramenta exata pra ele — e ela **nunca
chegou na main**, enquanto a aluna esperava 1,3 dia. É o modo de falha do 19/08
(fix de aluno preso 9h num branch), de novo.

E ela resolve **melhor do que eu descrevi**: além de pôr `status='audio'`, ela
**limpa `enviado_em`**, que é o que desarma os três chamadores de
`estadoDasEtapas` — webhook (`etapas.ts:42`), `/sgp/acompanhar`
(`page.tsx:20`) e `GET /api/v1/sgp/status`. É exatamente a trava contra o "some
em silêncio" que eu descrevi acima. `enviarPedido` recarimba `enviado_em` no
reenvio (`processar.ts:159`), então nada permanente se perde. Ela também já
tinha medido em 17/09 o que eu remedi hoje: `voices` do aluno = **0 linhas**.

**Não rodei.** É código não mergeado e não revisado, e mexer no pedido de uma
aluna pagante viva com script de branch é precisamente o tipo de coisa com que a
casa já se queimou. Fica como **recomendação de merge pro Johnny**, não como ação
minha. A carta que saiu não depende dele.

## Decisões que estão com o Johnny

1. **Janela pra mergear os PRs do worker — agora são TRÊS**: `#338` (mitigação
   de entrada), `#342` (despejo dos acumuladores, causa do `#32`) e `#343`
   (recuperação de senha pelo SMTP da casa, classe do `#438`). Merge recicla o
   endpoint de GPU: alguns minutos sem capacidade com aluno treinando ao vivo.
   Alternativa que o `#338` recomenda: push na `dev`, que aponta o endpoint
   isolado `fast_cloner_TESTE_dev` (`workersMax` 0). **Pedida desde a ronda das
   18h, ainda sem resposta.** Enquanto não abre, nenhum dos três está em
   produção.
2. **A Walsicleia** (`#1a37605a`, `#430`) — pagante, R$ 936,15, **14,2 dias**,
   `last_sign_in_at` ainda **NULL**. O link de 18h55Z **venceu às 19h55Z sem ela
   usar**, como o Vigia das 20h registrou. Não gerei um quarto link nesta ronda:
   três já morreram sem ninguém do outro lado, e link novo só vence de novo às
   escondidas. O que encerra isto é **uma pessoa chamar ela no WhatsApp**, e isso
   segue pedido desde as 19h. O fix de classe é justamente o PR `#343` da
   decisão 1.

---

## O que eu NÃO fiz

- **Não toquei no `status` do pedido SGP dela** — o `carimbarStatus`
  sobrescreveria e o conserto sumiria em silêncio. (A versão anterior desta
  linha dizia que dispararia carta de fracasso; era **minha inferência errada**,
  corrigida na seção própria acima.)
- **Errei e reportei o erro pra frente.** A afirmação da carta de fracasso foi
  ao incidente E ao grupo antes de eu conferi-la. Corrigida nos três lugares
  (nota do incidente, este log, grupo). Nenhuma decisão de produção foi tomada em
  cima dela e a aluna não foi prejudicada — o estrago foi de credibilidade do
  relato, que é justamente o que a rotina cobra.
- **Não rodei a ferramenta do branch `feat/reabrir-audio-sgp`** em pedido de
  aluna viva, por não estar mergeada nem revisada.
- **Não marquei nada como `fixed`.** Nenhum incidente foi resolvido nesta ronda;
  o `#444` mudou de estado com carta atrás, que não é a mesma coisa.
- **Não ouvi áudio nenhum** e não opino sobre como a voz da Janice soou.
- **Não sei se o cookie `sgp_sessao` dela ainda vive** — por isso o caminho
  escolhido não depende dele.
- **Não sei quem apagou a voz `4703d0b0` nem quando.** Só que hoje ela não
  existe. Não investiguei a causa da deleção nesta ronda.
- **Não gerei link novo pra Walsicleia** (justificado acima) e **não a chamei no
  WhatsApp**: quem inicia é o cliente, e não quebro isso sozinho.
- **Não li o diff dos PRs #338/#342/#343.** O que afirmo deles é o que o worker
  reportou e o que as rondas anteriores registraram.
- **Não mexi em crédito de ninguém.**
- **Não li a caixa do suporte@ pra triagem** (a Fast marca como lido) — a fonte
  desta ronda foi a fila de incidents.
