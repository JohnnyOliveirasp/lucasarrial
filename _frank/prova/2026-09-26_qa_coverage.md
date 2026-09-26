# Saude do QA de audio (qa_coverage) — ronda de 2026-09-26 15:19Z

TL;DR: **dia limpo.** Zero falhas ontem (149 geracoes) e zero hoje (77). 346
geracoes e 75h sem falha de NENHUM tipo. Mas **nao da pra declarar melhora**:
p=0,098, a serie limpa e compativel com a taxa antiga inalterada. O que precisa
de olho nao e numero, e **Diego Vargas, que perde acesso em 2,86 dias sem nunca
ter recebido o audio que pediu** — e um **gate novo entrando no ar hoje** que vai
criar classe de falha inedita e nao pode ser lido como regressao amanha.

---

## PASSO 1 — Qual regua esta no ar (reconferida no git, nao herdada)

| Build | sha | Terminou | Situacao |
|---|---|---|---|
| Ultimo VERDE (no ar) | `a3a51031` | 2026-09-25T16:25:23Z | **e este que esta rodando** |
| Em andamento | `83d1ad4e` | comecou 14:47:33Z | `in_progress` ha ~32 min |

O run de hoje **nao esta travado**: 32 min esta dentro da faixa normal (28-52
min). Nao houve run vermelho. Nada a escalar no deploy.

### A regua de cobertura NAO mudou — e isso foi verificado, nao assumido
A licao de 25/09 diz que a constante de regua vence em silencio, entao ela foi
reconferida arquivo por arquivo:

```
metrics.py / canon.py / text.py -> ultimo toque e16d990e (18/09),
                                   merged como 94c2a825, deploy 21/09 19:27:52Z
```

O comparador de cobertura **nao e tocado desde 21/09 19:27Z**. Logo
`CORTE_REGUA = 2026-09-21T19:27:52Z` continua valendo — por reconferencia, nao
por heranca.

### O que `a3a51031` mudou (o verde que esta no ar)
`inference.py 16+/9-`: a pausa entre chunks estava inerte com crossfade ligado.
**Mexe no AUDIO, nao no comparador.** Nao e corte de regua de cobertura. Mas e
confundidor do caminho de frontend `"incompleto (mais curto que o texto)"`: o
audio fica mais LONGO, entao aquele check tende a disparar MENOS. Medido em
janela propria abaixo justamente pra nao creditar isso ao comparador.

### ALERTA PRA PROXIMA RONDA — `83d1ad4e` traz gate NOVO
O merge que esta buildando agora e o **gate DURO de intrusao sistemica (#530)**,
parado num PR por 70h e finalmente mergeado hoje 14:47Z. Quando subir:

- passa a **falhar** geracoes onde `flagged/checked >= 0,9` com `checked >= 5`;
- e uma **classe de falha que hoje nao existe** (sentinela confirmou: 0
  ocorrencias de "intrus" em error_message ate agora);
- pela medicao dos proprios autores: **5 casos em 776 entregas = 0,64%**;
- essas geracoes hoje sao **entregues e cobradas**; passarao a falhar e estornar.

**Consequencia direta:** a taxa de falha total VAI SUBIR ~0,6pp por decisao de
projeto. Isso **nao e regressao de cobertura**. Amanha a serie de `qa_coverage`
tem que ser lida separada da de intrusao, senao repete-se o erro de 19-20/08 de
somar portoes diferentes no mesmo balde.

---

## PASSO 2 — Medicao (paginada, erro cru conferido)

Instrumento: `/tmp/perf/qacov26.cjs` (sucessor do de 25/09, com a regua
reconferida e o agrupamento por aluno embutido).

| Janela | Total | Falhas | qa_coverage | Taxa cov |
|---|---|---|---|---|
| ONTEM (25/09 inteiro) | 149 | 0 | 0 | 0,0% |
| 25/09 antes da pausa-chunks (00:00→16:25Z) | 76 | 0 | 0 | 0,0% |
| 25/09 depois da pausa-chunks (16:25→24:00Z) | 73 | 0 | 0 | 0,0% |
| **HOJE 26/09 (00:00→15:18Z)** | **77** | **0** | **0** | **0,0%** |
| Acum. desde o verde no ar (25/09 16:25Z) | 150 | 0 | 0 | 0,0% |
| Acum. na regua atual (desde 21/09 19:27Z) | 448 | 4 | 3 | **0,67%** |

Nota de estrutura: o ultimo build verde terminou **ontem** 16:25Z, entao a
divisao pedida ("hoje ate o build / hoje depois") nao existe nesta ronda — **todo
o dia de hoje e pos-deploy**. Registrado assim em vez de forcar a janela.

### Independencia do numerador (licao 1 de 25/09)
As 3 falhas de `qa_coverage` da regua atual sao:
**3 falhas / 1 aluno / 2 incidentes** (gap de 30 min).
Sao as MESMAS de 22-23/09 ja contabilizadas na ronda passada — **nenhuma falha de
cobertura nova desde 23/09 11:48Z**.

### Sequencia limpa e o que ela permite concluir
- **346 geracoes** e **75,5h (3,15 dias)** sem falha de nenhum tipo.
- Na taxa da propria regua (0,67%), esperar-se-iam **2,32 falhas** nessas 346.
- **P(zero falhas | taxa inalterada) = 0,098.**

> **Nao da pra concluir melhora.** 0,098 nao passa de 0,05. O n de hoje (77) nem
> chega perto: a 0,67% se esperaria 0,5 falha em 77 — ver zero ai e o resultado
> mais provavel mesmo sem nada ter mudado. Limite superior 95% da taxa real com
> 0 em 346: **0,87%** — ou seja, os dados nao excluem a taxa antiga.
> O correto e: **a serie esta limpa e e encorajadora, e ainda nao e prova.**

### Elapsed — reprovacao vs hang
Unico tempo anomalo na regua: `644s` em 22/09 (Rodrigo), que e o hang do incidente
**d3d8d1b2**, fechado como aceite de risco. O watchdog (`66a82ff4`, 24/09 20:08Z)
subiu **depois** dele. **Nenhum hang desde o watchdog.** Incidente segue fechado —
nao ha motivo pra reabrir.

### Sanidade
`{"ready":665,"failed":5}` desde 18/09. Taxonomia crua bate: 3 qa_coverage + 1
"incompleto" (20/09, anterior a regua) + 1 executionTimeout = 5.

---

## PASSO 3 — Quem falhou

### Diego Vargas (`diegoavnunes@gmail.com`) — ATENCAO, relogio correndo
As 3 falhas de cobertura sao todas dele, no **mesmo texto de 1944 chars**.

**Primeiro, um alarme que eu quase dei errado.** A leitura por `ref_type` acusou
"1 de 3 estornado", o que parece rombo de cobranca. Fui na
`credit_transactions` crua: as outras 2 falhas tem **zero transacoes** — nunca
foram cobradas, logo nao ha o que estornar. **Nao ha rombo.** Registro isso
porque a metrica sozinha teria virado um alarme falso.

**Mas o caso NAO esta resolvido**, e o motivo e pior que o rombo que nao existia:

| Geracao | Status | Credito |
|---|---|---|
| `1c761a52` 22/09 21:47 | **ready** | cobrada 1944, **estornada em 23/09 12:31** |
| `a53e8f7b` 22/09 21:55 | failed | cobrada 1944, estornada |
| `339d44b8` 23/09 11:43 | failed | nunca cobrada |
| `9094a652` 23/09 11:48 | failed | nunca cobrada |

A unica geracao que o sistema considerou **boa** foi estornada tambem, no dia
seguinte. Ou seja: o QA aprovou, e o audio foi repudiado do mesmo jeito. Isso e
exatamente a assinatura que o gate de intrusao que sobe hoje existe pra pegar —
cobertura perfeita, conteudo errado.

Situacao real: **credito inteiro de volta, audio nenhum na mao.** Sem nova
tentativa ha 3,15 dias.

> **`access_until = 2026-09-29T12:00:00Z` → 2,86 dias.**
> Na ronda de 25/09 esse valor era 3,9 dias. Reconferido AO VIVO hoje (licao 3):
> **nao foi estendido, o relogio esta correndo de verdade.** Estorno nao serviu o
> aluno; se o acesso vencer assim, ele sai sem nunca ter recebido o que pediu.

### Rodrigo Sirahata (`rsirahata@gmail.com`)
Falha de `executionTimeout` (hang de 22/09), **nao e caso de cobertura**. Cobranca
integra: 981 debitado e 981 estornado. `access_until` 16/10 (19,9 dias). Sem
geracao desde entao. Nada a fazer.

---

## Fora do meu escopo (nao executado, por regra)
Nao respondi aluno, nao mexi em credito, nao abri nem fechei incidente, nao
recriei endpoint do RunPod. O caso do Diego e uma **decisao do Johnny**: o que
esta na mesa e o acesso vencendo em 2,86 dias sem entrega.

## Instrumentos desta ronda
- `/tmp/perf/qacov26.cjs` — janelas + taxonomia crua + independencia por aluno
- `/tmp/perf/streak26.cjs` — sequencia limpa e poder estatistico
- `/tmp/perf/aluno26.cjs`, `/tmp/perf/diego26.cjs` — conferencia viva de aluno
