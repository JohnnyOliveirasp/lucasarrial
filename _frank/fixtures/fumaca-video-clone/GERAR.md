# Material da casa — fumaça do Vídeo Clone

Entrada **fixa e versionada** de `_frank/ferramentas/fumaca_video_clone.cjs`.

## Regra que motiva tudo isto

**Nunca use arquivo de aluno numa fumaça.** A fumaça roda sozinha, em cron e
em passo de deploy, quantas vezes for preciso. Material de aluno num laço
automático é dado pessoal de terceiro passando pela GPU sem que ele tenha
pedido nada. Por isso o material aqui é **sintético e da casa**:

- `foto.jpg` — rosto **gerado por IA**, pessoa fictícia. Não é aluno, não é
  funcionário, não é pessoa real.
- `audio.wav` — **TTS**, frase neutra sobre o próprio teste. Não é voz de
  ninguém.

Os dois ficam commitados aqui (são pequenos: ~50 KB + ~320 KB) **e** publicados
no R2, porque o worker do RunPod lê por URL presignada — ele não enxerga o
disco local. O `manifesto.json` amarra as duas cópias pelo sha256: se alguém
trocar o objeto no R2, a fumaça **acusa e para** em vez de virar outro teste
em silêncio.

## Estado atual

| arquivo | o que é | medida |
|---|---|---|
| `foto.jpg` | retrato frontal sintético, 480×832 (o quadro do tier) | 50.921 bytes |
| `audio.wav` | TTS `tts-1` / voz `nova`, WAV PCM | 322.244 bytes · **6,71 s** |

6,71 s fica dentro da faixa de 5–10 s pedida: exercita o caminho inteiro sem
pagar GPU de vídeo longo. Cobrança mínima do produto é 5 s, então um áudio
menor que isso não economizaria nada e só reduziria a cobertura.

## Publicar no R2 (uma vez, ou quando o material mudar de propósito)

```bash
node _frank/ferramentas/fumaca_video_clone.cjs --publicar-material
```

Isso sobe pras chaves fixas no bucket de `generations`:

```
_casa/fumaca-video-clone/v1/foto.jpg
_casa/fumaca-video-clone/v1/audio.wav
```

e (re)grava o `manifesto.json` com sha256, bytes e a duração medida do WAV.

⚠️ Se você trocar o material de verdade, **suba a versão do prefixo** (`v1` →
`v2`) em vez de sobrescrever: um histórico de fumaça só é comparável se a
entrada for a mesma. Trocar a entrada e manter o nome transforma a série
temporal em mentira.

## Recriar do zero

**Foto** — qualquer gerador de imagem serve. O prompt usado:

> Photorealistic studio portrait of a fictional adult woman, front-facing
> directly at camera, neutral friendly closed-mouth expression, mouth clearly
> visible and unobstructed, eyes open looking at camera, head and shoulders
> centered, even soft studio lighting, plain light grey seamless background,
> sharp focus on the face, no hands, no glasses, no hat, no text, no watermark.
> Vertical framing.

Depois enquadra no formato do tier:

```bash
ffmpeg -y -i foto.png \
  -vf "scale=480:832:force_original_aspect_ratio=increase,crop=480:832" \
  -q:v 3 foto.jpg
```

O que importa no rosto: **frontal, boca visível e desobstruída, olhos
abertos**. É o que o InfiniteTalk precisa pra sincronizar — e é o mesmo
critério do `face-gate.ts` da rota.

**Áudio** — TTS da OpenAI, WAV PCM (o `medirDuracaoWav` do script lê o header
direto, sem depender de ffprobe instalado):

```js
// node, com dotenv apontando pro frontend/.env.local
await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "tts-1", voice: "nova", response_format: "wav",
    input: "Oi. Este e um teste automatico do sistema. Estou apenas verificando se a ferramenta esta funcionando normalmente hoje.",
  }),
});
```

Precisa ser **WAV PCM** e ter **fala de verdade**: áudio mudo faz o
`WanVideoSampler` dividir por energia zero e estourar "Array must not contain
infs or NaNs" (caso Fernanda, 18/08) — a fumaça acusaria um defeito que é do
próprio material de teste, não do produto.

Depois de recriar, rode `--publicar-material` e **commite o manifesto novo
junto com os binários novos**.
