# Rotina das falhas — 01/09/2026, ~15hZ

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`,
`2026-08-29_desligar_vigia_e_frank.md` (planilha fora do meu perímetro),
`2026-08-27_vigia_so_erro_de_sistema.md`. Método serial (regra 8, 21/08).

Placar de entrada: **7 incidentes abertos**, 4 aguardando aluno, 4 itens presos.

## Quem eu peguei, e por que não foi o mais antigo

O mais antigo aberto com aluno afetado é o **#173** (Johnathan, 28/08). Não o
peguei: a metade técnica dele entrou em produção nesta madrugada (merge
`5b8afad`) e o que sobra é **decisão comercial do Johnny**. Não é bug, não tem
playbook, e não é minha para tomar. Passo em que travou registrado lá desde
ontem. Segui para o próximo — **#192** (`ae0061d5`), Robert, 29/08 21:23Z.

## O que eu trouxe de novo no #192

### 1. A guarda do mandato está provada em produção — na geração real do aluno

Até hoje a prova era o teste composto que eu mesmo rodei em 01hZ. Isso é teste
sintético. Agora existe **A/B controlado**: mesmo aluno, mesma voz, mesmo
roteiro, só o código mudou entre os dois.

| | `clica nos dois` | `Escolhe o seu caminho` |
|---|---|---|
| **antes** `b298e5be` 29/08 21:10Z (pré-fix) | → `clique nos dois` ❌ | → `Escolha o seu caminho` ❌ |
| **depois** `362c84e0` 01/09 02:13Z (pós-`01d9cb7`) | → `clica nos dois` ✅ | → `Escolhe o seu caminho` ✅ |

E o normalizador **não foi desligado junto**: nas duas gerações as aspas curvas
de "Música"/"Negócio" caem pelo sanitize, e os dois `clique` que **ele** escreveu
seguem `clique`. A guarda reverteu só o que era troca.

**A prova que eu assino** não é o campo `text_normalized`: é o
`request_params.text`, que é o payload efetivamente mandado ao worker de TTS.
Ele contém as palavras dele. Isso fecha a cadeia que faltava —
*mergeado* → *em produção* → **sendo executado no caminho do aluno**.

Ele gerou às 02:13Z, ~1h depois do e-mail (uid 406) que pedia exatamente esse
teste. **Ele fez o que a gente pediu.**

### 2. Uma hipótese minha, levantada e derrubada na mesma ronda

O `qa` da geração nova traz `rate_flagged=8` de `rate_checked=8`. Parecia
"entregamos áudio fora do ritmo dele 8 vezes". **Não é** — e eu só soube porque
abri `tts_qa/rate.py:135` em vez de acreditar no contador: `rate_flagged` conta a
**primeira** medição do chunk, **antes** do regen e do stretch. É contador de
diagnóstico, não de defeito entregue.

Fui medir se a entrega saiu rápida demais para ele, com **régua comparável** (o
README avisa que são três réguas e não se misturam):

- entregue: **3,762 pal/s** falando (pós-fix) e 3,946 (pré-fix)
- referência dele: mediana **3,2 pal/s**, janelas **[3,2 · 1,58 · 4,18]**

3,762 está **dentro da faixa em que ele mesmo fala**. Com spread de 1,58 a 4,18
numa gravação de 1h, não dá para afirmar "saiu rápido demais". **Hipótese
descartada** — registro o negativo para ninguém gastar ronda com ela de novo.

**Ressalva de instrumento, honesta:** tentei confirmar a troca no *áudio* por
whisper e **não é conclusivo** para esse fim. "clica" aparece só no áudio pós-fix
e some no pré-fix (consistente), mas o whisper devolveu durações degeneradas de
0,04s/0,06s e ouviu "Escolhe" nos **dois** áudios — inclusive naquele cujo texto
mandava "Escolha". Vogal final átona em pt-BR não se resolve por whisper. Por
isso a prova é a do payload, não a do áudio.

### 3. O fato novo que importa, e tem prazo — 03/09

O Robert é o **quarto caso do mesmo buraco comercial** do #173/#202/#212, e o
único com relógio correndo.

- **Pagou R$ 684,92**, tudo em compra **avulsa** (HP0481073441 R$ 56,05 · HP1039359419 R$ 131,87 · HP2183217899 R$ 497,00).
- A assinatura FastCloner dele, HP3446808787, é de **R$ 0**.
- **Acesso vence 2026-09-03** — depois de amanhã — com **85.971 créditos** parados.

O risco é nosso e é concreto: a gente pediu **por escrito** que ele gerasse o
mesmo roteiro e respondesse. Se o acesso cair dia 03 sem decisão, o aluno que
pagou R$ 684,92 **perde a janela de fazer o teste que nós pedimos**, com o
crédito intacto na mão. Hoje `pagante_trancado` dá 0 trancados e 0 na fronteira e
ele não aparece — porque ainda não venceu. Quando vencer, ele cai na cesta
"trial que nunca virou pagamento" e o **nosso próprio detector** vai acusar
pagante trancado, só que depois do estrago.

Não decidi nada disso. Levado ao grupo **com a data**.

### 4. O que continua aberto — e por que não fechei

O **timbre**, que é a primeira queixa dele, não tem causa medida: dataset
íntegro, referência íntegra, treino `completed`, e a hipótese da cauda fantasma
(#191) já foi medida e descartada em 29/08. Falta **ouvido humano** comparando
referência e saída; os 3 áudios estão no grupo desde 30/08 02:03Z, **há 3 dias,
sem veredito**. Eu não ouço, e julgamento de qualidade de voz é humano (regra
9-D). Fechar agora seria marcar `fixed` sem ter resolvido. Segue aberta também a
palavra comida no começo do áudio.

### 5. Por que NÃO escrevi ao aluno

A bola é dele: o e-mail uid 406 (01/09 01hZ, **13h atrás**) pediu que ele
respondesse se melhorou, piorou ou ficou igual. Ele gerou às 02:13 e ainda não
respondeu. **13h não é silêncio**, e cobrar em 13h é o ruído da regra 27.

E **não** vou avisá-lo do vencimento enquanto a decisão não existir: dizer "seu
acesso pode cair dia 03" sem saber o desfecho alarma sem resolver, e se o Johnny
estender eu teria assustado à toa. Havendo decisão, eu escrevo — aí é fato novo.

## Dinheiro

Não toquei em nada. O débito de **-10.000** do treino (29/08 15:17Z) **segue sem
estorno**, conferido pelo caminho certo (`ref_type`, nunca `kind`: varri o
extrato, não existe `voice_train_refund` nem `generation_refund`). Não estou
pedindo estorno — estou dizendo que está de pé e a decisão é do Johnny.

## Escopo, para não inflar o que foi feito

O fix vale para geração **nova**. Os áudios já entregues com palavra trocada aos
**58 alunos em 45 dias** continuam entregues. Remediação do que já saiu **não
existe e não está feita**.

## Armadilha nova para a próxima ronda

`anotar_incidente.cjs` resolve **id/prefixo de uuid**, não o `numero` do board.
`... 192` foi recusado com "nenhum incidente começa com 192" — o certo é
`ae0061d5`. A recusa é o comportamento desejado (melhor recusar que dar UPDATE em
0 linhas em silêncio), mas custa uma tentativa a quem vem do board, onde o caso
se chama #192.

## Estado final

**Nada fechado nesta ronda, de propósito.** O #173 está travado em decisão
comercial; o #192 teve a metade do texto **provada em produção** e a outra metade
depende de ouvido humano. O gargalo da fila **não é técnico** — é uma decisão
comercial que agora tem data: **03/09**.
