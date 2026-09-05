# Worker ComfyUI (InfiniteTalk / Wan2.1 I2V) — RunPod Serverless
# Base oficial: handler pronto (workflow API JSON -> /run). CUDA 12.8 p/ sageattention.
FROM runpod/worker-comfyui:5.8.6-base-cuda12.8.1

# --- Custom nodes do fluxo (git pinado; o pacote do Comfy Registry veio sem os
#     nodes MultiTalk/InfiniteTalk — smoke test 2026-07-08 falhou MultiTalkModelLoader) ---
RUN set -e; cd /comfyui/custom_nodes; \
    git clone https://github.com/kijai/ComfyUI-WanVideoWrapper.git && \
      git -C ComfyUI-WanVideoWrapper checkout 088128b22424 && \
      pip install --no-cache-dir -r ComfyUI-WanVideoWrapper/requirements.txt; \
    git clone https://github.com/kijai/ComfyUI-KJNodes.git && \
      git -C ComfyUI-KJNodes checkout bc8e4ce4254b && \
      pip install --no-cache-dir -r ComfyUI-KJNodes/requirements.txt; \
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git && \
      git -C ComfyUI-VideoHelperSuite checkout 4ee72c065db2 && \
      pip install --no-cache-dir -r ComfyUI-VideoHelperSuite/requirements.txt; \
    git clone https://github.com/christian-byrne/audio-separation-nodes-comfyui.git && \
      git -C audio-separation-nodes-comfyui checkout ac339561973f && \
      pip install --no-cache-dir -r audio-separation-nodes-comfyui/requirements.txt

# --- Compilador C + headers Python (triton JIT do sageattention exige cc e Python.h) ---
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ libc6-dev python3-dev \
    && rm -rf /var/lib/apt/lists/*

# --- SageAttention (v1 = triton puro, sem nvcc; o fluxo usa attention_mode=sageattn) ---
RUN pip install --no-cache-dir sageattention==1.0.6 boto3==1.34.162

# --- transformers PINADO (incidente 85c9a45a — Video Clone 100% fora do ar em 05/09) ---
#
# O QUE ACONTECEU: os custom nodes acima estao pinados por SHA de git, mas as
# dependencias PYTHON deles nao. O requirements.txt do WanVideoWrapper@088128b22424
# nem sequer LISTA transformers — ele entra como dependencia transitiva, sem piso e
# sem teto. Consequencia: duas builds do MESMO Dockerfile, no mesmo commit, instalam
# transformers diferentes. A imagem de 07/08/2026 pegou 5.14.1; a rebuild de
# 05/09/2026 18:30Z (a PRIMEIRA em um mes) pegou 5.16.1.
#
# POR QUE ISSO QUEBRA: em 5.16.0 o Wav2Vec2Encoder.forward perdeu os parametros
# output_hidden_states / return_dict (viraram **kwargs: Unpack[TransformersKwargs])
# e o corpo parou de acumular estados intermediarios — a string "all_hidden_states"
# aparece 10x no arquivo em 5.14.1 e ZERO vezes em 5.16.1, e o retorno virou
# BaseModelOutput(last_hidden_state=hidden_states), sem o campo hidden_states.
# Cadeia exata da falha, medida na fonte dos pins:
#   transformers/models/wav2vec2/modeling_wav2vec2.py  -> encoder_outputs.hidden_states = None
#   ComfyUI-WanVideoWrapper/multitalk/wav2vec2.py:78   -> BaseModelOutput(hidden_states=None)
#   ComfyUI-WanVideoWrapper/multitalk/nodes.py:248     -> embeddings.hidden_states[1:]
#     => "Node Type: MultiTalkWav2VecEmbeds, Node ID: 194,
#         Message: 'NoneType' object is not subscriptable"
#
# NAO era o Demucs nem o TORCH_HOME. O node AudioSeparation (id 170) levanta
# RuntimeError explicito quando o checkpoint falta ou esta corrompido, e o
# sources_to_tuple() dele SEMPRE monta waveform de verdade — checkpoint ausente
# apareceria como erro no no 170, nunca como NoneType no 194. Idem o no 137, que ou
# levanta ou devolve dict montado na mao. Popular o volume nao curaria esta falha.
#
# 5.14.1 e a ultima antes do 5.15.0 (10/08) e e exatamente a que rodou 233 de 234
# geracoes entre 01 e 04/09. Ao subir este pin de proposito, confira a montagem do
# hidden_states no wav2vec2 da versao alvo — o smoke test abaixo faz isso sozinho.
RUN pip install --no-cache-dir "transformers==5.14.1"

# --- Smoke test de BUILD: falhar aqui e barato, falhar em producao custa aluno ---
# A build so passa se o contrato que o node 194 depende continuar de pe. Sem isto,
# o proximo bump silencioso de transformers volta a derrubar o Video Clone inteiro
# e so descobrimos pelo aluno reclamando (10h de fila em 05/09).
RUN python3 -c "\
import inspect, transformers;\
from transformers.models.wav2vec2.modeling_wav2vec2 import Wav2Vec2Encoder;\
p = inspect.signature(Wav2Vec2Encoder.forward).parameters;\
src = inspect.getsource(Wav2Vec2Encoder.forward);\
assert 'output_hidden_states' in p, \
  'transformers %s: Wav2Vec2Encoder.forward nao aceita mais output_hidden_states -> multitalk/nodes.py:248 vai estourar NoneType no no 194' % transformers.__version__;\
assert 'all_hidden_states' in src, \
  'transformers %s: Wav2Vec2Encoder.forward nao acumula mais all_hidden_states -> encoder_outputs.hidden_states volta None' % transformers.__version__;\
print('smoke ok: transformers', transformers.__version__, 'preserva hidden_states para o no 194')"

# --- Nodes de I/O da plataforma (entrada via URL R2, saida MP4 -> R2) ---
COPY custom_nodes/aiverse_io /comfyui/custom_nodes/aiverse_io

# --- Modelos ficam no Network Volume (/runpod-volume/models/...) ---
# O yaml cobre SO as categorias registradas do ComfyUI (checkpoints, loras, vae...).
COPY extra_model_paths.yaml /comfyui/extra_model_paths.yaml

# --- Ponte para os modelos que NAO passam pelo extra_model_paths.yaml ---
# Incidente 85c9a45a (05/09/2026): o node DownloadAndLoadWav2VecModel resolve o
# caminho com os.path.join(folder_paths.models_dir, "transformers", model)
# (ComfyUI-WanVideoWrapper@088128b22424, fantasytalking/nodes.py:52). Como o
# start.sh da imagem base sobe o ComfyUI sem --base-directory / --models-directory,
# folder_paths.models_dir e /comfyui/models — diretorio EFEMERO do container. O node
# nao consulta folder_paths.get_folder_paths(), entao por definicao o yaml acima nao
# tem como redirecionar isso: a unica ponte possivel e este symlink.
# Sem ele o modelo era baixado em runtime e sumia em toda reciclagem do worker.
RUN rm -rf /comfyui/models/transformers \
    && mkdir -p /comfyui/models \
    && ln -s /runpod-volume/models/transformers /comfyui/models/transformers

# Cache HF persistido no volume (nao cobre o node acima: ele usa local_dir proprio)
ENV HF_HOME=/runpod-volume/hf

# Cache do torch.hub no volume. O node AudioSeparation carrega o Demucs via
# torchaudio.utils._download_asset, que grava em torch.hub.get_dir()/torchaudio/...
# e pula o download se o caminho existir. Sem isto o destino e /root/.cache/torch
# (efemero) e o Demucs cai na primeira reciclagem, igual ao wav2vec.
ENV TORCH_HOME=/runpod-volume/torch
