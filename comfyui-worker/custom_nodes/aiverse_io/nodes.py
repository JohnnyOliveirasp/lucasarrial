# -*- coding: utf-8 -*-
"""
Nodes de I/O da plataforma (aiverse):
- LoadImageFromURL / LoadAudioFromURL: entrada via URL presignada (R2),
  sem trafegar base64 pela API do RunPod.
- UploadVideoToS3: sobe o MP4 do VHS_VideoCombine pro R2 numa chave
  deterministica (o app calcula a URL final sozinho). Falhou upload -> job FAILED.

O handler do runpod/worker-comfyui fica INTOCADO (so coleta 'images';
video/audio saem/entram por aqui).
"""
import os
import urllib.request

import numpy as np
import torch


def _download(url: str, dest: str):
    req = urllib.request.Request(url, headers={"User-Agent": "aiverse-worker/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)


class LoadImageFromURL:
    CATEGORY = "aiverse"
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "load"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"url": ("STRING", {"default": ""})}}

    def load(self, url):
        from PIL import Image, ImageOps
        import folder_paths
        dest = os.path.join(folder_paths.get_input_directory(), "aiverse_input_image")
        _download(url, dest)
        img = Image.open(dest)
        img = ImageOps.exif_transpose(img).convert("RGB")
        arr = np.array(img).astype(np.float32) / 255.0
        return (torch.from_numpy(arr)[None,],)


class LoadAudioFromURL:
    CATEGORY = "aiverse"
    RETURN_TYPES = ("AUDIO",)
    FUNCTION = "load"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"url": ("STRING", {"default": ""})}}

    def load(self, url):
        import torchaudio
        import folder_paths
        dest = os.path.join(folder_paths.get_input_directory(), "aiverse_input_audio")
        _download(url, dest)
        waveform, sample_rate = torchaudio.load(dest)
        return ({"waveform": waveform.unsqueeze(0), "sample_rate": sample_rate},)


class UploadVideoToS3:
    CATEGORY = "aiverse"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("s3_key",)
    FUNCTION = "upload"
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "filenames": ("VHS_FILENAMES",),
                "s3_key": ("STRING", {"default": "videos/output.mp4"}),
            }
        }

    def upload(self, filenames, s3_key):
        import boto3
        endpoint = os.environ["BUCKET_ENDPOINT_URL"]
        bucket = os.environ["BUCKET_NAME"]
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=os.environ["BUCKET_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["BUCKET_SECRET_ACCESS_KEY"],
            region_name="auto",
        )
        # filenames = (save_output_flag, [lista de arquivos]); ultimo = video final
        files = filenames[1] if isinstance(filenames, (tuple, list)) else []
        videos = [f for f in files if str(f).endswith((".mp4", ".webm", ".mov"))]
        if not videos:
            raise RuntimeError(f"UploadVideoToS3: nenhum video em {files!r}")
        src = videos[-1]
        s3.upload_file(src, bucket, s3_key, ExtraArgs={"ContentType": "video/mp4"})
        print(f"[aiverse] upload ok: s3://{bucket}/{s3_key} ({os.path.getsize(src)} bytes)")
        return (s3_key,)


NODE_CLASS_MAPPINGS = {
    "AiverseLoadImageFromURL": LoadImageFromURL,
    "AiverseLoadAudioFromURL": LoadAudioFromURL,
    "AiverseUploadVideoToS3": UploadVideoToS3,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AiverseLoadImageFromURL": "Load Image From URL (aiverse)",
    "AiverseLoadAudioFromURL": "Load Audio From URL (aiverse)",
    "AiverseUploadVideoToS3": "Upload Video To S3 (aiverse)",
}
