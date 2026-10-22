"""记忆网关与检索索引共享底座。"""
from .gateway import INF_TURN, MemoryGateway
from .text_index import extract_features, score_shared_features

__all__ = ["INF_TURN", "MemoryGateway", "extract_features", "score_shared_features"]
