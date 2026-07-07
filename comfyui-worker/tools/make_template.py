# -*- coding: utf-8 -*-
"""
Gera o template de producao a partir do workflow API convertido:
- LoadImage  -> AiverseLoadImageFromURL  (url = {{IMAGE_URL}})
- LoadAudio  -> AiverseLoadAudioFromURL  (url = {{AUDIO_URL}})
- + AiverseUploadVideoToS3 na saida do VHS_VideoCombine (s3_key = {{S3_KEY}})
Placeholders {{...}} sao preenchidos pelo app a cada job (junto com
width/height/modelo/lora por tier e num_frames pelo tamanho do audio).

Uso: python make_template.py <api.json> <template.json>
"""
import json
import sys


def main():
    api = json.load(open(sys.argv[1], encoding="utf-8"))

    swaps = {"LoadImage": ("AiverseLoadImageFromURL", "{{IMAGE_URL}}"),
             "LoadAudio": ("AiverseLoadAudioFromURL", "{{AUDIO_URL}}")}
    for nid, node in api.items():
        if node["class_type"] in swaps:
            new_class, placeholder = swaps[node["class_type"]]
            api[nid] = {"class_type": new_class, "inputs": {"url": placeholder}}

    combine_id = next(nid for nid, n in api.items()
                      if n["class_type"] == "VHS_VideoCombine")
    api["900"] = {
        "class_type": "AiverseUploadVideoToS3",
        "inputs": {"filenames": [combine_id, 0], "s3_key": "{{S3_KEY}}"},
    }

    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(api, f, ensure_ascii=False, indent=2)
    print(f"template com {len(api)} nodes -> {sys.argv[2]}")


if __name__ == "__main__":
    main()
