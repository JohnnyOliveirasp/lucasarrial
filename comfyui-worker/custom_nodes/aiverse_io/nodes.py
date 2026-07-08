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


def _f32_pcm(wav: "torch.Tensor") -> "torch.Tensor":
    """int PCM -> float32 [-1, 1] (mesma normalizacao do LoadAudio do ComfyUI)."""
    if wav.dtype.is_floating_point:
        return wav
    if wav.dtype == torch.int16:
        return wav.float() / (2 ** 15)
    if wav.dtype == torch.int32:
        return wav.float() / (2 ** 31)
    raise ValueError(f"Unsupported wav dtype: {wav.dtype}")


def _decode_audio_av(path: str):
    """Decodifica audio (mp3/wav/etc) com PyAV — como o LoadAudio nativo do
    ComfyUI. Evita torchaudio.load, que no torchaudio novo exige torchcodec."""
    import av
    with av.open(path) as af:
        if not af.streams.audio:
            raise ValueError("Nenhuma stream de audio no arquivo")
        stream = af.streams.audio[0]
        sample_rate = stream.codec_context.sample_rate
        n_channels = stream.channels or 1
        frames = []
        for frame in af.decode(streams=stream.index):
            buf = torch.from_numpy(frame.to_ndarray())
            if buf.ndim == 1:
                buf = buf[None, :]
            if buf.shape[0] != n_channels:
                # formato packed/interleaved -> (channels, samples)
                buf = buf.view(-1, n_channels).t()
            frames.append(buf)
        if not frames:
            raise ValueError("Nenhum frame de audio decodificado")
        return _f32_pcm(torch.cat(frames, dim=1)), sample_rate


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
        import folder_paths
        dest = os.path.join(folder_paths.get_input_directory(), "aiverse_input_audio")
        _download(url, dest)
        waveform, sample_rate = _decode_audio_av(dest)
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
