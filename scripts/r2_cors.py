"""Aplica CORS policy nos buckets R2 pra permitir upload/download direto do browser.

Sem isso, o browser bloqueia o PUT presigned (erro de CORS aparece como
'failed to upload' no XHR).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import boto3
from botocore.client import Config
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "https://aiverse.jcsolutionsus.com",
]

CORS_RULES = {
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "HEAD"],
            "AllowedOrigins": ALLOWED_ORIGINS,
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3600,
        }
    ]
}


def client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def main() -> int:
    s3 = client()
    buckets = [os.environ["R2_BUCKET_VOICES"], os.environ["R2_BUCKET_GENERATIONS"]]

    for bucket in buckets:
        s3.put_bucket_cors(Bucket=bucket, CORSConfiguration=CORS_RULES)
        print(f"[{bucket}] CORS aplicado")
        # Verifica
        resp = s3.get_bucket_cors(Bucket=bucket)
        rules = resp.get("CORSRules", [])
        print(f"[{bucket}] origins permitidos: {rules[0]['AllowedOrigins']}")
        print(f"[{bucket}] métodos: {rules[0]['AllowedMethods']}")

    print("\nOK — CORS configurado nos 2 buckets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
