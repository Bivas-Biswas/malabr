import socket
from datetime import datetime
import time

from response import respond
from types_defs import Payload

def handle(conn: socket.socket, payload: Payload):
    now = datetime.now()
    time.sleep(2)
    respond(conn, "ok", f"I am alive! {now}")