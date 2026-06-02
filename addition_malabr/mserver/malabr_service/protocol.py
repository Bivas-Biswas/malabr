import json
import struct

import flatbuffers
import numpy as np

import ML.Response as Response
from ML.ParamValue import ParamValue
from ML.StringVal import StringVal


def recv_full(conn, size):
    data = b""
    while len(data) < size:
        packet = conn.recv(size - len(data))
        if not packet:
            return None
        data += packet
    return data


def parse_tensor(tensor):
    if tensor is None:
        return None

    shape = [tensor.Shape(i) for i in range(tensor.ShapeLength())]
    data_bytes = tensor.DataAsNumpy().tobytes()
    return shape, data_bytes


def tensor_to_numpy(tensor, flatten=False):
    parsed = parse_tensor(tensor)
    if not parsed:
        return None

    shape, data_bytes = parsed
    if not shape:
        return None

    expected_size = int(np.prod(shape))
    values = np.frombuffer(data_bytes, dtype=np.float32)
    if values.size < expected_size:
        return None

    arr = values[:expected_size].reshape(shape)
    return arr.reshape(-1) if flatten else arr


def decode_fb_str(value):
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        return value.decode()
    return str(value)


def coerce_param_value(value):
    if value is None:
        return None

    if isinstance(value, str):
        lower_value = value.strip().lower()
        if lower_value in {"true", "false"}:
            return lower_value == "true"

        try:
            if any(ch in value for ch in [".", "e", "E"]):
                return float(value)
            return int(value)
        except ValueError:
            return value

    return value


def parse_request_params(req):
    params = {}
    params_len = req.ParamsLength() if hasattr(req, "ParamsLength") else 0
    for idx in range(params_len):
        param = req.Params(idx)
        if param is None:
            continue

        key = decode_fb_str(param.Key()) if hasattr(param, "Key") else None
        if not key:
            continue

        raw_value = None
        try:
            value_type = param.ValueType()
        except Exception:
            value_type = None

        if value_type == ParamValue.StringVal:
            str_val = StringVal()
            try:
                # Support FlatBuffers Python codegen variants:
                # 1) Value(obj) populates and/or returns obj
                # 2) Value() returns a generic table that needs Init into StringVal
                try:
                    parsed = param.Value(str_val)
                    if parsed is not None:
                        str_val = parsed
                except TypeError:
                    parsed = param.Value()
                    if parsed is not None and hasattr(parsed, "Bytes") and hasattr(parsed, "Pos"):
                        str_val.Init(parsed.Bytes, parsed.Pos)
                    elif parsed is not None:
                        raw_value = decode_fb_str(parsed)

                if raw_value is None:
                    raw_value = decode_fb_str(str_val.Value())
            except Exception:
                raw_value = None

        if raw_value is not None:
            params[key] = coerce_param_value(raw_value)

    return params


def build_response(payload):
    builder = flatbuffers.Builder(256)
    msg_offset = builder.CreateString(payload.get("message", ""))

    Response.ResponseStart(builder)
    Response.ResponseAddStatus(builder, payload.get("status", 1))
    Response.ResponseAddMessage(builder, msg_offset)
    res = Response.ResponseEnd(builder)
    builder.Finish(res)
    return builder.Output()


def predict_payload(y_pred=None, status=0):
    return {"status": status, "message": json.dumps({"y_pred": y_pred or []})}


def unpack_client_envelope(header_bytes):
    if header_bytes is None or len(header_bytes) == 0:
        raise ValueError("invalid header")

    header = header_bytes.decode("utf-8")
    parts = header.split(",", 2)
    if len(parts) != 3:
        raise ValueError("invalid client envelope")

    route, client_id, payload_size_text = parts
    try:
        payload_size = int(payload_size_text)
    except ValueError as exc:
        raise ValueError("invalid payload size") from exc

    if payload_size < 0:
        raise ValueError("invalid payload size")

    return route, client_id, payload_size
