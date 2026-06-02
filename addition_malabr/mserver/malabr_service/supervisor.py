import json
import multiprocessing as mp
import os
import queue
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from ML.Action import Action
from .protocol import decode_fb_str, parse_request_params, predict_payload, tensor_to_numpy
from .storage import MetadataStore
from .training import SKLEARN_IMPORT_ERROR, joblib, trainer_worker


# Coordinates training workers, inference pool, cache, and metadata updates.
class Supervisor:
    def __init__(self, cfg):
        self.cfg = cfg

        self.cache_lock = threading.Lock()
        self.model_cache = OrderedDict()

        self.train_queue = mp.Queue(maxsize=cfg.train_queue_maxsize)
        self.result_queue = mp.Queue()
        self.trainers = []

        self.running = threading.Event()
        self.running.set()
        self.inference_pool = ThreadPoolExecutor(max_workers=cfg.inference_workers)

        os.makedirs(cfg.model_dir, exist_ok=True)
        self.store = MetadataStore(cfg.db_path)

        self.result_thread = threading.Thread(target=self._result_loop, daemon=True)

    def _upsert_model(self, client_id, model_id, model_type, model_name, status, error_msg, model_path, model_size, params):
        self.store.upsert_model(client_id, model_id, model_type, model_name, status, error_msg, model_path, model_size, params)

    def _touch_model_last_used(self, client_id, model_id):
        self.store.touch_model_last_used(client_id, model_id)

    def _authorize_client(self, client_id):
        normalized = (client_id or "").strip()
        if not normalized:
            return False
        self.store.ensure_client(normalized)
        allowed = self.store.authorize_client(normalized)
        if allowed:
            self.store.touch_client_activity(normalized, mark_auth=True)
        return allowed

    def _get_model_row(self, client_id, model_id):
        return self.store.get_model_row(client_id, model_id)

    def _wait_for_terminal_model_state(self, client_id, model_id, timeout_sec=None):
        # Briefly wait for queued/training states before serving sync calls.
        timeout = self.cfg.model_ready_wait_sec if timeout_sec is None else timeout_sec
        deadline = time.time() + max(timeout, 0.0)
        row = self._get_model_row(client_id, model_id)
        if row is None:
            return None

        while row["status"] in {"queued", "training"} and time.time() < deadline:
            time.sleep(self.cfg.model_ready_poll_sec)
            row = self._get_model_row(client_id, model_id)
            if row is None:
                return None
        return row

    def _result_loop(self):
        # Consume asynchronous worker events and mirror them into metadata tables.
        while self.running.is_set():
            try:
                result = self.result_queue.get(timeout=0.5)
            except queue.Empty:
                continue
            except Exception:
                continue

            event = result.get("event")
            client_id = result.get("client_id")
            model_id = result.get("model_id")
            if event == "started":
                row = self._get_model_row(client_id, model_id)
                if row:
                    self._upsert_model(
                        client_id=client_id,
                        model_id=model_id,
                        model_type=row["model_type"],
                        model_name=row["model_name"],
                        status="training",
                        error_msg="",
                        model_path=row["model_path"] or "",
                        model_size=row["model_size"] or 0,
                        params=json.loads(row["params_json"] or "{}"),
                    )
                continue

            if event == "completed":
                self._upsert_model(
                    client_id=result["client_id"],
                    model_id=result["model_id"],
                    model_type=result["model_type"],
                    model_name=result["model_name"],
                    status=result["status"],
                    error_msg=result.get("error_msg", ""),
                    model_path=result.get("model_path", ""),
                    model_size=result.get("model_size", 0),
                    params=result.get("params", {}),
                )

                with self.cache_lock:
                    cache_key = (client_id, model_id)
                    if cache_key in self.model_cache:
                        del self.model_cache[cache_key]

    def start(self):
        for _ in range(self.cfg.trainer_workers):
            proc = mp.Process(
                target=trainer_worker,
                args=(self.train_queue, self.result_queue, self.cfg),
                daemon=True,
            )
            proc.start()
            self.trainers.append(proc)
        self.result_thread.start()
        print(
            "Supervisor started | "
            f"trainers={self.cfg.trainer_workers} "
            f"inference_workers={self.cfg.inference_workers}"
        )

    def stop(self):
        self.running.clear()

        for _ in self.trainers:
            try:
                self.train_queue.put_nowait(None)
            except Exception:
                pass

        for proc in self.trainers:
            proc.join(timeout=2)
            if proc.is_alive():
                proc.terminate()

        self.inference_pool.shutdown(wait=True)
        self.store.close()

    def _load_model_mmap(self, client_id, model_id, model_path):
        # LRU cache avoids repeated model deserialization on hot paths.
        if joblib is None:
            raise RuntimeError("joblib unavailable")

        cache_key = (client_id, model_id)

        with self.cache_lock:
            if cache_key in self.model_cache:
                model = self.model_cache.pop(cache_key)
                self.model_cache[cache_key] = model
                return model

        model = joblib.load(model_path, mmap_mode="r")

        with self.cache_lock:
            self.model_cache[cache_key] = model
            while len(self.model_cache) > self.cfg.model_cache_size:
                self.model_cache.popitem(last=False)
        return model

    def _predict_impl(self, client_id, model_id, x):
        # Perform prediction after validating model readiness and artifact path.
        row = self._get_model_row(client_id, model_id)
        if row is None:
            return predict_payload([], status=1)
        if row["status"] != "ready":
            return predict_payload([], status=1)
        if not row["model_path"] or not os.path.exists(row["model_path"]):
            return predict_payload([], status=1)

        model = self._load_model_mmap(client_id, model_id, row["model_path"])
        preds = model.predict(x)
        y_pred = np.asarray(preds).reshape(-1).tolist()
        self._touch_model_last_used(client_id, model_id)
        return predict_payload(y_pred, status=0)

    def _score_impl(self, client_id, model_id, x, y):
        # Compute score from persisted model artifact.
        row = self._get_model_row(client_id, model_id)
        if row is None:
            return {"status": 1, "message": "0.0"}
        if row["status"] != "ready":
            return {"status": 1, "message": "0.0"}
        if not row["model_path"] or not os.path.exists(row["model_path"]):
            return {"status": 1, "message": "0.0"}

        model = self._load_model_mmap(client_id, model_id, row["model_path"])
        score = float(model.score(x, y))
        self._upsert_model(
            client_id=client_id,
            model_id=row["model_id"],
            model_type=row["model_type"],
            model_name=row["model_name"],
            status=row["status"],
            error_msg=row["error_msg"] or "",
            model_path=row["model_path"],
            model_size=row["model_size"] or 0,
            params=json.loads(row["params_json"] or "{}"),
        )
        self._touch_model_last_used(client_id, model_id)
        return {"status": 0, "message": str(score)}

    def handle_fit(self, req, client_id):
        # Validate payload and enqueue isolated training job.
        model_id = decode_fb_str(req.Id())
        model_type = decode_fb_str(req.Type())
        model_name = decode_fb_str(req.Name()) or model_id
        params = parse_request_params(req)

        if not model_id or not model_type:
            return {"status": 1, "message": "fit_failed"}

        if SKLEARN_IMPORT_ERROR is not None:
            self._upsert_model(
                client_id=client_id,
                model_id=model_id,
                model_type=model_type,
                model_name=model_name,
                status="failed",
                error_msg=f"scikit-learn unavailable: {SKLEARN_IMPORT_ERROR}",
                model_path="",
                model_size=0,
                params=params,
            )
            return {"status": 1, "message": "fit_failed"}

        x = tensor_to_numpy(req.X(), flatten=False)
        y = tensor_to_numpy(req.Y(), flatten=True)
        if x is None or y is None:
            self._upsert_model(
                client_id=client_id,
                model_id=model_id,
                model_type=model_type,
                model_name=model_name,
                status="failed",
                error_msg="x and y are required for fit",
                model_path="",
                model_size=0,
                params=params,
            )
            return {"status": 1, "message": "fit_failed"}

        if x.ndim == 1:
            x = x.reshape(-1, 1)

        if x.shape[0] != y.shape[0]:
            self._upsert_model(
                client_id=client_id,
                model_id=model_id,
                model_type=model_type,
                model_name=model_name,
                status="failed",
                error_msg=f"x/y sample mismatch: {x.shape[0]} vs {y.shape[0]}",
                model_path="",
                model_size=0,
                params=params,
            )
            return {"status": 1, "message": "fit_failed"}

        if x.shape[0] < 4:
            self._upsert_model(
                client_id=client_id,
                model_id=model_id,
                model_type=model_type,
                model_name=model_name,
                status="failed",
                error_msg="Need at least 4 samples to create train/test split",
                model_path="",
                model_size=0,
                params=params,
            )
            return {"status": 1, "message": "fit_failed"}

        self._upsert_model(
            client_id=client_id,
            model_id=model_id,
            model_type=model_type,
            model_name=model_name,
            status="queued",
            error_msg="",
            model_path="",
            model_size=0,
            params=params,
        )

        try:
            self.train_queue.put_nowait(
                {
                    "client_id": client_id,
                    "model_id": model_id,
                    "model_type": model_type,
                    "model_name": model_name,
                    "params": params,
                    "x": x,
                    "y": y,
                }
            )
        except queue.Full:
            self._upsert_model(
                client_id=client_id,
                model_id=model_id,
                model_type=model_type,
                model_name=model_name,
                status="failed",
                error_msg="training queue is full",
                model_path="",
                model_size=0,
                params=params,
            )
            return {"status": 1, "message": "fit_failed"}

        return {"status": 0, "message": "fit_started"}

    def handle_predict(self, req, client_id):
        # Prediction is served from inference thread pool for isolation.
        model_id = decode_fb_str(req.Id())
        x = tensor_to_numpy(req.X(), flatten=False)
        if not model_id or x is None:
            return predict_payload([], status=1)

        if x.ndim == 1:
            x = x.reshape(-1, 1)

        row = self._wait_for_terminal_model_state(client_id, model_id)
        if row is None or row["status"] != "ready":
            return predict_payload([], status=1)

        future = self.inference_pool.submit(self._predict_impl, client_id, model_id, x)
        try:
            return future.result()
        except Exception:
            return predict_payload([], status=1)

    def handle_score(self, req, client_id):
        # Score supports explicit x/y evaluation and fallback behavior.
        model_id = decode_fb_str(req.Id())
        x = tensor_to_numpy(req.X(), flatten=False)
        y = tensor_to_numpy(req.Y(), flatten=True)

        if not model_id:
            return {"status": 1, "message": "0.0"}

        if x is None or y is None:
            row = self._get_model_row(client_id, model_id)
            if row is None:
                return {"status": 1, "message": "0.0"}
            return {"status": 0, "message": "0.0"}

        if x.ndim == 1:
            x = x.reshape(-1, 1)

        if x.shape[0] != y.shape[0]:
            return {"status": 1, "message": "0.0"}

        row = self._wait_for_terminal_model_state(client_id, model_id)
        if row is None or row["status"] != "ready":
            return {"status": 1, "message": "0.0"}

        future = self.inference_pool.submit(self._score_impl, client_id, model_id, x, y)
        try:
            return future.result()
        except Exception:
            return {"status": 1, "message": "0.0"}

    def handle_status(self, req, client_id):
        # Translate internal model status into client-facing status payload.
        model_id = decode_fb_str(req.Id())
        if not model_id:
            return {
                "status": 1,
                "message": json.dumps({"status": "failed", "error_msg": "Model not found"}),
            }

        row = self._wait_for_terminal_model_state(client_id, model_id)
        if row is None:
            return {
                "status": 1,
                "message": json.dumps({"status": "failed", "error_msg": "Model not found"}),
            }

        status = row["status"]
        if status == "failed":
            return {
                "status": 1,
                "message": json.dumps({"status": "failed", "error_msg": row["error_msg"] or "Unknown error"}),
            }
        if status == "ready":
            return {"status": 0, "message": json.dumps({"status": "ready"})}

        return {"status": 0, "message": json.dumps({"status": "training"})}

    def route_request(self, req, client_id, route):
        # Action router for all protocol-level requests.
        if not self._authorize_client(client_id):
            return {"status": 1, "message": "unauthorized"}

        action = req.Action()
        if action == Action.FIT and route == "ROUTE_MALABR_FIT_API":
            return self.handle_fit(req, client_id)
        if action == Action.PREDICT and route == "ROUTE_MALABR_PREDICT_API":
            return self.handle_predict(req, client_id)
        if action == Action.SCORE and route == "ROUTE_MALABR_SCORE_API":
            return self.handle_score(req, client_id)
        if action == Action.CHECK_STATUS and route == "ROUTE_MALABR_CHECK_STATUS_API":
            return self.handle_status(req, client_id)
        return {"status": 1, "message": "Unknown action and route"}