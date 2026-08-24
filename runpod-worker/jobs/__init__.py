"""Um arquivo por tipo de job que o worker atende.

Saiu do handler.py em 20/08: `handler.py` virou so o despachante, e cada job
passou a morar no seu proprio modulo.
"""
from .inference import handle_inference
from .train import handle_train
from .transcribe import handle_transcribe

__all__ = ["handle_inference", "handle_train", "handle_transcribe"]
