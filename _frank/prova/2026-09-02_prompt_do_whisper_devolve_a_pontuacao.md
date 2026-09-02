# 02/09 — o "nenhuma candidata" da voz 1d332ef0 era falta de PONTUAÇÃO, não falta de trecho

## O que estava errado

`_frank/ferramentas/fabricar_referencia.cjs` chamava o whisper-1 **sem o
parâmetro `prompt`**. Na gravação de 3597s da voz `1d332ef0` (Robert Ros) o
whisper devolveu o texto praticamente **sem pontuação**: 10 fins de frase em
4.866 palavras, uma marca a cada ~487 palavras.

`candidatas()` exige uma janela de 18-30s que **comece em início de frase e
termine em fim de frase** (`. ! ?`). Com marcas tão raras, quase nenhuma janela
cai entre duas — resultado: **0 candidatas**, e a ferramenta abortava com
`FALHOU: nenhuma candidata`. O operador lê isso como "esta voz não tem trecho
aproveitável". É **falso impossível**: a voz tem 60 minutos de fala boa.

**Não confundir com o bug da Katia (#233, PR #151, merge ff06195).** Lá a
pontuação EXISTIA e caía no meio do segmento do whisper (173 fins, só 12 em fim
de segmento); a cura foi carimbar o fim na PALAVRA em `marcarFimDeFrase()`.
Essa correção já está aplicada e mesmo assim dava 0 aqui, porque **neste caso a
pontuação não existia no texto**. Raiz diferente, conserto diferente.

## O conserto

Passar um `prompt` curto em pt-BR, bem pontuado, na chamada do whisper. O
`prompt` entra como "texto anterior" e enviesa o estilo da saída, inclusive a
pontuação. Continua sendo o whisper quem marca fim de frase — **não é
heurística de energia nem de pausa entre palavras**, as duas proibidas pela
ordem de 20/08 (pausa não é fim de frase; começar o clipe no meio da oração é
exatamente o defeito da Kessuly que esta ferramenta existe pra evitar).

Junto: o **cache passou a ser chaveado pelo prompt**
(`raw.whisper.json` = cru, `raw.whisper.prompt.json` = com prompt). Transcrição
com e sem prompt são saídas diferentes e não podem dividir o mesmo arquivo —
era o que ia esconder esta medição. A transcrição crua antiga fica preservada,
que é o que permitiu o antes×depois abaixo sem re-transcrever nada.

## Medição — antes × depois

Ferramenta nova `_frank/ferramentas/medir_pontuacao.cjs`, que reaproveita por
`require` as funções da própria `fabricar_referencia.cjs` (mesmo algoritmo, sem
cópia que possa divergir). Não toca em banco, R2, GPU nem em referência de
aluno.

```
=== 1d332ef0 · bruto 3597s · 4877 palavras            (A VOZ QUEBRADA)
  ANTES (cru)      fins de frase   10 (1 a cada 488 palavras ·   9 em fim de segmento) · CANDIDATAS    0 · alinhamento 99.7%
  DEPOIS (prompt)  fins de frase  187 (1 a cada  40 palavras · 185 em fim de segmento) · CANDIDATAS   55 · alinhamento 99.7%
  → candidatas 0 ↑ 55 · fins 10 → 187

=== c127b74e · bruto 2979s · 6517 palavras            (CONTROLE — Katia)
  ANTES (cru)      fins de frase  173 (1 a cada  38 palavras ·  12 em fim de segmento) · CANDIDATAS   95 · alinhamento 99.9%
  DEPOIS (prompt)  fins de frase  175 (1 a cada  38 palavras ·  12 em fim de segmento) · CANDIDATAS  115 · alinhamento 99.9%
  → candidatas 95 ↑ 115 · fins 173 → 175

=== 04539483 · bruto 306s · 668 palavras              (CONTROLE — Carol)
  ANTES (cru)      fins de frase   60 (1 a cada  11 palavras ·  61 em fim de segmento) · CANDIDATAS  113 · alinhamento 99.7%
  DEPOIS (prompt)  fins de frase   66 (1 a cada  10 palavras ·  66 em fim de segmento) · CANDIDATAS  125 · alinhamento 99.7%
  → candidatas 113 ↑ 125 · fins 60 → 66
```

Os dois controles bateram exatamente os números de produção no "antes"
(95 e 113), o que valida o instrumento. **Nenhum dos dois regrediu** — os dois
subiram.

## A candidata escolhida é frase de verdade (não pontuação inventada)

Contar candidatas não bastaria: o prompt poderia estar alucinando ponto no
lugar errado, o que traria de volta o defeito do clipe começando no meio da
oração. Rodei a ferramenta de verdade em **simulação** (sem `--confirmar`) nas
três vozes; o guarda interno que transcreve o CLIPE e confere as bordas contra
a janela escolhida **passou nas três**.

`1d332ef0`, escolhida #1 — 834.1s→858.1s (24.0s), -23.2 LUFS, pico -1.7:

> "E qual que é a ideia? A ideia foi criar uma forma de envolver pessoas cristãs
> da igreja internacional. Não seria um trabalho de uma igreja local, mas sim
> membros da igreja ao redor do mundo."

Começa em início de frase, termina em ponto, sem aviso de cauda cortada.

Nos dois controles a **janela escolhida não mudou** com o prompt
(Katia 1017.5s→1042.6s, Carol 231.7s→254.4s, idênticas antes e depois) — o
prompt aumentou o leque de candidatas sem mexer no que a ferramenta já
escolhia. Conferi ainda que o início da candidata da Carol cai logo depois de
"Quem tinha mandado tudo assim?", ou seja, fronteira de frase real.

## Benefício secundário medido: a passada longa parou de engolir texto

O comentário nas linhas 189-197 do arquivo documenta que na gravação longa o
whisper ENGOLE trecho, e por isso o transcript é tirado do clipe, nunca da
passada longa. Com o prompt esse buraco encolheu muito na mesma janela da Katia:

| passada longa (cru) | passada longa (com prompt) | clipe (verdade) |
|---|---|---|
| 49 palavras | 68 palavras | 69 palavras |

A regra de tirar o transcript do clipe continua valendo — mas a passada longa
ficou bem mais confiável pra ESCOLHER o corte.

## O que isto NÃO resolve

A queixa do aluno da voz `1d332ef0` é **timbre**. Não há ligação provada entre
curar a referência e consertar o timbre. Isto é **conserto de ferramenta**, não
fechamento do chamado. A ferramenta que antes dizia "impossível" agora entrega
55 candidatas — se o timbre melhora ao aplicar uma delas, é outra medição, que
não foi feita aqui.

## Disciplina desta execução

- Rodado **só em simulação**, nunca com `--confirmar`.
- Nenhuma referência de aluno alterada, nenhum crédito tocado, nenhuma GPU usada.
- Custo: transcrição whisper-1 das 3 gravações (~114 min de áudio).
- Os caches de transcrição vivem em `frontend/_Bugs/`, que é gitignored — não
  entram no PR.
