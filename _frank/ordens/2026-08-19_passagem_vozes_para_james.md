# Passagem do caso das vozes — o que eu apurei e onde eu parei

O Johnny passou a questão das vozes pro James porque eu não resolvi. É verdade.
Este arquivo é pra ele não refazer o caminho que eu já fiz. Tudo aqui é medido,
não é impressão.

---

## O que eu fiz, e por que não é a solução

Subiu hoje (PR #8, merge 17:06) um portão de qualidade: antes de entregar, o
sistema transcreve o áudio e compara com o texto pedido. Se faltar mais de 15%,
**o job falha, não sobe arquivo e o crédito volta**.

Isso ataca a **consequência** — parar de cobrar por áudio cortado. Não ataca a
**causa** — por que o modelo corta.

## O número que muda a leitura do problema

| dia | gerações | falharam | por qa_coverage |
|---|---|---|---|
| 13/08 | 100 | 0 | 0 |
| 14/08 | 160 | 0 | 0 |
| 15/08 | 115 | 0 | 0 |
| 16/08 | 72 | 0 | 0 |
| 17/08 | 104 | 0 | 0 |
| 18/08 | 131 | 2 | 0 |
| **19/08** | **69** | **5** | **5** |

Parece que hoje quebrou. **Não quebrou.** As 5 falhas são todas depois das
18:11, que é quando o portão entrou. Antes disso o corte acontecia igual — só
que saía marcado como `ready` e era cobrado.

**A pergunta que importa não é "por que falhou hoje", é "quantos dos 551 áudios
de 13 a 17/08 saíram cortados e ninguém viu".** Isso é mensurável: transcrever
e comparar com `text_raw`. Eu não fiz. É por aí que eu começaria.

## As falhas de hoje, cruas

```
18:20 | 1159 chars | qa_coverage
18:15 | 1164 chars | qa_coverage
18:14 |  464 chars | qa_coverage
18:13 | 1164 chars | qa_coverage
18:11 |  464 chars | RunPod FAILED: qa_coverage
```

Dois alunos: **paulogmarinho@gmail.com** e **pestanatiago2008@gmail.com**.
São dois textos só, tentados várias vezes — não são cinco casos diferentes.
Os dois estão **travados agora**: não conseguem gerar.

Textos de 464 e 1164 caracteres. Não é caso extremo de tamanho.

## O que continua sem explicação

**Por que o modelo corta.** O portão regenera e desiste depois de N tentativas.
Se ele corta de novo na regeneração, o problema é determinístico naquele texto —
não é sorte. Vale olhar o que esses dois textos têm (pontuação, número, sigla,
quebra de linha) que os 551 anteriores não tinham.

**O limite pode estar errado.** `TTS_COVERAGE_QA_MIN=0.85` foi escolha minha,
sem medição. Se a transcrição do Whisper erra 15% sozinha em português, o portão
reprova áudio bom. Ninguém mediu a taxa de erro do próprio verificador.

**O incidente de timeout (`d3d8d1b2`) é outro bicho** — 20 dias, 13 ocorrências,
12 alunos, e voltou dia 18/08 depois de ter nota dizendo que estava resolvido.
Não misturar com o qa_coverage.

## Dívida com aluna, e é a parte urgente

**Kátia Salvador** (katiasalvador32@gmail.com), acesso vence **22/08**.
Prometemos por escrito refazer o áudio dela por conta da casa. Ela aceitou
**duas vezes** (18/08, 18:16 e 18:18). **Ninguém gerou.** A última geração dela
é de 18/08 18:20.

Ela não é caso técnico, é caso de palavra dada.

## Erro meu que atrapalhou a leitura de todo mundo

Minha rotina de vigia só contava incidente com assinatura `fast-email:%`.
Reportou "0 incidentes abertos" enquanto havia 4 abertos de outros tipos.
Já corrigido — passa a contar todos, sem filtro. Mas quem leu meu relatório
hoje leu um número falso, e isso vale pra qualquer conclusão tirada dele.

## Onde estão as coisas

- QA por chunk: `runpod-worker/handler.py`, função `_chunk_coverage`
- Regra de negócio (não entrega, não cobra): `handleTechFailure` / `generation_refund`
- Conta de aluno: `node _frank/ferramentas/aluno.cjs <email>`
- Caixa do suporte, leitura pura: `node _frank/ferramentas/ler_caixa.cjs`
