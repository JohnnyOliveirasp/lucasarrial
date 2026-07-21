"""Pipeline de treinamento de voz para o worker RunPod.

Portado de _backup_apenasReferencia/VoiceLoraStudio/voice_lora_studio/core.py
adaptado para ambiente cloud (sem Tkinter, sem subprocess wrapper pesado,
recebe URLs HTTP em vez de paths locais).
"""

from .r2 import download_to_dir, upload_file_to_presigned_url
from .preprocess import (
    extract_to_wav,
    separate_vocals_demucs,
    vad_segments_silero,
    chunk_vad_segments,
    cut_audio_by_segments,
)
from .training import (
    detect_language,
    transcribe_audio_folder,
    transcribe_file,
    build_train_manifest,
    create_training_config,
    run_training,
)
from .reference import (
    select_reference_clip,
    select_reference_candidates,
    score_reference_transcript,
)

__all__ = [
    "download_to_dir",
    "upload_file_to_presigned_url",
    "extract_to_wav",
    "separate_vocals_demucs",
    "vad_segments_silero",
    "chunk_vad_segments",
    "cut_audio_by_segments",
    "detect_language",
    "transcribe_audio_folder",
    "transcribe_file",
    "build_train_manifest",
    "create_training_config",
    "run_training",
    "select_reference_clip",
    "select_reference_candidates",
    "score_reference_transcript",
]
