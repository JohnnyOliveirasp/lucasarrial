# Ronda das falhas — 05/09/2026 ~20:40–21:00Z (Frank, dono da fila)

Fila no início: **29 abertos + 13 aguardando aluno** (eram 27+13 às 19h50). No
fim: **28 abertos** — fechei um, que era duplicata.

**Resultado: o Vídeo Clone piorou (10 falhas novas em 1h, 0 sucesso há ~9h30) e
eu separei o que a ronda das 19h disse explicitamente que não tinha conseguido
separar. A resposta contraria a leitura mais óbvia: a metade do PR #190 que
subiu FUNCIONOU. Quem está quebrado é a outra metade do mesmo PR, a do Demucs.
E o passo que falta pode ser executado direto, sem limpeza manual — conferi.**

---

## 1. `gh pr list` primeiro — sexta ronda seguida em que paga

21 PRs abertos. **`#191` (garantia, `#265`) CONTINUA ABERTO.** Item 8 abaixo.

## 2. O Vídeo Clone não voltou, e está acelerando

A ronda das 19h mediu 2 falhas pós-deploy e se recusou, com razão, a chamar
aquilo de conclusivo. Agora tem volume:

| janela | tentativas | `ready` |
|---|---|---|
| desde o deploy (≥18:30Z) | **10** | **0** |
| dia 05/09 inteiro | 26 | 7 (nenhum depois das 11h26Z) |
| 01–04/09 (referência) | 234 | 233 |

- **Último sucesso: 11:26:49Z.** Primeira falha sobrevivente: **15:04:47Z**.
  O vigia das 18h mediu o início em 14:45:47Z; a diferença são linhas
  **apagadas pelo próprio aluno**, o que ele mesmo já registrou em `86c4b9d`.
  Ou seja: **~9h30 sem uma única entrega**, e as 8 falhas mais recentes
  aconteceram na última hora.
- Alunos atingidos hoje: `costa.anaelson` (6), `rafaluanravi29` (5),
  `renatarcpsi` (4), `lux.neuropsi` (3), `ederonline1` (1).

**Dinheiro certo, conferido um a um e não por atacado:** 1 linha
`ref_type='video_clone_refund'` casada por `ref_id` para **cada** uma das 10
gerações, valor exato. A régua é o `ref_type`, nunca o `kind` (armadilha de
20/08).

## 3. Não é worker envenenado. É o volume.

A falha das 19h saiu no worker `htl8vydte03ihh`. A de 20:29:58Z (job
`06702f36…-e2`) saiu no worker **`w2yfqkpmzijubn`** — outro worker — com a
mensagem **idêntica**:

> `Workflow execution error: Node Type: MultiTalkWav2VecEmbeds, Node ID: 194,`
> `Message: 'NoneType' object is not subscriptable`

Isso encerra a dúvida que sobrava: **reciclar worker não cura**, porque o estado
ruim mora no network volume `ff442v3132` (80GB, EU-NL-1), que sobrevive à
reciclagem. Era exatamente o risco que a ronda das 18h levantou.

## 4. Separei os dois suspeitos — e não é o wav2vec

A ronda das 19h escreveu, corretamente, que o `NoneType` do nó 194 podia vir de
dois lugares realocados pelo mesmo PR, e que **não decidiu entre eles**. Decidi,
lendo a fonte no pin `088128b22424`:

1. **`fantasytalking/nodes.py` (nó 137, `DownloadAndLoadWav2VecModel`)** — todo
   caminho ou **levanta exceção** ou **retorna um dict montado na mão**. Ele
   **não tem como devolver `None`**. Como o nó 137 parou de estourar depois do
   deploy, o modelo **carregou de verdade**: a metade do symlink do PR #190
   **pegou**.
2. **`multitalk/nodes.py:178+` (nó 194, `process`)** — o primeiro subscript é
   `wav2vec_model["model_type"]`, que pelo item 1 não é `None`; e `audio_1=None`
   é **filtrado antes do uso** (`[a for a in audio_inputs if a is not None]`),
   então entrada ausente **não produz** esta exceção.
3. Sobra **um** lugar: `audio_input = audio["waveform"]` vindo `None` e
   estourando em `audio_input[0][0]`.

E o template v3 liga `audio_1` na **saída 3 do nó 170** (`AudioSeparation` =
Demucs, saída 3 = *vocals*). Portanto o suspeito vivo é a metade
**`TORCH_HOME=/runpod-volume/torch`** do PR #190 — a que nunca foi populada —
**não a do wav2vec**.

**Ressalva honesta:** isto é leitura de código + eliminação, **não** log do
worker. A REST do RunPod não expõe o log (404/400 em três rotas) e job com mais
de ~1h some do `/status` — dos 10 jobs, só 1 ainda respondia. Não muda a ação
necessária, porque o pré-cache cobre os dois caminhos; muda **onde olhar
primeiro** se a ação não resolver.

## 5. O pré-cache é seguro contra o estado envenenado — era a pergunta da ronda anterior

A ronda das 19h deixou como item 2 do checklist: *"conferir que os diretórios
parciais de `transformers` e de `torch` foram APAGADOS antes do download —
publicar por cima do parcial mantém o veneno."* **Conferido em
`comfyui-worker/scripts/download_models.sh`, e o script já faz isso sozinho:**

- **wav2vec** — monta em `$M/transformers/.tmp-wav2vec.$$`, só publica depois de
  conferir o tamanho de `pytorch_model.bin` (380.261.837) + `config.json` +
  `preprocessor_config.json`, e faz **`rm -rf "$WAV2VEC_DIR"` antes** do `mv`
  atômico.
- **Demucs** — `dl()` para
  `$VOLUME/torch/hub/torchaudio/models/hdemucs_high_trained.pt`, com `rm -f` e
  rebaixa quando o tamanho diverge.

**Não precisa de limpeza manual antes.** `VOLUME=/runpod-volume bash
download_models.sh` num pod com o `ff442v3132` montado cobre as duas metades.
Isso tira o último "mas será que funciona?" da frente da decisão do Johnny.

## 6. Duas hipóteses testadas e DESCARTADAS (pra ninguém gastar tempo nelas)

1. **"O HuggingFace passou a bloquear o modelo."** Falso.
   `TencentGameMate/chinese-wav2vec2-base` responde 200, `private=false`,
   `gated=false`, `disabled=false`, `lastModified` 2022-06-24; os três arquivos
   resolvem 200 anônimos.
2. **"Foi um deploy que quebrou."** Falso. O `comfyui-worker.yml` só dispara em
   push a `comfyui-worker/**`; o build anterior ao de hoje foi em **2026-08-07**
   (run `31228301766`). A imagem era a mesma há um mês, e entre o último sucesso
   (11h26Z) e a primeira falha não houve build nenhum. Bate com o diagnóstico do
   próprio PR #190: só funcionava com **worker quente** que já tinha baixado em
   runtime, e morre na primeira reciclagem.

## 7. Entrega desta ronda

Não subi código: o que falta **não é código**, é rodar o pré-cache num pod com o
volume montado — custa pod/GPU e está fora do meu mandato.

- **`#277` (`209d821a`) FECHADO** como duplicata do `#275`: mesma aluna
  (`renatarcpsi`), mesmas 3 gerações (`89d2807a`, `4c057929`, `1e82d959`).
  Estorno conferido por `ref_type` nas três (8.715 cr cada, valor exato).
  **Não reescrevi pra ela**: já tinha sido avisada por e-mail às **20:28:14Z**
  (Enviados uid 1090), e o e-mail saiu **antes** deste card existir (20:30:57Z) e
  antes das duas últimas tentativas dela. Aviso repetido em 1h é ruído, não
  informação — mesma régua que a ronda das 19h aplicou ao Carlos Augusto.
  `ignored` aqui significa *"não tem dono separado"*, e a nota diz isso com
  todas as letras: **nada nesse caso está resolvido**.
- Nota longa no `#266` (`85c9a45a`, a raiz) com os itens 2 a 6 acima.
- Conferi que os dois alunos que mais sofreram hoje (`renatarcpsi`,
  `costa.anaelson`) **já foram avisados** às 20:28Z — a ronda das 19h tinha
  deixado isso pendente e a ronda das 20h fechou o buraco. Não dupliquei.
- `costa.anaelson` **é pagante e pagou hoje**: assinatura FastCloner R$ 97
  `APPROVED` em **05/09** (`HP1691462235`), além de avulsa de US$ 65,72
  `COMPLETE` em 28/08. Ele pagou hoje e não conseguiu usar hoje.

## 8. `#265`: o prazo é HOJE/AMANHÃ e o PR #191 continua aberto

Terceira ronda seguida registrando: o único passo que falta é o **merge do
`#191`**. Sem ele até **06/09**, a `katiasalvador32@` perde a janela de garantia
e o sistema segue dizendo FORA a quem está DENTRO. **Não repeti o pedido no
grupo** (pedir de novo 1h depois é pressão, não informação), mas se amanhã
passar sem merge isso deixa de ser pendência e vira **prejuízo consumado** — e
nesse caso tem que ser escrito assim, não sumir.

## 9. Próxima ronda começa por aqui

1. **`gh pr list` primeiro.** Sexta seguida em que paga.
2. **O volume foi populado?** Só vale geração `ready` no banco — não vale health
   do RunPod, não vale PR mergeado, não vale deploy verde. Se foi populado e
   AINDA falhar no nó 194, o item 4 diz onde olhar: **Demucs/`TORCH_HOME`**, não
   wav2vec.
3. **Se ainda não foi populado**, conte quantas tentativas novas de aluno
   aconteceram desde as 20h30Z. Foram 10 na última hora; se o número continuar
   subindo, o custo humano do "esperar" está aumentando e isso é informação.
4. **Ninguém precisa mais conferir se o script apaga o parcial** — item 5, já
   respondido e provado. Não refazer esse trabalho.
5. **Conserto estrutural que vale um PR** (proposto na ronda das 19h, segue não
   feito): o `deploy-runpod` sobe imagem nova sem nenhuma garantia de que o
   volume tem o que a imagem passou a exigir. As duas pontas: o CI conferir/rodar
   o pré-cache, e o worker **falhar alto** quando o diretório existe mas está
   incompleto, em vez de pular o download. Enquanto for assim, esta classe volta.
6. **`#191` mergeou?** Se passou de 06/09 sem merge, a Katia **perdeu** a janela
   — escreva isso, não deixe sumir.
7. **Item repetido de ronda anterior só entra depois de reler a última nota do
   card** (regra da ronda das 18h). Foi ela que evitou eu reescrever pra Renata
   hoje.
8. Continuam parados com o Johnny, sem repetir o pedido: migration 82 (`#15`),
   pod pra popular o volume (Vídeo Clone), renovação-reabre-garantia (`#265`),
   proposta do Jackson (`#254`).

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início. Fila lida
pela varredura, não pela caixa do `suporte@` (ordem de 19/08) — a única leitura
da caixa foi `--enviados` pra **não** duplicar aviso a aluno. Estorno em dia (10
tipos, 2.836 linhas, nenhum tipo desconhecido). Duas gravações via
`anotar_incidente.cjs` (`85c9a45a`, `209d821a`), as duas conferidas na releitura
em 1 linha afetada. Nada da planilha foi lido, escrito ou reprocessado (ordem de
29/08). Não mergeei PR, não apliquei migration, não mexi em crédito, não
estornei, não gastei GPU e não escrevi pra aluno (já estavam avisados). Aviso no
grupo pelo `notify-grupo.sh` (ordem de 31/08); nada no privado do Johnny.
