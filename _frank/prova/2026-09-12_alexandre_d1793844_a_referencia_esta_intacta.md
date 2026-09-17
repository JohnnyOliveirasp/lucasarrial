# 12/09 — Alexandre (voz d1793844): a referência está INTACTA, não há o que curar

**Ordem recebida:** curar `voices.reference_transcript` da voz
`d1793844-c00b-4cf3-b260-6f4c31a6a9f8` pelo próprio áudio, conferir, e responder
o aluno por e-mail. Diagnóstico repassado: `ref/auto.wav` com 22,8s terminando
cortada no meio da fala, transcript salvo terminando em `outro vai falar que e…`,
padrão Negrini #124 (palavra fantasma).

**Resultado: NÃO CUREI.** Cada ponto do diagnóstico foi medido e nenhum se
confirma. Curar aqui seria repetir o #193 — gravar saída de whisper por cima de
dado que já está certo. Os portões da própria ferramenta também recusariam.

## O que foi medido, item por item

| afirmado | medido | instrumento |
|---|---|---|
| `auto.wav` tem 22,8s | **24,38s** (pcm_s16le 16 kHz mono, 780.238 bytes) | `ffprobe` |
| termina cortada no meio da fala | última palavra **"emprego" 23,40→24,12s**, depois **0,26s de decaimento** até 24,38s | whisper word-level + `atrim,astats` |
| nenhuma pausa > 0,25s nos últimos 10,4s | há pausa de **1,04s em 16,83→17,87s**, dentro da janela. O bloco contínuo final é 17,87→24,14 = **6,27s** | `silencedetect=-35dB:d=0.2` |
| últimos 250ms com energia de fala, pico −17 dB | pico **−27,7 dB**, RMS **−45,2 dB** | `atrim=24.13:24.38,astats` |
| pico do arquivo −7,7 dB | **−8,70 dB** | `astats` global |
| transcript termina em `outro vai falar que e…` | termina em **"…primeiro chefe do primeiro emprego."** | banco |
| transcript diverge do áudio | **idêntico, caractere por caractere** | whisper `verbose_json` |

Decaimento no fim do arquivo (pico por janela de 40 ms): −13,4 / −13,8 / −25,2 /
−27,5 / −22,1 / −22,8 / −30,1 / −40,6 / −44,6 dB. São **~200 ms de release**. A
régua do `cauda_decepada.cjs` (decepado = `release_ms ≤ 35` **E** `plato_db > −40`)
não fecha nem por uma perna. A frase acaba sozinha, com ponto final.

**Veredito do instrumento da casa**, em simulação (sem `--confirmar`):

```
node _frank/ferramentas/conferir_transcript_referencia.cjs --curar d1793844-…
voz "Minha Voz"
ANTES : …já teve no passado. Talvez os pais, talvez o primeiro chefe do primeiro emprego.
ÁUDIO : …já teve no passado. Talvez os pais, talvez o primeiro chefe do primeiro emprego.
pontas batem — nada a curar
```

## A frase do diagnóstico não existe em lugar nenhum

`reference_transcript ilike '%outro vai falar%'` → **0 vozes**. `'%vai falar que%'`
→ **0 vozes**. As **10 vozes treinadas hoje** terminam com pontuação final. O
texto citado na ordem não está no banco — não é outra voz trocada, não existe.

## Os 24s não são anomalia

O comentário do `06_voice_reference.sql` fala em "2 min"; a documentação está
velha. Medido nas 15 vozes `ready` mais recentes, a referência auto-extraída vive
entre **19,98s e 29,80s**. Os 24,38s do Alexandre caem no meio da distribuição.
Não há aqui um sinal de defeito.

## O que o aluno realmente ouviu

Geração `b8c999e6` "Amostra automática", 12/09 15:38:37 — **existe**, 691.244
bytes, 7,2s, RIFF válido.

- Texto pedido: *"Oi! Esta é a minha voz clonada. Se você está me ouvindo com clareza, o treinamento funcionou muito bem."*
- Texto falado (2 leituras idênticas): *"Oi, esta é a minha voz clonada. Se você tá me ouvindo com clareza, o treinamento funcionou muito bem."*
- **Sem palavra fantasma no início** — primeira palavra "Oi" em 0,60s.
- **Sem cauda decepada** — `cauda_decepada.cjs`: `release = 150 ms`, `plato = −53,1 dB`. Limpo.
- Única diferença: "está" saiu como "tá". Coloquialismo, não defeito.

O material bruto também está íntegro: **1 arquivo, 56min03s de áudio real**, passa
o portão de 20 min com 36min03s de folga (`listar_arquivos_da_voz.cjs`).

## A queixa, na letra do aluno (`help_messages`, 12/09 15:55)

> "nao gostei da voz treinada, como faço para fazer novamente?"

É **subjetiva e sem defeito descrito**. Não fala em corte, eco, palavra repetida
nem texto errado. A Fast ofereceu retreino por 10.000 créditos **ou** cura pela
equipe sem custo, ele respondeu "sim", e prometeram e-mail do
`suporte@fastcloner.com`.

⚠️ **Ele tem 0 créditos, SEM ACESSO e NENHUMA compra** (conta criada 10/09). A
opção de 10.000 créditos que o bot ofereceu é inalcançável para ele hoje. Isso é
um problema à parte e não foi tocado.

## Erro meu, registrado

A primeira varredura de entregas usou `BUCKETS.vozes()` para checar `audio_path`
de **generations**, que vivem em `BUCKETS.geracoes()`
(`generations-ai-verse-clone`). Deu uma epidemia falsa de `NoSuchKey`, inclusive
no sample do Alexandre. Peguei porque "quase tudo quebrado de uma vez" é cheiro
de régua errada, e a contraprova (regra 5-B) mostrou o objeto existindo no bucket
certo. **Nenhuma conclusão desta página depende daquela medição.**

## Por que não mandei o e-mail

A ordem era responder ao aluno dizendo que a referência foi curada. Nada foi
curado, porque nada estava quebrado. Escrever "consertamos" seria mentira, e
prometeria uma melhora de qualidade que nenhuma medição sustenta.

## O caminho certo, pela regra 9-D

Qualidade de voz **depende de ouvir**, e eu não ouço. O precedente da **Claudia**
é exatamente este caso: retreino prometido antes de alguém escutar, a voz estava
boa, a "cura" piorou e teve de ser revertida. Antes de queimar GPU:

```
action: ask_humans
subject: Aluno nao gostou da voz, mas os instrumentos nao acham defeito
student: alexandre@novaconexao.com
checked: ref 24,38s intacta e transcript identico ao audio; amostra limpa
         (release 150ms, plato -53,1dB, sem palavra fantasma); bruto 56min03s
         passa o portao; queixa e subjetiva
question: esta amostra esta aceitavel, ou tem algo que so o ouvido pega?
audio_key: 915cf384-…/d1793844-…/sample.wav   (bucket generations-ai-verse-clone)
```

Se alguém escutar e disser que está ruim, aí o retreino se justifica — e é **por
conta da casa**, como a Fast já prometeu no chat.
