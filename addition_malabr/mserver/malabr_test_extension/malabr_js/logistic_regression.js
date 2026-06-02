import BaseModel from "./base_model.js";

class LogisticRegression extends BaseModel {
  constructor(params = {}, options = {}) {
    const defaults = {
      penalty: "l2",
      solver: "lbfgs",
      max_iter: "100"
    };
    super("LogisticRegression", { ...defaults, ...params }, options);
  }
}

export default LogisticRegression;
