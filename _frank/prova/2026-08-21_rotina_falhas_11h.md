# Ronda das 11h UTC — 21/08/2026 (Rotina das Falhas, dono da fila)

Card: `6c2bdb07` · Fila recebida: `2c5bab42`, `5c3f1f8b`, `ce6e157d`
Estado da fila no fim: **4 abertos, 0 fechados nesta ronda** (os 3 da fila + `72e054ee`).

> **Resumo honesto:** nenhum incidente fechou. O que esta ronda entregou foi
> **causa**, não fechamento: o fio do eco (pendente há 7 rondas) foi medido e deu
> negativo, e a parte que faltava da cura da Katia deixou de ser "julgamento de
> ouvido" e passou a ter linha de código. Também registro **um erro meu desta
> própria ronda** e **um buraco de registro** que descobri no caminho.

---

## 1. `ce6e157d` — Katia (áudio robótico / frases coladas) · **avanço grande, não fechou**

### 1.1 O fio do eco: medido e NEGATIVO

Este fio foi absorvido do `100e7ace` na ronda das 10h com a observação de que
**nunca havia sido medido depois da cura, por falta de material**. A geração
`2d486632` (11:46Z) é esse material. Transcrevi três arquivos **baixados** do R2
(nunca pela URL assinada) com `whisper-1`:

| arquivo | início | veredito |
|---|---|---|
| `ref/auto.wav` (28,85s) | — | termina em **frase completa**: "...Ele prefere voltar para o conhecido." |
| ANTES `35dc6aee` | "Eu sei que existe uma parte de você..." | sem intrusão, sem palavra engolida |
| DEPOIS `2d486632` | idem, limpo | sem intrusão, sem palavra engolida |

**Zero eco e zero primeira-palavra-engolida nos dois**, com cobertura integral do
texto. A condição não se reproduz em material novo.

**Achado de borda — o banco registra a cura da referência:** o
`reference_transcript` gravado na geração de 19/08 termina em
"...voltar para o conhecido **por menos**" (farelo); o gravado hoje termina em
"...voltar para o conhecido." O Whisper no objeto **vivo** do R2 concorda com o
novo. Ou seja: a referência foi recortada em fronteira de palavra e o farelo
sumiu — conferido **no arquivo**, não só no campo do banco.

### 1.2 A pausa: a cura funciona, e tem impressão digital do valor configurado

Só pausas **≥ 0,12s**, `ffmpeg silencedetect` nos arquivos baixados:

| limiar | ANTES (`35dc6aee`) | DEPOIS (`2d486632`) |
|---|---|---|
| −60 dB | **0** | **3** |
| −50 dB | 1 | 4 |
| −40 dB | 5 | 11 |

As 3 pausas do DEPOIS a −60 dB medem **0,2396s / 0,2383s / 0,2535s** — todas
≈0,24s contra os **220ms configurados** (`tts_silence_ms=220`). O valor
configurado **aparece no áudio**: isso é causa, não correlação. O ANTES tem
**0 pausa real** (só 81ms de padding do encoder em t=0, presente nos dois).

Com isso o e-mail de 20/08 que afirmou *"não havia uma única pausa, nem de um
décimo de segundo"* fica **confirmado** a −60 dB.

### 1.3 Por que só 3 pausas — a causa, lida no código

`handler.py:1530`:

```python
if silence_samples > 0 and crossfade_samples == 0 and idx < len(chunks) - 1:
    pieces.append(np.zeros(silence_samples, dtype=np.float32))
```

O silêncio entra **somente entre CHUNKS**. E `handler.py:661`
`_split_text_for_tts` **empacota várias frases num mesmo chunk** até 160 chars —
apesar do docstring dizer "chunking por frase".

Rodei o próprio algoritmo no texto dela: **4 chunks → 3 fronteiras → 3 pausas**,
batendo exatamente com as 3 medidas (9,35s / 20,04s / 29,83s):

```
[0] 166 chars  ...os mesmos ciclos.
[1] 163 chars  ...da sua consciência.
[2] 160 chars  "...realmente é. Minha missão é te ajudar a voltar para você."     <- 2 frases
[3]  65 chars  "Bem-vinda ao seu portal. Bem-vinda ao caminho de volta para você." <- 2 frases
```

As fronteiras de frase **dentro** dos chunks `[2]` e `[3]` são estruturalmente
incapazes de receber pausa.

**Prova audível disso:** o Whisper do DEPOIS transcreve o chunk `[3]` como
*"Bem-vinda ao seu portal**,** bem-vinda ao caminho"* — com **vírgula**, ou seja
grudado. É exatamente a queixa dela ("como se eu não desse espaço entre uma frase
e outra"), **ainda presente depois da cura**.

### 1.4 Consequência e o que NÃO fiz

O piloto 220/0 entrega ~60% do pedido (3 de 5 fronteiras de frase). **Não adianta
subir os 220ms**: as 2 fronteiras que faltam não passam por esse caminho. O
conserto é no **chunking** — quando `silence_ms > 0`, fronteira de frase precisa
virar fronteira de chunk.

**Não escrevi esse código nesta ronda**, de propósito: mexe no `runpod-worker`
(deploy recicla worker, área sensível) e vai por branch + PR, não no fim de
ronda. Fica dimensionado, com a linha exata, para quem pegar.

### 1.5 Efeito colateral medido, ainda sem causa

ANTES = mp3 mono 48kHz **CBR 192000 exatos**; DEPOIS = mp3 mono 48kHz **~105237**
(valor não-redondo = assinatura de VBR). **Não é stereo→mono** (os dois são
mono). Além disso o `ffprobe` lê 31,95s no DEPOIS enquanto o banco gravou 33,564
(no ANTES bate exato: 32,928). Registro como **medição, não diagnóstico** — não
li o caminho de encode e não sei a causa.

### 1.6 Relógio

Acesso dela vence **2026-08-22T12:00Z (~24h)**. O e-mail dela (uid 204, 05:53Z)
segue **sem resposta há ~6h** — não respondi porque a ordem da ronda exige o
"pode" do Johnny para e-mail de aluno. **O pedido segue de pé**, e agora a
resposta tem conteúdo técnico real, inclusive o que **ainda não** está curado.

---

## 2. ⚠️ Um erro meu, nesta mesma ronda

Duas correções do meu próprio trabalho, que valem mais registradas que escondidas:

1. **Medição de silêncio que voltou zero falso.** Rodei primeiro com
   `ffmpeg -v error` e deu **0 pausa nos dois arquivos** — o que teria "refutado"
   minha própria medição das 11h. As linhas do `silencedetect` saem em nível
   **INFO**; `-v error` as engole e o resultado vira um zero limpo e mentiroso.
   É a armadilha do *"consulta que erra volta vazia"* em versão áudio.
   **Regra nova: silencedetect exige `-v info`.**
2. **Conclusão errada na nota das 11h.** Eu escrevi que o quanto falta da cura
   "é julgamento humano e eu não tenho ouvido". Isso estava errado: a parte que
   falta **não depende de ouvido**, tem causa exata no código (§1.3). Eu tinha
   parado a investigação cedo demais.

---

## 3. 🕳️ Buraco de registro descoberto: a ronda das 10h40 não deixou log

Conferido commit a commit em `_frank/prova/` de hoje: **toda ronda tem log,
menos a de 10h40** (card `95875c22`, **cancelado** às 10:58Z).

Só que ela **já tinha subido dois PRs para produção** antes de ser cancelada, e
os dois são da família do `2c5bab42`:

| commit | PR | o que fez | deploy |
|---|---|---|---|
| `4c05f59` | #25 | concordância no singular: a mensagem dizia *"1 não chegaram até nós"* | ✅ `62c3b41` 10:48:21Z |
| `a0b58e1` | #26 | fonte única das extensões de áudio: o import do Drive aceitava `mov/mkv/wma/amr` e a régua não os reconhecia — a casa jogava fora arquivo do aluno e depois o recusava por áudio insuficiente | ✅ `2ca3871` 10:52:33Z |

O `a0b58e1` tem estrago duplo documentado: o arquivo saía de `utilizaveis` **e**
o slot dele virava ignorado em `contarSlotsDoEnvio`, mascarando um arquivo
realmente perdido no mesmo lote. Medido: 3 vozes com `.mov` do Drive
(`b2477da4`, `b6c6ba25`, `799edf73`) — **nenhuma de pagante, por sorte, não por
desenho**.

**Fica registrado aqui para não ficar invisível.** É exatamente o risco que a
ordem permanente descreve ("registro que fica fora da main é invisível na ronda
seguinte") — só que a causa aqui não foi branch errada, foi **ronda cancelada no
meio**.

---

## 4. `2c5bab42` — upload silencioso · **sem mudança, não fechou**

Conferido ao vivo com `varredura_travados.cjs` nesta ronda. `last_seen_at` segue
**2026-08-21T04:17Z** (~7,5h sem disparar). O backfill da mensagem já foi
conferido na anotação das 11:53Z: 17 reescritas como perda nossa + 7 curadas como
curto-de-verdade = as 24 que o Vigia mediu, nenhuma ficou para trás.

**Por que não fecha:** o backfill conserta o que a tela **diz**, não a **perda**.
O arquivo continua não subindo. Fechar seria marcar `fixed` sem ter resolvido
(regra 14).

Já descartado, não remedir: `voice-creator.tsx` tem retry e aborta se um PUT
falha; `uploads-complete` não é a causa; os faltantes nunca chegaram ao bucket.
Sobra o **resgate** (`rescue-stuck-uploads`).

## 5. `5c3f1f8b` — 5 pagantes sem voz · **sem mudança, não fechou**

Pergunta 1 ("já resolveu sozinho?") = **NÃO** para os 5. A varredura desta ronda
lista exatamente os mesmos 5, nenhum entrou e nenhum saiu:

| aluno | créditos | sem voz há | acesso até |
|---|---|---|---|
| jrfengenhariadf | 100.000 | 27 dias | **25/08 — o mais curto** |
| leandro.fitoway | 97.620 | 22 dias | 29/08 |
| ivanildezuca | 200.000 | 13 dias | 08/09 |
| marcelopersonalthe32 | 198.950 | 11 dias | 05/09 |
| csitya100 | 200.655 | 6 dias | 13/09 |

**Dinheiro:** limpo, reconferido por `ref_type` (incluindo `voice_train_refund`,
não só `generation_refund`). Nenhum crédito pendurado. O prejuízo dos 5 é **não
ter voz**, não é dinheiro.

**O que falta e não é meu:** avisar os 5 por e-mail que precisam **reenviar**. A
mensagem em produção já está honesta, mas nenhum dos 5 sabe que precisa voltar
lá. **Aguardando o "pode" do Johnny.**

---

## 6. Produção e fim de ronda

- Deploys de hoje: **todos verdes**, incluindo o HEAD atual da main
  (`2ca3871`, run 32474611211, 10:52:33Z).
- Nada gasto nesta ronda: **nenhuma geração nova, nenhum crédito, nenhum débito**.
- Nada escrito para aluno nesta ronda.

## 7. Precisa do Johnny (2 itens, binários)

1. **"Pode" para responder a Katia.** Vence em ~24h. Agora a resposta tem
   conteúdo real: o que curou, o que ainda não curou e por quê.
2. **"Pode" para avisar os 5 pagantes que precisam reenviar.** O jrfengenhariadf
   perde acesso em **25/08**.
