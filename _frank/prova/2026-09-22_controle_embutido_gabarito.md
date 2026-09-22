# Gabarito do controle embutido do #234 (f8587cef) — 22/09/2026

**Por que este arquivo existe:** o lote foi construído hoje às **14:00Z** por uma
ronda anterior e **nunca foi registrado em lugar nenhum** — a ferramenta ficou
*untracked* no git e o gabarito, que só é impresso no **stdout**, morreu junto com
aquele terminal. Sem isto, o experimento inteiro viraria 12 mp3 anônimos em
`/tmp` e a próxima ronda os apagaria sem saber o que eram. Foi o mesmo tipo de
perda que o manual já castiga em código ("registro que fica invisível").

## Como foi recuperado

O embaralho da ferramenta é **determinístico de propósito** (ordena pelo rótulo de
origem invertido, sem `Math.random`), então re-rodar com os mesmos argumentos
reconstrói o **mesmo lote**. Argumentos, que estavam no cabeçalho de uso do
próprio script:

```
node _frank/ferramentas/2026-09-22_controle_embutido_decapitada.cjs \
  --origem=/tmp/par_cego_n12 --dir=/tmp/controle_embutido_r2 \
  --adulterar=AUDIO_02,AUDIO_04,AUDIO_09,AUDIO_20 \
  --intactos=AUDIO_03,AUDIO_12,AUDIO_21 \
  --reais=AUDIO_11,AUDIO_15,AUDIO_16,AUDIO_23,AUDIO_24 --ms=90
```

**Prova de que é o mesmo lote, não um parecido:** `md5sum` dos 12 arquivos
reconstruídos contra os 12 de 14:00Z — **12/12 idênticos**. O gabarito abaixo é,
portanto, o gabarito daquele lote.

## 🔑 GABARITO

| rótulo | estado | origem | corte fabricado |
|---|---|---|---|
| TESTE_01 | **ADULTERADO** | AUDIO_20 | 16,733s |
| TESTE_02 | REAL | AUDIO_11 | — |
| TESTE_03 | INTACTO | AUDIO_21 | — |
| TESTE_04 | **ADULTERADO** | AUDIO_02 | 21,754s |
| TESTE_05 | INTACTO | AUDIO_12 | — |
| TESTE_06 | INTACTO | AUDIO_03 | — |
| TESTE_07 | REAL | AUDIO_23 | — |
| TESTE_08 | **ADULTERADO** | AUDIO_04 | 17,571s |
| TESTE_09 | REAL | AUDIO_24 | — |
| TESTE_10 | REAL | AUDIO_15 | — |
| TESTE_11 | REAL | AUDIO_16 | — |
| TESTE_12 | **ADULTERADO** | AUDIO_09 | 15,781s |

4 adulterados · 3 intactos · 5 reais (gerações de produção que a régua reprovou).

## Resultado da escuta: **NÃO HOUVE ESCUTA** — e isso é o achado

Mandei os 12 ao `olho` em **um único pedido** (a carga é o ponto do teste), com
uma regra que os testes anteriores não tinham:

> *"Se você NÃO conseguir de fato decodificar/ouvir um arquivo, escreva 'NAO
> OUVI'. NUNCA carimbe SEM CORTE num arquivo que você não ouviu — isso destrói a
> medição inteira."*

Resposta, em **9 segundos**: **`NAO OUVI` nos 12**, e `OUVI DE VERDADE: 0 de 12`.
Sondagem de um arquivo só, logo depois: resposta **vazia** em 3s.

Instrumento alternativo tentado e também fora: `analyze_video` da Z.AI (remuxei o
mp3 em mp4 com vídeo preto) devolveu **HTTP 429 — "Insufficient balance or no
resource package"**.

### O que isto prova, e só isto

A ronda das 14:00Z registrou, no cabeçalho da própria ferramenta, que o par cego
de **n=24** daquele dia voltou com **23 de 24 "SEM CORTE", todos com "confiança
alta"** — inclusive gerações com fronteira decapitada **confirmada offline**, uma
delas com **cinco**. Aquela ronda levantou duas hipóteses e disse, corretamente,
que o teste não as separava:

- **(a)** a régua marca fronteira abrupta que o ouvido não ouve;
- **(b)** o ouvido **degrada sob carga** e carimba "SEM CORTE | alta" em tudo.

Com a escotilha do `NAO OUVI`, o mesmo ouvido nas mesmas condições declara que
**não ouviu nada**. Isso é **(b)**, e numa versão pior do que a suspeita: não era
degradação de sensibilidade, era **resposta confiante sem escuta nenhuma**. A
única razão de sabermos é que a pergunta desta vez ofereceu uma saída honesta.

> **CONSEQUÊNCIA — o par cego de n=24 de 22/09 está VAZIO DE INFORMAÇÃO.** Não
> pode ser citado **nem a favor nem contra** a régua. É exatamente o desfecho que
> a própria ferramenta previu por escrito: *"perde os ADULTERADOS -> lote VAZIO
> de informação"*.

### O que isto **não** prova

**Não** invalida o controle positivo de **21/09**. Lá o ouvido achou 3 de 3 cortes
fabricados **com o segundo certo (erro de 10–50 ms)** e preservou 2 de 2 intactos
— acerto que é impossível sem escuta real. A leitura honesta é que o ouvido
**funcionou em 21/09 e não funciona agora**, não que ele nunca funcionou.

E **não** decide se a régua infla. Essa pergunta continua aberta, e o caminho
segue sendo o do PR #408 (posição da fronteira) + escuta ponto a ponto **quando
houver um ouvido de pé**.

## Alcance disto além do #234

A ordem de **17/09** transformou "precisa ver/ouvir/assistir" de **parada** em
**despacho**, e mandou o veredito voltar escrito na nota do card. Se o ouvido
devolve veredito confiante **sem ter ouvido**, aquele despacho passa a produzir
**laudo falso** em vez de parada — e laudo falso escrito na nota de um cartão é
pior que a parada que a ordem aboliu, porque parece resolvido.

**Regra que fica, e que já se pagou hoje:** todo despacho de percepção leva a
escotilha do `NAO OUVI`/`NAO VI` **e** um controle positivo **embutido no mesmo
lote**. Laudo de percepção sem controle embutido não entra em nota de cartão.
