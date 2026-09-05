# Ronda das falhas — 05/09/2026 ~21:40–22:00Z (Frank, dono da fila)

Fila no início: **30 abertos + 13 aguardando aluno** (eram 28+13 às 21h). No
fim: **30 abertos** — não fechei nenhum, e explico por quê no item 7.

**Resultado: achei a causa do Vídeo Clone e ela CONTRADIZ a conclusão da ronda
das 21h. Não é o Demucs, não é o TORCH_HOME e não precisa de pod. É uma
dependência Python não pinada que mudou sozinha na rebuild de hoje. Provado por
diff de fonte entre as duas versões, não por eliminação. PR #192 aberto.**

---

## 1. `gh pr list` primeiro — sétima ronda seguida em que paga

21 PRs abertos no início. **`#191` (garantia, `#265`) CONTINUA ABERTO.** Item 8.

## 2. O volume não foi populado, e o Vídeo Clone segue no chão

Checklist da ronda anterior, item 2 — a régua é geração `ready` no banco:

| janela | tentativas | `ready` |
|---|---|---|
| desde 18:30Z (deploy) | **10** | **0** |
| desde 20:30Z | **3** | **0** |
| dia 05/09 inteiro | 26 | 7 (nenhum depois das 11h26Z) |

**Último sucesso continua sendo 11:26:49Z** — agora são **~10h20 sem uma única
entrega**. As 3 tentativas novas são todas do `clayton@arcoiristintas.com`
(21:02, 21:04, 21:06Z), todas `failed`. Duas em `480p-v3`, **uma em `480p-v2`**.

Alunos atingidos hoje: `costa.anaelson`, `rafaluanravi29`, `renatarcpsi`,
`lux.neuropsi`, `ederonline1`, `pcezardireito`, `clayton@arcoiristintas`.

## 3. A causa — e por que a ronda das 21h errou o alvo

A ronda das 21h chegou, **por eliminação**, em Demucs/`TORCH_HOME` e concluiu
que *"o que falta não é código, é rodar o pré-cache num pod"*. Fui ler a fonte
dos pins em vez de eliminar, e a eliminação tinha um buraco.

**Não é modelo faltando no volume. É dependência Python sem teto.**

Os custom nodes estão pinados por SHA de git, **mas as dependências Python
não**. O `requirements.txt` do `WanVideoWrapper@088128b22424` **nem sequer
lista `transformers`** — ele entra como transitivo, sem piso e sem teto. Duas
builds do mesmo commit instalam versões diferentes:

- imagem de **07/08/2026** (a que funcionou por um mês) → `transformers` **5.14.1**
- rebuild de **05/09 18h30Z** (a **primeira em um mês**) → `transformers` **5.16.1**

Em **5.16.0** o `Wav2Vec2Encoder.forward` mudou:

| | 5.14.1 | 5.16.1 |
|---|---|---|
| params do `forward` | `hidden_states, attention_mask, output_attentions, output_hidden_states, return_dict` | `hidden_states, attention_mask, **kwargs` |
| `all_hidden_states` no arquivo | **10 ocorrências** | **0** |
| retorno | `BaseModelOutput(..., hidden_states=all_hidden_states, ...)` | `BaseModelOutput(last_hidden_state=hidden_states)` |

Cadeia exata:

```
modeling_wav2vec2.py       -> encoder_outputs.hidden_states = None
multitalk/wav2vec2.py:78   -> BaseModelOutput(hidden_states=None)
multitalk/nodes.py:248     -> embeddings.hidden_states[1:]
  => Node Type: MultiTalkWav2VecEmbeds, Node ID: 194,
     Message: 'NoneType' object is not subscriptable
```

Bate com **o erro**, com **o nó** e com **o horário**: o erro do nó 194 só
existe a partir das 18h30Z, que é quando a imagem nova subiu. Antes disso a
falha era no nó 137, e o PR #190 curou aquela metade de verdade.

## 4. Por que NÃO é o Demucs — e por que o pod não curaria

O argumento que faltava na ronda anterior:

- `AudioSeparation` (nó 170) **levanta `RuntimeError` explícito** quando o
  checkpoint falta ou está corrompido, e o `sources_to_tuple()` dele **sempre**
  monta `{"waveform": tensor}` de verdade (levanta `ValueError` se faltar uma
  source). Checkpoint ausente apareceria como erro **no nó 170**, jamais como
  `NoneType` no 194.
- Logo: **o erro estar no 194 prova que o 170 rodou até o fim** — ou seja, o
  Demucs **carregou**. O `TORCH_HOME` novo está funcionando.
- O nó 137 também não devolve `None` (ou levanta, ou devolve dict montado na
  mão) — isso a ronda anterior já tinha acertado.
- Saída 3 do nó 170 é **`Vocals`** (`RETURN_NAMES = Bass, Drums, Other,
  Vocals`). A fiação do template está certa, não é índice trocado.

**Subir pod e popular o volume vale como robustez, mas NÃO destrava o aluno.**
Teria gastado GPU e continuado fora do ar. Avisei o Johnny no grupo pra cancelar
o pedido.

Explica também o **`480p-v2`** que falhou às 21h05, que a ronda anterior não
tinha visto: os dois templates usam os mesmos nós 137/170/194 com a mesma
fiação. Falha nos dois tiers é consequência, não pista nova.

## 5. Entrega desta ronda — PR #192

Branch `fix/pin-transformers-wav2vec-hidden-states`, commit **`1f1f393`**:

1. **`pip install transformers==5.14.1`** — última antes do 5.15.0 (10/08), e é
   exatamente a que rodou **233 de 234** gerações entre 01 e 04/09.
2. **Smoke test de BUILD** que barra a imagem se `Wav2Vec2Encoder.forward`
   parar de aceitar `output_hidden_states` ou de acumular `all_hidden_states`.
   Conferido com `ast` contra os dois arquivos reais: **passa em 5.14.1,
   reprova em 5.16.1**.

O item 2 é o conserto estrutural que as rondas das 19h e 21h pediram e que
ninguém tinha feito: o pipeline subia imagem nova sem nenhuma garantia de que
ela ainda satisfaz o que o fluxo exige. Agora **falha alto na build**, que é
barato, em vez de falhar em produção, que custa aluno.

Não mexe em volume, migration, crédito nem GPU. **Cura pela build.**

## 6. Ressalva honesta

Isto é **diff de fonte entre as duas versões + erro/nó/horário batendo**. Não
tenho o log do worker: a REST do RunPod não expõe (404/400 em três rotas) e job
com mais de ~1h some do `/status`. A prova final é **geração `ready` no banco
depois do deploy** — nada menos que isso conta, e é por isso que o incidente
segue `investigating`.

## 7. Por que não fechei nada

Regra 14 inteira: PR aberto **não é produção**, e produção sem geração `ready`
**não é conserto**. O `85c9a45a` (`#266`) levou nota longa com os itens 3 a 6 e
o commit `1f1f393`, e **continua `investigating` de propósito**. Fechar hoje
seria mentir no placar.

Os 3 alunos das tentativas novas **já estavam avisados** e não dupliquei:
`clayton@arcoiristintas.com` às **21:26:20Z** (Enviados uid 1093, ou seja
**depois** da última tentativa dele às 21:06Z) e `pcezardireito@icloud.com` às
**15:28:35Z** (uid 1080). Conferido com `ler_caixa.cjs --enviados`, que é a
única leitura de caixa que eu faço — triagem sai da fila de incidentes.

## 8. `#265`: o prazo é AMANHÃ e o `#191` continua aberto

Quarta ronda seguida registrando. O único passo que falta é o **merge do
`#191`**. **Não repeti o pedido no grupo** (o grupo levou o P0, e empilhar
cobrança na mesma hora vira ruído). Mas o registro fica: se **06/09** passar sem
merge, a `katiasalvador32@` **perdeu** a janela de garantia — isso deixa de ser
pendência e vira **prejuízo consumado**, e tem que ser escrito assim.

## 9. Próxima ronda começa por aqui

1. **`gh pr list` primeiro.** Sétima seguida em que paga.
2. **`#192` mergeou?** Se sim: esperar a build do worker, e então a ÚNICA
   pergunta é **tem geração `ready` no banco depois do deploy?**. Se tem,
   fecha o `85c9a45a` com o commit. Se não tem, o item 6 vale: eu estava
   errado, e o próximo lugar a olhar é o log do worker de verdade — não mais
   fonte.
3. **Se `#192` não mergeou**, conte as tentativas novas desde 21h05Z. Se o
   número subir, o custo humano do "esperar" está subindo com ele, e isso é
   informação que vai pro grupo.
4. **Ninguém precisa mais investigar Demucs, `TORCH_HOME` ou pré-cache de
   volume para ESTE erro** — item 4, respondido e provado. Não refazer.
5. **Ninguém precisa mais conferir se o `download_models.sh` apaga o parcial** —
   respondido na ronda das 21h. Não refazer.
6. **O pod continua NÃO sendo necessário.** Se voltar como pedido ao Johnny,
   alguém não leu esta ronda.
7. **`#191` mergeou?** Se passou de 06/09 sem merge, escreva que a Katia
   **perdeu** a janela. Não deixe sumir.
8. **Dívida que este incidente expôs e que vale um PR próprio:** `accelerate`,
   `diffusers` e `peft` estão no `requirements.txt` do WanVideoWrapper com piso
   e **sem teto** (`>=`), exatamente a mesma exposição do `transformers`. O
   `#192` fecha só o buraco que sangrou hoje. A classe continua aberta.
9. **Item repetido de ronda anterior só entra depois de reler a última nota do
   card.** Foi essa regra que evitou eu reescrever pro Clayton hoje.
10. Continuam parados com o Johnny: migration 82 (`#15`),
    renovação-reabre-garantia (`#265`), proposta do Jackson (`#254`). **Saiu da
    lista: pod pra popular o volume** — não é mais necessário.

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início e no fim.
Fila lida pela varredura, não pela caixa do `suporte@` (ordem de 19/08) — a
única leitura da caixa foi `--enviados`, pra **não** duplicar aviso a aluno.
Estorno em dia (10 tipos, 2.843 linhas, nenhum tipo desconhecido). Uma gravação
via `anotar_incidente.cjs` (`85c9a45a`), conferida na releitura em 1 linha
afetada (4 → 5 notas). Nada da planilha foi lido, escrito ou reprocessado
(ordem de 29/08). Não mergeei PR, não apliquei migration, não mexi em crédito,
não estornei, não gastei GPU e não escrevi pra aluno (já estavam avisados).
Código foi por branch `feat/fix` + PR com base `main`; só este log vai direto na
main. Aviso no grupo pelo `notify-grupo.sh` (ordem de 31/08); nada no privado do
Johnny.
