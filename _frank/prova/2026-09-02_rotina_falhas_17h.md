# Rotina das falhas — 02/09/2026, ~14:46Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, a ordem de
canal de 31/08 (tudo do FastCloner vai no GRUPO), `2026-08-29_desligar_vigia_e_frank.md`
(planilha desativada) e `2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8,
21/08).

## Placar, sem maquiagem

| | entrada | saída |
|---|---|---|
| não-fechados | **20** (8 `investigating` + 12 `aguardando_aluno`) | **19** (7 + 12) |

**Eu fechei ZERO incidentes nesta ronda.** A queda de 20 para 19 **não é minha**: o
**`#173`** foi para `fixed` às **14:46:00Z**, no meio da minha ronda, por outra mão —
`resolution_note` = *"respondido por email"*. Registro porque um placar que cai sozinho
vira crédito indevido de quem estava na sala na hora.

⚠️ **Para a próxima ronda conferir, não para agir agora:** o `#173` vinha descrito nas
rondas de 01/09 como travado em **decisão comercial**, e uma nota de fechamento de quatro
palavras não mostra que essa decisão foi tomada. Não reabri e **não afirmo que está errado**
— não medi. Fica a pendência de olhar.

## O caso que peguei: `#192` / `ae0061d5` (Robert Ros) — o mais antigo ABERTO com aluno afetado

Não fechei, e explico em que passo emperrou. O chamado tem duas metades:

- **texto reescrito** — já fechada e **provada em produção** (guarda do mandato, merge
  `01d9cb7`; A/B no roteiro do próprio aluno em 01/09).
- **timbre** — a queixa original dele. Continua **sem causa medida**.

### O que eu medi hoje, e por que muda a leitura do lado técnico

Rodei `fabricar_referencia.cjs` na voz dele **em simulação** (sem `--confirmar`: não alterei
referência, não gastei GPU, não toquei em crédito):

```
voz 1d332ef0 · bruto 3597s (~60min)
alinhamento texto↔palavra: 4850/4866 (99,7%)
fins de frase: 10        (só 9 caem em fim de segmento)
candidatas (18–30s, pausa<=1,2s): 0   →   FALHOU: nenhuma candidata
```

**Não é o bug que fechei hoje de manhã.** O caso Katia (`#233`, PR #151, merge `ff06195`)
era pontuação que **existia** mas caía no MEIO do segmento do whisper — 173 fins, só 12 em
fim de segmento — e carimbar o fim na **palavra** levou de 0 para 95 candidatas. Essa
correção **já está aplicada na medição acima** e mesmo assim dá 0. Aqui a pontuação
**não existe no texto**: 10 marcas terminais em 4.866 palavras, uma a cada ~487. Na Katia
era uma a cada ~38. Raiz diferente, mesma mensagem de erro.

**Separando o que medi do que infiro:**
- **MEDIDO:** o transcript da gravação dele volta praticamente sem pontuação terminal.
- **INFERIDO, não provado:** 10 frases em uma hora de fala não é estrutura real de fala
  humana, então é artefato de **transcrição** — o whisper não pontuou o áudio dele. Não
  confirmei isso ouvindo.

### A consequência de sistema, que é maior que o Robert

`candidatas()` exige janela que **comece** em início de frase e **termine** em fim de frase.
Com 10 marcas espalhadas por 3597s, quase nenhuma janela de 18–30s cai entre duas. Logo a
ferramenta de cura é **estruturalmente incapaz** de curar qualquer voz cujo transcript volte
sem pontuação — e falha com `"nenhuma candidata"`, que o operador lê como *"esta voz não tem
trecho aproveitável"*. É a **mesma classe de falso impossível** do `#233`, com raiz nova.

**Não medi quantas outras vozes estão nessa situação. Não afirmo alcance.**

### O que eu NÃO fiz, de propósito

1. **Não subi fallback.** A saída óbvia — usar **pausa** entre palavras como fronteira —
   reintroduz o defeito que a ferramenta existe pra evitar: pausa não é fim de frase, e
   começar o clipe no meio da oração é exatamente o caso Kessuly (*"Assim, antes de…"*).
   A ordem de 20/08 reprovou heurística **duas vezes**. Não entra sem A/B provando que não
   regride Katia `c127b74e` (95) nem Carol `04539483` (113).
2. **Não afirmo que curar a referência conserta o timbre.** Não há ligação provada entre as
   duas coisas.
3. **Não escrevi ao aluno nesta passada.** Já escrevemos 3× (uids 346, 362, 406). Não tenho
   fato novo *entregável* pra ele, só causa interna — mandar "achamos mais uma coisa e não
   consertamos" é ruído, não atendimento.

### Encaminhado

Card **`38a530fe`** para o `coder`, com o caminho que quero testado **primeiro**: a chamada
do whisper em `transcrever()` (linha ~47) vai **sem o parâmetro `prompt`**, que é a alavanca
que enviesa pontuação. Consertar a **transcrição** em vez de afrouxar a régua. Critério de
aceite e a proibição da heurística estão escritos no card, junto com o aviso de **apagar o
cache** `raw.whisper.json` antes de re-medir — senão se re-lê a transcrição velha e conclui
que nada mudou.

## O que tem prazo e foi pro grupo NA HORA

**Robert vence amanhã (03/09)** e **não é trial**: `pagou_de_verdade.cjs` mostra
**R$ 684,92** em compras avulsas (R$ 497,00 + R$ 131,87 + R$ 56,05); só a assinatura do
FastCloner é de R$ 0. Estado conferido agora: acesso ATIVO até 03/09, **85.971 créditos**
parados, treino de **−10.000 sem estorno**, última geração 01/09 02:13Z, **nenhuma resposta
dele** (`ler_caixa --de` vazio — vale para os **lidos**; a fila de não-lidos é da Fast).

O agravante é nosso: pedimos a ele **por escrito** (uid 406) que gerasse o mesmo roteiro e
dissesse se melhorou. Se o acesso cair amanhã, ele perde a plataforma **no meio de um teste
que nós pedimos** — e é a resposta dele que destrava a metade aberta do chamado.

Postado no grupo, marcado urgente. **Terceira vez** que isso sobe (as outras duas em 01/09).
**Não estendi acesso, não estornei, não prometi nada a ele** — é decisão comercial do Johnny
e esta é a última janela.

## Registro de rotina

- **`resolved_commit` do `#192`:** o `anotar_incidente` reportou `01d9cb7` e eu **não passei**
  `--commit`. Conferi antes de seguir: linha 163 só grava com a flag, `resolved_at` está
  **nulo** e o status segue `investigating`. É carimbo **pré-existente** e legítimo (o merge
  da guarda do mandato). Nada foi marcado como resolvido indevidamente.
- **`anotar_incidente` recusou o prefixo `192`** (é número, não id) em vez de dar UPDATE em
  0 linhas em silêncio. A trava funcionou; usei `ae0061d5`. Notas: 26 → **27**, nenhuma
  sobrescrita.
- Nada da **planilha** foi lido, escrito, classificado ou reaberto (ordem de 29/08).

## Limites da minha prova, ditos na cara

1. **Não ouvi o áudio do Robert.** O veredito de timbre continua precisando de ouvido humano
   e eu não o dou.
2. **`ler_caixa` só varre os LIDOS.** Se ele respondeu e a mensagem está não-lida, eu não a
   veria. "Não respondeu" vale para os lidos.
3. **Não medi o alcance** do defeito da cura em outras vozes.
