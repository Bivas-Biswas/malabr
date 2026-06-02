import os
from dataclasses import dataclass


# Centralized runtime configuration for the ML server process.
@dataclass(frozen=True)
class ServerConfig:
    socket_path: str
    base_dir: str
    model_dir: str
    db_path: str
    trainer_workers: int
    inference_workers: int
    train_queue_maxsize: int
    model_cache_size: int
    model_ready_wait_sec: float
    model_ready_poll_sec: float
    train_memory_limit_mb: int
    train_cpu_time_limit_sec: int


def load_config(base_dir=None):
    # Resolve project root once so all paths are derived consistently.
    root = base_dir or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return ServerConfig(
        socket_path=os.getenv("MALABR_SOCKET_PATH", "/tmp/malabr_v3.sck"),
        base_dir=root,
        model_dir=os.path.join(root, "models"),
        db_path=os.path.join(root, "malabr.db"),
        trainer_workers=int(os.getenv("MALABR_TRAINER_WORKERS", "20")),
        inference_workers=int(os.getenv("MALABR_INFERENCE_WORKERS", "8")),
        train_queue_maxsize=int(os.getenv("MALABR_TRAIN_QUEUE_MAXSIZE", "1000")),
        model_cache_size=int(os.getenv("MALABR_MODEL_CACHE_SIZE", "64")),
        model_ready_wait_sec=float(os.getenv("MALABR_MODEL_READY_WAIT_SEC", "2.0")),
        model_ready_poll_sec=float(os.getenv("MALABR_MODEL_READY_POLL_SEC", "0.05")),
        train_memory_limit_mb=int(os.getenv("MALABR_TRAIN_MEMORY_LIMIT_MB", "2048")),
        train_cpu_time_limit_sec=int(
            os.getenv("MALABR_TRAIN_CPU_TIME_LIMIT_SEC", "120")
        ),
    )
