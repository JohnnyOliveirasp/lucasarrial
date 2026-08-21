"""Download/carga do modelo base e liberacao de VRAM."""
from __future__ import annotations

from huggingface_hub import snapshot_download

from worker_config import MODEL_DIR, MODEL_ID
from worker_log import log as _log

_MODEL = None  # voxcpm.core.VoxCPM, carregado lazy para inferência


def ensure_model_downloaded() -> None:
    if MODEL_DIR.exists() and any(MODEL_DIR.glob("*.safetensors")):
        return
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    _log("info", "model.download.start", model=MODEL_ID, dir=str(MODEL_DIR))
    snapshot_download(repo_id=MODEL_ID, local_dir=str(MODEL_DIR))
    _log("info", "model.download.done", dir=str(MODEL_DIR))



# NOTA (refator 20/08): nada chama load_model hoje — a inferencia carrega o
# VoxCPM ela mesma porque precisa passar lora_config. Mantido como estava; se
# for pra sumir, some numa mudanca propria, nao escondido num refator.
def load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    from voxcpm import VoxCPM
    ensure_model_downloaded()
    _log("info", "model.load.start", dir=str(MODEL_DIR))
    _MODEL = VoxCPM.from_pretrained(str(MODEL_DIR), load_denoiser=False, optimize=True)
    _log("info", "model.load.done", sample_rate=_MODEL.tts_model.sample_rate)
    return _MODEL


def free_cuda() -> None:
    """Solta a VRAM de modelos carregados por chamada (inferência/amostra).

    O worker é QUENTE e serve treino + inferência no mesmo processo: sem esta
    limpeza, os modelos acumulam na GPU e o treino que cair num worker saturado
    morre de OOM (visto em prod 21/07: GPU de 95GB com 18MiB livres)."""
    import gc
    gc.collect()
    try:
        import torch
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
    except Exception:
        pass
