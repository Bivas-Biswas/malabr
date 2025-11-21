import socket
import json
from types_defs import RespondStatus

def respond(conn: socket.socket, status: RespondStatus, message: str) -> None:
    data = json.dumps({"status": status, "message": message}).encode("utf-8")
    length_prefix = len(data).to_bytes(4, "big")
    conn.sendall(length_prefix + data)
