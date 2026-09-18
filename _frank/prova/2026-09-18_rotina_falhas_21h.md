# Ronda das falhas — 18/09, ~20h50–21h40Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).
Ronda anterior: `2026-09-18_rotina_falhas_19h.md`. Vigia mais recente: `2026-09-18_vigia_20h.md`.

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

### O flip manual de status seria PERIGOSO — medido, não suposto

Cogitei `pedido.status` `'pronto'` → `'audio'` pra reabrir o wizard. **Não fiz**,
e a razão é concreta:

> `lib/sgp/etapas.ts:93` calcula
> `status = s.pronto ? "pronto" : s.falhou ? "falhou" : "processando"`
> e o `carimbarStatus` (`etapas.ts:126`) escreve esse valor com `.eq("id")`
> **sem guarda de status** — sobrescreve incondicionalmente.

O pedido dela tem `enviado_em` preenchido (16/09 20:00:46Z), então
`avancarEtapasDoUsuario` **não** retorna cedo e a máquina roda. Com a voz
apagada, o caminho `falhou` dispara **`avisoSgpFalhou`** (e-mail *"não
conseguimos finalizar o seu clone"*) **na aluna** e `escalarNoGrupo`. Eu teria
trocado 1,3 dia de silêncio por uma **carta falsa de fracasso**. Não toquei no
status do pedido.

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

- **Não toquei no `status` do pedido SGP dela** — e o log acima diz exatamente
  por quê (o `carimbarStatus` sobrescreveria e dispararia carta de fracasso).
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
