# Ronda das falhas — 05/09/2026 ~23:40–00:20Z (Frank, dono da fila)

Fila no início: **31 abertos + 13 aguardando aluno**. No fim: **18 abertos + 13
aguardando aluno** — **13 fechados**, todos do mesmo apagão.

**Resultado: o Vídeo Clone VOLTOU. A causa que a ronda das 22h provou na fonte
estava certa, o PR #192 mergeou, e agora existe a prova que faltava — geração
`ready` em produção, nos DOIS tiers. Apagão de ~12h20 encerrado. Dinheiro
conferido pelo ledger: 53 falhas, 9 alunos, 53 estornos, ninguém perdeu
crédito.**

---

## 1. `gh pr list` primeiro — oitava ronda seguida em que paga

Os dois PRs que a ronda anterior estava esperando **mergearam**, e nenhum
apareceu na lista de abertos porque já não estavam lá:

| PR | merge | commit | deploy |
|---|---|---|---|
| `#192` (Vídeo Clone, `85c9a45a`/`#266`) | 22:45:35Z | `82a9b91` | Build ComfyUI Worker **23:15:50Z** SUCCESS |
| `#191` (garantia, `#265`) | 22:48:03Z | `b4a7a390` | Deploy Frontend prod **22:48Z** SUCCESS |

⚠️ **A build do worker terminou 23:15:50Z, não na hora do merge** — 30min de
build. Quem tivesse medido "depois do merge" às 22:50 teria concluído que o fix
não funcionou. A janela que vale é **depois da build**, não depois do merge.

## 2. A prova que faltava — e ela veio de um aluno de verdade

A ronda das 22h fechou com a régua certa: *"a prova final é geração `ready` no
banco depois do deploy — nada menos que isso conta"*. Ela veio sozinha.

- Última falha: **23:12:19Z** — **antes** da build terminar (23:15:50Z).
- Primeira tentativa depois da build: **23:41:33Z**, `bilaherrmann@gmail.com`,
  `480p-v2`, 6.4s → **`ready`**, com `video_path` gravado, em **~2min**.

Não aceitei o `status` sozinho: conferi o `video_path` no banco
(`.../571a2708-.../result.mp4`). Último sucesso anterior tinha sido **11:26:49Z**
— **~12h20 de apagão**.

## 3. Faltava metade da prova, e eu fui buscar

A geração real cobriu só `480p-v2` com 6.4s. As falhas do dia incluíam
`480p-v3` e áudios de 30s/41s. Fechar 12 chamados em cima de um único job curto
de um tier só seria o mesmo erro de sempre com roupa nova.

Rodei a `fumaca_video_clone.cjs --tier 480p-v3`, que existe exatamente pra essa
pergunta e usa material da casa:

```
VIDEO CLONE DE PE (job 6584123c ready em 93s, MP4 de 2.49 MB)
custo NÃO cobrado de ninguém: 735 créditos (conta da casa)
```

**Gastou GPU (~R$0,17) e eu decidi sozinho.** Justifico: a ferramenta é
documentada pra isso, não toca em crédito de aluno, não cria linha em
`video_clones` e não dispara webhook (não imprime estorno do nada). O que ela
comprou foi transformar "os dois tiers usam os mesmos nós, então deve estar
bom" em fato medido.

## 4. O dinheiro — e um erro meu, corrigido

Contei primeiro pela tabela `video_clones`: **27 falhas, 7 alunos**. Mandei
isso pro grupo. **Estava errado, pra menos.**

Dois alunos (`pcezardireito`, `smilefastrio`) tinham chamado de rajada com o
erro do nó 194 no `sample_error` e **zero linha `failed`** na tabela. Não era
detector doido: o chamado nasce da assinatura
`fail-burst:video_clone_refund:<email>`, ou seja **do extrato**, e o aluno
**apagou a tentativa do histórico** — o DELETE leva a row junto e ela some da
contagem. É o "débito órfão" que o manual já descreve como normal; o que é novo
é que ele também **encolhe o placar de vítimas** se você contar pela tabela.

Refiz pelo **ledger**, por `ref_type` (nunca por `kind` — armadilha medida):

| | tabela `video_clones` | **ledger (vale este)** |
|---|---|---|
| falhas | 27 | **53** |
| alunos | 7 | **9** |

**53 falhas, 53 estornos, valor idêntico ao débito, aluno por aluno.** Ninguém
perdeu crédito, ninguém foi estornado em dobro.

Os débitos que **sobraram** de pé foram todos conferidos um a um e são de vídeo
que **deu certo** — inclusive os dois que pareciam sobra:
- `renatarcpsi`: 9 débitos × 8 estornos. A diferença (9.240) é um clone `ready`
  de **01:16Z**, antes do apagão. Correto.
- 6 alunos com 1 débito e 0 estorno: os 6 estão `ready`. Correto.

Mandei a correção pro grupo por cima do número errado. Número que eu já disse e
que estava errado não vira nota de rodapé.

## 5. O que fechei — 13 chamados

`85c9a45a` (`#266`) + os 12 do apagão: `414a8d2d`, `559c676a`, `209d821a`,
`0bf82a53`, `12c8b224`, `41fe25c5`, `32d09801`, `485c3c3f`, `6a75aaf7`,
`786c5ece`, `4810ac97`, `c1673a34`. Todos com `resolution_note` dizendo o que
era, o que curou, o commit e a prova, e **todos conferidos na releitura em 1
linha afetada**.

Isso **não** fere o backlog serial: é um chamado só, com uma causa só, levado
até o fim — os outros 12 são a mesma causa vista por 12 janelas. Fechá-los é
escrituração do que já foi resolvido, não atalho.

**Deixei abertos de propósito 2 chamados de Vídeo Clone que NÃO são deste
apagão** e seriam fechados junto por descuido: `e39e7980` (qualidade do áudio,
"voz de bêbada") e `1dd204f5` (upload travado na transcrição, de 04/09). Causa
diferente, e apagão que cura não cura esses.

## 6. Garantia (`#265`/`71410a81`) — no ar, e **continua aberto**

O `#191` entrou. Conferi a armadilha da migration e **ela não se aplica**: o
`garantia.ts` lê `product.warranty_date` do jsonb de `payment_events`, e
confirmei que **não existe** coluna `warranty_date` em `purchases` — não há DDL
pendente, o código funciona no ar.

**Katia**, que era o prazo de 06/09: a compra **paga** dela (22/08, `value=15`,
APPROVED) tem `warranty_date = 2026-09-06T00:00:00Z`. As outras duas linhas são
`value=0` e caem fora pelo filtro `price.value > 0`, que é o comportamento
certo. A janela dela fechava **00:00Z de 06/09** e o fix entrou **~72min
antes** — dentro do prazo. Não há pedido de reembolso dela na fila, então não
há valor a devolver, e **não escrevi pra ela**: puxar reembolso de quem não
pediu, à meia-noite, não é atendimento.

**Não fechei**, e o motivo é o placar: o título fala em **57** alunos, e o
próprio cabeçalho do `garantia.ts` mede que só **3** vinham do defeito
corrigido — os outros **54** dependem da decisão de política (renovação reabre
garantia?) que está **parada com o Johnny**. O defeito de código está curado; a
decisão de dinheiro não.

## 7. Aviso a aluno — o que eu NÃO fiz, e por quê

9 alunos apanharam hoje. Parte já foi avisada em rondas anteriores
(`clayton` 21:26Z, `pcezardireito` 15:28Z, conferido por `--enviados`). Os
demais **não** foram avisados de que voltou.

Escrever pros 9 é perto de **e-mail em massa**, que precisa do "pode" do
Johnny. Perguntei no grupo e **não mandei**. Registro do lado incômodo da
decisão: se o Johnny não responder, esses alunos só vão descobrir que voltou
tentando de novo — e alguns pararam de tentar. `bilaherrmann` é a exceção que
se resolveu sozinha: a geração que provou o fix **foi dela**, então ela já tem
o vídeo na mão.

## 8. Próxima ronda começa por aqui

1. **`gh pr list` primeiro.** Oitava seguida em que paga.
2. **O Vídeo Clone continua de pé?** Régua: geração `ready` no dia. Se voltar a
   falhar, o primeiro lugar a olhar é **se houve rebuild** — foi rebuild sem
   pin que derrubou hoje.
3. **Dívida aberta, vale PR próprio:** `accelerate`, `diffusers` e `peft` estão
   no `requirements.txt` do WanVideoWrapper com `>=` e **sem teto** — a mesma
   exposição exata que sangrou hoje. O `#192` tapou só o buraco do
   `transformers`. **A classe continua aberta e é a próxima a estourar.**
4. **O Johnny respondeu sobre avisar os 9 alunos?** Se sim, mandar. Se não,
   perguntar de novo — não deixar morrer.
5. **`#265`: os 54 alunos seguem no vão** esperando decisão de política. Não é
   bug, é dinheiro parado com o Johnny.
6. **Ninguém precisa mais investigar Demucs, `TORCH_HOME`, pré-cache de volume
   nem pedir pod** — respondido e provado em 22h/23h. Não refazer.
7. **Ao contar vítima de qualquer classe, conte pelo LEDGER, não pela tabela do
   produto.** Aluno apaga o histórico e o placar encolhe sozinho. Aprendido
   hoje, do jeito ruim.
8. Continuam parados com o Johnny: migration 82 (`#15`),
   renovação-reabre-garantia (`#265`), proposta do Jackson (`#254`).

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início e no fim.
Fila lida pela varredura, não pela caixa do `suporte@` (ordem de 19/08) — a
única leitura da caixa foi `--enviados`, pra não duplicar aviso. Estorno em dia
(10 tipos, 2.852 linhas, nenhum tipo desconhecido). 14 gravações via
`anotar_incidente.cjs`, **todas conferidas na releitura em 1 linha afetada**.
Nada da planilha foi lido, escrito ou reprocessado (ordem de 29/08). Não
mergeei PR, não apliquei migration, não mexi em crédito, não estornei e não
escrevi pra aluno. **Gastei GPU uma vez**, na fumaça do `480p-v3` (~R$0,17,
conta da casa, nenhum aluno debitado) — justificado no item 3. Avisos no grupo
pelo `notify-grupo.sh` (ordem de 31/08), incluindo a **correção** do número
errado que eu mesmo tinha mandado; nada no privado do Johnny. Só este log vai
direto na main.
