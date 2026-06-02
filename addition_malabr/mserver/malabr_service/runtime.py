import os
import signal
import socket
import struct
from concurrent.futures import ThreadPoolExecutor

from ML.Request import Request
from .config import load_config
from .protocol import build_response, recv_full, unpack_client_envelope
from .supervisor import Supervisor


def run_server(config=None):
    # Runtime bootstrap: config, supervisor, Unix socket listener.
    cfg = config or load_config()

    if os.path.exists(cfg.socket_path):
        os.remove(cfg.socket_path)

    supervisor = Supervisor(cfg)
    supervisor.start()

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(cfg.socket_path)
    server.listen(128)

    def shutdown(*_):
        # Graceful cleanup for both ctrl-c and SIGTERM.
        print("Shutting down server...")
        supervisor.stop()
        try:
            server.close()
        except Exception:
            pass
        if os.path.exists(cfg.socket_path):
            os.remove(cfg.socket_path)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print("ML Server listening on", cfg.socket_path)

    client_pool = ThreadPoolExecutor(max_workers=max(cfg.inference_workers, 8))

    def handle_connection(conn):
        # Handle one framed request-response exchange.
        try:
            header_len_buf = recv_full(conn, 4)
            if not header_len_buf:
                return

            header_len = struct.unpack(">I", header_len_buf)[0]
            header_bytes = recv_full(conn, header_len)
            if header_bytes is None:
                return

            route, client_id, payload_size = unpack_client_envelope(header_bytes)
            req_payload = recv_full(conn, payload_size)
            if req_payload is None:
                return

            req = Request.GetRootAsRequest(req_payload, 0)
            print(f"Received request for route '{route}' from client '{client_id}'")
            payload = supervisor.route_request(req, client_id, route)
            response_buf = build_response(payload)

            conn.sendall(struct.pack(">I", len(response_buf)))
            conn.sendall(response_buf)
        except Exception as exc:
            print("Connection error:", exc)
        finally:
            conn.close()

    try:
        while True:
            conn, _ = server.accept()
            client_pool.submit(handle_connection, conn)
    finally:
        client_pool.shutdown(wait=True)
        supervisor.stop()
        server.close()
        if os.path.exists(cfg.socket_path):
            os.remove(cfg.socket_path)
