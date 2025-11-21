import threading
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from transformers import pipeline
import os

# --------------------
# Setup
# --------------------
file_path="./file2.txt"
question = "when was iit kgp founded?"
context = ""
with open(file_path, "r") as f:
    context = f.read()

size_bytes = os.path.getsize(file_path)

_qa_pipeline_lock = threading.Lock()
_qa_pipeline = pipeline(
    "question-answering",
    model="csarron/mobilebert-uncased-squad-v2",
    tokenizer="csarron/mobilebert-uncased-squad-v2"
)

# --------------------
# Inference function
# --------------------
def infer(question: str, context: str) -> str:
    with _qa_pipeline_lock:
        global _qa_pipeline
        result = _qa_pipeline(question=question, context=context)
        # print(result)
        return result["answer"]

# --------------------
# Benchmark helpers
# --------------------
def run_with_timing(payload, start_time):
    infer(payload["question"], payload["context"])
    return time.perf_counter() - start_time

def benchmark_infer(payload, iterations=20, pool_size=5, warmup=5, log_file="benchmark_log.txt"):
    # Warmup (not measured)
    for _ in range(warmup):
        infer(payload["question"], payload["context"])

    latencies = []
    benchmark_start = time.perf_counter()

    # Concurrency
    with ThreadPoolExecutor(max_workers=pool_size) as executor:
        futures = []
        for _ in range(iterations):
            start_time = time.perf_counter()
            futures.append(
                executor.submit(run_with_timing, payload, start_time)
            )

        for future in as_completed(futures):
            latencies.append(future.result())

    benchmark_end = time.perf_counter()
    total_time = benchmark_end - benchmark_start
    throughput = iterations / total_time

    # Latency stats
    latencies.sort()
    avg = sum(latencies) / len(latencies)
    median = statistics.median(latencies)
    p90 = latencies[int(len(latencies) * 0.9)]
    p99 = latencies[int(len(latencies) * 0.99) - 1]

    result = f"""
    Benchmark (N={iterations}, concurrency={pool_size}):
    Avg: {avg * 1000:.2f} ms
    Median: {median * 1000:.2f} ms
    P90: {p90 * 1000:.2f} ms
    P99: {p99 * 1000:.2f} ms
    Throughput: {throughput:.2f} req/sec
    """
    # print(result)
    with open(log_file, "a") as f:
        f.write(result + "\n")

    return
    # return {
    #     "latencies": latencies,
    #     "throughput": throughput,
    #     "total_time": total_time
    # }

# --------------------
# Main
# --------------------
if __name__ == "__main__":
    # concurrency = [5, 25, 50, 100, 200]
    # iteration = 500
    # warmup = 5
    
    # concurrency = [1]
    # iteration = 1
    # warmup = 0
    print(f"context size: {size_bytes / 1024:.2f}")
    payload = {"question": question, "context": context}
    print(run_with_timing(payload,  start_time = time.perf_counter()) * 1000)
    # for size in concurrency:
    #     print(f"Started concurrency: {size}", end="\n")
    #     benchmark_infer(payload, iterations=iteration, pool_size=size, warmup=warmup, log_file=f"{size_bytes / 1024:.2f}KB_{iteration}_{size}_concurrent.txt")
    #     print(f"Ended concurrency: {size}", end="\n")
