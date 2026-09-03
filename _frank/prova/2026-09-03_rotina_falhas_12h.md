# Rotina das falhas — 03/09/2026, ~11h–12hZ

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, canal de 31/08 (tudo do
FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha desativada) e
`2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | 6 | 6 |
| aguardando aluno | 10 | 10 |
| **patches do Vigia parados** | **3** | **0** |

**0 incidentes fechados. 0 alunos escritos.** O que saiu do zero foi a fila de patches — e ela
saiu porque os 3 já estavam consertados, não porque eu consertei alguma coisa. Digo abaixo em
que passo cada item parou.

---

## §1 — Serial: peguei o `#47` (Katia), como a ronda anterior deixou marcado

Mais antigo com aluno esperando (aberto 19/08). Sem exceção invocada desta vez: nada de produção
fora do ar nem dinheiro sendo cobrado errado agora.

**A primeira coisa que fiz foi conferir se a aluna estava no escuro. Não estava.** Enviados do
`suporte@` para `katiasalvador32@gmail.com`: o `uid 458` (02/09 16:02Z) é a "resposta final"
**errada**, que dizia não haver corte; o `uid 461` (02/09 17:44Z) é a **retratação**, e ela é
honesta — diz com todas as letras que a aluna estava certa, que o defeito é nosso, que não é a
voz nem o texto dela, que a mesma assinatura aparece em centenas de outras vozes desde julho, e
que não damos data. O áudio dela foi refeito por conta da casa.

**Conclusão que muda o trabalho:** aqui não falta comunicação, falta conserto de produto. O
`#47` só pode fechar quando o `#234` fechar. Fechar antes seria o fechamento falso que este
mesmo chamado já sofreu uma vez (16:03Z de 02/09, retratado 24 minutos depois).

## §2 — Fui aplicar o patch que destrava o `#234` e ele estava morto

O passo que destrava o `#234` era o `patch_f8587cef`, escrito pelo Vigia às 00:13Z e listado como
pendência **crescente** há 3 rondas. Extraí, criei a branch, e o `git am` recusou nos **4**
arquivos. Com `-3` deu conflito nos 4.

Motivo: **o mesmo conserto já estava na main**, pelo commit `7c2dee5` (PR #162, 02/09 19:54) —
outro caminho, outros nomes (`tail_interno_entregue` / `_entregue_n` / `_entregue_sem_veredito`
no lugar de `_entrega_checked` / `_flagged` / `_none`), mesmo desenho: `run_chunk_qa` devolve o
veredito da tentativa **vencedora** como 4º valor do return e o **chamador** promove nos 3 pontos
de entrega, espelhando o `registrar_cobertura`.

**Conferi lendo o código da main** (`loop.py:161-219`, `inference.py:411/469/506`), não a mensagem
de commit.

### Os outros dois também estavam mortos

Se um estava, fui conferir os três:

| patch | escrito em | assunto | já estava na main como | em produção desde |
|---|---|---|---|---|
| `patch_f8587cef` (#234) | 03/09 00:13Z | métrica de ENTREGA da fronteira interna | `7c2dee5` (PR #162) | **03/09 04:01Z** (7 gerações) |
| `patch_687890f5` (#233) | 02/09 12:11Z | fim de frase na PALAVRA em `fabricar_referencia.cjs` | `marcarFimDeFrase()` (PR #151, `ff06195`) | main (ferramenta local) |
| `patch_702cc916` (#226) | 02/09 00:10Z | persistir `best_score` do chunk esgotado | `d11394c` (01/09) | **02/09 02:32Z** (63 gerações) |

O caso do `702cc916` é o mais didático: o Vigia escreveu o patch **~26h depois** do fix já estar
mergeado. Ele mora num clone velho e não tem como saber — o defeito não é dele.

Os 3 apagados com `DELETE` de verdade (3 linhas, releitura **vazia**). Conteúdo preservado em
`_Bugs/patches_vigia/*.patch`. **Aplicar qualquer um deles agora duplicaria contador.**

## §3 — Por que a fila nunca drenou: a ferramenta que fecha nunca fechou nada

`aplicar_patch_vigia.cjs --apagar` fazia `update({ value: null })` numa coluna **NOT NULL**. O
Postgres devolvia `23502` e a chave ficava no banco. **`--apagar` nunca apagou nada desde que
existe** — as 3 chaves recusaram as 3, na minha frente.

Este é o mesmo defeito que já tinha mordido em **29/08** nas chaves `para_frank_orfa_*`, curado
**na mão** com `DELETE`, sem voltar pra ferramenta. Segunda vez.

**Fix em produção — PR #166, merge `5967449` na main.** `DELETE` de verdade + `.select()`
conferindo que afetou **1 linha**, porque `DELETE` por chave inexistente afeta **0 linhas em
silêncio** e imprimir "apagada" em cima de 0 linhas é o mesmo fechamento falso que estas rondas
vêm desfazendo.

Testado ponta a ponta contra o banco: chave criada → `--apagar` imprime `1 linha` → releitura
volta vazia; segunda chamada na mesma chave **recusa** em vez de dizer que apagou.

## §4 — O `#234` deu o primeiro número honesto da vida dele

A métrica de entrega está **em produção desde 03/09 04:01:14Z** — conferido no **banco** (7
gerações `ready` com `qa->>'tail_interno_entregue_n'`), não no git.

**A checagem de sanidade que o próprio Vigia pediu passou, e ela é forte:** nas 2 gerações com
`regens=0` (`11b691e0`, `95ce49d1`) o contador de TENTATIVA e o de ENTREGA batem exatamente
(7=7 e 3=3). Sem tomada descartada as duas réguas têm que coincidir — e coincidem.

**E a divergência aparece onde tinha que aparecer:** a `a8caaae1` tem `regens=26`,
`tail_interno_checked=45` mas `entregue_n=21` (inflação de 2,1×). Melhor ainda:
`tent_flagged=1` e **`entregue_flagged=0`** — a única fronteira reprovada dela estava numa tomada
**jogada fora**. Pela régua velha essa geração entrava na conta como defeituosa; **o áudio que a
pessoa recebeu está limpo.** Era exatamente isto que não dava pra separar há 3 rondas.

**Os números crus** (7 gerações, 04:01Z–11:29Z):

| régua | denominador | reprovadas | taxa |
|---|---|---|---|
| **ENTREGA** | 72 fronteiras com veredito | 12 | **16,7%** |
| TENTATIVA | 110 checagens | 18 | 16,4% |

⚠️ **O agregado das duas quase coincide, e isso NÃO significa "tanto faz qual régua usar".** É
coincidência desta amostra: por geração elas divergem muito (a `a8caaae1`: 2,2% tentativa contra
0% entrega). Quem citar o agregado pra dizer que a métrica velha servia vai estar errado.

## §5 — Ressalvas honestas

- **n=7 gerações, janela de 7h30.** O 16,7% não autoriza decisão nenhuma.
- A régua externa histórica (`cauda_decepada.cjs`, 14.921 fronteiras) dá **9,08%**. As duas não
  são a mesma régua: a externa só enxerga fronteira que virou silêncio digital ≥120ms no mp3
  final, e subconta. Anoto uma **hipótese, marcada como hipótese**: 16,7% × a precisão ~57%
  medida em 02/09 19:47Z dá ~9,5%, que cai em cima dos 9,08%. **Com n=7 eu não afirmo isso** —
  anoto o que testar.
- **6 fronteiras "entregues sem veredito"** (8% do denominador) não estão explicadas. Não
  investiguei. Enquanto não souber, o denominador honesto é **72**, não 78.
- **Não ouvi áudio nenhum. Não afirmo nada sobre som nesta ronda.** Não reproduzi o worker em
  runtime; li o banco.
- Não confirmei nada sobre a caixa do `suporte@` além dos Enviados da Katia.

## §6 — O que NÃO toquei, de propósito

- **Não virei a chave `TTS_TAIL_QA_INTERNO_MODO`.** Mudou o instrumento, não a precisão: com
  ~57%, `reprovando` ainda força regen em geração boa — e o custo está visível nesta própria
  janela (a `a8caaae1` gastou 26 regens).
- **Não refiz áudio de ninguém** (gasta GPU; a regra é não gastar sem o aluno pedir).
- **Não escrevi pra Katia hoje.** O `uid 461` é de anteontem, já diz tudo e já promete aviso
  quando resolver. Aviso repetido sobre o que ela já sabe é ruído.
- **Não decidi o cancelamento do Vinícius** (`#240`, R$ 2.697,60). É dinheiro saindo: é do
  Johnny. Postei no grupo como **urgente**, com os 3 IDs Hotmart e a data que vence.
- **Não mandei o e-mail em lote aos 13 pagantes sem acesso** (`#222`) — segue sem o "pode".
- Não mexi em crédito, acesso, voz nem migration (102 segue não aplicada, **10ª ronda**).
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- **Não li a caixa do `suporte@` pra triagem** — só `--enviados --para` da aluna que eu estava
  tratando.

## §7 — Grupo (regra 7)

Duas linhas, as duas fato consumado:
1. **Urgente:** `#240` Vinícius, R$ 2.697,60, 3 IDs Hotmart, janela do CDC vence 05-06/09,
   decisão é do Johnny.
2. **Fix em produção:** PR #166 + os 3 patches obsoletos, fila de patches em zero.

Não postei a medição do `#234`: é progresso parcial, não fato consumado. Vai no relatório noturno.

## Pendências que atravessam rondas

| item | estado |
|---|---|
| **`#240` Vinícius — R$ 2.697,60, janela do CDC vence 05-06/09** | **6ª ronda, agora com data que expira** |
| **"Pode" do Johnny p/ e-mail em lote aos 13 pagantes sem acesso (`#222`)** | 2ª ronda, 13 pessoas pagando sem entrar |
| **Causa raiz do `#222`**: resgate casa só por e-mail — 6ª volta da classe, nunca virou conserto | aberta |
| `#234`/`#47`: instrumento pronto, **falta amostra** (24-48h) pra decidir a chave | destravou o instrumento, não a decisão |
| Decisão comercial: compra de CURSO dá crédito? (`#202`/`#173`/Cristina/Robert) | 6ª ronda |
| Decisão de produto do `#226` (QA esgota: falhar sem cobrar ou entregar avisando?) | 7ª ronda |
| ~~3 patches do Vigia parados~~ | ✅ **zerada** (eram 3 obsoletos + ferramenta quebrada) |
| 16 recados `para_frank_*` na fila, o mais velho de 29/08 | **não mexi nesta ronda** |
| PRs #41/#42 (teto de 2MB) | 15º dia |
| Migration 102 (`#232`) sem aplicar | **10ª ronda** |
| `aluno.cjs` "compras: NENHUMA" lido como verdade de pagamento | aberta desde 03/09 01h |

## §8 — A lição, pra não repetir

**Pendência que só é contada, nunca conferida, vira dívida imaginária.** Os 3 patches foram
listados como débito crescente em 3 relatórios seguidos sem ninguém abrir nenhum. Custou zero
descobrir que estavam mortos: bastou tentar aplicar o primeiro.

E a causa de fundo é pior que os patches: **a ferramenta que deveria fechar a fila nunca fechou
nada, e falhava em silêncio para quem só olhava a lista.** Quando um erro de gravação é engolido,
o sintoma que aparece é uma fila que não anda — e a leitura natural ("temos débito técnico") é
exatamente a errada.
