import { flatbuffers } from './flatbuffers.js';
import ML from './ml_generated.js';

function generateId(prefix) {
  // randomUUID is available on modern Node versions.
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

class BaseModel {
  constructor(modelType, params = {}, options = {}) {
    if (!modelType) {
      throw new Error("modelType is required");
    }

    this.type = modelType;
    this.id = options.id || generateId(String(modelType).toLowerCase());
    this.name = options.name || `${modelType}_${this.id}`;
    this.params = { ...params };
    this._destroyed = false;
  }

  _assertNotDestroyed() {
    if (this._destroyed) {
      throw new Error(`Model ${this.name} has been destroyed`);
    }
  }

  _assertArray(name, value) {
    if (!Array.isArray(value)) {
      throw new Error(`${name} must be an array`);
    }
  }

  _assertPairedArrays(x, y) {
    this._assertArray("x", x);
    this._assertArray("y", y);
    if (x.length !== y.length) {
      throw new Error("x and y must have the same length");
    }
  }

  _baseDetails() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      params: { ...this.params },
      destroyed: this._destroyed
    };
  }

  _createTensor(builder, name, dataArray) {
    const nameOffset = builder.createString(name);
    const floatArray = new Float32Array(dataArray);
    const byteArray = new Uint8Array(floatArray.buffer);
    const dataOffset = ML.Tensor.createDataVector(builder, byteArray);
    const shapeOffset = ML.Tensor.createShapeVector(builder, [dataArray.length]);

    ML.Tensor.startTensor(builder);
    ML.Tensor.addName(builder, nameOffset);
    ML.Tensor.addDtype(builder, ML.DType.FLOAT32);
    ML.Tensor.addShape(builder, shapeOffset);
    ML.Tensor.addData(builder, dataOffset);
    return ML.Tensor.endTensor(builder);
  }

  _createStringParam(builder, key, value) {
    const keyOffset = builder.createString(String(key));
    const valOffset = builder.createString(String(value));

    ML.StringVal.startStringVal(builder);
    ML.StringVal.addValue(builder, valOffset);
    const stringVal = ML.StringVal.endStringVal(builder);

    ML.Param.startParam(builder);
    ML.Param.addKey(builder, keyOffset);
    ML.Param.addValueType(builder, ML.ParamValue.StringVal);
    ML.Param.addValue(builder, stringVal);
    return ML.Param.endParam(builder);
  }

  _parseScore(message) {
    const score = parseFloat(message);
    return Number.isNaN(score) ? 0.0 : score;
  }

  _parseStatusPayload(message, fallbackStatus) {
    try {
      const parsed = JSON.parse(message || "{}");
      if (parsed.status === "failed") {
        return {
          status: "failed",
          error_msg: parsed.error_msg || "Unknown error"
        };
      }
      if (parsed.status === "ready") {
        return { status: "ready" };
      }
    } catch (err) {
      // Fall through to status-code based fallback.
    }

    if (fallbackStatus === 0) {
      return { status: "ready" };
    }
    return { status: "failed", error_msg: message || "Unknown error" };
  }

  _parsePredictPayload(message) {
    if (Array.isArray(message)) {
      return message;
    }

    if (message && typeof message === "object" && Array.isArray(message.y_pred)) {
      return message.y_pred;
    }

    try {
      const text = String(message || "{}");
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed.y_pred)) {
        return parsed.y_pred;
      }
    } catch (err) {
      // Fall through to empty prediction fallback.
    }
    return [];
  }

  _toUint8Array(value) {
    if (value instanceof Uint8Array) {
      return value;
    }

    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }

    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }

    if (Array.isArray(value)) {
      return new Uint8Array(value);
    }

    if (typeof value === "string") {
      const bytes = new Uint8Array(value.length);
      for (let index = 0; index < value.length; index += 1) {
        bytes[index] = value.charCodeAt(index) & 0xff;
      }
      return bytes;
    }

    throw new Error("Expected FlatBuffers response bytes or a byte-encoded string");
  }

  _buildRequest({ action, params, x, y }) {
    const builder = new flatbuffers.Builder(1024);

    const typeOffset = builder.createString(this.type);
    const idOffset = builder.createString(this.id);
    const nameOffset = builder.createString(this.name);

    let paramsVector = null;
    let xTensor = null;
    let yTensor = null;

    if (params && Object.keys(params).length > 0) {
      const paramOffsets = [];
      for (const key of Object.keys(params)) {
        paramOffsets.push(this._createStringParam(builder, key, params[key]));
      }
      paramsVector = ML.Request.createParamsVector(builder, paramOffsets);
    }

    if (Array.isArray(x)) {
      xTensor = this._createTensor(builder, "x", x);
    }

    if (Array.isArray(y)) {
      yTensor = this._createTensor(builder, "y", y);
    }

    ML.Request.startRequest(builder);
    ML.Request.addAction(builder, action);
    ML.Request.addType(builder, typeOffset);
    ML.Request.addId(builder, idOffset);
    ML.Request.addName(builder, nameOffset);

    if (paramsVector !== null) {
      ML.Request.addParams(builder, paramsVector);
    }

    if (xTensor !== null) {
      ML.Request.addX(builder, xTensor);
    }

    if (yTensor !== null) {
      ML.Request.addY(builder, yTensor);
    }

    const req = ML.Request.endRequest(builder);
    builder.finish(req);
    return builder.asUint8Array();
  }

  convertStringToFlatbuffers(str) {
    const buf = new flatbuffers.ByteBuffer(this._toUint8Array(str));
    const resp = ML.Response.getRootAsResponse(buf);
    return resp;
  }

  async malabrCheckStatusAsync(payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.malabr.checkStatus( {payload}, (result) => {
          resolve(this.convertStringToFlatbuffers(result));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async check_status() {
    this._assertNotDestroyed();
    const payload = this._buildRequest({ action: ML.Action.CHECK_STATUS });
    const resp = await this.malabrCheckStatusAsync(payload);
    return this._parseStatusPayload(resp.message(), resp.status());
  }

  async malabrFitAsync(payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.malabr.fit({ payload }, (result) => {
          resolve(this.convertStringToFlatbuffers(result));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async fit(x, y) {
    this._assertNotDestroyed();
    this._assertPairedArrays(x, y);
    const payload = this._buildRequest({
      action: ML.Action.FIT,
      params: this.params,
      x,
      y
    });
    const result = await this.malabrFitAsync(payload);
    return result.status() === 0;
  }

  async malabrPredictAsync(payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.malabr.predict({ payload }, (result) => {
          debugger
          resolve(this.convertStringToFlatbuffers(result));
        });
      } catch (err) {
        reject(err);
      }
    });
  }
  
  async predict(x) {
    this._assertNotDestroyed();
    this._assertArray("x", x);
    const payload = this._buildRequest({
      action: ML.Action.PREDICT,
      x
    });
    const resp = await this.malabrPredictAsync(payload);
    return this._parsePredictPayload(resp.message());
  }

  async malabrScoreAsync(payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.malabr.score({ payload }, (result) => {
          resolve(this.convertStringToFlatbuffers(result));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async score(x, y) {
    this._assertNotDestroyed();
    this._assertPairedArrays(x, y);
    const payload = this._buildRequest({
      action: ML.Action.SCORE,
      x,
      y
    });
    const resp = await this.malabrScoreAsync(payload);
    return this._parseScore(resp.message());
  }

  details() {
    return this._baseDetails();
  }

  destroy() {
    this._destroyed = true;
    this.params = {};
  }
}

export default BaseModel;
