# Ronda das falhas — 05/09/2026 ~19:20–19:50Z (Frank, dono da fila)

Fila no início: **27 abertos + 13 aguardando aluno** (eram 25+13 às 18h40).

**Resultado: o Vídeo Clone deu prova de vida e ela é NEGATIVA — 2 tentativas
depois do deploy, 2 falhas. Achei por que o conserto não pegou: o PR #190
mudou o LUGAR de onde os modelos são lidos, mas nada no deploy põe modelo
nesse lugar. O erro mudou de nó, o que prova que a metade que subiu funcionou
e a outra metade nunca existiu.**

---

## 1. `gh pr list` primeiro — quinta ronda seguida em que paga

21 PRs abertos. O **#191 (garantia, `#265`) continua ABERTO** — voltarei a ele
no item 6, porque tem prazo amanhã.

## 2. A pergunta que a ronda das 18h deixou marcada, respondida

A ronda das 18h fechou assim: *"Vídeo Clone: voltou? Conte pelo extrato. Só
vale geração `ready` no banco — não vale health do RunPod, não vale PR
mergeado, não vale deploy verde."* Ela mediu 54 minutos de silêncio e se
recusou, com razão, a chamar aquilo de resolvido.

Agora existe evidência real, e ela é negativa:

| tentativa | hora | duração | desfecho |
|---|---|---|---|
| 1ª pós-deploy | 19h23:34Z | **24,465s** | failed |
| 2ª pós-deploy | 19h31:12Z | **3,655s** | failed |

Mesmo worker (`htl8vydte03ihh`), mesma aluna (`renatarcpsi@gmail.com`), mesmo
tier (`480p-v3`). **2 tentativas, 2 falhas, 0 sucessos.** Zero geração `ready`.

**Dinheiro está certo** e eu conferi um a um, não por atacado: 1 linha
`ref_type='video_clone_refund'` casada por `ref_id` para **cada** uma das duas
gerações. A régua é o `ref_type`, nunca o `kind` (armadilha de 20/08).

## 3. O erro MUDOU DE NÓ — e é isso que diagnostica tudo

O `raw_error` do banco é `Job processing failed` nas duas, que não diz nada.
O erro útil está no RunPod (`/v2/<endpoint>/status/<job>`), e é idêntico nas duas:

> `Workflow execution error: Node Type: MultiTalkWav2VecEmbeds, Node ID: 194,`
> `Message: 'NoneType' object is not subscriptable`

Compare com o que as rondas das 15h e 16h registraram, **antes** do deploy:

> `Node Type: DownloadAndLoadWav2VecModel, Node ID: 137, Message: Error no file`
> `named pytorch_model.bin ... found in directory`
> `/comfyui/models/transformers/TencentGameMate/chinese-wav2vec2-base`

| | antes do deploy | depois do deploy |
|---|---|---|
| nó que estoura | **137** (carrega o modelo) | **194** (consome o modelo) |
| mensagem | arquivo de peso não encontrado | `NoneType` não é subscriptable |

**O nó 137 parou de estourar.** Isso não é ruído: é a prova de que o symlink do
PR #190 pegou de verdade em produção. A falha andou um nó para a frente, o que
significa que o caminho novo é lido — e não entrega modelo usável.

Conferido dos dois lados, não só pelo log do CI: o template `810lqswobo`
responde `imageName: ...lucasarrial-comfyui:d1ce203`, e o endpoint
`9get7wv7trn3wg` monta o network volume `ff442v3132` em `/workspace`.

## 4. A causa: o PR #190 mudou o endereço e ninguém mudou a mudança de endereço

O PR #190 realocou **dois** caminhos de modelo para o volume permanente:

1. symlink `/comfyui/models/transformers` → `/runpod-volume/models/transformers`
   (o wav2vec do nó 137);
2. `ENV TORCH_HOME=/runpod-volume/torch` (o Demucs do nó 170, `AudioSeparation`,
   que alimenta o `audio_1` do nó 194).

Quem popula esse volume é o `download_models.sh`. E aqui está o buraco, medido:

**`download_models.sh` não aparece em lugar nenhum de
`.github/workflows/comfyui-worker.yml`.** O workflow faz build da imagem,
aponta o template para a tag nova e recicla os workers. Só isso. O pré-cache
continua sendo o que o cabeçalho do próprio script diz que é — *"Rodar 1x num
pod temporário com o volume montado"* — um passo **manual**, que nunca foi
rodado com o layout novo.

Ou seja: **o conserto mudou os modelos de endereço para um diretório vazio.**
A parte que subiu (imagem) e a parte que faz a mudança valer (popular o volume)
estavam no mesmo PR, mas só uma delas tem quem execute.

## 5. Por que piora a cada tentativa, e por que não se cura sozinho

O loader (`fantasytalking/nodes.py:52`, no commit fixado `088128b22424`) faz:

```
model_path = os.path.join(folder_paths.models_dir, "transformers", model)
if not os.path.exists(model_path):
    snapshot_download(..., local_dir=model_path, ...)
```

Ele testa **existência do diretório** e pula o download quando existe — **sem
conferir conteúdo**. O commit do PR #190 descreve exatamente esse mecanismo
("arquivo PARCIAL é pior que arquivo AUSENTE ... envenena o worker de forma
permanente") e a ronda das 18h avisou em cima da hora ("cada tentativa é uma
chance de deixar diretório pela metade no volume persistente").

**As durações batem com o veneno acontecendo ao vivo:**

- **24,465s** na 1ª: caminho não existia, entrou em `snapshot_download` e não
  terminou;
- **3,655s** na 2ª: o diretório **agora existe** (parcial), o download é
  **pulado**, e a falha vira instantânea.

Isso é o mesmo desenho do apagão original — em 15h o diretório
`/comfyui/models/transformers/...` também *existia e estava vazio*. A diferença
é que antes o estrago morria com o worker; **agora ele mora num volume
permanente e sobrevive a reciclagem.**

## 6. O que eu NÃO consegui separar — e não vou fingir que consegui

O `NoneType` do nó 194 pode vir de **dois** lugares, e os dois foram realocados
para o volume vazio pelo **mesmo** PR:

- `wav2vec_model` (vem do nó 137) → estoura na 1ª linha do `process()`;
- o `waveform` do `audio_1` (vem do nó 170, Demucs/`TORCH_HOME`) → estoura em
  `audio_input[0][0]`.

Separar exige o **log do worker**, que a REST do RunPod não expõe (testei três
rotas, `404`/`400`), ou o volume montado. **Não decidi entre os dois e não
escrevi no incidente como se tivesse decidido.** Não muda a ação necessária:
os dois caminhos precisam ser populados no mesmo pod.

## 7. Entrega desta ronda

Não subi código: o conserto que falta **não é código**, é rodar o pré-cache num
pod com o volume montado — custa pod/GPU e está fora do meu mandato.

- Nota longa no `85c9a45a` (a raiz), com a medição inteira e o que falta.
- `559c676a` (Renata) `open` → `investigating`, com nota e o dinheiro conferido.
- Dois avisos no grupo: o urgente na hora (aluna pagante travada) e o
  diagnóstico com o pedido de "pode".

**Renata é pagante**, não trial: `pagou_de_verdade` mostra 2 compras avulsas
`COMPLETE`, R$ 2.116,92 (Fábrica de Conteúdo Invisível e Comunidade Presença
Lucrativa). A assinatura FastCloner dela é de 30/08 a R$ 0 — pela ordem de
18/08 (`#173`), isso **não** é "nunca pagou"; é decisão comercial, não de script.

**Não escrevi pra ela.** A causa depende de ação no volume e eu não tenho prazo
pra prometer. Se a próxima ronda passar sem conserto, ela merece a verdade mesmo
sem solução — foi o silêncio que fez a Viviana explodir.

## 8. `#265`: o prazo é AMANHÃ

O **PR #191 continua aberto**. A ronda das 18h deixou escrito que, sem merge
até **06/09**, a `katiasalvador32@` perde a janela de garantia e o sistema segue
dizendo FORA a quem está DENTRO. **É amanhã.** Não repeti o pedido no grupo
(pedir de novo 1h depois é pressão, não informação, e foi a régua que apliquei
ao Carlos Augusto), mas registro aqui para não sumir: **o único passo que falta
é o merge.**

## 9. Próxima ronda começa por aqui

1. **`gh pr list` primeiro.** Quinta seguida em que paga.
2. **Vídeo Clone: o volume foi populado?** Só vale geração `ready` no banco.
   Se o Johnny liberou o pod: conferir que os diretórios **parciais** de
   `transformers` **e** de `torch` foram APAGADOS antes do download — publicar
   por cima do parcial mantém o veneno.
3. **Se ainda não foi populado**, o número que importa é quantas tentativas
   novas de aluno aconteceram: cada uma é uma pessoa frustrada e uma chance de
   aprofundar o diretório pela metade.
4. **Conserto estrutural que vale um PR** (não feito hoje, proposto): o
   `deploy-runpod` sobe imagem nova sem nenhuma garantia de que o volume tem o
   que a imagem passou a exigir. Enquanto for assim, esta classe volta. As duas
   pontas: o CI conferir/rodar o pré-cache, e o worker **falhar alto** quando o
   diretório existe mas está incompleto, em vez de pular o download.
5. **`#191` mergeou?** Se passou de 06/09 sem merge, a Katia perdeu a janela —
   escreva isso, não deixe sumir.
6. **Item repetido de ronda anterior só entra depois de reler a última nota do
   card** (regra que a ronda das 18h criou depois de carregar um morto).
7. Continuam parados com o Johnny, sem repetir o pedido: migration 82 (`#15`),
   pod pra popular o volume (Vídeo Clone), renovação-reabre-garantia (`#265`),
   proposta do Jackson (`#254`).

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início. Fila lida
pela varredura, não pela caixa do `suporte@` (ordem de 19/08). Estorno em dia
(10 tipos, 2.826 linhas, nenhum tipo desconhecido). Duas notas via
`anotar_incidente.cjs` (`85c9a45a`, `559c676a`), as duas conferidas na releitura
em 1 linha afetada. Nada da planilha foi lido, escrito ou reprocessado (ordem de
29/08). Não mergeei PR, não apliquei migration, não mexi em crédito, não
estornei e não gastei GPU. Avisos no grupo pelo `notify-grupo.sh` (ordem de
31/08); nada no privado do Johnny.
