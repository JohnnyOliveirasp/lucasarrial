# 07/09 — A promessa do Video Clone: medida antes de cumprida

Roteiro recebido: "prometi a SETE alunos que avisaria quando voltasse; meça,
depois escreva aos sete e poste no grupo". Medi primeiro. **A cura é real, mas
a promessa já tinha sido cumprida há ~38h** — e três premissas do roteiro
caíram no dado. Não escrevi aos alunos. Postei no grupo.

## 1. A cura, provada (07/09 15:01Z)

Instrumento: `_Bugs/prova_cura_07-09.cjs` — `HeadObject` no R2
(`voices-clone-ai-verse`), **não** `video_path is not null`. O campo
`video_path` é o destino gravado na criação e está preenchido **também nas
linhas `failed`**: concluir cura por ele daria 100% de sucesso inclusive
durante o apagão.

| conjunto | linhas | objeto REAL no R2 |
|---|---|---|
| `ready` de hoje (07/09 00:00Z→15:01Z) | 20 | **20** |
| **contraprova**: `failed` do apagão (05/09) | 8 | **0** |

A contraprova é o que autoriza a conclusão: o instrumento **distingue** os dois
conjuntos. Última entrega 07/09 14:50Z, 11 min antes da medição.

⚠️ **Não é "ausência de falha".** O roteiro avisava que zero tentativas não
prova conserto — e estava certo em avisar. Não é o caso: são **20 tentativas
com 20 entregas materializadas**, de 9 usuários distintos.

**Ledger** (fonte honesta das falhas): **zero** `video_clone_refund` em 06/09 e
07/09. O último é de 05/09 23h. **~40h limpas.**

## 2. As três premissas que o dado derrubou

1. **"o apagão passou de 24h"** → falso. **8h25m** (05/09 14:46:58Z →
   23:12:25Z), 53 falhas, 9 alunos, 200.350 cr devolvidos, casados por
   `ref_id`. Está encerrado desde 05/09 23:12Z. Não postei "notícia de 24h"
   porque a notícia não existe.
2. **"o acesso da Renata vencia 06/09"** → ela **renovou em 06/09 14:13Z**,
   ativa até **30/09**, e já voltou a gerar (2 vídeos).
3. **"PR da trava de manutenção `feat/video-clone-manutencao`"** → **não
   existe**. `git ls-remote` lista 128 branches (instrumento enxerga) e
   nenhuma é essa; nenhum dos 28 PRs abertos tem esse nome. Não há decisão de
   merge a cobrar.

Também: **PR #190 não curou** (o roteiro já dizia isso, e confere). Quem curou
foi o **#192**, pin `transformers==5.14.1`.

## 3. Por que NÃO escrevi aos sete

Conferi **um por um na caixa de Enviados**, não no relatório de ontem:

| aluno | mensagens já enviadas |
|---|---|
| rafaluanravi29 | 3 (05/09 15:28 "fora do ar" · 06/09 00:36 "voltou" · 06/09 01:08 duplicata) |
| pcezardireito | 2 (05/09 15:28 · 06/09 00:36 "voltou") |
| renatarcpsi | 2 (05/09 20:28 · 06/09 00:37 "voltou — caso levado adiante") |

**A promessa "aviso quando voltar" foi cumprida em 06/09 00:36–00:37Z.** Uma
carta agora seria a **terceira ou quarta** dizendo a mesma coisa, abrindo com
"prometi te avisar quando voltasse" — a mensagem genérica que a **regra 11**
proíbe e a repetição do incidente `3565a46b`.

O argumento mais forte contra escrever não é o histórico, é o uso: **6 dos 9
atingidos já geraram depois da cura.** Avisar "voltou" a quem já usou o produto
é ruído.

| aluno | prontos pós-cura | último |
|---|---|---|
| bilaherrmann | 9 | 06/09 23:14Z |
| lux.neuropsi | 4 | 07/09 02:51Z |
| smilefastrio | 4 | 06/09 19:52Z |
| pcezardireito | 2 | 06/09 19:17Z |
| renatarcpsi | 2 | 06/09 13:48Z |
| ederonline1 | 1 | 06/09 00:31Z |
| **clayton** | **0** | — |
| **costa.anaelson** | **0** | — |
| **rafaluanravi29** | **0** | — |

⚠️ Correção a uma medição de ontem: o relatório de 06/09 dava `pcezardireito`
com **0** prontos pós-cura. Ele gerou 2 às **19:17Z**, *depois* daquela
medição. Voltou.

⚠️ A lista dos "sete" continua errada quanto ao raio: **clayton** (4 falhas) e
**bilaherrmann** (6) foram atingidos e nunca estiveram nela; os atingidos são
**9**, não 7.

## 4. Renata: não respondeu — e a promessa continua aberta

- `ler_caixa --de renatarcpsi@gmail.com` → **vazio**. Contraprova obrigatória:
  `--ultimos 5` devolve mensagens normalmente (471 na caixa) e a fila de
  não-lidos é **0**. O vazio é **ausência real**, não instrumento cego.
- Ela **não pediu nada**. O roteiro condicionava a escalação a ela ter pedido,
  então a condição **não se cumpriu** — não levei ao Lucas como "a Renata
  pediu", porque isso seria falso.
- **Mas a promessa nossa é incondicional e continua de pé:** o e-mail de 06/09
  00:37 diz, com todas as letras, que o caso foi levado adiante e que
  acompanharíamos **até ter retorno**. Isso foi escalado ontem (§2.3 do
  relatório noturno) e não voltou resposta. **Levei ao grupo hoje.** É decisão
  comercial (Johnny/Lucas), não minha.

## 5. O que fiz

**Posto no grupo da equipe** (`avisar_grupo.cjs`, modo pergunta, do próprio
Hetzner — a WAHA só escuta em 127.0.0.1): a cura provada, as premissas
derrubadas, e as **duas decisões que são de gente**:

1. **Renata** — cortesia sem ela pedir, ou uma linha curta fechando? Silêncio
   agora é quebra de promessa.
2. **Os 3 que não voltaram** (rafaluanravi29 5 falhas, costa.anaelson 6,
   clayton 4) — carta curta e **personalizada só pra esses 3**, com o dado
   próprio de cada um? Esse recorte **não** é a genérica que recusei acima.

⚠️ **Armadilha de instrumento encontrada hoje:** a rota `ask_humans` corta
`checked` e `question` em **600 chars, em silêncio**
(`actions/route.ts:172+`). Minha mensagem tinha 1.216 + 848 — teria ido pela
metade e ninguém saberia. Por isso usei o `avisar_grupo.cjs` via ssh, que
**não trunca**. Quem for postar coisa longa pela rota: ela não cabe.

## 6. A lição

**A promessa que se cobra pode já ter sido paga.** O roteiro trazia uma dívida
("prometi avisar") que o Enviados mostrou quitada há 38h — e o uso mostrou
quitada de verdade, porque 6 dos 9 já tinham voltado a gerar. Cumprir de novo
não é zelo, é o ruído que a regra 11 proíbe. **Antes de cumprir uma promessa,
meça se ela já foi cumprida** — vale a mesma regra do número herdado.
