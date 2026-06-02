import BaseModel from "./base_model.js";

class SVC extends BaseModel {
  constructor(params = {}, options = {}) {
    const defaults = {
      C: "1.0",
      kernel: "rbf",
      gamma: "scale"
    };
    super("SVC", { ...defaults, ...params }, options);
  }
}

export default SVC;
