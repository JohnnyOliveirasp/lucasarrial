# Rotina das falhas — 03/09/2026, ~10h–11hZ

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, canal de 31/08 (tudo do
FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha desativada) e
`2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **6** | **7** |
| aguardando aluno | 10 | 9 |

O placar de abertos **subiu de propósito**, e essa é a entrega da ronda: o `#222` saiu de
`aguardando_aluno` para `investigating`. Não é incidente novo — é um que estava marcado como
"a bola é do aluno" enquanto **ninguém tinha perguntado nada a ele**. Placar que melhora por
rótulo errado é o fechamento falso que estas rondas vêm desfazendo.

**1 aluno escrito** (Eduardo, `uid 481`). **0 fechados** — nada foi resolvido até o fim, e digo em
que passo cada um parou no §4.

---

## §1 — Por que peguei o `#222` fora da ordem serial

Pelo serial puro o da vez seria o **`#47`** (Katia, aberto 19/08, o mais antigo com aluno
esperando; reaberto 02/09 16:27 por retratação, defeito real provado no envelope aos 34,49s).

Peguei o `#222` na frente pela **exceção prevista na ordem de 21/08**: *"produção fora do ar ou
dinheiro sendo cobrado errado agora"*. Aqui é o segundo caso, e literal — gente sendo cobrada
mensalmente por um produto que nunca conseguiu abrir. O `#47` fica como o serial da próxima ronda,
com o caminho já mapeado no §5.

O gatilho foram 2 recados novos de hoje de manhã (`para_frank_orfa_*`, 09:09Z e 09:21Z). Puxei o
fio e o fio era muito maior que os 2.

## §2 — A medição: a classe é 5x maior do que o próprio chamado diz

`entitlements` com `user_id IS NULL` e `status='active'`: **46** órfãs; **26** com `access_until`
ainda vigente. O título do `#222` diz **5**.

Separando **acesso vivo** de **pagamento** (armadilha do `#138` — trial R$0 tem acesso vivo e não
é dinheiro):

| | quantos | o que é |
|---|---|---|
| pagaram | **15** | 14 × R$ 97 BRL + 1 × 118.887 **PYG** |
| valor 0 | 11 | trial |

⚠️ **Conferi a moeda antes de citar o número.** O `118.887` do `rutifortuna8` é **guarani
(PYG ≈ R$ 85)**, não R$ 118 mil. Sem olhar o `currency_value` eu teria posto um outlier de seis
dígitos no relatório do Johnny e o resto da medição perderia a credibilidade junto.

**O número que dói: 8 dos 15 já foram cobrados de novo** (`recurrence_number >= 2`) sem nunca ter
entrado — 2 deles no **3º ciclo**.

## §3 — O achado que mudou o status: `aguardando_aluno` estava afirmando uma coisa falsa

`aguardando_aluno` afirma que a bola está com o aluno. Conferi a caixa de **Enviados** de 6 dos
pagantes de ciclo 2+: **zero e-mail, nunca**. Ninguém perguntou nada a eles.

**Conferi o zero contra instrumento cego** (a armadilha do `medir_pausas`, que reportou "0 pausas"
por ler o canal errado): controle no `jkakorio` pelo mesmo comando devolveu **2**, que são
exatamente os 2 e-mails que existem. O instrumento enxerga; os zeros são reais.

Consequência prática: o rótulo tirava a classe do placar de abertos **enquanto 15 pessoas
pagavam sem conseguir entrar**. Corrigido para `investigating`, com a medição inteira gravada na
nota (1 linha afetada, conferida na releitura).

## §4 — O que fiz, e em que passo parou

**Feito:**
- **E-mail individual ao `scandovieri41@hotmail.com`** — pagante desde 26/07, **2º ciclo cobrado**,
  **nunca contatado em 39 dias**. Pergunta com qual e-mail ele entra. Cópia **confirmada** em
  Enviados **uid 481**. Individual, sobre caso que estou tratando: **regra 8, decidi sozinho**.
- **`#222` corrigido**: status e a medição real (26 / 15 / 8) na nota.
- **2 chaves `para_frank_orfa_*` apagadas com `DELETE`** (não `set_state` null — 23502), conferido
  0 restantes.
- **Grupo avisado** com o pedido de autorização e o caso do Vinícius.

**Parou aqui, e por quê:**
- **13 pagantes não contatados seguem sem e-mail.** 13 mensagens do mesmo texto é **comunicação em
  massa** e precisa do "pode" do Johnny (regra 8). O texto está pronto e já rodou uma vez.
  **Este é o passo que emperrou, e ele emperra em autorização, não em técnica.**
- **Não vinculei nenhuma compra a nenhuma conta.** O recado do vigia proíbe adivinhar por
  nome/prefixo, e o par `cdmarciofernandes` **@hotmail** (compra) × **@gmail** (conta) mostra o
  tamanho da armadilha: o palpite seria plausível e ainda assim um chute que joga a assinatura de
  uma pessoa na conta de outra.
- **Não mandei segundo e-mail ao `jkakorio`**: a Fast já tinha escrito hoje 09:23Z (uid 480). Aviso
  repetido é ruído.
- **A causa raiz continua de pé.** O `#222` registra que o resgate casa **só por e-mail**
  (`claim.ts:39 → reconcileUserEntitlements`) e que esta é a **6ª vez** que a classe volta
  (`#20`, `#27`, `#36`, `#195`, `#218`) **sem nunca virar conserto**. Escrever para os alunos é
  remediação; enquanto o casamento for só por e-mail, a fila se enche de novo sozinha.

## §5 — Ressalvas honestas

- **Não confirmei ausência de bounce** do envio ao Eduardo. O `ler_caixa.cjs` busca só `SEEN`, e um
  bounce recém-chegado estaria **não lido** — ou seja, fora do alcance do comando. Rondas
  anteriores trataram "não apareceu" como "não houve"; **isso não se sustenta neste instrumento**.
  O que posso afirmar: o SMTP aceitou e a cópia gravou em Enviados (uid 481).
- **Não conferi a caixa dos outros 9** dos 15 pagantes (conferi 6 + `jkakorio` + Eduardo). Os 13
  "não contatados" do §4 assumem que os não conferidos também não foram escritos — **é inferência,
  não medição**. Antes de disparar o lote, conferir os 9 restantes.
- **Não rodei `pagou_de_verdade.cjs` nos 26**, só em 2. Para os outros 24 a classificação
  pagou/trial vem do `raw_event` gravado, não da Hotmart viva.

## §6 — O que NÃO toquei, de propósito

- **Patch do Vigia `patch_f8587cef` (§1-B) não foi aplicado.** A rotina manda tratá-lo antes do
  resto; escolhi dinheiro-cobrado-errado na frente e assumo a inversão. Ele segue na fila, junto
  com `patch_687890f5` e `patch_702cc916` — **3 patches parados**.
- **Não virei a chave** `TTS_TAIL_QA_INTERNO_MODO` (a sombra do `#234` mede precisão ~57%; ligar
  força regeneração em geração boa).
- **Não decidi o cancelamento do Vinícius** (`#240`, R$ 2.697,60, aberto 04:10Z depois da resposta
  dele à 01:10Z). Envolve devolver dinheiro: é do Johnny. **6ª ronda** da mesma pergunta comercial.
- Não mexi em crédito, acesso, GPU, voz nem migration (102 segue não aplicada, **9ª ronda**).
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- **Não li a caixa do `suporte@` para triagem** — só `--enviados --para <email>` dos casos que eu
  estava tratando e `--ultimos 6` para procurar bounce do meu próprio envio.
- Não ouvi áudio nenhum: **não afirmo nada sobre som** nesta ronda.

## Pendências que atravessam rondas

| item | estado |
|---|---|
| **"Pode" do Johnny p/ e-mail em lote aos 13 pagantes sem acesso** | **nova, bloqueando 13 pessoas que pagam** |
| **Causa raiz do `#222`**: resgate casa só por e-mail — 6ª volta da classe, nunca virou conserto | **nova aqui, velha no sistema** |
| **Decisão comercial: compra de CURSO dá crédito?** (`#202`/`#173`/Cristina/Robert) + agora `#240` pede cancelamento | **6ª ronda** |
| Decisão de produto do `#226` (QA esgota: falhar sem cobrar ou entregar avisando?) | **6ª ronda** |
| `#47` (Katia) — serial da próxima ronda; defeito real provado, reaberto 02/09 | aguardando |
| 3 patches do Vigia parados (`f8587cef`, `687890f5`, `702cc916`) | **cresceu** |
| 16 recados `para_frank_*` na fila, o mais velho de 29/08 | **cresceu** |
| PRs #41/#42 (teto de 2MB) | 14º dia |
| Migration 102 (`#232`) sem aplicar | **9ª ronda** |
| `aluno.cjs` "compras: NENHUMA" lido como verdade de pagamento | aberta desde 03/09 01h |
