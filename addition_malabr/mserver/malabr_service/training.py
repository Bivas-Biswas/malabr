import inspect
import os
import time

try:
    import joblib
except Exception:
    joblib = None

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.svm import SVC
    SKLEARN_IMPORT_ERROR = None
except Exception as exc:
    SKLEARN_IMPORT_ERROR = str(exc)


def filter_model_params(model_cls, raw_params):
    # Drop unsupported kwargs before model instantiation.
    signature = inspect.signature(model_cls.__init__)
    valid = {name for name in signature.parameters if name != "self"}

    filtered = {}
    ignored = []
    for key, value in raw_params.items():
        if key in valid:
            filtered[key] = value
        else:
            ignored.append(key)
    return filtered, ignored


def build_model(model_type, req_params):
    # Map model type string to sklearn estimator with safe defaults.
    if model_type == "SVC":
        model_cls = SVC
        defaults = {}
    elif model_type == "LogisticRegression":
        model_cls = LogisticRegression
        defaults = {"max_iter": 1000}
    elif model_type == "RandomForestClassifier":
        model_cls = RandomForestClassifier
        defaults = {"n_estimators": 200, "random_state": 42}
    else:
        raise ValueError(f"Unsupported model type: {model_type}")

    filtered_params, ignored_params = filter_model_params(model_cls, req_params)
    model_kwargs = {**defaults, **filtered_params}
    return model_cls(**model_kwargs), model_kwargs, ignored_params


def apply_training_limits(cfg):
    # Best-effort resource limits for worker process safety.
    try:
        import resource
    except Exception:
        return

    try:
        memory_bytes = cfg.train_memory_limit_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    except Exception:
        pass

    try:
        resource.setrlimit(resource.RLIMIT_CPU, (cfg.train_cpu_time_limit_sec, cfg.train_cpu_time_limit_sec))
    except Exception:
        pass


def train_one_job(job, cfg):
    # Train and persist one model artifact from queued job payload.
    client_id = job["client_id"]
    model_id = job["model_id"]
    model_type = job["model_type"]
    model_name = job["model_name"]
    params = job["params"]
    x = job["x"]
    y = job["y"]

    if SKLEARN_IMPORT_ERROR is not None:
        return {
            "client_id": client_id,
            "model_id": model_id,
            "model_type": model_type,
            "model_name": model_name,
            "status": "failed",
            "error_msg": f"scikit-learn unavailable: {SKLEARN_IMPORT_ERROR}",
            "model_path": "",
            "params": params,
        }

    if joblib is None:
        return {
            "client_id": client_id,
            "model_id": model_id,
            "model_type": model_type,
            "model_name": model_name,
            "status": "failed",
            "error_msg": "joblib unavailable; cannot persist model",
            "model_path": "",
            "params": params,
        }

    try:
        model, model_params, ignored_params = build_model(model_type, params)
        if ignored_params:
            print(f"[{model_id}] Ignored unsupported params: {ignored_params}")

        model.fit(x, y)

        os.makedirs(cfg.model_dir, exist_ok=True)
        model_path = os.path.join(cfg.model_dir, f"{model_id}.joblib")
        joblib.dump(model, model_path)
        model_size = os.path.getsize(model_path)

        return {
            "client_id": client_id,
            "model_id": model_id,
            "model_type": model_type,
            "model_name": model_name,
            "status": "ready",
            "error_msg": "",
            "model_path": model_path,
            "model_size": model_size,
            "params": model_params,
        }
    except Exception as exc:
        return {
            "client_id": client_id,
            "model_id": model_id,
            "model_type": model_type,
            "model_name": model_name,
            "status": "failed",
            "error_msg": str(exc),
            "model_path": "",
            "params": params,
        }


def trainer_worker(train_queue, result_queue, cfg):
    # Long-running worker process consuming train jobs.
    apply_training_limits(cfg)
    while True:
        job = train_queue.get()
        if job is None:
            break

        started_at = time.time()
        result_queue.put({
            "event": "started",
            "client_id": job["client_id"],
            "model_id": job["model_id"],
            "started_at": started_at,
        })

        result = train_one_job(job, cfg)
        result["event"] = "completed"
        result["finished_at"] = time.time()
        result_queue.put(result)
