# Ronda das falhas — 23/09, ~17hZ (Frank, dono da fila)

Serial da vez: **#52 `37bacb68`** (34d, 22 alunos) — o mais antigo com aluno
afetado que **não** está parado em decisão do Johnny.

Nada gasto: sem GPU, sem crédito movido, sem migration, sem merge, sem e-mail
em massa. As duas escritas da ronda foram uma nota de incidente e dois arquivos
de ferramenta.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável dentro da janela. 1106 lidas = 1029 já tinham linha + 77 fora da janela. Fecha a contagem. |
| `enviados_x_tabela` (irmão de leitura, independente) | **0** carta depois do corte fora da tabela. Veredito: buraco **passivo**. |
| `percepcao_travada.cjs` | **0** cards travados em percepção. Controle positivo (#310) e negativo (#518) OK. |
| `idade_dos_abertos` | **107** abertos · **60** com 7d+ |
| `esperando_johnny` | **17** parados no Johnny (era 15 — ver §3) · mais velho **55d** · **54** alunos atrás da fila |

As 77 cartas anteriores a 14/09 14:06:31Z seguem sem decisão, como a ordem
prevê. Não mexi.

---

## 2. Serial: `37bacb68` — respondido o "não sei por quê" de 13hZ, e o alvo do cartão muda

A ronda das 13hZ refutou "lista longa" e apontou um substituto que parecia
muito melhor — `coverage_idioma_prob`, dose-resposta monótona 43,1% → 3,9% —
declarando um limite: *"o campo só existe em 281 das 1.791 (15,7%). **Não sei
por quê** só nessas."* Essa pergunta decide se dá pra construir portão em cima
do campo. Fui ver.

Instrumento novo, só leitura: `_frank/ferramentas/2026-09-23_idioma_e_colisor.cjs`
(controle positivo que **aborta**: tem que reproduzir os números de 13hZ, senão
é a minha varredura que está quebrada).

### O campo é etiqueta, não termômetro

`tts_qa/loop.py:726-733` roda a 2ª opinião de idioma sob guarda
`best_coverage < coverage_qa_min`, e o comentário do próprio código diz: *"Roda
SÓ no caminho de reprovação"*.

Medido na base, e o número é limpo:

```
a sonda RODOU     n= 282 · com marcador de reprovacao: 282 (100,0%)
a sonda NAO rodou n=1251 · com marcador de reprovacao: 645 ( 51,6%)
rodou SEM nenhum marcador de reprovacao: 0
```

Zero exceções. Logo a dose-resposta de 13hZ é **efeito de seleção (colisor)**:
foi medida inteira **dentro** do subconjunto que já havia falhado. Com o grupo
que faltava ao lado:

```
sonda RODOU (ja tinha reprovado)  n= 282 · taxa media 6,4% · 29,1% com alguma
sonda NAO rodou                   n=1251 · taxa media 0,6% ·  4,5% com alguma
```

O campo não antecipa o defeito — ele **marca quem já falhou**.

### Consequência: não construir portão nesse campo

Seria redundante com a própria reprovação que o faz existir, e **cego por
construção**: das 138 gerações que alucinaram, só 82 (59,4%) têm o campo; da
alucinação grave (≥50%), 10 de 13 (76,9%).

É o **quarto** remédio desta família a cair na medição: chunker (nota 63),
heurística por energia (reprovada 2× na família Katia), lista longa (13hZ) e
agora idioma. Fica escrito pra ninguém gastar a 5ª ronda nele.

### ⚠️ Erro meu, pego pelo controle, e eu quase publiquei

Minha varredura devolveu um resultado espetacular:

```
coverage_flagged > 0  n=856 · 138 (16,1%) com ALGUMA alucinacao
coverage_flagged = 0  n=947 ·   0 ( 0,0%) com ALGUMA alucinacao
```

Recall de 100%, sinal presente em 100% das linhas. Eu ia reportar como *"o
portão construível já existe"*.

**Não é achado. É tautologia.** `coverage_qa_min = 0,85` e
`qa_alucinacao_min = 0,3` (`tts_settings.py:252` e `:297`) são dois limiares
sobre a **mesma** variável `coverage`, e o segundo é mais rigoroso: `coverage <
0,3` implica `coverage < 0,85` por aritmética. "Alucinado" é subconjunto de
"flagged" **por construção** (`loop.py:560-567`). Um zero perfeito que
concordava comigo.

Quarta da família (base64 18/09; bloco-sem-`voice_id` 13hZ; grep-sem-controle
13hZ; esta). E a primeira em que o resultado era bonito o bastante pra virar
decisão de engenharia.

> **Régua:** quando o número vier **perfeito** (100% ou 0%), o primeiro
> suspeito não é a natureza — é o seu próprio denominador. Pergunte se as duas
> variáveis não são a mesma variável medida duas vezes.

### O que sobra, e redireciona o cartão

Tirada a tautologia, sobra um fato que vale: a grandeza que um portão precisa —
a `coverage` por chunk — **já é calculada em todo chunk de toda geração**
(`loop.py:536`), diferente do campo de idioma. O que falta **não é telemetria
nova nem detector novo**. É **política**: o que fazer quando
`coverage < alucinacao_min`.

E essa decisão é exatamente a que está parada no Johnny no **`702cc916`** há 21
dias (opções a/b/c). Depois de 4 remédios técnicos refutados, a leitura honesta
é: **o gargalo do `37bacb68` não é medição, é decisão.**

Reconferido com instrumento independente: **13** gerações com ≥50% de
alucinação, **9 entregues** (`status=ready`), incluindo quatro a 100%
(`a4357fc8`, `3003bfda`, `2d32ec10`, `f88b149f`) e uma a 93,3% (`da929169`).
Nota de método pra quem desenhar o portão: **5 das 9 têm
`exhausted_score_max = 0`** — o laço nem esgotou, o áudio alucinou e saiu pela
porta normal. Ancorar o portão em `exhausted` pegaria só 12,9% do alvo.

**Continua `open`.** Não consertei a causa; marcar `fixed` violaria a regra 14.

---

## 3. Defeito no instrumento da fila de decisão: o cartão que mais pesa estava invisível

Ao montar o lote, `702cc916` não aparecia em bucket nenhum do
`esperando_johnny`. Testei as marcas contra a nota dele:

```
702cc916 · MARCAS QUE CASAM: >>> NENHUMA — INVISIVEL PRO DETECTOR <<<
           a nota MENCIONA o Johnny? SIM
```

A nota diz *"a decisão (a)manter/(b)falhar sem cobrar/(c)entregar avisando **é
do Johnny**"*. A marca antiga exigia `decisao ... do johnny` **coladas**, e as
opções a/b/c entram no meio. Era o **"QUEM ANOTA, ESCONDE"** que o próprio
cabeçalho do script documenta, acontecendo no cartão que mais pesa — o mesmo
que trava a decisão do `37bacb68` (22 alunos).

**Corrigido, com medição antes de aplicar.** A marca passou a tolerar até 160
chars entre as palavras, sem atravessar ponto final nem quebra de linha. Efeito
na fila inteira (142 cartões): **ganho de 5, e os 5 lidos à mão, um a um** —
`702cc916`, `1a37605a` ("DECISAO COMERCIAL, que e do Johnny"), `719c9af6`
("decisao de produto/preco/estorno e do Johnny", **9 alunos**), `555a1cee` e
`f8a71e43`. **Cinco verdadeiros, zero ruído.** O alargamento não infla a
classe; só para de esconder.

`702cc916` entrou na lista de **controle positivo** (o piso subiu, com o motivo
escrito e datado, como a regra do script exige).

Resultado: **15 → 17** parados no Johnny, 52 → **54** alunos, controle 5/5.

> Declaro também que a minha própria nota no `37bacb68` fez o cartão entrar em
> "NÃO TRIADOS" — porque ela cita a decisão parada. É verdadeiro positivo: o
> cartão **está** bloqueado nessa decisão.

---

## 4. O LOTE — 17 decisões paradas no Johnny (a doutrina pede lote, não gota)

Mandado ao grupo nesta ronda. A doutrina de 17/09 aplicada a decisão diz que o
desfecho **não** é re-escalar um caso por ronda — é juntar e levar de uma vez.

**Merges prontos (3):** `d3d8d1b2` PR #404 (55d, 19 alunos — casa limpo na main,
suíte verde) · `58b376ea` PR #355 · `827fa746` PR #42 (aberto desde 24/08).

**Política de entrega (1, e destrava o `37bacb68`):** `702cc916` — manter /
falhar sem cobrar / entregar avisando.

**Dinheiro de aluno (10):** `7ed72ad0` 7.455cr · `52b22304` 9-A · `5c68eb33`
R$97 · `ab5644be` 84.720cr · `09a26f8b` CDC art.49 · `b633b18c` 157.875cr (16
alunos) · `176f987f` 762.695cr (12 alunos) · `4ec88113` · `22cda8b7`
R$1.109,64 · `75c33ee1` 1.010.200cr (183 alunos).

**Operacional (3):** `8b8fc4c8` mão no painel Hotmart · `bb4d4cd0` autorizar
retentativa (GPU) · `1a37605a` destravar acesso.

---

## 5. Fim de ronda

- Log commitado na **main** (regra 25-B).
- Nenhum fix preso em branch de feature: nada de código de produção foi tocado
  nesta ronda.
- Escritas: nota no `37bacb68`; `2026-09-23_idioma_e_colisor.cjs` (novo);
  `2026-09-22_esperando_johnny.cjs` (marca + controle).
