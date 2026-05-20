"""Testa conexão com Cloudflare R2 e valida buckets.

Faz:
1. Lista buckets da conta
2. PUT de um arquivo dummy em cada bucket
3. GET (download) pra confirmar leitura
4. DELETE pra limpar
5. Gera uma presigned URL de exemplo
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

R2_ACCOUNT_ID = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_ACCESS_KEY = os.environ["R2_SECRET_ACCESS_KEY"]
R2_ENDPOINT = os.environ["R2_ENDPOINT"]
R2_BUCKET_VOICES = os.environ["R2_BUCKET_VOICES"]
R2_BUCKET_GENERATIONS = os.environ["R2_BUCKET_GENERATIONS"]


def make_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def test_head_bucket(s3, bucket: str) -> bool:
    """Token escopo Object não tem ListBuckets — usa HeadBucket por bucket."""
    try:
        s3.head_bucket(Bucket=bucket)
        print(f"[head_bucket] {bucket}: OK (acessível)")
        return True
    except Exception as exc:
        print(f"[head_bucket] {bucket}: FALHOU ({exc})")
        return False


def test_put_get_delete(s3, bucket: str) -> None:
    key = "__r2_test_smoke__.txt"
    body = b"hello from platform-lucas r2 smoke test"

    s3.put_object(Bucket=bucket, Key=key, Body=body, ContentType="text/plain")
    print(f"[{bucket}] PUT ok")

    got = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
    assert got == body, f"GET retornou bytes diferentes: {got!r}"
    print(f"[{bucket}] GET ok ({len(got)} bytes)")

    s3.delete_object(Bucket=bucket, Key=key)
    print(f"[{bucket}] DELETE ok")


def test_presigned_url(s3, bucket: str) -> None:
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": "demo/test.wav", "ContentType": "audio/wav"},
        ExpiresIn=3600,
    )
    print(f"[{bucket}] presigned PUT URL gerada ({len(url)} chars, expira em 1h)")


def main() -> int:
    print("=" * 60)
    print("R2 smoke test — Cloudflare R2 / boto3")
    print("=" * 60)
    print(f"Endpoint: {R2_ENDPOINT}")
    print(f"Buckets esperados: {R2_BUCKET_VOICES}, {R2_BUCKET_GENERATIONS}")
    print()

    s3 = make_client()

    for bucket in (R2_BUCKET_VOICES, R2_BUCKET_GENERATIONS):
        if not test_head_bucket(s3, bucket):
            return 2

    for bucket in (R2_BUCKET_VOICES, R2_BUCKET_GENERATIONS):
        print(f"\n--- Testando bucket: {bucket} ---")
        test_put_get_delete(s3, bucket)
        test_presigned_url(s3, bucket)

    print("\n" + "=" * 60)
    print("TUDO OK — R2 conectado, buckets acessíveis, presigned URLs funcionam")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
