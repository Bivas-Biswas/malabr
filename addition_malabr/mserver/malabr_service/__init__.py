"""Reusable server components for the Malabr runtime."""

from .runtime import run_server

# Keep public package surface minimal for embedders.
__all__ = ["run_server"]
