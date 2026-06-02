import json
import sqlite3
import threading
import time


# Encapsulates all SQLite metadata reads/writes for models and jobs.
class MetadataStore:
    def __init__(self, db_path):
        self._lock = threading.Lock()
        self._db = sqlite3.connect(db_path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        # Initialize tables if database is first-time/empty.
        with self._lock:
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS clients (
                    client_id TEXT PRIMARY KEY,
                    status TEXT,
                    model_count INTEGER,
                    total_size INTEGER,
                    created_at REAL,
                    updated_at REAL,
                    last_seen_at REAL,
                    last_auth_at REAL
                )
                """
            )
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS models (
                    client_id TEXT,
                    model_id TEXT,
                    model_type TEXT,
                    model_name TEXT,
                    status TEXT,
                    error_msg TEXT,
                    model_path TEXT,
                    model_size INTEGER,
                    last_used_at REAL,
                    params_json TEXT,
                    updated_at REAL,
                    PRIMARY KEY(client_id, model_id),
                    FOREIGN KEY(client_id) REFERENCES clients(client_id)
                )
                """
            )
            # Remove legacy table; model status now tracks training lifecycle.
            self._db.execute("DROP TABLE IF EXISTS jobs")
            self._db.commit()

    def ensure_client(self, client_id, status="active"):
        now = time.time()
        with self._lock:
            self._db.execute(
                """
                INSERT INTO clients (client_id, status, model_count, total_size, created_at, updated_at, last_seen_at, last_auth_at)
                VALUES (?, ?, 0, 0, ?, ?, ?, ?)
                ON CONFLICT(client_id) DO NOTHING
                """,
                (client_id, status, now, now, now, now),
            )
            self._db.commit()

    def authorize_client(self, client_id):
        with self._lock:
            row = self._db.execute(
                "SELECT status FROM clients WHERE client_id = ?",
                (client_id,),
            ).fetchone()
        return row is not None and row["status"] == "active"

    def touch_client_activity(self, client_id, mark_auth=False):
        now = time.time()
        with self._lock:
            if mark_auth:
                self._db.execute(
                    """
                    UPDATE clients
                    SET last_seen_at = ?, last_auth_at = ?, updated_at = ?
                    WHERE client_id = ?
                    """,
                    (now, now, now, client_id),
                )
            else:
                self._db.execute(
                    """
                    UPDATE clients
                    SET last_seen_at = ?, updated_at = ?
                    WHERE client_id = ?
                    """,
                    (now, now, client_id),
                )
            self._db.commit()

    def _refresh_client_stats(self, client_id):
        row = self._db.execute(
            """
            SELECT COUNT(*) AS model_count, COALESCE(SUM(model_size), 0) AS total_size
            FROM models
            WHERE client_id = ?
            """,
            (client_id,),
        ).fetchone()
        self._db.execute(
            """
            UPDATE clients
            SET model_count = ?, total_size = ?, updated_at = ?
            WHERE client_id = ?
            """,
            (int(row["model_count"] or 0), int(row["total_size"] or 0), time.time(), client_id),
        )

    def upsert_model(self, client_id, model_id, model_type, model_name, status, error_msg, model_path, model_size, params, last_used_at=None):
        # Keep one latest row per model_id with upsert semantics.
        now = time.time()
        with self._lock:
            self._db.execute(
                """
                INSERT INTO models (client_id, model_id, model_type, model_name, status, error_msg, model_path, model_size, last_used_at, params_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(client_id, model_id) DO UPDATE SET
                    model_type=excluded.model_type,
                    model_name=excluded.model_name,
                    status=excluded.status,
                    error_msg=excluded.error_msg,
                    model_path=excluded.model_path,
                    model_size=excluded.model_size,
                    last_used_at=COALESCE(excluded.last_used_at, models.last_used_at),
                    params_json=excluded.params_json,
                    updated_at=excluded.updated_at
                """,
                (
                    client_id,
                    model_id,
                    model_type,
                    model_name,
                    status,
                    error_msg,
                    model_path,
                    int(model_size or 0),
                    last_used_at,
                    json.dumps(params or {}),
                    now,
                ),
            )
            self._refresh_client_stats(client_id)
            self._db.commit()

    def touch_model_last_used(self, client_id, model_id, last_used_at=None):
        used_ts = time.time() if last_used_at is None else float(last_used_at)
        with self._lock:
            self._db.execute(
                """
                UPDATE models
                SET last_used_at = ?, updated_at = ?
                WHERE client_id = ? AND model_id = ?
                """,
                (used_ts, used_ts, client_id, model_id),
            )
            self._db.commit()

    def get_model_row(self, client_id, model_id):
        # Return latest model metadata row, or None if missing.
        with self._lock:
            return self._db.execute(
                "SELECT * FROM models WHERE client_id = ? AND model_id = ?",
                (client_id, model_id),
            ).fetchone()

    def close(self):
        # Ensure connection closes under lock to avoid races on shutdown.
        with self._lock:
            self._db.close()
